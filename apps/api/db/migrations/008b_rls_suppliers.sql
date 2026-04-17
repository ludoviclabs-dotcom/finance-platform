-- Migration 008b — Row Level Security pour les tables Phase 4 (fournisseurs, matérialité)
-- Dépend de 008_suppliers.sql (les 4 tables doivent déjà exister).
-- Idempotente : DO $$ IF NOT EXISTS $$ sur chaque policy.
--
-- Principe des policies :
--   NULLIF(current_setting('app.current_company_id', true), '')::int
--   → retourne NULL si la session n'a pas de contexte tenant (SET LOCAL non appelé)
--   → company_id = NULL → FALSE → aucune ligne visible (comportement sûr par défaut)
--
-- Exception publique : fonction resolve_supplier_token() SECURITY DEFINER
--   → bypasse RLS intentionnellement pour les endpoints /q/{token} (pas de JWT)

-- ──────────────────────────────────────────────────────────────────────────
-- suppliers
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'suppliers' AND policyname = 'tenant_isolation_suppliers'
  ) THEN
    CREATE POLICY tenant_isolation_suppliers ON suppliers
      USING (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::int
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'suppliers' AND policyname = 'tenant_isolation_suppliers_ins'
  ) THEN
    CREATE POLICY tenant_isolation_suppliers_ins ON suppliers
      FOR INSERT WITH CHECK (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::int
      );
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- supplier_questionnaire_tokens
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE supplier_questionnaire_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'supplier_questionnaire_tokens' AND policyname = 'tenant_isolation_sqt'
  ) THEN
    CREATE POLICY tenant_isolation_sqt ON supplier_questionnaire_tokens
      USING (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::int
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'supplier_questionnaire_tokens' AND policyname = 'tenant_isolation_sqt_ins'
  ) THEN
    CREATE POLICY tenant_isolation_sqt_ins ON supplier_questionnaire_tokens
      FOR INSERT WITH CHECK (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::int
      );
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- supplier_answers
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE supplier_answers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'supplier_answers' AND policyname = 'tenant_isolation_sa'
  ) THEN
    CREATE POLICY tenant_isolation_sa ON supplier_answers
      USING (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::int
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'supplier_answers' AND policyname = 'tenant_isolation_sa_ins'
  ) THEN
    CREATE POLICY tenant_isolation_sa_ins ON supplier_answers
      FOR INSERT WITH CHECK (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::int
      );
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- materialite_positions
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE materialite_positions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'materialite_positions' AND policyname = 'tenant_isolation_matpos'
  ) THEN
    CREATE POLICY tenant_isolation_matpos ON materialite_positions
      USING (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::int
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'materialite_positions' AND policyname = 'tenant_isolation_matpos_ins'
  ) THEN
    CREATE POLICY tenant_isolation_matpos_ins ON materialite_positions
      FOR INSERT WITH CHECK (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::int
      );
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER — résolution publique de token sans contexte tenant
-- ──────────────────────────────────────────────────────────────────────────
-- Pattern : les endpoints /q/{token} n'ont pas de JWT → pas de company_id
-- dans la session → RLS bloquerait la lecture du token.
-- Cette fonction tourne avec les droits de son owner (bypass RLS) et ne
-- retourne que les colonnes strictement nécessaires au formulaire public
-- (aucune donnée confidentielle métier exposée).

CREATE OR REPLACE FUNCTION public.resolve_supplier_token(p_token text)
RETURNS TABLE (
    id            int,
    supplier_id   int,
    company_id    int,
    token         text,
    campaign      text,
    expires_at    timestamptz,
    used_at       timestamptz,
    created_at    timestamptz,
    supplier_name text,
    company_name  text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        sqt.id,
        sqt.supplier_id,
        sqt.company_id,
        sqt.token,
        sqt.campaign,
        sqt.expires_at,
        sqt.used_at,
        sqt.created_at,
        s.name::text  AS supplier_name,
        c.name::text  AS company_name
    FROM supplier_questionnaire_tokens sqt
    JOIN suppliers  s ON s.id = sqt.supplier_id
    JOIN companies  c ON c.id = sqt.company_id
    WHERE sqt.token = p_token
    LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_supplier_token(text) IS
    'Résolution publique de token questionnaire — SECURITY DEFINER, bypasse RLS intentionnellement. '
    'Ne retourne que les champs nécessaires au formulaire public /q/{token} (pas de données confidentielles).';
