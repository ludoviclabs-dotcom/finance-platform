# PR-04 — Source Admin & migration auditable du snapshot /materials · Traçabilité

**Périmètre :** rendre le noyau Evidence Kernel (PR-03) exploitable par un opérateur et brancher `/materials` dessus — registre/gestion des sources, adaptateur hors-réseau, import auditable du snapshot démo (checksum + idempotence + parité), fraîcheur, provenance UI. Aucun connecteur externe réel, aucun LLM, aucune écriture prod par Claude.

**Base :** branche `feat/intelligence-source-admin` sur `origin/master` (migration 028 + plans Wave 2 déjà mergés). Migration réservée : **029**.

> Convention de statut : **FAIT** · **PARTIEL** · **NON FAIT** · **NON APPLICABLE**.

---

## 1. Périmètre livré (mapping au plan `PR04_SOURCE_ADMIN_IMPLEMENTATION_PLAN.md`)

| # | Plan | Statut | Preuve |
|---|---|---|---|
| 1 | Migration 029 (vue de fraîcheur) | **FAIT** | `apps/api/db/migrations/029_source_admin.sql` (vue `source_freshness`, `security_invoker=true`) |
| 2 | `SourceAdapter` + `FakeAdapter` (hors réseau, fixtures) | **FAIT** | `apps/api/services/intelligence/adapters/{__init__,base,fake}.py` |
| 3 | `snapshot_migration` (import auditable, checksum, idempotence, parité, modes local/kernel/compare) | **FAIT** | `apps/api/services/intelligence/snapshot_migration.py` |
| 4 | CLI d'import (jamais en requête HTTP) | **FAIT** | `apps/api/db/intelligence_cli.py` (`import-release`) |
| 5 | `freshness_service` + `/health/intelligence` + `/intelligence/sources/{id}/freshness` | **FAIT** | `services/intelligence/freshness_service.py`, `routers/health.py`, `routers/intelligence.py` |
| 6 | Transitions release (`validate`/`publish`/`supersede`, `require_admin`) | **FAIT** | `routers/intelligence.py` (seul fichier PR-03 modifié) |
| 7 | Application déterministe de la licence | **FAIT** | réutilise `license_policy.evaluate` (publish gate + freshness + UI) |
| 8 | UI interne BETA : sources (liste/détail), fraîcheur | **FAIT** | `apps/carbon/app/(app)/intelligence/**` |
| 9 | `/materials` : provenance + drawer + staleness, **fallback préservé** | **FAIT** | `components/materials/MaterialsProvenance.tsx` (données locales, aucun appel API) |
| 10 | Composants transverses (`SourceDrawer`, `EvidenceList`, `LicenseWarning`, `StalenessWarning`) | **FAIT** | `apps/carbon/components/intelligence/*` |
| 11 | `dataStatusToBadge` (mapping unique, contrats §2) | **FAIT** | `components/ui/data-status-badge.tsx` |
| 12 | Feature flag BETA « Sources » | **FAIT** | `apps/carbon/data/feature-status.json` (id `intelligence-sources`, `statut: beta`) |
| 13 | Documentation / traçabilité | **FAIT** | ce document |

---

## 2. Migration 029 — vue `source_freshness`

Choix **Option A** du plan §4 : **pas de nouvelle table**, une **vue** de fraîcheur. La source démo et ses observations sont des **données** (créées par le CLI via les services), pas du schéma.

- `CREATE OR REPLACE VIEW source_freshness WITH (security_invoker = true)` — agrège par source sa dernière release (date effective = `published_at` sinon `retrieved_at`), son statut, et les compteurs `published_release_count`/`total_release_count`. Expose aussi les colonnes de licence pour que `freshness_service` passe directement la ligne à `license_policy.evaluate`.
- **`security_invoker=true` impératif** (contrats §7, risque plan §11) : sans lui, la vue s'exécuterait avec les droits du propriétaire et **bypasserait la RLS** des tables 028. Avec lui, la RLS de `source_registry`/`source_releases` s'applique à l'appelant.
- **Sonde `_probe_029`** (`migration_probes.py`) : vérifie que la vue existe **ET** porte `security_invoker=true` (helper `_view_has_security_invoker`, lecture de `pg_class.reloptions`) — la présence seule ne suffit pas.
- Ledger : entrée `MigrationMeta("029")` (`migration_manifest.py`), `build_full_db`→029 (`_migration_fixtures.py`), `build_evidence_kernel_db`→029 (`_intelligence_fixtures.py`).
- `GRANT SELECT` conditionnel à `carbonco_app` (même geste que 028).

**Aucune autre migration `0NN.sql` ajoutée** — 029 est le seul nouveau fichier SQL.

---

## 3. Adaptateur (`SourceAdapter` / `FakeAdapter`)

- `base.py` : `SourceAdapter` (Protocol runtime-checkable) — `detect_releases → fetch_release → parse → normalize`. `ReleaseCandidate` (octets + checksum auto), `ObservationDraft` (miroir des colonnes `observations`). Contrat : déterministe, aucune logique métier, aucun réseau/LLM, **incapable de publier** (la licence est décidée en aval).
- `fake.py` : `FakeAdapter` — lit un fichier local (ou `content` en mémoire pour les tests), délègue la normalisation à un `normalizer` injecté. Rejette un draft sans valeur.

---

## 4. Import auditable du snapshot — `snapshot_migration.py`

Transforme `apps/carbon/data/crm_full_34_snapshot_2026-06-30.json` en source globale + release + artefact + observations.

- **Source globale** `CARBONCO_DEMO_SNAPSHOT` (`company_id IS NULL`), licence **permissive** (`display_allowed`, `derived_use_allowed`, `automated_access_allowed`, `storage_allowed = true`), mais toutes les observations restent **`estimated`**.
- **Écriture globale** : les services PR-03 sont scopés tenant (forcent `company_id = tenant`, ne peuvent **pas** écrire de ligne globale). `snapshot_migration` effectue donc les écritures globales via `get_admin_db` + `SET LOCAL app.rls_bypass = 'on'`, en **reproduisant fidèlement** les formes SQL des services et en **réutilisant `license_policy.evaluate`** pour la gate de publication. *(Déviation justifiée vs. « réutiliser intégralement les services » — voir §9.)*
- **Checksum SHA-256** = hash des octets bruts du fichier (identité d'idempotence de détection du noyau 028).
- **Idempotence** : source (`ON CONFLICT (code) WHERE company_id IS NULL DO NOTHING` + relecture), artefact (relecture par `sha256`), release (`ON CONFLICT (source_id, release_key, checksum)`), observations (pré-chargement des `(subject_type, subject_key, metric_code)` existants pour la release → insertion des seuls manquants). Re-run ⇒ `observations_created = 0`.
- **Parité** (`build_parity_report`) : compare chaque draft attendu à l'observation persistée (valeurs `numeric/text/boolean` uniquement, comparaison **Decimal** pour éviter tout écart float). `ok = True` ssi tout matche, zéro `missing`/`extra`/`mismatch`. Preuve « aucune valeur changée ».
- **Modes de rendu** (`render_materials`) : `local` (drafts issus du JSON), `kernel` (matières reconstruites depuis les observations), `compare` (rapport de parité entre les deux).

### Mapping snapshot → observations (`subject_type='material'`, `subject_key='material:{id}'`)

| Champ snapshot | `metric_code` | Type | `unit` | `methodology_version` |
|---|---|---|---|---|
| `carbonco_supply_risk_score` | `carbonco_supply_risk_score` | numeric | — | `score_methodology_version` (`CC-SUPPLY-RISK-0.1`) |
| `is_critical_eu` | `is_critical_eu` | boolean | — | `CC-DEMO-SNAPSHOT` |
| `is_strategic_eu` | `is_strategic_eu` | boolean | — | `CC-DEMO-SNAPSHOT` |
| `top_producers[0].share_pct` (+ `country` → `geography_code`) | `top_producer_share_pct` | numeric | `pct` | `CC-DEMO-SNAPSHOT` |
| `price_snapshot.value` (si présent) | `price_usd` | numeric | `USD/kg` | `CC-DEMO-SNAPSHOT` |
| `price_snapshot.trend_3m_pct` (si présent) | `price_trend_3m_pct` | numeric | `pct` | `CC-DEMO-SNAPSHOT` |

- `score_confidence` est **toujours `null`** dans le snapshot → **aucune observation** (jamais une valeur inventée).
- `price_snapshot` absent (6 matières sur 34) → pas d'observation prix/tendance pour celles-là.
- Sur les 34 matières : **192 observations** (34 score + 34 critical + 34 strategic + 34 top-producer + 28 prix + 28 tendance). Le JSON brut complet reste conservé byte-fidèlement dans l'artefact (checksum).

### CLI

`python -m db.intelligence_cli import-release --source CARBONCO_DEMO_SNAPSHOT --file <path> --adapter fake [--publish] [--json]`. Codes de sortie : `0` succès/idempotent, `1` erreur, `4` anomalie de parité. Jamais dans une requête HTTP. Refuse tout `--adapter` ≠ `fake` et toute `--source` ≠ démo (aucun connecteur externe).

---

## 5. Fraîcheur, santé, transitions

- `freshness_service` : lit la vue `source_freshness` avec **prédicat de périmètre explicite** (`(company_id = %s OR company_id IS NULL)`) en plus de la RLS/security_invoker — défense en profondeur (le PostgreSQL de CI est superuser et bypasse la RLS). Calcule `age_days`, `is_stale` (seuil `STALE_AFTER_DAYS = 120`, aligné sur `dataLoader.ts`), et l'état de licence déterministe.
- `GET /health/intelligence` (`routers/health.py`) : **public**, minimal, borné à 2 s (même pattern que `/health/schema`). Ne lit **que** les sources globales (`company_id IS NULL`) — aucune donnée tenant, aucun secret. `not_configured` (mode /tmp) → 200.
- `GET /intelligence/sources/{id}/freshness` (`get_current_user`) : détail tenant, 404 (jamais 403) hors périmètre.
- `POST /intelligence/releases/{id}/{validate,publish,supersede}` (`require_admin`) : exposent les transitions existantes du `release_service` (PR-03). `publish` renvoie 200 avec statut `blocked_license` si la licence bloque (état normal, pas une erreur).

---

## 6. Frontend

- Client `lib/api/intelligence.ts` : types miroir des modèles + `fetchSources/fetchSource/fetchSourceReleases/fetchObservations/fetchSourceFreshness/fetchIntelligenceHealth/validateRelease/publishRelease/supersedeRelease`. Réutilise `API_BASE_URL`/`getAuthToken` de `lib/api.ts`.
- Pages BETA sous le groupe protégé `(app)` : `intelligence/sources` (liste), `intelligence/sources/[id]` (détail + transitions admin), `intelligence/freshness` (aperçu). États loading/empty/error explicites, **aucun fallback silencieux**.
- Composants `components/intelligence/` : `SourceDrawer`, `EvidenceList`, `LicenseWarning`, `StalenessWarning` (créés ici pour Wave 2, contrats §9). `dataStatusToBadge` ajouté à `data-status-badge.tsx` (mapping unique, contrats §2).
- `/materials` : `MaterialsProvenance` ajoute un bandeau « Source : CARBONCO_DEMO_SNAPSHOT · release … · Estimé » + drawer + staleness. **Provenance dérivée du snapshot LOCAL** (aucun appel API) → le **fallback statique reste intact** même API coupée ; `SnapshotBanner` et tout le rendu existant sont conservés. `ageDays`/`isStale` calculés côté serveur (helper `snapshotAgeDays` dans `dataLoader.ts`) — jamais recalculés côté client (pas d'écart d'hydratation).

---

## 7. Tests

| Fichier | Contenu | DB-gated |
|---|---|---|
| `tests/test_intelligence_adapters.py` | FakeAdapter (déterminisme, checksum, protocole), normaliseur CRM (comptes/valeurs/`estimated`/null), 192 observations sur le vrai snapshot | **Non** (pur) |
| `tests/test_snapshot_migration.py` | Rapport de parité (identique/decimal/mismatch/missing/extra) **pur** ; import de bout en bout (création, checksum=fichier, parité ok, idempotence 0 doublon, global+estimated, licence permissive, visibilité tenant du global) | **Partiel** |
| `tests/test_intelligence_freshness.py` | Logique de fraîcheur (âge/stale/licence) **pure** ; service sur la vue 029 (visibilité globale, isolation A≠B, hors-périmètre→None, health global-only) ; API auth/health **agnostique au mode** | **Partiel** |

- API CI : les 3 fichiers ajoutés au job `migration-tests` (`.github/workflows/api.yml`) — sinon les tests DB-gated skippent silencieusement (leçon PR-03 §15).
- Ledger : corpus réel passe à **30** fichiers (001-029) — `test_migration_runner.py` et les `written_count` de `test_migration_ledger.py` (30→31) mis à jour ; `test_migration_probes.py` couvre 029 automatiquement (paramétré sur `MIGRATION_OBJECT_PROBES`).
- Frontend : `tests/intelligence-api.test.ts` (client + `dataStatusToBadge`) — Vitest, mock fetch.

### Exécuté localement (pas de PostgreSQL / Docker — contrainte connue)

| Commande | Résultat |
|---|---|
| `python -m pytest tests/test_intelligence_adapters.py tests/test_snapshot_migration.py tests/test_intelligence_freshness.py` | **30 passed, 12 skipped** (skips = DB-gated) |
| `pytest` (migration runner/ledger/probes + intelligence sources/adapters/snapshot/freshness) | **61 passed, 124 skipped**, 0 failed |
| `ruff check . --select=E,F,I --ignore=E501` (apps/api) | **All checks passed** |
| `vitest run tests/intelligence-api.test.ts` (apps/carbon) | **12 passed** |
| `eslint` (fichiers front modifiés) | **0 problème** |
| `next build` | voir §10 (validé) |

Les tests DB-gated (import réel, RLS/vue, isolation, ledger) ne s'exécutent qu'en CI (`migration-tests`, `postgres:16`) — seule preuve réelle, comme PR-02/03.

---

## 8. Isolation & sécurité

- Vue `security_invoker=true` + prédicat de périmètre explicite dans `freshness_service` (défense en profondeur, tient sous superuser CI).
- `/health/intelligence` : sources globales uniquement, aucun secret, borné.
- Transitions release `require_admin` ; freshness tenant `get_current_user` ; 404 (jamais 403) hors périmètre.
- Écriture globale **exclusivement** via CLI + `get_admin_db` + `rls_bypass` ; aucun endpoint tenant n'écrit de ligne globale.
- Aucune migration 001-028 modifiée ; noyau PR-03 uniquement **étendu** (ajout d'endpoints dans `routers/intelligence.py`).

---

## 9. Déviations vs. contrats / plan (justifiées)

1. **Écritures globales hors services PR-03.** Le plan §6 dit « réutilise intégralement les services PR-03 ». Or ces services forcent `company_id = tenant` et **ne peuvent pas** écrire de ligne globale (`company_id IS NULL`) — par conception (contrats §7 : un tenant n'écrit jamais de ligne globale). `snapshot_migration` effectue donc les écritures globales via `get_admin_db` + `rls_bypass`, en reproduisant les mêmes formes SQL et en **réutilisant `license_policy.evaluate`** pour la gate. C'est exactement le geste admin décrit au risque §11 du plan (« passer exclusivement par le CLI + `get_admin_db` »). Aucun contournement de la RLS côté tenant.
2. **Freshness multi-sources composée côté front.** Le plan §7 n'expose que `GET /sources/{id}/freshness` (par source) + `/health/intelligence` (global). La page de fraîcheur tenant compose donc `fetchSources` + `fetchSourceFreshness` par source (borné, page BETA interne) plutôt qu'un nouvel endpoint liste — pour rester au plus près de la liste d'endpoints du plan.
3. **`/materials` provenance sans appel API.** Le plan §8 décrit bandeau + drawer + staleness ; je les alimente depuis le snapshot **local** (aucun `fetch`) pour garantir le fallback statique et éviter tout nouveau fallback silencieux sur la page publique. Le pilotage du noyau (source/release réelles) reste sur la page Source Admin authentifiée.

---

## 10. Confirmations & commandes

- **Aucune source externe réelle, aucun réseau, aucun LLM** dans l'import/publication (grep `requests`/`httpx`/`urllib` sur les nouveaux modules : zéro). `FakeAdapter` uniquement.
- **Aucune valeur du snapshot modifiée** — migration byte-fidèle, prouvée par le rapport de parité (`ok=True`, 192/192).
- **Snapshot démo reste `estimated`** ; licence permissive honnêtement renseignée.
- **Aucune écriture prod par Claude** — aucun `apply`, aucune connexion Neon, `db-migrate.yml` non déclenché. L'import réel est un geste opérateur (CLI sous workflow protégé).
- **Un seul nouveau fichier de migration** : `029_source_admin.sql`.
- **PR non mergée automatiquement.**

### Opérations post-merge (Ludo, hors code)

1. Backup (`backup.yml`).
2. `db-migrate.yml` : `plan` (confirmer 029 pending) → `apply` → `verify` (`_probe_029`) → `/health/schema` `up_to_date:true`.
3. Import réel : `import-release --source CARBONCO_DEMO_SNAPSHOT --file apps/carbon/data/crm_full_34_snapshot_2026-06-30.json --publish` sous workflow protégé (écrit la source globale + release + 192 observations). Vérifier `/health/intelligence` et `/materials`.
