# X4A — Paquet de décision de publication Water

**Statut : `unsigned` — aucune décision n'est rendue dans ce document.**
**Aucune donnée n'est publiée. Aucun code fonctionnel n'est modifié par X4A.**

Ce paquet prépare la **première** décision de publication Water. Il ne la prend
pas : les formulaires du §5 sont vides, et un formulaire vide vaut « non
décidé », jamais « accepté par défaut ». Le registre
`services/water_intelligence/publication_decisions.py` reste inchangé — les
sept sources y demeurent `proposed`/`refused`, et le snapshot public reste
vide.

Le plan technique correspondant est
[X4_PUBLICATION_IMPLEMENTATION_PLAN.md](X4_PUBLICATION_IMPLEMENTATION_PLAN.md).
Il ne doit **pas** être exécuté avant que les formulaires ci-dessous soient
signés.

Les attributions par jeu de données et les trois champs de fraîcheur sont
établis dans
[X4A_ATTRIBUTION_AND_FRESHNESS.md](X4A_ATTRIBUTION_AND_FRESHNESS.md), qui solde
documentairement les §3.2 et §3.4 ci-dessous — et remonte un écart non résolu
sur la cadence BNPE.

---

## 1. Périmètre

### 1.1 Sources candidates — trois

| Source | Motif de candidature |
|---|---|
| `HUBEAU_ADES` | Pipeline complet exécuté en X3 (acquisition → graveur → release `validated`), rejeu idempotent prouvé |
| `HUBEAU_QUALITE_SURFACE` | idem |
| `HUBEAU_BNPE_PRELEVEMENTS` | idem |

### 1.2 Sources exclues — quatre, avec leur statut nommé

| Source | Statut | Ce que ce statut signifie |
|---|---|---|
| `HUBEAU_HYDROMETRIE` | `subdaily_identity_collision` | Acquise et validée (`ready_for_staging`), mais `observations_tr` sert plusieurs lectures par jour et par station alors que le contrat modélise une période au grain **jour** : deux lectures d'un même jour se projettent sur la même identité, et le graveur refuse la collision — comme il est conçu pour le faire. Résoudre exige soit d'étendre le modèle d'identité partagé, soit de choisir une lecture canonique par jour. Aucune des deux voies n'est tranchée. |
| `EEA_WEI_PLUS` | `manual_artifact_required` | Publication en classeur Excel + SHP derrière Nextcloud ; la conversion reste un geste opérateur manuel non automatisé. |
| `WRI_AQUEDUCT` | `blocked_registration_required` | Licence CC BY 4.0 vérifiée, mais WRI exige en outre un enregistrement pour partager/adapter — non effectué. |
| `COPERNICUS_EDO` | `source_verified_decoder_deferred` | Identité de source vérifiée, décodage raster volontairement reporté (aucune dépendance GDAL/rasterio/netCDF4 sans ADR). Aucune valeur décodée : rien à publier. |

**Ces quatre sources ne font l'objet d'aucun formulaire.** Aucune signature ne
doit les concerner, même par regroupement.

## 2. Ce qu'une signature déclenche, et ce qu'elle ne déclenche pas

**Une signature autorise** l'exécution de X4B : une nouvelle acquisition selon
la recette du §4 du plan, un assemblage de snapshot, et une pull request
portant ce snapshot en document versionné.

**Une signature ne publie rien par elle-même.** Rien n'atteint la surface
publique sans :

1. une décision `approved` **signée** (`reviewed_by` **et** `reviewed_on`) au
   registre — une signature manquante n'est pas une signature, et la
   construction du registre le refuse ;
2. un snapshot assemblé et committé, revu en pull request ;
3. un déploiement.

**Une signature n'est pas rétroactive.** Les releases de X3 vivaient dans un
PostgreSQL éphémère détruit à la fin du job : elles ne sont pas promouvables.
X4B **réacquiert** les données. Les chiffres du §4 sont donc des **attendus de
référence**, pas un stock disponible.

## 3. Points à trancher avant toute signature

Six points ne relèvent pas de la technique. **Aucun n'est tranché ici** — aucune
signature n'est apposée. Deux d'entre eux (§3.2 attribution, §3.4 fraîcheur)
sont désormais **instruits documentairement** par
[X4A_ATTRIBUTION_AND_FRESHNESS.md](X4A_ATTRIBUTION_AND_FRESHNESS.md) : le
libellé et les cadences sont établis et proposés, la décision de les publier
reste entière. Les quatre autres restent ouverts sans instruction nouvelle.

### 3.1 Un échantillon technique n'est pas un territoire

Les trois périmètres de X3 ont été choisis pour **valider les connecteurs** :
une station piézométrique unique, un département (34) pour les deux autres. Ils
ne documentent aucun territoire au sens éditorial. Publier ces bornes telles
quelles rendrait un échantillon de recette lisible comme une couverture.
Chaque formulaire demande donc explicitement le **périmètre autorisé**, qui peut
différer de celui de X3 — auquel cas les checksums attendus changeront et les
volumes aussi.

### 3.2 Deux libellés d'attribution coexistent dans le dépôt

| Origine | Libellé |
|---|---|
| `hubeau_transport.attribution()` — porté par **chaque observation** | `Source : Hub'Eau (Office français de la biodiversité (OFB), Service Central Vigicrues (SCV), Bureau de recherches géologiques et minières (BRGM)) — Système d'Information sur l'Eau, Licence Ouverte / Open Licence (Etalab), données brutes, consultées le <date>` |
| `staging_rehearsal.ATTRIBUTION` — porté par le **Source Registry** | `Source : Hub'Eau / eaufrance.fr — Licence Ouverte / Open Licence (Etalab 2.0)` |

Le premier cite les trois éditeurs de la plateforme indistinctement, pour les
trois jeux. Le second cite la plateforme sans producteur. La Licence Ouverte
impose de citer l'auteur du jeu : **le libellé publié doit être choisi**, pas
hérité par défaut. Chaque formulaire porte un champ « attribution à afficher ».

**Résolu documentairement (X4A, complément).** Ni l'un ni l'autre libellé n'est
publiable : trois libellés propres aux jeux de données sont établis en §1 de
[X4A_ATTRIBUTION_AND_FRESHNESS.md](X4A_ATTRIBUTION_AND_FRESHNESS.md), qui
distinguent le point d'accès (Hub'Eau et son API), le système d'information
source (ADES, Naïades, BNPE) et les producteurs ou contributeurs réellement
concernés. Aucun connecteur n'est modifié : les deux libellés ci-dessus restent
en place dans le code, leur remplacement relève de X4B — et doit y **précéder la
réacquisition**, l'attribution étant estampillée à l'acquisition
(`validate_hubeau.py:743` et `:937`), pas à l'assemblage. Les formulaires du §5
portent désormais le libellé canonique **en proposition**, à confirmer par
signature.

**Ce que le libellé ne suffit pas encore à satisfaire.** La Licence Ouverte 2.0
conditionne la réutilisation à la mention de la source **et de la date de la
dernière mise à jour de l'Information réutilisée**. Les trois libellés portent
une date de *consultation*, qui n'est pas ce fait. `source_last_updated_on`
reste **non relevé** pour les trois sources : tant qu'il l'est, aucun des trois
libellés n'est publiable en l'état.

### 3.3 La licence est vérifiée au niveau plateforme, pas jeu par jeu

`license_scope = "platform"` pour les trois sources (`source_status.py`). La
Licence Ouverte / Etalab 2.0 a été relevée sur les fiches Hub'Eau ; elle n'a pas
été confirmée **jeu par jeu**. Signer revient à assumer que la licence
plateforme couvre le jeu, ou à faire vérifier au préalable.

### 3.4 La fraîcheur — deux cadences relevées sur trois

Aucun rapport X1/X2A/X3 n'établissait la cadence de mise à jour des trois jeux
côté source. Le complément X4A la relève sur les pages officielles et sépare
trois champs qui ne se déduisent pas les uns des autres —
`source_refresh_cadence`, `observed_period`, `retrieved_on` (§2 de
[X4A_ATTRIBUTION_AND_FRESHNESS.md](X4A_ATTRIBUTION_AND_FRESHNESS.md)) :

| Source | Cadence côté source |
|---|---|
| `HUBEAU_ADES` | intégration **quotidienne** des mises à jour ADES — relevé |
| `HUBEAU_QUALITE_SURFACE` | **synchronisation continue** avec Naïades (API v2) — relevé |
| `HUBEAU_BNPE_PRELEVEMENTS` | **non vérifiée** — reste à trancher |

**Ce qui reste ouvert, et qui est une question au signataire :** aucune page
officielle relevée n'énonce de cadence mensuelle pour la BNPE, et le jeu publié
par le Système d'Information sur l'Eau sur data.gouv.fr déclare une mise à jour
**annuelle** — cohérente avec le grain annuel de la donnée et avec le paramètre
`annee` à valeur unique de l'API. Les trois issues possibles sont posées en §3
du complément. Aucune n'est retenue ici.

**Ce qu'aucune cadence n'autorise à écrire :** une source synchronisée tous les
jours ne rend pas « actuelle » une observation de 2024. Les deux énoncés sont
vrais ensemble et doivent être rendus séparément.

### 3.5 Le budget de snapshot sera probablement dépassé

Le contrat P02 §7 borne le snapshot public à **100 000 octets non compressés**,
et l'assembleur **refuse** un dépassement (`SnapshotBudgetExceeded`) : il ne
tronque jamais. Or chaque observation embarque toute son enveloppe de preuve
(source, release, checksum de 64 caractères, licence, attribution, méthode,
qualité, géographie), soit de l'ordre du kilo-octet. 282 observations ⇒ ordre de
grandeur de 250 à 350 ko, soit **2,5 à 3,5 fois le budget**.

Ce n'est pas une estimation à valider par le raisonnement : le §5.4 du plan
impose de la **mesurer** avant tout commit. Si elle se confirme, trois issues
existent, et le choix est humain : réduire le périmètre publié, publier une
source à la fois, ou modifier le budget documenté du contrat — ce dernier étant
une décision d'architecture distincte, hors X4.

### 3.6 Aucune couche géographique n'existe

Le snapshot porte des observations, mais `geo_layers` est vide et rien dans le
dépôt n'en produit. Conséquence mécanique : `WiMapFrame` conserve son état
« aucune couche publiée » et **ne monte pas de carte**, même avec 282
observations publiées. La table équivalente, elle, peut être alimentée. Publier
des observations sans couche est cohérent (une absence de carte n'est pas une
couverture nulle), mais il faut le savoir avant de signer, pas après.

## 4. Dossier des trois sources

Repris de X3 (run [`30215981981`](https://github.com/ludoviclabs-dotcom/finance-platform/actions/runs/30215981981),
2026-07-26) et des rapports X1/X2A. **Aucun payload brut n'est reproduit ici** —
seuls les checksums et les statistiques.

### 4.1 `HUBEAU_ADES` — piézométrie, chroniques ADES

| Rubrique | Valeur |
|---|---|
| `release_key` | `hubeau-piezometrie-chroniques-x3-ephemeral` |
| Checksum SHA-256 du payload | `54ac8e5b4d895f323ee352c1c7c8ddde3c9a3c5dae469b6e351ac46fc76ee00b` |
| Période observée (`observed_period`) | 2024-01-01 → 2024-03-31 |
| Territoire | 1 station, code BSS `09892X0679/EXH70` |
| Métriques | `hubeau.piezometrie.niveau_nappe`, `hubeau.piezometrie.profondeur_nappe` |
| Unités | `m NGF`, `m` — natives, aucune conversion |
| Records reçus / normalisés / rejetés | 182 / 182 / 0 |
| Observations produites | 182 |
| Rejets | 0 — aucune cause de rejet |
| Attribution | `Source : Hub'Eau — API Piézométrie. Données issues d'ADES et des partenaires du Système d'information sur l'eau. Licence Ouverte / Etalab 2.0. Consultées le 2026-07-26.` (X4A §1.2, **proposé**) |
| Licence | Licence Ouverte / Etalab 2.0, vérifiée **au niveau plateforme** (Wave B) |
| Limites | Échantillon technique : une seule station, un seul trimestre. Ne documente aucun territoire. |
| `source_refresh_cadence` | Intégration **quotidienne** des mises à jour de la base ADES dans l'API — relevé (X4A §1.5) |
| `retrieved_on` | 2026-07-26 |
| Fraîcheur — lecture | Source mise à jour quotidiennement **et** période observée historique (2024) : les deux énoncés se rendent séparément, jamais fusionnés en « données à jour ». |
| Avertissements | aucun |
| Idempotence | Rejeu : **0 écriture**, 182 déjà présentes, `release_reused=true`, même `release_id` |
| Volume acquis | 1 page, 52 139 octets |

### 4.2 `HUBEAU_QUALITE_SURFACE` — qualité des cours d'eau (Naïades)

| Rubrique | Valeur |
|---|---|
| `release_key` | `hubeau-naiades-analyse-pc-x3-ephemeral` |
| Checksum SHA-256 du payload | `cc88d7071ad059264905570f59e9f59738604f92697f3ffbea45a2a030ce0e45` |
| Période observée (`observed_period`) | 2024-01-03 → 2024-01-15 (fenêtre demandée 2024-01-01 → 2024-03-31, bornée à 1 page de 50) |
| Territoire | 21 stations, département `34` |
| Métriques | `hubeau.qualite_rivieres.parametre.1339` (nitrites), `.1340` (nitrates) |
| Unités | `mg(NO2)/L`, `mg(NO3)/L` |
| Records reçus / normalisés / rejetés | 50 / 50 / 0 |
| Observations produites | 50 |
| Rejets | 0 |
| Attribution | `Source : Hub'Eau — API Qualité des cours d'eau. Données issues de Naïades et transmises par les Agences de l'eau. Licence Ouverte / Etalab 2.0. Consultées le 2026-07-26.` (X4A §1.2, **proposé**) |
| Licence | Licence Ouverte / Etalab 2.0, vérifiée **au niveau plateforme** (Wave B) |
| Limites | Échantillon technique. Une publication exige en outre une **allowlist de paramètres SANDRE revue**, et **aucune conclusion de conformité** — la conformité relève exclusivement du registre juridique. La période réelle est plus courte que la fenêtre demandée : la borne de pagination l'a tronquée. |
| `source_refresh_cadence` | **Synchronisation continue** avec la base Naïades depuis la v2 de l'API — relevé (X4A §1.5) |
| `retrieved_on` | 2026-07-26 |
| Fraîcheur — lecture | Source synchronisée en continu **et** période observée historique (janvier 2024) : les deux énoncés se rendent séparément. `observed_period` est la période **réellement** observée, jamais la fenêtre demandée. |
| Avertissements | « Aucun code de remarque n'a été déclaré comme censurant : les remarques sont transportées verbatim et aucune censure n'est déduite. » — connu et documenté (Risk Register, Wave B) |
| Idempotence | Rejeu : **0 écriture**, 50 déjà présentes, `release_reused=true`, même `release_id` |
| Volume acquis | 1 page, 293 799 octets |

### 4.3 `HUBEAU_BNPE_PRELEVEMENTS` — prélèvements en eau (BNPE)

| Rubrique | Valeur |
|---|---|
| `release_key` | `hubeau-bnpe-chroniques-x3-ephemeral` |
| Checksum SHA-256 du payload | `a72f6e472f0db12f0717f7d2831ab5caa03bff568a05131c6220e2c505a559e4` |
| Période observée (`observed_period`) | 2020-01-01 → 2020-12-31 (année exacte, `annee=2020`) |
| Territoire | 50 ouvrages, département `34` |
| Métriques | `hubeau.prelevements.volume` |
| Unités | `m3` |
| Records reçus / normalisés / rejetés | 50 / 50 / 0 |
| Observations produites | 50 |
| Rejets | 0 |
| Attribution | `Source : Hub'Eau — API Prélèvements en eau. Données issues de la BNPE et de la gestion des redevances par les agences et offices de l'eau. Licence Ouverte / Etalab 2.0. Consultées le 2026-07-26.` (X4A §1.2, **proposé**) |
| Licence | Licence Ouverte / Etalab 2.0, vérifiée **au niveau plateforme** (Wave B) |
| Limites | **Couverture partielle par construction** : les usages exonérés de redevance sont inconnus et les volumes < 10 000 m³ ne sont pas déclarés. Une absence n'est **jamais** un prélèvement nul, et la publication doit rendre l'absence comme absence. Échantillon technique par ailleurs. Contrainte d'API : une requête par année (`annee=<AAAA>`), jamais `annee_min`/`annee_max` — ignorés en silence par la plateforme. |
| `source_refresh_cadence` | **NON VÉRIFIÉE.** Aucune page officielle relevée n'énonce de cadence mensuelle ; data.gouv.fr (Système d'Information sur l'Eau) déclare une mise à jour **annuelle**. Trois issues posées en X4A §3, aucune retenue. |
| `retrieved_on` | 2026-07-26 |
| Fraîcheur — lecture | Une cadence non vérifiée se rend comme **absence de relevé**, jamais comme absence de mise à jour. |
| Avertissements | « Couverture partielle par construction : les volumes exonérés de redevance et < 10 000 m³ ne sont pas déclarés. Une absence n'est JAMAIS un prélèvement nul. » |
| Idempotence | Rejeu : **0 écriture**, 50 déjà présentes, `release_reused=true`, même `release_id` |
| Volume acquis | 1 page, 47 890 octets |

### 4.4 Totaux

| | Valeur |
|---|---|
| Releases | 3, toutes `validated`, aucune `published` |
| Observations | 282 |
| Lignes de tenant | 0, avant et après ingestion, dans les cinq tables du noyau |

## 5. Matrice de décision — formulaires **non signés**

Un formulaire par source. Ne pas grouper : « on publie les sources Hub'Eau » ne
dit ni laquelle, ni sur quel périmètre, ni sous quelle attribution.

Les colonnes « proposé » portent une **proposition argumentée**, pas une
décision. Elles restent à confirmer, amender ou refuser.

### 5.1 Formulaire — `HUBEAU_ADES`

| Champ | Valeur pré-renseignée (à confirmer) | Décision |
|---|---|---|
| `source_code` | `HUBEAU_ADES` | — |
| `release` | à réacquérir en X4B ; référence X3 : `hubeau-piezometrie-chroniques-x3-ephemeral` | |
| `checksum` | référence X3 : `54ac8e5b4d895f323ee352c1c7c8ddde3c9a3c5dae469b6e351ac46fc76ee00b` — à revérifier après réacquisition | |
| Scope géographique | station BSS `09892X0679/EXH70` (échantillon technique) | |
| Période | 2024-01-01 → 2024-03-31 | |
| Métriques | `hubeau.piezometrie.niveau_nappe`, `hubeau.piezometrie.profondeur_nappe` | |
| Licence | Licence Ouverte / Etalab 2.0 (vérifiée plateforme) | |
| Attribution **proposée** | `Source : Hub'Eau — API Piézométrie. Données issues d'ADES et des partenaires du Système d'information sur l'eau. Licence Ouverte / Etalab 2.0. Consultées le <date>.` (X4A §1.2) | |
| `source_refresh_cadence` **proposé** | intégration quotidienne des mises à jour ADES — relevé | |
| `source_last_updated_on` | **NON RELEVÉ** — exigé par la condition de paternité de la Licence Ouverte 2.0 ; le libellé n'est pas publiable sans lui | |
| `display_allowed` **proposé** | `true` — la Licence Ouverte accorde explicitement reproduction et rediffusion sous réserve d'attribution | |
| `derived_use_allowed` **proposé** | `true` — même fondement (adaptation autorisée) | |
| Limites à afficher | échantillon technique d'une seule station ; licence vérifiée au niveau plateforme, pas jeu par jeu ; cadence quotidienne relevée par lecture indexée, relevé direct non horodaté (X4A §5) | |
| `reviewer` | | |
| `reviewed_on` | | |
| **Décision** (`approved` / `rejected` / `deferred`) | | |
| Motif (obligatoire, quel que soit le verdict) | | |

### 5.2 Formulaire — `HUBEAU_QUALITE_SURFACE`

| Champ | Valeur pré-renseignée (à confirmer) | Décision |
|---|---|---|
| `source_code` | `HUBEAU_QUALITE_SURFACE` | — |
| `release` | à réacquérir en X4B ; référence X3 : `hubeau-naiades-analyse-pc-x3-ephemeral` | |
| `checksum` | référence X3 : `cc88d7071ad059264905570f59e9f59738604f92697f3ffbea45a2a030ce0e45` — à revérifier | |
| Scope géographique | 21 stations, département `34` | |
| Période | 2024-01-03 → 2024-01-15 (réellement observée) | |
| Métriques | paramètres SANDRE `1339` (nitrites), `1340` (nitrates) | |
| Licence | Licence Ouverte / Etalab 2.0 (vérifiée plateforme) | |
| Attribution **proposée** | `Source : Hub'Eau — API Qualité des cours d'eau. Données issues de Naïades et transmises par les Agences de l'eau. Licence Ouverte / Etalab 2.0. Consultées le <date>.` (X4A §1.2) | |
| `source_refresh_cadence` **proposé** | synchronisation continue avec Naïades (API v2) — relevé | |
| `source_last_updated_on` | **NON RELEVÉ** — exigé par la condition de paternité de la Licence Ouverte 2.0 ; le libellé n'est pas publiable sans lui | |
| `display_allowed` **proposé** | `true` — Licence Ouverte | |
| `derived_use_allowed` **proposé** | `true` — Licence Ouverte | |
| Limites à afficher | **allowlist SANDRE à valider explicitement** ; **aucune conclusion de conformité** ; remarques transportées verbatim, aucune censure déduite ; période tronquée par la pagination ; cadence continue relevée par lecture indexée (X4A §5) | |
| `reviewer` | | |
| `reviewed_on` | | |
| **Décision** (`approved` / `rejected` / `deferred`) | | |
| Motif (obligatoire) | | |

### 5.3 Formulaire — `HUBEAU_BNPE_PRELEVEMENTS`

| Champ | Valeur pré-renseignée (à confirmer) | Décision |
|---|---|---|
| `source_code` | `HUBEAU_BNPE_PRELEVEMENTS` | — |
| `release` | à réacquérir en X4B ; référence X3 : `hubeau-bnpe-chroniques-x3-ephemeral` | |
| `checksum` | référence X3 : `a72f6e472f0db12f0717f7d2831ab5caa03bff568a05131c6220e2c505a559e4` — à revérifier | |
| Scope géographique | 50 ouvrages, département `34` | |
| Période | 2020-01-01 → 2020-12-31 (`annee=2020`) | |
| Métriques | `hubeau.prelevements.volume` | |
| Licence | Licence Ouverte / Etalab 2.0 (vérifiée plateforme) | |
| Attribution **proposée** | `Source : Hub'Eau — API Prélèvements en eau. Données issues de la BNPE et de la gestion des redevances par les agences et offices de l'eau. Licence Ouverte / Etalab 2.0. Consultées le <date>.` (X4A §1.2) | |
| `source_refresh_cadence` | **NON VÉRIFIÉE — à trancher.** Mensuelle non confirmée ; annuelle déclarée sur data.gouv.fr. Trois issues en X4A §3. | |
| `source_last_updated_on` | **NON RELEVÉ** — exigé par la condition de paternité de la Licence Ouverte 2.0 ; le libellé n'est pas publiable sans lui | |
| `display_allowed` **proposé** | `true` — Licence Ouverte | |
| `derived_use_allowed` **proposé** | `true` — Licence Ouverte. **Réserve** : un usage dérivé qui agrégerait ces volumes hériterait de la couverture partielle et produirait des totaux faux par défaut. | |
| Limites à afficher | **couverture partielle par construction** — exonérés de redevance inconnus, volumes < 10 000 m³ non déclarés, une absence n'est jamais un zéro ; échantillon technique ; **cadence de mise à jour non vérifiée** | |
| `reviewer` | | |
| `reviewed_on` | | |
| **Décision** (`approved` / `rejected` / `deferred`) | | |
| Motif (obligatoire) | | |

## 6. Après signature

1. Reporter chaque décision, **y compris un refus ou un ajournement**, dans
   [`DECISION_LOG.md`](../DECISION_LOG.md).
2. Reporter la décision `approved` dans `CURRENT_DECISIONS`
   (`services/water_intelligence/publication_decisions.py`) avec
   `reviewed_by` et `reviewed_on` renseignés — la construction refuse un
   `approved` sans les deux.
3. Exécuter X4B selon
   [X4_PUBLICATION_IMPLEMENTATION_PLAN.md](X4_PUBLICATION_IMPLEMENTATION_PLAN.md),
   et **uniquement** pour les sources signées `approved`.

## 7. Ce que ce document n'est pas

- Ce n'est pas une décision. Aucun champ `reviewer`, `reviewed_on` ou
  « Décision » n'est rempli, et aucun ne doit l'être par un modèle.
- Ce n'est pas une garantie de disponibilité : les releases X3 n'existent plus.
- Ce n'est pas un jugement sur la qualité des données — seulement l'état
  vérifié de ce qui a été acquis, et de ce qui reste à trancher.
