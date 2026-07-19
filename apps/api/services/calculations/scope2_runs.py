"""
scope2_runs.py — orchestration des runs de calcul Scope 2 dual (PR-06B).

Sépare strictement les I/O du calcul : ce module CHARGE les entrées depuis le
ledger énergie (migration 031), appelle le moteur PUR `scope2.calculate`, puis
PERSISTE le run et sa trace (migration 033). Le moteur ne touche jamais la base ;
ce module ne calcule jamais rien.

Défense en profondeur (contrats §7) : chaque requête porte son prédicat
`company_id = %s` explicite EN PLUS de la RLS FORCE. Le PostgreSQL de CI se
connecte en superuser, qui bypasse la RLS (FORCE compris) — sans ce doublon,
aucun test d'isolation ne pourrait passer.

Licence (contrats §8) : un facteur SOURCÉ (rattaché à une `source_release`) n'est
admis dans un calcul dérivé que si `license_policy.evaluate(...).allow_derived_use`
est vrai. Sinon le candidat est ÉCARTÉ de la sélection (avec warning) — la
hiérarchie continue sans lui, elle ne se rabat jamais dessus en douce.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from db.database import get_db
from services.calculations import CalculationError, scope2
from services.calculations.scope2 import (
    ActivityInput,
    AllocationInput,
    FactorCandidate,
    Methodology,
)

# Codes de fact Scope 2 dual — importés du helper partagé PR-06A plutôt que
# recopiés (une seule source de vérité pour ces littéraux).
from services.carbon.scope2_selection import CODE_SCOPE2_LB, CODE_SCOPE2_MB
from services.intelligence import license_policy

_RUN_COLS = (
    "id, company_id, methodology_code, methodology_version, period_start, period_end, "
    "geography_code, input_snapshot, input_fingerprint, factor_versions, result, warnings, "
    "confidence, coverage_pct, status, calculated_at, calculated_by, approved_at, "
    "approved_by, created_at, updated_at"
)


# ---------------------------------------------------------------------------
# Chargement des entrées
# ---------------------------------------------------------------------------

def load_activities(
    *,
    company_id: int,
    period_start: date,
    period_end: date,
    geography_code: str,
    site_geographies: dict[int, str] | None = None,
    include_pending: bool = True,
) -> list[ActivityInput]:
    """Charge les activités énergie de la période + leurs allocations valides.

    `geography_code` est la zone de réseau du périmètre ; `site_geographies`
    permet de la préciser par site (une zone sous-nationale, ex. `FR-IDF`).
    Aucune zone n'est devinée : à défaut de surcharge, la zone du périmètre
    s'applique, et elle est obligatoire.

    `include_pending=False` exclut les activités encore en attente de revue —
    utile pour un run « propre » ; par défaut elles sont incluses ET signalées
    par un warning (la donnée non revue est visible, pas cachée).
    """
    site_geographies = site_geographies or {}
    review_clause = "" if include_pending else " AND ea.review_status = 'accepted'"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT ea.id, ea.site_id, ea.meter_id, ea.carrier, ea.quantity, ea.unit,
                       ea.period_start, ea.period_end, ea.data_status, ea.review_status
                FROM energy_activities ea
                WHERE ea.company_id = %s
                  AND ea.period_start >= %s
                  AND ea.period_end <= %s
                  {review_clause}
                ORDER BY ea.id
                """,
                (company_id, period_start, period_end),
            )
            rows = cur.fetchall()
            activity_ids = [r["id"] for r in rows]

            allocations: dict[int, list[AllocationInput]] = {}
            if activity_ids:
                cur.execute(
                    """
                    SELECT ia.id AS allocation_id, ia.instrument_id, ia.energy_activity_id,
                           ia.allocated_mwh, ci.instrument_type, ci.carrier, ci.valid_from,
                           ci.valid_to, ci.volume_mwh, ci.status, ci.geography_code,
                           ci.certificate_artifact_id, ci.reference
                    FROM instrument_allocations ia
                    JOIN contractual_instruments ci
                      ON ci.id = ia.instrument_id AND ci.company_id = %s
                    WHERE ia.company_id = %s AND ia.energy_activity_id = ANY(%s)
                    ORDER BY ia.id
                    """,
                    (company_id, company_id, activity_ids),
                )
                for row in cur.fetchall():
                    allocations.setdefault(row["energy_activity_id"], []).append(
                        AllocationInput(
                            allocation_id=row["allocation_id"],
                            instrument_id=row["instrument_id"],
                            instrument_type=row["instrument_type"],
                            allocated_mwh=float(row["allocated_mwh"]),
                            carrier=row["carrier"],
                            valid_from=row["valid_from"],
                            valid_to=row["valid_to"],
                            instrument_volume_mwh=float(row["volume_mwh"]),
                            status=row["status"],
                            geography_code=row["geography_code"],
                            certificate_artifact_id=row["certificate_artifact_id"],
                            reference=row["reference"],
                        )
                    )

    return [
        ActivityInput(
            activity_id=r["id"],
            carrier=r["carrier"],
            quantity=float(r["quantity"]),
            unit=r["unit"],
            period_start=r["period_start"],
            period_end=r["period_end"],
            geography_code=site_geographies.get(r["site_id"], geography_code),
            site_id=r["site_id"],
            meter_id=r["meter_id"],
            data_status=r["data_status"],
            review_status=r["review_status"],
            allocations=tuple(allocations.get(r["id"], ())),
        )
        for r in rows
    ]


def load_factor_candidates(*, company_id: int) -> tuple[list[FactorCandidate], list[str]]:
    """Charge les facteurs candidats : `energy_factor_metadata` (tenant) jointe
    au catalogue global `emission_factors`, plus la décision de licence de la
    source quand le facteur est sourcé.

    Retourne `(candidats, warnings)`. Un facteur dont la licence interdit l'usage
    dérivé est marqué `license_allows_derived_use=False` : le moteur l'écarte de
    toutes les hiérarchies, et le warning explique pourquoi — jamais un facteur
    utilisé sans droit, jamais un facteur écarté sans le dire.
    """
    warnings: list[str] = []
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT efm.id AS metadata_id, efm.basis, efm.carrier, efm.geography_code,
                       efm.valid_from, efm.valid_to, efm.source_release_id,
                       ef.id AS ef_id, ef.ef_code, ef.version AS ef_version,
                       ef.factor_kgco2e, ef.unit, ef.label,
                       sr.source_id,
                       s.active, s.automated_access_allowed, s.storage_allowed,
                       s.commercial_use_allowed, s.redistribution_allowed,
                       s.derived_use_allowed, s.display_allowed, s.attribution_text
                FROM energy_factor_metadata efm
                JOIN emission_factors ef ON ef.id = efm.ef_id
                LEFT JOIN source_releases sr ON sr.id = efm.source_release_id
                LEFT JOIN source_registry s ON s.id = sr.source_id
                WHERE efm.company_id = %s
                ORDER BY ef.id, efm.basis, efm.id
                """,
                (company_id,),
            )
            rows = cur.fetchall()

    candidates: list[FactorCandidate] = []
    for row in rows:
        allows_derived = True
        if row["source_release_id"] is not None and row["source_id"] is not None:
            decision = license_policy.evaluate(row)
            allows_derived = decision.allow_derived_use
            if not allows_derived:
                warnings.append(
                    f"Facteur '{row['ef_code']}' (base {row['basis']}) ÉCARTÉ du calcul : "
                    "la licence de sa source n'autorise pas l'usage dérivé "
                    "(allow_derived_use=false)."
                )
        candidates.append(
            FactorCandidate(
                ef_id=row["ef_id"],
                ef_code=row["ef_code"],
                ef_version=row["ef_version"],
                factor_value=float(row["factor_kgco2e"]),
                factor_unit=row["unit"],
                basis=row["basis"],
                carrier=row["carrier"],
                geography_code=row["geography_code"],
                valid_from=row["valid_from"],
                valid_to=row["valid_to"],
                source_release_id=row["source_release_id"],
                label=row["label"],
                license_allows_derived_use=allows_derived,
            )
        )
    return candidates, warnings


# ---------------------------------------------------------------------------
# Calcul + persistance
# ---------------------------------------------------------------------------

def calculate_and_store(
    *,
    company_id: int,
    period_start: date,
    period_end: date,
    geography_code: str,
    methodology: Methodology | None = None,
    site_geographies: dict[int, str] | None = None,
    include_pending: bool = True,
    calculated_by: int | None = None,
    today: date | None = None,
) -> dict[str, Any]:
    """Calcule un run Scope 2 dual et le persiste (run + trace ligne à ligne).

    Retourne le run persisté sous forme de dict (mêmes clés que `get_run`).
    """
    if period_end < period_start:
        raise CalculationError("Période invalide : la fin est antérieure au début (requise).")
    if not (geography_code or "").strip():
        raise CalculationError("Zone de réseau (geography_code) requise pour un calcul Scope 2.")

    methodology = methodology or scope2.DEFAULT_METHODOLOGY
    today = today or date.today()

    activities = load_activities(
        company_id=company_id, period_start=period_start, period_end=period_end,
        geography_code=geography_code, site_geographies=site_geographies,
        include_pending=include_pending,
    )
    if not activities:
        raise CalculationError(
            f"Aucune activité énergie sur la période {period_start}→{period_end} : "
            "rien à calculer (importer des activités avant de lancer un run)."
        )

    factors, license_warnings = load_factor_candidates(company_id=company_id)
    result = scope2.calculate(activities, factors, methodology=methodology, today=today)

    snapshot = scope2.build_input_snapshot(
        activities, factors, methodology=methodology, period_start=period_start,
        period_end=period_end, geography_code=geography_code, today=today,
    )
    fingerprint = scope2.fingerprint(snapshot)

    payload = scope2.result_to_dict(result)
    all_warnings = license_warnings + list(result.warnings)
    payload["warnings"] = all_warnings

    return _persist_run(
        company_id=company_id, methodology=methodology, period_start=period_start,
        period_end=period_end, geography_code=geography_code, snapshot=snapshot,
        fingerprint=fingerprint, result=result, payload=payload, warnings=all_warnings,
        calculated_by=calculated_by,
    )


def _persist_run(
    *,
    company_id: int,
    methodology: Methodology,
    period_start: date,
    period_end: date,
    geography_code: str,
    snapshot: dict[str, Any],
    fingerprint: str,
    result: scope2.Scope2Result,
    payload: dict[str, Any],
    warnings: list[str],
    calculated_by: int | None,
) -> dict[str, Any]:
    """Écrit le run et ses lignes dans la MÊME transaction tenant."""
    import json

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                INSERT INTO scope2_calculation_runs
                    (company_id, methodology_code, methodology_version, period_start,
                     period_end, geography_code, input_snapshot, input_fingerprint,
                     factor_versions, result, warnings, confidence, coverage_pct,
                     status, calculated_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s::jsonb, %s::jsonb,
                        %s::jsonb, %s, %s, 'draft', %s)
                RETURNING {_RUN_COLS}
                """,
                (
                    company_id, methodology.code, methodology.version, period_start,
                    period_end, geography_code, json.dumps(snapshot, default=str),
                    fingerprint, json.dumps([dict(f) for f in result.factor_versions]),
                    json.dumps(payload, default=str), json.dumps(warnings),
                    result.confidence, result.coverage_pct, calculated_by,
                ),
            )
            run = cur.fetchone()
            run_id = run["id"]

            for line in result.lines:
                sel = line.selection
                cur.execute(
                    """
                    INSERT INTO scope2_line_results
                        (company_id, run_id, energy_activity_id, basis, segment,
                         instrument_id, carrier, geography_code, period_start, period_end,
                         activity_value, activity_unit, activity_mwh, ef_id, ef_code,
                         ef_version, factor_kgco2e_per_mwh, factor_basis, selection_level,
                         selection_reason, result_tco2e, uncertainty, data_quality,
                         fallback_reason, warnings)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                    """,
                    (
                        company_id, run_id, line.energy_activity_id, line.basis, line.segment,
                        sel.instrument_id, line.carrier, line.geography_code,
                        line.period_start, line.period_end, line.activity_value,
                        line.activity_unit, line.activity_mwh, sel.ef_id, sel.ef_code,
                        sel.ef_version, sel.rate_kgco2e_per_mwh, sel.factor_basis, sel.level,
                        sel.reason, line.result_tco2e, line.uncertainty, sel.data_quality,
                        sel.fallback_reason, json.dumps(list(sel.warnings)),
                    ),
                )
    return _row_to_run(run)


# ---------------------------------------------------------------------------
# Lecture
# ---------------------------------------------------------------------------

def _row_to_run(row: dict[str, Any]) -> dict[str, Any]:
    out = dict(row)
    for key in ("confidence", "coverage_pct"):
        if out.get(key) is not None:
            out[key] = float(out[key])
    return out


def get_run(*, company_id: int, run_id: int) -> dict[str, Any]:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {_RUN_COLS} FROM scope2_calculation_runs "
                "WHERE id = %s AND company_id = %s",
                (run_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        # 404, jamais 403 : aucune fuite d'existence cross-tenant (contrats §6).
        raise CalculationError(f"Run Scope 2 '{run_id}' introuvable.")
    return _row_to_run(row)


def list_runs(
    *, company_id: int, limit: int = 50, offset: int = 0, status: str | None = None
) -> tuple[list[dict[str, Any]], int]:
    where = ["company_id = %s"]
    params: list[Any] = [company_id]
    if status:
        where.append("status = %s")
        params.append(status)
    clause = " AND ".join(where)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) AS c FROM scope2_calculation_runs WHERE {clause}",
                tuple(params),
            )
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT {_RUN_COLS} FROM scope2_calculation_runs WHERE {clause} "
                "ORDER BY calculated_at DESC, id DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return [_row_to_run(r) for r in rows], total


def company_name(*, company_id: int) -> str:
    """Nom affichable du tenant pour l'Evidence Pack (même geste que
    `routers/export.py`). Repli explicite si la ligne est absente — jamais une
    exception qui empêcherait de produire une preuve."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM companies WHERE id = %s", (company_id,))
            row = cur.fetchone()
    return row["name"] if row else "Entreprise"


def get_trace(*, company_id: int, run_id: int) -> list[dict[str, Any]]:
    """Trace de calcul persistée : une ligne par (activité, base, segment), avec
    le niveau de hiérarchie retenu et sa raison."""
    get_run(company_id=company_id, run_id=run_id)  # 404 hors périmètre
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, energy_activity_id, basis, segment, instrument_id, carrier,
                       geography_code, period_start, period_end, activity_value,
                       activity_unit, activity_mwh, ef_id, ef_code, ef_version,
                       factor_kgco2e_per_mwh, factor_basis, selection_level,
                       selection_reason, result_tco2e, uncertainty, data_quality,
                       fallback_reason, warnings
                FROM scope2_line_results
                WHERE run_id = %s AND company_id = %s
                ORDER BY energy_activity_id, basis, segment, id
                """,
                (run_id, company_id),
            )
            rows = cur.fetchall()
    out: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        for key in ("activity_value", "activity_mwh", "factor_kgco2e_per_mwh",
                    "result_tco2e", "uncertainty"):
            if item.get(key) is not None:
                item[key] = float(item[key])
        out.append(item)
    return out


# ---------------------------------------------------------------------------
# Approbation
# ---------------------------------------------------------------------------

def approve_run(*, company_id: int, run_id: int, approved_by: int) -> dict[str, Any]:
    """Approuve un run — le seul moment où le moteur PR-06B remplace les KPI
    Scope 2 historiques.

    Garde-fous :
      * un run **incomplet** (facteur manquant) est REFUSÉ — on n'officialise pas
        un total amputé d'une part de la consommation ;
      * un run déjà approuvé est refusé (idempotence explicite, pas silencieuse) ;
      * l'approbation émet DEUX facts (`CC.GES.SCOPE2_LB` et `CC.GES.SCOPE2_MB`),
        jamais un seul : le Scope 2 dual reste dual jusque dans la chaîne de
        preuve. Tant qu'aucun run n'est approuvé, les KPI historiques importés
        d'Excel restent la vérité — PR-06B n'écrase rien tout seul.
    """
    run = get_run(company_id=company_id, run_id=run_id)
    if run["status"] == "approved":
        raise CalculationError(f"Run Scope 2 '{run_id}' déjà approuvé.")
    result = run.get("result") or {}
    if not result.get("is_complete", False):
        missing = len(result.get("missing_factors") or [])
        raise CalculationError(
            f"Run Scope 2 '{run_id}' INCOMPLET ({missing} facteur(s) manquant(s)) : "
            "approbation refusée. Compléter les facteurs manquants puis relancer un calcul."
        )

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE scope2_calculation_runs
                SET status = 'approved', approved_at = now(), approved_by = %s,
                    updated_at = now()
                WHERE id = %s AND company_id = %s AND status <> 'approved'
                RETURNING {_RUN_COLS}
                """,
                (approved_by, run_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise CalculationError(f"Run Scope 2 '{run_id}' introuvable.")

    _emit_scope2_facts(company_id=company_id, run_id=run_id, result=result)
    return _row_to_run(row)


def _emit_scope2_facts(*, company_id: int, run_id: int, result: dict[str, Any]) -> None:
    """Scelle les deux totaux dans la chaîne de preuve `facts_events`.

    Import local : `facts_service` tire la couche DB, et ce module doit rester
    importable (et testable) sans elle.
    """
    from services import facts_service

    common = {
        "unit": "tCO2e",
        "source_path": f"scope2_run:{run_id}",
    }
    facts_service.emit_fact(
        company_id=company_id, code=CODE_SCOPE2_LB,
        value=result.get("location_based_tco2e"),
        meta={
            "kind": "scope2_run_approved", "run_id": run_id, "basis": "location_based",
            "methodology": result.get("methodology"),
            "confidence": result.get("confidence"),
            "coverage_pct": result.get("coverage_pct"),
        },
        **common,
    )
    facts_service.emit_fact(
        company_id=company_id, code=CODE_SCOPE2_MB,
        value=result.get("market_based_tco2e"),
        meta={
            "kind": "scope2_run_approved", "run_id": run_id, "basis": "market_based",
            "methodology": result.get("methodology"),
            "confidence": result.get("confidence"),
            "coverage_pct": result.get("coverage_pct"),
            "contractual_coverage_pct": result.get("contractual_coverage_pct"),
            "residual_mix_used": result.get("residual_mix_used"),
        },
        **common,
    )
