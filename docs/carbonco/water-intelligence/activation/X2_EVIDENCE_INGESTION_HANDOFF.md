# X2B — Handoff : graveur Evidence Kernel et releases staging

**Phase :** X2B — graveur Evidence Kernel et releases staging
**Branche :** `feat/water-evidence-kernel-staging-ingestion`
**Base :** `master` à `8993dc6` (PR #162, #163, #164 fusionnées)
**Exécuté le :** 2026-07-26

**Migrations : 0. Tables créées : 0. Colonnes ajoutées : 0. Statuts inventés : 0.
Sources publiées : 0. Décisions de licence modifiées : 0. Frontend touché : 0.**

---

## 1. Ce que X2B livre

Un graveur qui écrit une release Eau **validée** dans le noyau de preuve
existant, en staging, en une transaction, et qui refuse tout le reste.

| Livrable | Emplacement |
|---|---|
| Audit préalable du noyau | `activation/X2B_EVIDENCE_KERNEL_AUDIT.md` |
| Contrat d'entrée (pur) | `apps/api/services/water/staging_ingestion.py` |
| Graveur (transactionnel) | `apps/api/services/water/staging_writer.py` |
| Commande opérateur | `apps/api/scripts/water_intelligence/ingest_release.py` |
| Tests du contrat | `apps/api/tests/test_water_staging_ingestion_contract.py` |
| Tests du graveur | `apps/api/tests/test_water_staging_writer.py` |

## 2. La décision structurante : « staging » n'est pas un statut

`source_releases.status` est contraint à six valeurs par
`source_releases_status_check` (migration 028) :
`detected`, `quarantined`, `validated`, `published`, `superseded`,
`blocked_license`. **`staging` n'en fait pas partie et n'y sera pas ajouté.**

Une release Eau en staging est écrite dans son état **natif** :

| Colonne | Valeur |
|---|---|
| `status` | `validated` |
| `published_at` | `NULL` |
| `company_id` | `NULL` (donnée publique de référence, jamais tenant) |

Trois raisons, dans cet ordre :

1. `validated` est **exactement** la précondition qu'exige
   `release_service.publish_release()`. X4 promouvra la release **sans une
   ligne de code nouvelle**.
2. Le trigger `evidence_kernel_guard('source_release')` ne gèle que
   `published` et `superseded` : un état staging reste corrigeable, ce
   qu'exige une répétition (X3).
3. Aucune simulation. Le statut n'est écrit **ni** dans un champ libre **ni**
   dans `metadata` — un test le vérifie sur la ligne réellement écrite.

Le mot « staging » désigne dans ce chantier l'**environnement cible** de
l'écriture : c'est une garde du graveur (`--environment staging`, toute autre
valeur refusée), pas une colonne.

## 3. Sources admises et refusées

| Source | `source_code` | X2B |
|---|---|---|
| Hub'Eau hydrométrie | `HUBEAU_HYDROMETRIE` | **admise** |
| Hub'Eau piézométrie | `HUBEAU_ADES` | **admise** |
| Hub'Eau prélèvements BNPE | `HUBEAU_BNPE_PRELEVEMENTS` | **admise** |
| Hub'Eau qualité de surface | `HUBEAU_QUALITE_SURFACE` | **admise** |
| EEA WEI+ | `EEA_WEI_PLUS` | **refusée** — `manual_artifact_required` |
| WRI Aqueduct | `WRI_AQUEDUCT` | **refusée** — `blocked_registration_required` |
| Copernicus EDO | `COPERNICUS_EDO` | **refusée** — `source_verified_decoder_deferred` |

Les trois refus citent leur **statut réel**, jamais « source inconnue » — qui
laisserait croire à une faute de frappe et inviterait à réessayer. Chacun est
testé.

## 4. Les quinze refus du contrat

Tous exercés **sans PostgreSQL**, pour qu'ils ne dépendent pas d'un job
DB-gated.

| # | Refus | Où |
|---|---|---|
| 1 | source inconnue | `__post_init__` |
| 2 | release sans nom | `__post_init__` |
| 3 | release `latest`/`current`/`head`/`main`/`now`… | `__post_init__` |
| 4 | artefact absent | `__post_init__` |
| 5 | checksum différent | `read_artifact_pages` |
| 6 | rapport non lisible | `load_validation_report` |
| 7 | checksum du rapport ≠ artefact | `verify_report` |
| 8 | verdict ≠ `ready_for_staging` | `verify_report` |
| 9 | rapport `dry_run=false` | `verify_report` |
| 10 | méthode sans version (ou ≠ méthode du connecteur) | `__post_init__` |
| 11 | période absente | `verify_report` |
| 12 | géographie absente | `verify_report` |
| 13 | environnement ≠ staging | `__post_init__` |
| 14 | tentative de publication | aucun champ ne la porte — testé |
| 15 | donnée tenant dans la recette ou l'opérateur | `verify_report` / `__post_init__` |

**La licence n'est jamais une autorisation de publication.**
`license_policy.evaluate()` gouverne l'**ingestion** (`allow_ingest`) et le
**stockage** (`allow_store`) ; `allow_display` conditionne la possibilité de
stocker une **valeur**. Aucun de ces trois booléens ne fait passer une release
à `published` : les sept sources restent `proposed`/`refused` au registre des
décisions humaines, et un test le vérifie au moment même d'une ingestion
réussie sous licence permissive.

## 5. Trois refus structurels hérités de l'audit

- **Observation porteuse d'un scénario** — `observations` ne stocke ni
  `scenario_code` ni `horizon_year` : l'identité serait irrécupérable après
  écriture. Refusée plutôt qu'écrite à moitié identifiable. Les quatre
  familles Hub'Eau sont des mesures observées, sans scénario.
- **Valeur retenue** — `observations_value_presence_check` exige au moins une
  valeur ; une source dont la licence interdit l'affichage produit des
  observations structurellement non insérables. Refus explicite, jamais une
  ligne vide.
- **Statut de donnée non cartographié** — `WaterDataStatus` et le
  `data_status` du noyau sont deux vocabulaires distincts. La correspondance
  est une table explicite (`observed→verified`, `modelled→inferred`,
  `estimated→estimated`, `manual→manual`) ; **`fixture` n'a pas de cible** :
  une donnée de fixture n'entre jamais dans le noyau de preuve.

## 6. Idempotence, collision, rollback

| Propriété | Mécanisme |
|---|---|
| Release rejouée | `UNIQUE (source_id, release_key, checksum_sha256)` + `ON CONFLICT DO NOTHING` + relecture |
| Run rejoué | `UNIQUE (idempotency_key)`, clé déterministe `source|release|checksum` |
| Artefact rejoué | content-addressed sur `sha256`, SELECT-avant-INSERT (global) |
| Observation rejouée | projection sur les colonnes stockées + **comparaison du contenu** |
| Même identité, contenu différent | **erreur explicite, transaction avortée** |

`observations` n'a **aucune** contrainte d'unicité et **aucune** colonne
d'empreinte (audit §11.1) : l'idempotence y est applicative, faite dans la
transaction unique, et sérialisée entre exécutions concurrentes par la clé
d'idempotence du run. Elle n'utilise **jamais** `ObservationDraft.dedup_key()`,
dont la clé sans période écraserait silencieusement toutes les périodes sauf
la première.

**Rollback.** `evidence_kernel_guard` refuse toute UPDATE/DELETE sur
`observations` et toute DELETE sur `source_releases` : rien ne peut être
défait après commit. « Rollback complet » ne peut donc signifier qu'une chose
— **transaction avortée avant commit**. C'est précisément ce que `--dry-run`
exerce : il exécute le VRAI chemin d'écriture (release, artefact,
observations, run), contraintes et triggers compris, puis avorte. Un dry-run
qui simulerait au lieu d'écrire ne prouverait rien.

## 7. Commande opérateur

```text
python -m scripts.water_intelligence.ingest_release \
  --source-code HUBEAU_HYDROMETRIE \
  --release <release_key exacte du rapport> \
  --artifact <page unique OU répertoire de pages, HORS dépôt> \
  --report docs/carbonco/water-intelligence/activation/reports/X2A_HUBEAU_HYDROMETRIE.md \
  --dry-run
```

puis, pour graver :

```text
... --commit --environment staging
```

`ingest_release.py` est le **SEUL** script opérateur Eau autorisé à ouvrir la
base. L'exemption est **nommée et testée** dans le garde-fou X1, exactement
comme `fetcher.py` est le seul à pouvoir ouvrir le réseau. Symétriquement, ce
script n'ouvre **aucun** réseau : graver n'autorise pas à retélécharger.

L'artefact est **paginé** : son checksum obéit à la même règle que
`validate_hubeau._payload_checksum` (une page → son SHA-256 ; plusieurs pages
→ SHA-256 de la concaténation de leurs empreintes). Un test compare les deux
implémentations, pour qu'elles ne divergent pas.

## 8. Prérequis avant toute exécution réelle (X3)

Ces trois gestes sont **humains** et ne sont pas faits par X2B :

1. **Déclarer chaque source au Source Registry global** (`company_id IS NULL`)
   avec ses booléens de licence. Le graveur ne crée **aucune** source : il
   refuse une source absente. Déclarer une licence est une décision, pas un
   effet de bord d'ingestion.
2. **Déposer l'artefact hors du dépôt** — aucune donnée brute n'est commitée,
   et `--artifact-dir` de X1/X2A écrit déjà hors dépôt.
3. **Vérifier que le rapport visé porte `ready_for_staging`** pour la release
   exacte. Les rapports X2A des quatre familles conviennent tels quels.

## 9. Ce que X2B n'a pas fait

- aucune migration, aucune table, aucune colonne, aucun statut nouveau ;
- aucune publication : aucune release ne passe à `published`, aucun
  `published_at` n'est posé (testé) ;
- aucune décision de licence ni de publication modifiée — les sept sources
  restent `proposed`/`refused` ;
- aucune donnée tenant écrite : toutes les lignes sont globales (testé) ;
- aucun appel réseau, ni dans les tests, ni dans le graveur ;
- aucune ingestion réelle exécutée — X2B livre l'outil, X3 le répète en
  staging ;
- aucun snapshot public, aucune refonte visuelle.

## 10. Limites connues

- **L'identité Eau complète n'est pas persistable** (audit §11.1). La
  détection de collision porte sur la projection stockée ; deux identités qui
  ne différeraient que par un scénario se projetteraient au même endroit —
  d'où le refus des observations à scénario. Une migration ajoutant
  `observations.identity_fingerprint` + index unique lèverait la restriction ;
  elle n'est **pas** proposée ici, faute de besoin démontré pour les quatre
  sources admises.
- **Le code de méthode n'a pas de colonne** dans `observations` : il est porté
  par `source_releases.metadata` comme donnée de provenance (audit §11.2).
- **Le graveur n'a jamais ingéré d'artefact réel.** Les tests utilisent des
  pages synthétiques au format réel des connecteurs. La première ingestion
  d'un artefact Hub'Eau réel est le premier geste de X3, et c'est là que se
  vérifiera le volume (une acquisition de 200 observations n'est pas une
  acquisition nationale).
