"""
migration_manifest.py — métadonnées déclaratives par version de migration.

Remplace MANUAL_ONLY_PREFIXES (migrations.py) par un manifeste explicite et
visible dans le plan, plutôt qu'invisible dans une liste Python. Le manifeste
n'entre jamais dans le calcul du checksum d'une migration (PR02_ARCHITECTURE_PLAN.md §12) :
éditer rétroactivement un fichier .sql déjà checksummé pour y ajouter ces
métadonnées violerait l'immuabilité des migrations déjà enregistrées.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MigrationMeta:
    requires_owner: bool = False
    transactional: bool = True
    note: str = ""


MIGRATION_METADATA: dict[str, MigrationMeta] = {
    "004": MigrationMeta(
        requires_owner=False,
        transactional=True,
        note=(
            "Gating de rollout historique (MANUAL_ONLY_PREFIXES), pas un privilège "
            "manquant — supersédée fonctionnellement par 009 en production "
            "(confirmé 2026-07-17, voir PR02_DECISIONS.md D-3)."
        ),
    ),
    "009": MigrationMeta(
        requires_owner=False,
        transactional=True,
        note=(
            "Gating RLS_FORCE historique (validation prod requise), pas un privilège "
            "manquant — confirmée appliquée manuellement en production le 2026-07-17 "
            "(relforcerowsecurity=true sur les 5 tables, voir PR02_DECISIONS.md D-3)."
        ),
    ),
    "027": MigrationMeta(
        requires_owner=True,
        transactional=True,
        note=(
            "ALTER TABLE actions exige le rôle propriétaire (neondb_owner) ; GRANT "
            "conditionnel à carbonco_app inclus. Appliquée manuellement en production "
            "le 2026-07-04 — preuve à formaliser via mark-manual-verified (PR-02B)."
        ),
    ),
    "028": MigrationMeta(
        requires_owner=False,
        transactional=True,
        note=(
            "Evidence Kernel (PR-03) : 6 nouvelles tables (source_registry, "
            "source_releases, evidence_artifacts, ingestion_runs, observations, "
            "claim_evidence_links), RLS FORCE + lecture globale/tenant, triggers "
            "d'immutabilité. Ne crée que des tables neuves (aucun ALTER d'une "
            "table existante) — pas de privilège propriétaire requis, à l'inverse "
            "de 027. Aucune donnée métier migrée, aucune source externe ingérée."
        ),
    ),
    "029": MigrationMeta(
        requires_owner=False,
        transactional=True,
        note=(
            "Source Admin (PR-04) : vue source_freshness (security_invoker=true) "
            "agrégeant par source sa dernière release/statut pour "
            "/health/intelligence et la page de fraîcheur. Aucune table neuve, "
            "aucun ALTER — CREATE OR REPLACE VIEW rejouable, hérite de la RLS des "
            "tables 028. Pas de privilège propriétaire requis. La source démo "
            "CARBONCO_DEMO_SNAPSHOT et ses observations sont des DONNÉES (créées "
            "par le CLI d'import via les services PR-03), pas du schéma."
        ),
    ),
    "030": MigrationMeta(
        requires_owner=False,
        transactional=True,
        note=(
            "Exposition achats/fournisseurs (PR-05A) : 9 nouvelles tables "
            "(supplier_sites, supplier_products, purchase_imports, purchase_lines, "
            "bom_versions, bom_items, material_mappings, supplier_metric_declarations, "
            "product_carbon_footprints), RLS génération 2 FORCE + policies par "
            "commande. Ne crée que des tables neuves (aucun ALTER d'une table "
            "existante) — pas de privilège propriétaire requis, comme 028. Aucun "
            "calcul Scope 3, aucun score (PR-05B). Aucune donnée métier migrée."
        ),
    ),
    "031": MigrationMeta(
        requires_owner=False,
        transactional=True,
        note=(
            "Énergie & Scope 2 (PR-06A) : 5 nouvelles tables (energy_meters, "
            "energy_activities, contractual_instruments, instrument_allocations, "
            "energy_factor_metadata), RLS gen-2 FORCE (purement tenant, sans ligne "
            "globale), trigger anti-double-allocation (somme allocated_mwh <= "
            "volume_mwh par instrument). Ne crée que des tables neuves (aucun ALTER "
            "d'une table existante) — pas de privilège propriétaire requis, comme "
            "028. Aucun calcul Scope 2, aucun total LB/MB (PR-06B), aucun LLM, "
            "aucune donnée externe réelle."
        ),
    ),
    "032": MigrationMeta(
        requires_owner=False,
        transactional=True,
        note=(
            "Moteur Scope 3 cat. 1 achats & hotspots (PR-05B) : 3 nouvelles tables "
            "(procurement_calculation_runs, procurement_line_results, "
            "procurement_hotspot_selections), RLS gen-2 FORCE + policies par "
            "commande. Ne crée que des tables neuves (aucun ALTER d'une table "
            "existante) — pas de privilège propriétaire requis, comme 028/030. "
            "Contraintes CHECK portant les règles métier non négociables : "
            "cohérence méthode↔rang, fallback_reason obligatoire dès le rang 2 "
            "(aucun repli silencieux), result_tco2e NULL obligatoire pour une "
            "ligne non résolue (aucune valeur inventée). Aucun score ESG unique, "
            "aucun LLM, aucune donnée métier migrée."
        ),
    ),
    "033": MigrationMeta(
        requires_owner=False,
        transactional=True,
        note=(
            "Moteur de calcul Scope 2 dual (PR-06B) : 2 nouvelles tables "
            "(scope2_calculation_runs, scope2_line_results), RLS gen-2 FORCE + "
            "policies par commande, triggers d'immutabilité (snapshot d'entrée, "
            "résultat et lignes de trace non réécrivables). Ne crée que des tables "
            "neuves (aucun ALTER d'une table existante) — pas de privilège "
            "propriétaire requis, comme 028/030/031. Aucun calcul exécuté par la "
            "migration, aucune donnée métier migrée, aucun LLM, aucun fallback "
            "silencieux de facteur. Appliquée après 032 (moteur Scope 3 achats, "
            "PR-05B) : le ledger trie par préfixe sans exiger de contiguïté."
        ),
    ),
    "034": MigrationMeta(
        requires_owner=False,
        transactional=True,
        note=(
            "CRMA / exposition matières critiques (PR-07) : 11 nouvelles tables — "
            "8 référentiels à portée mixte tenant/globale (material_groups, "
            "material_group_members, processing_stages, material_stage_observations, "
            "material_market_observations, substitutes, recycling_routes, "
            "trade_or_regulatory_events) et 3 tables tenant strictes "
            "(company_material_exposures, crma_article24_assessments, "
            "mitigation_actions). RLS gen-2 FORCE, policies par commande ; lecture "
            "tenant OU globale, écriture tenant uniquement (pattern 028). Seule "
            "écriture de données : les 8 étapes de la chaîne de valeur "
            "(vocabulaire structurel, pas une donnée factuelle), semées sous "
            "app.rls_bypass. Ne crée que des tables neuves (aucun ALTER d'une "
            "table existante) — pas de privilège propriétaire requis, comme 028. "
            "material_id reste TEXT sans FK : aucun référentiel `materials` "
            "n'existe encore en base, il relèvera d'une migration ultérieure. "
            "Aucune source externe ingérée, aucun LLM, aucun prix affiché sans "
            "droit de licence."
        ),
    ),
    "035": MigrationMeta(
        requires_owner=False,
        transactional=True,
        note=(
            "Wave 3 stabilisation — intégrité achats & concurrence énergie : "
            "deux correctifs sur des tables déjà créées (030, 031), aucune table "
            "neuve. (A) purchase_lines_mapping_status_check élargie pour "
            "accepter 'ambiguous' + colonne mapping_note (raison obligatoire, "
            "CHECK dédiée) — _auto_map (PR-05A) ne résout plus un product_code "
            "partagé par plusieurs fournisseurs par premier résultat SQL sans "
            "ORDER BY. (B) energy_allocation_guard() (CREATE OR REPLACE, même "
            "nom que 031) verrouille désormais la ligne contractual_instruments "
            "via SELECT ... FOR UPDATE avant de sommer les allocations "
            "existantes — ferme le TOCTOU documenté au §6.4 de "
            "ENERGY_RLS_NON_SUPERUSER_HARDENING.md. Pas de privilège "
            "propriétaire requis, comme 028/030/031/032/033/034."
        ),
    ),
    "036": MigrationMeta(
        requires_owner=True,
        transactional=True,
        note=(
            "Géospatial & ledger eau (PR-08 tranche A) : ALTER TABLE sites "
            "(027, propriété neondb_owner en production — précédent direct 027 "
            "et son ALTER TABLE actions) exige le rôle propriétaire ; "
            "application via DATABASE_ADMIN_URL + mark-manual-verified, jamais "
            "par le chemin carbonco_app automatique. Ajoute aussi 5 tables "
            "neuves (site_geocode_candidates, water_imports, water_activities, "
            "water_permits, water_risk_areas) avec RLS gen-2 FORCE + GRANT "
            "conditionnel. AUCUN PostGIS (décision validée) : coordonnées "
            "NUMERIC + bbox/boundary_geojson évalués côté Python avec "
            "method_code explicite. Aucune donnée métier migrée, aucune source "
            "externe ingérée, aucun LLM."
        ),
    ),
    "037": MigrationMeta(
        requires_owner=False,
        transactional=True,
        note=(
            "Screening hydrique auditable (PR-08 tranche B) : 3 nouvelles "
            "tables tenant strictes (site_water_screenings — snapshot d'entrée "
            "immuable par trigger, précédent 033 ; risque et confiance en deux "
            "colonnes séparées, précédent 034 ; iro_signal = signal-à-examiner "
            "humain, jamais une décision de matérialité — water_targets, "
            "water_actions). RLS gen-2 FORCE, GRANT conditionnel. Ne crée que "
            "des tables neuves (aucun ALTER d'une table existante) — pas de "
            "privilège propriétaire requis, comme 028/030/031/033/034. Aucun "
            "calcul exécuté par la migration, aucun PostGIS, aucun LLM."
        ),
    ),
    "038": MigrationMeta(
        requires_owner=False,
        transactional=True,
        note=(
            "Fondation biodiversité — Locate et Evaluate (PR-09 tranche A) : "
            "6 nouvelles tables (nature_features référentiel sourcé à portée "
            "mixte tenant/globale, motif water_risk_areas 036 ; "
            "site_nature_intersections fait géométrique immuable par trigger, "
            "motif site_water_screenings 037 — réutilise "
            "services/calculations/geo.py, jamais un score ; "
            "nature_dependencies et nature_impacts, deux tables strictement "
            "séparées par construction, motif TNFD ; leap_assessments et "
            "leap_assessment_sites, le dossier LEAP). RLS gen-2 FORCE, GRANT "
            "conditionnel. Ne crée que des tables neuves (aucun ALTER d'une "
            "table existante) — pas de privilège propriétaire requis, comme "
            "028/030/031/033/034/037. Numérotation validée pour cette branche "
            "(038/039), distincte de la réservation indicative 037 du plan "
            "PR-09 et de la réservation 038 de WAVE_4_INTERFACE_CONTRACTS.md "
            "§13 pour PR-10 — voir PR09_BIODIVERSITY_LEAP_TRACEABILITY.md. "
            "Aucun scoring de risque/opportunité ici (039), aucune donnée "
            "métier migrée, aucune source externe ingérée, aucun LLM."
        ),
    ),
    "039": MigrationMeta(
        requires_owner=False,
        transactional=True,
        note=(
            "Risques, opportunités et brouillons TNFD nature — Assess et "
            "Prepare (PR-09 tranche B) : 4 nouvelles tables tenant strictes "
            "(nature_risks/nature_opportunities — risk_score/opportunity_score, "
            "likelihood et confidence en TROIS colonnes séparées, motif "
            "crma_article24_assessments 034 ; nature_actions, calquée sur "
            "mitigation_actions 034 / water_actions 037 ; "
            "tnfd_disclosure_drafts, is_official_tnfd_disclosure verrouillé à "
            "false par CHECK — jamais une discipline applicative seule). RLS "
            "gen-2 FORCE, GRANT conditionnel. Ne crée que des tables neuves "
            "(aucun ALTER d'une table existante) — pas de privilège "
            "propriétaire requis, comme 028/030/031/033/034/037/038. Aucun "
            "calcul exécuté par la migration, aucune donnée métier migrée, "
            "aucune source externe ingérée, aucun LLM, aucune publication "
            "automatique de disclosure."
        ),
    ),
    "040": MigrationMeta(
        requires_owner=False,
        transactional=True,
        note=(
            "IRO, double matérialité et transmission financière (PR-10) : 6 "
            "nouvelles tables tenant strictes (iros — entité centrale, "
            "statut candidate/under_assessment/assessed/decided/archived ; "
            "impact_assessments/financial_assessments — composantes "
            "scale/scope/irremediability/likelihood et likelihood/magnitude "
            "en colonnes SÉPARÉES, jamais fusionnées, motif "
            "crma_article24_assessments 034 ; materiality_decisions — "
            "décision humaine obligatoire (decided_by NOT NULL), APPEND-ONLY "
            "par trigger dédié (motif evidence_kernel_guard('frozen') 028) ; "
            "iro_actions, calquée sur mitigation_actions 034 / water_actions "
            "037 / nature_actions 039 ; disclosure_mappings — table de "
            "correspondance pure). Réservation indicative 038 de "
            "WAVE_4_INTERFACE_CONTRACTS.md §13 obsolète : 038/039 pris par "
            "PR-09 (fondation biodiversité + Assess/Prepare) — PR-10 prend "
            "donc 040, après 039 (renumérotation anticipée par le plan §14). "
            "RLS gen-2 FORCE, GRANT conditionnel. Six tables neuves + UN "
            "élargissement de contrainte sur une table existante "
            "(audit_eventtype_check, DROP+ADD sous le même nom pour admettre "
            "'materiality_decision' — même geste que 011/012/035, ni l'un ni "
            "l'autre requires_owner pour ce même geste sur cette même table). "
            "Pas de privilège propriétaire requis, comme 028/030/031/033/034/"
            "037/038/039. Aucun calcul exécuté par la migration, aucune "
            "donnée métier migrée, aucune source externe ingérée, aucun LLM, "
            "aucune décision de matérialité automatique, aucun score unique "
            "fusionné impact+financier."
        ),
    ),
}


def get_meta(version: str) -> MigrationMeta:
    """Métadonnées d'une version, ou défauts sûrs (requires_owner=False) si absente."""
    return MIGRATION_METADATA.get(version, MigrationMeta())
