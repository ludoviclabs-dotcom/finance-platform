# Water Intelligence — Journal de décisions

Décisions actées au démarrage du chantier, avant l'exécution de P00.

- `/water` reste le cockpit authentifié existant.
- `/water-intelligence` devient la surface publique.
- Aucun appel externe au runtime.
- Evidence Kernel comme registre unique.
- Aucune donnée inventée.
- Une source ou famille de source par PR.
- Pas de migration sans besoin démontré.

## 2026-07-23 — Clôture P00 / préparation P01

- Le fichier `WATER_SOURCE_REGISTRY_SEED_V1.csv` contient 16 lignes de données au total : 12 d'origine `user_csv` (fournies telles quelles par l'opérateur) et 4 d'origine `recommended_addition` (WRI Aqueduct, EEA/WEI+, Copernicus EDO, USGS).
- Le registre normalisé produit par P01 doit couvrir les 16 entrées, sans jamais faire croire que le CSV opérateur initial ne comptait que 12 lignes.
- La distinction entre les deux origines reste explicite dans le registre normalisé (champ d'origine ou équivalent), jamais fusionnée silencieusement.

## 2026-07-24 — P03B : décodage de page injectable avant P06

- Le stage `parse` du pipeline P03 décodait toute page en JSON sans exception, ce qui a forcé P05 (connecteur WRI Aqueduct, CSV) à emballer sa charge tabulaire comme chaîne JSON pour traverser le pipeline. Corrigé avant P06 (également une release téléchargée) par `refactor/water-intelligence-p03b-pluggable-page-decoder` : décodage rendu injectable (`PageDecoder`/`JsonPageDecoder`/`TextPageDecoder`/`RawBytesPageDecoder`), JSON restant le défaut rétrocompatible. Détail : `handoffs/P03B_PLUGGABLE_PAGE_DECODER.md`.
- Décision de périmètre : le connecteur choisit toujours son décodeur explicitement (paramètre `decoder` de `run_pipeline`) — aucune détection automatique par extension ou contenu, aucun registre de décodeurs.
- Un écart préexistant a été observé sans être corrigé (hors périmètre P03B) : `TransportAdapter.normalize()` ne capture que les erreurs héritant d'`AdapterError` ; l'exception `AqueductSchemaError` du connecteur WRI n'en hérite pas et remonterait nue si elle survenait via `run_pipeline`. Aucun test existant ne l'exerce. Signalé dans `handoffs/P03B_PLUGGABLE_PAGE_DECODER.md` §5 pour arbitrage humain, pas corrigé silencieusement.

## 2026-07-24 — P03C : frontière d'erreur des connecteurs sécurisée avant P06

- L'écart signalé en P03B est corrigé par `fix/water-intelligence-p03c-connector-error-boundary` : `AqueductError` hérite désormais d'`AdapterError` (au lieu de `Exception` directement), donc `AqueductSchemaError`/`AqueductReleaseError` sont capturées par `run_pipeline()` au stage `normalize` — plus d'exception nue pour une erreur métier attendue d'un connecteur. Aucune règle métier, licence ou comportement WRI modifiés. Détail : `handoffs/P03C_CONNECTOR_ERROR_BOUNDARY.md`.
- Contrat documenté pour P06-P09 : toute erreur métier attendue (format/schéma/contenu) levée dans `parse`/`normalize` doit hériter d'`AdapterError`. Les erreurs de transport restent des `TransportError` ; les erreurs de limites/plan restent des `PipelineError`.
- Décision de périmètre : la garantie « toujours un rapport » du pipeline est scopée explicitement aux erreurs ATTENDUES (`PipelineError`/`TransportError`/`AdapterError`). Un bug de programmation (`ValueError`, `TypeError`, etc.) n'est volontairement PAS intercepté — il remonte nu, pour ne jamais masquer un défaut de code derrière un rapport d'exécution normal. Aucun `except Exception`/`except BaseException` ajouté.
- Un deuxième écart, distinct et non corrigé, a été observé et documenté (hors périmètre P03C, ciblée sur `parse`/`normalize`) : le `geography_resolver` du connecteur WRI (stage `derive`) lève `AqueductSchemaError` pour une géographie inconnue, alors que le contrat P03 établi exige `PipelineDataUnavailableError`. Non exercé en pratique (chaque draft WRI porte toujours un code résolvable par le résolveur construit à partir des mêmes lignes). Signalé dans `handoffs/P03C_CONNECTOR_ERROR_BOUNDARY.md` §6 pour arbitrage humain.
