"""
test_migration_ledger.py — bootstrap, baseline, verify, mark_manual_verified,
verrou advisory (PR-02B). DB-gated.

CI-compatible : skip si `DATABASE_URL` absent, comme `test_rls_isolation.py`.
Jamais contre Neon. Non exécuté localement pendant cette implémentation (pas
de `docker` disponible dans ce shell) — à surveiller sur le premier run CI
(voir PR02B_IMPLEMENTATION_PLAN.md §9/§10).
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from db.migration_runner import MigrationLockError, MigrationRunner

from ._migration_fixtures import (
    apply_ddl_inline,
    apply_upto,
    build_full_db,
    reset_public_schema,
)


def _runner_with_synthetic_migration(tmp_path, filename, sql):
    """MigrationRunner pointé vers un dossier temporaire contenant UNE migration
    synthétique, pour tester `apply` en isolation totale du vrai dossier
    `migrations/` (ses 32 fichiers réels 001-031 sont hors de portée de ce
    runner — `migrations_dir=tmp_path`). Le numéro « 028 » utilisé ici est
    arbitraire et sans lien avec le vrai `028_evidence_kernel.sql` (dossier
    différent) ; `get_meta("028").requires_owner` reste False, donc l'action
    calculée est bien `apply`. Connexion = get_db (le service postgres:16 en CI)."""
    (tmp_path / filename).write_text(sql, encoding="utf-8")
    return MigrationRunner(migrations_dir=tmp_path, connection_factory=get_db)

pytestmark = [
    pytest.mark.skipif(
        not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
    ),
    pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible"),
]


@pytest.fixture()
def empty_conn():
    with get_db() as conn:
        reset_public_schema(conn)
        yield conn


@pytest.fixture()
def runner():
    return MigrationRunner()


# ── Bootstrap ─────────────────────────────────────────────────────────────


def test_bootstrap_creates_ledger_table(empty_conn, runner):
    with empty_conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.schema_migrations') AS t")
        assert cur.fetchone()["t"] is None, "précondition : la table ne doit pas encore exister"
    runner._ensure_ledger_table(empty_conn)
    with empty_conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.schema_migrations') AS t")
        assert cur.fetchone()["t"] is not None


def test_bootstrap_is_idempotent(empty_conn, runner):
    runner._ensure_ledger_table(empty_conn)
    runner._ensure_ledger_table(empty_conn)  # 2e appel — ne doit pas lever
    with empty_conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.schema_migrations') AS t")
        assert cur.fetchone()["t"] is not None


def test_plan_and_load_records_never_create_the_table(empty_conn, runner):
    """Invariant PR-02A, revalidé contre un vrai Postgres (pas seulement mocké)."""
    assert runner.load_records() == {}
    with empty_conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.schema_migrations') AS t")
        assert cur.fetchone()["t"] is None, "load_records() ne doit jamais créer la table"


# ── Baseline — 3 fixtures ─────────────────────────────────────────────────


def test_baseline_dry_run_on_empty_db(empty_conn, runner):
    """Base neuve : 000 encore pending (rien appliqué), 001-026+008b+009 pending,
    027 (requires_owner) -> manual_required. Rien n'est écrit (dry_run)."""
    result = runner.baseline(dry_run=True)
    assert result.dry_run is True
    assert result.written_count == 0

    actions = {i.file.version: i.action for i in result.items}
    assert actions["000"] == "still_pending"
    assert actions["001"] == "still_pending"
    assert actions["027"] == "manual_required"
    assert actions["036"] == "manual_required"  # requires_owner (PR-08A), comme 027

    with empty_conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.schema_migrations') AS t")
        assert cur.fetchone()["t"] is None, "dry_run ne doit jamais bootstrapper la table"


def test_baseline_commit_on_empty_db_writes_only_manual_required(empty_conn, runner):
    result = runner.baseline(dry_run=False)
    # DEUX versions requires_owner depuis PR-08A : 027 (ALTER TABLE actions)
    # ET 036 (ALTER TABLE sites). Seules elles sont écrites (manual_required) ;
    # tout le reste demeure still_pending, donc aucune ligne.
    assert result.written_count == 2

    records = runner.load_records()
    assert records["027"].status == "manual_required"
    assert records["027"].requires_owner is True
    assert records["036"].status == "manual_required"
    assert records["036"].requires_owner is True
    assert "001" not in records  # still_pending -> aucune ligne écrite


def test_baseline_on_partial_db(empty_conn, runner):
    """001-020 appliquées (via DDL inline + fichiers) : baseline pour ces versions,
    021-026+009 encore pending, 027 manual_required."""
    apply_ddl_inline(empty_conn)
    apply_upto(empty_conn, "020")

    result = runner.baseline(dry_run=True)
    actions = {i.file.version: i.action for i in result.items}
    assert actions["000"] == "baseline"
    assert actions["001"] == "baseline"
    assert actions["020"] == "baseline"
    assert actions["021"] == "still_pending"
    assert actions["027"] == "manual_required"
    assert actions["036"] == "manual_required"


def test_baseline_on_full_db_marks_004_and_009_both_baseline(empty_conn, runner):
    """L'état réel de prod (D-3) : 004 ET 009 doivent toutes deux devenir `baseline`,
    pas seulement l'une des deux."""
    build_full_db(empty_conn)

    result = runner.baseline(dry_run=False)
    actions = {i.file.version: i.action for i in result.items}
    assert actions["004"] == "baseline"
    assert actions["009"] == "baseline"
    assert actions["027"] == "baseline"  # objets vérifiés présents -> baseline, pas manual_required
    assert actions["036"] == "baseline"  # idem : requires_owner n'empêche jamais un baseline vérifié
    assert all(a == "baseline" for a in actions.values())
    assert result.written_count == 39  # 000 + 38 fichiers (001-037 dont 008b)

    records = runner.load_records()
    assert records["004"].requires_owner is False
    assert records["009"].requires_owner is False
    assert records["027"].requires_owner is True  # historisé depuis le manifeste, même si baseline
    assert records["036"].requires_owner is True


def test_baseline_never_rewrites_existing_row(empty_conn, runner):
    """Contrainte #1 : une version déjà dans le ledger n'est jamais réécrite."""
    build_full_db(empty_conn)
    runner.baseline(dry_run=False)
    first_pass_records = runner.load_records()

    result = runner.baseline(dry_run=False)  # 2e appel
    assert result.written_count == 0
    assert all(i.action == "already_recorded" for i in result.items)

    second_pass_records = runner.load_records()
    assert first_pass_records["027"].applied_at == second_pass_records["027"].applied_at


# ── Hotfix 2026-07-17 : rollback propre + cause racine + reprise ─────────
#
# Le workflow DB Migrate a échoué sur `baseline --commit` en production avec
# « current transaction is aborted, commands ignored until end of transaction
# block » — un symptôme secondaire qui masquait la vraie erreur PostgreSQL
# d'origine. `verify_migration_objects` est mocké pour simuler une VRAIE
# erreur (pas un simple objects_present=False) sur une version précise, sans
# dépendre d'un état Postgres exotique difficile à reproduire.


def test_baseline_commit_rolls_back_and_reports_root_cause_on_probe_error(
    empty_conn, runner, monkeypatch
):
    """Une vraie erreur PostgreSQL sur UNE version : rollback immédiat, cause
    racine visible dans le message (pas « transaction aborted »), aucune ligne
    écrite pour la version en échec — mais les versions traitées AVANT restent
    committées individuellement."""
    from db.migration_runner import MigrationError

    build_full_db(empty_conn)
    original = MigrationRunner.verify_migration_objects

    def _boom(self, conn, version):
        if version == "015":
            raise Exception("colonne inexistante simulée (cause racine de test)")
        return original(self, conn, version)

    monkeypatch.setattr(MigrationRunner, "verify_migration_objects", _boom)

    with pytest.raises(MigrationError) as exc_info:
        runner.baseline(dry_run=False)

    message = str(exc_info.value)
    assert "015" in message
    assert "colonne inexistante simulée" in message, (
        "la cause racine réelle doit être visible dans le message, pas masquée"
    )
    assert "current transaction is aborted" not in message, (
        "le symptôme secondaire ne doit jamais remplacer la vraie erreur"
    )

    records = runner.load_records()
    assert records["000"].status == "baseline"  # traitée avant 015 -> committée
    assert records["014"].status == "baseline"  # idem
    assert "015" not in records, "aucune ligne partielle pour la version en échec"
    assert "016" not in records, "le traitement s'arrête net, rien après l'échec"


def test_baseline_commit_is_retryable_after_a_failed_attempt(empty_conn, runner, monkeypatch):
    """Après correction de la cause (ici : simulation levée une seule fois),
    un nouveau `baseline --commit` reprend proprement — les versions déjà
    committées lors de la tentative précédente ressortent `already_recorded`,
    jamais réécrites ; celle qui avait échoué est maintenant traitée."""
    from db.migration_runner import MigrationError

    build_full_db(empty_conn)
    original = MigrationRunner.verify_migration_objects

    def _boom_once(self, conn, version):
        if version == "015":
            raise Exception("panne simulée transitoire")
        return original(self, conn, version)

    monkeypatch.setattr(MigrationRunner, "verify_migration_objects", _boom_once)
    with pytest.raises(MigrationError):
        runner.baseline(dry_run=False)
    monkeypatch.undo()  # la "panne" est résolue avant la nouvelle tentative

    result = runner.baseline(dry_run=False)
    actions = {i.file.version: i.action for i in result.items}
    assert actions["000"] == "already_recorded"
    assert actions["014"] == "already_recorded"
    assert actions["015"] == "baseline", "cette fois, plus d'erreur -> traitée normalement"
    assert actions["027"] == "baseline"

    assert runner.verify() == [], "le ledger final doit être entièrement sain"


def test_baseline_supports_ledger_table_already_created_but_empty(empty_conn, runner):
    """`schema_migrations` déjà créée (par un run précédent interrompu tôt) mais
    sans aucune ligne : baseline() doit repartir normalement, pas échouer sur
    une table qui existe déjà."""
    build_full_db(empty_conn)
    runner._ensure_ledger_table(empty_conn)
    empty_conn.commit()
    assert runner.load_records() == {}, "précondition : table présente, aucune ligne"

    result = runner.baseline(dry_run=False)
    assert result.written_count == 39  # 000 + 38 fichiers (001-037 dont 008b)
    assert all(i.action == "baseline" for i in result.items)
    assert runner.verify() == []


# ── Hotfix 2026-07-17 (suite) : le bootstrap/lecture initiale aussi protégés ──
#
# Le premier correctif ne protégeait que la boucle par fichier. En production
# (run #6, après merge du premier correctif), le MÊME symptôme masqué s'est
# reproduit : `_ensure_ledger_table`/`_read_records` n'étaient pas entourés du
# même rollback+erreur explicite, et une exception non rattrapée là remontait
# jusqu'au `finally` de `acquire_lock()`, où `pg_advisory_unlock` échouait à
# son tour sur la transaction abortée — remplaçant l'exception d'origine par
# « current transaction is aborted » une seconde fois, ailleurs dans le code.


def test_baseline_commit_rolls_back_and_reports_root_cause_when_initial_read_fails(
    empty_conn, runner, monkeypatch
):
    """Erreur simulée dans `_read_records` (appelée par baseline() juste après
    le bootstrap) : rollback propre, cause racine visible, jamais « transaction
    aborted ». Le bootstrap lui-même (committé AVANT cet échec) reste
    idempotent — un nouveau baseline() fonctionne normalement ensuite."""
    from db.migration_runner import MigrationError

    build_full_db(empty_conn)

    def _boom(self, conn):
        raise Exception("lecture du ledger impossible (cause racine de test)")

    monkeypatch.setattr(MigrationRunner, "_read_records", _boom)

    with pytest.raises(MigrationError) as exc_info:
        runner.baseline(dry_run=False)

    message = str(exc_info.value)
    assert "lecture du ledger impossible" in message, (
        "la cause racine réelle doit être visible, pas masquée"
    )
    assert "current transaction is aborted" not in message

    monkeypatch.undo()  # la "panne" est résolue

    with empty_conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.schema_migrations') AS t")
        assert cur.fetchone()["t"] is not None, (
            "le bootstrap, committé avant l'échec de lecture, doit rester persisté (idempotence)"
        )

    result = runner.baseline(dry_run=False)  # nouvelle tentative, "panne" résolue
    assert result.written_count == 39  # 000 + 38 fichiers (001-037 dont 008b)
    assert runner.verify() == []


def test_acquire_lock_finally_does_not_mask_the_original_exception(runner):
    """Régression directe du bug (indépendante de baseline()) : si le corps du
    `with acquire_lock` laisse la transaction abortée (aucun rollback) puis
    relève une erreur, le `finally` (`pg_advisory_unlock`) ne doit JAMAIS
    remplacer cette erreur par « current transaction is aborted » — sans la
    protection best-effort, `pg_advisory_unlock` échouerait à son tour et
    masquerait l'erreur d'origine (ValueError) derrière l'erreur psycopg2."""
    with get_db() as conn:
        with pytest.raises(ValueError, match="erreur du corps, pas de la connexion"):
            with runner.acquire_lock(conn):
                try:
                    with conn.cursor() as cur:
                        cur.execute("SELECT * FROM une_table_totalement_inexistante_xyz")
                except Exception:
                    pass  # transaction volontairement laissée abortée (pas de rollback)
                raise ValueError("erreur du corps, pas de la connexion")


# ── verify() — checksum_mismatch et drift_detected ───────────────────────


def test_verify_clean_after_baseline(empty_conn, runner):
    build_full_db(empty_conn)
    runner.baseline(dry_run=False)
    assert runner.verify() == []


def test_verify_detects_checksum_mismatch(empty_conn, runner, monkeypatch, tmp_path):
    """Un fichier modifié après coup doit être signalé, jamais réappliqué silencieusement."""
    apply_ddl_inline(empty_conn)
    apply_upto(empty_conn, "001")
    runner.baseline(dry_run=False)

    real_path = runner.migrations_dir / "001_emission_factors.sql"
    original = real_path.read_bytes()
    try:
        real_path.write_bytes(original + b"\n-- octet ajoute apres coup\n")
        anomalies = runner.verify()
        assert any("001" in a and "checksum_mismatch" in a for a in anomalies)
    finally:
        real_path.write_bytes(original)  # restaurer, ne jamais laisser le repo modifié


def test_verify_detects_drift_when_object_dropped(empty_conn, runner):
    """Ligne `baseline` mais objet supprimé après coup — jamais réappliqué automatiquement.

    Le DROP doit être commité : `verify()` ouvre sa propre connexion (comme
    `baseline()`), donc un DROP non commité sur `empty_conn` reste invisible
    (isolation READ COMMITTED) — même cause que le correctif précédent sur
    `_migration_fixtures.py`, ici dans le corps du test lui-même.
    """
    apply_ddl_inline(empty_conn)
    apply_upto(empty_conn, "001")
    runner.baseline(dry_run=False)

    with empty_conn.cursor() as cur:
        cur.execute("DROP TABLE emission_factors")
    empty_conn.commit()

    anomalies = runner.verify()
    assert any("001" in a and "drift_detected" in a for a in anomalies)


def test_verify_returns_empty_when_ledger_not_bootstrapped(empty_conn, runner):
    assert runner.verify() == []


# ── mark_manual_verified ─────────────────────────────────────────────────


def test_mark_manual_verified_requires_applied_by_and_proof(runner):
    with pytest.raises(ValueError):
        runner.mark_manual_verified("027", applied_by="", proof="capture.png")
    with pytest.raises(ValueError):
        runner.mark_manual_verified("027", applied_by="ludo", proof="")


def test_mark_manual_verified_unknown_version_raises(runner):
    with pytest.raises(KeyError):
        runner.mark_manual_verified("999", applied_by="ludo", proof="preuve")


def test_mark_manual_verified_refuses_without_verified_objects(empty_conn, runner):
    """Défense en profondeur (§8) : une preuve textuelle ne suffit pas si les objets
    ne sont réellement pas là."""
    from db.migration_runner import MigrationError

    with pytest.raises(MigrationError):
        runner.mark_manual_verified(
            "027", applied_by="ludo", proof="je jure que je l'ai fait (mais non)"
        )


def test_mark_manual_verified_transitions_to_baseline_with_proof(empty_conn, runner):
    apply_ddl_inline(empty_conn)
    apply_upto(empty_conn, "027")  # 027 réellement appliquée

    record = runner.mark_manual_verified(
        "027", applied_by="ludo@neon-sql-editor", proof="SELECT to_regclass('public.sites') -> non-null"
    )
    assert record.status == "baseline"
    assert record.applied_by == "ludo@neon-sql-editor"

    records = runner.load_records()
    assert records["027"].status == "baseline"
    assert records["027"].metadata.get("proof")


def test_mark_manual_verified_refuses_to_rewrite_existing_row(empty_conn, runner):
    build_full_db(empty_conn)
    runner.baseline(dry_run=False)  # 027 déjà baseline

    with pytest.raises(ValueError):
        runner.mark_manual_verified("027", applied_by="ludo", proof="preuve")


def test_mark_manual_verified_transitions_manual_required_to_baseline(empty_conn, runner):
    """Scénario réel de la commande (revue Codex, corrigé 2026-07-17) :

    1. `baseline --commit` écrit une ligne `manual_required` pour 027 (requires_owner,
       objets absents).
    2. L'opérateur applique manuellement le SQL (ici : simulé via `apply_upto`).
    3. `mark-manual-verified` vérifie les objets, désormais présents.
    4. La ligne EXISTANTE passe de `manual_required` à `baseline` — la version
       précédente refusait cette transition (toute version déjà présente dans
       le ledger était rejetée sans distinction de statut).
    """
    apply_ddl_inline(empty_conn)
    apply_upto(empty_conn, "026")  # tout sauf 027

    baseline_result = runner.baseline(dry_run=False)
    actions = {i.file.version: i.action for i in baseline_result.items}
    assert actions["027"] == "manual_required"
    assert runner.load_records()["027"].status == "manual_required"

    apply_upto(empty_conn, "027")  # l'opérateur applique 027 manuellement

    record = runner.mark_manual_verified(
        "027", applied_by="ludo@neon-sql-editor",
        proof="SELECT to_regclass('public.sites') -> non-null, colonne actions.site_id confirmée",
    )
    assert record.status == "baseline"
    assert record.applied_by == "ludo@neon-sql-editor"

    records = runner.load_records()
    assert records["027"].status == "baseline"
    assert records["027"].applied_by == "ludo@neon-sql-editor"
    assert records["027"].metadata.get("proof")


# ── acquire_lock — concurrence simplifiée (2 connexions) ─────────────────


def test_acquire_lock_blocks_a_second_connection(runner):
    with get_db() as conn_a, get_db() as conn_b:
        with runner.acquire_lock(conn_a, timeout_s=1.0, retry_interval_s=0.2):
            with pytest.raises(MigrationLockError):
                with runner.acquire_lock(conn_b, timeout_s=1.0, retry_interval_s=0.2):
                    pass  # ne doit jamais être atteint


def test_acquire_lock_released_after_context_exit(runner):
    with get_db() as conn_a:
        with runner.acquire_lock(conn_a, timeout_s=1.0, retry_interval_s=0.2):
            pass
    with get_db() as conn_b:
        # Le verrou de conn_a a été libéré à la sortie du `with` -> conn_b l'obtient sans attendre.
        with runner.acquire_lock(conn_b, timeout_s=1.0, retry_interval_s=0.2):
            pass


# ── /health/schema — up_to_date et status='failed' ───────────────────────


def test_schema_probe_not_up_to_date_when_a_version_has_failed(empty_conn, runner):
    """Revue Codex (routers/health.py) : une ligne `failed` doit rendre
    `up_to_date=false`, pas seulement `pending_count==0 and manual_required_count==0`.

    La version précédente ne comptait `failed` ni dans `pending` (la ligne
    existe) ni dans `manual_required` — un schéma avec une migration
    réellement échouée aurait donc été rapporté `up_to_date: true`, un signal
    de monitoring trompeur.
    """
    from routers.health import _schema_probe

    build_full_db(empty_conn)
    runner.baseline(dry_run=False)
    assert runner.verify() == []
    assert _schema_probe()["up_to_date"] is True, "précondition : schéma sain -> up_to_date=true"

    with empty_conn.cursor() as cur:
        cur.execute(
            "UPDATE schema_migrations SET status = 'failed', error_message = %s WHERE version = %s",
            ("simulation de test", "001"),
        )
    empty_conn.commit()

    result = _schema_probe()
    assert result["up_to_date"] is False
    assert result["pending_count"] == 0
    assert result["manual_required_count"] == 0  # ni pending ni manual_required : uniquement failed


# ── CLI bout-en-bout ──────────────────────────────────────────────────────


def test_cli_end_to_end_status_verify_baseline_verify(empty_conn, runner):
    build_full_db(empty_conn)

    assert runner.verify() == []  # rien dans le ledger encore -> sain par définition

    dry = runner.baseline(dry_run=True)
    assert dry.written_count == 0

    committed = runner.baseline(dry_run=False)
    assert committed.written_count == 39  # 000 + 38 fichiers (001-037 dont 008b)
    assert runner.verify() == []


# ── PR-02C : apply_one / apply_plan (exécution réelle, migration 028 synthétique) ──


def test_apply_plan_executes_synthetic_migration(empty_conn, tmp_path):
    """apply_plan applique une migration 028+ absente du ledger : ligne `applied`
    écrite avec execution_ms, objet réellement créé."""
    runner = _runner_with_synthetic_migration(
        tmp_path, "028_apply_probe.sql",
        "CREATE TABLE apply_probe_028 (id INT PRIMARY KEY);\n",
    )
    applied = runner.apply_plan(applied_by="test")
    assert [r.version for r in applied] == ["028"]
    assert applied[0].status == "applied"
    assert applied[0].execution_ms is not None and applied[0].execution_ms >= 0

    records = runner.load_records()
    assert records["028"].status == "applied"
    assert records["028"].applied_by == "test"

    with empty_conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.apply_probe_028') AS t")
        assert cur.fetchone()["t"] is not None, "l'objet de la migration doit exister réellement"


def test_apply_plan_is_noop_second_time(empty_conn, tmp_path):
    """Rejouer apply_plan après application : la migration est `skip` (déjà applied), rien de neuf."""
    runner = _runner_with_synthetic_migration(
        tmp_path, "028_apply_probe.sql", "CREATE TABLE apply_probe_028 (id INT);\n"
    )
    runner.apply_plan(applied_by="test")
    second = runner.apply_plan(applied_by="test")
    assert second == []


def test_apply_one_failure_records_failed_and_raises(empty_conn, tmp_path):
    """SQL invalide : ROLLBACK, ligne `failed` + error_message (I5), exception propagée
    (jamais avalée), migration jamais marquée `applied`."""
    runner = _runner_with_synthetic_migration(
        tmp_path, "028_broken.sql", "CREATE TABLE oops (id INT) THIS IS INVALID SQL;\n"
    )
    with pytest.raises(Exception):
        runner.apply_plan(applied_by="test")

    records = runner.load_records()
    assert records["028"].status == "failed"
    assert records["028"].error_message
    assert records["028"].applied_at is None or records["028"].status == "failed"


def test_apply_plan_blocks_requires_owner_without_executing(empty_conn, tmp_path):
    """Une migration requires_owner (ex. 027) dans le plan bloque apply (I4) — jamais exécutée."""
    from db.migration_runner import ManualMigrationRequired

    runner = _runner_with_synthetic_migration(
        tmp_path, "027_owner.sql", "CREATE TABLE should_not_exist_027 (id INT);\n"
    )
    with pytest.raises(ManualMigrationRequired):
        runner.apply_plan(applied_by="test")

    with empty_conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.should_not_exist_027') AS t")
        assert cur.fetchone()["t"] is None, "la migration requires_owner ne doit jamais être exécutée"
