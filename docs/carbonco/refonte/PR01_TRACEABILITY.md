# PR-01 — `fix/materials-data-trust` · Traçabilité

**Périmètre :** vérité et intégrité du module public `/materials` (`apps/carbon`).
**Statut :** implémentation terminée, validée localement. **Aucun commit, aucun push.**
**Branche cible prévue :** `fix/materials-data-trust` (travail réalisé dans le worktree `vibrant-maxwell-c3504d`).

> Convention de statut : **FAIT** · **PARTIEL** · **NON FAIT** · **NON APPLICABLE**.

---

## 1. Exigences PR-01 et statut

### Étape 2 — Modèle de données

| # | Exigence | Statut | Preuve |
|---|----------|--------|--------|
| 2.1 | Remplacer le statut exclusif `criticality_eu` par `is_critical_eu` / `is_strategic_eu` / `regulation_version` | **FAIT** | `dataLoader.ts`, snapshot JSON |
| 2.2 | Toute matière stratégique a `is_critical_eu = true` | **FAIT** | test « toute matière stratégique est aussi critique » |
| 2.3 | Renommer `criticality_score` → `carbonco_supply_risk_score` + `score_methodology_version` + `score_confidence` | **FAIT** | snapshot + `dataLoader.ts` |
| 2.4 | Le score n'est jamais présenté comme officiel UE | **FAIT** | libellés « Score CarbonCo … estimé » (hero, treemap, fiche, tableau) |
| 2.5 | Aucune valeur numérique du snapshot modifiée (hors structure) | **FAIT** | script de transformation avec garde `carbonco_supply_risk_score === ancien criticality_score` pour les 34 matières |
| 2.6 | Ne plus utiliser `china_dominant` comme source de vérité ; dériver depuis `top_producers` + avertissement de stade | **FAIT** | `isChinaConcentrated()`, avertissements « stade agrégé — extraction/raffinage/transformation non distingués » |

Valeurs retenues (validées par Ludo) : `regulation_version = "CRMA-2024"`, `score_methodology_version = "CC-SUPPLY-RISK-0.1"`, `score_confidence = null`.

### Étape 3 — Transparence

| # | Exigence | Statut | Preuve |
|---|----------|--------|--------|
| 3.1 | Formulations « Snapshot de démonstration / Valeurs estimées / Non normatif / Date / historique enrichi uniquement à la publication d'un nouveau snapshot daté » | **FAIT** | `SnapshotBanner.tsx`, footer `/materials`, fiche `[id]` |
| 3.2 | `methodology_note` rendu visible dans la page | **FAIT** | bloc « Méthodologie — … » du `SnapshotBanner` |
| 3.3 | Disparition de « aucune donnée inventée » tant que les valeurs sont `estimated` | **FAIT** | footer réécrit + `feature-status.json` ; garde `claims-guard` |
| 3.4 | Disparition de « mise à jour automatique des sources chaque lundi » | **FAIT** | `SnapshotBanner` réécrit ; garde `claims-guard` |

### Étape 4 — Prix

| # | Exigence | Statut | Preuve |
|---|----------|--------|--------|
| 4.1 | Une série `< 2` points n'est jamais présentée comme tendance historique | **FAIT** | `hasRenderableHistory()` ; test dédié ; état actuel = 1 point partout |
| 4.2 | Aucun graphique/badge ne simule une série | **FAIT** | `Sparkline` déjà gardé `≥ 2` ; branche « Estimation snapshot » sinon |
| 4.3 | `trend_3m_pct` affiché uniquement comme estimation du snapshot, badge `ESTIMATED`, jamais comme historique observé | **FAIT** | `PriceAlertModule`, `MaterialsGrid`, fiche `[id]` (« est. », `title` explicite, badge ESTIMATED) |

### Étape 5 — Composants

| # | Exigence | Statut | Preuve |
|---|----------|--------|--------|
| 5.1 | `DataStatusBadge` accessible (états VERIFIED/ESTIMATED/MANUAL/STALE) | **FAIT** | `components/ui/data-status-badge.tsx` + test |
| 5.2 | `MethodBadge` si nécessaire | **NON APPLICABLE** | non requis en PR-01 : le score porte déjà sa version, affichée « estimé ». Composant prévu PR-03 |
| 5.3 | `StalenessWarning` si nécessaire | **PARTIEL** | logique STALE intégrée au `SnapshotBanner` (seuil 120 j → bascule le badge en `STALE`). Pas de composant dédié : le snapshot (30/06/2026) n'est pas périmé aujourd'hui |
| 5.4 | Adapter hero, snapshot banner, filtres, tableaux, cartes, treemap, alertes, dépendance Chine, métadonnées | **FAIT** | voir §2. Cartes (`GlobalMap*`) inchangées : elles n'utilisaient aucun des champs touchés |

### Étape 6 — Tests

| # | Exigence | Statut | Preuve |
|---|----------|--------|--------|
| 6.1 | Stratégique implique critique | **FAIT** | `materials-data-trust.test.ts` |
| 6.2 | Filtres stratégique / critique non mutuellement exclusifs | **FAIT** | implémentation `matchesFilter` + invariant sous-ensemble testé |
| 6.3 | Score renommé partout (plus de champ hérité) | **FAIT** | test « aucun champ hérité ne subsiste » |
| 6.4 | `methodology_note` visible | **FAIT** | test transparence + HTML prérendu (`Méthodologie` présent) |
| 6.5 | Aucun texte de mise à jour automatique externe | **FAIT** | `claims-guard` étendu (scan `app/materials` + `components/materials`) |
| 6.6 | Aucune tendance historique avec un seul point | **FAIT** | test `hasRenderableHistory` + invariant dataset |
| 6.7 | Badges qualité corrects | **FAIT** | `data-status-badge.test.tsx` |
| 6.8 | Page statiquement rendable | **FAIT** | build : `/materials` statique, `/materials/[id]` SSG 34 pages |
| 6.9 | Accessibilité de base | **FAIT** | `aria-label` du badge testé |

### Contraintes

| Contrainte | Statut |
|------------|--------|
| TypeScript strict, aucun `any` nouveau | **FAIT** |
| Aucune dépendance ajoutée | **FAIT** |
| Aucun appel API runtime | **FAIT** (snapshot local uniquement) |
| Aucune donnée externe ajoutée | **FAIT** |
| Aucun changement de positionnement global de CarbonCo | **FAIT** |
| Responsive préservé | **FAIT** (structure des grilles/flex inchangée) |
| Pas de commit / pas de push | **FAIT** |

---

## 2. Fichiers modifiés / créés

### Modifiés (16)

- `apps/carbon/lib/crm/dataLoader.ts` — nouveau modèle `Material`, `CRMDataset.methodology_note`, helpers `isChinaConcentrated`, `hasRenderableHistory`, `summarize`, constante `CHINA_DOMINANCE_THRESHOLD`.
- `apps/carbon/data/crm_full_34_snapshot_2026-06-30.json` — transformation de structure (champs renommés/dérivés), valeurs numériques préservées.
- `apps/carbon/data/feature-status.json` — description du module `materiaux-critiques` réalignée (retrait « historique hebdomadaire » et « aucune donnée inventée »).
- `apps/carbon/app/materials/page.tsx` — hero/banner nouveau contrat, footer honnête.
- `apps/carbon/app/materials/[id]/page.tsx` — badges statut, score CarbonCo, prix estimé, dépendance Chine dérivée, métadonnée.
- `apps/carbon/app/page.tsx` — stat Chine dérivée via `summarize` (fin du `china_dominant` figé).
- `apps/carbon/app/produit/page.tsx` — « Snapshot hebdomadaire » → « Snapshot de démonstration daté — valeurs estimées ».
- `apps/carbon/components/pages/landing-page.tsx` — type `MaterialsStats` (`chinaConcentrated` + `chinaThreshold`), libellé + retrait « historique de prix hebdomadaire ».
- `apps/carbon/components/materials/MaterialsHero.tsx` — 4 indicateurs 100 % dérivés ; « 94 % aimants » supprimé et remplacé par « % de données estimées » (badge ESTIMATED) ; stat Chine avec avertissement de stade.
- `apps/carbon/components/materials/SnapshotBanner.tsx` — texte honnête, `methodology_note` visible, badge ESTIMATED/STALE, part estimée.
- `apps/carbon/components/materials/ChinaDependencyWidget.tsx` — avertissement de stade agrégé, interface nettoyée.
- `apps/carbon/components/materials/CriticalityTreemap.tsx` — score CarbonCo, `is_strategic_eu`, libellés estimés.
- `apps/carbon/components/materials/StrategicVsCriticalSection.tsx` — réécriture : stratégiques ⊂ critiques (sous-ensemble explicite), score CarbonCo, concentration Chine dérivée.
- `apps/carbon/components/materials/MaterialsGrid.tsx` — filtres non exclusifs (`Chine ≥ 50%`), badges/score renommés, prix marqué estimation snapshot.
- `apps/carbon/components/materials/PriceAlertModule.tsx` — badge ESTIMATED, libellé « tendance estimée par le snapshot ».
- `apps/carbon/tests/claims-guard.test.ts` — nouveaux motifs interdits + scan des fichiers `materials`.

### Créés (3)

- `apps/carbon/components/ui/data-status-badge.tsx` — composant partagé `DataStatusBadge` + `statusFromQuality`.
- `apps/carbon/tests/materials-data-trust.test.ts` — invariants modèle/prix/summary/transparence (15 tests).
- `apps/carbon/tests/data-status-badge.test.tsx` — rendu + accessibilité du badge (4 tests).

> `crm_price_history.json`, `scripts/append-price-history.mjs` et `.github/workflows/materials-price-history.yml` **inchangés** : leur comportement (re-copie du prix du snapshot local, dédup par date, aucun fetch externe) est déjà honnête. Seule leur description publique était trompeuse.

---

## 3. Tests associés

- `tests/materials-data-trust.test.ts` (15) — modèle CRMA non exclusif, absence des champs hérités, dérivation Chine, règle « pas de tendance à 1 point », `summarize`, transparence méthodologie.
- `tests/data-status-badge.test.tsx` (4) — quatre états, `aria-label`, libellé personnalisé, `statusFromQuality`.
- `tests/claims-guard.test.ts` (35, +29 par rapport à l'existant) — motifs interdits PR-01 + scan récursif `app/materials` et `components/materials`.

---

## 4. Commandes exécutées et résultats

> Exécutées depuis le worktree `…/vibrant-maxwell-c3504d/apps/carbon`.

| Commande | Résultat |
|----------|----------|
| `git diff --check` | **OK** — aucun conflit/espace erroné (uniquement des avertissements informatifs LF→CRLF). |
| `npm --prefix apps/carbon run lint` | **OK** — `0 errors`, 20 warnings **tous préexistants** (aucun dans les fichiers `materials`/`ui` touchés). |
| `npm --prefix apps/carbon run test` | **OK** — **145 tests / 13 fichiers**, 100 % passés (dont materials-data-trust 15, data-status-badge 4, claims-guard 35). |
| `npm --prefix apps/carbon run build` | **OK** — `/materials` prérendu **statique**, `/materials/[id]` **SSG (34 pages)**. |

Vérification du HTML prérendu (`.next/server/app/materials.html`) :
- Présents : « Snapshot de démonstration », « Données estimées », « score CarbonCo », « Méthodologie », « Production concentrée en Chine », « Stratégiques vs critiques », « 100% ».
- Absents : « aucune donnée inventée », « mise à jour automatique », « historique de prix hebdomadaire », « Snapshot hebdomadaire », « 20/34 », « 94 % aimants ».

---

## 5. Limites restantes (dans le périmètre livré)

1. **Part Chine au stade agrégé.** Le snapshot ne distingue toujours pas extraction / raffinage / transformation. La valeur affichée agrège les étapes ; un avertissement l'indique partout. La vraie modélisation par étape est du ressort de la PR-07 (CRMA).
2. **Score CarbonCo non encore formalisé.** `carbonco_supply_risk_score` conserve les valeurs de démonstration ; `score_confidence = null` (aucune méthode de confiance définie), version `0.1`. La formule versionnée et la confiance calculée relèvent du Method Engine (PR-07).
3. **Historique de prix à un seul point.** Comportement inchangé et désormais honnêtement décrit. Les vraies séries n'apparaîtront que lorsqu'un flux sourcé remplacera le snapshot.
4. **Statut `live` conservé** pour le module dans `feature-status.json` : la page est réellement disponible et désormais honnête (démo/estimé explicite). Non rétrogradée en `beta` — à rediscuter si tu préfères marquer un module de démonstration en `beta`.
5. **`SnapshotBanner` calcule l'état STALE côté client** (`Date.now()`, seuil 120 j) : pas de risque d'hydratation en pratique (bascule impossible à l'échelle d'un chargement de page).

---

## 6. Explicitement reporté aux PR suivantes

- **PR-02 (ledger de migrations)** : aucune modification du système de migrations, aucune table `schema_migrations`. Non commencé.
- **PR-03 (Evidence Kernel)** : aucune table sources/releases/artefacts/observations ; composants `MethodBadge`, `ConfidenceBadge`, `SourceDrawer`, `EvidenceList` complets non créés (seul `DataStatusBadge` livré, car requis par PR-01).
- **PR-04 (source admin / migration snapshot)** : le snapshot n'est pas encore enregistré comme source + release `estimated`. Il reste un import JSON local.
- **PR-07 (CRMA / exposition matières)** : modélisation par étape de transformation, score versionné par le Method Engine, rapport Article 24.
- Aucune nouvelle architecture backend, aucun appel réseau au rendu, aucune donnée externe : conformes aux consignes.

---

## 7. Notes d'exécution (worktree)

Le worktree n'avait pas de `node_modules`. Une première tentative via jonction Windows vers le `node_modules` du dépôt principal fait **échouer Turbopack** (« Symlink node_modules is invalid, it points out of the filesystem root »). Résolu par un **install réel** dans le worktree : `npm ci --legacy-peer-deps` (915 paquets, 0 vulnérabilité). `apps/carbon` est autonome (pas de workspaces npm, lockfile propre). `node_modules` et `.next` restent gitignorés — absents du diff.
