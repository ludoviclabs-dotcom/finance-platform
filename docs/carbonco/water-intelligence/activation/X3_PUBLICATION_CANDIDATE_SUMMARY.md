# X3 — Manifeste candidat privé : synthèse

**Statut : `candidate_not_published`.**
**Environnement : `ephemeral_staging` — disparu à la fin du job GitHub Actions.**

Ce document résume le manifeste candidat produit par
`staging_rehearsal.py snapshot` (artefact `50_candidate_manifest.json`,
run [`30215981981`](https://github.com/ludoviclabs-dotcom/finance-platform/actions/runs/30215981981)).
Il **n'est pas** un snapshot public : aucune de ses données n'a été servie
par une route HTTP, aucune n'a été copiée dans le Blob store public, aucune
n'a été committée dans ce dépôt.

---

## 1. Interdictions respectées

| Interdiction | Respectée |
|---|---|
| Servi par l'endpoint public | ✅ jamais — aucune route HTTP n'a lu ce manifeste |
| Snapshot public canonique modifié | ✅ jamais touché |
| Copié dans un Blob public | ✅ jamais — resté dans l'artefact GitHub Actions du job |
| Committé avec ses observations | ✅ **seules** les statistiques ci-dessous sont versionnées ici — aucune observation, aucun payload |
| Route HTTP publique créée | ✅ aucune |

## 2. Pourquoi il ne peut pas être promu (X4)

`promotable_to_x4: false` — écrit tel quel dans le manifeste lui-même, avec sa
raison :

> staging éphémère : la base disparaît avec le runner, les releases ne sont
> donc pas promouvables. X4 exigera une ingestion sur un staging persistant.

Une release qui n'existe plus après la fin du job ne peut pas être le point
de départ d'une publication : X4 devra reprendre l'ingestion sur une base
**persistante**, avec les mêmes artefacts (ou des artefacts plus récents
acquis selon la même méthode).

## 3. Composition du candidat (3 releases, 282 observations)

| Source | Release | Statut | Observations | Période | Géographies | Unités |
|---|---|---|---|---|---|---|
| `HUBEAU_ADES` | `hubeau-piezometrie-chroniques-x3-ephemeral` | `validated` | 182 | 2024-01-01 → 2024-03-31 | 1 | `m`, `m NGF` |
| `HUBEAU_BNPE_PRELEVEMENTS` | `hubeau-bnpe-chroniques-x3-ephemeral` | `validated` | 50 | 2020-01-01 → 2020-12-31 | 50 | `m3` |
| `HUBEAU_QUALITE_SURFACE` | `hubeau-naiades-analyse-pc-x3-ephemeral` | `validated` | 50 | 2024-01-03 → 2024-01-15 | 21 | `mg(NO2)/L`, `mg(NO3)/L` |

**Total : 3 releases, 282 observations, toutes `validated`, aucune `published`.**

`HUBEAU_HYDROMETRIE` **absente** de ce manifeste — aucune release n'a été
créée pour elle (différée avant toute écriture, cf.
`X3_EPHEMERAL_STAGING_REHEARSAL.md` §5).

## 4. Checksums (traçabilité, sans payload)

| Release | SHA-256 du payload acquis |
|---|---|
| `hubeau-piezometrie-chroniques-x3-ephemeral` | `54ac8e5b4d895f323ee352c1c7c8ddde3c9a3c5dae469b6e351ac46fc76ee00b` |
| `hubeau-bnpe-chroniques-x3-ephemeral` | `a72f6e472f0db12f0717f7d2831ab5caa03bff568a05131c6220e2c505a559e4` |
| `hubeau-naiades-analyse-pc-x3-ephemeral` | `cc88d7071ad059264905570f59e9f59738604f92697f3ffbea45a2a030ce0e45` |

Ces checksums permettent de vérifier, lors d'une future ingestion sur staging
persistant, que les mêmes octets officiels ont été utilisés — sans jamais
committer les octets eux-mêmes.

## 5. Ce que ce document n'est pas

- Ce n'est pas une décision de publication. Aucune source n'est `approved` au
  registre des décisions humaines (`publication_decisions.py`) — les sept
  restent `proposed`/`refused`.
- Ce n'est pas une preuve de disponibilité pour X4. La base qui portait ces
  releases est détruite ; seuls les checksums et statistiques ci-dessus
  survivent.
- Ce n'est pas un jugement sur la qualité ou l'exhaustivité des données —
  seulement la preuve que le pipeline complet (acquisition → graveur →
  release `validated`) fonctionne de bout en bout pour ces trois sources.
