# PR-09 — Biodiversité / TNFD LEAP · Plan d'implémentation

**Branche prévue :** `feat/nature-leap`
**Phase du plan d'architecture :** Phase 8 (`PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md` §14, §20) — « Nature LEAP ».
**Statut de ce document :** plan uniquement. Aucune écriture de code, aucune migration, aucune donnée. Rien commité hors `docs/carbonco/refonte/`.
**Contrats communs :** `WAVE_2_INTERFACE_CONTRACTS.md`, `WAVE_4_INTERFACE_CONTRACTS.md`.
**Dépendance directe :** `PR08_WATER_GEOSPATIAL_IMPLEMENTATION_PLAN.md` — PR-09 **réutilise** le modèle géospatial de PR-08 (`sites` étendue, `geom`/repli boîte-englobante, `site_geocode_candidates`), il ne le re-spécifie pas.

> **Constat de départ.** Aucune donnée de biodiversité n'existe dans ce dépôt à ce jour (confirmé par la même recherche que PR-08 : zéro trace de PostGIS, aucune table `nature_*`). Le seul précédent de modélisation « chaîne de valeur + dépendance + score séparé du niveau de confiance » est CRMA (migration `034`, `services/crma/scoring.py`) — PR-09 en est le prolongement direct côté nature, pas une architecture nouvelle. Le seul précédent géospatial est celui que PR-08 vient de poser.

---

## 1. Périmètre

Localiser les opérations et la chaîne de valeur du tenant par rapport à des éléments naturels sensibles, distinguer explicitement **dépendances** (l'entreprise a besoin d'un service écosystémique) et **impacts** (l'entreprise affecte la nature) — la distinction centrale du TNFD, jamais confondue — puis faire progresser un dossier LEAP (**L**ocate, **E**valuate, **A**ssess, **P**repare) jusqu'à un brouillon de disclosure, toujours sous revue humaine. Découpé en deux tranches, alignées sur les quatre phases LEAP ; **PR-09A** réserve la migration `037`.

**PR-09A (migration `037`) — Locate + Evaluate : fondation factuelle :**
1. **`nature_features`** : référentiel des éléments/zones sensibles (aires protégées, zones clés pour la biodiversité — KBA —, écosystèmes), mixte tenant/global, **toujours sourcé** via Source Admin, avec masquage des données sensibles (§5).
2. **`site_nature_intersections`** (**Locate**) : intersection site × élément naturel — réutilise le modèle géospatial de PR-08 (`sites.geom` ou repli boîte-englobante), résultat factuel/déterministe, pas un score.
3. **`nature_dependencies`** / **`nature_impacts`** (**Evaluate**) : dépendances et impacts identifiés, **jamais fusionnés dans une même table ni un même champ** — deux entités distinctes dès le schéma.
4. **`leap_assessments`** / **`leap_assessment_sites`** : le dossier LEAP lui-même, ouvert dès Locate, dont le champ `phase` progresse (`locate → evaluate → assess → prepare → completed`) au fil des tranches A et B.
5. **Gate de revue humaine sur chaque dépendance/impact** — aucune conclusion automatique, même partielle.

**PR-09B (indicatif, migration non réservée ici) — Assess + Prepare : évaluation et restitution :**
6. **`nature_risks`** / **`nature_opportunities`** (**Assess**) : risque et opportunité scorés, **risque séparé de la confiance**, motif CRMA repris à l'identique.
7. **`nature_actions`** (calqué sur `mitigation_actions`, 034).
8. **`tnfd_disclosure_drafts`** (**Prepare**) : brouillon de disclosure, jamais un rapport « prêt à publier » automatiquement — gate humain obligatoire avant tout export.

**Pourquoi cette coupure A/B et pas une autre.** Locate et Evaluate produisent des **faits vérifiables et sourcés** (une intersection géométrique, une dépendance identifiée et documentée) — même nature d'effort que PR-05A/PR-06A (capture de données, gate de revue, pas de calcul de risque). Assess et Prepare produisent des **jugements dérivés** (un score, un brouillon narratif) — même nature que PR-05B/PR-06B. Le dossier `leap_assessments` traverse les deux tranches par construction (son `phase` avance), exactement comme un `crma_article24_assessments` existe en `draft` avant d'être rempli par un calcul puis approuvé.

---

## 2. Hors périmètre

- **Aucune conclusion automatique** — proximité ≠ impact, dépendance ≠ risque financier (règle du plan §14.2, reprise verbatim) ; aucun service PR-09 ne dérive un risque directement d'une intersection géométrique sans passage par une évaluation revue.
- **Aucun rapport TNFD présenté comme certifié ou officiellement conforme** — `tnfd_disclosure_drafts` porte un disclaimer explicite (§7), même discipline que `Article24Report.is_official_eu_score=False` (CRMA, 034).
- **Pas de nouveau modèle géospatial** — réutilisation stricte de ce que PR-08 livre (`sites` étendue, PostGIS ou repli documenté). PR-09 ne réinvente ni ne duplique `sites`/`site_geocode_candidates`.
- **Pas de table de dataset séparée** (`nature_dataset_releases` du plan §14.1 n'est **pas** créée — `source_releases`/`evidence_artifacts` (028) couvrent déjà ce besoin génériquement ; même correction que celle appliquée à PR-08 pour `water_dataset_releases`, justifiée en `WAVE_4_INTERFACE_CONTRACTS.md` §4).
- **Pas de table `nature_pressures` séparée** — la pression (au sens TNFD : changement d'usage des terres/eau, exploitation de ressources, changement climatique, pollution, espèces invasives) est modélisée comme un **attribut** de `nature_impacts` (`pressure_type`), pas comme une entité autonome avec son propre cycle de vie — elle n'existe pas indépendamment d'un impact qui la matérialise.
- **Pas de publication automatique d'un brouillon de disclosure.**
- **PR-09B (Assess/Prepare) hors de PR-09A** — ce plan cadre les deux, réserve `037` pour A uniquement.

---

## 3. Dépendances

| Élément | Rôle dans PR-09 |
|---|---|
| `sites` étendue + `site_geocode_candidates` (PR-08, `036`) | fondation géospatiale du **Locate** — PR-09 ne fonctionne pas sans PR-08 mergée et son statut PostGIS/repli déjà tranché |
| `source_registry`/`source_releases`/`evidence_artifacts` (028) | sourcer tout dataset nature externe (aires protégées, KBA) — `WAVE_4_INTERFACE_CONTRACTS.md` §4 |
| `material_id TEXT` sans FK, `material_groups`/`material_group_members` (034) | lier une dépendance nature à un groupe de matières CRMA (ex. une extraction minière dépendante de l'eau) — même convention `TEXT` sans FK fantôme, le référentiel `materials` n'existe toujours pas |
| `bom_items` (030) | lien réel (FK) entre une dépendance/un impact et un composant de nomenclature, quand pertinent |
| `services/crma/scoring.py` (034) | **précédent direct** du motif de score risque/confiance séparé — PR-09 l'étend, n'en invente pas un second (`WAVE_4_INTERFACE_CONTRACTS.md` §6) |
| `services/crma/article24_service.py::review()` | motif de la fonction de revue humaine (`reviewed_by` non optionnel, refus de calculer sur une évaluation déjà approuvée) — répliqué pour `leap_assessments` |
| `claim_evidence_links` + `claim_link_service.py` | lier une dépendance/un impact/un risque à une preuve complémentaire |
| `models/analytics.py::AnalyticalEnvelope` | forme des endpoints de calcul PR-09B — import direct (`WAVE_4_INTERFACE_CONTRACTS.md` §9) |
| `evidence_artifacts.sensitivity` (public/internal/confidential/restricted) + proxy authentifié | motif de masquage des données sensibles (§5) — réutilisé, pas réinventé |
| `routers/_errors.py` | erreurs HTTP partagées |

---

## 4. Migration réservée : `037` (PR-09A)

**`037_nature_leap.sql`** — référentiel nature, intersections, dépendances/impacts, dossiers LEAP (PR-09A). Le scoring (PR-09B) prendra un numéro non réservé ici (renumérotation au merge, `WAVE_4_INTERFACE_CONTRACTS.md` §13).

Toutes les tables de cette migration sont des `CREATE TABLE` neufs — **pas** de privilège propriétaire requis (comme 028/030/031/034 ; à la différence de PR-08 qui touche `sites`). RLS gen-2 complète : `ENABLE`+`FORCE`, policies scopées par commande, `DROP POLICY IF EXISTS`, `app.rls_bypass`, sonde `_probe_037` + enregistrement, `build_full_db` mis à jour, tests DB-gated dans `migration-tests`, GRANT conditionnel `carbonco_app`.

`nature_features` dépend, pour son intersection avec `sites`, de la même géométrie que PR-08 (`geography(...)` ou repli). **Si PR-08 a livré le repli boîte-englobante** (PostGIS non confirmé à temps), `site_nature_intersections` utilise le même mécanisme et le même `meta.method.code` explicite — pas une seconde décision indépendante.

---

## 5. Tables (PR-09A)

Toutes : `id BIGSERIAL`, `created_at`/`updated_at`, RLS FORCE.

| Table | Colonnes clés | Notes |
|---|---|---|
| `nature_features` | `company_id BIGINT NULL` (référentiel mixte, motif 034), `code`, `label`, `feature_kind TEXT` (protected_area/kba/ecosystem/other), `geom geography(...)` ou repli bbox/GeoJSON (§ PR-08), `sensitivity TEXT NOT NULL DEFAULT 'public'` (public/internal/confidential/restricted — **vocabulaire identique à `evidence_artifacts.sensitivity`**, 028), `source_release_id BIGINT NOT NULL REFERENCES source_releases(id)`, `data_status` | **Toujours sourcée** (`source_release_id NOT NULL`, motif `material_market_observations`/`water_risk_areas`). Masquage : §5 ci-dessous. |
| `site_nature_intersections` | `company_id BIGINT NOT NULL`, `site_id BIGINT REFERENCES sites(id)`, `feature_id BIGINT REFERENCES nature_features(id)`, `relation_kind TEXT` (intersects/within/buffer_km), `distance_km NUMERIC`, `computed_at TIMESTAMPTZ`, `method_code TEXT NOT NULL` | Résultat **factuel** (Locate) — pas un score ; `method_code` nomme explicitement PostGIS ou le repli (jamais silencieux). |
| `nature_dependencies` | `company_id BIGINT NOT NULL`, `site_id BIGINT REFERENCES sites(id)` NULL, `bom_item_id BIGINT REFERENCES bom_items(id)` NULL, `material_id TEXT` NULL (sans FK, motif 034), `ecosystem_service TEXT` (freshwater/pollination/soil_stability/other), `dependency_level TEXT` (low/medium/high/critical — palier qualitatif explicite, jamais un score opaque), `rationale TEXT`, `data_status`, `review_status TEXT NOT NULL DEFAULT 'pending'` (pending/accepted/flagged), `source_release_id`, `evidence_artifact_id` | **Distincte par construction** de `nature_impacts` — aucune colonne commune ne les fusionne. |
| `nature_impacts` | `company_id BIGINT NOT NULL`, `site_id`, `bom_item_id`, `material_id TEXT`, `pressure_type TEXT` (land_use_change/water_use/resource_exploitation/climate_change/pollution/invasive_species/other — catégories reprises du LEAP Guidance TNFD à titre indicatif, **À CONFIRMER** liste exacte au démarrage de PR-09), `impact_kind TEXT` (positive/negative), `magnitude_qualitative TEXT` (low/medium/high/critical), `rationale TEXT`, `data_status`, `review_status`, `source_release_id`, `evidence_artifact_id` | Le `pressure_type` porte la pression comme **attribut** de l'impact (§2) — pas de table séparée. |
| `leap_assessments` | `company_id BIGINT NOT NULL`, `label TEXT`, `phase TEXT NOT NULL DEFAULT 'locate'` (locate/evaluate/assess/prepare/completed), `status TEXT NOT NULL DEFAULT 'draft'` (draft/under_review/approved), `prepared_by`, `approved_by`, `approved_at` | Le dossier traverse A et B ; `status`/`approved_by` suivent le motif `crma_article24_assessments`. |
| `leap_assessment_sites` | `company_id BIGINT NOT NULL`, `assessment_id BIGINT REFERENCES leap_assessments(id)`, `site_id BIGINT REFERENCES sites(id)` | Table d'association M:N — un dossier LEAP peut couvrir plusieurs sites. |

**PR-09B (indicatif, non réservé) :** `nature_risks`/`nature_opportunities` (colonnes `risk_score`/`likelihood`/`confidence` séparées, `components JSONB` inspectable, motif `crma_article24_assessments`) ; `nature_actions` (calqué `mitigation_actions`) ; `tnfd_disclosure_drafts` (`is_official_tnfd_disclosure BOOLEAN NOT NULL DEFAULT false`, `disclaimer TEXT`, `status` draft/under_review/approved — jamais `published` sans passage humain).

---

## 6. Masquage des données sensibles (précision du plan §14.2)

Le plan pose la règle (« données sensibles masquées ») sans mécanisme. PR-09 **réutilise** le vocabulaire et le patron déjà en vigueur pour `evidence_artifacts.sensitivity` (028, `WAVE_2_INTERFACE_CONTRACTS.md` §3) plutôt que d'en inventer un troisième :

- `nature_features.sensitivity ∈ {public, internal, confidential, restricted}` — même CHECK, même vocabulaire.
- Une ligne `confidential`/`restricted` (ex. localisation précise d'une espèce menacée) ne renvoie **jamais** sa géométrie précise dans une liste standard (`GET /nature/features`) — seule une version généralisée (région, sans le polygone exact) est incluse. La géométrie précise n'est accessible que via un endpoint dédié, authentifié, à rôle élevé (`require_admin` ou équivalent), **jamais** une URL signée permanente — même discipline que le proxy d'artefacts confidentiels (`WAVE_2_INTERFACE_CONTRACTS.md` §3).
- Cette règle s'applique aussi à `site_nature_intersections` : l'intersection avec une zone `restricted` est visible (« ce site intersecte une zone sensible ») sans exposer la géométrie exacte de la zone à un utilisateur non autorisé.

---

## 7. Alignement TNFD — jamais une certification

Toute référence au TNFD dans l'interface ou un export est qualifiée **framework-informed**, jamais présentée comme une conformité officielle ou une certification — même discipline que `is_official_eu_score=False`/`disclaimer` sur le rapport Article 24 CRMA (`services/crma/scoring.py::DISCLAIMER`, `models/crma.py::Article24Report`). `tnfd_disclosure_drafts` porte `is_official_tnfd_disclosure=False` sérialisé dans tout export — un lecteur du JSON hors contexte applicatif doit pouvoir le constater sans deviner. Le vocabulaire LEAP (Locate/Evaluate/Assess/Prepare) est repris tel que publié par le TNFD à titre de structuration du processus, pas comme revendication de labellisation.

---

## 8. Services

### PR-09A
| Service | Responsabilité |
|---|---|
| `services/nature/features_service.py` | Ingestion du référentiel `nature_features` (via CLI/GitHub Actions protégé, comme `water_risk_areas`), masquage par `sensitivity` à la lecture. |
| `services/nature/locate_service.py` | Calcule `site_nature_intersections` (réutilise la primitive géospatiale de PR-08 — PostGIS ou repli, **même** `method_code`). |
| `services/nature/dependencies_service.py` | CRUD `nature_dependencies`, gate de revue (`pending/accepted/flagged`). |
| `services/nature/impacts_service.py` | CRUD `nature_impacts`, gate de revue. |
| `services/nature/leap_service.py` | Cycle de vie du dossier `leap_assessments` (création en `phase='locate'`, avancement de phase, `leap_assessment_sites`). |

### PR-09B (indicatif)
- `services/calculations/nature_screening.py` : score risque/opportunité — composantes séparées, disponibilité/indisponibilité renormalisée (motif `scoring.py` §6 des contrats Wave 4), jamais de fusion risque/confiance.
- `services/nature/disclosure_service.py` : assemble `tnfd_disclosure_drafts` à partir du dossier LEAP approuvé — n'invente rien, signale l'absence de donnée en `warnings` plutôt que de la combler (motif `article24_service.build_report`).

### Réutilisés
`artifact_service.register_artifact`, `license_policy.evaluate`, `claim_link_service.py`, `services/geo/geocode_service.py` (PR-08, indirectement via `sites`), `audit_service.log_event`, `export_package`.

---

## 9. Endpoints

### PR-09A (préfixe `/nature`)
- `GET /nature/features` — `get_current_user` — masquage par `sensitivity` (§6).
- `GET /nature/features/{id}/geometry` — `require_admin` — géométrie précise d'une zone `confidential`/`restricted`.
- `POST /nature/sites/{site_id}/locate` — `require_analyst` — calcule/rafraîchit `site_nature_intersections` pour un site.
- `GET /nature/sites/{site_id}/intersections` — `get_current_user`.
- `POST/GET /nature/dependencies`, `POST/GET /nature/impacts` — `require_analyst`/`get_current_user`.
- `POST /nature/dependencies/{id}/review`, `POST /nature/impacts/{id}/review` — `require_analyst` — gate `pending → accepted/flagged`.
- `POST /nature/leap-assessments` — `require_analyst` — crée un dossier en `phase='locate'`.
- `POST /nature/leap-assessments/{id}/advance-phase` — `require_analyst` — fait progresser `phase` (validations propres à chaque transition, ex. « evaluate » exige au moins une dépendance ou un impact revu).

### PR-09B (indicatif)
- `POST /nature/leap-assessments/{id}/assess` — `require_analyst` — `AnalyticalEnvelope`.
- `POST /nature/leap-assessments/{id}/review` — `require_admin` — approbation humaine (motif `article24_service.review`).
- `GET /nature/leap-assessments/{id}/disclosure-draft` — `require_analyst`.

Tous : pagination (`WAVE_2_INTERFACE_CONTRACTS.md` §5), erreurs (§6), isolation (§7), licence (§8).

---

## 10. Interface frontend

**Créer** une nouvelle vue Nature/LEAP (aucune page existante à étendre pour ce domaine).

- **Carte Locate** : sites du tenant superposés aux `nature_features` (réutilise la carte de revue de géocodage de PR-08 comme base), zones sensibles généralisées si `sensitivity` élevée.
- **Tableau Evaluate** : dépendances et impacts, **deux colonnes/onglets distincts**, jamais une liste fusionnée — badges `ReviewStatusBadge`.
- **Dossier LEAP** : timeline des 4 phases, état courant, actions disponibles selon la phase.
- **Disclosure draft (PR-09B)** : bandeau `is_official_tnfd_disclosure=false` visible en permanence, jamais masquable.
- Réutiliser `DataStatusBadge`, `ReviewStatusBadge`, `KpiProvenanceDrawer`, `ExportButtons`/`ExportPackageCard` ; créer `LicenseWarning`/`MethodBadge`/`ConfidenceBadge` seulement s'ils n'ont pas déjà été créés par PR-08 (règle « premier besoin réel crée », `WAVE_4_INTERFACE_CONTRACTS.md` §12).
- Client API : `apps/carbon/lib/api/nature.ts`.

---

## 11. Tests

- **Unitaires** : masquage par `sensitivity` (une géométrie `restricted` n'apparaît jamais dans la liste standard) ; distinction dépendance/impact au niveau des modèles (aucun champ partagé, aucune conversion implicite de l'un vers l'autre) ; progression de phase LEAP (transitions valides/invalides) ; scoring PR-09B (renormalisation sur composante indisponible, jamais comptée à zéro).
- **DB-gated (job `migration-tests`)** : migration `037` applicable après `036` ; RLS + défense en profondeur (tenant A ne voit pas les dossiers LEAP de B) ; `nature_features` refuse une ligne sans `source_release_id` ; gate de revue (`pending→accepted/flagged`).
- **API** : endpoints nature (auth, pagination, 404 sans fuite) ; `GET /nature/features/{id}/geometry` refusé à un rôle non `require_admin`.
- **Ledger** : `037` `pending` sur base `036` ; `plan`/`apply`/`verify` verts ; `_probe_037`.
- **Non-régression** : `sites`/`site_geocode_candidates` (PR-08) inchangés par l'ajout de `site_nature_intersections`.
- **Frontend** : carte Locate, tableau Evaluate (deux colonnes), timeline LEAP, bandeau disclaimer TNFD toujours visible ; accessibilité.

---

## 12. Fichiers à créer / modifier

### Créés (PR-09A, backend)
- `apps/api/db/migrations/037_nature_leap.sql`
- `apps/api/services/nature/__init__.py`, `features_service.py`, `locate_service.py`, `dependencies_service.py`, `impacts_service.py`, `leap_service.py`
- `apps/api/models/nature.py`
- `apps/api/routers/nature.py`
- `apps/api/scripts/intelligence/import_geospatial_dataset.py` (réutilisé/étendu depuis PR-08 pour les datasets nature, pas dupliqué)
- `apps/api/tests/test_nature_features.py`, `test_nature_locate.py`, `test_nature_dependencies.py`, `test_nature_impacts.py`, `test_leap_assessments.py`

### Modifiés (PR-09A, backend)
- `apps/api/main.py` (router `/nature`)
- `apps/api/db/migration_manifest.py` (`037`), `migration_probes.py` (`_probe_037`), `tests/_migration_fixtures.py`
- `.github/workflows/api.yml` (tests DB-gated)

### Créés (frontend)
- `apps/carbon/lib/api/nature.ts`
- `apps/carbon/app/(app)/nature/page.tsx` (nouvelle route)
- `apps/carbon/components/nature/*`

### Modifiés (frontend)
- `apps/carbon/app/(app)/layout.tsx` (entrée `pageConfig` pour `/nature`, motif CRMA) ; `data/feature-status.json` (feature BETA)

### PR-09B (indicatif, non dans PR-09A)
`db/migrations/0XX_nature_leap_scoring.sql`, `services/calculations/nature_screening.py`, `services/nature/disclosure_service.py`, `nature_risks`/`nature_opportunities`/`nature_actions`/`tnfd_disclosure_drafts`, endpoints `/nature/leap-assessments/{id}/assess|review|disclosure-draft`.

---

## 13. Risques

| Risque | Mitigation |
|---|---|
| **Dépendance PR-08 non stabilisée** (PostGIS/repli non tranché) | PR-09A ne démarre son `locate_service` qu'une fois PR-08A mergée et sa décision géospatiale connue — pas de duplication de la question. |
| **Confusion dépendance/impact** | Tables et modèles Pydantic strictement séparés dès le schéma (§5) ; test dédié interdisant tout champ partagé. |
| **Donnée sensible exposée** (localisation précise d'une espèce menacée) | Masquage par `sensitivity`, proxy à rôle élevé pour la géométrie précise (§6) ; test dédié. |
| **Disclosure présentée comme officielle** | `is_official_tnfd_disclosure=False` non contournable, sérialisé dans tout export ; revue de conception. |
| **Conclusion automatique de matérialité** (proximité → risque sans revue) | Gate de revue humaine systématique sur dépendances/impacts (§1) ; `nature_risks`/`nature_opportunities` (B) ne se déduisent jamais directement d'une intersection géométrique seule. |
| **Table de pression dupliquée inutilement** | Modélisée comme attribut de `nature_impacts`, pas comme entité séparée (§2) — revu si l'usage réel prouve le contraire. |
| Pas de PostgreSQL local | CI `migration-tests` = seule preuve. |
| Numéro `037` déjà pris | `command=plan` avant apply ; renuméroter au merge. |

---

## 14. Étapes d'implémentation

**PR-09A :**
1. Confirmer PR-08A mergée et sa décision géospatiale (PostGIS ou repli) connue.
2. Migration `037` (features/intersections/dépendances/impacts/dossiers LEAP) + sonde + fixtures + job CI.
3. `features_service` (ingestion + masquage), `locate_service` (réutilise la primitive géo de PR-08).
4. `dependencies_service`/`impacts_service` (+ gate de revue), `leap_service` (cycle de phase).
5. Router `/nature`.
6. Frontend : carte Locate, tableau Evaluate, timeline LEAP.
7. Tests complets ; `git diff --check` ; lint.

**PR-09B (PR séparée ultérieure) :** scoring risques/opportunités, actions, brouillon de disclosure.

---

## 15. Critères de merge (PR-09A)

- CI verte (`tests`, `migration-tests`, front, `validate`, `security-audit`, `gitleaks`).
- `ruff`/`git diff --check` propres ; TS strict.
- Séparation dépendance/impact vérifiée par un test dédié (aucun champ ni endpoint partagé).
- Masquage des données sensibles garanti (test automatisé, pas seulement une revue manuelle).
- Isolation tenant testée (RLS gen-2 + défense en profondeur).
- Aucune donnée nature sans source/release/licence vérifiée.
- Aucune conclusion de matérialité automatique — gate de revue humaine systématique.
- Aucune écriture prod par Claude. PR non mergée automatiquement.

---

## 16. Opérations post-merge

1. **Backup** avant écriture.
2. `db-migrate.yml` → `plan` (confirmer `037` `pending`, seul) → `apply` → `verify` → `/health/schema` `up_to_date:true` `schema_version:"037"`.
3. Vérification applicative : `GET /nature/features` (JWT) → 200, zones sensibles généralisées ; `POST /nature/leap-assessments` → dossier `phase='locate'`.
4. Observation 24-48h. Consigner `MIGRATIONS_RUNBOOK.md` §9.
5. **Gate Phase 8** (à l'issue de PR-09B) : « proximité, dépendance, impact et risque restent distincts » — vérifié.
6. PR-09B planifiée séparément une fois PR-09A stabilisée en prod.
