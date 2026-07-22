"""
demo_seed.py — seed idempotent du tenant de démonstration « Asterion Motion ».

100% FICTIF. ZÉRO migration SQL (tables existantes seulement). ZÉRO donnée réelle.
Le seed rend RÉELLE la revue IA (UC-1) : IRO candidate + Evidence Kernel (sources,
releases, artefacts inclus/exclus, observations, claim_evidence_links) de sorte
que le pipeline PR-11 (mode demo) produise des citations résolues et les statuts
déterministes attendus. Les métriques canoniques (Scope 2/3, eau, CRMA, finance)
sont seedées comme `observations` typées (source + date + statut + méthode).

Garanties :
  - Idempotent : chaque entité est vérifiée avant insertion (aucun doublon).
  - Transactionnel : l'Evidence Kernel + l'IRO sont écrits dans UNE transaction
    (get_db(company_id) — commit à la sortie, rollback sur erreur).
  - Slug-gardé : n'écrit QUE dans le tenant `asterion-motion-demo`.
  - Dry-run : `--dry-run` affiche le plan sans rien écrire.

Usage :
    python scripts/demo_seed.py [--dry-run] [--scenario asterion-motion-v1]

Réservé au workflow protégé `demo-scenario.yml` (jamais exécuté au déploiement).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import db_available, get_db  # noqa: E402
from demo.loader import Scenario, load_scenario  # noqa: E402
from services.auth_service import DEMO_TENANT_SLUG, ensure_demo_tenant  # noqa: E402

# Mapping type de source fictive -> vocabulaire autorisé par source_registry CHECK.
_SOURCE_TYPE_MAP = {
    "market_study": "licensed_feed",
    "benchmark": "licensed_feed",
    "internal": "manual",
}
INTERNAL_SOURCE_CODE = "ASTERION-INTERNAL-DECL"


def _sha(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


def _likelihood_to_int(value: str | None) -> int | None:
    return {
        "very_unlikely": 10, "unlikely": 30, "possible": 50,
        "likely": 70, "very_likely": 90,
    }.get((value or "").lower())


# --------------------------------------------------------------------------- #
# Résultat / rapport
# --------------------------------------------------------------------------- #
class SeedReport:
    def __init__(self) -> None:
        self.created: dict[str, int] = {}
        self.skipped: dict[str, int] = {}

    def add(self, kind: str, created: bool) -> None:
        bucket = self.created if created else self.skipped
        bucket[kind] = bucket.get(kind, 0) + 1

    def as_dict(self) -> dict:
        return {"created": self.created, "skipped": self.skipped}


# --------------------------------------------------------------------------- #
# Seed Evidence Kernel + IRO (transaction unique, idempotent)
# --------------------------------------------------------------------------- #
def _seed_core(conn, company_id: int, created_by: int | None, sc: Scenario, report: SeedReport) -> None:
    cur = conn.cursor()

    def one(sql: str, params: tuple):
        cur.execute(sql, params)
        return cur.fetchone()

    # --- Sources (external + internal declaration) ------------------------- #
    source_ids: dict[str, int] = {}
    ev = sc.evidence

    def ensure_source(key: str, code: str, publisher: str, title: str, src_type: str,
                      display: bool, derived: bool, attribution: str | None) -> int:
        row = one(
            "SELECT id FROM source_registry WHERE company_id = %s AND code = %s",
            (company_id, code),
        )
        if row:
            report.add("source", False)
            return row["id"]
        row = one(
            """
            INSERT INTO source_registry
                (company_id, code, publisher, title, source_type,
                 display_allowed, derived_use_allowed, active, attribution_text, created_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s,TRUE,%s,%s) RETURNING id
            """,
            (company_id, code, publisher, title, src_type, display, derived, attribution, created_by),
        )
        report.add("source", True)
        return row["id"]

    for s in ev.sources:
        source_ids[s.key] = ensure_source(
            s.key, s.code, s.publisher, s.title,
            _SOURCE_TYPE_MAP.get(s.source_type, "licensed_feed"),
            s.display_allowed, s.derived_use_allowed, s.attribution_text,
        )
    internal_source_id = ensure_source(
        "internal", INTERNAL_SOURCE_CODE, "Asterion Motion (déclaration interne, fictif)",
        "Déclarations internes de démonstration", "manual", True, True, None,
    )

    # --- Releases ---------------------------------------------------------- #
    release_ids: dict[str, int] = {}

    def ensure_release(key: str, source_id: int, release_key: str, status: str) -> int:
        checksum = _sha(sc.name, "release", key)
        row = one(
            "SELECT id FROM source_releases WHERE source_id = %s AND release_key = %s AND checksum_sha256 = %s",
            (source_id, release_key, checksum),
        )
        if row:
            report.add("release", False)
            return row["id"]
        row = one(
            """
            INSERT INTO source_releases
                (source_id, company_id, release_key, checksum_sha256, status, published_at, created_by)
            VALUES (%s,%s,%s,%s,%s, now(), %s) RETURNING id
            """,
            (source_id, company_id, release_key, checksum, status, created_by),
        )
        report.add("release", True)
        return row["id"]

    for r in ev.releases:
        src_id = source_ids.get(r.source_key)
        if src_id is None:
            continue
        release_ids[r.key] = ensure_release(r.key, src_id, r.release_key, r.status)
    internal_release_id = ensure_release("release-internal", internal_source_id, "2025-decl", "published")

    # --- Artifacts --------------------------------------------------------- #
    artifact_ids: dict[str, int] = {}

    def ensure_artifact(key: str, filename: str, release_key: str | None,
                        sensitivity: str, page_ref: str | None, excerpt: str | None) -> int:
        sha = _sha(sc.name, "artifact", key)
        row = one(
            "SELECT id FROM evidence_artifacts WHERE company_id = %s AND sha256 = %s",
            (company_id, sha),
        )
        if row:
            report.add("artifact", False)
            return row["id"]
        release_id = release_ids.get(release_key) if release_key else None
        row = one(
            """
            INSERT INTO evidence_artifacts
                (company_id, source_release_id, blob_key, sha256, filename, mime_type,
                 page_reference, excerpt, sensitivity, created_by)
            VALUES (%s,%s,%s,%s,%s,'application/pdf',%s,%s,%s,%s) RETURNING id
            """,
            (company_id, release_id, f"demo/asterion/{key}", sha, filename,
             page_ref, excerpt, sensitivity, created_by),
        )
        report.add("artifact", True)
        return row["id"]

    for a in ev.artifacts:
        artifact_ids[a.key] = ensure_artifact(
            a.key, a.filename, a.release_key, a.sensitivity, a.page_reference, a.excerpt,
        )

    # --- Observations (evidence + canonical metrics) ----------------------- #
    def ensure_observation(subject_type: str, subject_key: str, metric_code: str,
                           *, numeric=None, text=None, unit=None, data_status="estimated",
                           confidence=None, methodology=None, artifact_id=None,
                           release_id=None) -> None:
        row = one(
            """
            SELECT id FROM observations
            WHERE company_id = %s AND subject_type = %s AND subject_key = %s AND metric_code = %s
            """,
            (company_id, subject_type, subject_key, metric_code),
        )
        if row:
            report.add("observation", False)
            return
        cur.execute(
            """
            INSERT INTO observations
                (company_id, subject_type, subject_key, metric_code, numeric_value, text_value,
                 unit, source_release_id, evidence_artifact_id, data_status, confidence,
                 methodology_version, observed_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
            """,
            (company_id, subject_type, subject_key, metric_code, numeric, text, unit,
             release_id or internal_release_id, artifact_id, data_status, confidence, methodology),
        )
        report.add("observation", True)

    # Evidence-backed observations (linked to their artifact)
    for o in ev.observations:
        art_id = artifact_ids.get(o.artifact_key) if o.artifact_key else None
        ensure_observation(
            "material", o.metric, o.key, numeric=o.value, unit=o.unit,
            data_status=o.data_status, methodology=o.methodology_version,
            artifact_id=art_id,
        )

    # Canonical domain metrics (typed, sourced, status-bearing)
    m = sc.manifest.expected_metrics
    ensure_observation("company", "asterion", "scope3_purchases_tco2e", numeric=m.scope3_purchases_tco2e, unit="tCO2e", data_status="estimated", methodology="spend-physical-hybrid")
    ensure_observation("company", "asterion", "scope3_magnets_share_pct", numeric=m.scope3_magnets_share_pct, unit="%", data_status="estimated", methodology="hotspot")
    ensure_observation("company", "asterion", "scope2_location_based_tco2e", numeric=m.scope2_lb_tco2e, unit="tCO2e", data_status="estimated", methodology="ghg-protocol-lb")
    ensure_observation("company", "asterion", "scope2_market_based_tco2e", numeric=m.scope2_mb_tco2e, unit="tCO2e", data_status="estimated", methodology="ghg-protocol-mb")
    ensure_observation("company", "asterion", "scope2_contractual_coverage_pct", numeric=m.contractual_coverage_pct, unit="%", data_status="estimated", methodology="allocations")
    ensure_observation("company", "asterion", "electricity_gwh", numeric=m.electricity_gwh, unit="GWh", data_status="manual", methodology="meter")
    ensure_observation("company", "asterion", "water_withdrawal_m3", numeric=m.water_m3, unit="m3", data_status="manual", methodology="meter")
    ensure_observation("site", "asterion-hq", "water_stress", text=m.water_stress, data_status="estimated", confidence=m.water_confidence, methodology="geojson-screening")
    ensure_observation("company", "asterion", "financial_exposure_indicative_eur", numeric=m.financial_exposure_indicative_eur, unit="EUR", data_status="estimated", methodology="iro-indicative")

    # --- IRO + assessments ------------------------------------------------- #
    iro = sc.iro.iros[0]
    iro_row = one(
        "SELECT id FROM iros WHERE company_id = %s AND title = %s",
        (company_id, iro.title),
    )
    if iro_row:
        iro_id = iro_row["id"]
        report.add("iro", False)
    else:
        iro_row = one(
            """
            INSERT INTO iros
                (company_id, title, description, iro_type, topic_code, origin_domain,
                 origin_reference, status, value_chain_location, created_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s,'candidate','upstream',%s) RETURNING id
            """,
            (company_id, iro.title, iro.description, iro.iro_type, iro.topic_code,
             iro.origin_domain if iro.origin_domain in ("water", "nature", "crma", "energy", "manual") else "manual",
             iro.origin_reference, created_by),
        )
        iro_id = iro_row["id"]
        report.add("iro", True)

        if iro.impact_assessment:
            ia = iro.impact_assessment
            cur.execute(
                """
                INSERT INTO impact_assessments
                    (company_id, iro_id, polarity, is_actual, scale, scope, irremediability,
                     likelihood, time_horizon, confidence, rationale, prepared_by, calculated_at)
                VALUES (%s,%s,'negative',false,%s,%s,%s,%s,'medium',%s,%s,%s, now())
                """,
                (company_id, iro_id,
                 (ia.scale or 0) * 20, (ia.scope or 0) * 20, (ia.irremediability or 0) * 20,
                 _likelihood_to_int(ia.likelihood), 70,
                 "Impact potentiel lié à la dépendance aux aimants terres rares (synthétique).",
                 created_by),
            )
            report.add("impact_assessment", True)

        if iro.financial_assessment:
            fa = iro.financial_assessment
            chain = [{
                "step": 1, "mechanism": "supply_disruption", "channel": "cost",
                "rationale": "Renchérissement / rupture d'approvisionnement des aimants terres rares.",
                "estimated_amount_eur": fa.financial_exposure_eur,
            }]
            cur.execute(
                """
                INSERT INTO financial_assessments
                    (company_id, iro_id, likelihood, magnitude, time_horizon, confidence,
                     transmission_chain, primary_channel, rationale, prepared_by, calculated_at)
                VALUES (%s,%s,%s,%s,'medium',%s,%s::jsonb,'cost',%s,%s, now())
                """,
                (company_id, iro_id, _likelihood_to_int(fa.likelihood), (fa.magnitude or 0) * 20, 60,
                 json.dumps(chain),
                 "Exposition financière indicative (fourchette synthétique).", created_by),
            )
            report.add("financial_assessment", True)

    # --- claim_evidence_links (IRO <- artefacts) --------------------------- #
    claim_key = f"iro:{iro_id}"
    for link in ev.iro_evidence_links:
        art_id = artifact_ids.get(link.artifact_key)
        if art_id is None:
            continue
        exists = one(
            """
            SELECT id FROM claim_evidence_links
            WHERE company_id = %s AND claim_type = 'iro' AND claim_key = %s AND evidence_artifact_id = %s
            """,
            (company_id, claim_key, art_id),
        )
        if exists:
            report.add("claim_link", False)
            continue
        cur.execute(
            """
            INSERT INTO claim_evidence_links
                (company_id, claim_type, claim_key, evidence_artifact_id, relation_type, created_by)
            VALUES (%s,'iro',%s,%s,%s,%s)
            """,
            (company_id, claim_key, art_id, link.relation_type, created_by),
        )
        report.add("claim_link", True)


# --------------------------------------------------------------------------- #
# Seed suppliers/sites (best-effort, additif)
# --------------------------------------------------------------------------- #
def _seed_scaffolding(company_id: int, sc: Scenario, report: SeedReport) -> None:
    try:
        with get_db(company_id=company_id) as conn:
            cur = conn.cursor()
            for sup in sc.suppliers:
                cur.execute(
                    "SELECT id FROM suppliers WHERE company_id = %s AND name = %s",
                    (company_id, sup.name),
                )
                if cur.fetchone():
                    report.add("supplier", False)
                    continue
                cur.execute(
                    "INSERT INTO suppliers (company_id, name, country, status) VALUES (%s,%s,%s,'active')",
                    (company_id, sup.name, sup.country),
                )
                report.add("supplier", True)
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] scaffolding suppliers ignoré (best-effort) : {exc}")

    try:
        with get_db(company_id=company_id) as conn:
            cur = conn.cursor()
            for site in sc.company.sites:
                cur.execute(
                    "SELECT id FROM sites WHERE company_id = %s AND name = %s",
                    (company_id, site.name),
                )
                if cur.fetchone():
                    report.add("site", False)
                    continue
                cur.execute(
                    "INSERT INTO sites (company_id, name) VALUES (%s,%s)",
                    (company_id, site.name),
                )
                report.add("site", True)
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] scaffolding sites ignoré (best-effort) : {exc}")


# --------------------------------------------------------------------------- #
# Seed MODULE 2 — ressources stratégiques (PR-M2D), tenant-scoped, dans la
# transaction du cœur. Insère les ENTRÉES synthétiques (catalogue, alias,
# réglementaire, usages, observations de supply, liens d'exposition) puis calcule
# l'assessment via le MOTEUR RÉEL (`scoring.assess`) — jamais un chiffre inventé.
# --------------------------------------------------------------------------- #
def _ensure_demo_purchase_line(one, cur, company_id: int, created_by: int | None, sc: Scenario) -> int:
    """Import + ligne d'achat fictifs (silicium) pour ancrer une exposition
    `link_kind='purchase_line'` RÉELLE (démonstration de l'orchestration D-1)."""
    sha = _sha(sc.name, "res-purchase-import")
    row = one("SELECT id FROM purchase_imports WHERE company_id = %s AND sha256 = %s", (company_id, sha))
    import_id = row["id"] if row else one(
        """
        INSERT INTO purchase_imports
            (company_id, filename, sha256, status, row_count, accepted_count, imported_by)
        VALUES (%s,%s,%s,'validated',1,1,%s) RETURNING id
        """,
        (company_id, "asterion-resources-purchases-2024-demo.csv", sha, created_by),
    )["id"]
    row = one(
        "SELECT id FROM purchase_lines WHERE company_id = %s AND import_id = %s AND category_code = %s",
        (company_id, import_id, "SI-DEMO"),
    )
    if row:
        return row["id"]
    return one(
        """
        INSERT INTO purchase_lines
            (company_id, import_id, quantity, unit, spend_amount, currency, category_code,
             origin_country, purchase_date, mapping_status, raw_row_json)
        VALUES (%s,%s,%s,'kg',%s,'EUR',%s,%s,%s,'mapped',%s::jsonb) RETURNING id
        """,
        (company_id, import_id, 9000, 180000, "SI-DEMO", "CN", "2024-06-01",
         json.dumps({"demo": True, "material": "silicon-metal"})),
    )["id"]


def _ensure_demo_energy_activity(one, cur, company_id: int, reference_year: int) -> int:
    """Activité énergie fictive (hydrogène) pour ancrer une exposition
    `link_kind='energy_activity'` RÉELLE. carrier='other' (H2 n'est pas un porteur
    Scope 2 standard). Idempotent sur (company_id, meter_id NULL, période, carrier)."""
    ps, pe = f"{reference_year}-01-01", f"{reference_year}-12-31"
    row = one(
        """
        SELECT id FROM energy_activities
        WHERE company_id = %s AND meter_id IS NULL AND period_start = %s
          AND period_end = %s AND carrier = %s
        """,
        (company_id, ps, pe, "other"),
    )
    if row:
        return row["id"]
    return one(
        """
        INSERT INTO energy_activities
            (company_id, carrier, quantity, unit, period_start, period_end, data_status, review_status)
        VALUES (%s,'other',%s,'MWh',%s,%s,'estimated','accepted') RETURNING id
        """,
        (company_id, 1200, ps, pe),
    )["id"]


def _seed_resources(conn, company_id: int, created_by: int | None, sc: Scenario, report: SeedReport) -> None:
    from datetime import date

    from services.resources import assessment_service, scoring  # dépendance Module 2

    cfg = sc.resources or {}
    resources = cfg.get("resources") or []
    if not resources:
        return  # scénario sans extension ressources (autres scénarios)

    cur = conn.cursor()

    def one(sql: str, params: tuple):
        cur.execute(sql, params)
        return cur.fetchone()

    reference_year = int(cfg.get("reference_year", 2024))
    assessment_year = int(cfg.get("assessment_year", 2025))
    as_of = date.fromisoformat(str(cfg.get("reference_date", "2026-06-30")))

    # --- Source Evidence Kernel dédiée (synthétique, usage dérivé AUTORISÉ) ---
    src = cfg.get("source", {})
    src_code = src.get("code", "ASTERION-RES-INTEL")
    row = one("SELECT id FROM source_registry WHERE company_id = %s AND code = %s", (company_id, src_code))
    if row:
        source_id = row["id"]
        report.add("res_source", False)
    else:
        source_id = one(
            """
            INSERT INTO source_registry
                (company_id, code, publisher, title, source_type,
                 display_allowed, derived_use_allowed, active, attribution_text, created_by)
            VALUES (%s,%s,%s,%s,'manual',TRUE,TRUE,TRUE,%s,%s) RETURNING id
            """,
            (company_id, src_code, src.get("publisher", "Asterion (fictif)"),
             src.get("title", "Cartographie ressources (démo)"),
             "Données de démonstration fictives (synthetic=true)", created_by),
        )["id"]
        report.add("res_source", True)

    release_key = src.get("release_key", "2024-annual")
    checksum = _sha(sc.name, "res-release", release_key)
    row = one(
        "SELECT id FROM source_releases WHERE source_id = %s AND release_key = %s AND checksum_sha256 = %s",
        (source_id, release_key, checksum),
    )
    if row:
        release_id = row["id"]
        report.add("res_release", False)
    else:
        release_id = one(
            """
            INSERT INTO source_releases
                (source_id, company_id, release_key, checksum_sha256, status, published_at, created_by)
            VALUES (%s,%s,%s,%s,'published', now(), %s) RETURNING id
            """,
            (source_id, company_id, release_key, checksum, created_by),
        )["id"]
        report.add("res_release", True)

    # --- Parents d'exposition RÉELS (achat + activité énergie) ---
    purchase_line_id = _ensure_demo_purchase_line(one, cur, company_id, created_by, sc)
    energy_activity_id = _ensure_demo_energy_activity(one, cur, company_id, reference_year)

    for res in resources:
        slug = res["slug"]
        row = one("SELECT id FROM resource_catalog WHERE company_id = %s AND slug = %s", (company_id, slug))
        if row:
            rid = row["id"]
            report.add("resource", False)
        else:
            rid = one(
                """
                INSERT INTO resource_catalog
                    (company_id, slug, name, name_fr, primary_family, description,
                     data_status, source_release_id, created_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
                """,
                (company_id, slug, res["name"], res.get("name_fr"),
                 res.get("primary_family", "other"), res.get("description"),
                 res.get("data_status", "estimated"), release_id, created_by),
            )["id"]
            report.add("resource", True)

        for al in res.get("aliases", []):
            if one("SELECT id FROM resource_aliases WHERE resource_id = %s AND alias_kind = %s AND alias_value = %s",
                   (rid, al["alias_kind"], al["alias_value"])):
                report.add("res_alias", False)
                continue
            cur.execute(
                "INSERT INTO resource_aliases (company_id, resource_id, alias_kind, alias_value) VALUES (%s,%s,%s,%s)",
                (company_id, rid, al["alias_kind"], al["alias_value"]),
            )
            report.add("res_alias", True)

        for rg in res.get("regulatory", []):
            if one(
                """SELECT id FROM resource_regulatory_statuses WHERE company_id = %s AND resource_id = %s
                   AND regime = %s AND regulation_ref IS NOT DISTINCT FROM %s""",
                (company_id, rid, rg["regime"], rg.get("regulation_ref")),
            ):
                report.add("res_regulation", False)
                continue
            cur.execute(
                """
                INSERT INTO resource_regulatory_statuses
                    (company_id, resource_id, regime, regulation_ref, list_or_annex, listing_status,
                     validity_note, certainty, verified_on, created_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (company_id, rid, rg["regime"], rg.get("regulation_ref"), rg.get("list_or_annex"),
                 rg["listing_status"], rg.get("validity_note"), rg.get("certainty", "probable"),
                 rg.get("verified_on"), created_by),
            )
            report.add("res_regulation", True)

        for u in res.get("uses", []):
            if one(
                """SELECT id FROM resource_sector_uses WHERE company_id = %s AND resource_id = %s
                   AND sector_code IS NOT DISTINCT FROM %s AND use_label = %s""",
                (company_id, rid, u.get("sector_code"), u["use_label"]),
            ):
                report.add("res_use", False)
                continue
            cur.execute(
                """
                INSERT INTO resource_sector_uses
                    (company_id, resource_id, sector_code, use_label, criticality_note,
                     data_status, source_release_id, created_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (company_id, rid, u.get("sector_code"), u["use_label"], u.get("criticality_note"),
                 u.get("data_status", "manual"), release_id, created_by),
            )
            report.add("res_use", True)

        for o in res.get("supply", []):
            metric = o.get("metric_code", "production")
            if one(
                """SELECT id FROM resource_supply_observations WHERE company_id = %s AND resource_id = %s
                   AND stage_code = %s AND country_code = %s AND reference_year = %s AND metric_code = %s""",
                (company_id, rid, o["stage_code"], o["country_code"], reference_year, metric),
            ):
                report.add("res_supply", False)
                continue
            cur.execute(
                """
                INSERT INTO resource_supply_observations
                    (company_id, resource_id, stage_code, country_code, metric_code, share_pct,
                     reference_year, data_status, source_release_id, methodology_version, observed_at, created_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now(), %s)
                """,
                (company_id, rid, o["stage_code"], o["country_code"], metric, o.get("share_pct"),
                 reference_year, o.get("data_status", "estimated"), release_id, "asterion-supply-map-v1", created_by),
            )
            report.add("res_supply", True)

        for xp in res.get("exposures", []):
            lk = xp["link_kind"]
            share = xp.get("share_of_supply_pct")
            if one(
                """SELECT id FROM company_resource_exposure_links WHERE company_id = %s AND resource_id = %s
                   AND link_kind = %s AND share_of_supply_pct IS NOT DISTINCT FROM %s""",
                (company_id, rid, lk, share),
            ):
                report.add("res_exposure", False)
                continue
            purchase_id = purchase_line_id if lk == "purchase_line" else None
            energy_id = energy_activity_id if lk == "energy_activity" else None
            manual_note = xp.get("manual_note", "Exposition de démonstration.") if lk == "manual" else None
            cur.execute(
                """
                INSERT INTO company_resource_exposure_links
                    (company_id, resource_id, role, link_kind, purchase_line_id, energy_activity_id,
                     manual_note, annual_mass_kg, annual_spend_eur, share_of_supply_pct,
                     stock_coverage_days, data_status, notes, created_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (company_id, rid, xp["role"], lk, purchase_id, energy_id, manual_note,
                 xp.get("annual_mass_kg"), xp.get("annual_spend_eur"), share,
                 xp.get("stock_coverage_days"), xp.get("data_status", "manual"), xp.get("note"), created_by),
            )
            report.add("res_exposure", True)

        # --- Assessment RÉEL (moteur pur, même transaction, idempotent par input_hash) ---
        inputs = assessment_service._gather_inputs(
            cur, company_id=company_id, resource_id=rid, resource_slug=slug
        )
        result = scoring.assess(
            resource_slug=slug, observation_rows=inputs["observations"],
            supplier_shares=inputs["supplier_shares"], substitutes=inputs["substitutes"],
            stock_coverage_days=inputs["stock_days"], as_of=as_of,
            market_total=inputs["market_total"], market_blocked=inputs["market_blocked"],
        )
        existing_run = one(
            """SELECT id, input_hash FROM resource_assessment_runs
               WHERE company_id = %s AND resource_id = %s AND assessment_year = %s AND status <> 'superseded'""",
            (company_id, rid, assessment_year),
        )
        if existing_run and existing_run["input_hash"] == result.input_hash:
            report.add("resource_assessment", False)
            continue
        cur.execute(
            """UPDATE resource_assessment_runs SET status = 'superseded', updated_at = now()
               WHERE company_id = %s AND resource_id = %s AND assessment_year = %s AND status <> 'superseded'""",
            (company_id, rid, assessment_year),
        )
        run_id = one(
            """
            INSERT INTO resource_assessment_runs
                (company_id, resource_id, assessment_year, status, risk_score, confidence,
                 coverage_pct, observed_hhi, missing_share_pct, methodology_code, methodology_version,
                 input_snapshot, input_hash, drivers, warnings, sensitivity, calculated_by)
            VALUES (%s,%s,%s,'computed',%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
            """,
            (company_id, rid, assessment_year, result.risk_score, result.confidence,
             result.coverage_pct, result.observed_hhi, result.missing_share_pct,
             result.methodology_code, result.methodology_version,
             json.dumps({"inputs": inputs, "as_of": as_of.isoformat()}, default=str),
             result.input_hash, json.dumps(result.drivers, default=str), json.dumps(result.warnings),
             json.dumps(result.sensitivity, default=str) if result.sensitivity is not None else None,
             created_by),
        )["id"]
        for d in result.dimensions:
            cur.execute(
                """
                INSERT INTO resource_assessment_dimensions
                    (company_id, run_id, kind, dimension_code, available, risk_value, weight,
                     contribution, raw_value, raw_unit, stage_code, rationale, detail, source_release_ids)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (company_id, run_id, d.kind, d.dimension_code, d.available, d.risk_value, d.weight,
                 d.contribution, d.raw_value, d.raw_unit, d.stage_code, d.rationale,
                 json.dumps(d.detail, default=str), json.dumps(d.source_release_ids)),
            )
        report.add("resource_assessment", True)


# --------------------------------------------------------------------------- #
# Entrée
# --------------------------------------------------------------------------- #
def run(dry_run: bool, scenario_name: str) -> int:
    sc = load_scenario(scenario_name)
    if sc.manifest.tenant_slug != DEMO_TENANT_SLUG:
        print(f"[abort] slug scénario {sc.manifest.tenant_slug!r} != tenant démo {DEMO_TENANT_SLUG!r}")
        return 2

    print(f"== demo_seed :: scénario {sc.name} :: tenant {DEMO_TENANT_SLUG} :: dry_run={dry_run} ==")

    if dry_run:
        ev = sc.evidence
        res = (sc.resources or {}).get("resources") or []
        plan = {
            "company": sc.company.company.legal_name,
            "sources": len(ev.sources) + 1,
            "releases": len(ev.releases) + 1,
            "artifacts": len(ev.artifacts),
            "observations": len(ev.observations) + 9,
            "iro": 1,
            "claim_links": len(ev.iro_evidence_links),
            "suppliers": len(sc.suppliers),
            "sites": len(sc.company.sites),
            "resources": len(res),
            "resource_source": 1,
            "resource_supply_observations": sum(len(r.get("supply", [])) for r in res),
            "resource_exposure_links": sum(len(r.get("exposures", [])) for r in res),
            "resource_regulatory_statuses": sum(len(r.get("regulatory", [])) for r in res),
            "resource_sector_uses": sum(len(r.get("uses", [])) for r in res),
            "resource_assessments": len(res),
        }
        print("[dry-run] plan d'insertion (idempotent, aucun écrit) :")
        print(json.dumps(plan, indent=2, ensure_ascii=False))
        return 0

    if not db_available():
        print("[abort] PostgreSQL non configuré (DATABASE_URL manquant)")
        return 3

    tenant = ensure_demo_tenant()
    if tenant is None:
        print("[abort] impossible de préparer le tenant démo")
        return 3
    company_id, created_by = tenant.company_id, tenant.user_id

    # Aligne le nom d'affichage de la company sur le scénario (idempotent).
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE companies SET name = %s WHERE id = %s",
                (sc.company.company.legal_name, company_id),
            )

    report = SeedReport()
    # Transaction unique : Evidence Kernel + IRO (le cœur de la revue IA) + Module 2
    # (ressources stratégiques : entrées synthétiques + assessment via moteur réel).
    with get_db(company_id=company_id) as conn:
        _seed_core(conn, company_id, created_by, sc, report)
        _seed_resources(conn, company_id, created_by, sc, report)

    # Scaffolding additif (best-effort, transactions séparées).
    _seed_scaffolding(company_id, sc, report)

    print("== seed terminé ==")
    print(json.dumps(report.as_dict(), indent=2, ensure_ascii=False))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed idempotent du tenant démo Asterion Motion.")
    parser.add_argument("--dry-run", action="store_true", help="affiche le plan sans rien écrire")
    parser.add_argument("--scenario", default="asterion-motion-v1", help="nom du scénario")
    args = parser.parse_args()
    return run(dry_run=args.dry_run, scenario_name=args.scenario)


if __name__ == "__main__":
    raise SystemExit(main())
