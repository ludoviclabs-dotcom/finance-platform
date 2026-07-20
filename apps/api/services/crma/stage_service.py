"""
stage_service.py — observations par étape, chaîne de valeur, données de marché
sous licence (PR-07).

**Une part pays n'existe jamais hors d'une étape.** `stage_code` est NOT NULL en
base et toutes les lectures de ce module partitionnent par étape avant tout
calcul. Il n'existe aucune fonction renvoyant une concentration « toutes étapes
confondues » : l'extraction et le raffinage sont des marchés distincts, les
agréger produirait un chiffre qui ne décrit aucun marché réel (gate Phase 6).

**Licence avant affichage ET avant calcul.** Les données de marché
(`material_market_observations`) sont toujours rattachées à une release donc à
une source. `license_policy.evaluate` tranche deux droits distincts :
  * `allow_display`      → la valeur peut-elle être TRANSMISE au client ?
  * `allow_derived_use`  → la valeur peut-elle nourrir un CALCUL dérivé ?
Refuser l'affichage ne se fait pas en masquant côté front : `numeric_value` est
mis à `None` côté serveur (`value_withheld=True`) et la valeur ne quitte jamais
l'API. Refuser l'usage dérivé exclut l'observation du score et incrémente le
compteur qui fera baisser la CONFIANCE — jamais le risque.
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.crma import (
    MarketObservationCreate,
    MarketObservationListResponse,
    MarketObservationResponse,
    StageObservationCreate,
    StageObservationListResponse,
    StageObservationResponse,
    ValueChainResponse,
)
from services.crma import reference_service, scoring
from services.intelligence import license_policy

_SCOPE_READ = "(company_id = %s OR company_id IS NULL)"

# Colonnes de licence lues sur source_registry pour license_policy.evaluate().
_LICENSE_COLUMNS = (
    "active", "automated_access_allowed", "storage_allowed", "commercial_use_allowed",
    "redistribution_allowed", "derived_use_allowed", "display_allowed", "attribution_text",
)


class StageObservationError(Exception):
    """Erreur métier des observations par étape / de marché."""


def _float(value: Any) -> float | None:
    return float(value) if value is not None else None


# ---------------------------------------------------------------------------
# Observations par étape
# ---------------------------------------------------------------------------

def _obs_row(row: dict[str, Any]) -> StageObservationResponse:
    data = {k: row[k] for k in StageObservationResponse.model_fields}
    for key in ("share_pct", "volume_value", "confidence"):
        data[key] = _float(data[key])
    return StageObservationResponse(**data)


def record_stage_observation(
    *, company_id: int, payload: StageObservationCreate, created_by: int | None = None
) -> StageObservationResponse:
    """Enregistre une part pays POUR UNE ÉTAPE.

    Le CHECK SQL `*_sourced_check` interdit déjà `verified` sans release ; on le
    redit ici pour renvoyer un message métier explicite (400) plutôt qu'une
    violation de contrainte opaque (409).
    """
    if payload.data_status == "verified" and payload.source_release_id is None:
        raise StageObservationError(
            "Une observation « verified » requiert une release source (source_release_id)."
        )
    known_stages = {s["code"] for s in reference_service.stage_rows(company_id=company_id)}
    if known_stages and payload.stage_code not in known_stages:
        raise StageObservationError(
            f"Étape '{payload.stage_code}' introuvable dans la chaîne de valeur "
            f"({', '.join(sorted(known_stages))})."
        )
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO material_stage_observations
                    (company_id, material_id, stage_code, country_code, share_pct, volume_value,
                     volume_unit, reference_year, data_status, confidence, methodology_version,
                     source_release_id, evidence_artifact_id, observed_at, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (company_id, material_id, stage_code, country_code, reference_year)
                DO UPDATE SET
                    share_pct = EXCLUDED.share_pct,
                    volume_value = EXCLUDED.volume_value,
                    volume_unit = EXCLUDED.volume_unit,
                    data_status = EXCLUDED.data_status,
                    confidence = EXCLUDED.confidence,
                    methodology_version = EXCLUDED.methodology_version,
                    source_release_id = EXCLUDED.source_release_id,
                    evidence_artifact_id = EXCLUDED.evidence_artifact_id,
                    observed_at = EXCLUDED.observed_at,
                    updated_at = now()
                RETURNING *
                """,
                (
                    company_id, payload.material_id, payload.stage_code, payload.country_code,
                    payload.share_pct, payload.volume_value, payload.volume_unit,
                    payload.reference_year, payload.data_status, payload.confidence,
                    payload.methodology_version, payload.source_release_id,
                    payload.evidence_artifact_id, payload.observed_at, created_by,
                ),
            )
            row = cur.fetchone()
    return _obs_row(row)


def list_stage_observations(
    *,
    company_id: int,
    material_id: str | None = None,
    stage_code: str | None = None,
    reference_year: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> StageObservationListResponse:
    clauses = [_SCOPE_READ]
    params: list[Any] = [company_id]
    if material_id:
        clauses.append("material_id = %s")
        params.append(material_id)
    if stage_code:
        clauses.append("stage_code = %s")
        params.append(stage_code)
    if reference_year is not None:
        clauses.append("reference_year = %s")
        params.append(reference_year)
    where = " AND ".join(clauses)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS n FROM material_stage_observations WHERE {where}", params)
            total = cur.fetchone()["n"]
            cur.execute(
                f"""
                SELECT * FROM material_stage_observations WHERE {where}
                ORDER BY material_id, stage_code, share_pct DESC NULLS LAST
                LIMIT %s OFFSET %s
                """,
                (*params, limit, offset),
            )
            items = [_obs_row(r) for r in cur.fetchall()]
    return StageObservationListResponse(items=items, total=total, limit=limit, offset=offset)


def observation_rows(
    *, company_id: int, material_id: str, reference_year: int | None = None
) -> list[dict[str, Any]]:
    """Observations brutes d'une matière (entrée du calcul de chaîne de valeur)."""
    clauses = [_SCOPE_READ, "material_id = %s"]
    params: list[Any] = [company_id, material_id]
    if reference_year is not None:
        clauses.append("reference_year = %s")
        params.append(reference_year)
    where = " AND ".join(clauses)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT * FROM material_stage_observations WHERE {where}", params)
            rows = [dict(r) for r in cur.fetchall()]
    for row in rows:
        row["share_pct"] = _float(row["share_pct"])
    return rows


def get_value_chain(
    *, company_id: int, material_id: str, reference_year: int | None = None
) -> ValueChainResponse:
    """Chaîne de valeur : une concentration PAR étape, ordonnée amont -> aval."""
    stages = reference_service.stage_rows(company_id=company_id)
    if not stages:
        raise StageObservationError(
            "Aucune étape de chaîne de valeur définie — migration 034 non appliquée ?"
        )
    rows = observation_rows(
        company_id=company_id, material_id=material_id, reference_year=reference_year
    )
    return scoring.build_value_chain(
        material_id=material_id,
        observation_rows=rows,
        stages=stages,
        reference_year=reference_year,
    )


# ---------------------------------------------------------------------------
# Données de marché — licence obligatoire
# ---------------------------------------------------------------------------

def _license_for_release(cur, *, company_id: int, release_id: int) -> tuple[Any, dict[str, Any] | None]:
    """Décision de licence de la source portant une release, ou (None, None)."""
    cur.execute(
        f"""
        SELECT s.code AS source_code, {", ".join("s." + c for c in _LICENSE_COLUMNS)}
        FROM source_releases r
        JOIN source_registry s ON s.id = r.source_id
        WHERE r.id = %s
          AND (r.company_id = %s OR r.company_id IS NULL)
          AND (s.company_id = %s OR s.company_id IS NULL)
        """,
        (release_id, company_id, company_id),
    )
    source = cur.fetchone()
    if source is None:
        return None, None
    return license_policy.evaluate(dict(source)), dict(source)


def record_market_observation(
    *, company_id: int, payload: MarketObservationCreate
) -> MarketObservationResponse:
    """Enregistre un prix/volume de marché. La release DOIT exister et être
    dans le périmètre : une donnée de marché sans source est irrecevable."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            decision, source = _license_for_release(
                cur, company_id=company_id, release_id=payload.source_release_id
            )
            if decision is None:
                raise StageObservationError(
                    f"Release source '{payload.source_release_id}' introuvable ou hors périmètre."
                )
            if not decision.allow_store:
                raise StageObservationError(
                    "La licence de la source n'autorise pas la conservation de cette donnée "
                    "(allow_store=false) : " + " ; ".join(decision.reasons)
                )
            cur.execute(
                """
                INSERT INTO material_market_observations
                    (company_id, material_id, stage_code, metric_code, numeric_value, unit,
                     currency, observed_at, data_status, confidence, source_release_id,
                     evidence_artifact_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, payload.material_id, payload.stage_code, payload.metric_code,
                    payload.numeric_value, payload.unit, payload.currency, payload.observed_at,
                    payload.data_status, payload.confidence, payload.source_release_id,
                    payload.evidence_artifact_id,
                ),
            )
            row = dict(cur.fetchone())
    return _market_row(row, decision, source)


def _market_row(row: dict[str, Any], decision: Any, source: dict[str, Any] | None) -> MarketObservationResponse:
    """Applique le droit d'affichage AVANT de construire la réponse.

    Quand `allow_display` est faux, `numeric_value`/`unit`/`currency` sont
    retirés de la réponse — la valeur ne quitte pas le serveur. Masquer
    seulement à l'affichage laisserait la donnée dans la charge utile JSON,
    donc accessible : ce ne serait pas une garantie.
    """
    data = {k: row.get(k) for k in MarketObservationResponse.model_fields if k in row}
    data["numeric_value"] = _float(row.get("numeric_value"))
    data["confidence"] = _float(row.get("confidence"))
    data["source_code"] = (source or {}).get("source_code")
    data["display_allowed"] = bool(decision.allow_display)
    data["derived_use_allowed"] = bool(decision.allow_derived_use)
    data["license_reasons"] = list(decision.reasons)
    data["attribution_text"] = (source or {}).get("attribution_text")
    data["value_withheld"] = False

    if not decision.allow_display:
        data["numeric_value"] = None
        data["unit"] = None
        data["currency"] = None
        data["value_withheld"] = True

    return MarketObservationResponse(**data)


def list_market_observations(
    *, company_id: int, material_id: str | None = None, limit: int = 50, offset: int = 0
) -> MarketObservationListResponse:
    clauses = [_SCOPE_READ]
    params: list[Any] = [company_id]
    if material_id:
        clauses.append("material_id = %s")
        params.append(material_id)
    where = " AND ".join(clauses)
    items: list[MarketObservationResponse] = []
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS n FROM material_market_observations WHERE {where}", params)
            total = cur.fetchone()["n"]
            cur.execute(
                f"""
                SELECT * FROM material_market_observations WHERE {where}
                ORDER BY observed_at DESC, id DESC LIMIT %s OFFSET %s
                """,
                (*params, limit, offset),
            )
            rows = [dict(r) for r in cur.fetchall()]
            # La licence est réévaluée à CHAQUE lecture, jamais dénormalisée en
            # base : une licence révoquée doit produire un masquage immédiat.
            cache: dict[int, tuple[Any, dict[str, Any] | None]] = {}
            for row in rows:
                release_id = row["source_release_id"]
                if release_id not in cache:
                    cache[release_id] = _license_for_release(
                        cur, company_id=company_id, release_id=release_id
                    )
                decision, source = cache[release_id]
                if decision is None:
                    # Source hors périmètre : on ne divulgue rien.
                    continue
                items.append(_market_row(row, decision, source))
    return MarketObservationListResponse(items=items, total=total, limit=limit, offset=offset)


def market_usability(*, company_id: int, material_id: str) -> tuple[int, int]:
    """(total, bloquées) — combien d'observations de marché existent et combien
    sont inexploitables dans un calcul dérivé faute de droit de licence.

    Ce couple alimente la CONFIANCE du score, jamais le risque.
    """
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT source_release_id, COUNT(*) AS n
                FROM material_market_observations
                WHERE material_id = %s AND {_SCOPE_READ}
                GROUP BY source_release_id
                """,
                (material_id, company_id),
            )
            grouped = [dict(r) for r in cur.fetchall()]
            total = 0
            blocked = 0
            for group in grouped:
                count = int(group["n"])
                total += count
                decision, _ = _license_for_release(
                    cur, company_id=company_id, release_id=group["source_release_id"]
                )
                if decision is None or not decision.allow_derived_use:
                    blocked += count
    return total, blocked
