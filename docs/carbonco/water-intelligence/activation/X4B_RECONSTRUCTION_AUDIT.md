# X4B-RECONSTRUCT — Audit avant implémentation

**Statut : audit. Aucun code écrit, aucune donnée publiée, aucune source
`approved`, aucun snapshot public modifié.**

Cet audit précède l'implémentation, comme l'exige le §1 de la consigne. Il
répond aux huit questions posées, et il rend un verdict qui **change le plan** :
la fonction pure demandée par le §3 **existe déjà**, et la construire une
seconde fois violerait la règle « ne maintenir aucun second normaliseur
parallèle » que la consigne pose elle-même.

---

## 0. Le constat qui commande tout le reste

`services/water/staging_writer.py:243` expose déjà :

```python
def prepare_release(
    request, *, pages, report, license_decision, retrieved_at, attribution
) -> PreparedRelease
```

Elle fait **exactement** ce que le §3 décrit :

| Exigence du §3 | État |
|---|---|
| Reçoit source, release, artefact, rapport, configuration de méthode | ✅ via `WaterStagingIngestionRequest` + `INGESTIBLE_SOURCES` |
| Vérifie existence, checksum, source, release, verdict, méthode | ✅ `_check_*` de `WaterStagingIngestionRequest` + `verify_report()` |
| Appelle les parseurs et normaliseurs **existants** | ✅ `_parse_and_normalize` → `pipe.derive_observations` → `pipe.validate_candidates` |
| Produit les observations P02 **complètes** | ✅ `WaterMetricObservation` validées |
| Construit `WaterObservationIdentity` | ✅ `build_water_observation_identity` |
| Détecte les collisions | ✅ `WaterObservationLedger`, jamais un « premier gagne » |
| Conserve null et absence | ✅ `records_absent_value` compté séparément |
| Aucune écriture, aucun réseau, aucune base | ✅ « Purement en mémoire : aucune connexion n'est ouverte ici » |

**Verdict : ne pas créer `prepare_validated_water_release`.** Le travail réel
n'est pas d'écrire un normaliseur, c'est de **libérer** celui-ci de sa
dépendance d'appel, et de compléter ce qu'il ne porte pas encore.

## 1. Quelle fonction transforme les octets bruts en observations complètes ?

`prepare_release()`, et elle seule. La chaîne exacte :

```
artefact (pages) + rapport de validation
        ↓  _parse_and_normalize()      — parseurs/normaliseurs du connecteur
   drafts + résolveurs (géographie, période)
        ↓  pipe.derive_observations()  — draft par draft, jamais en lot
   candidats
        ↓  pipe.validate_candidates()  — gate licence
   WaterMetricObservation
        ↓  build_water_observation_identity() + content_digest()
   PreparedObservation (observation + identité + empreinte)
```

Le commentaire du code explique pourquoi le traitement est **draft par draft** :
`derive_observations` en lot perdrait la correspondance entre observation,
identité et empreinte dès le premier draft rejeté. C'est une propriété à
préserver, pas un détail d'implémentation.

## 2. À quel moment les informations P02 sont-elles perdues ?

**Pas à la préparation — à la projection.** `PreparedObservation` porte
l'observation P02 entière. La perte a lieu à `_write_observations()`, vers une
table `observations` (migration 028) qui n'a ni `period_start`/`period_end`
(seulement `observed_at`, `valid_from`, `valid_to`), ni portée ni libellé de
géographie (seulement `geography_code`), ni couverture, ni référence de source
— la provenance vivant dans `source_releases`.

C'est ce que la consigne appelle « une projection ». Elle est **correcte comme
persistance** et **inutilisable comme source de reconstruction publique** : le
diagnostic de #174 est confirmé, et la décision architecturale de la consigne
(ne jamais reconstruire depuis SQL) est la bonne.

## 3. Où vit chaque information ?

| Information | Artefact | Rapport | Release SQL | Projection SQL | `PreparedRelease` |
|---|---|---|---|---|---|
| Octets bruts | ✅ | — | — | — | en entrée |
| `payload_sha256` | dérivable | ✅ | ✅ `checksum` | — | ✅ |
| Verdict `ready_for_staging` | — | ✅ | — | — | vérifié |
| Fenêtre demandée | — | ✅ `query_parameters` | — | — | ✅ |
| Période **observée** | dérivable | — | — | ❌ | ✅ |
| Valeur, unité, métrique | dérivable | — | — | ✅ | ✅ |
| Portée + libellé géographiques | dérivable | — | — | ❌ (code seul) | ✅ |
| Couverture, confiance | dérivable | — | — | partiel | ✅ |
| Licence (décision) | — | — | ✅ colonnes | — | injectée |
| Attribution | — | — | ✅ `attribution_text` | — | injectée |
| `source_information_url`, `source_refresh_cadence`, `source_last_updated_on` | — | — | ❌ | ❌ | ❌ **manquants** |

Deux manques, pas un :

1. la projection SQL perd la moitié du contrat P02 — connu, admis, non
   corrigeable sans migration ;
2. **`PreparedRelease` elle-même ne porte pas encore les trois champs de
   provenance ajoutés au contrat en X4B-PREP** : `prepare_release` construit sa
   `WaterSourceReference` sans eux. Un snapshot reconstruit aujourd'hui
   partirait donc avec une provenance muette, et la troisième barrière de
   l'assembleur l'écarterait — correctement, mais pour la mauvaise raison.

## 4. Quel code est dupliqué entre validation et ingestion ?

**Aucun normaliseur n'est dupliqué**, et c'est une bonne surprise :
`validate_hubeau.py` (validation) et `staging_writer.py` (ingestion) passent
tous deux par `run_pipeline`/`derive_observations` du paquet
`services/water_intelligence/`.

Ce qui **est** dupliqué, en revanche, c'est la composition de la provenance :

| Producteur | Source de l'attribution |
|---|---|
| `validate_hubeau.py` (X4B-PREP) | `source_attribution.attribution_for()` — configuration canonique |
| `staging_writer.py:738` | `source.get("attribution_text")` — **ligne du Source Registry en base** |

Deux origines pour un même fait. Elles coïncident aujourd'hui seulement parce
que `staging_rehearsal.seed-sources` sème la valeur canonique en base — mais
rien ne le vérifie, et une base semée par une version antérieure du script
produirait silencieusement une attribution différente de celle mesurée.

## 5. Comment garantir que persistance, mesure et publication partagent la même normalisation ?

En gardant `prepare_release()` comme **unique** normaliseur, et en corrigeant ce
qui l'empêche aujourd'hui d'être appelée hors base.

Le blocage n'est pas dans la fonction — il est dans son **site d'appel** :
`ingest_staging_release()` l'invoque à la ligne 732, **à l'intérieur de la
transaction**, parce que ses deux derniers arguments viennent de la base :

```python
source   = _load_source(cur, request.source_code)   # ligne du Source Registry
decision = license_policy.evaluate(source)          # ← license_decision
...
attribution=source.get("attribution_text"),         # ← attribution
```

`prepare_release` est pure ; **ses entrées ne le sont pas**. C'est la seule
raison pour laquelle elle n'est pas déjà réutilisable par le constructeur de
candidats.

**Correction proposée** : rendre la provenance explicite et injectable — un
contexte porté par la configuration canonique
(`source_attribution.py` pour attribution/URL/cadence, `source_status.py` pour
`license_code`/`license_scope`), fourni identiquement par les deux appelants.

**Point d'arbitrage, non tranché ici.** Deux lectures possibles du rôle de la
base :

| Option | Conséquence |
|---|---|
| **A — la configuration canonique fait foi**, la ligne du Source Registry est *vérifiée* contre elle et une divergence **lève** | Une seule source de vérité ; un registre semé par une version antérieure fait échouer l'ingestion au lieu de la contaminer |
| **B — la base fait foi** pour la persistance, la configuration pour la mesure | Deux vérités qui peuvent diverger sans bruit — exactement le défaut que le §5 de la consigne veut supprimer |

L'option A est cohérente avec la discipline du chantier (« un garde-fou qui
vérifie une valeur qu'il a lui-même posée ne vérifie rien », Wave E) ; elle
change en revanche le comportement du graveur en cas de divergence. **Décision
humaine requise avant implémentation.**

## 6. Quel sérialiseur définit les octets soumis au budget ?

`WaterPublicSnapshot.canonical_json()` puis `payload_bytes()`
(`public_snapshot.py:185-205`) — et `_enforce_budgets()` mesure exactement ce
que `canonical_json()` produit. Le budget porte donc **déjà** sur les octets
canoniques réels, pas sur une approximation.

La forme canonique du document **committé**, elle, est imposée ailleurs :
`json.dumps(..., ensure_ascii=False, indent=2, sort_keys=True) + "\n"`
(`TestDocumentParity`). **Les deux formes diffèrent** — l'une compacte, l'autre
indentée — et c'est voulu : le budget de 100 000 octets est défini par le
contrat P02 sur la charge servie, pas sur le fichier versionné.

**Conséquence à ne pas manquer** : un `serialize_water_public_snapshot()` unique
tel que le §7 le demande doit dire **laquelle** des deux il produit, sinon il
réunira deux notions qui n'ont ni le même but ni la même taille. Proposition :
deux fonctions nommées (`canonical_payload_bytes` pour le budget et l'ETag,
`canonical_document_bytes` pour le fichier versionné), partageant le même
`model_dump`, plutôt qu'une seule qui masquerait la distinction.

## 7. Comment garder une reconstruction pure ?

Elle l'est déjà, à une condition près : que la provenance soit **injectée** et
non lue en base (§5). Une fois cela fait, le constructeur de candidats
n'ouvre plus aucune connexion — il consomme des `PreparedRelease` produites en
mémoire depuis les artefacts et les rapports du run.

Corollaire : `build_candidate_snapshots.py` peut **perdre** son exemption
d'accès à la base. C'est un gain net — l'exemption la plus sûre est celle qu'on
retire.

## 8. Une migration est-elle nécessaire ?

**Non, et c'est démontrable.** La reconstruction ne lit plus la projection SQL :
elle repart des artefacts et des rapports, que le run produit déjà. La table
`observations` reste ce qu'elle est — une projection de persistance — et rien
n'exige qu'elle devienne relisible.

La migration `observations.identity_fingerprint` évoquée en X2B reste
souhaitable pour une **autre** raison (détecter une collision après écriture,
et admettre une source à scénarios). Elle n'est pas requise ici, et la traiter
dans cette PR mélangerait deux sujets. Conformément au §1 de la consigne, elle
reste hors périmètre.

## 9. Verdict, et ce qu'il change au plan

| Point de la consigne | Verdict de l'audit |
|---|---|
| §3 — créer `prepare_validated_water_release` | **À ne pas faire tel quel** : `prepare_release()` existe et fait le travail. La créer serait le second normaliseur que le §3 interdit lui-même. |
| §2 — contrat `PreparedWaterRelease` | **À faire, en enrichissant `PreparedRelease`** : il lui manque la provenance (URL officielle, cadence, dernière mise à jour, `license_code`, `license_scope`, checksum du rapport) et les agrégats (métriques, unités, géographies, couverture). |
| §4 — adapter le graveur | **Réduit à un déplacement** : sortir la résolution de provenance de la transaction, pas réécrire le pipeline. |
| §5 — parité | **À faire**, et facilité : préparation et persistance partagent déjà les mêmes `PreparedObservation`. |
| §6 — reconstructeur | **À faire**, alimenté par des `PreparedRelease`, jamais par SQL. |
| §7 — sérialiseur unique | **À faire, en deux fonctions nommées** — cf. §6 ci-dessus. |
| §8 — migration | **Non nécessaire.** Aucune ADR à produire. |

## 10. Ce que cet audit ne fait pas

- Il ne tranche pas l'arbitrage du §5 (configuration canonique *vs* Source
  Registry comme source de vérité de la provenance) — il le pose.
- Il n'écrit aucun code, ne publie rien, n'approuve aucune source.
- Il ne mesure aucun budget : le workflow n'a toujours pas été exécuté.
- Il ne traite pas la migration `identity_fingerprint`, hors périmètre.
