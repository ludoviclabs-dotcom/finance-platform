# Wave C — Produit public (P10 read model + P11 carte + P12 contenus)

**Branche :** `feat/water-intelligence-wave-c-public-data-product`
**Base :** `master` @ `daaf8f0` (PR #153 Wave A, #154 blueprint UX, #155 Wave B
fusionnées ; Vercel `carbon` et `carbonco-api` en production `READY` sur ce SHA).
**Périmètre :** MACRO-PROMPT C uniquement. Wave D non lancée.

---

## 1. Le résultat en une phrase

**Le produit public est livré, et il ne publie rien** — parce qu'aucune source
n'a de décision humaine de publication active. Cet état vide est valide, testé,
et rendu honnêtement. C'est le résultat correct du gate licence, pas une panne.

## 2. Commits

| Commit | Objet |
|---|---|
| `docs` | C0 — synchronisation du pilotage après le merge #155 |
| `fix` | C1 — identité temporelle sûre |
| `feat` | C2 — read model public + registre des décisions de publication |
| `feat` | C3 — fondations UI |
| `feat` | C4 — carte multi-échelle |
| `feat` | C5 — contenus sourcés |
| `feat` | C6 — intégration de `/water-intelligence` |
| `docs` | C7 — ce handoff + pilotage vers Wave D |

---

## 3. Identité temporelle (C1)

`ObservationDraft.dedup_key()` retourne `(subject_type, subject_key,
metric_code)` — **sans période**. Vrai pour `/materials` (un point de prix
courant par matière), faux pour toute chronique. Depuis la Wave B le chantier
produit de vraies séries : un graveur réutilisant cette clé **écraserait
silencieusement toutes les périodes sauf la première**.

`services/water_intelligence/observation_identity.py` livre une identité propre
à Water Intelligence : `schema_version`, `source_code`, `release_key`,
`subject_type`, `subject_key`, `metric_code`, `geography_scope`,
`geography_code`, `period_start`, `period_end`, `scenario_code`,
`horizon_year`. Empreinte SHA-256 sur JSON canonique trié.

**Méthode et version EXCLUES — décision documentée.** Une release est
immuable : à l'intérieur d'une même `release_key`, le même fait recalculé avec
une autre méthode n'est pas un fait nouveau, c'est une incohérence. Les inclure
la ferait taire ; les exclure la fait remonter comme collision explicite. Entre
releases, `release_key` diffère déjà.

**Ledger** : identité inconnue → enregistrée ; identité connue + contenu
identique → rejeu idempotent ; identité connue + contenu différent →
`WaterIdentityCollisionError`. Jamais de « première valeur gagnante ».

`dedup_key()` **n'est pas modifiée** : contrat PR-04 partagé avec `/materials`,
dont les suites restent vertes. Un test AST vérifie que le nouveau module ne la
référence jamais.

---

## 4. Gate licence et sources (C2)

### 4.1 Le principe

Identifier la licence générale d'une plateforme **ne rend pas** ses jeux
publiables. Hub'Eau est en Licence Ouverte Etalab, l'EEA publie le WEI+ en
CC BY 4.0 — faits vérifiés en Waves A et B, et insuffisants. Il faut une
**décision humaine explicite et signée**.

| Statut | Publiable | Sens |
|---|---|---|
| `approved` | oui, si `reviewed_by` **et** `reviewed_on` | Un humain a tranché et signé |
| `proposed` | non | Analyse faite, décision non rendue |
| `refused` | non | Refus explicite |
| *(absente)* | non | Exclusion par défaut |

Un `approved` sans réviseur ni date est **rejeté à la construction** : une
signature manquante n'est pas une signature.

### 4.2 État réel

| Source | Décision | Motif |
|---|---|---|
| `WRI_AQUEDUCT` | **refused** | Enregistrement WRI non effectué |
| `COPERNICUS_EDO` | **refused** | `source_verified_decoder_deferred`, aucune valeur décodée |
| `EEA_WEI_PLUS` | **proposed** | CC BY 4.0 vérifiée, décision non rendue |
| `HUBEAU_HYDROMETRIE` | **proposed** | Etalab vérifiée, décision non rendue |
| `HUBEAU_ADES` | **proposed** | idem |
| `HUBEAU_BNPE_PRELEVEMENTS` | **proposed** | idem + rappel de couverture (usages exonérés, seuil 10 000 m³) |
| `HUBEAU_QUALITE_SURFACE` | **proposed** | idem + allowlist SANDRE à revoir, aucune conclusion de conformité |

**Aucune source approuvée ⇒ snapshot vide.**

### 4.3 Snapshot

Le contrat P02 impose `sources: min_length=1` : un manifest vide serait un
manifest qui ne décrit rien. Plutôt que d'affaiblir P02, Wave C ajoute
`WaterPublicSnapshot`, qui porte le manifest **seulement s'il y a quelque chose
à décrire** (`None` sinon) et porte **toujours** exclusions, décisions,
budgets, couverture, périodes, méthodes et avertissements.

- **Double barrière licence** : une source autorisée ne rend pas publiable une
  observation dont `allow_display` est faux ;
- **Aucune donnée tenant** : garde-fou couvrant `model_dump`, `__dict__`
  (attribut posé hors schéma) et `model_extra` ; le loader refuse aussi tout
  snapshot en contenant un ;
- **ETag** faible sur le hash du snapshot : le cache ne peut être invalidé que
  par un changement réel de contenu ;
- **Budgets P02 §7** appliqués : un dépassement est refusé, jamais tronqué ;
- **Loader** borné, lecture seule, une seule méthode publique.

---

## 5. Interface (C3, C4, C5, C6)

### 5.1 Décideur d'état pur

`lib/water-intelligence/data-state.ts` décide les huit états et leur priorité :
fixture > erreur > licence bloquée > absent > chargement > nominal, avec
`stale` et `partial-coverage` en modificateurs cumulables. Isolé en fonction
pure parce que cet ordre est la règle la plus facile à casser par inadvertance.
Quand `rendersValue` est faux, le composant **ne rend pas ses enfants** : une
valeur ne peut pas fuir sous un état bloqué.

### 5.2 Composants

`WiDataState`, `WiLegend` (paliers nommés, jamais un dégradé ; seuils issus de
la méthode), `WiAccessibleDataTable` (équivalent strict de la carte, rendue au
serveur, total annoncé, lignes sans valeur conservées), `WiWaterPulse` (état
des couches, jamais de l'eau), `WiExclusionList`, `WiMapFrame`,
`WiProvenanceDrawer` (îlot), `WiFilterBar` (îlot), `WiEditorial*`, previews
Wave D.

Deux îlots clients seulement. Thème `--wi-*` exclusivement ; aucun `--mx-*`,
aucune couleur Tailwind brute (tests dédiés).

### 5.3 Carte

État entièrement dérivable de l'URL, en fonctions **pures** : filtres,
sérialisation, hiérarchie, sélection. Une valeur invalide est **ignorée et
signalée** — un lien partagé après retrait d'une couche ne produit pas un écran
vide inexpliqué. Aucune option codée en dur : vocabulaire vide ⇒ rien accepté.

Rendu D3 : squelette repris de `WorldMap.tsx`, sans le provider `--mx-*` ni
l'anneau pulsé. **Les absences sont exclues du domaine de la rampe** — les
inclure les compterait comme des valeurs basses. Jointure par code, jamais par
libellé. Transition neutralisée sous `prefers-reduced-motion`.

**La carte n'est pas montée** faute de couche publiée, et l'écran explique
pourquoi.

### 5.4 Contenus

Le **contenant** est livré, **aucun contenu** ne l'est : un record exige source,
date de revue et réviseur identifié, et aucun humain n'a rédigé ni revu de
contenu. Garde-fous testés : rang d'acteur rejeté, quantité sans source
rejetée, date d'événement obligatoire et distincte de la publication,
territoire obligatoire.

---

## 6. Budgets et performance

| Objet | Budget | État |
|---|---|---|
| Snapshot non compressé | 100 Ko | largement sous le budget (snapshot vide) |
| Couche compressée | 400 Ko | aucune couche |
| Entités par couche | 1 000 | borné des deux côtés (Python + Zod) |
| Points par série | 120 | aucune série |
| `/water-intelligence` | prérendu `○` | **préservé** — aucun bailout CSR global |

---

## 7. Validation

| Contrôle | Résultat |
|---|---|
| Suite API complète | **1581 passed, 714 skipped**, 0 échec |
| Nouveaux tests backend | 72 (31 identité + 41 snapshot) |
| `ruff check . --select=E,F,I --ignore=E501` | propre |
| Suite frontend complète | **412 passed, 27 fichiers**, 0 échec |
| Nouveaux tests frontend | 97 (36 fondations + 24 carte + 20 contenus + 17 intégration) |
| `tsc --noEmit` | propre |
| `npm run build` | réussi, `/water-intelligence` en `○` |
| Migrations | **0** |
| Dépendances ajoutées | **0** |
| `/water` | intact |

---

## 8. Limites connues et risques

1. **Rien n'est publié.** C'est le comportement correct, mais cela signifie que
   la carte, la table et les contenus n'ont jamais été exercés sur de vraies
   données. Leur comportement à charge réelle reste à vérifier lors de la
   première publication autorisée.
2. **La table alternative est vide** faute de couche : sa parité stricte avec
   la carte est garantie par construction (même source de données) mais non
   encore observée sur un jeu réel.
3. **`dedup_key()` reste inchangée.** Le futur graveur Evidence Kernel doit
   utiliser `WaterObservationIdentity`, jamais la clé PR-04.
4. **Aucune Preview Vercel vérifiée manuellement** dans cette session : la PR
   en produira une, à contrôler humainement (desktop/tablette/mobile,
   clair/sombre, clavier, table, absence de données).
5. **Les seuils de rampe** devront venir des métadonnées de méthode de la
   source, jamais du JSX — le composant les accepte en props et refuse d'en
   inventer, mais aucune source n'en fournit encore.

---

## 9. Gestes opérateur

1. **Autoriser une source** : ajouter une `PublicationDecision` `approved` avec
   `reviewed_by` et `reviewed_on` dans `publication_decisions.py`. Sans ces
   deux champs, la décision est rejetée.
2. **Assembler un snapshot** : `assemble_public_snapshot(observations,
   generated_at=…, registry=current_registry())`. `generated_at` est injecté.
3. **Servir** : exposer `snapshot.canonical_json()` avec `snapshot.etag()` en
   `ETag`. Le cache s'invalide seulement si le contenu change.
4. **Publier un contenu éditorial** : rédiger, faire revoir par un humain
   identifié, puis valider via `validateEditorialRecords`.

---

## 10. Passage à Wave D

Wave D (`feat/water-intelligence-wave-d-decision-layer`) livre P13 conformité,
P14 synergies et P15 finance. Points d'attention hérités :

1. **Le registre juridique (P13) est la seule surface autorisée à parler de
   conformité.** Ni les connecteurs, ni le read model, ni l'UI publique ne
   portent de seuil réglementaire — c'est vérifié par AST côté qualité Hub'Eau.
2. **Les previews C15/C16 doivent être remplacées, pas complétées.** Elles ne
   rendent aujourd'hui aucun chiffre ni date, et deux tests l'imposent :
   les remplacer par du réel exige de retirer ces tests en connaissance de
   cause.
3. **P14 touche au tenant.** La frontière est stricte : aucune donnée
   d'entreprise sur `/water-intelligence`. Les ponts sont unidirectionnels,
   du public vers le cockpit.
4. **L'identité temporelle est disponible** (`WaterObservationIdentity`) et
   doit être utilisée par tout graveur, y compris côté authentifié.
5. **Aucune source n'est encore publiable** : Wave D travaillera, comme
   Wave C, sur un produit qui ne publie rien tant qu'une décision humaine
   n'est pas rendue.
