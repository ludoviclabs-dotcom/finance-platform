# MODULE 2 — RLS & sécurité

> **Phase 2 — architecture définitive, docs-only.** Date : 2026-07-22. Aucun code créé.
> Toutes les tables de 042/043 suivent le **contrat RLS Génération-2** déjà gelé (028/030/031/033/034/037/040) — aucune invention.

## 1. RLS Génération-2 (pattern imposé, identique à 034)

Pour **chaque** table de 042/043 :

```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <t> FORCE  ROW LEVEL SECURITY;      -- s'applique AUSSI au propriétaire
-- 4 policies PAR COMMANDE, DROP avant CREATE (rejouable par startup_event en dev)
DROP POLICY IF EXISTS tenant_isolation_<t> ON <t>;
CREATE POLICY tenant_isolation_<t> ON <t> FOR SELECT USING (<lecture>);
DROP POLICY IF EXISTS tenant_isolation_<t>_insert ON <t>;
CREATE POLICY tenant_isolation_<t>_insert ON <t> FOR INSERT WITH CHECK (<écriture>);
DROP POLICY IF EXISTS tenant_isolation_<t>_update ON <t>;
CREATE POLICY tenant_isolation_<t>_update ON <t> FOR UPDATE USING (<écriture>) WITH CHECK (<écriture>);
DROP POLICY IF EXISTS tenant_isolation_<t>_delete ON <t>;
CREATE POLICY tenant_isolation_<t>_delete ON <t> FOR DELETE USING (<écriture>);
```

Prédicats (identiques 034) :
- **Bypass admin** (semis global) : `current_setting('app.rls_bypass', true) = 'on'`.
- **Tenant courant** : `company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint` (posé par `get_db(company_id)`, `database.py`).

## 2. Deux profils de portée

### 2.A Tables à **portée mixte** (lecture globale + tenant)
`resource_catalog`, `resource_roles`, `resource_aliases`, `resource_regulatory_statuses`, `resource_sector_uses`, `resource_stage_applicability`, `resource_supply_observations`.

- **SELECT** : `app.rls_bypass='on' OR company_id IS NULL OR company_id = <tenant>` — une ligne **globale** (`company_id IS NULL`) est lisible par tous.
- **INSERT/UPDATE/DELETE** : `app.rls_bypass='on' OR company_id = <tenant>` — **jamais `IS NULL`** : un tenant ne crée/modifie **jamais** une ligne globale. L'écriture globale (semis, référentiel canonique) passe **uniquement** par `app.rls_bypass='on'` posé en `SET LOCAL` dans la migration ou un service admin (motif 034 §3bis / 028).

### 2.B Tables **tenant strictes** (`company_id NOT NULL`)
`company_resource_exposure_links`, `resource_assessment_runs`, `resource_assessment_dimensions`.

- **SELECT** : `app.rls_bypass='on' OR company_id IS NULL OR company_id = <tenant>` (branche `IS NULL` conservée par cohérence de pattern, **inerte** sous `NOT NULL`, comme 030/034).
- **INSERT/UPDATE/DELETE** : `app.rls_bypass='on' OR company_id = <tenant>`.

## 3. Défense applicative OBLIGATOIRE (le CI bypasse la RLS)

**Le PostgreSQL de CI se connecte en superuser, qui BYPASSE toute RLS (FORCE compris)** — aucun test d'isolation ne prouve quoi que ce soit sans prédicat applicatif explicite. Comme `services/crma/*` (`_SCOPE`/`_GLOBAL_SCOPE`), **chaque requête de chaque service `services/resources/*`** porte :
- **Lecture** : `WHERE (company_id = %s OR company_id IS NULL)` pour les tables mixtes ; `WHERE company_id = %s` pour les tables strictes.
- **Écriture** : `WHERE company_id = %s` ; toute écriture globale explicitement via le chemin `app.rls_bypass` admin, jamais depuis un handler analyste.
- **Anti-IDOR** : avant d'insérer un `company_resource_exposure_links`, la FK cible (`bom_item_id`, `purchase_line_id`, …) est vérifiée **appartenir au tenant** (`SELECT 1 … WHERE id=%s AND company_id=%s`), motif `exposure_service._assert_in_scope` (034). Un objet d'un autre tenant ⇒ **404 « introuvable »**, jamais 403 (pas de fuite d'existence).

**Refus cross-tenant** : garanti à deux niveaux — RLS FORCE en production (rôle `carbonco_app` restreint) **et** prédicat applicatif partout (garantie primaire sous superuser CI). Les deux sont testés (voir `MODULE2_TEST_STRATEGY.md`).

## 4. Immuabilité

- **`resource_assessment_runs`** : trigger `trg_resource_assessment_runs_guard` — dès `status <> 'draft'`, `risk_score`/`confidence`/`input_snapshot`/`methodology_*` non réécrivables ; DELETE refusé hors draft ; recalcul ⇒ **nouveau run** + `supersedes_id`. Motif : immuabilité `scope2_calculation_runs` (033), append-only `materiality_decisions` (040) / `evidence_kernel_guard('frozen')` (028).
- **`resource_assessment_dimensions`** : enfant d'un run figé (`ON DELETE CASCADE`) — non modifiable une fois le run non-draft (le gel du parent suffit ; un trigger dédié reste possible en durcissement).
- **`resource_supply_observations`** : **idempotent** (clé unique `(company_id,resource_id,stage_code,country_code,reference_year,metric_code)`), corrigeable par upsert — pas figé, mais jamais dupliqué (interdit le double-comptage HHI). Un historique de correction relève d'une supersession de `source_release` (Evidence Kernel), pas d'un écrasement silencieux.
- **`resource_regulatory_statuses`** : mutable (le droit évolue) avec `verified_on`/`updated_at` — la traçabilité vient de `source_release_id`.

## 5. Lien Evidence Kernel & licence

- Toute table factuelle (`resource_catalog`, `resource_regulatory_statuses`, `resource_sector_uses`, `resource_supply_observations`) porte `source_release_id` + CHECK `*_sourced_check` (`verified`/`confirmed` ⇒ release NON NULL).
- **Licence évaluée à la LECTURE** : les données sourcées d'une source à licence restrictive sont filtrées/dégradées par `license_policy.evaluate` au moment de servir, jamais dénormalisées. Une observation dont `derived_use_allowed=false` **dégrade la confiance, jamais le risque** ; jamais affichée brute (cf. `DATA_SOURCE_AND_LICENSE_MATRIX.md`, item O-10 : `allow_derived_use` doit être **gaté sur `commercial_use_allowed`** avant d'onboarder FAOSTAT/Eurostat restreint).
- **Provenance par composante** : `resource_assessment_dimensions.source_release_ids` trace chaque driver à ses releases.

## 6. Pas de source externe live

- **Aucune** ingestion réseau au fil de la requête utilisateur. L'entrée de données passe par les services/CLI Evidence Kernel (adaptateurs Fake/import contrôlés, sous licence évaluée), jamais par un `fetch` dans un handler `/resources`.
- **Aucun LLM** dans le chemin de calcul du score (déterministe, pur — `scoring.py`). L'assistant IA (041) reste **revue/explication citée**, jamais un moteur de décision, et n'écrit aucune donnée métier.

## 7. Sécurité Défense / Spatial — frontière de contenu STRICTE

MODULE 2 traite la dépendance d'approvisionnement **au seul angle supply-chain** (quelle ressource, quel pays/étape, quel statut réglementaire, quelle concentration). Sont **formellement exclus du schéma, des services, de l'API et de tout contenu stocké ou affiché** :

- ❌ **aucune recette** ;
- ❌ **aucune formulation** ;
- ❌ **aucune proportion / ratio de mélange** ;
- ❌ **aucun paramètre de fabrication** ;
- ❌ **aucune instruction de propergol** (composition, synthèse, mise en œuvre) ;
- ❌ **aucun paramètre opérationnel de propulsion** (poussée, impulsion spécifique en tant que donnée d'ingénierie, `kgCO2e/kN` de poussée — explicitement interdit par D-4) ;
- ❌ aucune donnée dual-use technique : les listages (`resource_regulatory_statuses.regime='dual_use'`) portent **l'existence d'un contrôle et son instrument**, jamais un paramètre technique.

**Matérialisation** : `resource_sector_uses.use_label`/`criticality_note` sont des **classifications d'usage** (« aérospatial », « refroidissement IRM »), bornées par revue de contenu. Aucune colonne du modèle n'accueille de champ technique. La revue de code de PR-M2A/B/C/D **rejette** tout ajout de champ ou de seed contenant l'un des éléments ci-dessus (critère de merge, cf. `MODULE2_IMPLEMENTATION_PLAN.md`).

## 8. Récapitulatif RLS par table

| Table | Profil | Écriture tenant | Écriture globale | Immutable |
|---|---|---|---|---|
| `resource_catalog` | mixte | oui | bypass admin | non |
| `resource_roles` | mixte | oui | bypass admin | non |
| `resource_aliases` | mixte | oui | bypass admin | non |
| `resource_regulatory_statuses` | mixte | oui | bypass admin | non |
| `resource_sector_uses` | mixte | oui | bypass admin | non |
| `resource_stage_applicability` | mixte | oui | bypass admin (semis) | non |
| `resource_supply_observations` | mixte | oui | bypass admin | non (idempotent) |
| `company_resource_exposure_links` | tenant strict | oui | — | non |
| `resource_assessment_runs` | tenant strict | oui | — | **oui (trigger)** |
| `resource_assessment_dimensions` | tenant strict | oui | — | **oui (enfant figé)** |

→ Tests de tout ce contrat : `MODULE2_TEST_STRATEGY.md`.
