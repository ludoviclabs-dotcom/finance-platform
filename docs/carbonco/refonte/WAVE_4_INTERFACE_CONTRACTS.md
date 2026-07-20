# Wave 4 — Contrats d'interface communs (PR-08, PR-09, PR-10)

**But :** figer, en un seul endroit, les contrats partagés que PR-08 (géospatial/eau), PR-09 (biodiversité/TNFD LEAP) et PR-10 (IRO/double matérialité) doivent tous respecter, pour qu'ils soient développés en s'appuyant sur les mêmes fondations qu'exploitent déjà les Waves 2 et 3. Ces contrats étendent — sans les dupliquer — `WAVE_2_INTERFACE_CONTRACTS.md` (Evidence Kernel, enveloppe analytique, pagination, erreurs, RLS, licence) et les précédents réellement livrés par PR-05A/B, PR-06A/B et PR-07.

**Provenance :** base = `origin/master` (`5be464d`), migrations `001` à `034` fusionnées (Waves 1-3 complètes : PR-01 materials, PR-02 ledger, PR-03 Evidence Kernel/028, PR-04 Source Admin/029, PR-05A+B procurement+Scope3/030+032, PR-06A+B énergie+Scope2/031+033, PR-07 CRMA/034). Toute affirmation ci-dessous sur le code existant a été **vérifiée par lecture directe** des fichiers cités — pas déduite du plan d'architecture seul. Là où le plan d'architecture (`PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md`) et le code réellement mergé divergent, ce document **suit le code** et le signale explicitement (même règle que `WAVE_2_INTERFACE_CONTRACTS.md`, note de cadrage en tête).

**Statut de ce document :** documentaire, gelant des conventions. Aucune écriture de code, aucune migration. Toute déviation d'un plan Wave 4 par rapport à ces contrats doit être justifiée dans la traçabilité de la PR concernée.

**Isolation de rédaction :** ce document a été préparé dans le worktree `wave4-plans` (branche `docs/intelligence-wave-4-plans`), en parallèle d'un worktree sœur `wave3-data-integrity` qui prépare une PR de stabilisation réservant la migration `035`. Cette PR n'est **pas mergée** au moment de la rédaction — elle n'est jamais citée ici comme une fondation acquise. Les réservations `036/037/038` (§13) supposent `035` mergée en premier ; si l'ordre réel diffère, elles se décalent (même règle que Wave 2 §10).

---

## 0. Sources de vérité

| Contrat | Fichier de référence (dans `master`) |
|---|---|
| Contrats Wave 2 (réutilisés tels quels sauf deltas §7) | `docs/carbonco/refonte/WAVE_2_INTERFACE_CONTRACTS.md` |
| Modèles Pydantic du noyau | `apps/api/models/intelligence.py` |
| Enveloppe analytique partagée | `apps/api/models/analytics.py` |
| Sites physiques (à étendre) | `apps/api/db/migrations/027_sites.sql`, `apps/api/routers/sites.py`, `apps/api/services/sites_service.py` |
| Sites fournisseurs (précédent géo léger) | `apps/api/db/migrations/030_procurement_exposure.sql` (table `supplier_sites`) |
| Énergie / Scope 2 (consommateur de `sites`) | `apps/api/db/migrations/031_energy_scope2.sql`, `033_scope2_calculation_engine.sql` |
| CRMA / matières critiques (précédent de score) | `apps/api/db/migrations/034_crma_material_exposure.sql`, `apps/api/services/crma/scoring.py`, `apps/api/models/crma.py` |
| Lien preuve↔claim | `apps/api/services/intelligence/claim_link_service.py` |
| Erreurs / DB indisponible | `apps/api/routers/_errors.py` |
| Manifeste de migrations (`requires_owner`) | `apps/api/db/migration_manifest.py` |
| Module double matérialité actuel (étendu par PR-10) | `apps/api/db/migrations/025_materialite_assessments.sql`, `apps/api/routers/materialite.py`, `apps/api/services/materialite_service.py` |
| Import idempotent + gate de revue (patron) | `apps/api/services/procurement/purchase_import_service.py`, `apps/api/services/import_screening_service.py` |
| Traçabilités Wave 2/3 | `PR05A_PROCUREMENT_FOUNDATION_TRACEABILITY.md`, `PR06A_ENERGY_FOUNDATION_TRACEABILITY.md`, `PR07_CRMA_MATERIAL_EXPOSURE_TRACEABILITY.md` |

---

## 1. Site & géographie — étendre `sites` (027), pas une table parallèle

**État réel de `sites` (migration 027, vérifié) :** `id BIGSERIAL, company_id INTEGER NOT NULL, name TEXT, location TEXT (adresse libre), naf_code, activity_type, created_at, updated_at`, `UNIQUE(company_id, name)`. Aucune colonne de coordonnées, aucune géométrie. RLS : `ENABLE` + `FORCE`, une policy `USING` sans `FOR` (s'applique par défaut à SELECT/UPDATE/DELETE) plus une policy `FOR INSERT` séparée — ni le motif gen-1 pur de 008b (pas de `FORCE`), ni le découpage complet par commande de 028+. `sites.company_id` est `INTEGER`, pas `BIGINT` (table antérieure au noyau). Consommateurs FK existants : `actions.site_id` (027), `energy_meters.site_id` et `energy_activities.site_id` (031). API actuelle minimale : `GET /sites`, `POST /sites` (pas de PATCH/DELETE, `routers/sites.py`).

**Décision gelée : ÉTENDRE `sites` par `ALTER TABLE`, ne pas créer de table géographique parallèle.**

Justification :
- `sites` est déjà l'entité canonique « implantation physique », référencée par MACC (`actions`) et par Scope 2 (`energy_meters`/`energy_activities`). Une donnée d'eau ou de biodiversité est un **attribut d'un lieu**, pas un concept séparé — une table compagnon obligerait chaque consommateur (énergie, actions, futurs modules) à une jointure supplémentaire pour une relation qui est structurellement 1:1.
- Le précédent existe déjà dans le dépôt : `supplier_sites` (030) porte `latitude`/`longitude`/`geocode_review_status` **directement sur la ligne du site**, pas dans une table séparée. PR-08 aligne `sites` sur ce même motif plutôt que d'en inventer un troisième.
- Coût accepté : `ALTER TABLE sites` sur une table **existante**. En production, 027 a été appliquée manuellement via l'éditeur SQL Neon (commentaire du fichier + `migration_manifest.py` : *« Appliquée manuellement en production le 2026-07-04 »*) — donc très vraisemblablement propriété de `neondb_owner`, pas de `carbonco_app`. **La migration d'extension de `sites` doit donc être marquée `requires_owner=true`** dans `migration_manifest.py`, appliquée via `DATABASE_ADMIN_URL` puis `mark-manual-verified`, exactement comme 027 — ce n'est pas un nouveau mécanisme opérationnel, c'est le même que celui déjà éprouvé.
- Toutes les colonnes ajoutées sont **nullables** : aucun backfill requis, `sites_service.list_sites`/`create_site` et l'API `GET/POST /sites` actuelles continuent de fonctionner sans modification tant que PR-08 ne les étend pas explicitement.

**Colonnes ajoutées à `sites`** (nullable, alignées sur le plan §13.1 mais avec un vocabulaire de revue corrigé — voir §2) :

```text
latitude              NUMERIC(9,6)
longitude             NUMERIC(9,6)
geocode_precision      TEXT             -- 'exact' | 'street' | 'city' | 'country' | 'manual'
geocode_provider       TEXT             -- code d'adaptateur, ou 'manual'
geocode_provider_ref   TEXT             -- identifiant du match chez le fournisseur (audit)
geocode_review_status  TEXT NOT NULL DEFAULT 'pending'   -- pending | accepted | flagged
geocode_reviewed_by    BIGINT
geocode_reviewed_at    TIMESTAMPTZ
geom                   geography(Point,4326)   -- CONDITIONNEL, voir §3
```

`location TEXT` (adresse libre) est **conservée** — c'est la saisie humaine source ; `latitude`/`longitude` sont le résultat **candidat ou accepté** d'un géocodage de cette adresse, jamais une resaisie qui écraserait `location`.

**Table compagnon nouvelle (celle-ci, oui) : `site_geocode_candidates`.** Justification distincte de celle ci-dessus : `sites` porte l'état **courant** (une paire lat/lon acceptée ou en attente), mais un géocodage peut proposer plusieurs candidats ambigus pour une même adresse, et l'historique des propositions (qui a proposé quoi, quand, avec quelle précision) est lui-même une preuve à conserver — même philosophie que `source_releases`/`observations` : ne jamais écraser, toujours accumuler une nouvelle ligne. Colonnes clés : `id, company_id, site_id, provider, provider_ref, latitude, longitude, precision, source_release_id, evidence_artifact_id, status (proposed|accepted|rejected), created_at, reviewed_by, reviewed_at`. `sites.geocode_review_status` reflète le statut du candidat **retenu** ; la table garde tout l'historique.

---

## 2. Coordonnées, précision, provenance — revue humaine obligatoire

**Règle gelée, non négociable (reprend le principe « aucun fallback silencieux » et le motif de revue déjà en vigueur) :** un géocodeur externe — adaptateur automatisé ou service tiers — ne fait **jamais autorité seul**. Toute coordonnée proposée entre en `site_geocode_candidates` avec `status='proposed'` ; elle ne devient utilisable pour une analyse géospatiale (§13.3 du plan : *« sites vérifiés → ST_Intersects »*) qu'après passage à `status='accepted'` par un utilisateur `require_analyst`. Un candidat `flagged` reste visible (traçabilité) mais est exclu de tout calcul.

**Correction de vocabulaire par rapport au plan (justifiée par le code réel) :** le plan §13.1 esquisse une revue à états libres (`geocode_review_status TEXT`, sans lister ses valeurs). PR-08 fige `pending | accepted | flagged` — **exactement** le vocabulaire déjà utilisé par `supplier_sites.geocode_review_status` (030), `material_mappings.review_status` (030) et `energy_activities.review_status` (031), et déjà porté par le composant front `ReviewStatusBadge` (Wave 2 contrats §9). Inventer un quatrième vocabulaire de revue dans le même dépôt serait la duplication que Wave 2/3 ont systématiquement évitée.

**Saisie manuelle :** un analyste qui tape lui-même une latitude/longitude passe par le **même** gate (`site_geocode_candidates` avec `provider='manual'`) — aucun raccourci « la saisie manuelle est de confiance par construction ». Règle uniforme, pas de cas particulier silencieux.

---

## 3. Géométries et zones — PostGIS, avec une question ouverte assumée

**État réel vérifié :** `grep -rli postgis apps/api apps/carbon` renvoie **zéro résultat**. Aucune extension PostGIS n'est installée ni référencée nulle part dans le dépôt à ce jour. Le plan d'architecture (§13.1, §21 « Matrice de tests obligatoire ») anticipe déjà PostGIS (`geom geography(Point,4326)`, `ST_Intersects`, test d'intégration « PostGIS ») — Wave 4 ne l'invente pas, mais doit vérifier qu'il est réellement disponible avant d'en dépendre.

**Décision : adopter PostGIS pour les points ET les zones, sous réserve de la question ouverte ci-dessous.**

Justification :
- Les zones à modéliser (bassins versants, zones de stress hydrique, aires protégées/KBA pour PR-09) sont des polygones irréguliers. Une approximation boîte-englobante/rayon haversine classerait systématiquement mal les sites proches d'une frontière non convexe (un bassin côtier, un corridor protégé sinueux) — inacceptable pour un module dont la promesse centrale est l'auditabilité (Phase 7, gate : *« aucun screening silencieux sur une position incertaine »*).
- Neon liste officiellement PostGIS comme extension supportée (disponible sur PG14 à PG18, versions 3.3.3 à 3.6.0 selon la documentation Neon des extensions) — pas de blocage de plateforme de principe.

**Question ouverte — À CONFIRMER avant le code de PR-08 (ne pas trancher par hypothèse) :** qui, dans ce projet, peut exécuter `CREATE EXTENSION postgis` ?

Ce qui est établi avec un bon niveau de confiance (raisonnement documenté, pas vérifié en base réelle) :
- PostgreSQL standard exige un rôle superuser pour créer une extension **non « trusted »** — et PostGIS ne l'est pas (elle enregistre des fonctions en langage C). `CREATE EXTENSION postgis` échoue donc par défaut pour un rôle ordinaire.
- Sur Neon, le rôle propriétaire par défaut d'un projet (`neondb_owner`) reçoit le rôle `neon_superuser`, mécanisme propre à Neon pour autoriser ce type de DDL sur les extensions qu'elle a admises en liste (PostGIS en fait partie) sans superuser OS complet.
- Rien dans les migrations 027-034 n'indique que `carbonco_app` (le rôle applicatif utilisé par `DATABASE_URL`) ait jamais reçu `neon_superuser` — chaque migration lui accorde au contraire des `GRANT SELECT/INSERT/UPDATE/DELETE` explicites et ponctuels, jamais un rôle élargi.
- Conclusion probable : `CREATE EXTENSION postgis;` devra s'exécuter via `DATABASE_ADMIN_URL` (même canal que les migrations `requires_owner=true`), donc marquer cette étape `requires_owner=true` et l'appliquer par le même chemin manuel que 027 — **pas un nouveau mécanisme opérationnel**.

Ce qui reste **réellement non vérifié** et doit être confirmé par un humain ayant accès au tableau de bord/à la base Neon du projet avant que du code PR-08 ne soit écrit :
1. Le rôle derrière `DATABASE_ADMIN_URL` en production est-il bien `neondb_owner` (ou porte-t-il `neon_superuser`) ?
2. Neon exige-t-il une étape d'activation supplémentaire par projet au-delà de `CREATE EXTENSION postgis;` (aucune preuve trouvée d'un tel besoin, mais pas exclu) ?
3. Un test empirique (`CREATE EXTENSION IF NOT EXISTS postgis; SELECT postgis_version();`) sur une branche Neon de test/preview, **avant** de l'écrire dans une migration réelle.

**Plan de repli documenté (pas un fallback silencieux) si la privilège est bloquée ou tarde :** `latitude`/`longitude` `NUMERIC` restent la source de vérité pour les points (toujours livrées, aucune dépendance). `geom` et `ST_Intersects` sont différés à une migration ultérieure une fois la question de privilège tranchée. En attendant, le screening eau (PR-08 tranche B, indicatif) peut tourner sur un pré-filtre boîte-englobante + distance haversine, à condition que `meta.method.code` de l'enveloppe analytique **nomme explicitement** l'approximation utilisée (ex. `CC-WATER-SCREENING-BBOX` vs `CC-WATER-SCREENING-POSTGIS`) — la méthode n'est jamais substituée en silence, même discipline que la hiérarchie de facteurs Scope 2 (plan §11.4).

---

## 4. Flux Evidence Kernel pour l'eau, la biodiversité et le géospatial — réutiliser, ne pas réinventer

Toute donnée externe (dataset national de stress hydrique, shapefile/GeoPackage d'aires protégées, service de géocodage tiers) entre par le chemin **déjà existant** :

```text
source_registry (source + licence)
  → source_releases (release immuable, checksum)
    → evidence_artifacts (fichier brut, Blob privé, content-addressed)
      → table de domaine PR-08/09 (lignes normalisées, sourcées)
```

**Fichiers lourds (shapefiles, GeoPackages, jeux de données de bassins) :** conformément au plan §8.3 (*« Gros PDF, shapefiles, GeoPackages ou datasets lourds : GitHub Actions protégé ou CLI local d'administration »*), l'ingestion passe par un CLI d'administration ou un workflow GitHub Actions protégé — **jamais** un import déclenché en direct par une requête utilisateur, et **jamais** un appel réseau au chargement de `/materials` ou d'une page publique (règle déjà en vigueur, plan §8.3 dernier point).

**Correction importante par rapport au plan (vérifiée en lisant le schéma réel) :** `observations` (migration 028) porte `numeric_value`, `text_value`, `boolean_value` — **aucune colonne `json_value`**, malgré le plan §6.5 qui en esquissait une. Un résultat structuré à plusieurs composantes (un screening eau avec plusieurs sous-indicateurs, un indice de dépendance nature avec plusieurs drivers) **ne doit pas** être forcé dans une colonne JSON inexistante. Deux voies correctes, au choix selon le cas :
- une **table de domaine dédiée** à colonnes typées (ex. `site_water_screenings`), chaque colonne traçant son propre `source_release_id`/`evidence_artifact_id` si sourcée indépendamment — le motif déjà suivi par `crma_article24_assessments` (034) ;
- plusieurs lignes `observations` distinctes, une par `metric_code` scalaire, si la donnée est réellement une collection de mesures indépendantes.

`observations.geography_code` et `observations.stage_code` existent déjà (028) et peuvent porter un code de bassin/pays ou une étape de chaîne de valeur — les réutiliser plutôt que d'ajouter des colonnes parallèles.

**`claim_evidence_links` :** son service existe déjà — `apps/api/services/intelligence/claim_link_service.py`, livré par PR-05A (`create_link`/`get_link`/`list_links`, vocabulaire `relation_type ∈ supports|contradicts|contextualizes|derived_from`, garde de périmètre `(company_id = %s OR company_id IS NULL)` en lecture). Wave 4 le **réutilise tel quel** pour lier un screening eau ou une évaluation de dépendance nature à une pièce justificative complémentaire (`claim_type='site_water_screening'`, `'nature_dependency'`, etc.) — aucun nouveau service de liaison preuve↔claim ne doit être créé.

---

## 5. Conventions `subject_type` / `metric_code` — eau et nature

Suivant le motif figé par `WAVE_2_INTERFACE_CONTRACTS.md` §1 (préfixe de domaine, `subject_key` = identifiant métier) :

- **PR-08 eau :** `subject_type IN ('site', 'water_basin')` ; `subject_key` = `site:{id}` / `basin:{code}`. Catalogue `metric_code` indicatif (**À CONFIRMER** — liste exacte figée au démarrage de PR-08 et documentée dans sa traçabilité, jamais des codes ad hoc dispersés, même règle que Wave 2) : `water_withdrawal_m3`, `water_consumption_m3`, `water_discharge_m3`, `water_stress_baseline`.
- **PR-09 nature :** `subject_type IN ('site', 'value_chain_node')` ; `subject_key` = `site:{id}` ou une référence de nœud BOM/fournisseur. Catalogue indicatif : `nature_dependency_score` (par driver — eau, sol, etc., jamais fusionnés), `nature_pressure_indicator`, `protected_area_proximity_km`.

---

## 6. Risque séparé de la confiance — étendre le précédent CRMA, pas un nouveau motif

`services/crma/scoring.py` (PR-07) et `crma_article24_assessments` (034) posent déjà, en code exécutable, la discipline que PR-08, PR-09 **et** PR-10 doivent suivre à l'identique :

- une composante sans donnée est `available=False` et **exclue** du calcul (poids renormalisés parmi les composantes disponibles) — jamais comptée à zéro (« pas de donnée » ≠ « pas de risque ») ;
- `risk_score` et `confidence` sont **deux colonnes séparées**, avec deux `CHECK` d'intervalle indépendants (`crma_article24_risk_range_check`, `crma_article24_confidence_range_check`) — aucune vue ni endpoint ne les combine ;
- chaque composante reste **inspectable** : `code`, `label`, `available`, `risk_value`, `weight`, `contribution`, `raw_value`, `raw_unit`, `rationale` (`models/crma.py::ScoreComponent`) — jamais un total opaque sans détail ;
- un score n'est **jamais officiel/certifié** : `crma_article24_assessments` porte `regulation_version` séparément du score, et `Article24Report.is_official_eu_score` est câblé à `False` et sérialisé dans l'export. PR-09 porte le même disclaimer pour toute référence au TNFD (« framework-informed, jamais un badge de conformité officielle »); PR-10 porte l'équivalent pour toute exposition d'IRO.
- **aucun calcul n'approuve un rapport** : `services/crma/article24_service.py::review()` exige un `reviewed_by` non nul pour passer à `approved`, refuse d'approuver une évaluation jamais calculée, et un recalcul est refusé sur une évaluation déjà `approved`/`submitted` (il faut d'abord rouvrir la revue). PR-09 (validation LEAP) et PR-10 (décision de matérialité) répliquent cette même forme de fonction `review(...)`/`decide(...)`, pas un nouveau motif de validation.

---

## 7. Périodes, licences, RLS, pagination, erreurs — reprise Wave 2, deltas seulement

Les contrats `WAVE_2_INTERFACE_CONTRACTS.md` §2 (statut de donnée), §5 (pagination), §6 (erreurs), §7 (isolation tenant), §8 (licence) s'appliquent **verbatim** à Wave 4. `routers/_errors.py::http_error`/`require_db` existent déjà (livrés par PR-05A) et sont importés, jamais recopiés.

**Deltas propres à Wave 4 :**

1. **Type de `company_id`.** Les nouvelles tables Wave 4 utilisent `BIGINT` (comme 028/030/031/034) — jamais `INTEGER` comme les tables historiques `sites` (027, `INTEGER NOT NULL`) ou `materialite_assessments` (025, `INTEGER NOT NULL`). Les comparaisons croisées `int4`/`int8` sur les FK restent valides en PostgreSQL (précédent déjà posé par 028→027, 031→027).
2. **`sites` ne change pas de génération RLS dans cette vague.** Ajouter des colonnes nullables par `ALTER TABLE` ne touche pas aux policies existantes — aucune migration RLS n'est nécessaire pour l'extension elle-même. PR-08 **ne rétro-modifie pas** la RLS de `sites` vers le motif gen-2 complet (même décision que PR-05A a prise pour 008b : documenter l'écart, ne pas le corriger hors périmètre). Les nouvelles tables compagnons (`site_geocode_candidates`, tables eau/nature) reçoivent, elles, la RLS gen-2 complète (`ENABLE`+`FORCE`, policies scopées par commande, `app.rls_bypass`, `DROP POLICY IF EXISTS`).
3. **Portée globale vs tenant strict, motif dual de 034.** Les référentiels partagés entre tenants (catalogue de bassins/zones de stress hydrique, catalogue d'aires protégées — données de référence utiles à tous) suivent le motif `company_id BIGINT NULL` à double lecture (`company_id IS NULL OR company_id = tenant`) et écriture tenant uniquement, comme `material_groups`/`processing_stages` (034). Les screenings, évaluations et expositions propres à un tenant (`site_water_screenings`, `leap_assessments`, `iros`…) sont `company_id BIGINT NOT NULL`, tenant strict, comme `company_material_exposures`/`crma_article24_assessments` (034).
4. **Écart RLS pré-existant signalé, non corrigé ici :** `materialite_assessments` et `materialite_positions` (migration 025) sont en RLS **gen-1** — `ENABLE ROW LEVEL SECURITY` **sans** `FORCE`, contrairement au motif devenu systématique depuis 028. PR-10 étend le domaine « matérialité » mais ses **nouvelles** tables (`iros` et alentours, §10) utilisent la RLS gen-2 complète dès leur création — elles n'héritent **pas** de la faiblesse des tables 025 sous prétexte d'appartenir au même domaine fonctionnel. Le retrofit de 025 vers gen-2 reste hors périmètre de Wave 4 (à signaler comme candidat de durcissement séparé).
5. **Défense en profondeur applicative obligatoire**, comme partout depuis 028 : le PostgreSQL de CI se connecte en superuser et bypasse la RLS (FORCE compris) — chaque requête de service Wave 4 porte en plus son prédicat de périmètre explicite (`company_id = %s` en écriture, `(company_id = %s OR company_id IS NULL)` en lecture pour les référentiels globaux).

---

## 8. Liens vers achats/fournisseurs/BOM/énergie/CRMA

- **`sites` (027, étendue par PR-08) est déjà référencée par `energy_meters.site_id` et `energy_activities.site_id` (031).** Une fois `sites` géolocalisée, la donnée est automatiquement disponible à la comptabilité Scope 2 (« ce compteur est sur un site en zone de stress hydrique élevé ») sans FK supplémentaire — aucun travail requis côté énergie.
- **`supplier_sites` (030) reste une table séparée**, volontairement : elle décrit les implantations d'un **fournisseur**, pas celles du tenant lui-même — les deux notions n'ont pas la même propriété ni le même cycle de revue. PR-08 aligne son vocabulaire de revue sur `supplier_sites.geocode_review_status` (§2) mais ne fusionne pas les deux tables. Étendre `supplier_sites` au même niveau de provenance que `sites` (géométrie, candidats) est un candidat naturel pour une PR ultérieure — explicitement **hors périmètre** de PR-08.
- **Screening eau et exposition achats :** le chemin de jointure `supplier_products.manufacturing_site_id → supplier_sites` (030) existe déjà structurellement ; un screening futur sur les sites fournisseurs pourra le parcourir sans nouvelle FK. PR-08 A-tranche ne le fait pas (elle screenne les sites du **tenant**, pas ceux de ses fournisseurs) — à noter explicitement comme extension naturelle, pas une obligation de cette vague.
- **PR-09 biodiversité et matières critiques (034) :** les liens se font par `material_id TEXT` **sans FK**, exactement le motif déjà retenu par `material_mappings.material_id` (030) et `company_material_exposures.material_id` (034) — le référentiel `materials` n'existe toujours pas en base (confirmé en relisant l'en-tête de 034, inchangé depuis PR-07). PR-09 ne doit **pas** introduire de FK fantôme vers une table qui n'existe pas.
- **PR-09 et BOM :** contrairement à `material_id`, `bom_items` **existe réellement** (030) — une dépendance nature peut donc porter une vraie FK `bom_item_id BIGINT REFERENCES bom_items(id)`, comme le fait déjà `company_material_exposures.bom_item_id` (034).

---

## 9. Enveloppe analytique partagée — un seul import, pas de forme dupliquée

`models/analytics.py::AnalyticalEnvelope[DataT]` / `AnalyticalMeta` / `MethodRef` / `QualityMeta` / `EvidenceRef` / `confidence_to_display()` existent déjà (créés par PR-05B) et sont **effectivement réutilisés** par PR-05B et PR-06B : `apps/api/routers/energy.py` les importe et les utilise directement comme `response_model` (`AnalyticalEnvelope[Scope2ResultData]`, ex. lignes 260, 291, 334, 379, 408) ; `apps/api/routers/procurement.py` et `apps/api/services/procurement/calculation_run_service.py` font de même.

**Écart constaté et à ne pas reproduire :** `apps/api/models/crma.py` (PR-07) **n'importe pas** `AnalyticalEnvelope` — il redéfinit localement une forme voisine mais divergente, `ExposureAnalysisMeta` (`method: dict[str, str]` au lieu de `MethodRef`, `quality: dict[str, Any]` au lieu de `QualityMeta`) et `ExposureAnalysisResponse` (`evidence: list[dict[str, Any]]` au lieu de `list[EvidenceRef]`). Le commentaire du fichier revendique pourtant *« Enveloppe analytique {data, meta, evidence} des contrats §4 »*. C'est une dérive silencieuse de la forme partagée, pas une seconde forme légitime.

**Règle gelée pour Wave 4 : suivre le motif majoritaire (PR-05B/PR-06B), pas l'exception PR-07.** Tout endpoint de calcul PR-08/09/10 importe et utilise directement `AnalyticalEnvelope[DataT]`, `AnalyticalMeta`, `MethodRef`, `QualityMeta`, `EvidenceRef` de `models/analytics.py` — jamais une forme dupliquée à la main, même partiellement. Si un domaine a besoin d'un champ supplémentaire dans `data`, il paramètre le générique avec son propre type métier (`AnalyticalEnvelope[Scope2ResultData]` est déjà l'exemple à suivre) plutôt que de redéfinir l'enveloppe elle-même.

Les endpoints de **capture de données** (géocodage, CRUD sites/permis/activités eau, saisie LEAP) ne sont **pas** des calculs — ils retournent les enveloppes de liste standard (§5 Wave 2 : `{items, total, limit, offset}`), pas `AnalyticalEnvelope`. Réserver l'enveloppe analytique aux résultats réellement dérivés/calculés (screenings, scores, évaluations d'IRO), comme PR-05A (capture) ne l'utilise pas mais PR-05B (calcul) le fait.

---

## 10. Double matérialité — IRO candidat vs décision (règle transverse aux trois PR)

**Principe non négociable, repris verbatim du plan §1.9 et de `WAVE_2_INTERFACE_CONTRACTS.md` §11 :** un signal externe peut créer un **IRO candidat**, jamais une décision automatique de matérialité.

**Décision d'architecture gelée ici (corrige une redondance du plan) :** le plan §13.2 esquisse une table `water_iro_candidates` propre au domaine eau, et par symétrie implicite un mécanisme équivalent pour la nature. Wave 4 **ne crée pas** une table de candidats par domaine. Raison : PR-10 possède déjà, par construction, une entité `iros` centrale dont un des états de cycle de vie est précisément « candidat » (§15 du plan : *signal → IRO candidat → évaluation impact → évaluation financière → décision humaine*). Multiplier les tables de candidats par domaine fragmenterait la file de triage unique que le plan promeut lui-même. Décision :

- **PR-08 et PR-09 ne créent pas de table `*_iro_candidates`.** Chaque screening/évaluation de domaine expose un signal explicite (ex. un indicateur de dépassement de seuil sur `site_water_screenings`, une dépendance forte non atténuée sur `nature_dependencies`) — visible dans sa propre interface, mais qui **reste** un résultat de domaine tant qu'aucun humain n'agit dessus.
- **PR-10 seule possède la table `iros`**, avec un état `candidate` dans son cycle de vie. Un analyste transforme explicitement un signal de domaine en ligne `iros` via l'intake de PR-10, en citant le screening/l'évaluation source comme preuve (`iro_evidence_links` et/ou `claim_evidence_links`, §4). Cette promotion est un **geste humain**, jamais une tâche planifiée ni un trigger automatique.
- Ce découpage est cohérent avec la phrase de clôture du plan §15 : *« Le score 2D existant peut rester un outil de visualisation et de tri. Il ne doit pas remplacer les attributs et justifications sous-jacents »* — la matrice existante (`materialite_positions`) reste la vue de tri ; `iros` (PR-10) devient la couche détaillée, évidencée, auditable en-dessous, alimentée par les signaux eau/nature/matières/énergie mais jamais fusionnée avec eux.

---

## 11. Aucun fallback silencieux — rappel transverse

Principe non négociable du plan (§9.4, repris à chaque domaine Wave 2/3) : toute composante manquante, toute méthode indisponible, tout repli de calcul est **explicite** (`warnings`, `fallback_reason`, `meta.method.code` nommé) — jamais une valeur devinée ou un repli qui se substitue silencieusement à la méthode nominale. S'applique en Wave 4 en particulier à :
- l'usage d'une approximation boîte-englobante à la place de PostGIS (§3) — le code de méthode le nomme, ne le cache pas ;
- une composante de score eau/nature/IRO sans donnée — exclue et renormalisée, jamais comptée à zéro (§6) ;
- un géocodage jamais validé par un humain — le site reste hors périmètre des analyses géospatiales, pas de position par défaut inventée (§2).

---

## 12. Composants réutilisés / à introduire

Tous les composants déjà catalogués par `WAVE_2_INTERFACE_CONTRACTS.md` §9 (backend : `get_db`/`get_admin_db`, `require_analyst`/`require_admin`/`get_current_user`, `artifact_service.register_artifact`, `license_policy.evaluate`, `audit_service.log_event` ; frontend : `DataStatusBadge`, `ReviewStatusBadge`, `ExportButtons`/`ExportPackageCard`, `KpiProvenanceDrawer`) restent valables et sont réutilisés tels quels.

**Vérifié à ce jour (Wave 4, `apps/carbon/components/ui/`) : `MethodBadge`, `ConfidenceBadge`, `SourceDrawer`, `EvidenceList`, `CalculationTrace`, `ReviewGate`, `LicenseWarning`, `StalenessWarning`, `IroCandidateButton` n'existent toujours pas**, trois vagues après leur annonce (plan §17, Wave 2 §9). La règle Wave 2 reste : la **première** PR Wave 4 qui en a besoin le crée (dans `components/intelligence/` ou `components/ui/` si transverse) et documente dans sa traçabilité, pour éviter les doublons entre PR-08/09/10 développées séparément.

- `IroCandidateButton` : PR-10 en est le propriétaire naturel (§10).
- `LicenseWarning` : en retard depuis Wave 2 ; l'eau et la biodiversité (données largement sous licence tierce) le rendent plus urgent — la première des trois PR à afficher une donnée `display_allowed=false` le crée.
- `MethodBadge`/`ConfidenceBadge` : idem, premier besoin réel (probablement le screening eau, tranche B de PR-08) déclenche la création.

**Piège opérationnel connu à anticiper (vérifié via les notes internes du projet) :** le frontend `apps/carbon` utilise déjà Mapbox (dépendance existante, plan §2). Toute UI de revue de géocodage ou de carte de zones (PR-08) qui l'utilise devra rouvrir `apps/carbon/proxy.ts` : tout domaine externe requis par le front doit être ajouté à `connect-src` de la CSP, et `mapbox-gl` exige en plus `worker-src blob:`. Piège déjà rencontré sur ce projet (module `/materials`) — à vérifier explicitement dans les tests d'intégration front de PR-08, pas découvert en production.

---

## 13. Réservations de numéros de migration (Wave 4)

| PR | Migration réservée | Contenu prévu (indicatif — figé dans le plan de la PR) |
|---|---|---|
| **PR-08** | `036` | Extension géospatiale de `sites` (`requires_owner=true`), `site_geocode_candidates`, ledger eau (tranche A). Calcul de screening → tranche B, non réservée ici. |
| **PR-09** | `037` | Datasets nature/LEAP, intersections site↔zone, dépendances/impacts/pressions (tranche A). Scoring/évaluations LEAP → tranche B éventuelle, non réservée ici. |
| **PR-10** | `038` | `iros` et tables associées (évaluation impact/financière, décisions, disclosures). |

Ces réservations supposent l'ordre `035` (stabilisation Wave 3, worktree sœur) → PR-08 → PR-09 → PR-10. **Le numéro réel est attribué au moment du merge**, dans l'ordre réel (règle absolue déjà énoncée par `WAVE_2_INTERFACE_CONTRACTS.md` §10) : si `035` n'est pas mergée avant PR-08, ou si l'ordre PR-08/09/10 change, chaque PR **renumérote** au moment de son propre merge et confirme via `command=plan` avant `apply` — ce document ne fait qu'exprimer une intention, pas une garantie.

---

## 14. Ce que Wave 4 ne refait jamais

- Pas de second mécanisme de preuve — extension exclusive de l'Evidence Kernel (§4).
- Pas de seconde forme d'enveloppe analytique — import direct de `models/analytics.py`, jamais une redéfinition locale (§9, corrige la dérive PR-07).
- Pas de score IRO opaque unique — composantes séparées, `risk`/`likelihood`/`magnitude`/`scope` et `confidence` ne se fusionnent jamais (§6, détaillé aussi dans `PR10_IRO_DOUBLE_MATERIALITY_IMPLEMENTATION_PLAN.md`).
- Pas de décision de matérialité automatique — un signal crée au plus un candidat, jamais une décision (§10).
- Pas de donnée géospatiale ou nature externe sans `source_registry`/`source_releases`/`evidence_artifacts` enregistrés (§4).
- Pas de confiance accordée à un géocodeur externe sans revue humaine explicite (§2).
- Pas de retrofit RLS des tables historiques (`sites` 027, `materialite_assessments`/`materialite_positions` 025) dans cette vague — l'écart est documenté (§7.2, §7.4), pas corrigé ici.
- Pas de table de candidats IRO par domaine — un seul point d'entrée central (`iros`, PR-10) (§10).
- Pas d'installation silencieuse de PostGIS présumée possible — la question de privilège reste ouverte et doit être vérifiée avant tout code (§3).
