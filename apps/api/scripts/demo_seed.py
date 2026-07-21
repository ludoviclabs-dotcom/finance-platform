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
    # Transaction unique : Evidence Kernel + IRO (le cœur de la revue IA).
    with get_db(company_id=company_id) as conn:
        _seed_core(conn, company_id, created_by, sc, report)

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
