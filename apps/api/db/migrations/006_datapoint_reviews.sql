-- Migration 006 — Workflow de validation des datapoints
-- Cycle : PROPOSED → IN_REVIEW → VALIDATED → FROZEN
--         └─→ REJECTED (retour à PROPOSED si ré-édité)
-- Idempotent : CREATE TABLE IF NOT EXISTS + DO $$ pour enum/index.

-- ──────────────────────────────────────────────────────────────────────────
-- Enum DatapointStatus (PostgreSQL enum natif)
-- ──────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'datapoint_status') THEN
    CREATE TYPE datapoint_status AS ENUM (
      'proposed',
      'in_review',
      'validated',
      'frozen',
      'rejected'
    );
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- Table datapoint_reviews — cycle de validation d'un fact_event
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS datapoint_reviews (
    id             BIGSERIAL    PRIMARY KEY,
    company_id     INTEGER      NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fact_code      TEXT         NOT NULL,           -- ex: CC.GES.SCOPE1
    fact_event_id  BIGINT       REFERENCES facts_events(id) ON DELETE SET NULL,
    status         datapoint_status NOT NULL DEFAULT 'proposed',
    proposed_by    INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    proposed_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    reviewed_by    INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at    TIMESTAMPTZ,
    frozen_by      INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    frozen_at      TIMESTAMPTZ,
    timeout_at     TIMESTAMPTZ,                     -- deadline auto-promote à in_review (2h après propose)
    comment        TEXT,
    reject_reason  TEXT,
    meta           JSONB,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_company_code     ON datapoint_reviews(company_id, fact_code);
CREATE INDEX IF NOT EXISTS idx_reviews_status           ON datapoint_reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_fact_event       ON datapoint_reviews(fact_event_id);
CREATE INDEX IF NOT EXISTS idx_reviews_timeout          ON datapoint_reviews(timeout_at) WHERE status = 'proposed';

-- Une seule review "active" (non frozen/rejected) par (company_id, fact_code) — simplifie la query "latest status".
-- Plusieurs reviews historiques autorisées (une par workflow iteration).
-- Pas de contrainte unique stricte ici — géré applicativement dans review_service.
