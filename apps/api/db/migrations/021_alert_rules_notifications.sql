-- Migration 021 — Alertes stabilisées (T5.3).
--
-- alert_rules : règles d'évaluation sur snapshot (seuil absolu, variation % vs
-- N-1, donnée manquante). alert_notifications : centre de notifications in-app
-- persisté (chaque déclenchement = une notification, lue/archivée par l'utilisateur).
-- L'e-mail est OPTIONNEL (flag EMAIL_ENABLED, SMTP stdlib) — aucune dépendance
-- payante. Par-organisation → RLS (pattern 008b).

CREATE TABLE IF NOT EXISTS alert_rules (
    id            BIGSERIAL PRIMARY KEY,
    company_id    INTEGER NOT NULL,
    name          TEXT NOT NULL,
    domain        TEXT NOT NULL,
    field_path    TEXT NOT NULL,
    operator      TEXT NOT NULL,
    threshold     NUMERIC,
    mode          TEXT NOT NULL DEFAULT 'absolute',
    channel       TEXT NOT NULL DEFAULT 'inapp',
    destination   TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    last_fired_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT alert_rule_mode_check CHECK (mode IN ('absolute', 'delta_pct', 'missing'))
);

-- alert_rules existe déjà via le DDL inline historique (db/migrations.py), exécuté
-- AVANT les fichiers .sql → le CREATE ci-dessus est un no-op sur toute base. On met
-- donc à niveau explicitement le schéma legacy : colonne `mode`, nullabilité de
-- `threshold` (mode 'missing') et `destination` (canal in-app), + contrainte CHECK.
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'absolute';
ALTER TABLE alert_rules ALTER COLUMN threshold DROP NOT NULL;
ALTER TABLE alert_rules ALTER COLUMN destination DROP NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_rule_mode_check') THEN
    ALTER TABLE alert_rules ADD CONSTRAINT alert_rule_mode_check CHECK (mode IN ('absolute', 'delta_pct', 'missing'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS alert_notifications (
    id          BIGSERIAL PRIMARY KEY,
    company_id  INTEGER NOT NULL,
    rule_id     BIGINT,
    rule_name   TEXT,
    title       TEXT NOT NULL,
    body        TEXT,
    fired_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at     TIMESTAMPTZ,
    archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_company ON alert_rules(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_alert_notifs_company ON alert_notifications(company_id, archived_at, fired_at DESC);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_rules' AND policyname='tenant_isolation_alert_rules') THEN
    CREATE POLICY tenant_isolation_alert_rules ON alert_rules
      USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_rules' AND policyname='tenant_isolation_alert_rules_ins') THEN
    CREATE POLICY tenant_isolation_alert_rules_ins ON alert_rules
      FOR INSERT WITH CHECK (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_rules' AND policyname='tenant_isolation_alert_rules_upd') THEN
    CREATE POLICY tenant_isolation_alert_rules_upd ON alert_rules
      FOR UPDATE USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_notifications' AND policyname='tenant_isolation_alert_notifs') THEN
    CREATE POLICY tenant_isolation_alert_notifs ON alert_notifications
      USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_notifications' AND policyname='tenant_isolation_alert_notifs_ins') THEN
    CREATE POLICY tenant_isolation_alert_notifs_ins ON alert_notifications
      FOR INSERT WITH CHECK (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_notifications' AND policyname='tenant_isolation_alert_notifs_upd') THEN
    CREATE POLICY tenant_isolation_alert_notifs_upd ON alert_notifications
      FOR UPDATE USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
END $$;
