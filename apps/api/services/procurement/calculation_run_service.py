"""
calculation_run_service.py — orchestration des runs Scope 3 cat. 1 (PR-05B).

Sépare strictement les rôles :
  - `services/calculations/procurement.py` = moteur **PUR** (hiérarchie, unités,
    incertitude). Zéro I/O, testable sans PostgreSQL.
  - ce module = **orchestration** : charge le périmètre, réunit le contexte de
    chaque ligne, gèle un snapshot d'entrée immuable, persiste run + résultats.

Garanties portées ici :

  - **Snapshot d'entrée immuable** : `input_snapshot` fige les lignes telles
    qu'elles étaient au moment du calcul. Un run reste relisible même si les
    achats ont été corrigés depuis.
  - **Reproductibilité / idempotence** : `input_fingerprint` = SHA-256 canonique
    de (méthodologie + version + snapshot). Recalculer sur des entrées
    identiques rend le run existant (`already_calculated=True`) au lieu d'en
    créer un second, sauf `force_recalculate`.
  - **Gate humain respecté** : seules les lignes d'imports **validés** entrent
    dans un calcul. Rien ne remonte au Scope 3 sans revue (patron PR-05A).
  - **Défense en profondeur** (contrats §7) : chaque requête porte son prédicat
    `company_id = %s` EN PLUS de la RLS — le PostgreSQL de CI se connecte en
    superuser et bypasse la RLS, sans quoi aucun test d'isolation ne passerait.
  - **Aucun LLM**, aucune suggestion automatique : la résolution de facteur est
    une correspondance exacte de catégorie, jamais un rapprochement flou.
"""

from __future__ import annotations

import hashlib
import json
from datetime import date
from typing import Any

from db.database import get_db
from models.analytics import (
    AnalyticalMeta,
    EvidenceRef,
    MethodRef,
    QualityMeta,
    confidence_to_display,
)
from models.procurement import (
    CalculationRequest,
    CalculationTraceData,
    CoverageData,
    LineResultResponse,
    MethodBreakdownRow,
    RunResponse,
    TraceStep,
)
from services.calculations import procurement as engine
from services.intelligence import license_policy

# Portée tenant stricte (aucune ligne globale sur les tables procurement).
_SCOPE = "company_id = %s"

# Statuts d'import dont les lignes peuvent alimenter un calcul : le gate humain
# de PR-05A (`pending → validated`) est la porte d'entrée obligatoire.
_CALCULABLE_IMPORT_STATUSES = ("validated", "emitted")


class ProcurementCalculationError(Exception):
    """Erreur métier d'un run de calcul (périmètre introuvable, gate non franchi…)."""


# ---------------------------------------------------------------------------
# Chargement du périmètre
# ---------------------------------------------------------------------------

def _load_scope_lines(
    cur, company_id: int, *, import_id: int | None,
    period_start: date | None, period_end: date | None,
) -> list[dict[str, Any]]:
    """Lignes d'achat retenues par le périmètre, ordre déterministe (`id`).

    Seules les lignes d'imports **validés** sont éligibles. Une ligne
    `needs_review` (aucune donnée d'activité exploitable) reste incluse : elle
    ressortira `unresolved`, visible, plutôt que d'être silencieusement exclue
    du dénominateur de couverture.
    """
    clauses = [
        f"pl.{_SCOPE}",
        "pi.status = ANY(%s)",
    ]
    params: list[Any] = [company_id, list(_CALCULABLE_IMPORT_STATUSES)]
    if import_id is not None:
        clauses.append("pl.import_id = %s")
        params.append(import_id)
    if period_start is not None:
        clauses.append("(pl.purchase_date IS NULL OR pl.purchase_date >= %s)")
        params.append(period_start)
    if period_end is not None:
        clauses.append("(pl.purchase_date IS NULL OR pl.purchase_date <= %s)")
        params.append(period_end)

    cur.execute(
        f"""
        SELECT pl.*
        FROM purchase_lines pl
        JOIN purchase_imports pi ON pi.id = pl.import_id AND pi.company_id = pl.company_id
        WHERE {' AND '.join(clauses)}
        ORDER BY pl.id
        """,
        params,
    )
    return [dict(r) for r in cur.fetchall()]


def _as_float(value: Any) -> float | None:
    return None if value is None else float(value)


def _snapshot_line(row: dict[str, Any]) -> dict[str, Any]:
    """Projection CANONIQUE d'une ligne dans le snapshot d'entrée.

    Volontairement limitée aux champs qui influencent le calcul : le snapshot
    doit être stable (deux runs identiques produisent le même fingerprint) et
    lisible, pas une copie brute de la table.
    """
    return {
        "line_id": row["id"],
        "supplier_id": row.get("supplier_id"),
        "product_id": row.get("product_id"),
        "quantity": _as_float(row.get("quantity")),
        "unit": row.get("unit"),
        "spend_amount": _as_float(row.get("spend_amount")),
        "currency": row.get("currency"),
        "category_code": row.get("category_code"),
        "origin_country": row.get("origin_country"),
        "purchase_date": row["purchase_date"].isoformat() if row.get("purchase_date") else None,
        "mapping_status": row.get("mapping_status"),
    }


def _fingerprint(snapshot: dict[str, Any]) -> str:
    """SHA-256 du snapshot canonicalisé (clés triées, séparateurs fixes).

    Inclut méthodologie et version : changer de méthodologie change le
    fingerprint, donc produit un nouveau run au lieu d'écraser l'ancien."""
    canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Contexte par ligne (PCF, déclarations, facteurs, BOM, licence)
# ---------------------------------------------------------------------------

def _load_pcfs(cur, company_id: int) -> dict[int, engine.PcfCandidate]:
    """PCF par produit fournisseur. En cas de PCF multiples, la plus VÉRIFIÉE
    puis la plus récente gagne — règle déterministe et explicite, jamais un
    choix arbitraire dépendant de l'ordre de lecture."""
    cur.execute(
        f"""
        SELECT * FROM product_carbon_footprints
        WHERE {_SCOPE}
        ORDER BY supplier_product_id,
                 CASE verification_status
                     WHEN 'third_party_verified' THEN 0
                     WHEN 'self_declared' THEN 1
                     ELSE 2
                 END,
                 created_at DESC, id DESC
        """,
        (company_id,),
    )
    out: dict[int, engine.PcfCandidate] = {}
    for row in cur.fetchall():
        key = row["supplier_product_id"]
        if key in out:
            continue  # le premier de l'ordre ci-dessus fait foi
        out[key] = engine.PcfCandidate(
            pcf_id=row["id"],
            value_kgco2e=_as_float(row["value_kgco2e"]),
            declared_unit=row["declared_unit"],
            verification_status=row["verification_status"],
            data_status=row["data_status"],
            methodology=row["methodology"],
            source_release_id=row["source_release_id"],
            evidence_artifact_id=row["evidence_artifact_id"],
            observation_id=row["observation_id"],
        )
    return out


# Codes métriques reconnus comme INTENSITÉ GES par unité de dépense (tCO2e/M€).
# Liste explicite : une déclaration d'un autre code n'est jamais réinterprétée
# comme une intensité (contrats §1 — catalogue de metric_code documenté).
INTENSITY_METRIC_CODES: tuple[str, ...] = (
    "ghg_intensity_tco2e_per_meur",
    "ghg_intensity_tco2e_per_meur_revenue",
)


def _load_declarations(cur, company_id: int) -> dict[int, engine.DeclarationCandidate]:
    """Déclarations d'intensité par fournisseur (la plus récente acceptée gagne)."""
    cur.execute(
        f"""
        SELECT * FROM supplier_metric_declarations
        WHERE {_SCOPE} AND metric_code = ANY(%s)
        ORDER BY supplier_id,
                 CASE review_status WHEN 'accepted' THEN 0 ELSE 1 END,
                 COALESCE(reporting_year, 0) DESC, created_at DESC, id DESC
        """,
        (company_id, list(INTENSITY_METRIC_CODES)),
    )
    out: dict[int, engine.DeclarationCandidate] = {}
    for row in cur.fetchall():
        key = row["supplier_id"]
        if key in out:
            continue
        out[key] = engine.DeclarationCandidate(
            declaration_id=row["id"],
            metric_code=row["metric_code"],
            value=_as_float(row["value"]),
            unit=row["unit"],
            review_status=row["review_status"],
            data_status=row["data_status"],
            primary_data_pct=_as_float(row["primary_data_pct"]),
            methodology=row["methodology"],
            source_release_id=row["source_release_id"],
            evidence_artifact_id=row["evidence_artifact_id"],
            observation_id=row["observation_id"],
        )
    return out


def _load_factors(cur) -> tuple[dict[str, engine.FactorCandidate], dict[str, engine.FactorCandidate]]:
    """Facteurs physiques et monétaires du catalogue global `emission_factors`,
    indexés par catégorie (minuscules).

    `emission_factors` est un catalogue GLOBAL (sans company_id) : pas de
    prédicat de périmètre ici — c'est délibéré et documenté, contrairement aux
    tables tenant où il est obligatoire. La sélection est une correspondance
    EXACTE de catégorie, jamais un rapprochement flou : sans catégorie
    reconnue, la ligne descend la hiérarchie avec sa raison."""
    cur.execute(
        """
        SELECT ef_code, label, category, factor_kgco2e, unit, source, version
        FROM emission_factors
        WHERE category IS NOT NULL
        ORDER BY category, version DESC, ef_code
        """
    )
    physical: dict[str, engine.FactorCandidate] = {}
    monetary: dict[str, engine.FactorCandidate] = {}
    for row in cur.fetchall():
        dim = engine.unit_dimension(row["unit"])
        if dim is None:
            continue
        candidate = engine.FactorCandidate(
            factor_id=row["ef_code"],
            factor_version=row["version"],
            factor_kgco2e=float(row["factor_kgco2e"]),
            unit=row["unit"],
            source=row["source"],
            category=row["category"],
        )
        key = (row["category"] or "").strip().lower()
        target = monetary if dim[0] == "monétaire" else physical
        target.setdefault(key, candidate)
    return physical, monetary


def _load_material_masses(cur, company_id: int) -> dict[int, tuple[float, str | None]]:
    """Masse (kg) par produit fournisseur, issue des correspondances matières
    **ACCEPTÉES EN REVUE** uniquement.

    Un mapping `pending`/`flagged` n'entre jamais dans un calcul : c'est le même
    gate humain que partout ailleurs. Les unités de masse sont converties
    explicitement ; une unité non convertible est ignorée (la ligne descendra la
    hiérarchie) plutôt que comptée à tort."""
    cur.execute(
        f"""
        SELECT bi.supplier_product_id, mm.mass_value, mm.mass_unit, mm.material_id
        FROM material_mappings mm
        JOIN bom_items bi ON bi.id = mm.bom_item_id AND bi.company_id = mm.company_id
        WHERE mm.{_SCOPE}
          AND mm.review_status = 'accepted'
          AND mm.mass_value IS NOT NULL
          AND bi.supplier_product_id IS NOT NULL
        ORDER BY bi.supplier_product_id, mm.id
        """,
        (company_id,),
    )
    out: dict[int, tuple[float, str | None]] = {}
    for row in cur.fetchall():
        conv = engine.convert_units(float(row["mass_value"]), row["mass_unit"], "kg")
        if conv is None:
            continue
        key = row["supplier_product_id"]
        prev_mass, prev_label = out.get(key, (0.0, None))
        out[key] = (prev_mass + conv.value, prev_label or row["material_id"])
    return out


def _load_license_by_release(cur, company_id: int) -> dict[int, engine.LicenseContext]:
    """Droits de licence par release, évalués une fois (contrats §8).

    `license_policy.evaluate` est déterministe et sans LLM. Le résultat sert à
    AVERTIR quand `allow_derived_use` est faux — la valeur reste utilisée, avec
    sa réserve visible sur la ligne et sur le run (contrat §8 : « warning
    sinon », pas un blocage)."""
    cur.execute(
        """
        SELECT sr.id AS release_id, s.*
        FROM source_releases sr
        JOIN source_registry s ON s.id = sr.source_id
        WHERE (sr.company_id = %s OR sr.company_id IS NULL)
        """,
        (company_id,),
    )
    out: dict[int, engine.LicenseContext] = {}
    for row in cur.fetchall():
        decision = license_policy.evaluate(row)
        out[row["release_id"]] = engine.LicenseContext(
            derived_use_allowed=decision.allow_derived_use,
            source_code=row.get("code"),
            reasons=tuple(decision.warnings[:2]),
        )
    return out


def _build_context(
    row: dict[str, Any],
    *,
    pcfs: dict[int, engine.PcfCandidate],
    declarations: dict[int, engine.DeclarationCandidate],
    physical: dict[str, engine.FactorCandidate],
    monetary: dict[str, engine.FactorCandidate],
    masses: dict[int, tuple[float, str | None]],
    licenses: dict[int, engine.LicenseContext],
) -> engine.LineContext:
    product_id = row.get("product_id")
    supplier_id = row.get("supplier_id")
    category = (row.get("category_code") or "").strip().lower()

    pcf = pcfs.get(product_id) if product_id is not None else None
    declaration = declarations.get(supplier_id) if supplier_id is not None else None
    mass, material_label = masses.get(product_id, (None, None)) if product_id is not None else (None, None)

    # La licence pertinente est celle de la source réellement utilisée pour
    # cette ligne (PCF d'abord, puis déclaration) — pas une licence « moyenne ».
    release_id = None
    if pcf is not None and pcf.source_release_id is not None:
        release_id = pcf.source_release_id
    elif declaration is not None and declaration.source_release_id is not None:
        release_id = declaration.source_release_id

    return engine.LineContext(
        pcf=pcf,
        declaration=declaration,
        physical_factor=physical.get(category) if category else None,
        spend_factor=monetary.get(category) if category else None,
        material_mass_kg=mass,
        material_label=material_label,
        license=licenses.get(release_id, engine.LicenseContext()),
    )


# ---------------------------------------------------------------------------
# Calcul d'un run
# ---------------------------------------------------------------------------

def _row_to_run(row: dict[str, Any], *, already_calculated: bool = False) -> RunResponse:
    data = dict(row)
    for key in ("confidence", "coverage_pct", "total_tco2e"):
        data[key] = _as_float(data.get(key))
    return RunResponse(**data, already_calculated=already_calculated)


def calculate(
    *, company_id: int, payload: CalculationRequest, created_by: int | None = None,
) -> RunResponse:
    """Exécute un run Scope 3 cat. 1 sur le périmètre demandé.

    Idempotent : sans `force_recalculate`, un run dont le fingerprint d'entrée
    existe déjà est RENDU tel quel (`already_calculated=True`) plutôt que
    dupliqué — recalculer deux fois les mêmes achats ne double jamais rien.
    """
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            if payload.import_id is not None:
                cur.execute(
                    f"SELECT status FROM purchase_imports WHERE id = %s AND {_SCOPE}",
                    (payload.import_id, company_id),
                )
                imp = cur.fetchone()
                if imp is None:
                    raise ProcurementCalculationError(
                        f"Import '{payload.import_id}' introuvable."
                    )
                if imp["status"] not in _CALCULABLE_IMPORT_STATUSES:
                    raise ProcurementCalculationError(
                        f"Import '{payload.import_id}' au statut '{imp['status']}' — "
                        "seul un import validé alimente un calcul (revue humaine requise)."
                    )

            rows = _load_scope_lines(
                cur, company_id,
                import_id=payload.import_id,
                period_start=payload.period_start,
                period_end=payload.period_end,
            )
            if not rows:
                raise ProcurementCalculationError(
                    "Aucune ligne d'achat validée dans le périmètre demandé — "
                    "valider un import avant de calculer."
                )

            snapshot = {
                "methodology_code": engine.METHODOLOGY_CODE,
                "methodology_version": engine.METHODOLOGY_VERSION,
                "scope": {
                    "import_id": payload.import_id,
                    "period_start": payload.period_start.isoformat() if payload.period_start else None,
                    "period_end": payload.period_end.isoformat() if payload.period_end else None,
                },
                "lines": [_snapshot_line(r) for r in rows],
            }
            fingerprint = _fingerprint(snapshot)

            if not payload.force_recalculate:
                cur.execute(
                    f"SELECT * FROM procurement_calculation_runs "
                    f"WHERE {_SCOPE} AND input_fingerprint = %s",
                    (company_id, fingerprint),
                )
                existing = cur.fetchone()
                if existing is not None:
                    return _row_to_run(dict(existing), already_calculated=True)

            pcfs = _load_pcfs(cur, company_id)
            declarations = _load_declarations(cur, company_id)
            physical, monetary = _load_factors(cur)
            masses = _load_material_masses(cur, company_id)
            licenses = _load_license_by_release(cur, company_id)

            computations: list[engine.LineComputation] = []
            factor_versions: dict[str, str] = {}
            for row in rows:
                ctx = _build_context(
                    row, pcfs=pcfs, declarations=declarations, physical=physical,
                    monetary=monetary, masses=masses, licenses=licenses,
                )
                comp = engine.compute_line(
                    engine.LineInput(
                        line_id=row["id"],
                        supplier_id=row.get("supplier_id"),
                        supplier_product_id=row.get("product_id"),
                        quantity=_as_float(row.get("quantity")),
                        unit=row.get("unit"),
                        spend_amount=_as_float(row.get("spend_amount")),
                        currency=row.get("currency"),
                        category_code=row.get("category_code"),
                        origin_country=row.get("origin_country"),
                        mapping_status=row.get("mapping_status") or "unmapped",
                    ),
                    ctx,
                )
                computations.append(comp)
                if comp.factor_id and comp.factor_version:
                    factor_versions[comp.factor_id] = comp.factor_version

            spend_by_line = {r["id"]: _as_float(r.get("spend_amount")) for r in rows}
            agg = engine.aggregate_run(computations, spend_by_line)

            result_payload = {
                "total_tco2e": agg.total_tco2e,
                "method_counts": agg.method_counts,
                "coverage_lines_pct": agg.coverage_lines_pct,
                "coverage_spend_pct": agg.coverage_spend_pct,
                "primary_data_share_pct": agg.primary_data_share_pct,
                "unresolved_spend_amount": agg.unresolved_spend_amount,
            }

            # Recalcul forcé : le run précédent de même fingerprint est marqué
            # `superseded` plutôt que supprimé — l'historique reste auditable.
            cur.execute(
                f"UPDATE procurement_calculation_runs SET status = 'superseded', updated_at = now() "
                f"WHERE {_SCOPE} AND input_fingerprint = %s AND status <> 'superseded'",
                (company_id, fingerprint),
            )
            cur.execute(
                """
                INSERT INTO procurement_calculation_runs
                    (company_id, import_id, period_start, period_end, methodology_code,
                     methodology_version, input_snapshot, input_fingerprint, factor_versions,
                     result, warnings, confidence, coverage_pct, line_count, unresolved_count,
                     total_tco2e, status, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        'calculated', %s)
                RETURNING *
                """,
                (
                    company_id, payload.import_id, payload.period_start, payload.period_end,
                    engine.METHODOLOGY_CODE, engine.METHODOLOGY_VERSION,
                    json.dumps(snapshot, sort_keys=True, default=str), fingerprint,
                    json.dumps(factor_versions, sort_keys=True),
                    json.dumps(result_payload, default=str),
                    json.dumps(list(agg.warnings)),
                    agg.confidence, agg.coverage_lines_pct, agg.line_count,
                    agg.unresolved_count, agg.total_tco2e, created_by,
                ),
            )
            run_row = dict(cur.fetchone())
            run_id = run_row["id"]

            for comp in computations:
                cur.execute(
                    """
                    INSERT INTO procurement_line_results
                        (company_id, run_id, purchase_line_id, supplier_id, supplier_product_id,
                         calculation_method, method_rank, factor_id, factor_version, factor_source,
                         activity_value, activity_unit, converted_value, converted_unit,
                         conversion_factor, conversion_note, result_tco2e, uncertainty_pct,
                         uncertainty_low_tco2e, uncertainty_high_tco2e, data_quality,
                         data_quality_label, confidence, data_status, fallback_reason,
                         warnings, method_trace,
                         evidence_artifact_id, source_release_id, observation_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        company_id, run_id, comp.line_id, comp.supplier_id, comp.supplier_product_id,
                        comp.calculation_method, comp.method_rank, comp.factor_id,
                        comp.factor_version, comp.factor_source, comp.activity_value,
                        comp.activity_unit, comp.converted_value, comp.converted_unit,
                        comp.conversion_factor, comp.conversion_note, comp.result_tco2e,
                        comp.uncertainty_pct, comp.uncertainty_low_tco2e, comp.uncertainty_high_tco2e,
                        comp.data_quality, comp.data_quality_label, comp.confidence,
                        comp.data_status, comp.fallback_reason,
                        json.dumps(list(comp.warnings)), json.dumps(list(comp.method_trace)),
                        comp.evidence_artifact_id, comp.source_release_id, comp.observation_id,
                    ),
                )
    return _row_to_run(run_row)


# ---------------------------------------------------------------------------
# Lecture
# ---------------------------------------------------------------------------

def get_run(*, company_id: int, run_id: int) -> RunResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM procurement_calculation_runs WHERE id = %s AND {_SCOPE}",
                (run_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise ProcurementCalculationError(f"Run '{run_id}' introuvable.")
    return _row_to_run(dict(row))


def list_runs(
    *, company_id: int, limit: int = 50, offset: int = 0,
) -> tuple[list[RunResponse], int]:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) AS c FROM procurement_calculation_runs WHERE {_SCOPE}",
                (company_id,),
            )
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM procurement_calculation_runs WHERE {_SCOPE} "
                "ORDER BY calculated_at DESC, id DESC LIMIT %s OFFSET %s",
                (company_id, limit, offset),
            )
            rows = cur.fetchall()
    return [_row_to_run(dict(r)) for r in rows], total


def _row_to_line_result(row: dict[str, Any]) -> LineResultResponse:
    data = dict(row)
    for key in (
        "activity_value", "converted_value", "conversion_factor", "result_tco2e",
        "uncertainty_pct", "uncertainty_low_tco2e", "uncertainty_high_tco2e",
        "data_quality", "confidence",
    ):
        data[key] = _as_float(data.get(key))
    return LineResultResponse(**data)


def _assert_run_in_scope(cur, company_id: int, run_id: int) -> None:
    cur.execute(
        f"SELECT 1 FROM procurement_calculation_runs WHERE id = %s AND {_SCOPE}",
        (run_id, company_id),
    )
    if cur.fetchone() is None:
        raise ProcurementCalculationError(f"Run '{run_id}' introuvable.")


def list_line_results(
    *,
    company_id: int,
    run_id: int,
    calculation_method: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[LineResultResponse], int]:
    """Résultats par ligne (drill-down). Les lignes non résolues sont dans la
    même liste que les autres — jamais reléguées ailleurs ni filtrées par défaut."""
    clauses = [_SCOPE, "run_id = %s"]
    params: list[Any] = [company_id, run_id]
    if calculation_method is not None:
        clauses.append("calculation_method = %s")
        params.append(calculation_method)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_run_in_scope(cur, company_id, run_id)
            cur.execute(f"SELECT COUNT(*) AS c FROM procurement_line_results {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM procurement_line_results {where} "
                "ORDER BY result_tco2e DESC NULLS LAST, id LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return [_row_to_line_result(dict(r)) for r in rows], total


def get_coverage(*, company_id: int, run_id: int) -> CoverageData:
    """Couverture d'un run : méthodes, résolu / non résolu, part de donnée primaire.

    Construit par agrégation SQL scopée — le total d'émissions n'est jamais
    présenté sans son taux de couverture ni son volume non résolu."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_run_in_scope(cur, company_id, run_id)
            cur.execute(
                f"""
                SELECT r.calculation_method, r.method_rank,
                       COUNT(*) AS line_count,
                       SUM(r.result_tco2e) AS result_tco2e,
                       SUM(pl.spend_amount) AS spend_amount
                FROM procurement_line_results r
                JOIN purchase_lines pl
                  ON pl.id = r.purchase_line_id AND pl.company_id = r.company_id
                WHERE r.{_SCOPE} AND r.run_id = %s
                GROUP BY r.calculation_method, r.method_rank
                ORDER BY r.method_rank
                """,
                (company_id, run_id),
            )
            method_rows = [dict(r) for r in cur.fetchall()]

            cur.execute(
                f"""
                SELECT
                    COUNT(*) AS line_count,
                    COUNT(*) FILTER (WHERE r.result_tco2e IS NOT NULL) AS resolved_count,
                    COUNT(*) FILTER (WHERE r.calculation_method = 'unresolved') AS unresolved_count,
                    COUNT(*) FILTER (WHERE r.method_rank <= 2) AS primary_count,
                    SUM(r.result_tco2e) AS total_tco2e,
                    SUM(pl.spend_amount) AS total_spend,
                    SUM(pl.spend_amount) FILTER (
                        WHERE r.calculation_method = 'unresolved'
                    ) AS unresolved_spend
                FROM procurement_line_results r
                JOIN purchase_lines pl
                  ON pl.id = r.purchase_line_id AND pl.company_id = r.company_id
                WHERE r.{_SCOPE} AND r.run_id = %s
                """,
                (company_id, run_id),
            )
            totals = dict(cur.fetchone())

    line_count = int(totals["line_count"] or 0)
    resolved = int(totals["resolved_count"] or 0)
    unresolved = int(totals["unresolved_count"] or 0)
    total_tco2e = _as_float(totals["total_tco2e"])
    total_spend = _as_float(totals["total_spend"]) or 0.0
    unresolved_spend = _as_float(totals["unresolved_spend"]) or 0.0

    methods = [
        MethodBreakdownRow(
            calculation_method=r["calculation_method"],
            method_rank=int(r["method_rank"]),
            label=engine.METHOD_PROFILES[r["calculation_method"]].data_quality_label,
            line_count=int(r["line_count"]),
            result_tco2e=_as_float(r["result_tco2e"]),
            spend_amount=_as_float(r["spend_amount"]),
            share_of_lines_pct=round(int(r["line_count"]) / line_count * 100.0, 4) if line_count else 0.0,
            share_of_emissions_pct=(
                round((_as_float(r["result_tco2e"]) or 0.0) / total_tco2e * 100.0, 4)
                if total_tco2e else None
            ),
        )
        for r in method_rows
    ]

    return CoverageData(
        run_id=run_id,
        line_count=line_count,
        resolved_count=resolved,
        unresolved_count=unresolved,
        unresolved_spend_amount=round(unresolved_spend, 4) if total_spend else None,
        coverage_lines_pct=round(resolved / line_count * 100.0, 4) if line_count else 0.0,
        coverage_spend_pct=(
            round((total_spend - unresolved_spend) / total_spend * 100.0, 4)
            if total_spend > 0 else None
        ),
        total_tco2e=total_tco2e,
        primary_data_share_pct=(
            round(int(totals["primary_count"] or 0) / line_count * 100.0, 4) if line_count else 0.0
        ),
        methods=methods,
    )


def list_run_evidence(*, company_id: int, run_id: int, limit: int = 50) -> list[EvidenceRef]:
    """Pièces citées par les lignes d'un run — alimente `evidence[]` de
    l'enveloppe analytique (contrats §4).

    Ne renvoie JAMAIS d'URL : uniquement des références (`artifact_id`,
    `source_code`, `release_key`). Le téléchargement passe par le proxy
    authentifié, jamais par un lien signé permanent (contrats §3/§8)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_run_in_scope(cur, company_id, run_id)
            cur.execute(
                f"""
                SELECT DISTINCT r.evidence_artifact_id, r.source_release_id,
                       sr.release_key, s.code AS source_code,
                       ea.page_reference, ea.excerpt
                FROM procurement_line_results r
                LEFT JOIN source_releases sr ON sr.id = r.source_release_id
                LEFT JOIN source_registry s ON s.id = sr.source_id
                LEFT JOIN evidence_artifacts ea ON ea.id = r.evidence_artifact_id
                WHERE r.{_SCOPE} AND r.run_id = %s
                  AND (r.evidence_artifact_id IS NOT NULL OR r.source_release_id IS NOT NULL)
                ORDER BY r.evidence_artifact_id NULLS LAST
                LIMIT %s
                """,
                (company_id, run_id, limit),
            )
            rows = cur.fetchall()
    return [
        EvidenceRef(
            artifact_id=r["evidence_artifact_id"],
            source_code=r["source_code"],
            release_key=r["release_key"],
            page_reference=r["page_reference"],
            excerpt=r["excerpt"],
        )
        for r in rows
    ]


def build_meta(run: RunResponse, *, extra_warnings: list[str] | None = None) -> AnalyticalMeta:
    """Métadonnées d'enveloppe d'un run (contrats §4).

    `method` est obligatoire et vient du run lui-même : aucun résultat de calcul
    ne peut être servi sans sa méthodologie versionnée. La confiance backend
    (0-1) est convertie en confiance de présentation (0-100) par l'unique
    helper partagé, jamais par un arrondi local."""
    warnings = list(run.warnings)
    if extra_warnings:
        warnings.extend(extra_warnings)
    return AnalyticalMeta(
        as_of=run.period_end.isoformat() if run.period_end else run.calculated_at.date().isoformat(),
        status="estimated",
        method=MethodRef(code=run.methodology_code, version=run.methodology_version),
        quality=QualityMeta(
            confidence=confidence_to_display(run.confidence),
            coverage_pct=run.coverage_pct,
            warnings=warnings,
        ),
    )


def get_trace(*, company_id: int, run_id: int, line_id: int) -> CalculationTraceData:
    """Trace de calcul d'UNE ligne : achat → fournisseur → produit → BOM →
    matière → facteur → preuve, plus la hiérarchie réellement parcourue.

    Chaque maillon porte, quand ils existent, sa date / sa source / son statut —
    c'est le drill-down complet exigé par le plan §8."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_run_in_scope(cur, company_id, run_id)
            cur.execute(
                f"SELECT * FROM procurement_line_results "
                f"WHERE {_SCOPE} AND run_id = %s AND purchase_line_id = %s",
                (company_id, run_id, line_id),
            )
            res = cur.fetchone()
            if res is None:
                raise ProcurementCalculationError(
                    f"Résultat de la ligne '{line_id}' introuvable pour le run '{run_id}'."
                )
            res = dict(res)

            cur.execute(
                f"SELECT * FROM purchase_lines WHERE id = %s AND {_SCOPE}",
                (line_id, company_id),
            )
            line = dict(cur.fetchone())

            steps: list[TraceStep] = [
                TraceStep(
                    level="purchase_line",
                    label="Ligne d'achat",
                    reference=f"purchase_line:{line['id']}",
                    detail={
                        "quantity": _as_float(line.get("quantity")),
                        "unit": line.get("unit"),
                        "spend_amount": _as_float(line.get("spend_amount")),
                        "currency": line.get("currency"),
                        "category_code": line.get("category_code"),
                        "mapping_status": line.get("mapping_status"),
                    },
                    observed_at=(
                        line["purchase_date"].isoformat() if line.get("purchase_date") else None
                    ),
                )
            ]

            if line.get("supplier_id"):
                cur.execute(
                    "SELECT id, name, country FROM suppliers WHERE id = %s AND company_id = %s",
                    (line["supplier_id"], company_id),
                )
                supplier = cur.fetchone()
                if supplier:
                    steps.append(TraceStep(
                        level="supplier",
                        label=supplier["name"],
                        reference=f"supplier:{supplier['id']}",
                        detail={"country": supplier.get("country")},
                    ))

            if line.get("product_id"):
                cur.execute(
                    f"SELECT * FROM supplier_products WHERE id = %s AND {_SCOPE}",
                    (line["product_id"], company_id),
                )
                product = cur.fetchone()
                if product:
                    steps.append(TraceStep(
                        level="supplier_product",
                        label=product["product_name"] or product["product_code"],
                        reference=f"supplier_product:{product['id']}",
                        detail={
                            "product_code": product["product_code"],
                            "origin_country": product["origin_country"],
                        },
                    ))

                # BOM → matières (mappings acceptés seulement — gate humain).
                cur.execute(
                    f"""
                    SELECT bi.id AS item_id, bi.component_code, bi.component_name,
                           bv.version AS bom_version, bv.source_artifact_id,
                           mm.material_id, mm.mass_value, mm.mass_unit,
                           mm.confidence, mm.review_status, mm.mapping_method
                    FROM bom_items bi
                    JOIN bom_versions bv ON bv.id = bi.bom_version_id AND bv.company_id = bi.company_id
                    LEFT JOIN material_mappings mm
                      ON mm.bom_item_id = bi.id AND mm.company_id = bi.company_id
                    WHERE bi.{_SCOPE} AND bi.supplier_product_id = %s
                    ORDER BY bi.id
                    """,
                    (company_id, line["product_id"]),
                )
                for item in cur.fetchall():
                    steps.append(TraceStep(
                        level="bom_item",
                        label=item["component_name"] or item["component_code"] or "Composant",
                        reference=f"bom_item:{item['item_id']}",
                        detail={"bom_version": item["bom_version"]},
                        evidence_artifact_id=item["source_artifact_id"],
                    ))
                    if item["material_id"]:
                        steps.append(TraceStep(
                            level="material",
                            label=item["material_id"],
                            reference=f"material:{item['material_id']}",
                            detail={
                                "mass_value": _as_float(item["mass_value"]),
                                "mass_unit": item["mass_unit"],
                                # confiance et statut de revue restent SÉPARÉS
                                "confidence": _as_float(item["confidence"]),
                                "review_status": item["review_status"],
                                "mapping_method": item["mapping_method"],
                            },
                        ))

            if res.get("factor_id"):
                steps.append(TraceStep(
                    level="factor",
                    label=f"{res['factor_id']} ({res['factor_version'] or 'version inconnue'})",
                    reference=f"factor:{res['factor_id']}",
                    detail={
                        "factor_source": res["factor_source"],
                        "activity_value": _as_float(res["activity_value"]),
                        "activity_unit": res["activity_unit"],
                        "converted_value": _as_float(res["converted_value"]),
                        "converted_unit": res["converted_unit"],
                        "conversion_factor": _as_float(res["conversion_factor"]),
                        "conversion_note": res["conversion_note"],
                    },
                    data_status=res["data_status"],
                ))

            # Preuves citées par la PCF / la déclaration effectivement utilisée.
            cur.execute(
                f"""
                SELECT id, evidence_artifact_id, source_release_id, data_status, created_at
                FROM product_carbon_footprints
                WHERE {_SCOPE} AND supplier_product_id = %s AND evidence_artifact_id IS NOT NULL
                ORDER BY id
                """,
                (company_id, line.get("product_id") or -1),
            )
            for ev in cur.fetchall():
                steps.append(TraceStep(
                    level="evidence",
                    label=f"Pièce justificative PCF #{ev['id']}",
                    reference=f"evidence_artifact:{ev['evidence_artifact_id']}",
                    data_status=ev["data_status"],
                    source_release_id=ev["source_release_id"],
                    evidence_artifact_id=ev["evidence_artifact_id"],
                    observed_at=ev["created_at"].isoformat() if ev.get("created_at") else None,
                ))

    return CalculationTraceData(
        run_id=run_id,
        purchase_line_id=line_id,
        calculation_method=res["calculation_method"],
        method_rank=int(res["method_rank"]),
        fallback_reason=res["fallback_reason"],
        result_tco2e=_as_float(res["result_tco2e"]),
        steps=steps,
        method_trace=res["method_trace"] or [],
        warnings=res["warnings"] or [],
    )


def approve_run(*, company_id: int, run_id: int, approved_by: int | None = None) -> RunResponse:
    """Approbation humaine d'un run, et scellement d'un fait récapitulatif.

    Le total est scellé dans la chaîne `facts_events` (mécanisme existant,
    contrats §3) EN PLUS de rester lisible via `input_snapshot`. Un run déjà
    approuvé n'est pas ré-approuvé en silence (transition stricte)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM procurement_calculation_runs WHERE id = %s AND {_SCOPE}",
                (run_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise ProcurementCalculationError(f"Run '{run_id}' introuvable.")
            if row["status"] != "calculated":
                raise ProcurementCalculationError(
                    f"Run '{run_id}' au statut '{row['status']}' — seul un run 'calculated' est approuvé."
                )
            cur.execute(
                "UPDATE procurement_calculation_runs "
                "SET status = 'approved', approved_at = now(), approved_by = %s, updated_at = now() "
                "WHERE id = %s RETURNING *",
                (approved_by, run_id),
            )
            updated = dict(cur.fetchone())

    total = _as_float(updated.get("total_tco2e"))
    if total is not None:
        # Import local : évite un cycle d'import au chargement du module.
        from services import facts_service

        facts_service.emit_fact(
            company_id=company_id,
            code="scope3_cat1_procurement_tco2e",
            value=total,
            unit="tCO2e",
            source_path=f"procurement_calculation_runs/{run_id}",
            meta={
                "run_id": run_id,
                "methodology_code": updated["methodology_code"],
                "methodology_version": updated["methodology_version"],
                "input_fingerprint": updated["input_fingerprint"],
                "coverage_pct": _as_float(updated.get("coverage_pct")),
                "unresolved_count": updated.get("unresolved_count"),
            },
        )
    return _row_to_run(updated)
