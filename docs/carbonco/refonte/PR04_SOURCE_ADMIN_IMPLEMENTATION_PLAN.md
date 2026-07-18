# PR-04 — Source admin & migration du snapshot démo · Plan d'implémentation

**Branche prévue :** `feat/intelligence-source-admin`
**Phase du plan d'architecture :** Phase 3 (`PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md` §20) — « Registre de sources et premier import maîtrisé ».
**Statut de ce document :** plan uniquement. Aucune écriture de code, aucune migration, aucune donnée. Rien commité hors `docs/carbonco/refonte/`.
**Contrats communs :** voir `WAVE_2_INTERFACE_CONTRACTS.md` — à respecter sans déviation non justifiée.

> **Dépendance PR-03.** PR-03 (Evidence Kernel) est **mergée** dans `master` (PR #102, `bca4b99`). Ce plan s'appuie sur son code réel. Les points marqués **À CONFIRMER** dépendent de décisions à prendre au démarrage de PR-04, pas d'un merge en attente.

---

## 1. Périmètre

Rendre le noyau Evidence Kernel **exploitable par un opérateur** et **brancher `/materials` dessus** — sans exposer encore aucun connecteur externe réel.

1. **Page interne de gestion des sources** (feature flag BETA) : lister / créer / éditer / désactiver les sources du tenant, voir leurs releases et leur état de licence. Consomme les endpoints `/intelligence/*` existants (PR-03).
2. **Interface `SourceAdapter` + `FakeAdapter`** : le contrat Python d'adaptateur (détecter/télécharger/parser/normaliser) et une implémentation **hors réseau, pilotée par fixtures** — aucun accès Internet.
3. **CLI d'import de release** : commande d'administration qui, à partir d'un fichier local + un `FakeAdapter`, exécute le pipeline `detect → validate → publish → observations`, en écrivant via les services PR-03. Jamais dans une requête utilisateur.
4. **Migration du snapshot `/materials` en source+release réelles** : enregistrer une source globale `CARBONCO_DEMO_SNAPSHOT` (licence permissive mais `estimated`), une release datée immuable pointant le snapshot, et matérialiser ses lignes en `observations` (`subject_type='material'`).
5. **Page de fraîcheur des sources** (`/health/intelligence` côté API + vue front) : dernière release par source, âge, statut, anomalies de licence.
6. **Fallback statique préservé** : `/materials` continue de rendre depuis le JSON local tant que l'API n'est pas saine (aucune régression de la page publique).

---

## 2. Hors périmètre

- **Aucun connecteur externe réel**, aucun scraping, aucun téléchargement Internet (LME/USGS/WRI, etc.) — `FakeAdapter` uniquement.
- **Aucun LLM** dans le chemin d'import/publication.
- Pas d'ingestion lourde orchestrée (Inngest/GitHub Actions) — reporté ; le CLI local suffit pour la démo.
- Pas de nouvelle valeur métier : on **migre** le snapshot existant, on n'en invente pas.
- Pas de modification des 28 fichiers SQL historiques ni du noyau PR-03 (sauf éventuel petit ajout d'endpoint de transition/fraîcheur — voir §7, à cadrer).
- Pas de procurement / énergie (PR-05/06).
- Pas de refonte visuelle de `/materials` — on y **ajoute** la provenance, on ne la redessine pas.

---

## 3. Dépendances PR-03

| Élément PR-03 utilisé | Rôle dans PR-04 |
|---|---|
| `source_service` (create/get/list/update/deactivate) | back-end de la page sources |
| `release_service` (detect/validate/publish/supersede) | pipeline d'import + migration snapshot |
| `observation_service` (create/list/get/correct) | matérialisation du snapshot en observations |
| `artifact_service.register_artifact` | stockage de la pièce brute (le JSON snapshot) |
| `license_policy.evaluate` | affichage de l'état de licence sur la page sources |
| endpoints `/intelligence/*` | consommés par la page front |
| enveloppe pagination / erreurs / RLS | contrats §5/§6/§7 des contrats communs |

**À CONFIRMER au démarrage :** les transitions release (`validate`/`publish`/`supersede`) ne sont **pas exposées en HTTP** par PR-03 (orchestrées côté service). PR-04 doit décider : (a) les appeler depuis le CLI seulement, ou (b) ajouter des endpoints `POST /intelligence/releases/{id}/validate|publish|supersede` (prévus §7 du plan d'archi). Recommandation : (b) minimal, `require_admin`, pour piloter la page sources — c'est le seul ajout au noyau PR-03 envisagé.

---

## 4. Migration réservée : `029`

**Réservation : `029_source_admin.sql`.** Contenu **volontairement minimal** — PR-04 consomme surtout le schéma PR-03 ; peu de DDL neuf.

Candidats pour `029` (à trancher au démarrage, **À CONFIRMER**) :

- **Option A (recommandée) — pas de nouvelle table, seeds seulement :** la source démo et sa release sont créées par le **CLI d'import** (via `db-migrate.yml` ou une commande de seed dédiée), pas par une migration DDL. Dans ce cas `029` peut ne pas exister, ou n'être qu'une **vue** de fraîcheur (`CREATE VIEW source_freshness AS …`) pour `/health/intelligence`.
- **Option B — table de fraîcheur matérialisée :** si le calcul de fraîcheur devient coûteux, une petite table `source_freshness_cache` (rafraîchie par job). Probablement prématuré.

**Si `029` contient du DDL**, il respecte le contrat §7 (RLS `ENABLE`+`FORCE`+`DROP POLICY IF EXISTS`, sonde `_probe_029` + enregistrement, `build_full_db`→029, tests DB-gated dans le job CI). **Une vue** n'a pas de RLS propre mais hérite du RLS de ses tables sous-jacentes (`security_invoker` **À CONFIRMER** en PostgreSQL 16 : `CREATE VIEW … WITH (security_invoker = true)` pour que la RLS des tables s'applique à l'appelant — **impératif**, sinon la vue bypasse l'isolation).

> **Le snapshot démo est une DONNÉE, pas du schéma.** Sa création passe par les services PR-03 (source/release/observations), pas par un `INSERT` en dur dans une migration `.sql`. Cela garantit checksum, licence, immutabilité et RLS corrects.

---

## 5. Tables

**Aucune nouvelle table métier obligatoire.** PR-04 écrit dans les tables PR-03 :

- `source_registry` : une ligne `code='CARBONCO_DEMO_SNAPSHOT'`, `company_id=NULL` (source **globale**, écrite via `app.rls_bypass`/admin), `source_type='file'`, licence permissive (`display_allowed=true`, `derived_use_allowed=true`, `automated_access_allowed=true`, `storage_allowed=true`), `attribution_text` renseignée.
- `source_releases` : une release `release_key='2026-06-30'`, `checksum_sha256` = SHA-256 du fichier `crm_full_34_snapshot_2026-06-30.json`, `status` piloté `detected→validated→published`, `mime_type='application/json'`, `blob_key` = clé de l'artefact.
- `evidence_artifacts` : le JSON snapshot brut stocké (content-addressed), `sensitivity='public'`.
- `observations` : une ligne par (matière × métrique) — `subject_type='material'`, `subject_key=material.id`, `metric_code ∈ {'carbonco_supply_risk_score','price_usd', 'top_producer_share_pct', …}`, `data_status='estimated'` (tout le snapshot est estimé), `source_release_id` = la release démo, `methodology_version='CC-SUPPLY-RISK-0.1'`.

Catalogue exact des `metric_code` du snapshot : **À CONFIRMER** (dérivé de `apps/carbon/lib/crm/dataLoader.ts` : `carbonco_supply_risk_score`, `score_confidence`, `price_snapshot.value`, `price_snapshot.trend_3m_pct`, `top_producers[].share_pct`, flags `is_critical_eu`/`is_strategic_eu`). Documenter le mapping snapshot→observations dans la traçabilité.

**(Optionnel) `029` vue `source_freshness`** — voir §4.

---

## 6. Services

### Nouveaux (backend)

| Service | Responsabilité |
|---|---|
| `services/intelligence/adapters/base.py` | `SourceAdapter` (Protocol) : `detect_releases`, `fetch_release`, `parse`, `normalize` — idempotent, sans logique métier, incapable de publier si licence interdit. |
| `services/intelligence/adapters/fake.py` | `FakeAdapter` : lit un fichier local (fixture), produit des `ObservationDraft` déterministes. Aucun réseau. |
| `services/intelligence/snapshot_migration.py` | orchestre : register source démo (idempotent) → register artifact (JSON) → detect/validate/publish release → émettre les observations depuis le snapshot. Réutilise intégralement les services PR-03. |
| `services/intelligence/freshness_service.py` | calcule la fraîcheur par source (dernière release, âge, statut, anomalies licence) pour `/health/intelligence` et la page front. |

### CLI

- `python -m db.intelligence_cli import-release --source <code> --file <path> --adapter fake [--publish]` (nom **À CONFIRMER**) : pilote `snapshot_migration`/adapters. Codes de sortie cohérents avec le ledger. Jamais dans une requête HTTP.
- Câblé au workflow protégé si besoin d'écrire une source **globale** en prod (nécessite `app.rls_bypass` / `get_admin_db`).

### Réutilisés (ne pas dupliquer)

`source_service`, `release_service`, `observation_service`, `artifact_service`, `license_policy`, `get_admin_db`, `services.storage.get_storage` (cf. contrats §9).

---

## 7. Endpoints

### Ajouts au noyau (minimal, à cadrer §3)

- `POST /intelligence/releases/{id}/validate` — `require_admin` — `detected|quarantined → validated`.
- `POST /intelligence/releases/{id}/publish` — `require_admin` — gate licence → `published|blocked_license`.
- `POST /intelligence/releases/{id}/supersede` — `require_admin`.
  *(Ces trois transitions existent déjà en service PR-03 ; PR-04 ne fait que les exposer si l'option (b) du §3 est retenue.)*

### Nouveaux (fraîcheur)

- `GET /health/intelligence` — public minimal (comme `/health/schema`) : par source, `last_release_at`, âge, statut, `license_ok` — **aucun secret**, borné en temps.
- `GET /intelligence/sources/{id}/freshness` — `get_current_user` — détail tenant.

### Réutilisés (PR-03, inchangés)

Les 12 endpoints `/intelligence/*` (sources, releases, ingestions, observations).

Tous : pagination §5, erreurs §6, isolation §7 des contrats communs.

---

## 8. Interface frontend

**Nouvelle page BETA** sous le groupe protégé : `apps/carbon/app/(app)/intelligence/sources/page.tsx` (+ `sources/[id]/page.tsx` pour le détail release/observations).

- **Liste des sources** : tableau (code, éditeur, type, statut licence, dernière release, fraîcheur) avec `DataStatusBadge`/`FeatureStatusBadge`/badge licence.
- **Détail source** : releases (statut, checksum tronqué, date), observations liées, état de licence (via `license_policy` exposé), pièces (`EvidenceList` **à créer**).
- **Page de fraîcheur** : vue d'ensemble multi-sources (âge, retards, anomalies licence).
- **`/materials` — ajout de provenance** : bandeau « Source : CARBONCO_DEMO_SNAPSHOT · release 2026-06-30 · Estimé », `SourceDrawer` (**à créer**) au clic, `StalenessWarning` (**à créer**) si release ancienne. **Sans** retirer le fallback statique.

Composants **à créer** (contrats §9) : `SourceDrawer`, `EvidenceList`, `LicenseWarning`, `StalenessWarning` dans `components/intelligence/`. Réutiliser `DataStatusBadge`, `ExportButtons`, `KpiProvenanceDrawer`. Client API : étendre `apps/carbon/lib/api.ts` (ou `lib/api/intelligence.ts` neuf) avec les appels `/intelligence/*` (JWT via le mécanisme existant).

Accessibilité : clavier/ARIA, états loading/empty/error/stale (cf. matrice de tests §21 du plan).

**Feature flag BETA** : la page est derrière le registre de features existant (`apps/carbon/lib/feature-registry.ts`) — statut `BETA`, pas `LIVE`.

---

## 9. Tests

- **Backend unitaires** : `FakeAdapter` déterministe (fixture → drafts) ; `snapshot_migration` idempotent (re-run = `already_recorded`/observations non dupliquées) ; `freshness_service` (cas récent / périmé / licence KO).
- **Backend DB-gated** (job CI `migration-tests`) : migration `029` applicable après 028 (si DDL) ; si vue, `security_invoker` respecte la RLS (tenant A ne voit pas la fraîcheur des sources de B) ; import complet du snapshot → observations correctes, RLS/licence OK ; **défense en profondeur** sur les nouvelles requêtes (contrat §7).
- **API** : nouveaux endpoints (auth analyst/admin, pagination, 404 sans fuite, `/health/intelligence` borné et sans secret).
- **Ledger** : `029` détectée `pending` sur base 028 ; `plan`/`apply`/`verify` verts ; sonde `_probe_029` si DDL.
- **Frontend (Vitest/Playwright)** : page sources rend liste/détail ; badges corrects ; `/materials` affiche la provenance ET conserve le fallback statique quand l'API est down ; accessibilité de base.

**Rappel CI (leçon PR-03 §15)** : inscrire tout nouveau fichier de test DB-gated dans le job `migration-tests` (`.github/workflows/api.yml`), sinon il skippe silencieusement.

---

## 10. Fichiers à créer / modifier

### Créés (backend)
- `apps/api/services/intelligence/adapters/__init__.py`, `base.py`, `fake.py`
- `apps/api/services/intelligence/snapshot_migration.py`
- `apps/api/services/intelligence/freshness_service.py`
- `apps/api/db/intelligence_cli.py` (CLI import) — nom **À CONFIRMER**
- `apps/api/db/migrations/029_source_admin.sql` **si** DDL/vue retenue (§4)
- `apps/api/tests/test_intelligence_adapters.py`, `test_snapshot_migration.py`, `test_intelligence_freshness.py`

### Modifiés (backend)
- `apps/api/routers/intelligence.py` (+ transitions release, freshness) — **seul** fichier PR-03 touché
- `apps/api/routers/health.py` (+ `/health/intelligence`)
- `apps/api/db/migration_manifest.py`, `migration_probes.py`, `tests/_migration_fixtures.py` (**si** `029` a du DDL)
- `.github/workflows/api.yml` (job `migration-tests` : ajouter les nouveaux tests DB-gated)

### Créés (frontend)
- `apps/carbon/app/(app)/intelligence/sources/page.tsx`, `sources/[id]/page.tsx`, page fraîcheur
- `apps/carbon/components/intelligence/source-drawer.tsx`, `evidence-list.tsx`, `license-warning.tsx`, `staleness-warning.tsx`
- `apps/carbon/lib/api/intelligence.ts` (client)

### Modifiés (frontend)
- `apps/carbon/app/materials/page.tsx` + composants materials (ajout provenance, **sans** casser le fallback)
- `apps/carbon/lib/feature-registry.ts` (entrée BETA « Sources »)

---

## 11. Risques

| Risque | Mitigation |
|---|---|
| Écrire une source **globale** en prod nécessite `app.rls_bypass`/admin — mauvaise manip = fuite cross-tenant | Passer **exclusivement** par le CLI + `get_admin_db` sous le workflow protégé ; jamais depuis un endpoint tenant. Tester le RLS. |
| Vue de fraîcheur qui **bypasse la RLS** (piège PostgreSQL) | `CREATE VIEW … WITH (security_invoker = true)` obligatoire ; test dédié tenant A vs B. |
| Régression de la page publique `/materials` | Conserver le fallback statique ; test Playwright « API down → rendu statique ». |
| Doublons d'observations si import non idempotent | `snapshot_migration` idempotent (clé release + `subject/metric`), test de re-run. |
| Pas de PostgreSQL local (contrainte connue) | CI `migration-tests` = seule preuve réelle ; prévoir un aller-retour (leçon PR-02/03). |
| Numéro `029` déjà pris par une autre PR mergée avant | Confirmer via `command=plan` avant apply ; renuméroter au merge si conflit (contrats §10). |

---

## 12. Étapes d'implémentation

1. `SourceAdapter` (base) + `FakeAdapter` + tests unitaires (aucune DB).
2. `snapshot_migration` (réutilise services PR-03) + tests idempotence (DB-gated).
3. CLI d'import + câblage workflow (dry-run d'abord).
4. `freshness_service` + `/health/intelligence` + `/intelligence/sources/{id}/freshness`.
5. (Si option b) transitions release exposées (`validate`/`publish`/`supersede`, `require_admin`).
6. (Si retenu) migration `029` (vue/table) + sonde + fixtures + job CI.
7. Frontend : client API, page sources (liste/détail), page fraîcheur, composants provenance.
8. `/materials` : bandeau provenance + drawer + staleness, fallback préservé.
9. Feature flag BETA.
10. Suite de tests complète ; `git diff --check` ; lint front/back.
11. **Exécution opérationnelle post-merge** (Ludo) : importer réellement le snapshot démo via le workflow.

---

## 13. Critères de merge

- Tous tests verts en CI (`tests`, `migration-tests`, front Vitest/Playwright, `validate`, `security-audit`, `gitleaks`).
- `ruff` / `git diff --check` propres ; TypeScript strict, aucun `any` nouveau.
- `main.py` : seul ajout = enregistrement d'éventuels nouveaux endpoints ; noyau PR-03 non altéré dans son comportement.
- Isolation tenant testée (RLS + défense en profondeur) sur toute nouvelle requête/vue.
- `/materials` : provenance visible **et** fallback statique intact (démontré par test).
- Aucune source externe réelle appelée ; aucun LLM ; snapshot démo reste `estimated`.
- Aucune écriture prod par Claude — seul le code + la doc ; l'import réel est un geste opérateur.
- PR non mergée automatiquement.

---

## 14. Opérations post-merge

1. **Backup** (`backup.yml`) avant toute écriture.
2. Si `029` a du DDL : `db-migrate.yml` → `plan` (confirmer 029 pending) → `apply` → `verify` → `/health/schema` `up_to_date:true`.
3. **Import de la source démo** (Ludo, via CLI sous workflow protégé) : `import-release --source CARBONCO_DEMO_SNAPSHOT --file … --publish` — écrit la source globale + release + observations. Vérifier `/health/intelligence`.
4. Vérifier `/materials` en prod : provenance affichée, valeurs inchangées, fallback opérationnel si API coupée.
5. Observation 24-48h ; consigner date + acteur dans `MIGRATIONS_RUNBOOK.md` §9.
6. **Gate Phase 3** : « aucune donnée publique ne vient d'un fichier sans release et source enregistrées » — vérifié.
