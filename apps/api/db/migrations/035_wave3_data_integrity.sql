-- Migration 035 — Wave 3 : durcissement intégrité achats & concurrence énergie.
--
-- Deux correctifs INDÉPENDANTS sur des tables déjà créées (030, 031) — AUCUNE
-- table neuve, aucune donnée métier migrée, aucun LLM, aucune source externe
-- ingérée. Ne touche ni 030 ni 031 : CHECK élargie + colonne neuve pour l'une,
-- CREATE OR REPLACE FUNCTION pour l'autre (mêmes noms, réémis ici).
--
-- ===========================================================================
-- A. purchase_lines (030) — statut 'ambiguous' + raison (PR-05A stabilisation)
-- ===========================================================================
--
-- `_auto_map` (services/procurement/purchase_import_service.py, PR-05A)
-- résolvait un product_code par `SELECT ... WHERE company_id AND product_code`
-- puis `fetchone()` SANS `ORDER BY`. L'unicité de `supplier_products` porte
-- sur `(company_id, supplier_id, product_code)` — PAS `(company_id,
-- product_code)` — donc plusieurs fournisseurs peuvent légitimement partager
-- un même code produit au sein d'un tenant : le premier résultat renvoyé par
-- PostgreSQL (ordre non garanti sans ORDER BY) déterminait alors le
-- fournisseur retenu. Rattachement arbitraire, déjà observé en CI (commit
-- d857eda : contourné par isolation de test à l'époque, la cause n'était pas
-- corrigée — son message recommandait déjà « laisser la ligne non mappée
-- quand le code est ambigu, plutôt qu'en devinant »).
--
-- Corrigé côté service : `_auto_map` ne sélectionne plus jamais par ordre SQL
-- ou premier résultat — un product_code multi-candidats est désormais détecté
-- et surfacé (`ambiguous`), jamais résolu en silence. Cette migration ajoute
-- UNIQUEMENT ce que ce nouveau statut exige EN BASE :
--
--   1. `purchase_lines_mapping_status_check` élargie pour accepter 'ambiguous'
--      — même geste que `audit_eventtype_check`, réutilisé (DROP + ADD sous le
--      même nom) par 011 puis 012.
--   2. Colonne `mapping_note` (raison lisible + candidats), sur le même
--      principe que `fallback_reason` (procurement_line_results, 032) :
--      « aucun statut ambigu sans dire pourquoi », imposé EN BASE par une
--      contrainte CHECK dédiée, pas seulement par convention applicative.
--
-- ===========================================================================
-- B. instrument_allocations (031) — verrouillage anti-survente concurrente (PR-06A)
-- ===========================================================================
--
-- `energy_allocation_guard()` lit `volume_mwh` de l'instrument puis la somme
-- déjà allouée SANS verrouiller la ligne `contractual_instruments`
-- correspondante. Sous READ COMMITTED, deux transactions concurrentes
-- allouant au MÊME instrument peuvent toutes deux lire la même somme AVANT
-- que l'une ou l'autre ne committe, passer toutes les deux le contrôle, et
-- ensemble survendre l'instrument (TOCTOU). Trou déjà documenté (non corrigé,
-- explicitement hors périmètre à l'époque) au §6 point 4 de
-- docs/carbonco/refonte/ENERGY_RLS_NON_SUPERUSER_HARDENING.md :
-- « Pas de test de concurrence. [...] Un SELECT ... FOR UPDATE sur
-- l'instrument [...] serait la réponse — hors périmètre (ce serait un
-- changement de schéma). »
--
-- Corrigé en verrouillant la ligne instrument via `SELECT ... FOR UPDATE`
-- AVANT de calculer la somme déjà allouée — la seconde transaction concurrente
-- sur le MÊME instrument BLOQUE jusqu'au commit/rollback de la première, puis
-- relit une somme à jour (READ COMMITTED : une nouvelle lecture après
-- déblocage voit les données committées). Les allocations sur des instruments
-- DIFFÉRENTS restent totalement concurrentes (verrou par LIGNE, pas par
-- table) — prouvé par test (deux instruments distincts, aucun blocage croisé).
--
-- Ni l'un ni l'autre correctif ne crée de table neuve — pas de privilège
-- propriétaire requis (comme 028/030/031/032/033/034).

-- ---------------------------------------------------------------------------
-- A.1 — mapping_status : élargie pour accepter 'ambiguous'.
-- ---------------------------------------------------------------------------
ALTER TABLE purchase_lines DROP CONSTRAINT IF EXISTS purchase_lines_mapping_status_check;
ALTER TABLE purchase_lines ADD CONSTRAINT purchase_lines_mapping_status_check CHECK (
    mapping_status IN ('unmapped', 'mapped', 'needs_review', 'resolved', 'ambiguous')
);

-- ---------------------------------------------------------------------------
-- A.2 — mapping_note : raison lisible (candidats + explication), obligatoire
-- dès que mapping_status = 'ambiguous' — jamais d'ambiguïté silencieuse.
-- ---------------------------------------------------------------------------
ALTER TABLE purchase_lines ADD COLUMN IF NOT EXISTS mapping_note TEXT;

ALTER TABLE purchase_lines DROP CONSTRAINT IF EXISTS purchase_lines_mapping_note_check;
ALTER TABLE purchase_lines ADD CONSTRAINT purchase_lines_mapping_note_check CHECK (
    mapping_status <> 'ambiguous' OR (mapping_note IS NOT NULL AND length(btrim(mapping_note)) > 0)
);

-- ---------------------------------------------------------------------------
-- B — energy_allocation_guard() : verrouillage FOR UPDATE de l'instrument
-- AVANT le calcul de la somme allouée (TOCTOU corrigé). CREATE OR REPLACE
-- réutilise le nom de fonction posé par 031 ; le trigger 031
-- (`trg_instrument_allocations_guard ... EXECUTE FUNCTION
-- energy_allocation_guard()`) la référence par NOM et n'aurait donc pas
-- besoin d'être recréé pour que le correctif s'applique — on le réémet quand
-- même explicitement (DROP + CREATE) pour que ce fichier reste lisible et
-- complet par lui-même, sans dépendre implicitement du contenu de 031.
--
-- INVARIANT ANTI-DEADLOCK (à préserver si cette fonction est étendue un jour) :
-- chaque invocation du trigger verrouille EXACTEMENT UNE ligne
-- contractual_instruments (NEW.instrument_id), et un seul INSERT dans
-- instrument_allocations ne concerne jamais qu'UN SEUL instrument — il n'y a
-- donc aucune acquisition de verrous multi-lignes ni multi-ordres DANS ce
-- trigger qui pourrait se deadlocker contre lui-même (deux transactions
-- allouant respectivement à A puis B et à B puis A, chacune en DEUX INSERT
-- séparés, ne se verrouillent jamais mutuellement PAR CE TRIGGER : chaque
-- INSERT est sa propre invocation, avec son propre verrou sur sa propre
-- ligne, acquis puis libéré — au pire l'un attend l'autre, jamais un cycle).
-- Ne resterait vrai que si une future extension continue de verrouiller une
-- seule ligne par invocation ; verrouiller PLUSIEURS lignes dans une même
-- invocation réintroduirait un risque de deadlock si l'ordre d'acquisition
-- n'était pas garanti identique entre transactions concurrentes.
--
-- SECURITY DEFINER — précision (établie par la RLS hardening PR #107, cf.
-- docs/carbonco/refonte/ENERGY_RLS_NON_SUPERUSER_HARDENING.md) : SECURITY
-- DEFINER NE contourne PAS FORCE ROW LEVEL SECURITY (seul un superuser ou un
-- rôle BYPASSRLS le ferait). Le trigger fonctionne car get_db(company_id=X)
-- pose SET LOCAL app.current_company_id = X et la policy RLS le relaie ; un
-- instrument et ses allocations appartiennent toujours au même tenant, donc
-- le SELECT ... FOR UPDATE ci-dessous reste correctement filtré par la RLS
-- (comme l'était déjà le SELECT SUM depuis 031). Comportement PROUVÉ par
-- test_energy_rls_non_superuser.py (rôle non superuser, propriétaire réel des
-- tables ET de cette fonction) — pas seulement affirmé en commentaire.
--
-- Couverture CI : le PostgreSQL du job migration-tests se connecte en
-- superuser (RLS intégralement contournée dans CE job) — la preuve de
-- non-contournement RLS vit dans test_energy_rls_non_superuser.py. Le VERROU
-- lui-même (FOR UPDATE) n'a en revanche aucun rapport avec la RLS : c'est un
-- mécanisme de base indépendant, actif pour toute session, superuser ou non —
-- test_energy_allocation_concurrency.py le prouve donc valablement même sous
-- le rôle superuser du job.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_instrument_allocations_guard ON instrument_allocations;

CREATE OR REPLACE FUNCTION energy_allocation_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_volume  NUMERIC;
  v_already NUMERIC;
BEGIN
  -- Verrouille la ligne instrument AVANT de lire la somme déjà allouée : une
  -- seconde transaction concurrente allouant au MÊME instrument BLOQUE ici
  -- jusqu'au commit/rollback de la première, puis relit une somme à jour au
  -- déblocage (READ COMMITTED : chaque nouvelle requête voit les données
  -- committées depuis). Les allocations sur un AUTRE instrument (ligne
  -- différente) ne sont jamais retardées par ce verrou.
  SELECT volume_mwh INTO v_volume
  FROM contractual_instruments
  WHERE id = NEW.instrument_id
  FOR UPDATE;

  IF v_volume IS NULL THEN
    RAISE EXCEPTION 'energy_scope2: instrument % introuvable pour allocation', NEW.instrument_id;
  END IF;

  SELECT COALESCE(SUM(allocated_mwh), 0) INTO v_already
  FROM instrument_allocations
  WHERE instrument_id = NEW.instrument_id
    AND (TG_OP <> 'UPDATE' OR id <> OLD.id);

  IF v_already + NEW.allocated_mwh > v_volume THEN
    RAISE EXCEPTION
      'energy_scope2: double allocation refusée — instrument % : % déjà alloués + % demandés dépassent le volume % MWh',
      NEW.instrument_id, v_already, NEW.allocated_mwh, v_volume;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_instrument_allocations_guard
  BEFORE INSERT OR UPDATE ON instrument_allocations
  FOR EACH ROW EXECUTE FUNCTION energy_allocation_guard();
