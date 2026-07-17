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
