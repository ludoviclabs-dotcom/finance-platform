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

## 6. Ce que ce runbook ne couvre pas

- **Il ne fusionne rien.** La Draft PR reste en revue humaine.
- **Il ne publie sur aucun autre périmètre.** Élargir la commune ou l'année
  exige une nouvelle décision humaine, pas une nouvelle saisie : le périmètre
  est porté par la décision elle-même (`authorized_scope`), et l'assembleur
  écarte toute observation qui en sort.
- **Il ne relève pas `source_last_updated_on`.** La voie de conformité retenue
  est celle de l'URL officielle (§6.1 du paquet). Le relevé direct reste dû, et
  il reste bloquant pour ADES et Naïades.
