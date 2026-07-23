# P00 — Baseline Audit

**Mission :** P00 — Audit immuable et ADR de frontière.
**Branche :** `docs/water-intelligence-p00-baseline`
**SHA de base :** `bb1eba9b70128f29b94d36cd4ee3569cec55939f` (merge de la PR [#141](https://github.com/ludoviclabs-dotcom/finance-platform/pull/141) dans `master`, 2026-07-23T17:34:37Z)
**Commandes exécutées pour établir la base :**

```
git checkout master
git pull --ff-only origin master   # be9d5f7 -> bb1eba9, fast-forward, 28 fichiers ajoutés (docs/carbonco/water-intelligence/)
git checkout -b docs/water-intelligence-p00-baseline
```

**Méthode :** inspection directe du code source courant (citations `fichier:ligne`), croisée avec les documents de traçabilité existants (`docs/carbonco/refonte/PR08_*`, `PR03_*`, `PR04_*`) qui décrivent l'intention de conception d'origine. Chaque affirmation ci-dessous est marquée **(vérifié source)** quand elle a été confirmée par lecture directe du code actuel, ou **(doc historique, non revérifié)** quand elle provient uniquement d'un document de traçabilité sans re-vérification indépendante. Aucun fait n'est avancé sans l'une de ces deux étiquettes.

---

## 1. Route existante `/water`

- Fichier unique : `apps/carbon/app/(app)/water/page.tsx` (626 lignes) — pas de `layout.tsx`, `loading.tsx` ni `error.tsx` local **(vérifié source)**.
- Groupe Next.js : **`(app)`**, partagé avec ~35 autres routes authentifiées (`dashboard`, `scopes`, `resources`, `sites-geo`, `crma`, `nature`, `iro`, `materialite`, `intelligence/sources`, …) **(vérifié source)**.
- Badge produit : `<FeatureStatusBadge status="beta" />` (`water/page.tsx:196`) ; entrée registre `apps/carbon/data/feature-status.json:428-439`, id `eau-stress-hydrique`, `statut: "beta"`, `href: "/water"` **(vérifié source)**.
- Représentation géographique **sans carte externe par choix explicite** — commentaire en tête de fichier (`water/page.tsx:16-19`) : *« représentation géographique SANS carte externe (aucun Mapbox, aucun PostGIS) : pas de domaine CSP à ouvrir, pas de méthode maquillée »* **(vérifié source)**.

### Mécanisme d'authentification

- Pas de `middleware.ts` dans `apps/carbon`. Le fichier a été migré vers `apps/carbon/proxy.ts` (convention Next 16, commit `4a52439`). `proxy.ts` ne contient **aucune logique d'auth** — uniquement les en-têtes de sécurité et la CSP (`proxy.ts:10-20, 49-99`) **(vérifié source)**.
- La garde est **côté client**, dans `apps/carbon/app/(app)/layout.tsx` :
  - `"use client"` (ligne 1) ; `useAuth()` (ligne 73) ;
  - `useEffect` de redirection : si `ready && auth.status !== "authenticated"` → `router.replace(\`/login?next=${encodeURIComponent(destination)}\`)` (lignes 79-89) ;
  - porte de rendu : `if (!ready || auth.status !== "authenticated") return null;` (ligne 96) — bloque le rendu de toute route enfant, y compris `/water`.
  - **(vérifié source)**
- Backbackstop réel côté serveur : jeton d'accès JWT gardé **en mémoire uniquement** (jamais `localStorage`), refresh token en cookie HttpOnly/Secure/SameSite=Lax (`apps/carbon/lib/hooks/use-auth.ts:54-63`) ; chaque endpoint API vérifie lui-même le Bearer JWT via `get_current_user`/`require_analyst`/`require_admin` (`apps/api/routers/auth.py:112-150`) — pas de middleware global côté FastAPI non plus (`apps/api/main.py:225-263`, aucun `dependencies=` au montage du routeur) **(vérifié source)**.
- **Conclusion :** le layer Next.js est une redirection UX, la frontière de sécurité réelle est le backend FastAPI par endpoint.

---

## 2. Client `apps/carbon/lib/api/water.ts` (402 lignes, lu intégralement)

Un seul fichier client sert à la fois `/water` **et** `/sites-geo` — aucun `lib/api/sites.ts` séparé n'existe **(vérifié source)**.

14 fonctions exportées, chacune mappée 1:1 sur un endpoint backend :

| Fonction | Méthode | Endpoint | Ligne |
|---|---|---|---|
| `fetchSitesGeo` | GET | `/sites/geo?limit=200` | 275 |
| `fetchGeocodeCandidates` | GET | `/sites/{siteId}/geocode-candidates?limit=100` | 279 |
| `proposeGeocodeCandidate` | POST | `/sites/{siteId}/geocode-candidates` | 286 |
| `reviewGeocodeCandidate` | POST | `/sites/{siteId}/geocode-candidates/{candidateId}/review` | 293 |
| `fetchWaterActivities` | GET | `/water/activities?limit=200` | 307 |
| `importWaterCsv` | POST | `/water/activities/import` | 311 |
| `reviewWaterActivity` | POST | `/water/activities/{activityId}/review` | 318 |
| `fetchWaterPermits` | GET | `/water/permits?limit=200` | 322 |
| `fetchWaterRiskAreas` | GET | `/water/risk-areas?limit=200` | 326 |
| `fetchWaterScreenings` | GET | `/water/screenings?limit=100` | 332 |
| `calculateWaterScreening` | POST | `/water/screenings/calculate` | 338 |
| `flagScreeningForIro` | POST | `/water/screenings/{screeningId}/flag-for-iro` | 348 |
| `fetchWaterTargets` | GET | `/water/targets?limit=200` | 357 |
| `fetchWaterActions` | GET | `/water/actions?limit=200` | 361 |

Gestion spécifique HTTP 503 `schema_not_ready` → `SchemaNotReadyError` (lignes 227-236). Types/interfaces exportés : `ReviewStatus`, `CandidateStatus`, `GeocodePrecision`, `WaterActivityType`, `StressCategory`, `SiteGeo`, `GeocodeCandidate`, `WaterActivity`, `WaterImportResult`, `WaterPermit`, `WaterRiskArea`, `MatchedArea`, `WaterScreeningData`, `WaterScreeningEnvelope`, `WaterScreeningSummary`, `WaterTarget`, `WaterAction`, `Paginated<T>` **(vérifié source)**.

---

## 3. Modèles backend liés à l'eau

`apps/api/models/water.py` (372 lignes) contient **uniquement des DTO Pydantic** (requêtes/réponses) — **pas de couche ORM SQLAlchemy** ; l'accès se fait en SQL brut via `psycopg` dans les services (`apps/api/services/water/*.py`). Le docstring du fichier le dit explicitement : « champs snake_case alignés sur les colonnes SQL » (`models/water.py:7`). Invariant de type : `risk_category` et `confidence` sont toujours deux champs séparés, jamais fusionnés (`models/water.py:10-12`) **(vérifié source)**.

### Tables réelles (vérité = migrations, pas `models/water.py`)

| Table | Migration | Points clés |
|---|---|---|
| `water_activities` | `036:240-289` | ledger prélèvement/consommation/rejet ; unique `(company_id, site_id, activity_type, source_type, period_start, period_end)` |
| `water_imports` | `036:211-229` | sha256 + `UNIQUE(company_id, sha256)`, import CSV idempotent |
| `water_permits` | `036:295-331` | volume autorisé, validité, `evidence_artifact_id` |
| `water_risk_areas` | `036:347-401` | `company_id` nullable (zones globales ou tenant), `source_release_id BIGINT NOT NULL` (aucune zone sans release sourcée), `boundary_geojson JSONB NOT NULL` |
| `site_water_screenings` | `037:38-142` | `risk_category` et `confidence` = 2 colonnes CHECK-contraintes indépendantes, sans contrainte de lien entre elles ; **immuable** via trigger `site_water_screening_immutability_guard` (seuls `iro_signal*`/`updated_at` restent modifiables) |
| `water_targets` | `037:147-188` | cible eau, statut draft/active/achieved/abandoned |
| `water_actions` | `037:195-232` | action eau ; `expected_reduction_m3` n'est jamais auto-appliqué (convention, pas contrainte DB) |
| `sites` (extension géo) | `036:67-102` | `latitude`/`longitude`, `geocode_review_status` par défaut `'pending'`, CHECK interdisant un statut « accepted » sans lat+lon+réviseur |
| `site_geocode_candidates` | `036:116-204` | **append-only** via trigger `site_geocode_candidate_guard` |

Toutes RLS gen-2 (`ENABLE`+`FORCE`). **(vérifié source, lecture intégrale des migrations 036 et 037)**

**Décision géospatiale validée en-tête de migration 036 (lignes 13-26) : PAS DE POSTGIS** — aucune extension, aucun type `geography`/`geometry`, aucun `ST_*`. Confirmé par lecture intégrale de 036 et 037 : zéro occurrence **(vérifié source)**. Un test dédié `test_pr08_migrations_contain_no_postgis_reference` est cité par `PR08_WATER_GEOSPATIAL_TRACEABILITY.md:25` mais n'a pas été ouvert indépendamment **(doc historique, non revérifié pour l'existence exacte du test — l'absence de PostGIS elle-même EST vérifiée par lecture directe)**.

### Migration la plus récente touchant le domaine eau

`043_resource_exposures_assessments.sql` (Module 2) ajoute `company_resource_exposure_links.water_activity_id BIGINT REFERENCES water_activities(id)` (ligne 97) — un pont vers Module 2, sans modifier `water_activities` elle-même **(vérifié source)**. C'est la migration la plus haute du dépôt à ce jour ; une note de handoff antérieure mentionnant `schema_version=041` est donc **obsolète** par rapport à l'état actuel du disque (042 et 043 existent).

`038_nature_leap_foundation.sql` réutilise strictement le moteur géo de PR-08 pour la biodiversité (« AUCUN NOUVEAU MODÈLE GÉOSPATIAL », ligne 17) — précédent direct de réutilisation inter-module du même vocabulaire `method_code` **(vérifié source)**.

---

## 4. Routes API `/water/*` et `/sites/geo*`

### `apps/api/routers/water.py` (454 lignes, préfixe `/water`, `main.py:259`) — 20 routes, toutes sous `schema_ready_guard()`

GET = tout utilisateur authentifié du tenant (`get_current_user`) ; POST = analyste (`require_analyst`), sauf mention contraire. `risk-areas` est **lecture seule** (aucun endpoint d'écriture — ingestion réservée au CLI, cf. §5) **(vérifié source, docstring `water.py:1-35` + table de routes cohérente)**.

`activities/import`, `imports/{id}/review`, `activities` (POST/GET), `activities/{id}/review`, `permits` (POST/GET/{id}/review), `risk-areas` (GET seul), `screenings/calculate`, `screenings` (GET/{id}), `screenings/{id}/flag-for-iro`, `targets` (POST/GET/{id}/review), `actions` (POST/GET/{id}/review).

### `apps/api/routers/sites.py` (173 lignes, préfixe `/sites`, `main.py:241`) — 7 routes

| Route | Auth | Rôle |
|---|---|---|
| GET `/sites` | `get_current_user` | v1, migration 027, inchangée |
| POST `/sites` | `require_analyst` | v1, inchangée |
| GET `/sites/geo` | `get_current_user` | liste sites + position + statut de revue |
| GET `/sites/{id}/geocode-candidates` | `get_current_user` | historique des propositions |
| POST `/sites/{id}/geocode-candidates` | `require_analyst` | proposer un candidat |
| POST `/sites/{id}/geocode-candidates/{cid}/review` | `require_analyst` | accepter/rejeter — l'acceptation promeut la position sur `sites` |
| POST `/sites/{id}/geocode/flag` | `require_analyst` | révoquer l'usabilité d'une position acceptée |

`SiteGeoResponse.position_usable` est **dérivé côté serveur**, vrai uniquement si `geocode_review_status == "accepted"` (`apps/api/models/geo.py:81-100`). Service `apps/api/services/geo/geocode_service.py` importé par le routeur mais **non lu intégralement par l'audit** — non vérifié au-delà de ce qui est cité via `screening_service.get_accepted_position` **(non vérifié en détail — flag explicite)**.

---

## 5. Moteur de screening et services

- `apps/api/services/calculations/water_screening.py` (298 lignes) — fonction pure `run_screening()`, « no I/O, no DB, no clock, no network » (ligne 5-6) **(vérifié source)**.
- **4 conditions de refus explicites, jamais silencieuses** (`WaterScreeningRefusal`) : position non `accepted`/coordonnées manquantes ; précision `country` exclue (seules `exact/street/manual/city` acceptées) ; `total_area_count == 0` (référentiel vide **refusé**, jamais traité comme « pas de risque ») ; toute zone candidate dont la source n'autorise pas `derived_use` (refus global, sources nommées).
- **Risque** = ordinal maximum parmi les zones **appariées uniquement** ; `None` si aucun appariement — jamais dérivé de la confiance ni de la précision.
- **Confiance** = calcul totalement séparé (base par précision de géocodage − pénalité du pire statut de donnée parmi les zones appariées − pénalité de péremption, plancher 5).
- Empreinte déterministe (`input_fingerprint`, sha256) pour la reproductibilité.
- `apps/api/services/water/risk_areas_service.py` : écriture (`register_area`) réservée au CLI/admin — jamais un endpoint utilisateur (`risk_areas_service.py:6-8` : *« passe EXCLUSIVEMENT par le CLI d'administration... ou un workflow GitHub Actions protégé, JAMAIS par une requête utilisateur »*).
- `apps/api/scripts/import_water_risk_areas.py` (104 lignes) : script opérateur, lit un GeoJSON local, exige `--source-release` (aucune zone sans release Evidence Kernel), aucun appel réseau/LLM.

**(vérifié source pour l'ensemble de cette section)**

---

## 6. Source Admin / Evidence Kernel

### Tables (migration `028_evidence_kernel.sql`)

| Table | Rôle | Champs clés |
|---|---|---|
| `source_registry` | catalogue des sources | `code` (source_code), `source_type`, `automated_access_allowed`, `storage_allowed`, `commercial_use_allowed`, `redistribution_allowed`, `derived_use_allowed`, `display_allowed`, `attribution_text`, `company_id` nullable (globale vs tenant) |
| `source_releases` | version d'une release | `release_key`, `published_at`, `retrieved_at`, `valid_from/valid_to`, `checksum_sha256` (64 car.), `status` (detected→quarantined/validated→published→superseded / blocked_license), `UNIQUE(source_id, release_key, checksum_sha256)` |
| `evidence_artifacts` | fichier probant | `blob_key`, `sha256`, `filename`, champs de localisation (page/table/cellule/extrait), `sensitivity` CHECK |
| `observations` | valeur mesurée | `subject_type/key`, `metric_code`, valeur typée (≥1 requise), `source_release_id NOT NULL`, `data_status` CHECK (`verified/estimated/manual/inferred`), `confidence [0,1]`, `methodology_version`, `supersedes_id` (chaîne de correction) |

Immutabilité par trigger unique `evidence_kernel_guard()` : `observations` figées à vie (correction = nouvelle ligne via `supersedes_id`) ; `source_releases` libre jusqu'à `published`, puis seul `published→superseded` autorisé ; `evidence_artifacts` refusent suppression/changement de hash une fois référencées. RLS gen-2 partout. **(vérifié source, lecture intégrale de 028)**

### Contrat `SourceAdapter`

`apps/api/services/intelligence/adapters/base.py` — `typing.Protocol` (pas une ABC), 4 méthodes : `detect_releases() -> list[ReleaseCandidate]`, `fetch_release(candidate) -> bytes`, `parse(raw) -> Any`, `normalize(parsed) -> list[ObservationDraft]`. Invariants : déterministe/idempotent, aucune logique métier, aucun réseau, aucun LLM, ne peut pas publier lui-même (la publication est gérée en aval par `release_service.publish_release()` via `license_policy`).

**Seule implémentation livrée : `FakeAdapter`** (`adapters/fake.py`) — lit un fichier local, délègue la normalisation à un callable injecté. **Aucun connecteur réel (Aqueduct, Hub'Eau, etc.) n'existe dans le code actuel** — confirmé absent, docstring `fake.py:11-12` : *« C'est l'unique adaptateur livré... Les connecteurs réels... sont explicitement hors périmètre »*. **(vérifié source)**

### Source Admin (aucune route littéralement nommée ainsi)

Frontend : `/intelligence/sources`, `/intelligence/sources/{id}`, `/intelligence/freshness` — dans le groupe `(app)`. Backend `apps/api/routers/intelligence.py` (préfixe `/intelligence`) : 12 endpoints — GET = tout utilisateur, POST = analyste, `validate`/`publish`/`supersede` = **`require_admin`**. Endpoint public sans auth : `GET /health/intelligence` (sources globales uniquement). **(vérifié source)**

### Politique de licence (`apps/api/services/intelligence/license_policy.py:17-71`)

- Bloquant (empêche `allow_ingest`/`allow_store`/`allow_display`) : `automated_access_allowed=false`, `storage_allowed=false`, `display_allowed=false`, `active=false`.
- Avertissement seul (pas de blocage) : `derived_use_allowed=false`, `commercial_use_allowed=false`, `redistribution_allowed=false`.
- **La porte de publication** (`release_service.publish_release()`) ne teste que `allow_ingest AND allow_store` — **`display_allowed` n'en fait pas partie** ; il gate la **redaction à la lecture** d'une valeur individuelle (ex. `models/water.py:167-170` : un `baseline_stress_category` est renvoyé avec `value_withheld=True` si la licence interdit l'affichage). **Conséquence directe pour P10 (assembleur de snapshots) : la redaction doit être répliquée à la construction du read model public, ce n'est pas automatique au moment de la publication de la release.**

### Composants UI réutilisables

`components/intelligence/` : `EvidenceList`, `LicenseWarning`, `StalenessWarning`, `SourceDrawer`, `ReviewGate`, `IroCandidateButton`. `components/ui/` : `DataStatusBadge`/`dataStatusToBadge()` (mapping canonique unique `data_status→badge`), `FeatureStatusBadge`. **(vérifié source)**

⚠️ **Piège identifié :** un second système « provenance » sans rapport existe — `components/ui/provenance-integrity-card.tsx`, `kpi-with-provenance.tsx`, `kpi-provenance-drawer.tsx` — qui rend la chaîne de hash `facts_events` (audit KPI plus ancien, `services/facts_service.py`), architecturalement **distincte** du Evidence Kernel malgré un nom proche. À ne pas confondre lors de P02+.

### Consommateurs existants du Evidence Kernel

- **`/resources` (Module 2)** : consommateur profond, 4 tables avec FK `source_release_id`/`evidence_artifact_id` (migrations 042/043).
- **`/materials`** : référence **UI seule**, pas un consommateur live — `MaterialsProvenance.tsx` code en dur `CARBONCO_DEMO_SNAPSHOT` et ne fait **aucun appel API** (`MaterialsProvenance.tsx:6-8,23`). Les données ont été migrées une fois dans le kernel, mais la page publique rend toujours un JSON local statique — choix délibéré documenté (« fallback préservé »).
- **`/water`** : consommateur profond et **seul précédent existant du couple « zone de risque + redaction gérée par licence »** — mais `/water` est authentifié, pas public. **Aucun précédent existant d'une page PUBLIQUE lisant le Evidence Kernel en direct** — P04/P10 défrichent ce terrain, ce n'est pas une simple réutilisation d'un pattern déjà éprouvé en exposition publique.
- **Revue IA (PR-11)** : `grounding_service.py` joint `evidence_artifacts`/`source_releases`/`source_registry` pour les citations.

**(vérifié source pour l'ensemble)**

---

## 7. Liens potentiels avec `/materials`, `/resources`, `/iro`, `/materialite`

| Route | Existe | Groupe | Sous-routes |
|---|---|---|---|
| `/materials` | oui | **public**, hors `(app)` | `page.tsx`, `[id]/page.tsx` |
| `/resources` | oui | `(app)`, authentifié | `page.tsx`, `[slug]`, `assessments`, `exposures`, `methodology` |
| `/iro` | oui | `(app)`, authentifié | `page.tsx`, `[id]/page.tsx` |
| `/materialite` | oui | `(app)`, authentifié | `page.tsx` seul |

`/materials` est la **seule route publique existante en dehors de `/demo`** — précédent architectural direct pour `/water-intelligence` (voir §8). `/resources`, `/iro`, `/materialite` sont tous authentifiés comme `/water` ; le pont vers eux (prévu en P14) se fera donc depuis le cockpit `/water` authentifié, pas depuis le futur module public. **(vérifié source)**

---

## 8. Garde-fous déjà présents dans le dépôt

- **Aucun `middleware.ts`** ; `apps/carbon/proxy.ts` porte la CSP (`connect-src` : self, `*.vercel.app`, `*.vercel.sh`, `ai-gateway.vercel.sh`, `api.anthropic.com`, Vercel Analytics/Speed Insights, Sentry conditionnel, localhost en dev) — **aucune directive `worker-src`** actuellement.
- **Le motif Mapbox est révolu.** Le correctif historique (`b753538`, PR #82) a été rendu caduc par `c2d0aa4` (refonte `/materials` sur D3/TopoJSON/World Atlas, `apps/carbon/components/materials/map/WorldMap.tsx`, `lib/mapbox.ts` supprimé). `/water` et `/sites-geo` répètent le même choix explicite (« SANS carte externe »), et le prompt P11 déjà présent dans ce dépôt (`docs/carbonco/water-intelligence/prompts/P11_INTERACTIVE_MAP.md:34,55-56`) impose de continuer sur D3/TopoJSON et interdit Mapbox/Google Maps/tuiles externes — **aucune réouverture de CSP n'est donc anticipée pour `/water-intelligence`**.
- **Convention « public par défaut hors `(app)` »** : le layout racine (`apps/carbon/app/layout.tsx`) n'applique aucune garde ; seul le groupe `(app)` s'auto-protège côté client. `app/materials/` et `app/demo/` (celui-ci avec un `layout.tsx` **serveur**, `robots: {index:false, follow:false}`) sont deux précédents directs pour un nouveau segment public `app/water-intelligence/`.
- **Registre de statut produit unique** : `apps/carbon/lib/feature-registry.ts` + `data/feature-status.json`, source de vérité affichée sur `/etat-du-produit`, `/couverture`, etc. Aucune entrée `water-intelligence` n'existe encore.
- **`sitemap.ts`/`robots.ts`** existent, ne mentionnent ni `/water` ni `/materials` ni `/demo` — leur absence n'est donc pas une anomalie pour un module encore non lancé. `robots.ts` ne désautorise que `/api/` et `/dashboard/`.
- **Recherche globale « water-intelligence »** sur `apps/carbon`, `apps/api`, `apps/neural` : **zéro occurrence** en dehors de l'arborescence `docs/carbonco/water-intelligence/` elle-même — aucune collision de nom, terrain libre.

**(vérifié source pour l'ensemble)**

---

## 9. Décision sur les données brutes, dérivées et publiées

Cette section répond explicitement au critère d'acceptation P00 du pack maître. Elle s'appuie sur les patterns déjà en place (§5, §6) plutôt que sur une invention :

- **Brutes** : fichiers/réponses tels que récupérés d'un portail source (CSV Hub'Eau, release Aqueduct, etc.). Ne transitent jamais par une requête utilisateur ni par le bundle frontend ; conservées comme `evidence_artifacts` (`blob_key`) hors du dépôt Git, à l'exception de fixtures minimales de test — pattern déjà en vigueur pour `water_permits.evidence_artifact_id` et pour tout le Evidence Kernel.
- **Dérivées** : résultats de calcul déterministe à partir d'observations sourcées — ex. `site_water_screenings.result` (moteur pur `water_screening.py`) ou le futur snapshot public de P10. Toujours reproductibles (empreinte sha256), jamais recalculées côté client.
- **Publiées** : sous-ensemble des dérivées effectivement exposées à `/water-intelligence`, filtré par `display_allowed` au niveau de chaque valeur (pattern `value_withheld`, §6) — jamais l'intégralité d'une release, jamais une donnée tenant.

---

## 10. Éléments manquants avant P01

1. **Aucun connecteur réel** n'existe (seul `FakeAdapter`) — P05/P06/P07/P08/P09 seront les premières implémentations réelles du contrat `SourceAdapter`, sans exemple concret à copier au-delà du contrat + du faux adaptateur.
2. **Aucun précédent d'exposition publique du Evidence Kernel** — `/materials` (seule route publique existante) ne l'interroge pas en direct ; `/water` (seul consommateur profond avec redaction par licence) est authentifié. P04/P10 sont donc les premiers à tester ce couple en contexte public, pas une simple répétition d'un pattern déjà validé en production publique.
3. **Aucune route, entrée de navigation, `sitemap.ts` ou `feature-registry` pour `water-intelligence`** — terrain vierge, cohérent avec l'absence d'anomalie relevée en §8.
4. **`geocode_service.py`** (dépendance indirecte de `screening_service.get_accepted_position`) n'a pas été lu intégralement par cet audit — à vérifier avant toute mission qui en dépendrait directement.
5. **Écart de méthodologie déjà identifié hors P00** (revue PR #141) : le critère d'acceptation P01 du pack maître ne mentionne que « les 12 lignes » du CSV opérateur, alors que celui-ci contient 16 lignes (12 `user_csv` + 4 `recommended_addition` : WRI Aqueduct, EEA/WEI+, Copernicus EDO, USGS) — les 4 sources recommandées, pourtant nécessaires à P05/P06/P09, ne sont pas explicitement couvertes par le critère d'acceptation actuel de P01. Non corrigé ici (le pack maître et son extrait sont des copies conformes non altérées, cf. `docs/carbonco/water-intelligence/prompts/P01_SOURCE_CATALOG.md`) — signalé pour arbitrage avant de lancer P01.
6. **Note de handoff antérieure obsolète** : une mémoire de session précédente indique `schema_version=041` ; le dépôt contient en réalité jusqu'à la migration `043`. À corriger dans toute future note de statut qui la citerait.
