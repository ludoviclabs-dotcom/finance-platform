# X4B-PREP — Preuve du run de mesure

Run de référence des mesures X4B-PREP. Ce document est la **traçabilité** :
il dit d'où vient chaque chiffre, et à quel niveau de preuve.

| Fait | Valeur |
|---|---|
| Workflow | `Water X4B-PREP — construction des candidats (sans publication)` |
| Run ID | `30306257628` |
| Job ID | `90111146628` |
| Branche | `master` |
| Commit | `c01b8841202342fffdb9690660ad24354c151bd9` (merge de la PR #175) |
| Déclenchement | `workflow_dispatch`, `candidate = all` |
| Fenêtre | 2026-07-27T21:18:45Z → 21:19:10Z |
| Artefact | `water-x4b-prep-reports`, 20 305 octets, 15 fichiers, ID `8668564290` |
| Digest de l'artefact | `sha256:fdd7ab2ab63fbacac5c2c7b1ca5344e8f951155ee2042d3e969b06eff24c494a` |
| Résultat du job | **échec**, sur la seule étape `diff-ades` |

---

## 1. Niveau de preuve — à lire avant les chiffres

Les mesures de ce dossier n'ont pas toutes le même statut, et les confondre
serait exactement la faute que cette phase combat. Trois niveaux :

| Niveau | Ce que cela signifie | Comment le vérifier |
|---|---|---|
| **A — journal du run** | Lu directement dans les logs publics du job `90111146628` | Rejouable par quiconque ouvre le run |
| **B — artefact du run** | Produit par le run, contenu dans `water-x4b-prep-reports` | Exige de télécharger l'artefact |
| **C — dérivé** | Calculé à partir de A ou B, sans mesure nouvelle | Recalculable |

**Limite assumée de la rédaction de ce document.** L'artefact n'a pas pu être
ouvert depuis l'environnement d'exécution : le proxy sortant refuse le stockage
d'artefacts GitHub (`blob.core.windows.net` → `CONNECT tunnel failed,
response 403`). Les valeurs de niveau **B** ci-dessous ont donc été relevées
depuis l'artefact par l'opérateur humain et reportées ici ; elles ne sont pas
d'un niveau inférieur à une mesure, mais elles n'ont pas été relues
indépendamment au moment d'écrire ces lignes. Les valeurs de niveau **A** l'ont
été, ligne par ligne.

Ce qui **est** vérifié en niveau A recoupe les valeurs de niveau B sur tous les
points où les deux se croisent — nombres d'observations, saturation des pages,
statut des sept acquisitions. Aucune divergence n'a été constatée.

---

## 2. Étapes du run — ce que le journal prouve (niveau A)

| # | Étape | Résultat |
|---|---|---|
| 1 | Service PostgreSQL | démarré — `PostgreSQL 16.14 (Debian 16.14-1.pgdg13+1)` |
| 2 | Migrations jusqu'à 043 | appliquées |
| 3 | Tests graveur contre PostgreSQL réel | **37 passed**, zéro skip |
| 4 | Attributions canoniques + budgets | **68 passed** |
| 5 | Gate de destination | vert — `base=carbonco_water_staging`, tables 043 présentes, **0 ligne tenant** |
| 6 | Source Registry | 4 sources déclarées (`created`) |
| 7 | Acquisitions | **7/7 `ready_for_staging`** |
| 8 | Chemins par couple (candidat, source) | 7 répertoires distincts — aucun écrasement |
| 9–11 | Ingestion, rejeu idempotent | 7 releases, dry-run → commit → rejeu |
| 12–13 | Parité préparé / persisté / candidat | **7 releases contrôlées** |
| 14 | Reconstruction fidèle | `25_parity.json` écrit |
| 15–17 | Mesures de budget | `30_budgets.json` écrit |
| 18 | Diff ADES | **ÉCHEC** — cf. §4 |
| 19 | Registre réel | *étape sautée* — le blocage ADES l'a empêchée (corrigé depuis) |
| 20 | Documents canoniques | *étape sautée* — idem |
| 21 | Scan des rapports | *étape sautée* — idem |
| 22 | Artefact téléversé | oui — 15 fichiers, 20 305 octets |

**Défaut de conception révélé par ce run** : les étapes 19 à 21 sont des
contrôles de **sécurité**, et elles ont été sautées parce qu'une étape
**métier** avait échoué. Un contrôle qui ne s'exécute qu'en cas de succès ne
contrôle que les runs dont on se méfie le moins. Les trois portent désormais
`if: always()`.

### Observations ingérées — niveau A, lues au journal

| Candidat | Source | Observations | Rejetées |
|---|---|---|---|
| `minimal_pilot` | HUBEAU_ADES | 182 | 0 |
| `balanced_pilot` | HUBEAU_ADES | 182 | 0 |
| `balanced_pilot` | HUBEAU_QUALITE_SURFACE | 78 | 0 |
| `balanced_pilot` | HUBEAU_BNPE_PRELEVEMENTS | 3 | 0 |
| `x3_technical_sample` | HUBEAU_ADES | 182 | 0 |
| `x3_technical_sample` | HUBEAU_QUALITE_SURFACE | 50 | 0 |
| `x3_technical_sample` | HUBEAU_BNPE_PRELEVEMENTS | 50 | 0 |

Le rejeu a rendu, pour chacune, `0 écrite(s), N réutilisée(s)` — l'idempotence
est **prouvée**, pas supposée.

---

## 3. Le défaut qui a fait échouer l'étape `diff-ades`

`command_diff_ades()` lisait le **payload brut Hub'Eau** — un glob `*.json`
dans le répertoire d'artefacts — et y cherchait `payload_sha256`,
`records_received` et `pages`.

Une réponse d'API Hub'Eau ne porte aucune de ces clés. Elle porte `count`,
`data`, `first`, `next`, `api_version`. Chaque lecture rendait donc `None`, et
`int(None or 0)` la transformait en `0` **sans jamais lever**.

Le rapport produit portait en conséquence :

```
run_checksum = null
run_bytes    = 0
verdict      = content_changed
```

La branche `content_changed` est celle du « checksum ET longueur diffèrent ».
Avec `null` et `0`, elle est atteinte quoi qu'il arrive. **Le blocage a donc
été prononcé sur une absence de preuve, prise pour une preuve d'absence.**

C'est la troisième occurrence d'un même motif dans ce chantier — après
l'invocation `ingest_release` composée de mémoire (#174) et l'invocation
`gate --upto` du YAML (#175) : *une valeur par défaut qui ne se distingue pas
d'une valeur relevée est pire qu'une absence.*

---

## 4. Verdict ADES corrigé

Le rapport de validation du **même run** portait les preuves réelles :

| Fait | Valeur | Niveau |
|---|---|---|
| `bytes_received` | 52 139 | B |
| `payload_sha256` | `54ac8e5b4d895f323ee352c1c7c8ddde3c9a3c5dae469b6e351ac46fc76ee00b` | B |
| `records_received` | 182 | A (recoupé au journal d'ingestion) |
| `pages_fetched` | 1 | A (« 1 page(s) écrite(s) ») |

Ce checksum est **identique** à la référence X3 inscrite dans
`ADES_REFERENCE_CHECKSUMS["X3"]`, et le nombre d'octets est **identique** à
`ADES_REFERENCE_BYTES` (52 139).

| Comparaison | Checksum | Octets | Verdict |
|---|---|---|---|
| X2A | `52bc5f94…bbd7c6` | 52 139 | référence |
| X3 | `54ac8e5b…6ee00b` | 52 139 | référence |
| X4B-PREP `x3_technical_sample` | `54ac8e5b…6ee00b` | 52 139 | **`byte_stable`** |

**Verdict : `byte_stable`.** Aucune variation à expliquer entre X3 et
X4B-PREP. ADES n'est pas bloquée par un changement de contenu.

La variation historique X2A → X3, elle, **reste non expliquée** : même
longueur, checksum différent. Elle n'est pas résolue par ce run — elle est
seulement hors de son périmètre, puisque la comparaison qui compte pour la
publication est X3 → X4B-PREP. Le risque reste ouvert au registre.

---

## 5. Ce que ce run n'établit pas

- **Le diff d'identités** (ajoutées / supprimées / modifiées) n'est pas
  produit : le verdict porte sur les octets bruts, pas sur les identités
  d'observations. Le constat « 182 observations, 0 rejetée, dans les trois
  candidats » est cohérent avec une stabilité d'identités, mais ne la
  **démontre** pas.
- **La variation X2A → X3** reste sans explication démontrée.
- **Les étapes 19 à 21** n'ont pas tourné sur ce run. Leur exécution est
  rétablie, mais elle n'a pas encore été observée.
- **Aucune donnée n'a été publiée** : le registre réel est resté à 0 source
  approuvée pendant toute la phase de mesure, et `assert_real_registry_untouched()`
  le vérifie avant ET après chaque assemblage. Le run n'a modifié aucun
  document canonique — la base était éphémère et a disparu avec le runner.
