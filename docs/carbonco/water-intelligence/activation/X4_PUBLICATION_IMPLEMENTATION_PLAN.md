# X4B — Plan technique de première publication Water

**Statut : plan. Rien de ce document n'est exécuté par X4A.**
**Aucune base créée. Aucune donnée publique créée. `/water` non modifié.**

Ce plan décrit **comment** publier, une fois — et seulement une fois — que les
formulaires de
[X4_PUBLICATION_DECISION_PACKET.md](X4_PUBLICATION_DECISION_PACKET.md) sont
signés `approved`. Il ne publie rien et n'autorise rien.

---

## 1. Audit du mécanisme de publication existant

### 1.1 Ce qui existe déjà, et ce que chaque pièce fait

| Pièce | Fichier | Rôle réel |
|---|---|---|
| Enveloppe publique | `apps/api/services/water_intelligence/public_snapshot.py` → `WaterPublicSnapshot` | Objet immuable (`frozen=True`), JSON canonique (clés triées, séparateurs compacts), ETag dérivé du contenu, budgets vérifiés |
| Miroir front | `apps/carbon/lib/water-intelligence/public-snapshot.ts` | Schéma Zod aligné champ pour champ, `SNAPSHOT_SCHEMA_VERSION = "1.0.0"` |
| Assembleur | `assemble_public_snapshot()` | Déterministe, **sans horloge** (`generated_at` injecté), sans réseau, sans base. Trie les observations, applique le gate licence, écarte avec motif, refuse toute donnée tenant, applique les budgets |
| Registre de décisions | `publication_decisions.py` | `approved` / `proposed` / `refused` ; un `approved` sans `reviewed_by` **et** `reviewed_on` est rejeté **à la construction** |
| Loader public | `PublicSnapshotLoader` | Lecture seule, bornée (100 ko), **aucune méthode d'écriture**, refuse un `schema_version` inattendu et tout champ tenant |
| Endpoints publics | `apps/api/routers/water_intelligence.py` | `GET /water-intelligence/public-snapshot` et `/regulatory-registry`, montés **sans dépendance d'authentification**, aucun client HTTP importé — donc aucun appel externe possible |
| Client front | `apps/carbon/lib/api/water-decision.ts` | Mémorise l'ETag, renvoie `If-None-Match`, traite 304 comme « inchangé » et non « absent » |
| Documents canoniques versionnés | `docs/carbonco/water-intelligence/contracts/*.json` | Cinq documents (dont `PUBLIC_SNAPSHOT_EMPTY.json`), **miroirs octet pour octet** dans `apps/carbon/lib/water-intelligence/*.json` |
| Parité des miroirs | `tests/test_water_intelligence_source_status.py::TestDocumentParity` + `tests/water-intelligence-truth.test.tsx` | Le document canonique doit être **exactement** `json.dumps(..., ensure_ascii=False, indent=2, sort_keys=True) + "\n"` de ce que produit l'assembleur, et le miroir doit lui être identique |
| Rendu carte / table | `WiMapFrame.tsx` | Si `coverage.layer_count == 0` ou `is_empty`, la carte **n'est pas montée** ; la table équivalente est rendue côté serveur |

### 1.2 Mécanismes d'artefact déjà présents dans le dépôt

| Mécanisme | Verdict pour un snapshot public immuable |
|---|---|
| Documents canoniques `contracts/*.json` + miroirs | **Retenu.** Versionné, immuable par commit, revu en PR, restauré par `git revert`, sans aucune infrastructure supplémentaire |
| Artefacts GitHub Actions (`water-x3-staging-rehearsal.yml`, `retention-days: 7`) | Écarté : expire, non servable, non versionné |
| Vercel Blob (`apps/api/services/storage/vercel_blob.py`) | Écarté : store **privé**, exige un identifiant au runtime, et introduirait une dépendance de disponibilité sur une surface publique qui n'en a aucune aujourd'hui |
| `apps/carbon/data/crm_price_history.json` + workflow `materials-price-history.yml` (`contents: write`, commit et push automatiques) | **Précédent utile, délibérément non réutilisé.** Il prouve qu'un fichier de données versionné alimente une surface. Mais son automatisation pousse sans revue : appliquée ici, elle contournerait exactement la signature humaine que le gate exige |
| Base Neon / staging supplémentaire | Écarté par consigne, et inutile : rien dans le chemin de lecture public n'ouvre de connexion |

### 1.3 Conventions ETag / cache / rollback en vigueur

- **ETag faible** `W/"wi-<sha256[:32]>"`, calculé sur les octets canoniques.
  Faible et non fort, délibérément : la représentation est sémantiquement
  équivalente d'une requête à l'autre, mais l'égalité octet pour octet après
  sérialisation par le framework n'est pas garantie.
- `If-None-Match` géré selon RFC 9110 §13.1.2 (liste séparée par virgules,
  joker `*`), 304 sans corps mais **avec** `ETag` et `Cache-Control`.
- `Cache-Control: public, max-age=300`. Le contenu ne change qu'avec un
  déploiement, jamais au fil de l'eau.
- **Conséquence structurante** : le cache ne peut être invalidé que par un
  changement **réel** de contenu. Réassembler le même snapshot ne produit pas
  un nouvel ETag.
- **Rollback** : il n'existe aucun mécanisme de rollback propre à Water. Celui
  du dépôt est le seul : `git revert` du commit de publication, puis
  redéploiement. Un document versionné est donc réversible par construction ;
  une écriture en base ne l'aurait pas été.

### 1.4 Conclusion — la plus petite voie sûre

> **Publier = committer un document canonique `WATER_PUBLIC_SNAPSHOT.json`
> assemblé hors ligne, le mirrorer dans `apps/carbon/lib/water-intelligence/`,
> et faire lire ce document par l'endpoint public à la place du document vide.**

Cette voie satisfait les cinq priorités :

| Priorité | Comment |
|---|---|
| 1. Mécanisme existant du dépôt | `contracts/*.json` + miroir + tests de parité : rien de neuf, quatre documents fonctionnent déjà ainsi |
| 2. Snapshot compact, versionné, immuable | JSON canonique trié, borné à 100 ko par l'assembleur, immuable par commit |
| 3. Aucune écriture en base de production par un workflow | Le workflow n'écrit que dans un PostgreSQL éphémère ; la publication est un **commit relu**, pas un `git push` automatique |
| 4. Aucune base Neon ou staging supplémentaire | Le chemin de lecture public n'ouvre aucune connexion, et n'en ouvrira pas |
| 5. Aucune collecte à la requête | L'endpoint lit un document importé ; aucun client HTTP n'existe dans le router |

**Deux fichiers seulement changent de nature :** un document canonique
supplémentaire, et trois lignes dans le router. Le reste est déjà en place.

## 2. Préalable bloquant

X4B ne démarre pas tant que, pour **chaque** source à publier :

1. le formulaire du paquet de décision est rempli et signé `approved` ;
2. `CURRENT_DECISIONS` porte cette source en `approved` avec `reviewed_by` et
   `reviewed_on` ;
3. la décision est reportée dans `DECISION_LOG.md`.

Une source `proposed`, `refused` ou absente du registre **ne peut pas** franchir
l'assembleur : elle en sort en exclusion motivée. Ce n'est pas une consigne de
processus, c'est le comportement du code.

### 2.1 Deux travaux à mener AVANT la réacquisition du §3

Constatés dans le code en X4A (§4 de
[X4A_ATTRIBUTION_AND_FRESHNESS.md](X4A_ATTRIBUTION_AND_FRESHNESS.md)). Les
placer après la réacquisition obligerait à réacquérir deux fois.

**a. Porter les libellés d'attribution par jeu dans le code.** L'attribution est
estampillée **à l'acquisition**, pas à l'assemblage :
`validate_hubeau.py:743` et `:937` appellent
`transport_mod.attribution(accessed_on=…)`, et `staging_rehearsal.py:71` sème un
`ATTRIBUTION` fixe dans le Source Registry. Réexécuter le workflow **non
modifié** (§3.1) réestampillerait donc les observations avec le libellé composé
que X4A déclare non publiable. Le remplacement se fait par source, avant la
première acquisition.

Conséquence utile, qui découle du §4.1 ci-dessous : **les checksums attendus du
§4.2 restent valables**. `payload_sha256` porte les octets bruts de la réponse
et ne couvre ni les valeurs normalisées, ni l'attribution — changer le libellé
ne le fait donc pas varier. Un écart de checksum après ce changement reste ce
qu'il a toujours été : un signal à instruire selon le §4.4, jamais un effet
attendu du remplacement.

**b. Trancher le transport de `source_refresh_cadence`.**
`WaterSourceReference` (`models/water_intelligence.py:98-114`) et son miroir Zod
(`apps/carbon/lib/water-intelligence/contracts.ts:87-88`) portent `retrieved_at`
et les bornes de période, **mais aucun champ de cadence**. Le champ serait perdu
à la sérialisation, **sans erreur** — un snapshot correct portant une fraîcheur
muette. Étendre le contrat touche P02, le miroir TypeScript, les documents
canoniques et `TestDocumentParity` : c'est une décision d'architecture, du même
ordre que le budget du §5.4, et elle se prend avant X4B. À défaut, publier sans
cadence **en le disant** — jamais approuver une cadence que la surface ne rendra
pas.

Aucune de ces deux étapes n'est un ajustement de confort : sans (a) le snapshot
publié porte une attribution écartée, sans (b) il ne porte pas la fraîcheur
approuvée.

## 3. Reproduire les trois acquisitions

Aucune release X3 n'existe plus (PostgreSQL éphémère). X4B **réacquiert** avec
la même recette, sur un PostgreSQL éphémère identique — c'est-à-dire en
réexécutant `.github/workflows/water-x3-staging-rehearsal.yml`, non modifié,
sauf sur les périmètres explicitement redéfinis par les formulaires signés.

### 3.1 Commandes d'acquisition, à l'identique

```bash
python -m scripts.water_intelligence.validate_hubeau \
  --source piezometrie \
  --release <release_key X4> \
  --geography-type code_bss --geography-code "09892X0679/EXH70" \
  --date-from 2024-01-01 --date-to 2024-03-31 \
  --max-pages 2 --max-bytes 2000000 --page-size 200 \
  --report "$REPORTS/10_piezometrie.md" \
  --artifact-dir "$ARTIFACTS/HUBEAU_ADES"
```

```bash
python -m scripts.water_intelligence.validate_hubeau \
  --source qualite_surface \
  --release <release_key X4> \
  --geography-type code_departement --geography-code 34 \
  --date-from 2024-01-01 --date-to 2024-03-31 \
  --parameter-code 1340 --parameter-code 1339 \
  --max-pages 1 --max-bytes 2000000 --page-size 50 \
  --report "$REPORTS/11_qualite_surface.md" \
  --artifact-dir "$ARTIFACTS/HUBEAU_QUALITE_SURFACE"
```

```bash
python -m scripts.water_intelligence.validate_hubeau \
  --source prelevements \
  --release <release_key X4> \
  --geography-type code_departement --geography-code 34 \
  --date-from 2020 --date-to 2020 --max-years 1 \
  --max-pages 1 --max-bytes 2000000 --page-size 50 \
  --report "$REPORTS/13_prelevements.md" \
  --artifact-dir "$ARTIFACTS/HUBEAU_BNPE_PRELEVEMENTS"
```

Contraintes déjà démontrées, à ne pas « simplifier » :

- BNPE exige **une requête par année** (`annee=<AAAA>`). `annee_min`/`annee_max`
  sont ignorés **en silence** par la plateforme — un filtre qui ne filtre pas
  produit un résultat plausible et faux.
- Hub'Eau borne la profondeur d'accès à `page × size ≤ 20 000`.
- `HUBEAU_HYDROMETRIE` reste **hors** de toutes les étapes de graveur.

### 3.2 Verdict exigé

Chaque acquisition doit rendre `verdict = ready_for_staging`, avec
`records_rejected = 0`. Tout autre verdict arrête X4B : un verdict dégradé se
corrige, il ne se contourne pas.

### 3.3 Ingestion, puis rejeu

`ingest_release.py` en `--dry-run` d'abord (il exécute le **vrai** chemin
d'écriture puis avorte la transaction), puis `--commit`, puis un second
`--commit` pour prouver l'idempotence :
`observations_written == 0`, `release_reused is true`, `release_id` identique.

## 4. Vérifier les checksums, ou expliquer une variation

### 4.1 Ce que le checksum couvre

`payload_sha256` = SHA-256 des **octets bruts de la réponse**, concaténés page
par page (`hashlib.sha256(b"".join(acquisition.pages))`). Il ne couvre ni les
valeurs normalisées, ni l'ordre d'insertion.

### 4.2 Attendus

| Source | Checksum X3 attendu |
|---|---|
| `HUBEAU_ADES` | `54ac8e5b4d895f323ee352c1c7c8ddde3c9a3c5dae469b6e351ac46fc76ee00b` |
| `HUBEAU_QUALITE_SURFACE` | `cc88d7071ad059264905570f59e9f59738604f92697f3ffbea45a2a030ce0e45` |
| `HUBEAU_BNPE_PRELEVEMENTS` | `a72f6e472f0db12f0717f7d2831ab5caa03bff568a05131c6220e2c505a559e4` |

### 4.3 Une variation déjà constatée, non expliquée à ce jour

`HUBEAU_ADES` a produit **deux checksums différents pour un nombre d'octets
identique** :

| Exécution | Paramètres | Octets | Checksum |
|---|---|---|---|
| X2A | `--page-size 100 --max-bytes 1000000` | 52 139 | `52bc5f94759d7c96b06ef2853fd417342e2a9e409f77e2900af9ad2518bbd7c6` |
| X3 | `--page-size 200 --max-bytes 2000000` | 52 139 | `54ac8e5b4d895f323ee352c1c7c8ddde3c9a3c5dae469b6e351ac46fc76ee00b` |

Une même longueur pour un contenu différent exclut un ajout ou un retrait de
données : quelque chose a été **remplacé par une chaîne de même longueur**. Une
hypothèse plausible — les réponses Hub'Eau embarquent des URL de pagination, et
`size=100` compte exactement autant de caractères que `size=200` — reste une
hypothèse. **Elle doit être démontrée, pas supposée.**

### 4.4 Procédure obligatoire de vérification

1. Réacquérir avec les paramètres **exacts** du §3.1.
2. Comparer le checksum à l'attendu du §4.2.
3. **S'il correspond** : consigner, continuer.
4. **S'il diffère** : ne pas continuer. Diffuser les deux payloads localement
   (hors dépôt) et produire la **liste des octets qui changent**. Deux issues
   seulement :
   - variation **de forme** (URL de pagination, `api_version`, ordre de clés) :
     documenter le diff exact dans le rapport de publication, et publier ;
   - variation **de valeur** (une mesure a changé côté source) : arrêter. Une
     donnée qui bouge sans explication n'est pas publiable, et la question
     remonte au signataire.
5. Ne **jamais** committer les payloads bruts, ni dans le dépôt ni dans un
   artefact public — seuls les checksums et les diffs de forme font foi.

## 5. Construire le snapshot final

### 5.1 Nouveau script opérateur

`apps/api/scripts/water_intelligence/build_public_snapshot.py` — un seul script,
**en lecture seule sur la base**, sans réseau, aligné sur la discipline de
`staging_rehearsal.py snapshot` (qui lit déjà la base et n'écrit rien).

Il :

1. passe par `staging_connection_factory` — jamais `DATABASE_URL`, jamais
   `DATABASE_ADMIN_URL` ;
2. relit les observations des releases `validated` (`published_at IS NULL`,
   `company_id IS NULL`) ;
3. les reconstruit en `WaterMetricObservation` **avec la décision de licence
   réelle** (`allow_display=true` pour une source signée) — sans quoi
   l'assembleur les écarte comme non publiables ;
4. appelle `assemble_public_snapshot(..., registry=current_registry(), generated_at=<injecté>)` ;
5. écrit le document canonique.

### 5.2 `generated_at` — la seule valeur à trancher

Les documents canoniques existants portent `generated_at: ""` parce qu'un
document versionné ne peut pas porter une date d'assemblage qui serait fausse
dès le lendemain. Pour un snapshot **réel**, l'information utile n'est pas la
date d'assemblage mais la date de consultation de la source, déjà portée par
`source.retrieved_at` de chaque observation.

**Décision proposée : conserver `generated_at: ""`.** La surface rend « n.c. »,
et la fraîcheur se lit sur la provenance, qui est vraie. À confirmer en revue de
PR ; l'alternative (dater l'assemblage) est acceptable mais doit être explicite.

### 5.3 Forme exacte du document

```
json.dumps(document, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
```

Exactement la forme qu'imposent déjà les tests de parité. Toute autre forme
casse `TestDocumentParity`, ce qui est le comportement voulu.

### 5.4 Mesurer le budget **avant** de committer

`snapshot.payload_bytes()` doit être imprimé et consigné. Le budget est de
**100 000 octets non compressés** et l'assembleur **lève**
`SnapshotBudgetExceeded` au-delà : il ne tronque jamais.

282 observations portant chacune leur enveloppe de preuve complète dépasseront
très probablement ce budget (cf. §3.5 du paquet de décision). Si le dépassement
se produit :

- **ne pas** relever le budget dans le code pour faire passer le commit ;
- **ne pas** tronquer, échantillonner ni « alléger » l'enveloppe de preuve ;
- remonter au signataire, qui choisit entre réduire le périmètre publié,
  publier une source à la fois, ou ouvrir une modification du contrat P02 §7 —
  décision d'architecture distincte, hors X4.

## 6. Où le snapshot est conservé

| Chemin | Rôle |
|---|---|
| `docs/carbonco/water-intelligence/contracts/WATER_PUBLIC_SNAPSHOT.json` | Document canonique — source de vérité |
| `apps/carbon/lib/water-intelligence/public-snapshot.json` | Miroir octet pour octet, importé par le front |

`PUBLIC_SNAPSHOT_EMPTY.json` et son miroir sont **conservés**, non remplacés :
ils restent l'état canonique de référence et la cible du rollback du §9.

La paire est ajoutée à `TestDocumentParity.PAIRS` (Python) et à la liste
`pairs` de `water-intelligence-truth.test.tsx`. À partir de là, toute dérive
entre les deux fichiers casse la CI.

## 7. Comment l'API publique le charge

Le router change de source, pas de comportement :

```python
# avant
snapshot = canonical_empty_document()
# après
snapshot = published_snapshot_document()   # lit le document canonique versionné
```

Règles :

- `published_snapshot_document()` lit le document **depuis le dépôt**
  (`importlib.resources` ou lecture de fichier au démarrage), le valide par
  `PublicSnapshotLoader.load_mapping()` — qui refuse un `schema_version`
  inattendu et tout champ tenant — et **retombe sur `canonical_empty_document()`
  si le document est absent** ;
- un document **présent mais invalide** ne retombe **pas** silencieusement sur le
  vide : il lève au démarrage. Un snapshot illisible servi comme snapshot vide
  ferait passer une panne pour un gate ;
- aucun client HTTP n'est importé dans le router, aujourd'hui comme demain :
  aucune collecte n'est possible à la requête ;
- le front continue de lire son miroir importé statiquement — aucun appel réseau
  n'est ajouté à `/water`.

## 8. ETag

Rien à inventer : `_weak_etag("wi", snapshot)` calcule déjà le validateur sur
les octets canoniques de la charge servie. Le snapshot change ⇒ le digest change
⇒ l'ETag change ⇒ les caches et les clients se réalignent. Le snapshot ne change
pas ⇒ l'ETag est stable et les 304 continuent.

Trois vérifications à ajouter aux tests de router :

1. l'ETag du snapshot publié **diffère** de celui du snapshot vide ;
2. deux appels successifs rendent le **même** ETag (déterminisme) ;
3. `If-None-Match` avec cet ETag rend un **304 sans corps**, avec `ETag` et
   `Cache-Control` présents.

## 9. Rollback

| Étape | Geste |
|---|---|
| 1 | `git revert <commit de publication>` — le document canonique et son miroir reviennent ensemble |
| 2 | Repasser la source de `approved` à `deferred`/`refused` dans `CURRENT_DECISIONS`, **avec motif** |
| 3 | Redéployer |
| 4 | Vérifier que `/water-intelligence/public-snapshot` rend `is_empty: true` et un ETag **différent** de celui de la version publiée |

Aucune donnée à supprimer, aucune base à nettoyer, aucun cache à purger à la
main : le `max-age` est de 300 s et l'ETag a changé. C'est précisément la raison
pour laquelle un document versionné est préféré à une écriture en base.

## 10. Exclusion des tenants

Quatre barrières existent déjà et sont conservées :

1. `_reject_tenant_data()` inspecte `model_dump`, `__dict__` **et**
   `model_extra` de chaque observation — le point `__dict__` couvre un attribut
   posé hors schéma, invisible d'une sérialisation normale ;
2. `PublicSnapshotLoader.load_mapping()` refuse tout champ tenant dans le JSON
   sérialisé ;
3. les tests de parité vérifient qu'aucun document canonique ne contient
   `company_id`, `tenant_id`, `site_id`, `user_id` — la paire du §6 y est
   ajoutée ;
4. le script de construction ne lit que des lignes `company_id IS NULL`.

Aucune barrière n'est retirée ni assouplie. Une seule est ajoutée : le
constructeur refuse de produire un document si une observation lue porte un
`company_id`, plutôt que de la filtrer — filtrer masquerait le fait qu'une
donnée tenant a atteint une release publique.

## 11. Tester la carte et la table

État actuel : `geo_layers` est vide, donc `coverage.layer_count == 0`, donc
`WiMapFrame` rend « aucune couche publiée » et **ne monte pas de carte**. Publier
des observations ne change pas cet état.

| Cas | Attendu |
|---|---|
| Snapshot publié, `layer_count == 0` | La carte **n'est pas** montée ; l'état « aucune couche publiée » est rendu ; la table équivalente est présente dans le DOM initial (Server Component) |
| Table alimentée | Chaque observation publiée apparaît, **y compris celles sans valeur** — une valeur absente est rendue absente, jamais 0 |
| BNPE | La limite de couverture partielle est affichée à côté des valeurs, pas seulement en pied de page |
| Naïades | Aucune mention de conformité nulle part |
| Page `/water` | Le bandeau « Données publiques en attente de validation » et le texte « aucune décision humaine signée » doivent être **mis à jour** — les laisser tels quels après publication serait faux (tests `water-intelligence-truth.test.tsx` §10) |
| Sources non signées | Continuent d'apparaître en exclusion **avec motif** — une source écartée sans mention donnerait une fausse impression d'exhaustivité |

Ces tests étendent les suites existantes (`water-intelligence-truth.test.tsx`,
`water-intelligence-map.test.ts`, `water-intelligence-foundations.test.tsx`).
Aucun nouveau harnais : le dépôt n'a pas `@testing-library` et rend en
`renderToStaticMarkup`.

## 12. Empêcher toute publication non signée

Cinq verrous, dont quatre existent déjà :

| # | Verrou | État |
|---|---|---|
| 1 | Un `approved` sans `reviewed_by` **et** `reviewed_on` est rejeté à la construction du registre | **existe** |
| 2 | Une source non `approved` est écartée par l'assembleur, avec motif | **existe** |
| 3 | Double barrière licence : une observation dont `allow_display=false` est écartée même si sa source est autorisée | **existe** |
| 4 | Le loader refuse un `schema_version` inattendu et tout champ tenant | **existe** |
| 5 | **À ajouter** : un test qui compare le document canonique publié au registre — toute source présente dans `included_source_codes` doit être `approved` **et signée** dans `CURRENT_DECISIONS`, sinon échec | à écrire |

Le verrou 5 est le seul ajout, et il est nécessaire : les quatre autres
protègent le chemin d'**assemblage**, aucun ne protège un document canonique
committé à la main.

**Aucun workflow n'obtient `contents: write`.** Le précédent
`materials-price-history.yml` pousse sans revue ; répliqué ici, il produirait
une publication sans signature. Le document canonique n'entre dans `master` que
par une pull request relue.

## 13. Séquence d'exécution X4B

| # | Étape | Sortie |
|---|---|---|
| 1 | Formulaires signés, registre mis à jour, `DECISION_LOG.md` à jour | commit de décision |
| 1 bis | **Libellés d'attribution par jeu portés dans le code** (§2.1 a) et **sort de `source_refresh_cadence` tranché** (§2.1 b) | code + contrat, relus |
| 2 | Réacquisition (§3), vérification des checksums (§4) | rapports, hors dépôt |
| 3 | Ingestion staging éphémère + rejeu idempotent | rapports de parité |
| 4 | Construction du snapshot, **mesure du budget** (§5.4) | document canonique + miroir |
| 5 | Bascule du router (§7), tests ETag (§8), tests carte/table (§11), verrou 5 (§12) | code + tests |
| 6 | Mise à jour du texte de `/water` (§11) | code |
| 7 | Pull request unique, relue | publication |

Étapes 2 à 4 sur PostgreSQL **éphémère** exclusivement. Aucune base Neon, aucune
variable Carbon&Co, aucun `git push` automatique.

## 14. Ce que ce plan ne fait pas

- Il ne publie rien : aucune étape n'est exécutée par X4A.
- Il ne crée aucune base ni aucun store.
- Il ne modifie pas `/water` — la mise à jour du texte est **prévue en X4B**,
  après signature.
- Il ne traite ni `HUBEAU_HYDROMETRIE`, ni `EEA_WEI_PLUS`, ni `WRI_AQUEDUCT`,
  ni `COPERNICUS_EDO`.
- Il ne tranche ni le libellé d'attribution (§3.2 du paquet — instruit par X4A,
  non signé, et incomplet tant que `source_last_updated_on` n'est pas relevé),
  ni le sort du budget de 100 ko (§5.4), ni la valeur de `generated_at` (§5.2),
  ni l'extension du contrat P02 à un champ de cadence (§2.1 b). Ces points sont
  remontés, pas décidés.
