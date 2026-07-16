# PR-01 — Audit post-merge (réconciliation avant PR-02)

**Branche de travail :** `fix/materials-post-merge-reconciliation`.
**Périmètre strict :** frontend `/materials`, tests de vérité, documentation. Aucune modification `apps/api`, aucune migration, aucune table, aucune donnée externe.
**Statut : COMMITÉ ET POUSSÉ** — commit `1cf9360`, PR [#94](https://github.com/ludoviclabs-dotcom/finance-platform/pull/94) ouverte sur `master`, non mergée (fusion laissée à Ludo).

---

## 1. Commit master audité

`1b435f7` — `Merge pull request #93 from ludoviclabs-dotcom/fix/materials-jsx-whitespace`, sur `origin/master`.

## 2. PR fusionnées couvertes par cet audit

| PR | Titre | Commit de merge |
|---|---|---|
| [#92](https://github.com/ludoviclabs-dotcom/finance-platform/pull/92) | `fix(carbon): aligne /materials sur la réalité des données` | `08aca2d` |
| [#93](https://github.com/ludoviclabs-dotcom/finance-platform/pull/93) | `fix(carbon): corrige les espaces manquants sur /materials` | `1b435f7` |

## 3. Écarts détectés après fusion

### 3.1 — `SupplyChainExplainer.tsx` : géopolitique codée en dur, non sourcée (CONFIRMÉ)

Écart signalé en amont de cet audit, vérifié par lecture directe du fichier puis par `rg` sur tout `app/materials` + `components/materials` :

```
apps/carbon/components/materials/SupplyChainExplainer.tsx:11:    risk: "Quasi-monopole chinois sur 91% des terres rares",
apps/carbon/components/materials/SupplyChainExplainer.tsx:12:    countries: ["Chine (91%)", "Japon", "Estonie"],
apps/carbon/components/materials/SupplyChainExplainer.tsx:17:    risk: "Chine contrôle 94% des aimants permanents mondiaux",
apps/carbon/components/materials/SupplyChainExplainer.tsx:23:    risk: "Dépendance aux équipementiers asiatiques (CATL, TSMC, Samsung)",
```

Ce composant n'était pas dans la liste d'inspection obligatoire du prompt PR-01 original (`PROMPT_CLAUDE_CODE_PR01_MATERIALS_TRUST.md` ne le cite pas explicitement — seuls `page.tsx`, `dataLoader.ts`, les JSON et « tous les composants `components/materials` » de façon générique), ce qui explique qu'il ait échappé au premier passage : ces 4 valeurs n'ont ni source, ni date, ni statut de qualité, ni distinction extraction/raffinage/transformation issue du dataset — exactement le type de claim que PR-01 visait à éliminer ailleurs sur la page.

**Aucun autre écart trouvé** dans les autres fichiers audités (voir §7, commande `rg` exécutée deux fois : avant et après correctif).

### 3.2 — Reste du périmètre : conforme à `PR01_TRACEABILITY.md`

Vérification croisée code réel ↔ document, fichier par fichier :

| Fichier | Vérifié | Conforme au doc ? |
|---|---|---|
| `app/materials/page.tsx` | `isSnapshotStale` importé et appelé côté serveur, prop `isStale` passée à `SnapshotBanner` | Oui |
| `app/materials/[id]/page.tsx` | badges, score CarbonCo, dépendance Chine dérivée présents | Oui |
| `components/materials/SnapshotBanner.tsx` | pas de `"use client"`, prop `isStale` en entrée (pas de `Date.now()`) | Oui |
| `components/ui/data-status-badge.tsx` | 4 états, `statusFromQuality` | Oui |
| `lib/crm/dataLoader.ts` | `isSnapshotStale`, `STALE_AFTER_DAYS`, `summarize`, `isChinaConcentrated`, `hasRenderableHistory` tous présents | Oui |
| `data/crm_full_34_snapshot_2026-06-30.json` | `is_critical_eu`/`is_strategic_eu`/`carbonco_supply_risk_score`/`regulation_version` ; aucun champ hérité | Oui |
| `data/feature-status.json` | description sans « hebdomadaire » ni « aucune donnée inventée » | Oui |
| `tests/claims-guard.test.ts` | 35 tests, scan `materialsFiles()` récursif actif | Oui (avant extension §4) |
| `tests/materials-data-trust.test.ts` | 19 tests dont `isSnapshotStale` (post PR #93) | Oui |
| `PR01_TRACEABILITY.md` | contenait des mentions obsolètes | **Non — corrigé, voir §4** |

**Divergences trouvées entre `PR01_TRACEABILITY.md` (avant cet audit) et le code réel :**

1. Le document affirmait « **Aucun commit, aucun push** » et listait une contrainte « Pas de commit / pas de push : FAIT » — obsolète depuis la création puis la fusion de PR #92 et #93.
2. Le document donnait `fix/materials-data-trust` comme branche cible — la branche réellement utilisée pour PR #92 était `claude/wizardly-allen-18762e`.
3. Le document décrivait `SnapshotBanner` comme calculant l'état STALE **côté client** via `Date.now()` (« pas de risque d'hydratation en pratique ») — cette description correspondait à l'état *avant* la review Codex sur PR #92, mais le code fusionné a déjà la version corrigée (calcul serveur). Le document n'avait simplement pas été mis à jour après ce correctif.
4. Le document indiquait 145 tests / `materials-data-trust.test.ts` à 15 — le total réel après PR #93 est 149 / 19 (les 4 tests `isSnapshotStale` ajoutés pendant la review Codex n'avaient pas été reportés dans le tableau récapitulatif).
5. Aucune mention de PR #93 elle-même (le document ne couvrait que l'état pré-fusion de PR-01).

Toutes ces divergences sont corrigées dans `PR01_TRACEABILITY.md` (voir diff de ce fichier dans cette même branche).

## 4. Correctifs apportés

### A — `SupplyChainExplainer.tsx`

- Retrait des 3 affirmations chiffrées non sourcées et du `"(91%)"` inline dans la liste de pays de l'étape Raffinage.
- Remplacement par des formulations qualitatives (issues de la liste acceptée) :
  - Raffinage : *« Capacités de raffinage fortement concentrées dans un nombre limité de pays »*
  - Transformation : *« Capacités de transformation et de fabrication d'aimants géographiquement concentrées »*
  - Composants : *« Dépendance à des écosystèmes industriels spécialisés »* (CATL/TSMC/Samsung retirés — noms non nécessaires à l'argument)
- Ajout d'un avertissement explicite sous le titre de section : *« Schéma pédagogique — le snapshot actuel ne quantifie pas séparément chaque étape ; les pays cités illustrent des mécanismes de concentration connus, pas une mesure auditée par matière. »*
- Aucun pourcentage de remplacement inventé ; aucune nouvelle donnée externe.

### B — `claims-guard.test.ts` étendu

5 nouveaux motifs ajoutés à `FORBIDDEN_CLAIMS` (scope `"all"`, donc couverts par le scan récursif `materialsFiles()` déjà en place) :

- `91\s*%[…]terres\s+rares` (et inverse) — cible le couple valeur+sujet, pas tous les « 91% ».
- `94\s*%[…]aimants\s+permanents` (et inverse) — idem.
- Les 3 formulations exactes supprimées (« Quasi-monopole chinois sur 91% », « Chine contrôle 94% », « équipementiers asiatiques (CATL, TSMC, Samsung) »).

Aucune regex générique sur `\d+%` : les valeurs de part Chine dérivées du dataset (`getChinaShare`, badge `ESTIMATED`) restent légitimes et ne sont pas affectées — vérifié par l'exécution complète de la suite (149 tests toujours verts, y compris tous les tests qui exercent des pourcentages dérivés du dataset : `MaterialsGrid`, `ChinaDependencyWidget`, `StrategicVsCriticalSection`, `CriticalityTreemap`).

### C — Documentation

- `PR01_TRACEABILITY.md` mis à jour (voir §3.2 pour le détail des 5 divergences corrigées).
- Ce document créé.

## 5. Fichiers modifiés

| Fichier | Changement |
|---|---|
| `apps/carbon/components/materials/SupplyChainExplainer.tsx` | Retrait claims non sourcés, ajout disclaimer pédagogique |
| `apps/carbon/tests/claims-guard.test.ts` | +5 motifs interdits ciblés |
| `docs/carbonco/refonte/PR01_TRACEABILITY.md` | Réconciliation post-merge (5 divergences corrigées) |
| `docs/carbonco/refonte/PR01_POST_MERGE_AUDIT.md` | Créé (ce document) |

Aucun fichier `apps/api`, aucune migration, aucune table, aucune dépendance ajoutée.

## 6. Tests ajoutés

Aucun nouveau fichier de test créé. `claims-guard.test.ts` étendu (voir §4-B) — le nombre de fichiers `it(...)` scannés (35) est inchangé, seul le nombre de motifs vérifiés par fichier augmente ; ce test ne compte pas les motifs individuellement.

## 7. Commandes exécutées et résultats

Exécutées depuis `…/vibrant-maxwell-c3504d/apps/carbon`, sur la branche `fix/materials-post-merge-reconciliation` (base `origin/master` = `1b435f7`).

| Commande | Résultat |
|---|---|
| `rg -n "91\s*%|94\s*%|CATL|TSMC|Samsung|aucune donnée inventée|mise à jour automatique|historique.*hebdomadaire" apps/carbon/app/materials apps/carbon/components/materials` (avant correctif) | 4 occurrences trouvées, toutes dans `SupplyChainExplainer.tsx` |
| Même commande (après correctif) | **0 occurrence** (exit code 1 = aucun match) |
| `git diff --check` | **OK** — aucun conflit/espace erroné |
| `npm --prefix apps/carbon run lint` | **OK** — `0 errors`, 20 warnings préexistants (aucun nouveau) |
| `npm --prefix apps/carbon run test` | **OK** — **149 tests / 13 fichiers**, 100 % passés |
| `npm --prefix apps/carbon run build` | **OK** — `/materials` prérendu **statique**, `/materials/[id]` **SSG (34 pages)** |

Vérification du HTML compilé (`.next/server/app/materials.html`) :
- Absents : `91%`, `94%`, `CATL`, `TSMC`, `Samsung`, `Quasi-monopole`, `contrôle 94`.
- Présents : « Capacités de raffinage fortement concentrées », « Dépendance à des écosystèmes industriels spécialisés », « Schéma pédagogique ».

## 8. Claims résiduels acceptés et justification

| Claim résiduel | Justification |
|---|---|
| Part Chine par matière dérivée du dataset (`getChinaShare`), affichée avec badge `ESTIMATED` et avertissement de stade agrégé | Dérivée des données du snapshot lui-même (pas d'affirmation externe non sourcée), qualité explicitement marquée estimée — conforme au modèle PR-01 |
| Pays cités dans la frise `SupplyChainExplainer` (Chine, RD Congo, Australie, Chili, Japon, Estonie, Corée du Sud, Taïwan, Europe, USA) sans part chiffrée | Illustratif d'un mécanisme de chaîne de valeur connu (extraction → produit fini), explicitement qualifié de « schéma pédagogique » non quantifié — accepté car non présenté comme une mesure |
| `score_confidence = null` sur toutes les matières | Aucune méthode de confiance formalisée à ce stade (Method Engine = PR-07) ; `null` est honnête (absence de mesure), pas une valeur inventée |
| Statut `live` du module `materiaux-critiques` dans `feature-status.json` | La page est réellement disponible en production et désormais honnête sur son caractère estimé/démo — reporté comme point à rediscuter (voir `PR01_TRACEABILITY.md` §5.4), non bloquant pour cette réconciliation |

## 9. Éléments reportés à PR-02, PR-03 ou PR-07

- **PR-02 (ledger de migrations)** : non commencé, non touché par cette réconciliation — conforme à l'interdiction explicite de cette mission.
- **PR-03 (Evidence Kernel)** : `MethodBadge`, `ConfidenceBadge`, `SourceDrawer`, `EvidenceList` restent à créer. La frise `SupplyChainExplainer`, une fois l'Evidence Kernel disponible, pourrait porter de vraies sources datées (USGS, CRMA/RMIS) au lieu d'un simple disclaimer pédagogique.
- **PR-07 (CRMA / exposition matières)** : modélisation par étape (extraction/raffinage/transformation) qui permettrait de quantifier honnêtement ce que `SupplyChainExplainer` ne fait aujourd'hui qu'illustrer qualitativement.
- Aucun élément de cette réconciliation ne nécessite une modification du système de migrations, une nouvelle table, ou `apps/api`.

## 10. Recommandation

**PRÊT POUR REVUE.**

Commité (`1cf9360`) et poussé sur `fix/materials-post-merge-reconciliation` ; PR #94 ouverte contre `master`, en attente de revue et de fusion par Ludo (non mergée par Claude Code).

Justification : le seul écart substantif détecté (`SupplyChainExplainer.tsx`) est corrigé et verrouillé par un garde-fou de test ciblé ; toutes les vérifications obligatoires passent (lint 0 erreur, 149/149 tests, build OK, `rg` de contrôle à 0 occurrence) ; la documentation directrice (`PR01_TRACEABILITY.md`) reflète maintenant l'état réel post-merge. Commit et push effectués sur autorisation explicite — la fusion de PR #94 reste entièrement à Ludo.
