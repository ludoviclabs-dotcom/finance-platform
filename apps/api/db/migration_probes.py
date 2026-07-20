"""
migration_probes.py — sondes de vérification objet-par-objet, une par version.

Utilisées par `MigrationRunner.baseline()`/`verify()` (PR-02B) : le vérificateur
d'objets fait toujours autorité, jamais l'hypothèse historique
(PR02_ARCHITECTURE_PLAN.md §8). Chaque sonde interroge le catalogue système
PostgreSQL (`pg_class`, `pg_policies`, `pg_proc`, `information_schema`) —
jamais une hypothèse sur ce qui a dû s'exécuter.

Noms de tables/colonnes/policies vérifiés par lecture exhaustive des 28
fichiers `.sql` (grep `CREATE TABLE`/`ADD COLUMN`/`ENABLE ROW LEVEL SECURITY`/
`CREATE POLICY`/`CREATE FUNCTION`), pas recopiés depuis un résumé.

Piège documenté (021) : `tenant_isolation_alert_rules` (sans suffixe) est créée
par 004 **et** par 009 (mêmes noms, cf. D-3) — la migration 021 tente de créer
une policy du même nom sous un `IF NOT EXISTS`, qui devient donc un no-op dès
que 004/009 a tourné avant elle (l'ordre normal). Une sonde 021 qui se contentait
de vérifier l'existence de `tenant_isolation_alert_rules` serait donc TOUJOURS
vraie dès que 004/009 a tourné, indépendamment de 021 — faux positif. La sonde
021 s'appuie donc sur ses artefacts non ambigus : table `alert_notifications`,
colonne `alert_rules.mode`, et les policies `_ins`/`_upd` (suffixes propres à
021, distincts du `_insert` de 004/009).
"""

from __future__ import annotations

from typing import Callable

Cursor = object  # curseur psycopg2 (RealDictCursor) — typé large, pas de dépendance dure ici


def _table_exists(cur, table: str) -> bool:
    cur.execute("SELECT to_regclass(%s) AS t", (f"public.{table}",))
    row = cur.fetchone()
    return row is not None and row["t"] is not None


def _column_exists(cur, table: str, column: str) -> bool:
    cur.execute(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = %s AND column_name = %s",
        (table, column),
    )
    return cur.fetchone() is not None


def _policy_exists(cur, table: str, policy: str) -> bool:
    cur.execute(
        "SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = %s AND policyname = %s",
        (table, policy),
    )
    return cur.fetchone() is not None


def _force_rls(cur, table: str) -> bool:
    cur.execute("SELECT relforcerowsecurity FROM pg_class WHERE relname = %s", (table,))
    row = cur.fetchone()
    return bool(row and row["relforcerowsecurity"])


def _is_security_definer(cur, function: str) -> bool:
    cur.execute("SELECT prosecdef FROM pg_proc WHERE proname = %s", (function,))
    row = cur.fetchone()
    return bool(row and row["prosecdef"])


def _constraint_exists(cur, table: str, constraint: str) -> bool:
    """True si la contrainte nommée existe sur la table.

    Utilisé quand une RÈGLE MÉTIER est portée par un CHECK (pas seulement par
    du code applicatif) : sa disparition est une dérive de schéma qui doit être
    détectée, au même titre qu'une table manquante."""
    cur.execute(
        "SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid "
        "WHERE t.relname = %s AND c.conname = %s",
        (table, constraint),
    )
    return cur.fetchone() is not None


def _trigger_exists(cur, table: str, trigger: str) -> bool:
    cur.execute(
        "SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid "
        "WHERE c.relname = %s AND t.tgname = %s AND NOT t.tgisinternal",
        (table, trigger),
    )
    return cur.fetchone() is not None


def _constraint_definition_contains(cur, table: str, constraint: str, needle: str) -> bool:
    """True si la contrainte existe ET que sa définition (`pg_get_constraintdef`)
    contient `needle`.

    Nécessaire quand un NOM de contrainte est RÉUTILISÉ par une migration
    ultérieure (`DROP CONSTRAINT` + `ADD CONSTRAINT` du même nom) — comme
    `audit_eventtype_check` (créée par 011, élargie par 012) ou
    `purchase_lines_mapping_status_check` (créée par 030, élargie par 035) :
    l'existence seule (`_constraint_exists`) ne distingue pas l'ancienne
    définition de la nouvelle, même piège que documenté pour la policy
    `tenant_isolation_alert_rules` partagée par 004/009/021."""
    cur.execute(
        "SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c "
        "JOIN pg_class t ON t.oid = c.conrelid "
        "WHERE t.relname = %s AND c.conname = %s",
        (table, constraint),
    )
    row = cur.fetchone()
    return row is not None and needle in (row["def"] or "")


def _function_source_contains(cur, function: str, needle: str) -> bool:
    """True si la fonction existe ET que son corps (`pg_proc.prosrc`) contient `needle`.

    Nécessaire quand une fonction `SECURITY DEFINER` est RECRÉÉE (`CREATE OR
    REPLACE`, même nom) par une migration ultérieure pour un correctif de
    comportement — `energy_allocation_guard()`, définie par 031 et dont le
    corps est remplacé par 035 (verrou `FOR UPDATE` ajouté) : l'existence de
    la fonction seule (`_is_security_definer`) ne distingue pas l'ancienne
    implémentation de la nouvelle, même raisonnement que
    `_constraint_definition_contains`."""
    cur.execute("SELECT prosrc FROM pg_proc WHERE proname = %s", (function,))
    row = cur.fetchone()
    return row is not None and needle in (row["prosrc"] or "")


def _view_has_security_invoker(cur, view: str) -> bool:
    """True si la vue existe ET porte l'option `security_invoker=true`.

    Sonde sans ambiguïté de la migration 029 : une vue sans security_invoker
    bypasserait la RLS des tables sous-jacentes (piège documenté dans le
    fichier .sql). reloptions est un text[] de la forme
    `{security_invoker=true}` sur pg_class (relkind='v')."""
    cur.execute(
        "SELECT reloptions FROM pg_class WHERE relname = %s AND relkind = 'v'",
        (view,),
    )
    row = cur.fetchone()
    if row is None:
        return False
    opts = row["reloptions"] or []
    return any(str(o).replace(" ", "").lower() == "security_invoker=true" for o in opts)


# ── Sondes déclarées, une par version ────────────────────────────────────

def _probe_000(cur) -> bool:
    """DDL inline historique (migrations.py) — 7 tables du socle applicatif."""
    return all(
        _table_exists(cur, t)
        for t in ("companies", "users", "refresh_tokens", "snapshots", "audit_events", "products", "alert_rules")
    )


def _probe_001(cur) -> bool:
    return _table_exists(cur, "emission_factors")


def _probe_002(cur) -> bool:
    return _table_exists(cur, "facts_events")


def _probe_003(cur) -> bool:
    return _table_exists(cur, "facts_current")  # vue matérialisée — to_regclass couvre relkind='m'


def _probe_004(cur) -> bool:
    """ENABLE + policies sur les 5 tables (revue Codex, corrigé 2026-07-17).

    Ne dépend PAS de l'absence de FORCE. La version précédente exigeait
    explicitement `relforcerowsecurity=false`, pour « distinguer » 004 de 009
    — mais 009 supersède 004 en réutilisant les MÊMES noms de policies puis en
    ajoutant FORCE (D-3) : sur une base complète (004 puis 009), FORCE est
    posé, et cette condition faisait donc échouer 004 alors que ses policies
    sont bien présentes et actives. FORCE en plus ne les annule pas, il les
    renforce — le rôle de cette sonde est de vérifier que le SOCLE 004 est
    satisfait, pas de distinguer "004 seule" de "004+009" (ce n'est pas une
    distinction dont `baseline()` a besoin : D-3 exige que 004 ET 009 soient
    TOUTES DEUX marquées baseline quand les deux ont tourné)."""
    tables = ("snapshots", "facts_events", "audit_events", "alert_rules", "products")
    return all(
        _policy_exists(cur, t, f"tenant_isolation_{t}") and _policy_exists(cur, t, f"tenant_isolation_{t}_insert")
        for t in tables
    )


def _probe_005(cur) -> bool:
    return _column_exists(cur, "audit_events", "hash_prev") and _column_exists(cur, "audit_events", "hash_self")


def _probe_006(cur) -> bool:
    return _table_exists(cur, "datapoint_reviews")


def _probe_007(cur) -> bool:
    return _table_exists(cur, "export_packages")


def _probe_008(cur) -> bool:
    return all(
        _table_exists(cur, t)
        for t in ("suppliers", "supplier_questionnaire_tokens", "supplier_answers", "materialite_positions")
    )


def _probe_008b(cur) -> bool:
    policies = (
        ("suppliers", "tenant_isolation_suppliers"),
        ("suppliers", "tenant_isolation_suppliers_ins"),
        ("supplier_questionnaire_tokens", "tenant_isolation_sqt"),
        ("supplier_questionnaire_tokens", "tenant_isolation_sqt_ins"),
        ("supplier_answers", "tenant_isolation_sa"),
        ("supplier_answers", "tenant_isolation_sa_ins"),
        ("materialite_positions", "tenant_isolation_matpos"),
        ("materialite_positions", "tenant_isolation_matpos_ins"),
    )
    return all(_policy_exists(cur, t, p) for t, p in policies) and _is_security_definer(cur, "resolve_supplier_token")


def _probe_009(cur) -> bool:
    """Supersède 004 : mêmes noms de policies + FORCE ROW LEVEL SECURITY (la preuve D-3)."""
    tables = ("snapshots", "facts_events", "audit_events", "alert_rules", "products")
    policies_ok = all(
        _policy_exists(cur, t, f"tenant_isolation_{t}") and _policy_exists(cur, t, f"tenant_isolation_{t}_insert")
        for t in tables
    )
    return policies_ok and all(_force_rls(cur, t) for t in tables)


def _probe_010(cur) -> bool:
    return (
        _table_exists(cur, "ingest_jobs")
        and _policy_exists(cur, "ingest_jobs", "tenant_isolation_ingest_jobs")
        and _policy_exists(cur, "ingest_jobs", "tenant_isolation_ingest_jobs_insert")
    )


def _probe_011(cur) -> bool:
    return (
        _table_exists(cur, "user_totp")
        and _table_exists(cur, "user_recovery_codes")
        and _column_exists(cur, "companies", "totp_policy")
    )


def _probe_012(cur) -> bool:
    return (
        _table_exists(cur, "auditor_invites")
        and _is_security_definer(cur, "resolve_auditor_token")
        and _is_security_definer(cur, "touch_auditor_token")
    )


def _probe_013(cur) -> bool:
    return _table_exists(cur, "chain_verifications") and _policy_exists(
        cur, "chain_verifications", "tenant_isolation_chainv"
    )


def _probe_014(cur) -> bool:
    return _table_exists(cur, "vsme_datapoints")  # catalogue global, pas de RLS (délibéré)


def _probe_015(cur) -> bool:
    return _table_exists(cur, "vsme_field_values") and _policy_exists(
        cur, "vsme_field_values", "tenant_isolation_vsme_fv"
    )


def _probe_016(cur) -> bool:
    return _table_exists(cur, "vsme_wizard_sessions") and _policy_exists(
        cur, "vsme_wizard_sessions", "tenant_isolation_vsme_wizard"
    )


def _probe_017(cur) -> bool:
    return _table_exists(cur, "fec_screenings") and _policy_exists(cur, "fec_screenings", "tenant_isolation_fec")


def _probe_018(cur) -> bool:
    return (
        _column_exists(cur, "companies", "parent_id")
        and _column_exists(cur, "companies", "ownership_pct")
        and _column_exists(cur, "companies", "consolidation_approach")
        and _table_exists(cur, "perimeter_events")
        and _policy_exists(cur, "perimeter_events", "tenant_isolation_perimeter")
    )


def _probe_019(cur) -> bool:
    return (
        _table_exists(cur, "baselines")
        and _table_exists(cur, "recalc_events")
        and _policy_exists(cur, "baselines", "tenant_isolation_baselines")
        and _policy_exists(cur, "recalc_events", "tenant_isolation_recalc")
    )


def _probe_020(cur) -> bool:
    return (
        _table_exists(cur, "actions")
        and _table_exists(cur, "action_events")
        and _policy_exists(cur, "actions", "tenant_isolation_actions")
        and _policy_exists(cur, "action_events", "tenant_isolation_action_events")
    )


def _probe_021(cur) -> bool:
    """Piège : NE PAS sonder `tenant_isolation_alert_rules` seule (déjà créée par 004/009,
    voir le docstring du module). Artefacts non ambigus de 021 uniquement."""
    return (
        _table_exists(cur, "alert_notifications")
        and _column_exists(cur, "alert_rules", "mode")
        and _policy_exists(cur, "alert_rules", "tenant_isolation_alert_rules_ins")
        and _policy_exists(cur, "alert_rules", "tenant_isolation_alert_rules_upd")
    )


def _probe_022(cur) -> bool:
    return _table_exists(cur, "import_screenings") and _policy_exists(
        cur, "import_screenings", "tenant_isolation_imports"
    )


def _probe_023(cur) -> bool:
    return (
        _table_exists(cur, "beges_filings")
        and _policy_exists(cur, "beges_filings", "tenant_isolation_beges_filings")
        and _policy_exists(cur, "beges_filings", "tenant_isolation_beges_filings_del")
    )


def _probe_024(cur) -> bool:
    """Inclut les policies RLS de `supplier_campaigns` (revue Codex, corrigé 2026-07-17).

    La version précédente ne vérifiait que les artefacts créés AVANT le bloc
    RLS du fichier (table, colonnes ajoutées, fonction SECURITY DEFINER) —
    une migration partiellement appliquée (ou dont les policies auraient été
    retirées après coup) restait donc détectée comme complète, permettant à
    `baseline()` de la valider à tort et à `verify()` de ne jamais signaler la
    dérive de sécurité."""
    return (
        _table_exists(cur, "supplier_campaigns")
        and _column_exists(cur, "supplier_questionnaire_tokens", "campaign_id")
        and _column_exists(cur, "supplier_answers", "review_status")
        and _is_security_definer(cur, "mark_supplier_token_viewed")
        and _policy_exists(cur, "supplier_campaigns", "tenant_isolation_supplier_campaigns")
        and _policy_exists(cur, "supplier_campaigns", "tenant_isolation_supplier_campaigns_ins")
        and _policy_exists(cur, "supplier_campaigns", "tenant_isolation_supplier_campaigns_upd")
        and _policy_exists(cur, "supplier_campaigns", "tenant_isolation_supplier_campaigns_del")
    )


def _probe_025(cur) -> bool:
    return _table_exists(cur, "materialite_assessments") and _column_exists(
        cur, "materialite_positions", "justification"
    )


def _probe_026(cur) -> bool:
    return _table_exists(cur, "partner_applications")  # donnée plateforme, pas de RLS (délibéré)


def _probe_027(cur) -> bool:
    """requires_owner=true (manifeste) — vérifiée comme les autres : l'existence de
    l'objet compte, pas la façon dont il a été créé (manuel Neon SQL Editor, §8)."""
    return (
        _table_exists(cur, "sites")
        and _column_exists(cur, "actions", "site_id")
        and _force_rls(cur, "sites")
        and _policy_exists(cur, "sites", "tenant_isolation_sites")
    )


def _probe_028(cur) -> bool:
    """Evidence Kernel (PR-03) : 6 tables + RLS FORCE (lecture globale/tenant)
    sur chacune + les 3 triggers d'immutabilité (`evidence_kernel_guard`)."""
    tables = (
        "source_registry", "source_releases", "evidence_artifacts",
        "ingestion_runs", "observations", "claim_evidence_links",
    )
    if not all(_table_exists(cur, t) for t in tables):
        return False
    if not all(
        _policy_exists(cur, t, f"tenant_isolation_{t}") and _force_rls(cur, t)
        for t in tables
    ):
        return False
    return (
        _trigger_exists(cur, "observations", "trg_observations_immutable")
        and _trigger_exists(cur, "source_releases", "trg_source_releases_guard")
        and _trigger_exists(cur, "evidence_artifacts", "trg_evidence_artifacts_guard")
    )


def _probe_029(cur) -> bool:
    """Source Admin (PR-04) : vue source_freshness présente ET en
    security_invoker (sinon elle bypasserait la RLS des tables 028 — la
    présence seule ne suffit pas, cf. _view_has_security_invoker)."""
    return _view_has_security_invoker(cur, "source_freshness")


def _probe_030(cur) -> bool:
    """Exposition achats/fournisseurs (PR-05A) : 9 tables + RLS FORCE (policy
    de lecture par tenant) sur chacune. Vérifie l'existence de la table, la
    présence de la policy `tenant_isolation_<table>` et FORCE ROW LEVEL
    SECURITY — mêmes artefacts non ambigus que _probe_028 (aucun trigger
    d'immutabilité dans cette tranche, contrairement à 028)."""
    tables = (
        "supplier_sites", "supplier_products", "purchase_imports", "purchase_lines",
        "bom_versions", "bom_items", "material_mappings",
        "supplier_metric_declarations", "product_carbon_footprints",
    )
    if not all(_table_exists(cur, t) for t in tables):
        return False
    return all(
        _policy_exists(cur, t, f"tenant_isolation_{t}") and _force_rls(cur, t)
        for t in tables
    )


def _probe_031(cur) -> bool:
    """Énergie & Scope 2 (PR-06A) : 5 tables purement tenant + RLS FORCE +
    policy scopée sur chacune + le trigger anti-double-allocation.

    On sonde le trigger `trg_instrument_allocations_guard` en plus des tables :
    c'est lui qui garantit l'anti-double-allocation EN BASE (le cœur de la
    migration) — une base où les tables existent mais où le trigger a été
    retiré est incomplète et doit rester détectée comme telle."""
    tables = (
        "energy_meters", "energy_activities", "contractual_instruments",
        "instrument_allocations", "energy_factor_metadata",
    )
    if not all(_table_exists(cur, t) for t in tables):
        return False
    if not all(
        _policy_exists(cur, t, f"tenant_isolation_{t}") and _force_rls(cur, t)
        for t in tables
    ):
        return False
    return _trigger_exists(cur, "instrument_allocations", "trg_instrument_allocations_guard")


def _probe_032(cur) -> bool:
    """Moteur Scope 3 achats & hotspots (PR-05B) : 3 tables purement tenant +
    RLS FORCE + policy scopée sur chacune, ET les contraintes CHECK qui portent
    les règles non négociables.

    On sonde `procurement_line_results_fallback_reason_check` en plus des
    tables : c'est elle qui garantit EN BASE qu'aucune ligne ne peut descendre
    la hiérarchie de méthode sans dire pourquoi (« aucun fallback silencieux »).
    Une base où les tables existent mais où cette contrainte a été retirée est
    incomplète et doit rester détectée comme telle — même raisonnement que la
    sonde 031 pour son trigger anti-double-allocation."""
    tables = (
        "procurement_calculation_runs", "procurement_line_results",
        "procurement_hotspot_selections",
    )
    if not all(_table_exists(cur, t) for t in tables):
        return False
    if not all(
        _policy_exists(cur, t, f"tenant_isolation_{t}") and _force_rls(cur, t)
        for t in tables
    ):
        return False
    return _constraint_exists(
        cur, "procurement_line_results", "procurement_line_results_fallback_reason_check"
    )


def _probe_033(cur) -> bool:
    """Moteur de calcul Scope 2 dual (PR-06B) : 2 tables purement tenant + RLS
    FORCE + policy scopée sur chacune + les DEUX triggers d'immutabilité.

    Les triggers font partie des artefacts sondés (comme le trigger
    anti-double-allocation en 031) : une base où les tables existent mais où
    l'immutabilité du snapshot d'entrée a été retirée n'est pas la migration
    033 — le run cesserait d'être un enregistrement infalsifiable, et la sonde
    doit le détecter."""
    tables = ("scope2_calculation_runs", "scope2_line_results")
    if not all(_table_exists(cur, t) for t in tables):
        return False
    if not all(
        _policy_exists(cur, t, f"tenant_isolation_{t}") and _force_rls(cur, t)
        for t in tables
    ):
        return False
    return (
        _trigger_exists(cur, "scope2_calculation_runs", "trg_scope2_runs_immutable")
        and _trigger_exists(cur, "scope2_line_results", "trg_scope2_lines_immutable")
    )


def _probe_034(cur) -> bool:
    """CRMA / exposition matières (PR-07) : 11 tables + RLS FORCE + policy
    scopée sur chacune, ET le vocabulaire des 8 étapes de la chaîne de valeur.

    On sonde les étapes en plus des tables : `processing_stages` peuplée est ce
    qui rend les observations comparables entre elles. Une base où les tables
    existent mais où le vocabulaire d'étapes est absent produirait des chaînes
    de valeur vides sans erreur — elle est incomplète et doit rester détectée
    comme telle (même geste que le trigger sondé par _probe_031)."""
    tables = (
        "material_groups", "material_group_members", "processing_stages",
        "material_stage_observations", "material_market_observations", "substitutes",
        "recycling_routes", "trade_or_regulatory_events", "company_material_exposures",
        "crma_article24_assessments", "mitigation_actions",
    )
    if not all(_table_exists(cur, t) for t in tables):
        return False
    if not all(
        _policy_exists(cur, t, f"tenant_isolation_{t}") and _force_rls(cur, t)
        for t in tables
    ):
        return False
    # Les 8 étapes globales du MVP aimants permanents, extraction -> produit.
    # La policy SELECT autorise `company_id IS NULL` : lisible sans bypass.
    cur.execute(
        "SELECT COUNT(*) AS n FROM processing_stages "
        "WHERE company_id IS NULL AND code = ANY(%s)",
        (["extraction", "separation", "refining", "metal_alloy",
          "powder", "magnet", "component", "product"],),
    )
    row = cur.fetchone()
    return bool(row) and int(row["n"]) == 8


def _probe_035(cur) -> bool:
    """Wave 3 stabilisation : deux correctifs INDÉPENDANTS sur des tables déjà
    créées par 030/031 — aucune table neuve, donc aucun `_table_exists` ici.

    (A) `purchase_lines.mapping_note` : colonne neuve, non ambiguë par
    construction (n'existe dans aucune migration antérieure). ET la
    contrainte `mapping_status_check` dont la DÉFINITION contient 'ambiguous'
    — l'existence seule de la contrainte ne suffit pas, son NOM est réutilisé
    depuis 030 (même piège que `audit_eventtype_check` 011/012, cf.
    `_constraint_definition_contains`).

    (B) `energy_allocation_guard()` recréée (`CREATE OR REPLACE`, même nom
    que 031) avec un verrou `FOR UPDATE` avant le calcul de la somme allouée
    — l'existence de la fonction/trigger seule ne suffit pas non plus (même
    raisonnement qu'en (A)), on sonde le contenu réel du corps de la fonction.
    """
    if not _column_exists(cur, "purchase_lines", "mapping_note"):
        return False
    if not _constraint_definition_contains(
        cur, "purchase_lines", "purchase_lines_mapping_status_check", "ambiguous"
    ):
        return False
    return _function_source_contains(cur, "energy_allocation_guard", "FOR UPDATE")


MIGRATION_OBJECT_PROBES: dict[str, Callable[[Cursor], bool]] = {
    "000": _probe_000,
    "001": _probe_001,
    "002": _probe_002,
    "003": _probe_003,
    "004": _probe_004,
    "005": _probe_005,
    "006": _probe_006,
    "007": _probe_007,
    "008": _probe_008,
    "008b": _probe_008b,
    "009": _probe_009,
    "010": _probe_010,
    "011": _probe_011,
    "012": _probe_012,
    "013": _probe_013,
    "014": _probe_014,
    "015": _probe_015,
    "016": _probe_016,
    "017": _probe_017,
    "018": _probe_018,
    "019": _probe_019,
    "020": _probe_020,
    "021": _probe_021,
    "022": _probe_022,
    "023": _probe_023,
    "024": _probe_024,
    "025": _probe_025,
    "026": _probe_026,
    "027": _probe_027,
    "028": _probe_028,
    "029": _probe_029,
    "030": _probe_030,
    "031": _probe_031,
    "032": _probe_032,
    "033": _probe_033,
    "034": _probe_034,
    "035": _probe_035,
}


def verify_object(cur, version: str) -> bool:
    """True si les objets attendus de `version` sont vérifiés présents.

    Version absente du registre de sondes → False, jamais une supposition
    optimiste (une version inconnue ne peut pas être baselinée aveuglément).
    """
    probe = MIGRATION_OBJECT_PROBES.get(version)
    if probe is None:
        return False
    return probe(cur)
