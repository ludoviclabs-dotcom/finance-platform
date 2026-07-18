# Wave 2 — Contrats d'interface communs (PR-04, PR-05, PR-06)

**But :** figer, en un seul endroit, les contrats partagés que PR-04 (source admin), PR-05 (procurement exposure) et PR-06 (energy / Scope 2) doivent tous respecter, pour qu'ils soient développés **en parallèle** sans diverger. Ces contrats découlent du noyau Evidence Kernel (PR-03).

**Provenance :** PR-03 (Evidence Kernel) a été **fusionnée dans `master`** (PR [#102](https://github.com/ludoviclabs-dotcom/finance-platform/pull/102), merge `bca4b99`). Les contrats ci-dessous sont donc dérivés du **code réellement mergé**, pas d'une proposition — sauf mention explicite « **À INTRODUIRE** » (contrat que Wave 2 doit créer, PR-03 ne l'a pas livré) ou « **À CONFIRMER** » (dépend d'un détail susceptible d'évoluer).

> **Note de cadrage.** Le brief de préparation de cette vague supposait PR-03 « en cours dans un autre worktree, non fusionnée ». En réalité elle est déjà mergée : les interfaces qui devaient être « confirmées après merge » le sont ici directement, contre le code de `master`. Les points restant réellement ouverts sont marqués **À CONFIRMER** / **À INTRODUCE** et n'engagent aucune écriture avant leur PR respective.

**Statut de ce document :** documentaire, gelant des conventions. Aucune écriture de code. Toute déviation d'un plan Wave 2 par rapport à ces contrats doit être justifiée dans la traçabilité de la PR concernée.

---

## 0. Sources de vérité

| Contrat | Fichier de référence (dans `master`) |
|---|---|
| Modèles Pydantic du noyau | `apps/api/models/intelligence.py` |
| Services du noyau | `apps/api/services/intelligence/{source,release,artifact,ingestion,observation}_service.py`, `license_policy.py` |
| Endpoints du noyau | `apps/api/routers/intelligence.py` (préfixe `/intelligence`) |
| Schéma SQL du noyau | `apps/api/db/migrations/028_evidence_kernel.sql` |
| Ledger de migrations | `apps/api/db/migration_runner.py`, `migration_manifest.py`, `migration_probes.py` |
| RLS historique (pattern) | `apps/api/db/migrations/009_rls_force.sql`, `027_sites.sql` |
| Preuves existantes (hors noyau) | `apps/api/services/evidence_service.py`, `facts_service.py` |
| Vocabulaire badges / UI | `apps/carbon/components/ui/data-status-badge.tsx`, `review-status-badge.tsx`, `feature-status-badge.tsx` |

---

## 1. Identification : source / release / artifact / observation

Les entités du noyau sont identifiées par un **`id` entier** (BIGSERIAL). Toute PR Wave 2 qui référence une preuve le fait par ces clés étrangères, **jamais** par recopie de valeurs.

| Entité | Table | Clé | Référence stable secondaire |
|---|---|---|---|
| Source | `source_registry` | `id BIGINT` | `code TEXT` (unique par tenant si `company_id` non nul, unique global si `company_id IS NULL`) |
| Release | `source_releases` | `id BIGINT` | `(source_id, release_key, checksum_sha256)` — **idempotence de détection** |
| Artifact | `evidence_artifacts` | `id BIGINT` | `sha256` (content-addressed) + `blob_key` |
| Observation | `observations` | `id BIGINT` | `(subject_type, subject_key, metric_code, observed_at)` |
| Lien preuve↔claim | `claim_evidence_links` | `id BIGINT` | `(claim_type, claim_key, evidence_artifact_id)` |

**Règles gelées :**

- **`company_id BIGINT NULL`** partout : `NULL` = donnée **globale** (partagée, lisible par tous les tenants) ; non nul = donnée **tenant**. C'est nouveau par rapport aux tables historiques 001-027 (toujours `INTEGER NOT NULL`). Wave 2 : toute nouvelle table à portée tenant utilise `company_id BIGINT` (nullable si et seulement si la table peut porter des lignes globales, sinon `NOT NULL`).
- **`subject_type` / `subject_key`** (observations) sont des **chaînes libres** — c'est le point d'accroche des modules métier. Wave 2 fige les conventions de nommage suivantes (préfixe = domaine) :
  - PR-05 procurement : `subject_type IN ('supplier', 'supplier_product', 'purchase_line', 'product')`, `subject_key` = identifiant métier (ex. `supplier:{id}`, `pcf:{supplier_product_id}`).
  - PR-06 energy/scope2 : `subject_type IN ('site', 'meter', 'instrument')`, `subject_key` = `site:{id}` etc.
  - **À CONFIRMER** au début de chaque PR : la liste exacte des `metric_code` (catalogue par domaine), documentée dans la traçabilité de la PR — jamais des codes ad hoc dispersés.
- **`claim_type` / `claim_key`** (claim_evidence_links) : même convention libre. `claim_evidence_links` n'a **ni service ni endpoint** en PR-03 (schéma seul) — la **première** PR Wave 2 qui en a besoin (candidat : PR-05 pour lier une preuve à une ligne d'achat, ou PR-10 IRO) livre son service, en respectant `relation_type IN ('supports','contradicts','contextualizes','derived_from')`.

---

## 2. Statut de données (`data_status`) — vocabulaire gelé

Une valeur normalisée porte **toujours** un statut. Deux vocabulaires coexistent, **ne pas les confondre** :

| Couche | Valeurs | Source de vérité |
|---|---|---|
| **Donnée** (observation) | `verified` · `estimated` · `manual` · `inferred` | `observations.data_status` (CHECK migration 028) ; type `DataStatus` Pydantic |
| **Cycle de vie release** | `detected` · `quarantined` · `validated` · `published` · `superseded` · `blocked_license` | `source_releases.status` |
| **Run d'ingestion** | `pending` · `running` · `quarantined` · `validated` · `published` · `failed` · `blocked_license` | `ingestion_runs.status` |
| **Badge UI (front)** | `VERIFIED` · `ESTIMATED` · `MANUAL` · `STALE` | `apps/carbon/components/ui/data-status-badge.tsx` |

**Règles gelées :**

- `data_status` **backend** (`verified/estimated/manual/inferred`) ↔ badge **front** (`VERIFIED/ESTIMATED/MANUAL/STALE`) : mapping non trivial. `inferred` n'a pas de badge dédié → l'afficher comme `ESTIMATED` avec un libellé explicite (« Inféré »). `STALE` est un état **dérivé côté front** (fraîcheur), pas une valeur backend. **À INTRODUCE** en PR-04 : une fonction de mapping unique `dataStatusToBadge(data_status, isStale)` (côté front), pour ne pas disperser la logique.
- **Risque ≠ confiance ≠ statut** : `confidence NUMERIC ∈ [0,1]` (observations, CHECK) est **séparé** de `data_status`. Un score de risque (PR-05/07) est encore une 3ᵉ grandeur. Ne jamais les fusionner en un chiffre unique (principe non négociable §1.10 du plan d'architecture).
- Toute valeur affichée par un module Wave 2 porte : **date + source + statut + méthode** (`observed_at`, `source_release_id`, `data_status`, `methodology_version`).

---

## 3. Références de preuves (evidence)

Deux mécanismes de preuve coexistent dans le dépôt. Wave 2 **ne réinvente ni l'un ni l'autre** :

1. **Evidence Kernel (PR-03)** — la voie Wave 2 par défaut :
   - `evidence_artifacts` : pièce brute content-addressed (`sha256` + `blob_key`), rattachée à une `source_release_id` et/ou citée par une observation (`observations.evidence_artifact_id`) ou un `claim_evidence_links`.
   - Localisation `page_reference` / `table_reference` / `cell_reference` / `excerpt` déjà prévues sur `evidence_artifacts`.
   - `sensitivity IN ('public','internal','confidential','restricted')` — les niveaux `confidential`/`restricted` sont servis **uniquement via un proxy authentifié** (jamais d'URL signée permanente, cf. §8).
   - Stockage via `services.storage.get_storage()` (Vercel Blob **privé** en prod, local en dev). **Aucun nouvel uploader Blob** — réutiliser `artifact_service.register_artifact` (déjà livré, calcule le SHA-256, refuse > 5 Mo via `StorageError`).
2. **Chaîne de preuve `facts_events` (T2.x, préexistant)** — hash-chain append-only par company (`facts_service.emit_fact`, `verify_chain`), pièces via `evidence_service.attach_evidence` (clé `org/{company_id}/evidence/{fact_id}/{sha256}.{ext}`).

**Règle gelée — quelle voie choisir :**

- Une valeur issue d'une **source externe / release** (achats importés, facteurs licenciés, dataset énergie) → **observation + evidence_artifact** (Evidence Kernel).
- Un **KPI calculé versionné** que l'on veut sceller dans une chaîne infalsifiable → `facts_events` (le mécanisme existant). Les runs de calcul Wave 2 (Scope 2, exposition) **peuvent** émettre un fact récapitulatif en plus de conserver leur `input_snapshot` (voir §4).
- **Jamais** de recopie d'une pièce d'un tenant vers un autre. La garde anti-IDOR d'`evidence_service.get_evidence_file` (double vérification `company_id`) est le patron de référence pour tout téléchargement Wave 2.

---

## 4. Structure de résultat analytique — **À INTRODUCE en Wave 2**

PR-03 **n'a pas** livré l'enveloppe analytique `{data, meta, evidence}` du §7 du plan d'architecture (ses endpoints renvoient des réponses typées simples : item ou liste paginée). Les endpoints de **calcul** de PR-05 (exposition, hotspots) et PR-06 (Scope 2 runs) l'introduisent. Contrat gelé ici pour qu'ils soient identiques :

```json
{
  "data": { "...": "résultat métier typé du domaine" },
  "meta": {
    "as_of": "2026-06-30",
    "status": "estimated",
    "method": { "code": "CC-METHOD-CODE", "version": "1.0.0" },
    "quality": { "confidence": 62, "coverage_pct": 80, "warnings": [] }
  },
  "evidence": [
    { "artifact_id": 415, "source_code": "SOURCE", "release_key": "2026", "page_reference": "p. 43" }
  ]
}
```

**Règles gelées :**

- `meta.status` ∈ vocabulaire `data_status` (§2). `meta.method.{code,version}` **obligatoire** dès qu'un calcul déterministe est impliqué — pas de calcul sans méthode versionnée (principe §9 du plan).
- `meta.quality.confidence` (0-100 entier, présentation) est **distinct** de `observations.confidence` (0-1). Documenter la conversion dans chaque PR.
- `evidence[]` liste des `artifact_id` (Evidence Kernel) ou des refs `facts_events` — jamais des URLs directes.
- **Table de runs partagée par convention** (pas de table unique imposée, mais colonnes communes) — tout run de calcul Wave 2 conserve : `methodology_code`, `methodology_version`, `input_snapshot JSONB`, `factor_versions JSONB`, `result JSONB`, `warnings JSONB`, `confidence`, `coverage_pct`, `calculated_at`, `approved_at`, `approved_by` (repris de §9.2 du plan). Réутilisable tel quel par `procurement_calculation_runs` (PR-05) et `scope2_calculation_runs` (PR-06).
- **Modèle Pydantic partagé À INTRODUCE** : `models/analytics.py::AnalyticalEnvelope` (générique) — créé par la **première** PR Wave 2 qui expose un endpoint de calcul (probablement PR-05), puis réutilisé. Marqué **À CONFIRMER** : le nom exact et l'emplacement, à trancher au début de PR-05.

---

## 5. Pagination

Contrat **déjà en vigueur** (PR-03, `routers/intelligence.py`) — repris tel quel par toute liste Wave 2 :

- Paramètres query : `limit` (`Query(ge=1, le=200)`, défaut 50) et `offset` (`Query(ge=0)`, défaut 0).
- Réponse : enveloppe `{ items: [...], total: int, limit: int, offset: int }` (cf. `SourceListResponse`, `ReleaseListResponse`, `IngestionRunListResponse`, `ObservationListResponse`).
- `total` = compte **non paginé** dans le périmètre du tenant (fait via un `COUNT(*)` scopé). Filtres additionnels autorisés **uniquement sur colonnes indexées** (cf. index de la migration 028 ; même discipline pour 029/030/031).

---

## 6. Erreurs

Contrat **déjà en vigueur** (PR-03) — repris tel quel :

- **Services** : une exception métier par module (`SourceError`, `ReleaseError`, `ArtifactError`, `IngestionError`, `ObservationError` ; Wave 2 ajoute `ProcurementError`, `EnergyError`, …). Message en **français**, non sensible (jamais de SQL, de secret, ni de fuite d'existence cross-tenant).
- **Routeur** : un helper unique traduit le message en code HTTP par convention lexicale (cf. `intelligence.py::_http_error`) — `"introuvable"` → **404**, `"requis"/"requise"` → **400**, sinon → **409**. Wave 2 réutilise **le même helper** (le factoriser dans un module partagé **À CONFIRMER** — candidat `routers/_errors.py`, à trancher en PR-05) plutôt que de le recopier.
- **DB indisponible** : `503` via le garde `_require_db()` (mode `/tmp` sans PostgreSQL). Identique partout.
- **Isolation** : une ressource hors périmètre tenant renvoie **404, jamais 403** (pas de fuite d'existence).
- Codes de sortie CLI (le cas échéant) : cohérents avec le ledger — `0` succès / rien à faire, `1` erreur, `2` verrou, `3` requires_owner, `4` anomalie verify.

---

## 7. Isolation tenant (RLS + défense en profondeur)

**Le contrat le plus important de la vague.** Gelé d'après PR-03 (migration 028 + services) :

- **RLS `ENABLE` + `FORCE`** sur toute table à portée tenant, pattern `009/027/028` :
  ```sql
  USING (current_setting('app.rls_bypass', true) = 'on'
         OR company_id IS NULL                         -- lecture des lignes globales
         OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint);
  ```
  - **Lecture** : propre au tenant **OU** global (`company_id IS NULL`).
  - **Écriture** (`WITH CHECK`) : propre au tenant **uniquement** (jamais `IS NULL`) — un tenant ne crée/modifie jamais une ligne globale. Écriture globale = `app.rls_bypass = 'on'` (service admin) ou rôle admin.
  - **Policies scopées par commande** (`FOR SELECT` / `INSERT` / `UPDATE` / `DELETE` distinctes), pas une policy `ALL` unique — lecture et écriture n'ont pas la même clause.
  - `DROP POLICY IF EXISTS` avant chaque `CREATE POLICY` (idempotence — la migration est rejouable par `startup_event` en dev local).
- **Défense en profondeur applicative** (leçon CI de PR-03, cf. `PR03_EVIDENCE_KERNEL_TRACEABILITY.md` §15) : **en plus** de la RLS, chaque requête de service porte son prédicat de périmètre explicite — `(company_id = %s OR company_id IS NULL)` en lecture, `company_id = %s` en écriture. Raison : le PostgreSQL de **CI se connecte en superuser** qui **bypasse la RLS** (FORCE compris) ; sans ce doublon, aucun test d'isolation ne passe en CI. C'est aussi le patron anti-IDOR d'`evidence_service`. **Wave 2 applique ce doublon systématiquement** — c'est non négociable pour que les tests d'isolation soient verts en CI.
- **`get_db(company_id=…)`** pose `SET LOCAL app.current_company_id`. Les opérations de maintenance (REFRESH MV, jobs cross-tenant) posent `app.rls_bypass = 'on'` et jettent la connexion juste après.
- **Sonde de migration obligatoire** : toute migration Wave 2 (029/030/031/…) **doit** ajouter sa fonction `_probe_0NN` dans `apps/api/db/migration_probes.py` et l'enregistrer dans `MIGRATION_OBJECT_PROBES`. Sans sonde, `MigrationRunner.verify()` rapporte un **faux `drift_detected`** après `apply` (une version inconnue du registre renvoie `False`). Idem : mettre à jour `build_full_db` (fixtures) pour appliquer jusqu'à la nouvelle version, et **inscrire les tests DB-gated dans le job CI `migration-tests`** (sinon ils skippent silencieusement — leçon PR-03 §15).

---

## 8. Règles de licence

Gelé d'après `services/intelligence/license_policy.py` (PR-03) :

- **Décision déterministe, jamais un booléen nu** : `license_policy.evaluate(source) -> LicenseDecision` renvoie `{allow_ingest, allow_store, allow_display, allow_derived_use, reasons[], warnings[]}`. **Aucun LLM**, aucun jugement silencieux.
- Entrées = colonnes booléennes de `source_registry` : `automated_access_allowed`, `storage_allowed`, `commercial_use_allowed`, `redistribution_allowed`, `derived_use_allowed`, `display_allowed`, `active`, `attribution_text`.
- **Gate de publication** (déjà en vigueur) : `release_service.publish_release` refuse (statut `blocked_license`, raisons tracées dans `metadata`) si `allow_ingest` ou `allow_store` est faux. `blocked_license` est un **état normal** du cycle de vie, pas une exception.
- **Wave 2 :**
  - **PR-04** enregistre des sources réelles (démo CarbonCo, et à terme facteurs licenciés) → doit renseigner honnêtement ces booléens. Le snapshot `/materials` démo = licence permissive (`display_allowed=true`, `derived_use_allowed=true`), mais reste `estimated`.
  - **PR-05/06** : avant d'**afficher** un prix/flux issu d'une source, vérifier `allow_display` ; avant de l'utiliser dans un **calcul dérivé**, vérifier `allow_derived_use` (warning sinon). Aucun prix sous licence restrictive affiché sans droit (principe §1.11).
  - `allow_display` / `allow_derived_use` doivent être **propagés jusqu'à l'UI** (badge `LICENSED` / `BLOCKED`, composant `LicenseWarning` **À INTRODUCE** — prévu par le plan §17, pas encore livré).

---

## 9. Composants réutilisés

### Backend (à réutiliser, ne pas dupliquer)

| Besoin | Réutiliser | Fichier |
|---|---|---|
| Connexion tenant / admin | `get_db(company_id=…)` / `get_admin_db()` | `apps/api/db/database.py` |
| Auth / rôles | `get_current_user`, `require_analyst`, `require_admin`, `require_cron_or_analyst` | `apps/api/routers/auth.py` |
| Enregistrer une pièce (SHA-256, Blob privé) | `artifact_service.register_artifact` | `services/intelligence/artifact_service.py` |
| Stockage objet | `services.storage.get_storage()` (local / vercel-blob) | `services/storage/` |
| Preuve hash-chain + pièces datapoint | `facts_service`, `evidence_service` | `services/facts_service.py`, `evidence_service.py` |
| Licence | `license_policy.evaluate` | `services/intelligence/license_policy.py` |
| Cycle release / observation | `release_service`, `observation_service`, `ingestion_service`, `source_service` | `services/intelligence/*` |
| Audit | `audit_service.log_event` | `services/audit_service.py` |
| Détection prod | `utils.env.is_production()` | `apps/api/utils/env.py` |
| Ledger de migrations (chemin d'écriture schéma) | workflow `db-migrate.yml` + `MigrationRunner` | inchangé — 029/030/031 suivent 001-028 |

### Frontend (à réutiliser)

| Besoin | Composant existant | Fichier |
|---|---|---|
| Badge qualité donnée | `DataStatusBadge` (`VERIFIED/ESTIMATED/MANUAL/STALE`) | `apps/carbon/components/ui/data-status-badge.tsx` |
| Badge statut de revue | `ReviewStatusBadge` (`pending/accepted/flagged`) | `components/ui/review-status-badge.tsx` |
| Badge statut produit/feature | `FeatureStatusBadge` (`LIVE/BETA/ROADMAP…`) | `components/ui/feature-status-badge.tsx` |
| Badge intégrité chaîne | `ChainBadge` | `components/ui/chain-badge.tsx` |
| Drawer / carte de provenance | `KpiProvenanceDrawer`, `KpiWithProvenance`, `ProvenanceIntegrityCard` | `components/ui/kpi-provenance-drawer.tsx`, … |
| Boutons / cartes d'export | `ExportButtons`, `ExportPackageCard` | `components/ui/export-buttons.tsx`, … |
| Client API | `API_BASE_URL` + helpers | `apps/carbon/lib/api.ts` |
| Groupe de routes protégées | `apps/carbon/app/(app)/…` | (placement des pages Wave 2) |

### Composants **À INTRODUIRE** (prévus par le plan §17, pas encore livrés)

`SourceDrawer` · `EvidenceList` · `CalculationTrace` · `ReviewGate` · `LicenseWarning` · `StalenessWarning` · `MethodBadge` · `ConfidenceBadge` · `IroCandidateButton`. La **première** PR qui en a besoin le crée dans `components/intelligence/` (ou `components/ui/` si transverse) et les suivantes le réutilisent — documenter dans la traçabilité qui crée quoi, pour éviter les doublons entre PR développées en parallèle.

---

## 10. Réservations de numéros de migration (Wave 2)

| PR | Migration réservée | Contenu prévu (indicatif — figé dans le plan de la PR) |
|---|---|---|
| **PR-04** | `029` | Peu ou pas de tables neuves (PR-04 **consomme** surtout le noyau) ; candidat : une vue/table de **fraîcheur des sources** + seeds de la source démo. **À CONFIRMER** en PR-04 : 029 peut n'être qu'une migration légère, voire un simple `mark-manual-verified` sans DDL. |
| **PR-05A** | `030` | Tables d'**exposition achats** (sites fournisseurs, produits fournisseurs, imports d'achats, lignes d'achat, déclarations, PCF) — tranche A. Les tables de **calcul** (procurement runs/results) → tranche B (`031+`, à renuméroter si conflit). |
| **PR-06A** | `031` | Tables **énergie / Scope 2** (compteurs, activités, instruments contractuels, allocations, métadonnées facteurs) — tranche A. Les tables de **calcul** Scope 2 → tranche B. |

> **Attention numérotation.** Ces réservations supposent l'ordre PR-04 → PR-05A → PR-06A. Si l'ordre de merge réel diffère, **renuméroter** au moment du merge (le ledger n'accepte pas deux fois le même préfixe). La règle absolue : le numéro de migration est attribué **au moment du merge**, dans l'ordre réel — ces réservations ne sont qu'une intention. Chaque PR confirme son numéro effectif via `command=plan` avant `apply` (runbook §5/§6).

---

## 11. Ce que Wave 2 ne refait jamais (rappel)

- Pas de second backend ni de modèle de données parallèle — **étendre** les domaines existants.
- Pas d'écriture schéma automatique — **seul** `db-migrate.yml` (workflow manuel protégé) applique une migration. Aucun `AUTO_MIGRATE`, aucun apply au cold start.
- Pas de calcul réglementaire par un LLM ; l'IA ne produit que des suggestions/claims à revoir (PR-11).
- Pas de matérialité décidée automatiquement — un signal crée un **IRO candidat**, jamais une décision.
- Pas de prix/flux sous licence restrictive affiché sans droit explicite.
- Pas de donnée publique issue d'un fichier sans **source + release** enregistrées (gate de la Phase 3).
