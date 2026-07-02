-- Migration 026 — Candidatures partenaires experts-comptables (T7.5).
--
-- partner_applications : candidatures au programme partenaire déposées depuis
-- la page publique /partenaires. Donnée de niveau PLATEFORME (pré-tenant, pas
-- de company_id) → pas de RLS ; la lecture est réservée au rôle admin côté API
-- (même traitement que la table companies). L'espace multi-dossiers cabinet
-- reste `planifie` au registre feature-status — cette table est la première
-- brique (pipeline de candidatures), pas l'espace lui-même.

CREATE TABLE IF NOT EXISTS partner_applications (
    id               BIGSERIAL PRIMARY KEY,
    cabinet_name     TEXT NOT NULL,
    siret            VARCHAR(14),
    contact_name     TEXT,
    email            TEXT NOT NULL,
    clients_estimate TEXT,
    message          TEXT,
    status           TEXT NOT NULL DEFAULT 'new',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT partner_application_status_check CHECK (status IN ('new', 'contacted', 'accepted', 'declined'))
);

CREATE INDEX IF NOT EXISTS idx_partner_applications_status
    ON partner_applications(status, created_at DESC);
