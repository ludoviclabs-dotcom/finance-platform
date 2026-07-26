# Carbon&Co — Water Connector Activation Pack
## Validation live, ingestion staging, décision humaine et première publication

**Dépôt :** `ludoviclabs-dotcom/finance-platform`  
**Version :** 1.0

```text
Phase A routes/shell — fusionnée
        ↓
Activation X1 à X4 — ce pack
        ↓
Phase B refonte publique premium
```

Ce pack ne remplace pas la refonte UX. Il ajoute la couche absente :
acquisition réelle, preuve d'exécution, ingestion staging et activation de
sources explicitement approuvées.

---

# État de départ

| Source | État technique | État publication |
|---|---|---|
| EEA / WISE / WEI+ | parseur, normalisation, périodes et tests disponibles | aucune release réelle publiée |
| Hub'Eau hydrométrie | transport borné et normalisation disponibles | aucun Fetcher réel branché |
| Hub'Eau piézométrie | transport borné et normalisation disponibles | aucun Fetcher réel branché |
| Hub'Eau prélèvements | transport borné et normalisation disponibles | aucun Fetcher réel branché |
| Hub'Eau qualité surface | transport borné, allowlist SANDRE disponible | aucun Fetcher réel branché |
| WRI Aqueduct | connecteur disponible | enregistrement WRI non effectué |
| Copernicus EDO | identité et contrat vérifiés | décodeur raster reporté |

Il manque encore :

1. un Fetcher opérateur réel et borné ;
2. des commandes reproductibles ;
3. des exécutions live documentées ;
4. un graveur Evidence Kernel spécifique Eau ;
5. des releases staging ;
6. des décisions humaines signées ;
7. un snapshot public construit uniquement avec les sources approuvées.

---

# Invariants

- Une phase = une branche = une PR.
- Ne jamais exécuter plusieurs phases dans la même session.
- Aucun appel réseau dans les tests ou le rendu utilisateur.
- Les appels réseau sont réservés aux commandes opérateur explicites.
- Aucun endpoint utilisateur ne déclenche une collecte.
- Aucun cron.
- Aucun appel réseau implicite au démarrage de l'API.
- Aucune source n'est publiée par défaut.
- `unknown` ne devient jamais `approved`.
- `display_allowed=false` bloque la publication.
- Absence ≠ zéro.
- Risque ≠ confiance.
- Aucune jointure géographique par nom si un code officiel existe.
- Aucun dataset brut ou lourd dans Git.
- Aucun secret dans les rapports.
- Aucune valeur WRI sans enregistrement documenté.
- Aucune valeur Copernicus sans décodeur livré.
- Aucune migration dans X1.
- Les données live restent privées/staging avant X4.

---

# PHASE X1 — Validation live en lecture seule

**Branche :** `feat/water-connectors-live-validation`  
**PR :** `feat(carbon): valide les connecteurs Eau sur les sources officielles`

## X1.0 Préflight

1. Synchroniser `master`.
2. Vérifier que la PR #162 est fusionnée.
3. Vérifier que `carbon` et `carbonco-api` sont READY.
4. Vérifier qu'aucune PR active ne touche :
   - `apps/api/services/water_intelligence/`
   - `apps/api/scripts/`
   - les handoffs Water.
5. Lire les handoffs WRI, EEA/Copernicus, Hub'Eau, le pipeline P03,
   les décisions de licence et les contrats P02.

## X1.1 Matrice de préparation

Créer :

`docs/carbonco/water-intelligence/activation/X1_CONNECTOR_READINESS_MATRIX.md`

Pour chaque source, documenter :

- module ;
- format attendu ;
- release/version ;
- acquisition réelle disponible ou non ;
- parser ;
- normalizer ;
- geography resolver ;
- period resolver ;
- licence ;
- attribution ;
- budgets ;
- paramètres obligatoires ;
- blocage ;
- commande opérateur attendue.

Ne pas conclure « live » sur la seule base des fixtures.

## X1.2 Fetcher opérateur

Créer les scripts hors du paquet pur :

`apps/api/scripts/water_intelligence/`

Le Fetcher :

- réutilise un client HTTP déjà approuvé ;
- sinon utilise la bibliothèque standard dans le script uniquement ;
- n'est jamais importé par `services/water_intelligence`;
- HTTPS uniquement ;
- allowlist stricte ;
- timeout ;
- retries bornés ;
- limites d'octets et de pages ;
- User-Agent explicite ;
- redirections contrôlées ;
- aucun suivi d'une URL `next` fournie par la réponse ;
- logs sans corps complet ni secret ;
- checksum des octets ;
- artefact hors Git.

## X1.3 Commandes opérateur

### EEA

```text
python -m scripts.water_intelligence.validate_eea \
  --release <release_key_epinglee> \
  --input <fichier_officiel_ou_url_officielle> \
  --dry-run \
  --report <chemin>
```

Le geste doit :

- vérifier la release ;
- vérifier le checksum ;
- convertir le conteneur officiel vers le format canonique ;
- lancer le pipeline complet en dry-run ;
- produire un rapport ;
- ne rien écrire en base.

### Hub'Eau

```text
python -m scripts.water_intelligence.validate_hubeau \
  --source hydrometrie|piezometrie|prelevements|qualite_surface \
  --geography-type <type> \
  --geography-code <code> \
  --date-from <date> \
  --date-to <date> \
  --max-pages <n> \
  --max-bytes <n> \
  --dry-run \
  --report <chemin>
```

Aucun territoire ou intervalle métier codé en dur.

Pour la recette technique, utiliser uniquement :

- un identifiant présent dans la documentation officielle ;
- ou un identifiant découvert par une requête référentiel bornée.

Le rapport doit préciser qu'il s'agit d'un échantillon technique.

## X1.4 Sources exclues

### WRI

- aucune acquisition ou publication tant que l'enregistrement n'est pas documenté ;
- validation possible seulement sur un artefact local obtenu légalement ;
- sinon statut `blocked_registration_required`.

### Copernicus

- vérifier seulement accessibilité et identité du produit ;
- aucun décodage ;
- aucun téléchargement massif ;
- statut `source_verified_decoder_deferred`.

## X1.5 Exécutions live obligatoires

Exécuter réellement :

- une release EEA épinglée ;
- une requête Hub'Eau hydrométrie bornée ;
- une requête Hub'Eau piézométrie bornée ;
- une requête Hub'Eau prélèvements bornée ;
- une requête Hub'Eau qualité avec allowlist SANDRE minimale.

Ne pas committer les données.

Commiter seulement des rapports expurgés contenant :

- URL officielle sans query sensible ;
- timestamp ;
- code HTTP ;
- content type ;
- octets ;
- pages ;
- checksum ;
- records reçus ;
- records normalisés ;
- records absents ;
- warnings ;
- erreurs ;
- durée ;
- méthode/version ;
- résultat dry-run.

## X1.6 Tests

- allowlist ;
- HTTPS ;
- timeout ;
- retry ;
- redirection externe ;
- limites ;
- checksum ;
- rapport sans secret ;
- absence de DB ;
- absence de publication ;
- tests pipeline/connecteurs ;
- suite API ;
- ruff.

## X1.7 Livraison

Commits :

1. `docs(carbon): audite la préparation live des connecteurs Eau`
2. `feat(carbon): ajoute les commandes opérateur Water Intelligence`
3. `test(carbon): valide les acquisitions Eau bornées`
4. `docs(carbon): consigne les résultats live Water Intelligence`

Créer :

`docs/carbonco/water-intelligence/activation/X1_LIVE_VALIDATION_HANDOFF.md`

Ouvrir la PR et s'arrêter.

---

# PHASE X2 — Graveur Evidence Kernel et releases staging

**Branche :** `feat/water-evidence-kernel-ingestion`

Ne commencer qu'après fusion X1.

## Objectif

Créer un writer Water réutilisant le Source Registry, les artefacts, les
releases, les observations, les licences et `WaterObservationIdentity`.

Règles :

- transaction atomique ;
- dry-run par défaut ;
- `--commit` explicite ;
- même identité + même contenu = idempotent ;
- même identité + contenu différent = erreur ;
- rollback complet ;
- aucun snapshot public automatique ;
- environment staging uniquement.

CLI :

```text
python -m scripts.water_intelligence.ingest_release \
  --source-code <code> \
  --artifact <path> \
  --report <x1_report> \
  --dry-run
```

Puis :

```text
... --commit --environment staging
```

Tester contre PostgreSQL réel :

- release ;
- artefact ;
- périodes multiples ;
- idempotence ;
- collision ;
- rollback ;
- licence bloquée ;
- source inconnue ;
- aucune donnée tenant ;
- aucune publication publique.

Si une migration est nécessaire : arrêter et proposer une PR dédiée.

Créer :

`activation/X2_EVIDENCE_INGESTION_HANDOFF.md`

---

# PHASE X3 — Répétition staging de bout en bout

**Branche :** `ops/water-staging-rehearsal`

Exécuter X1 + X2 sur staging pour :

1. EEA WEI+ ;
2. Hub'Eau hydrométrie ;
3. Hub'Eau piézométrie ;
4. Hub'Eau prélèvements ;
5. Hub'Eau qualité surface.

Vérifier :

- acquisition ;
- checksum ;
- parser ;
- normalisation ;
- périodes ;
- géographies ;
- unités ;
- null ;
- doublons ;
- collisions ;
- couverture ;
- fraîcheur ;
- attribution ;
- Evidence Kernel ;
- aucune donnée tenant ;
- aucune donnée publique.

Créer :

`activation/X3_STAGING_REHEARSAL_REPORT.md`

Construire un snapshot candidat non public, utilisé uniquement en Preview
protégée pour vérifier carte et table.

---

# PHASE X4 — Décision humaine et première publication

**Branche :** `feat/water-first-approved-public-release`

Ne commencer qu'après une réponse humaine explicite de la forme :

```text
J'approuve pour publication publique :
- EEA_WEI_PLUS release ...
- HUBEAU_HYDROMETRIE release ...

Je n'approuve pas :
- ...
```

Pour chaque source approuvée, renseigner :

- reviewer ;
- reviewed_on ;
- release ;
- scope ;
- licence ;
- attribution ;
- display_allowed ;
- derived_use_allowed ;
- limites ;
- motifs.

WRI reste refusée sans enregistrement.  
Copernicus reste exclue sans décodeur.

Promouvoir staging → published, construire le snapshot immuable, vérifier
ETag/cache/rollback, puis vérifier `/water` en Preview.

Aucune collecte au moment d'une requête utilisateur.

Créer :

- `activation/X4_PUBLICATION_DECISIONS.md`
- `activation/X4_FIRST_PUBLIC_RELEASE.md`

Ouvrir la PR en Draft et ne pas fusionner sans revue visuelle humaine.

---

# Prompt immédiat

```text
Tu travailles dans `ludoviclabs-dotcom/finance-platform`.

Crée le fichier :

`docs/carbonco/water-intelligence/activation/WATER_CONNECTOR_ACTIVATION_PACK.md`

à partir du pack fourni.

Exécute uniquement :

`PHASE X1 — Validation live en lecture seule`

Ne commence ni X2, ni la Phase B de refonte visuelle.

Avant toute modification :

1. synchronise `master`;
2. vérifie que la PR #162 est fusionnée;
3. vérifie qu'aucune PR active ne modifie les connecteurs ou scripts Water;
4. crée la branche :
   `feat/water-connectors-live-validation`.

Objectif :

- créer des commandes opérateur réelles et bornées;
- exécuter une validation live EEA et Hub'Eau;
- produire des rapports expurgés;
- ne rien écrire en base;
- ne rien publier;
- ne toucher à aucun frontend;
- ne modifier aucune décision de licence.

WRI reste bloquée sans enregistrement.
Copernicus reste sans décodeur.

Arrête-toi après les tests, le push et l'ouverture de la PR X1.
```
