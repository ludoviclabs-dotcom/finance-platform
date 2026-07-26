# X3 — Répétition staging éphémère : rapport de clôture

**Phase :** X3 — répétition complète du pipeline avec artefacts réels
**Environnement :** PostgreSQL **éphémère** GitHub Actions (`postgres:16`, service Docker du job)
**Workflow :** `.github/workflows/water-x3-staging-rehearsal.yml` (`workflow_dispatch` uniquement)
**Branche de code :** `fix/water-x3-migrate-relies-on-absent-ledger` ([PR #169](https://github.com/ludoviclabs-dotcom/finance-platform/pull/169), non fusionnée)
**Run final vert :** [`30215981981`](https://github.com/ludoviclabs-dotcom/finance-platform/actions/runs/30215981981) — 30/30 étapes réussies
**Exécuté le :** 2026-07-26

**Verdict : X3 exécutée avec succès sur 3 des 4 sources autorisées.**
**HUBEAU_HYDROMETRIE acquise et validée, délibérément différée du graveur — décision humaine (§5).**

**Base Neon/Vercel utilisée : 0. Variable Carbon&Co lue ou modifiée : 0.
Source publiée : 0. Snapshot public modifié : 0.**

---

## 1. Ce que ce run prouve

Le parcours complet a été exécuté et vérifié, contre un vrai PostgreSQL :

```
source officielle → acquisition bornée → artefact checksumé → validation
→ normalisation → graveur Evidence Kernel → release validated non publiée
→ snapshot candidat privé
```

pour **HUBEAU_ADES**, **HUBEAU_QUALITE_SURFACE** et **HUBEAU_BNPE_PRELEVEMENTS**.

**HUBEAU_HYDROMETRIE** a parcouru le pipeline jusqu'à l'acquisition et la
validation (`ready_for_staging` confirmé en direct), mais s'arrête là — voir
§5 pour la raison précise et la décision prise.

## 2. Chemin vers ce résultat — 5 exécutions réelles, honnêtement tracées

Aucun échec n'a été maquillé. Chaque cause a été identifiée précisément avant
d'être corrigée, et chaque correction a été revérifiée par une nouvelle
exécution réelle plutôt que supposée correcte :

| # | Run | Résultat | Étape en échec | Cause démontrée |
|---|---|---|---|---|
| 1 | [`30214920815`](https://github.com/ludoviclabs-dotcom/finance-platform/actions/runs/30214920815) | échec (41 s) | Migrations | `schema_migrations` n'existe pas : le mécanisme réutilisé (`apply_ddl_inline`/`apply_upto`) contourne délibérément `migration_runner.py` et son ledger |
| 2 | [`30215246453`](https://github.com/ludoviclabs-dotcom/finance-platform/actions/runs/30215246453) | échec (1 min 16 s) | Dry-run hydrométrie | `WaterIdentityCollisionError` réelle — deux lectures temps réel du même jour, valeurs différentes, même identité |
| 3 | [`30215738738`](https://github.com/ludoviclabs-dotcom/finance-platform/actions/runs/30215738738) | échec (1 min 41 s) | Ruff | `ruff: command not found` — jamais installé dans le workflow |
| 4 | [`30215857755`](https://github.com/ludoviclabs-dotcom/finance-platform/actions/runs/30215857755) | échec (1 min 33 s) | Scanner de secrets | faux positif : `DATABASE_URL` matchait la sous-chaîne dans le NOM `WATER_STAGING_DATABASE_URL`, exposé pour traçabilité |
| 5 | [`30215981981`](https://github.com/ludoviclabs-dotcom/finance-platform/actions/runs/30215981981) | **succès (1 min 32 s), 30/30 étapes** | — | — |

Détail complet des 3 premières causes et de leurs corrections dans
[X3_STAGING_GATE_EXECUTION_ATTEMPT.md](X3_STAGING_GATE_EXECUTION_ATTEMPT.md)
et l'historique de commits de la PR #169. Aucun de ces échecs n'a été
recommencé « en boucle » sans diagnostic : chacun a été analysé, corrigé
ponctuellement, revérifié.

## 3. Gate de base — vert avant et après toute écriture

| Contrôle | Avant écriture (`01_gate.json`) | Après rejeu (`41_gate_after_replay.json`) |
|---|---|---|
| `current_database()` | `carbonco_water_staging` | `carbonco_water_staging` |
| `current_user` | `water_x3` | `water_x3` |
| Version PostgreSQL | `16.14` | `16.14` |
| Tables de la migration 043 (sentinelles) | 4/4 présentes | 4/4 présentes |
| Lignes de tenant (`company_id IS NOT NULL`) | **0** | **0** |
| Indicateur de production | absent | absent |

Aucun repli sur `DATABASE_URL`/`DATABASE_ADMIN_URL` à aucun moment : l'URL de
staging est composée dans le job à partir du service `postgres` local, et
n'existe que dans le réseau du runner.

## 4. Source Registry — déclaration idempotente

Les quatre sources autorisées ont été déclarées, `company_id = NULL`,
**aucun** `published_at`, **aucune** décision de publication :

| Source | 1ère déclaration | Rejeu |
|---|---|---|
| `HUBEAU_ADES` | `created` (id 19) | `already_present` |
| `HUBEAU_BNPE_PRELEVEMENTS` | `created` (id 20) | `already_present` |
| `HUBEAU_HYDROMETRIE` | `created` (id 21) | `already_present` |
| `HUBEAU_QUALITE_SURFACE` | `created` (id 22) | `already_present` |

`WRI_AQUEDUCT`, `EEA_WEI_PLUS`, `COPERNICUS_EDO` : absentes du Source
Registry — un contrôle du script les refuse nommément si elles y apparaissent
sous quelque forme que ce soit ; elles n'y ont jamais été.

## 5. HUBEAU_HYDROMETRIE — acquise, validée, délibérément différée

### 5.1 Ce qui a été acquis et validé

| Rubrique | Valeur |
|---|---|
| Verdict | `ready_for_staging` |
| Records reçus / normalisés / rejetés | 200 / 200 / 0 |
| Pages / octets | 2 / 102 610 |
| Checksum payload | `7bd24e0c3502293fe6c6589c85aed7266adefb5ed5b82182b8dc7176e7329155` |
| Endpoint | `observations_tr` (temps réel), station `O400101101`, grandeur `H` |

### 5.2 La cause exacte du blocage

Le dry-run sur cette source (run 2) a levé une **vraie** collision
d'identité :

```
WaterIdentityCollisionError: collision d'identité : deux contenus différents
partagent la même identité (HUBEAU_HYDROMETRIE/…/hubeau.hydrometrie.hauteur
@ O400101101 [2026-07-25 → 2026-07-25])
```

`observations_tr` sert **plusieurs lectures par jour et par station**
(2026-07-26 : ~33 lectures/jour). Le contrat P02 modélise une période au
**grain jour** (`period_start == period_end`). Deux lectures du même jour,
valeurs différentes, se projettent donc sur la **même identité** — et le
graveur a refusé la collision, exactement comme il est conçu pour le faire :
« aucune valeur n'est retenue par défaut ».

**Ce n'est pas un bug de script.** C'est un désaccord entre deux décisions
architecturales antérieures et volontaires :

- `observations_tr` (temps réel), choisi en X2A comme MVP hydrométrie ;
- le grain jour du contrat `WaterMetricObservation`/`WaterObservationIdentity`
  (`models/water_intelligence.py`), **partagé par tout Water Intelligence**,
  pas seulement l'hydrométrie.

`HUBEAU_ADES` (182 observations, aucune collision) et `HUBEAU_QUALITE_SURFACE`
(50 observations, aucune collision) confirment dans ce même run que le grain
jour convient à des relevés **véritablement quotidiens** — le problème est
spécifique au temps réel.

### 5.3 La décision

Deux résolutions existent, et aucune n'est un simple correctif :

1. **Étendre le modèle d'identité au sous-journalier** — modifierait le
   contrat P02 partagé par tout Water Intelligence, pas seulement
   l'hydrométrie ;
2. **Choisir une lecture canonique par jour** — perte délibérée de la
   granularité intra-journalière, une décision sur ce que représente la
   donnée, pas une correction technique.

**Décision humaine (2026-07-26) : différer l'ingestion d'HUBEAU_HYDROMETRIE**
plutôt que trancher unilatéralement l'une des deux voies. Statut nommé et
tracé dans les artefacts du run (`14_deferred_sources.json`) :
`subdaily_identity_collision` — même discipline que `manual_artifact_required`
(EEA), `blocked_registration_required` (WRI) et
`source_verified_decoder_deferred` (Copernicus).

## 6. Acquisition, dry-run, ingestion, rejeu — les trois sources retenues

### 6.1 HUBEAU_ADES (piézométrie)

| Étape | Résultat |
|---|---|
| Acquisition | 1 page, 52 139 octets, checksum `54ac8e5b4d895f32…` |
| Records reçus / normalisés / rejetés | 182 / 182 / 0 |
| Périodes | 2024-01-01 → 2024-03-31 |
| Géographies | 1 (station `09892X0679/EXH70`) |
| Métriques | `hubeau.piezometrie.niveau_nappe`, `hubeau.piezometrie.profondeur_nappe` |
| Unités | `m NGF`, `m` — natives, aucune conversion |
| Dry-run | 182 observation(s) écrite(s) (simulées), transaction avortée |
| Ingestion réelle | `release_id=24`, `status=validated`, `published_at=NULL`, `company_id=NULL`, 182 écrites, 0 rejetée |
| Rejeu | **0 écriture, 182 déjà présentes**, `release_reused=true`, même `release_id` |
| Warnings | aucun |

### 6.2 HUBEAU_QUALITE_SURFACE (Naïades)

| Étape | Résultat |
|---|---|
| Acquisition | 1 page, 293 799 octets, checksum `cc88d7071ad05926…` |
| Records reçus / normalisés / rejetés | 50 / 50 / 0 |
| Périodes | 2024-01-03 → 2024-01-15 |
| Géographies | 21 stations |
| Métriques | `hubeau.qualite_rivieres.parametre.1339` (Nitrites), `.1340` (Nitrates) |
| Unités | `mg(NO2)/L`, `mg(NO3)/L` |
| Dry-run | 50 observation(s) écrite(s) (simulées), transaction avortée |
| Ingestion réelle | `release_id=25`, `status=validated`, `published_at=NULL`, `company_id=NULL`, 50 écrites, 0 rejetée |
| Rejeu | **0 écriture, 50 déjà présentes**, `release_reused=true`, même `release_id` |
| Warnings | « Aucun code de remarque n'a été déclaré comme censurant : les remarques sont transportées verbatim et aucune censure n'est déduite. » — avertissement **connu et documenté** (Risk Register, Wave B), pas une anomalie |

### 6.3 HUBEAU_BNPE_PRELEVEMENTS

| Étape | Résultat |
|---|---|
| Acquisition | 1 page, 47 890 octets, checksum `a72f6e472f0db12f…` |
| Records reçus / normalisés / rejetés | 50 / 50 / 0 |
| Périodes | 2020-01-01 → 2020-12-31 (année exacte, `annee=2020`) |
| Géographies | 50 ouvrages (`code_departement=34`) |
| Métriques | `hubeau.prelevements.volume` |
| Unités | `m3` |
| Dry-run | 50 observation(s) écrite(s) (simulées), transaction avortée |
| Ingestion réelle | `release_id=26`, `status=validated`, `published_at=NULL`, `company_id=NULL`, 50 écrites, 0 rejetée |
| Rejeu | **0 écriture, 50 déjà présentes**, `release_reused=true`, même `release_id` |
| Warnings | « Couverture partielle par construction : les volumes exonérés de redevance et < 10 000 m³ ne sont pas déclarés. Une absence n'est JAMAIS un prélèvement nul. » — avertissement **connu et documenté** (Risk Register, Wave B) |

### 6.4 Preuve du rollback (dry-run)

Après les trois dry-runs, comptage direct des quatre tables du noyau :

```json
{"source_releases": 0, "evidence_artifacts": 0, "observations": 0, "ingestion_runs": 0}
```

**Zéro ligne conservée.** Le dry-run a exécuté le **vrai** chemin d'écriture
(INSERT réels, contraintes, triggers) avant d'avorter la transaction — il n'a
rien simulé.

## 7. Parité — vérifiée pour les trois sources

`validés = gravés + déjà présents`, contrôlé directement en base après
ingestion :

| Source | Écrites | Déjà présentes | Total attendu | En base | Concorde |
|---|---|---|---|---|---|
| HUBEAU_ADES | 182 | 0 | 182 | 182 | ✅ |
| HUBEAU_QUALITE_SURFACE | 50 | 0 | 50 | 50 | ✅ |
| HUBEAU_BNPE_PRELEVEMENTS | 50 | 0 | 50 | 50 | ✅ |

Aucun écart. Aucune ligne de tenant dans aucune des cinq tables du noyau,
avant ni après.

## 8. Tests, lint, secrets

| Vérification | Résultat |
|---|---|
| `test_water_staging_writer.py` (DB-gated, PostgreSQL réel) | **passés, 0 skip** |
| Tests opérateur, connecteurs, contrat, graveur | **passés** |
| Suite API complète (DB-gated skippés, comme le job `tests`) | **passés** |
| `ruff check . --select=E,F,I --ignore=E501` | **clean** |
| Scanner de secrets sur tous les rapports | **aucune fuite** — vérifié après correction du faux positif |

## 9. Ce que X3 n'a pas fait

- **aucune base Neon ou Vercel utilisée** — PostgreSQL éphémère, service
  Docker du job, détruit à la fin de l'exécution ;
- **aucune variable Carbon&Co lue ni modifiée** — `DATABASE_URL`,
  `DATABASE_URL_DIRECT`, `DATABASE_URL_UNPOOLED`, `DATABASE_ADMIN_URL` hors de
  portée par construction ;
- **aucune donnée publiée** — les trois releases restent `validated`,
  `published_at IS NULL` ;
- **aucun snapshot public modifié** — le manifeste candidat est privé,
  jamais servi par une route HTTP publique (§ voir
  `X3_PUBLICATION_CANDIDATE_SUMMARY.md`) ;
- **HUBEAU_HYDROMETRIE non ingérée** — différée, statut nommé ;
- **X4 non commencé** — les releases de ce run disparaissent avec le job
  (staging éphémère) et ne sont donc **pas promouvables** ; X4 exigera une
  ingestion sur un staging **persistant**, plus une décision humaine de
  publication (aucune des sept sources n'est `approved` au registre) ;
- **Phase B (refonte visuelle) non commencée** ;
- **EEA, WRI, Copernicus non touchés** — restent
  `manual_artifact_required` / `blocked_registration_required` /
  `source_verified_decoder_deferred`.
