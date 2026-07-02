-- Migration 025 — Double matérialité durcie (T7.4).
--
-- materialite_assessments : évaluations de matérialité ARCHIVÉES (une par
-- exercice/révision). Immuables : positions + résultat scoré snapshotés en
-- JSONB au moment du gel — l'archive reste lisible même si la formule ou les
-- presets évoluent. Exportables en ZIP auditable (domaine 'materialite' dans
-- export_packages → /verify).
--
-- materialite_positions.justification : justification par enjeu (attendue par
-- l'auditeur pour documenter le positionnement des enjeux matériels).

ALTER TABLE materialite_positions ADD COLUMN IF NOT EXISTS justification TEXT;

CREATE TABLE IF NOT EXISTS materialite_assessments (
    id          BIGSERIAL PRIMARY KEY,
    company_id  INTEGER NOT NULL,
    label       TEXT NOT NULL,
    sector      TEXT,
    threshold   NUMERIC(4, 2) NOT NULL,
    positions   JSONB NOT NULL,
    result      JSONB NOT NULL,
    created_by  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_materialite_assessments_company
    ON materialite_assessments(company_id, created_at DESC);

ALTER TABLE materialite_assessments ENABLE ROW LEVEL SECURITY;

-- Pas de policy UPDATE : les évaluations archivées sont immuables par design.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='materialite_assessments' AND policyname='tenant_isolation_mat_assessments') THEN
    CREATE POLICY tenant_isolation_mat_assessments ON materialite_assessments
      USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='materialite_assessments' AND policyname='tenant_isolation_mat_assessments_ins') THEN
    CREATE POLICY tenant_isolation_mat_assessments_ins ON materialite_assessments
      FOR INSERT WITH CHECK (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
END $$;
