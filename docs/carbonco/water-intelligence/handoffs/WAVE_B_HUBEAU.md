# Wave B — Famille Hub'Eau (P07 hydrométrie/piézométrie + P08 prélèvements/qualité)

**Branche :** `feat/water-intelligence-wave-b-hubeau`
**Base :** `master` @ `a56ab62` (PR #153 Wave A et PR #154 blueprint UX
fusionnées ; Vercel `carbon` et `carbonco-api` en production `READY` sur ce SHA).
**Périmètre :** MACRO-PROMPT B du pack accéléré v2 uniquement. Wave C non lancée.

---

## 1. Ce qui est livré

| Commit | Objet |
|---|---|
| `docs(carbon)` | B0 — synchronisation du pilotage (Wave A fusionnée, `PeriodResolver` livré, contournement `metric_code` caduc) |
| `feat(carbon)` | B1 — socle opérateur Hub'Eau borné |
| `feat(carbon)` | B2 — hydrométrie et piézométrie |
| `feat(carbon)` | B3 — prélèvements et qualité |
| `docs(carbon)` | B4 — ce handoff + pilotage vers Wave C |

**Aucune donnée n'est publiée.** Les quatre sous-connecteurs tournent en
dry-run à travers le pipeline P03. Aucun frontend, aucune route, aucune
migration, aucun appel réseau en test ni au runtime, aucun fichier lourd,
aucune dépendance ajoutée.

---

## 2. Gate source — CONCLUANT

### 2.1 Plateforme

- **Hôte officiel : `hubeau.eaufrance.fr`**, seul allowlisté. L'hôte de
  recette `hubeau.brgm-rec.fr` existe mais est **délibérément exclu** : ce
  n'est pas la source officielle des données.
- **Licence : Licence Ouverte / Open Licence (Etalab)** — « Les Jeux de
  données sont donc librement et gratuitement utilisables et réutilisables, y
  compris dans un but commercial », l'utilisateur devant « veiller à citer
  l'auteur des Jeux de données ».
- **Éditeurs :** Office français de la biodiversité (OFB), Service Central
  Vigicrues (SCV), Bureau de recherches géologiques et minières (BRGM).
- **Nature :** « données brutes, c'est-à-dire fournies sans retraitement ni
  mise en perspective particulière ».
- **Pagination :** `page` / `size` ; **profondeur d'accès (page × size)
  limitée à 20 000 enregistrements** ; page de 5 000 par défaut, 20 000 max.

### 2.2 Matrice endpoints → connecteurs → métriques

| API | Endpoint utilisé | Connecteur | Identifiant | Métriques | Unité native |
|---|---|---|---|---|---|
| `v2/hydrometrie` | `referentiel/stations` | `hubeau_hydro` | `code_station` | — (référentiel) | — |
| `v2/hydrometrie` | `obs_elab` | `hubeau_hydro` | `code_station` | `hubeau.hydrometrie.debit` | **l/s** |
| `v2/hydrometrie` | `obs_elab` | `hubeau_hydro` | `code_station` | `hubeau.hydrometrie.hauteur` | **mm** |
| `v1/niveaux_nappes` | `stations` | `hubeau_hydro` | `code_bss` | — (référentiel) | — |
| `v1/niveaux_nappes` | `chroniques` | `hubeau_hydro` | `code_bss` | `hubeau.piezometrie.niveau_nappe` | **m NGF** |
| `v1/niveaux_nappes` | `chroniques` | `hubeau_hydro` | `code_bss` | `hubeau.piezometrie.profondeur_nappe` | **m** |
| `v1/prelevements` | `chroniques` | `hubeau_withdrawals_quality` | `code_ouvrage` | `hubeau.prelevements.volume` | **m³** |
| `v2/qualite_rivieres` | `analyse_pc` | `hubeau_withdrawals_quality` | `code_station` | `hubeau.qualite_rivieres.parametre.{code SANDRE}` | `symbole_unite` de la source |

**Piège d'unités, vérifié et volontairement non « corrigé ».** L'hydrométrie
Hub'Eau publie les hauteurs en **millimètres** et les débits en **litres par
seconde** (« mm pour les hauteurs d'eau », « l/s pour les débits »). Les
connecteurs **ne convertissent rien** : l'unité native voyage avec chaque
observation. Une division silencieuse par 1 000 serait exactement l'erreur
d'échelle que le chantier interdit — un test verrouille `1200 l/s → 1200`.

**Piège de sens, vérifié.** `niveau_nappe_eau` (m NGF) et `profondeur_nappe`
(m) varient en **sens opposé** : une nappe qui baisse voit son niveau
diminuer et sa profondeur augmenter. Ce sont deux métriques distinctes, jamais
confondues.

### 2.3 Champs vérifiés — qualité (`analyse_pc`)

`code_station`, `libelle_station`, `code_parametre`, `libelle_parametre`,
`date_prelevement`, `resultat`, `symbole_unite`, `code_remarque`,
`mnemo_remarque`, `code_statut`, `mnemo_statut`, `code_qualification`,
`libelle_qualification`.

Codes SANDRE vérifiés sur le référentiel officiel : **1340 = Nitrates**,
**1339 = Nitrites** — l'allowlist initiale sourcée.

---

## 3. Le socle : aucun client HTTP, et c'est le point clé

`services/water_intelligence/*.py` est sous garde AST permanente
(`TestNoRealNetworkOrDatabase`) : y importer `requests`/`httpx`/`urllib`
casserait la preuve d'absence de réseau pour **tout** le paquet. Le socle
n'en importe donc aucun.

Le transport réel est **injecté** : `Fetcher = Callable[[HubeauHttpRequest],
HubeauHttpResponse]`.

- en test → `Fetcher` scripté en mémoire, **aucun appel possible** ;
- au runtime → aucun `Fetcher` branché, donc aucun appel ;
- côté opérateur → `Fetcher` fourni explicitement par le script de collecte,
  avec la bibliothèque HTTP de son choix. C'est le seul endroit où un octet
  transite réellement.

`HubeauTransport` n'a **aucun `Fetcher` par défaut** : sans injection il ne
peut rien appeler, et un test le prouve (`TypeError`). L'absence d'appel est
structurelle, pas déclarative.

### 3.1 Ce que le socle borne (il décide, le `Fetcher` exécute)

| Borne | Mise en œuvre |
|---|---|
| Hôtes | Allowlist `{hubeau.eaufrance.fr}`, HTTPS seul |
| URL | **Composée** depuis un endpoint déclaré. `HubeauQuery` n'a aucun champ `url` |
| Champ `next` | **Jamais suivi.** Hub'Eau renvoie une URL complète ; la suivre laisserait la réponse choisir la cible. La pagination incrémente `page` localement — testé avec une réponse hostile pointant vers `evil.example.com` |
| Filtre géographique | Obligatoire sur les 6 endpoints déclarés |
| Fenêtre temporelle | Obligatoire sur toute chronique (invariant vérifié sur l'ensemble des endpoints) |
| Paramètres | Allowlist par endpoint ; `page`/`size` interdits à l'appelant |
| Profondeur | `page × size ≤ 20 000` (limite officielle) |
| Volume | Budget de pages (5 par défaut) et d'octets (5 Mo par défaut) |
| Reprise | `page_token` = numéro de page ; une URL en guise de token est refusée |
| Timeout / retry | Timeout explicite, `max_attempts` borné, backoff exponentiel, statuts réessayables limités (429/5xx) — un 4xx n'est **jamais** rejoué |
| Journal | Identité de l'appel (URL, paramètres, statut, taille) — **jamais le contenu reçu** ; redaction de toute valeur dont le nom évoque un secret |

Toutes les erreurs héritent de `TransportError` : `run_pipeline()` les capture
au stage `fetch` et produit un rapport, jamais une exception nue.

---

## 4. Périodes — le `PeriodResolver` de la Wave A, partout

Le contournement Wave A (trimestre encodé dans `metric_code`) est **caduc** et
n'est repris nulle part. Chaque source fournit son résolveur :

| Connecteur | Résolveur | Période produite |
|---|---|---|
| hydrométrie / piézométrie | `hubeau_hydro.build_period_resolver()` | jour d'observation (`period_start == period_end`) |
| prélèvements | `build_withdrawals_period_resolver()` | **année civile entière** (1er janvier → 31 décembre) |
| qualité | `build_quality_period_resolver()` | jour de prélèvement |

Tous lisent la période dans les **métadonnées structurées** du draft, jamais
par parsing d'un libellé. Une période absente ou illisible lève
`PipelineDataUnavailableError` : le draft est écarté et nommé dans le rapport,
jamais complété par une date inventée.

Les `metric_code` sont **stables et sans date** — testé : deux années
partagent le même code de métrique et restent distinctes par leur période.

---

## 5. Invariants métier tenus

### 5.1 Absence de déclaration ≠ zéro (prélèvements)

Fait officiel : « Les volumes prélevés pour des usages exonérés de redevance
ne sont pas connus », et les volumes inférieurs à **10 000 m³** ne sont pas
déclarés. Encodé structurellement :

- un volume non déclaré reste `None` et ne produit **aucune** observation ;
- l'avertissement de couverture est émis à **chaque** collecte, même quand
  tout est déclaré — la limite est structurelle, pas conjoncturelle ;
- `WithdrawalsCoverage` expose `declared_volume_m3`, **jamais**
  `total_volume_m3`, plus `is_complete`. Présenter une somme partielle comme
  « le prélèvement du territoire » serait le mensonge le plus facile ici ; un
  test verrouille le nom du champ.

### 5.2 Aucune interprétation sanitaire (qualité)

- **aucun seuil réglementaire** n'existe dans le connecteur (vérifié par AST) :
  comparer un résultat à une limite juridique exige un contexte (usage, texte,
  période) qui appartient à P13 ;
- aucun classement, aucun score, aucune conclusion de conformité ;
- `code_remarque`, `code_statut`, `code_qualification` sont recopiés
  **verbatim**, avec `remark_vocabulary: unknown` et `interpretation: none` ;
- une valeur censurée est **transportée telle quelle** — jamais remplacée par
  la limite de quantification, ni par 0, ni par la moitié du seuil.

### 5.3 Aucune aspiration de tous les analytes

L'allowlist de paramètres est **obligatoire et non vide** : sans elle, aucune
analyse n'est ingérée. Un paramètre hors allowlist est **refusé** — et non
ignoré en silence : une collecte qui ramène autre chose que le demandé signale
une requête mal bornée, pas une donnée à trier après coup.

### 5.4 Aucune interpolation (hydro/piézo)

Une valeur absente ne produit aucune observation ; elle n'est ni comblée, ni
reportée depuis la mesure précédente. `latest_measurement()` ignore les points
vides plutôt que de renvoyer un « dernier état » sans valeur.

---

## 6. Ce qui reste `unknown` — jamais comblé

1. **Vocabulaire de `code_remarque`** (qualité). Le champ existe et est repris
   verbatim, mais la signification de chaque code n'a pas été vérifiée sur le
   référentiel SANDRE. Le connecteur ne décide donc jamais seul qu'un résultat
   est censuré : les codes censurants sont **déclarés par l'opérateur**, vides
   par défaut, et un avertissement le signale explicitement.
2. **Nom exact du champ de limite de quantification.** Non vérifié :
   `limite_quantification` est lu s'il est présent, jamais exigé, son absence
   n'est pas une erreur.
3. **Qualité des NAPPES** (`qualite_nappes`). Endpoints et champs non
   vérifiés → **hors périmètre de cette vague**, conformément au
   MACRO-PROMPT B (« qualité souterraine seulement si le gate est
   concluant »). Aucun code spéculatif n'est écrit pour elle — un test
   l'interdit.
4. **Licences par jeu de données.** La Licence Ouverte s'applique à la
   plateforme ; le catalogue P01b garde `license_status: unknown` pour les
   entrées Hub'Eau tant qu'une décision explicite n'est pas rendue par jeu.
   Aucun connecteur ne construit de `WaterLicenseDecision` : sans décision de
   l'appelant, tout est `value_withheld`.

---

## 7. Ce qui n'est PAS livré

- aucune donnée publiée sur `/water-intelligence` ;
- aucune modification de `/water`, de `/water-intelligence`, ni du blueprint
  UX/UI (`docs/carbonco/water-intelligence/ux/`) ;
- aucune migration (dernière en base : `043`) ;
- aucun `Fetcher` réel, aucun script de collecte opérateur ;
- aucun `source_registry` réel, aucun graveur Evidence Kernel ;
- aucune qualité des nappes ;
- aucune dépendance nouvelle.

---

## 8. Gestes opérateur

1. Construire une `HubeauQuery` : endpoint déclaré, filtre géographique,
   fenêtre temporelle, taille de page.
2. Fournir un `Fetcher` (bibliothèque HTTP au choix) qui exécute la
   `HubeauHttpRequest` telle quelle et lève `HubeauTimeoutSignal` sur timeout.
3. Instancier `HubeauTransport` avec ses bornes (pages, octets, retry).
4. Appeler `run_pipeline()` avec le normalizer, le `geography_resolver` et le
   `period_resolver` du connecteur visé, plus une `WaterLicenseDecision`
   explicite si publication envisagée.
5. Relire `transport.call_records` — journal sans secret ni contenu.

---

## 9. Validation

| Contrôle | Résultat |
|---|---|
| Tests socle Hub'Eau | 57 |
| Tests hydrométrie/piézométrie | 67 |
| Tests prélèvements/qualité | 61 |
| Tests P03/P03B/P03C, WRI, EEA, Copernicus | inchangés, verts |
| Suite API complète | verte |
| `ruff check . --select=E,F,I --ignore=E501` (invocation CI) | propre |
| Frontend / migration / dépendance / fichier lourd / réseau | aucun |

---

## 10. Passage à Wave C

Wave C (`feat/water-intelligence-wave-c-public-data-product`) construit le
read model public P10, la carte P11 et les contenus P12, en s'appuyant sur le
blueprint UX/UI déjà fusionné (PR #154). Points d'attention hérités :

1. **Identité persistée d'une série temporelle — à trancher avant tout
   graveur.** `ObservationDraft.dedup_key()` retourne `(subject_type,
   subject_key, metric_code)` **sans période**. Wave B produit désormais de
   vraies chroniques : un graveur P10 qui réutiliserait cette clé telle quelle
   écraserait silencieusement toutes les périodes sauf la première. L'identité
   persistée doit inclure explicitement la période, ou être protégée par une
   vérification de collision.
2. **Couverture et absence doivent rester visibles.** L'avertissement BNPE
   (usages exonérés, seuil de 10 000 m³) et les couvertures partielles ne
   doivent jamais être filtrés à l'assemblage : une absence rendue comme un
   zéro serait une régression métier, pas un détail d'affichage.
3. **Unités natives.** Le read model doit porter l/s, mm, m NGF, m et m³ tels
   quels, ou documenter explicitement toute conversion — jamais la faire en
   silence.
4. **Sources exclues du snapshot public** : `COPERNICUS_EDO`
   (`source_verified_decoder_deferred`) et `WRI_AQUEDUCT` (enregistrement non
   effectué). Les deux restent inchangées par la Wave B.
5. **Aucune conclusion de conformité** ne doit apparaître côté public à partir
   des analyses Naïades : le registre juridique est l'affaire de P13.
