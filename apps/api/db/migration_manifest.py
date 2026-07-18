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
}


def get_meta(version: str) -> MigrationMeta:
    """Métadonnées d'une version, ou défauts sûrs (requires_owner=False) si absente."""
    return MIGRATION_METADATA.get(version, MigrationMeta())
