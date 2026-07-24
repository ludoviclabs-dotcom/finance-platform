# P03C — Frontière d'erreur des connecteurs Water Intelligence

**Mission :** P03C — correction ciblée de la frontière d'exception du pipeline avant P06.
**Branche :** `fix/water-intelligence-p03c-connector-error-boundary`
**Ne lance pas P06.** Cette PR est un correctif technique isolé, pas une mission du prompt pack.

---

## 1. Le défaut découvert en P03B

En documentant P03B (décodeur de page injectable), l'inspection du trajet d'erreur du stage `normalize` a révélé un écart entre le contrat promis et le code :

> « Toute erreur métier attendue d'un connecteur, levée pendant `parse` ou `normalize`, doit produire un `PipelineExecutionReport` — jamais une exception nue. »

Or `TransportAdapter.normalize()` appelle le `normalizer` du connecteur sans capturer d'exception ; seul `run_pipeline()` capture `AdapterError` autour de `adapter.normalize(parsed)` :

```python
try:
    drafts = adapter.normalize(parsed)
    ...
except AdapterError as exc:
    failed.append("normalize")
    ...
```

Le connecteur WRI Aqueduct lève `AqueductSchemaError` (schéma CSV invalide) ou `AqueductReleaseError` (extrait vide) depuis son normalizer (`build_normalizer`). Ces deux classes héritaient de `AqueductError(Exception)` — **pas** d'`AdapterError`. Le `except AdapterError` ne les interceptait donc pas : une CSV WRI au schéma invalide, passée par `run_pipeline()`, aurait fait remonter `AqueductSchemaError` **nue**, hors de la fonction — violation directe de l'invariant « toujours un rapport ».

P03B avait signalé ce défaut sans le corriger (hors périmètre de cette PR, ciblée sur le décodage de page) et recommandé un arbitrage humain avant P06. C'est l'objet de P03C.

## 2. Cause exacte

Une hiérarchie d'exceptions à deux racines indépendantes :

```
Exception
├── AdapterError                    (services/intelligence/adapters/base.py, PR-04)
└── AqueductError                   (connectors/wri_aqueduct.py, P05)
    ├── AqueductSchemaError
    └── AqueductReleaseError
```

`run_pipeline()` ne connaît et ne capture qu'`AdapterError` (et `PipelineError`/`TransportError` aux stages appropriés). Un connecteur qui définit sa propre racine d'exception, sans la rattacher à `AdapterError`, échappe silencieusement à cette capture — pas par une faute du pipeline P03 en tant que tel, mais par absence de contrat explicite liant les deux hiérarchies.

## 3. Hiérarchie retenue

```
Exception
├── PipelineError            → plan, limites (fetch)         — inchangé
├── TransportError            → transport (fetch)              — inchangé
└── AdapterError              → décodage de page (parse),
                                 contenu/schéma métier (normalize)
    └── AqueductError          (P05, désormais un AdapterError)
        ├── AqueductSchemaError
        └── AqueductReleaseError
```

Changement unique et minimal : `class AqueductError(Exception)` → `class AqueductError(AdapterError)`, dans `connectors/wri_aqueduct.py`. Aucun changement à `AqueductSchemaError`, `AqueductReleaseError`, leurs messages, ou leur comportement hors pipeline (construction directe d'une `AqueductReleaseConfig`, appel direct à `parse_baseline_annual_csv`, etc. — tous inchangés, testés en §7).

`services/intelligence/adapters/base.py` n'est **pas modifié** : `AdapterError` reste une exception générique, sans connaissance du connecteur WRI.

## 4. Séparation transport / décodage / parsing métier / normalisation / pipeline

Reprise et complétée depuis `handoffs/P03B_PLUGGABLE_PAGE_DECODER.md` §3 :

| Couche | Rôle | Erreur | Stage pipeline | Capturée par `run_pipeline` |
|---|---|---|---|---|
| Plan | Résolution du `source_code` dans le catalogue P01b | `PipelineError` (`PipelineUnknownSourceError`, `PipelineDataUnavailableError`) | `plan` | Oui |
| Limites | Pages/octets bornés | `PipelineLimitExceeded` (sous-classe de `PipelineError`) | `fetch` | Oui |
| Transport | Octets bruts, page par page, sans sémantique | `TransportError` (et sous-classes) | `fetch` | Oui |
| Décodage | `PageDecoder` — JSON/texte/bytes bruts | `AdapterError` | `parse` | Oui |
| Parsing métier + normalisation | Interprétation du contenu décodé selon le schéma d'UNE source (ex. `parse_baseline_annual_csv`), appelée depuis le `normalizer` du connecteur | `AdapterError` (désormais, y compris `AqueductError` et ses sous-classes) | `normalize` | **Oui (corrigé par P03C)** |
| Dérivation | `geography_resolver` d'un connecteur | `PipelineDataUnavailableError` (contrat P03 §5, **inchangé**) | `derive` | Oui, pour CE type précisément (voir §6) |

## 5. Contrat imposé aux connecteurs P06-P09

> Toute erreur ATTENDUE liée au format, au schéma ou au contenu d'une source, et susceptible d'être levée dans les étapes `parse`/`normalize`, doit hériter d'`AdapterError`. Les erreurs de transport restent des `TransportError`. Les erreurs de limites ou de plan restent des `PipelineError`.

Concrètement, pour un futur connecteur :

1. Définir sa propre racine d'erreur en héritant directement d'`AdapterError` (comme `AqueductError` désormais), pas de `Exception` nu.
2. Les sous-classes métier (schéma invalide, release vide, valeur illisible, etc.) héritent de cette racine — elles restent aussi précises et nommées qu'aujourd'hui.
3. Le `geography_resolver` d'un connecteur reste soumis au contrat P03 préexistant (§6 ci-dessous) : il doit lever `PipelineDataUnavailableError`, pas une exception propre au connecteur.
4. Aucune capture supplémentaire à ajouter côté connecteur : `run_pipeline()` capture déjà `AdapterError` aux bons stages — hériter correctement suffit.

## 6. Ce que P03C NE corrige PAS (limite de portée délibérée)

L'inspection a révélé une **deuxième** occurrence de la même famille de problème, à un autre stage, non couverte par cette PR :

`derive_observations()` n'intercepte que `PipelineDataUnavailableError` autour de l'appel à `geography_resolver` :

```python
try:
    geography = geography_resolver(draft.geography_code)
except PipelineDataUnavailableError as exc:
    ...
```

Si un `geography_resolver` de connecteur levait une autre exception — y compris désormais `AdapterError`/`AqueductError` — elle remonterait nue depuis `derive_observations()`, puisque `run_pipeline()` n'entoure pas non plus cet appel d'un `try/except`.

**Ce cas est différent de celui corrigé en §3** : le contrat `geography_resolver` est établi depuis P03 (`handoffs/P03_INGESTION_PIPELINE.md` §5) et exige explicitement `PipelineDataUnavailableError` — pas une exception propre au connecteur. Le connecteur WRI Aqueduct (`build_geography_resolver`) lève aujourd'hui `AqueductSchemaError` pour une géographie inconnue, ce qui **ne respecte pas ce contrat préexistant**. En pratique, ce chemin n'est actuellement jamais emprunté : chaque `ObservationDraft` WRI porte un `geography_code` tiré des mêmes lignes que celles utilisées pour construire le résolveur (`build_geography_resolver(parsed.rows)`), donc toujours résolvable dans l'usage documenté. Aucun test existant, avant ou après cette PR, n'exerce ce chemin via `run_pipeline()`.

Corriger ce point impliquerait de modifier le connecteur WRI (`build_geography_resolver`, pour respecter le contrat `PipelineDataUnavailableError` existant) — **hors périmètre de P03C**, qui porte exclusivement sur la frontière `parse`/`normalize` demandée. Documenté ici pour arbitrage humain avant P06 ou une future PR dédiée, avec deux tests de non-régression qui figent le comportement actuel (`TestGeographyResolverErrorBoundaryIsUnchanged`, `test_water_intelligence_pipeline.py`) : `PipelineDataUnavailableError` reste capturée à `derive` ; `AdapterError` levée par un `geography_resolver` ne l'est toujours pas.

## 7. Portée réelle de la garantie « toujours un rapport »

Le docstring de module (`pipeline.py`) et celui de `run_pipeline()` affirmaient auparavant, sans nuance, que le pipeline ne laisse jamais remonter d'exception nue. C'était trop absolu et ne correspondait ni au code (le défaut du §1) ni à une intention réaliste : un bug de programmation véritable (`ValueError`, `TypeError`, `KeyError`, `AttributeError`…) ne doit **pas** être avalé silencieusement par un rapport qui aurait l'air normal — cela masquerait le défaut plutôt que de le signaler.

**Stratégie retenue (une seule, cohérente, documentée) :** la garantie « toujours un rapport » est désormais explicitement **scopée aux erreurs ATTENDUES** — `PipelineError`, `TransportError`, `AdapterError`, et leurs sous-classes. Toute autre exception (bug de programmation) N'EST PAS interceptée et remonte nue, volontairement. Aucun `except Exception` ni `except BaseException` n'a été ajouté nulle part dans le pipeline. `KeyboardInterrupt`/`SystemExit`/`GeneratorExit` ne sont — et n'ont jamais été — capturées.

Pourquoi cette stratégie plutôt qu'une capture large :
- Elle correspond à l'esprit du chantier (« jamais un échec silencieux », `DECISION_LOG.md`) : un rapport qui absorbe un `TypeError` sans distinction perdrait la trace de la cause réelle (traceback) au profit d'un message générique dans `errors`, rendant le débogage plus difficile, pas plus sûr.
- Elle évite qu'un futur connecteur non conforme (qui ne respecterait pas le contrat §5) voie ses bugs de programmation silencieusement transformés en « échecs métier normaux » plutôt que détectés en test/CI.
- Elle est vérifiable simplement (voir §8) : une exception hors des trois familles attendues doit systématiquement provoquer l'échec du test/de l'appelant, jamais un rapport silencieux.

## 8. Erreurs volontairement non capturées

- Toute exception qui n'hérite pas de `PipelineError`, `TransportError` ou `AdapterError` (ex. `ValueError`, `TypeError`, `KeyError`, `AttributeError` levées par un normalizer, un `PageDecoder` custom, ou un bug interne à `pipeline.py`).
- `KeyboardInterrupt`, `SystemExit`, `GeneratorExit` — jamais capturées, comme avant cette PR (aucune capture large n'a été ajoutée).
- Une exception levée par un `geography_resolver` autre que `PipelineDataUnavailableError` (voir §6 — limite de portée délibérée, distincte du cas corrigé).

## 9. Ce qui est livré

| Fichier | Changement |
|---|---|
| `apps/api/services/water_intelligence/connectors/wri_aqueduct.py` | `AqueductError(Exception)` → `AqueductError(AdapterError)`. Import d'`AdapterError` ajouté. Aucune règle métier modifiée. |
| `apps/api/services/water_intelligence/pipeline.py` | Docstrings uniquement (module, `run_pipeline`, `derive_observations`) : scope précisément la garantie « toujours un rapport » et documente la limite de portée du stage `derive`. **Aucun changement de code exécutable.** |
| `apps/api/services/intelligence/adapters/base.py` | Inspecté, non modifié. |
| `apps/api/tests/test_water_intelligence_pipeline.py` | +6 tests : `AdapterError` custom capturée à `normalize` ; `ValueError`/`TypeError` d'un normalizer et d'un `PageDecoder` custom remontent nues ; `PipelineDataUnavailableError` toujours capturée à `derive` ; `AdapterError` d'un `geography_resolver` toujours non capturée à `derive` (documente §6). 47 tests au total. |
| `apps/api/tests/test_water_intelligence_wri_aqueduct.py` | +4 tests : compatibilité `AqueductError`/`AqueductSchemaError`/`AqueductReleaseError` avec `AdapterError` ; CSV à schéma invalide et extrait vide via `run_pipeline()` échouent proprement à `normalize` (rapport, pas d'exception, `derive`/`validate`/`publish` non exécutés) ; comportement hors pipeline inchangé. 64 tests au total. |

## 10. Ce qui reste hors périmètre

- Aucun nouveau connecteur, aucune règle métier WRI, aucune licence ni décision d'enregistrement WRI modifiées.
- Aucun appel réseau, aucune migration, aucune table, aucune API, aucune UI.
- `/water` et `/water-intelligence` non touchés. `.gitleaks.toml` non touché.
- La correction du `geography_resolver` WRI (§6) — signalée, non corrigée.
- P06 non lancé. `active_prompt`/`CURRENT_TASK.md` restent sur P06.

## 11. Tests apportés — synthèse

| # | Exigence | Test |
|---|---|---|
| 1 | `AqueductSchemaError` compatible `AdapterError` | `test_aqueduct_error_hierarchy_is_compatible_with_adapter_error` |
| 2 | CSV WRI invalide via `run_pipeline()` : rapport propre, `normalize` échoué, message explicite, derive/validate/publish non exécutés | `test_invalid_schema_csv_through_pipeline_fails_cleanly_at_normalize`, `test_empty_extract_through_pipeline_also_fails_cleanly_at_normalize` |
| 3 | Erreur de release WRI hors pipeline inchangée | `test_release_error_outside_pipeline_keeps_its_own_behaviour` |
| 4 | Erreur `PageDecoder` classée `parse` | Couverture P03B inchangée (`test_decode_error_is_distinct_from_business_normalizer_error` etc.) |
| 5 | `TransportError` classée `fetch` | Couverture P03/P03B inchangée |
| 6 | `PipelineLimitExceeded` classée `fetch` | Couverture P03/P03B inchangée |
| 7 | Checksums/idempotence WRI inchangés | Couverture P05 (`TestDeterminism`) inchangée |
| 8-9 | Aucun réseau, aucune écriture base | `TestNoNetworkNoDatabase`/`TestNoRealNetworkOrDatabase` (AST) inchangées |
| 10 | Suites P03/P03B/P05 toujours vertes | 47 + 64 tests (voir §12) |
| 11 | Suite API complète sans régression | 1169 passed, 714 skipped |
| — | Frontière attendue/inattendue (au-delà des 11 exigences, découlant du §7) | `TestConnectorAdapterErrorIsAlwaysCaught`, `TestUnexpectedErrorsPropagateRaw`, `TestGeographyResolverErrorBoundaryIsUnchanged` |

## 12. Validation exécutée

```
python -m pytest tests/test_water_intelligence_pipeline.py -q       → 47 passed
python -m pytest tests/test_water_intelligence_wri_aqueduct.py -q   → 64 passed
python -m ruff check <fichiers modifiés> --select=E,F,I --ignore=E501  → All checks passed!
python -m pytest -q (suite complète apps/api)                       → 1169 passed, 714 skipped
```

Aucun fichier frontend (`apps/carbon`), aucune migration, aucune route/API, aucun fichier volumineux touché — confirmé par `git diff --stat` (voir message de PR).
