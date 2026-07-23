# P00 — Matrice des capacités existantes

Référence rapide pour P01+ : ce qui existe déjà, où, et si c'est directement réutilisable pour `/water-intelligence`. Détails et citations complètes dans [`00_BASELINE_AUDIT.md`](./00_BASELINE_AUDIT.md).

## Tables déjà présentes

| Table | Migration | Portée | Réutilisable pour `/water-intelligence` ? |
|---|---|---|---|
| `source_registry` | `028` | Evidence Kernel | **Oui — registre unique à consommer, pas à dupliquer** |
| `source_releases` | `028` | Evidence Kernel | **Oui** |
| `evidence_artifacts` | `028` | Evidence Kernel | **Oui** |
| `observations` | `028` | Evidence Kernel | **Oui** — cible naturelle pour les métriques ingérées par les futurs connecteurs (P05+) |
| `ingestion_runs`, `claim_evidence_links` | `028` | Evidence Kernel | Oui, secondaire |
| `water_activities`, `water_imports`, `water_permits` | `036` | Cockpit `/water` (tenant) | Non — données tenant, jamais dans la surface publique |
| `water_risk_areas` | `036` | Cockpit `/water` (global ou tenant) | **Partiellement** — les lignes globales (`company_id IS NULL`) sont le seul précédent structurel de « zone de risque sourcée » ; pattern à suivre, pas table à interroger directement depuis le public sans passer par un snapshot |
| `site_water_screenings`, `water_targets`, `water_actions` | `037` | Cockpit `/water` (tenant) | Non — données tenant |
| `sites` (extension géo), `site_geocode_candidates` | `036` | Cockpit `/water`+`/sites-geo` (tenant) | Non — données tenant |
| `company_resource_exposure_links` (colonne `water_activity_id`) | `043` | Module 2 `/resources` | Non — pont interne authentifié, hors périmètre public |

## Invariants déjà présents (à respecter, pas à réinventer)

| Invariant | Où il est appliqué aujourd'hui | Mécanisme |
|---|---|---|
| Risque ≠ confiance | `site_water_screenings` (2 colonnes CHECK indépendantes) ; `water_screening.py` (2 chemins de calcul disjoints) | Structurel (DB + code) |
| Donnée manquante ≠ zéro | `water_screening.py:167-174` (`total_area_count == 0` → refus explicite, pas un résultat) | Refus explicite (`WaterScreeningRefusal`) |
| Aucune zone appariée ≠ risque faible | `water_screening.py:225-229` (`risk_category=None` + avertissement) ; `water/page.tsx:324-337` (« Hors zones connues (≠ risque nul) ») | Code + UI |
| Géocodage utilisable uniquement après revue humaine | `sites_geocode_accepted_check` (CHECK DB) ; `site_geocode_candidate_guard` (trigger append-only) ; `water_screening.py:144-155` (refus si non « accepted ») | Structurel (DB) + refus explicite |
| Méthode géométrique réellement exécutée toujours affichée | `method_code` = vocabulaire fermé CHECK-contraint, surfacé tel quel via `<MethodChip>` | Structurel (DB) + UI |
| Toute donnée externe porte source/release/checksum/licence | `source_releases.checksum_sha256` (64 car. imposés), `source_registry` (flags de licence), `evidence_kernel_guard()` (immutabilité) | Structurel (DB) |
| `display_allowed` ≠ porte de publication | `license_policy.py:37-49` (publication = `allow_ingest AND allow_store` seulement) ; redaction (`value_withheld`) appliquée à la lecture, pas à la publication | Code — **à répliquer explicitement en P10**, non automatique |
| Aucun score composite opaque | `water_screening.py` — dimensions toujours séparées (risque, confiance) | Structurel (code) |
| Pas de PostGIS, pas de carte externe | Décision figée en-tête migration `036:13-26` ; `WorldMap.tsx` (D3/TopoJSON) pour `/materials` ; mêmes choix répétés pour `/water`, `/sites-geo` | Convention de dépôt, aucune dépendance ajoutée |

## Composants UI réutilisables

| Composant | Fichier | Rôle |
|---|---|---|
| `EvidenceList` | `components/intelligence/evidence-list.tsx` | Table des releases d'une source, badge de statut coloré |
| `LicenseWarning` | `components/intelligence/license-warning.tsx` | Badge licence OK/bloquée + raisons structurées |
| `StalenessWarning` | `components/intelligence/staleness-warning.tsx` | Bandeau péremption d'une release |
| `SourceDrawer` | `components/intelligence/source-drawer.tsx` | Panneau de provenance complet (code, release, checksum, attribution, licence) |
| `IroCandidateButton` | `components/intelligence/iro-candidate-button.tsx` | Bouton confirmation → candidat IRO |
| `DataStatusBadge` / `dataStatusToBadge()` | `components/ui/data-status-badge.tsx` | **Mapping canonique unique** `data_status → badge` (verified/estimated/manual/stale) |
| `FeatureStatusBadge` | `components/ui/feature-status-badge.tsx` | Pastille de statut produit (live/beta/planifié), alimentée par `feature-registry.ts` |
| `MethodChip` | `apps/carbon/app/(app)/water/page.tsx:87-97` (local à la page, pas encore extrait en composant partagé) | Affiche le `method_code` exécuté — **candidat à extraction** si réutilisé publiquement |

⚠️ **Ne pas confondre avec** `ProvenanceIntegrityCard` / `KpiWithProvenance` / `KpiProvenanceDrawer` (`components/ui/`) — système de chaîne de hash `facts_events`, sans rapport avec le Evidence Kernel malgré le nom.

**Composants NON réutilisables tels quels** : `MaterialsProvenance.tsx` (source codée en dur, pas d'appel API — à ne pas copier comme modèle d'intégration live).

## Contrats et services réutilisables

| Élément | Fichier | Statut |
|---|---|---|
| `SourceAdapter` (Protocol) | `apps/api/services/intelligence/adapters/base.py` | Contrat stable, à implémenter par P05-P09 |
| `FakeAdapter` | `apps/api/services/intelligence/adapters/fake.py` | Seule implémentation existante — référence de forme, pas de connecteur réel à copier |
| `license_policy.evaluate()` | `apps/api/services/intelligence/license_policy.py` | Réutilisable tel quel |
| `release_service.publish_release()` | `apps/api/services/intelligence/release_service.py` | Réutilisable tel quel |
| Moteur `run_screening()` | `apps/api/services/calculations/water_screening.py` | Référence de style (pur, refus explicites, empreinte reproductible) pour tout futur calcul dérivé public — pas directement appelable depuis le public (opère sur données tenant) |

## Patterns de routing/plateforme réutilisables

| Pattern | Précédent | À suivre pour `/water-intelligence` |
|---|---|---|
| Route publique hors `(app)` | `apps/carbon/app/materials/`, `apps/carbon/app/demo/` | Oui — `apps/carbon/app/water-intelligence/` |
| Layout serveur + `robots: {index:false}` pour une surface non indexée | `apps/carbon/app/demo/layout.tsx` | À évaluer en P04 selon l'objectif SEO |
| Carte sans service externe (D3/TopoJSON/World Atlas) | `components/materials/map/WorldMap.tsx` | Oui — imposé par le prompt P11 déjà présent |
| CSP centralisée | `apps/carbon/proxy.ts` | Aucune ouverture de domaine anticipée |
| Registre de statut produit | `lib/feature-registry.ts` + `data/feature-status.json` | À alimenter (entrée `water-intelligence`) quand la route existera |
