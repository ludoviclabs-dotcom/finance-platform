-- Migration 044 — Durcissement de l'authentification (rapport QA du 16/09/2026).
--
-- 1. Anti-rejeu TOTP (RFC 6238 §5.2 : un code accepté ne doit pas l'être une
--    seconde fois). Table NEUVE user_totp_used_steps, clé primaire
--    (user_email, time_step) : deux requêtes concurrentes présentant le même
--    code ne peuvent pas réussir toutes les deux
--    (services/totp_service.py::_claim_step, INSERT … ON CONFLICT DO NOTHING).
--    Même portée que user_totp (011) : clé sur l'e-mail, lue avant toute
--    session (étape pré-auth), aucune donnée métier ni de tenant — pas de RLS,
--    comme user_totp et user_recovery_codes. Purge applicative des pas hors
--    fenêtre à chaque vérification.
--
-- 2. Journal d'audit : littéraux '2fa_disable' (désactivation de la 2FA,
--    auparavant journalisée à tort sous '2fa_fail'), 'admin_user_change' et
--    'admin_company_change' (gestes d'administration, désormais tracés).
--    Même geste DROP+ADD sous le même nom que 011/012/040/041. Tant que cette
--    migration n'est pas appliquée, services/audit_service.py réécrit ces
--    événements sous le type historique le plus proche (type réel dans meta).
--
-- Aucune donnée existante modifiée, aucune table existante altérée hormis la
-- contrainte CHECK d'audit_events (geste déjà pratiqué par 041 sans privilège
-- propriétaire).

CREATE TABLE IF NOT EXISTS user_totp_used_steps (
    user_email  TEXT        NOT NULL,
    time_step   BIGINT      NOT NULL,
    used_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_email, time_step)
);

CREATE INDEX IF NOT EXISTS idx_user_totp_used_steps_used_at
    ON user_totp_used_steps (used_at);

ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_eventtype_check;
ALTER TABLE audit_events ADD CONSTRAINT audit_eventtype_check CHECK (event_type IN (
    'ingest','upload','cache_clear','login','export','validation','error',
    '2fa_enroll','2fa_success','2fa_fail','2fa_recovery',
    'auditor_invite','auditor_access','materiality_decision','ai_review_decision',
    '2fa_disable','admin_user_change','admin_company_change'
));

-- Accès applicatif — même geste que 028/040/041 : GRANT conditionnel à
-- carbonco_app si le rôle existe (no-op en dev/CI sans ce rôle).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carbonco_app') THEN
    GRANT SELECT, INSERT, DELETE ON user_totp_used_steps TO carbonco_app;
  END IF;
END $$;
