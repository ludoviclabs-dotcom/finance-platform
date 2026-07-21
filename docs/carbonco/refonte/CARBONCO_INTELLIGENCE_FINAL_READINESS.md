# CARBONCO_INTELLIGENCE_FINAL_READINESS

> Sign-off de fin de chantier CarbonCo Intelligence (11 PR). État au 2026-07-21,
> `origin/master` = `950b127`. Le chantier est **TERMINÉ côté code**. Le seul reliquat
> est opérationnel : appliquer la migration 041 en prod (approbation `production-db`) +
> déploiement Vercel — voir `PR11_INTEGRATION_REPORT.md` §4/§5.

## 1. Vagues livrées

| Vague / PR | Contenu | Migrations | Statut |
|---|---|---|---|
| Wave 1 (PR-01/02/03) | materials trust, ledger de migrations, Evidence Kernel | 028 + ledger | MERGÉ, prod |
| Wave 2 (PR-04/05A/06A) | source admin, procurement, énergie/Scope 2 | 029-031 | MERGÉ, prod |
| Wave 3 (PR-05B/06B/07 + stab.) | Scope 3, moteur Scope 2, CRMA, intégrité | 032-035 | MERGÉ, prod |
| Wave 4 (PR-08/09/10) | géospatial/eau, biodiversité/TNFD, IRO/double matérialité | 036-040 | MERGÉ, prod |
| **PR-11** | **assistant IA cité + revue humaine** | **041** | **MERGÉ**, prod **EN ATTENTE** (§4 report) |

## 2. Schéma

- Master : **42 migrations (001-041)**. Prod : **040 appliquée** ; **041 EN ATTENTE**
  d'application (DB Migrate, approbation humaine). Cible : `schema_version=041`.

## 3. Modules & routes (surface API)

Domaines exposés : `/intelligence` (Evidence Kernel), `/procurement`+`/products`, `/energy`
(Scope 2), `/scope3`, `/crma`, `/water`, `/nature`, `/iro` (double matérialité), **`/ai/review/*`
(assistant IA — PR-11)**. Endpoints IA : revue IRO, explication Scope 2, liste/détail des runs,
décision humaine. Santé : `/health`, `/health/schema`, `/health/intelligence`.

## 4. Sécurité & gouvernance

- **RLS gen-2 FORCE** partout (tenant strict ou global-lecture selon la table), + défense
  applicative `company_id=%s` (le Postgres CI superuser bypasse la RLS).
- **Evidence Kernel** : sources/releases immuables, artefacts, observations gelées, liens de
  preuve. Licence déterministe (`license_policy.evaluate`), sensibilité `public/internal/
  confidential/restricted`.
- **Gouvernance IA** (PR-11) : grounding sous RLS + licence (`allow_display` **et**
  `allow_derived_use`) + sensibilité + minimisation ; citations résolues (inventée/cross-tenant/
  bloquée/sensible/derived-use rejetées) ; entailment déterministe ; gate `schema_valid AND
  citation_resolved AND license_allowed AND human_review=approved` ; journal append-only ;
  décision de matérialité exclusivement humaine ; documents = données non fiables (défense
  injection). **Aucune décision automatique, aucune écriture métier par le modèle.** Contrats :
  `AI_GOVERNANCE_CONTRACTS.md`.

## 5. Preuves & tests

- CI `migration-tests` (Postgres 16) : ledger, Evidence Kernel, procurement, énergie, RLS
  non-superuser, Scope 2/3, CRMA, eau, nature, IRO, **journal IA** — tous verts sur `950b127`.
- PR-11 : red-team DB-free (citations inventées, injection, entailment) + DB-gated (RLS A/B,
  append-only, exclusion sensibilité/licence/derived-use=0 fuite, create_iro, provider indispo) +
  14 vitest front. **Aucun test CI obligatoire n'appelle un vrai modèle.**

## 6. Performance & accessibilité

- Endpoints paginés (`{items,total,limit,offset}`), erreurs normalisées (`_errors.py`),
  `schema_ready_guard` (503 propre pendant la fenêtre de migration). IA : plafond contexte
  (`MAX_INPUT_TOKENS`), rate-limit fail-safe par tenant/utilisateur, non-streaming pour la sortie
  structurée. Frontend : composants accessibles (aria), badges de statut/qualité cohérents,
  réutilisation des composants existants.

## 7. Dettes résiduelles (candidats séparés, hors chantier)

- Retrofit RLS gen-1→gen-2 de `sites`(027) et `materialite_*`(025).
- PostGIS (si privilège `CREATE EXTENSION` confirmé).
- Points d'appel domaine→IRO candidat à compléter/vérifier.
- IA : UC-2 Scope 3 (fast-follow) ; UC-6/7/8 (contradictions, données manquantes, narratif) ;
  entailment sémantique pour UC-1 (`supported`).

## 8. Statut « prêt pour démonstration »

**Prêt une fois** : (a) migration 041 appliquée (`/health/schema=041`), (b) déploiement Vercel
de `950b127` effectif (`/health` `version=950b127`, `/ai/review/*` servis). Le mode IA est
**demo par défaut** (déterministe, zéro coût) — la démonstration ne nécessite AUCUNE activation
payante. L'activation live reste une décision séparée (`AI_LIVE_ACTIVATION_RUNBOOK.md`).

**Ne pas démarrer de nouveau module métier après PR-11 : le chantier Intelligence est clos.**
