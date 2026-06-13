-- Migration 011 — Double authentification TOTP (T1.4).
-- Secret chiffré (Fernet) + codes de récupération hashés. Clé sur l'email.

CREATE TABLE IF NOT EXISTS user_totp (
    user_email        TEXT        PRIMARY KEY,
    company_id        INTEGER     REFERENCES companies(id) ON DELETE CASCADE,
    secret_encrypted  TEXT        NOT NULL,
    enabled_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_recovery_codes (
    id          SERIAL      PRIMARY KEY,
    user_email  TEXT        NOT NULL,
    code_hash   TEXT        NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recovery_email ON user_recovery_codes(user_email);

-- Politique 2FA par organisation : optional (défaut) | admin_required | all_required
ALTER TABLE companies ADD COLUMN IF NOT EXISTS totp_policy TEXT NOT NULL DEFAULT 'optional';

-- Étend la contrainte audit_eventtype_check pour les événements 2FA.
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_eventtype_check;
ALTER TABLE audit_events ADD CONSTRAINT audit_eventtype_check CHECK (event_type IN (
    'ingest','upload','cache_clear','login','export','validation','error',
    '2fa_enroll','2fa_success','2fa_fail','2fa_recovery'
));
