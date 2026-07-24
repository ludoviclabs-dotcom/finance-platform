# P03B — Décodeur de page injectable (correction architecturale ciblée)

**Mission :** P03B — correction ciblée du transport Water Intelligence avant P06.
**Branche :** `refactor/water-intelligence-p03b-pluggable-page-decoder`
**Ne lance pas P06.** Cette PR est un refactor technique isolé, pas une mission du prompt pack.

---

## 1. Le problème rencontré en P05

Le pipeline P03 décodait **chaque page en JSON** à l'étape `parse`, sans exception :

```python
def parse(self, raw: bytes) -> Any:
    pages: list[Any] = []
    for index, page_bytes in enumerate(_unframe_pages(raw), start=1):
        pages.append(json.loads(page_bytes.decode("utf-8")))
    return pages
```

Le connecteur WRI Aqueduct (P05) transporte un extrait **CSV**, pas du JSON. Pour traverser le pipeline sans le modifier, ses tests encodaient chaque page CSV comme une **chaîne JSON** :

```python
def _csv_page(text: str) -> bytes:
    return json.dumps(text).encode("utf-8")  # emballage, pas une vraie page JSON
```

`json.loads(json.dumps(text))` renvoie `text` inchangé, donc le normalizer WRI recevait bien la CSV attendue — mais au prix d'un aller-retour JSON inutile sur des octets qui n'ont jamais été du JSON, et d'un `input_checksum` calculé sur l'emballage (`json.dumps(text)`), pas sur la CSV réelle qu'un opérateur peut vérifier localement (`sha256sum extrait.csv`).

Le handoff P05 signalait explicitement cette friction sans y toucher (mission P05 hors périmètre pour modifier P03) :

> « Si d'autres sources tabulaires arrivent en P06-P08, il vaudra la peine d'introduire un décodeur de page enfichable dans P03 plutôt que de répéter cet emballage. »

## 2. Pourquoi corriger avant P06

P06 (EEA/WISE/WEI+) est aussi une **release téléchargée** (`operator_release_download`), vraisemblablement tabulaire comme WRI. Sans correction, P06 aurait soit répété le même emballage JSON (dette qui s'accumule à chaque connecteur tabulaire, P06/P07/P08/P09), soit contourné le pipeline P03 lui-même (rupture de l'ossature commune que P03 existe justement pour fournir). Corriger maintenant, avant d'écrire un deuxième connecteur, évite de choisir entre ces deux mauvaises options.

## 3. La séparation transport / décodage / parsing métier

Trois couches, trois catégories d'échec distinctes et testées comme telles :

| Couche | Rôle | Erreur | Stage pipeline |
|---|---|---|---|
| **Transport** (`pipeline_transport.py`, inchangé) | Assemble des **octets bruts**, page par page. Ne connaît aucune sémantique de contenu. | `TransportError` (HTTP, timeout, corruption signalée par le transport) | `fetch` |
| **Décodage** (`PageDecoder`, nouveau) | Donne un sens aux octets d'UNE page : JSON, texte, ou rien (bytes bruts). | `AdapterError` (page illisible dans le format attendu par CE décodeur) | `parse` |
| **Parsing métier** (propre à chaque connecteur, ex. `parse_baseline_annual_csv`) | Interprète le contenu décodé selon le schéma métier de la source (colonnes attendues, identifiants stables, etc.). | Exception propre au connecteur (ex. `AqueductSchemaError`), levée depuis le `normalizer` | `normalize` |

Le transport ne fait toujours aucune hypothèse sur le contenu (`FetchPage.content` reste des octets nus). Le décodeur est le **seul** point où ces octets reçoivent une sémantique, et il est **toujours injecté explicitement** par l'appelant — jamais choisi automatiquement par extension de fichier ou inspection du contenu, et sans repli en cascade (pas de « essaie JSON, sinon texte, sinon bytes »).

## 4. Ce qui est livré

| Fichier | Changement |
|---|---|
| `apps/api/services/water_intelligence/pipeline.py` | Ajoute `PageDecoder` (Protocol structurel PEP 544), `JsonPageDecoder`, `TextPageDecoder`, `RawBytesPageDecoder`. `TransportAdapter.__init__` accepte `decoder: PageDecoder \| None = None` (défaut `JsonPageDecoder()`) ; `TransportAdapter.parse()` délègue au décodeur injecté. `run_pipeline()` accepte et transmet `decoder`. |
| `apps/api/services/water_intelligence/pipeline_transport.py` | Docstring seulement : précise que le décodage vit désormais dans `pipeline.py`, aucun changement fonctionnel. |
| `apps/api/services/water_intelligence/connectors/wri_aqueduct.py` | Ajoute `PAGE_DECODER = TextPageDecoder()` (constante de module, comme `METHOD`). Aucun changement à `build_normalizer`/`parse_baseline_annual_csv` : le normalizer attendait déjà une page `str`, ce que `TextPageDecoder` fournit directement. |
| `apps/api/tests/test_water_intelligence_pipeline.py` | +20 tests : comportement JSON inchangé (implicite/explicite), `TextPageDecoder`/`RawBytesPageDecoder` unitaires, absence de repli automatique, intégration pipeline complète (pagination/limite/reprise/corruption transport avec un décodeur non-JSON), distinction décodage vs erreur métier, décodeur custom sans sous-classement. 41 tests au total (21 inchangés + 20 nouveaux). |
| `apps/api/tests/test_water_intelligence_wri_aqueduct.py` | Supprime `_csv_page()` (l'emballage JSON). `_run_with_licence()` et `test_unknown_source_code_is_refused_by_the_plan_stage` transportent désormais `text.encode("utf-8")` directement et passent `decoder=wri.PAGE_DECODER`. +3 tests prouvant l'absence d'emballage JSON. 60 tests au total (57 inchangés + 3 nouveaux). |

### Formats supportés

- **`JsonPageDecoder`** (défaut, rétrocompatible) — chaque page est un document JSON en UTF-8. Comportement byte-pour-byte identique à l'ancien `parse()` figé : mêmes messages d'erreur (`"page {n} : JSON invalide (...)"`), même stage d'échec (`parse`).
- **`TextPageDecoder(encoding="utf-8")`** — décode en texte, encodage **explicite** (UTF-8 par défaut, jamais deviné). Pour CSV/TSV ou tout format tabulaire transporté tel quel.
- **`RawBytesPageDecoder`** — ne décode rien, renvoie les octets tels quels. Pour un normalizer qui sait interpréter des octets bruts (binaire) directement.

## 5. Ce qui reste hors périmètre

- **Aucun nouveau connecteur, aucune donnée réelle, aucun appel réseau.** Cette PR ne touche que le transport/décodage du pipeline P03 et l'adaptation du connecteur WRI existant.
- **Aucune détection automatique de format.** Pas de choix par extension de fichier, par en-tête MIME ou par inspection du contenu (« sniffing ») — le connecteur choisit toujours son décodeur explicitement. Pas de registre ni de plugin framework.
- **`/water` et `/water-intelligence` non touchés.** Aucun fichier frontend, aucune migration, aucune route, aucune API.
- **`.gitleaks.toml` non touché.**
- **La décision de licence WRI Aqueduct n'est pas modifiée** (voir `handoffs/P05_WRI_AQUEDUCT.md` §1.3 — enregistrement WRI toujours non effectué, publication publique toujours bloquée).
- **P06 n'est pas lancé.** `PROJECT_STATE.yaml`/`CURRENT_TASK.md` restent sur P06 comme mission active après cette PR.

### Observation hors périmètre — **corrigée depuis par P03C**

En vérifiant le trajet d'erreur du stage `normalize`, `TransportAdapter.normalize()` appelle le `normalizer` du connecteur sans capturer d'exception ; seul `run_pipeline()` capture `AdapterError` autour de `adapter.normalize(parsed)`. Un connecteur qui lève une exception **n'héritant pas** d'`AdapterError` depuis son normalizer (c'était le cas de `AqueductSchemaError` du connecteur WRI, qui héritait d'`AqueductError(Exception)`) voyait cette exception remonter **nue** hors de `run_pipeline()` — violation de l'invariant « toujours un rapport » documenté dans `pipeline.py`.

Ce comportement, antérieur à P03B (présent dès P03/P05, non corrigé par cette PR à l'époque), a été corrigé par `fix/water-intelligence-p03c-connector-error-boundary` (P03C) : `AqueductError` hérite désormais d'`AdapterError`, et le contrat « toute erreur métier attendue d'un connecteur doit hériter d'`AdapterError` » est désormais documenté pour P06-P09. Détail complet : `handoffs/P03C_CONNECTOR_ERROR_BOUNDARY.md`.

## 6. Comment P06–P09 choisiront leur décodeur

1. Regarder le format réel de la release une fois téléchargée par l'opérateur (JSON, CSV/texte, binaire).
2. Choisir le décodeur correspondant : `JsonPageDecoder()` (défaut, à ne même pas préciser), `TextPageDecoder(encoding=...)` pour du texte/tabulaire, ou `RawBytesPageDecoder()` pour du binaire déjà géré par le normalizer.
3. Exposer ce choix comme une constante ou une fonction du connecteur (voir `wri_aqueduct.PAGE_DECODER`), au même niveau que `build_normalizer`/`build_geography_resolver`.
4. Le passer explicitement à `run_pipeline(decoder=...)` — jamais de détection automatique.
5. Si un format non couvert par les trois décodeurs fournis apparaît (ex. XML), écrire un objet exposant `decode(page_bytes, *, page_index) -> Any` (le Protocol est structurel — aucun sous-classement requis) plutôt que d'étendre les trois décodeurs existants avec des branches conditionnelles.

## 7. Compatibilité avec les connecteurs existants

Aucun connecteur autre que WRI Aqueduct n'existe à ce jour. La compatibilité vérifiée :

- **Défaut inchangé.** Tout appel à `run_pipeline()`/`TransportAdapter(...)` sans `decoder` continue de décoder chaque page en JSON, avec les mêmes messages d'erreur et le même stage d'échec qu'avant P03B (`TestJsonPageDecoderUnchanged`, 3 tests, dont un comparant bit à bit un rapport avec décodeur implicite vs explicite).
- **WRI Aqueduct adapté sans changement de règle métier.** `parse_baseline_annual_csv`, la sentinelle `-9999`, les identifiants stables, la licence et l'attribution sont strictement inchangés. Seul le trajet **transport** change : la CSV voyage en octets UTF-8 directs au lieu d'une chaîne JSON échappée.
- **Checksum d'entrée plus fidèle.** `input_checksum` porte désormais sur les octets CSV réellement transportés (via le framing longueur-préfixée existant, `_frame_pages`), et non plus sur leur emballage JSON — vérifié par un test dédié comparant `report.input_checksum` à un SHA-256 calculé indépendamment sur les mêmes octets.

## 8. Validation exécutée

```
python -m pytest tests/test_water_intelligence_pipeline.py -q       → 41 passed
python -m pytest tests/test_water_intelligence_wri_aqueduct.py -q   → 60 passed
python -m ruff check <fichiers modifiés> --select=E,F,I --ignore=E501  → All checks passed!
python -m pytest -q (suite complète apps/api)                       → 1159 passed, 714 skipped
```

Aucun fichier frontend (`apps/carbon`), aucune migration, aucune route/API, aucun fichier volumineux touché — confirmé par `git diff --stat` (voir message de PR).
