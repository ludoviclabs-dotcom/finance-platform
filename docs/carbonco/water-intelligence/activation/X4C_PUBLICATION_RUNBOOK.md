# X4C — Runbook de publication Water V1 (`bnpe_minimal_pilot_v1`)

**Un seul geste manuel est demandé.** Tout le reste — acquisition, vérification,
assemblage, écriture des documents, rapport de preuve — est exécuté par le
workflow, qui échoue plutôt que de produire un document approximatif.

Décision de référence :
[X4B_HUMAN_APPROVAL_PACKET.md](X4B_HUMAN_APPROVAL_PACKET.md) §6 et §9.

---

## 1. Le geste manuel

1. GitHub → onglet **Actions**
2. workflow **« Water V1 — génère le snapshot public BNPE »**
3. bouton **Run workflow**
4. branche : **`feat/water-v1-publication-premium-experience`**
5. champ `confirm_scope` : laisser la valeur par défaut **`BNPE/34172/2020`**
6. bouton vert **Run workflow**

Le workflow committe ensuite deux documents **sur cette branche**, dans un
commit nommé :

```
data(carbon): génère le snapshot public BNPE Water V1
```

Rien d'autre n'est poussé, aucune pull request n'est ouverte, mise à jour ni
fusionnée.

## 2. Ce qui s'exécute, dans l'ordre

| # | Étape | Ce qu'elle refuse |
|---|---|---|
| 0 | Borne de ref | toute ref autre que la branche de la PR, `master` nommément |
| 0 bis | Borne de périmètre | toute valeur de `confirm_scope` autre que `BNPE/34172/2020` |
| 1 | Signature humaine | un registre qui ne porte pas exactement `HUBEAU_BNPE_PRELEVEMENTS` sur `34172` / 2020 |
| 2 | Migrations, gate, Source Registry | une destination non prouvée, un schéma incomplet |
| 3 | Acquisition BNPE | HTTP en échec, plus d'une page, dernière page saturée, ≠ 3 reçus, ≠ 3 normalisés, un rejet, checksum ≠ approuvé, unité ≠ `m3`, ≠ 3 géographies |
| 4 | Préparation et assemblage | attribution absente, URL officielle absente, licence refusant l'ingestion ou la conservation, observation hors période, valeur encore retenue, seconde source, donnée tenant |
| 5 | Fichiers modifiés | tout fichier autre que les deux documents publics |
| 6 | Parité et budget | miroir non identique octet pour octet, document ≥ 100 000 octets |
| 7 | Hygiène | champ tenant, observation d'une autre source, URL de base, mot de passe, payload brut |
| 8 | Commit | une ref inattendue au moment du commit (revérifiée) |

**Aucune de ces conditions n'avertit : chacune lève.** Un contrôle qui se
contente d'avertir n'a jamais empêché une publication.

## 3. `contents: write`, et ce qui le borne

GitHub attribue les permissions au job, **statiquement** : il n'existe aucun
moyen de les accorder sous condition. La borne est donc une **étape**, la
première, exécutée avant le checkout et avant tout appel réseau.

Ce n'est pas un contrôle affaibli : rien ne s'exécute derrière un `exit 1`, et
l'étape ne lit aucune valeur que le déclencheur choisisse librement — elle lit
`github.ref`. L'étape de commit la **revérifie** juste avant de pousser, parce
qu'un commit est irréversible côté distant et qu'une garde exécutée vingt
minutes plus tôt n'est pas une garde au moment où l'on pousse.

## 4. Les deux documents produits

| Document | Rôle |
|---|---|
| `docs/carbonco/water-intelligence/contracts/PUBLIC_SNAPSHOT_BNPE_V1.json` | document canonique versionné |
| `apps/carbon/lib/water-intelligence/public-snapshot-bnpe-v1.json` | miroir front, **identique octet pour octet** |

Avant le premier run, ces deux fichiers existent déjà et portent
`pilot_document_status: "not_generated"`. **Ce n'est pas un snapshot
d'attente** : c'est un marqueur qui ne prétend rien, qui ne contient aucune
observation, et qui permet à `/water` de se construire et de dire honnêtement
que le document pilote n'a pas encore été généré. Un snapshot d'attente
fabriqué se lirait comme une donnée ; un marqueur se lit comme une absence.

## 5. Retour arrière

`git revert` du commit `data(carbon): génère le snapshot public BNPE Water V1`.

Les deux documents redeviennent des marqueurs, la surface publique repasse dans
son état « document pilote non généré », et rien d'autre n'est touché : le
commit ne contient que ces deux fichiers, et l'étape 5 du workflow l'a vérifié
avant de committer. Aucune migration, aucun état de base, aucun cache
persistant n'est à défaire.

## 6. Le premier run a échoué — ce qu'il a prouvé, et ce qu'il a coûté

Run [30328044831](https://github.com/ludoviclabs-dotcom/finance-platform/actions/runs/30328044831),
2026-07-28 04:12 UTC, échec à l'étape 4 en 45 s.

**Ce qui a fonctionné** — l'étape 3 est passée en entier, contre le service réel :

```
1 page(s) écrite(s), dernière page incomplète (3/200)
✓ 3 observations, checksum conforme
```

Soit : HTTP valide, page unique, pagination exhaustive prouvée par une dernière
page non saturée, 3 enregistrements reçus, 3 normalisés, 0 rejeté, unité `m3`,
trois géographies, et **le checksum approuvé au bit près**. Les conditions
d'arrêt 1 à 4 ont donc été mesurées sur la source réelle, et aucune n'a divergé.

**Ce qui a échoué** — l'acquisition écrivait son rapport dans
`acq_bnpe-minimal-pilot-v1_HUBEAU_BNPE_PRELEVEMENTS.md`, la publication le
cherchait dans `acq_bnpe_v1.md`. Deux conventions de nommage pour un même
fichier : `_acquisition_argv()` dérivait la sienne de `_scope_paths()`,
`_paths()` réécrivait la sienne à la main. Chaque commande était cohérente avec
elle-même — `acquire` relisait le chemin qu'il venait d'écrire et réussissait —
ce qui est précisément ce qui rendait l'écart invisible.

C'est la quatrième occurrence de la même famille de défaut sur ce chantier
(chemins d'acquisition partagés en PR #174, `gate --upto` en PR #175, lecteur de
preuve en PR #176) : **deux écritures d'une même vérité finissent par diverger.**

**Ce que ça a coûté** — une acquisition Hub'Eau réelle, consommée pour rien. La
comparaison des chemins s'exécute désormais **avant** `subprocess.run` : une
divergence arrête la publication sans appeler le service.

**Ce qui le verrouille** — `TestAcquireWritesWherePublishReads` compare le
chemin réellement passé à `validate_hubeau` (relu de l'argv) à celui que lit la
publication, sans réseau ni base. Les quatre contrôles échouent si l'ancienne
convention revient.

## 7. Ce que ce runbook ne couvre pas

- **Il ne fusionne rien.** La Draft PR reste en revue humaine.
- **Il ne publie sur aucun autre périmètre.** Élargir la commune ou l'année
  exige une nouvelle décision humaine, pas une nouvelle saisie : le périmètre
  est porté par la décision elle-même (`authorized_scope`), et l'assembleur
  écarte toute observation qui en sort.
- **Il ne relève pas `source_last_updated_on`.** La voie de conformité retenue
  est celle de l'URL officielle (§6.1 du paquet). Le relevé direct reste dû, et
  il reste bloquant pour ADES et Naïades.
