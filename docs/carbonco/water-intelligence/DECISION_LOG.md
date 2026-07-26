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

## 2026-07-24 — Wave A : connecteurs européens (P06 + P09)

Détail complet : `handoffs/WAVE_A_EU_CONNECTORS.md`.

- **A1 — écart P03C §6 corrigé.** Le préflight Wave A a confirmé l'écart signalé en P03C : le `geography_resolver` du connecteur WRI levait `AqueductSchemaError` pour une géographie inconnue, type que `derive_observations()` ne capture pas — l'exception serait remontée nue hors de `run_pipeline()`. Corrigé par `AqueductGeographyUnavailableError(PipelineDataUnavailableError)`, qui n'hérite volontairement PAS d'`AdapterError` : les deux familles d'erreurs restent distinctes, un même échec n'est jamais capturable à deux stages différents. Aucune règle métier, licence ou décision d'enregistrement WRI modifiée. Le même contrat est appliqué d'emblée au connecteur EEA.
- **EEA WEI+ — aucune moyenne inter-bassins.** Le WEI+ est un ratio (consommation / ressource renouvelable). En faire la moyenne arithmétique entre unités spatiales supposerait une pondération par les volumes, que la release ne publie pas. L'agrégat UE est donc une **distribution de comptes** (unités totales / renseignées / non renseignées / au-dessus de chaque seuil) plus la couverture, jamais une valeur moyenne. Un test interdit tout champ `mean`/`avg`/`average`.
- **EEA WEI+ — format canonique et geste opérateur.** Le vocabulaire d'en-tête du classeur officiel n'a pas pu être vérifié (seul le champ de jointure `spatialUnitIdentifier` est documenté). Plutôt que de deviner des noms de colonnes, le connecteur définit un format tabulaire canonique explicite et la conversion depuis le classeur reste un geste opérateur documenté — même traitement qu'en P05 pour le conteneur WRI.
- **EEA WEI+ — aucun libellé repris.** Le `label` d'une géographie est l'identifiant lui-même : les libellés officiels des unités spatiales n'ont pas été vérifiés, et n'en reprendre aucun rend une jointure par nom structurellement impossible.
- **Copernicus EDO — blocage assumé, décodage raster refusé.** Le portail officiel ne distribue que GeoTIFF et NetCDF ; aucun export tabulaire n'existe. Les décoder exigerait GDAL/rasterio ou netCDF4/h5py/xarray, dépendances lourdes qu'aucun ADR n'autorise, et aucun paramétrage WMS/WCS n'a pu être vérifié. Conformément à la consigne P09, la vague livre le gate de source, la configuration de snapshot, le contrat, les fixtures et les tests, et **refuse explicitement de produire une valeur** (`EdoRasterDecodingUnavailableError` au stage `normalize`, rapportée par le pipeline). Aucune couche raster n'est simulée. Trois voies ouvertes pour débloquer, arbitrage humain requis : ADR + dépendance raster, vérification d'un service WMS/WCS officiel, ou renoncement documenté.
- **Copernicus EDO — licence non assimilée à du Creative Commons.** L'accès CEMS est « free, full and open » au titre du règlement (UE) 2021/696, avec des libellés d'attribution imposés. Le présenter comme du CC BY serait faux ; un test l'empêche.
- **Limite P03 constatée en revue de PR — RÉSOLUE dans le commit de clôture ci-dessous.** `derive_observations()` fixait `period_start == period_end` sans jamais recopier les métadonnées du draft : une période trimestrielle ne pouvait pas être portée telle quelle par le read model P02. Voir l'entrée du 2026-07-24 (clôture) ci-dessous.
- **Catalogue mis à jour avec les seuls faits vérifiés** : licence et domaine officiels renseignés pour `EEA_WEI_PLUS` (CC-BY-4.0, eea.europa.eu) et `COPERNICUS_EDO` (accès libre CEMS, drought.emergency.copernicus.eu). Ce qui n'a pas été vérifié reste `unknown`.

## 2026-07-24 — Wave A, commit de clôture : périodes explicites + décision MVP Copernicus

Revue humaine de la PR #153 a demandé de clore deux arbitrages avant fusion.
Détail complet, audit d'identité temporelle inclus :
`handoffs/WAVE_A_EU_CONNECTORS.md` §5-6.

- **Audit d'identité temporelle mené avant toute modification** (`ObservationDraft`/`dedup_key()`, `snapshot_migration.py`, schéma SQL `observations` — migration 028, `WaterMetricObservation`, `derive_observations()`, connecteur EEA, tests d'idempotence existants). Constat central : `ObservationDraft.dedup_key()` (`services/intelligence/adapters/base.py`, contrat PR-04 partagé avec l'import `/materials`) retourne `(subject_type, subject_key, metric_code)` **sans période** — hypothèse valide pour `/materials` (un point de prix courant par matière) mais fausse pour une série saisonnière. Le schéma SQL, lui, **n'est pas** le goulot d'étranglement : aucune contrainte `UNIQUE` ne bloque plusieurs `observed_at` pour un même `(subject_type, subject_key, metric_code)`, et l'index `idx_observations_subject` existe précisément pour l'historique multi-période. **Conclusion : aucune migration nécessaire**, correction 100 % Python.
- **`PeriodResolver` injectable ajouté** à `derive_observations()`/`run_pipeline()` (`Callable[[ObservationDraft], tuple[date, date]]`), avec le même contrat d'erreur que `geography_resolver` : une erreur ATTENDUE lève `PipelineDataUnavailableError`, capturée et nommée dans le rapport ; toute autre exception remonte nue. Résolveur par défaut **rétrocompatible** (`period_start == period_end == observed_at.date()`) — comportement de WRI strictement inchangé, vérifié par un test dédié. `derive_observations()` vérifie en outre `period_start <= period_end` de façon générique, indépendamment du résolveur branché.
- **Connecteur EEA — `metric_code` redevenu stable.** `build_period_resolver()` lit `year`/`quarter` dans les métadonnées STRUCTURÉES du draft (jamais un parsing de libellé humain) et retourne les bornes officielles du trimestre. `metric_code(scale, facet)` perd son paramètre `quarter` : deux trimestres d'une même unité partagent désormais le même code et restent distincts par leur période — vérifié par un test dédié (candidats distincts, aucune collision, idempotence confirmée en rejouant `derive_observations()`).
- **Risque documenté, non corrigé (hors périmètre Wave A) : `ObservationDraft.dedup_key()` ne doit jamais être réutilisée telle quelle pour une métrique saisonnière/temporelle.** C'est un fichier PR-04 partagé (`services/intelligence/adapters/base.py`), pas un fichier Water Intelligence — le modifier engagerait `/materials` sans validation de cette PR. Consigné comme risque explicite (`RISK_REGISTER.md`) à l'attention du futur graveur Evidence Kernel P10 : la clé d'idempotence réelle devra inclure `(period_start, period_end)` ou l'équivalent.
- **Décision MVP Copernicus formalisée : `source_verified_decoder_deferred`.** Statut exposé comme constante testée (`connectors/copernicus_edo.py::CONNECTOR_STATUS`), ni un échec de source ni une source vivante — l'identité est vérifiée, le décodage est reporté par décision explicite. Aucune dépendance GDAL/rasterio/netCDF4/xarray ajoutée, aucun endpoint WMS/WCS deviné, aucune couche simulée, aucune valeur Copernicus publiée (vérifié par AST, pas par recherche de sous-chaîne — une recherche naïve matcherait aussi la docstring qui explique le blocage). `COPERNICUS_EDO` reste exclu du snapshot public P10 jusqu'à une ADR dédiée. Consigné dans `PROJECT_STATE.yaml` (bloc `sources`), `RISK_REGISTER.md` et les deux handoffs P09/Wave A.
- **Aucune migration, aucun fichier raster, aucune dépendance ajoutée, aucun frontend, aucune route touchés par ce commit.** WRI et P03/P03B/P03C restent verts sans modification de comportement.

## 2026-07-25 — Wave C : produit public (P10 + P11 + P12)

Détail complet : `handoffs/WAVE_C_PUBLIC_DATA_PRODUCT.md`.

- **Identité temporelle propre à Water Intelligence.** `ObservationDraft.dedup_key()` ne porte pas la période ; réutilisée pour une chronique, elle écraserait silencieusement toutes les périodes sauf la première. Wave C crée `WaterObservationIdentity` (période, géographie, scénario, horizon inclus) plutôt que de modifier le contrat PR-04 partagé avec `/materials` — dont les suites restent vertes, et qu'un test AST vérifie ne jamais être référencé par le nouveau module.
- **Méthode et version EXCLUES de l'identité — décision tranchée et documentée.** Une release est immuable : à l'intérieur d'une même `release_key`, un même fait recalculé avec une autre méthode est une incohérence, pas un fait nouveau. Les inclure la ferait taire (deux identités cohabiteraient sans signal) ; les exclure la fait remonter comme collision explicite. Entre releases, `release_key` diffère déjà.
- **Aucune collision silencieuse.** Le ledger distingue trois cas : identité inconnue (enregistrée), identité connue avec contenu identique (rejeu idempotent), identité connue avec contenu différent (erreur explicite). Jamais de « première valeur gagnante ».
- **Le gate licence exige une décision HUMAINE, pas une licence permissive.** Identifier la Licence Ouverte Etalab pour Hub'Eau ou CC BY 4.0 pour l'EEA ne rend rien publiable. Un registre de décisions matérialise l'étape : `approved` exige `reviewed_by` ET `reviewed_on` — une signature manquante n'est pas une signature ; `proposed` reste inactive ; l'absence de décision exclut par défaut. `unknown` n'existe pas comme statut autorisant.
- **Conséquence assumée : le snapshot public est VIDE.** Aucune source n'est approuvée. Plutôt que d'affaiblir le contrat P02 (qui impose au moins une source — un manifest vide ne décrirait rien), Wave C ajoute `WaterPublicSnapshot`, qui porte le manifest seulement s'il y a quelque chose à décrire et porte toujours exclusions, décisions, budgets et couverture. Un snapshot vide est donc un objet valide et informatif, testé comme tel et rendu honnêtement par l'interface.
- **WRI et Copernicus explicitement exclus, avec motif inscrit dans le snapshot.** Une source écartée sans mention donnerait une fausse impression d'exhaustivité.
- **Double barrière licence.** Une source autorisée ne rend pas publiable une observation dont `allow_display` est faux — le blueprint l'exigeait : « l'UI ne doit jamais être le dernier rempart ».
- **Contenus éditoriaux : le contenant est livré, aucun contenu ne l'est.** Un record exige source, date de revue et réviseur identifié ; aucun humain n'a rédigé ni revu de contenu. Écrire des textes plausibles signés d'un réviseur fictif aurait produit exactement le faux que le chantier interdit.
- **La carte n'est pas montée faute de couche publiée**, et l'écran explique pourquoi : un fond de carte laisserait croire à une couverture nulle plutôt qu'à une absence de publication. Décision reprise de `ConcentrationChoropleth`.
- **Le bloc P04B est conservé tel quel.** Ses tests sont un garde-fou d'honnêteté qui fonctionne ; le réécrire par souci d'uniformité aurait affaibli une protection existante sans rien apporter.

## 2026-07-25 — Wave D : couche décisionnelle (P13 + P14 + P15)

Détail complet : `handoffs/WAVE_D_DECISION_LAYER.md`.

- **D1 — le registre juridique ne conclut rien, et c'est le résultat correct.** Le registre des risques liste « fait juridique non sourcé » comme risque à part entière. Une machine qui annoncerait « vous êtes soumis à ESRS E3 depuis telle date » sans relevé officiel vérifié le matérialiserait, avec l'autorité trompeuse d'un calcul. La Wave D livre donc la mécanique (schéma versionné, historique, moteur de portée à quatre verdicts) et **refuse de produire un verdict** tant qu'une règle n'a pas à la fois une source officielle relevée et une revue humaine signée. Les neuf entrées nomment les textes à instruire ; aucune ne porte de date ni de statut. `evaluate()` répond `unknown` partout.
- **D1 — aucun seuil réglementaire n'est encodé.** Le moteur ne connaît ni effectif, ni chiffre d'affaires, ni total de bilan, et ne doit pas les connaître : ces seuils changent et les figer dans du code reviendrait à y figer un conseil juridique. Le registre déclare des critères NOMMÉS, l'entité fournit des déterminations humaines datées et prouvées, le moteur ne fait que les composer. Un test AST refuse toute comparaison à un littéral numérique dans le module.
- **D1 — le droit contraignant et les référentiels volontaires sont séparés par construction.** GRI 303, CDP Water, TNFD/LEAP et SBTN ne sont pas du droit ; les ranger avec la CSRD sous une étiquette « conformité » laisserait croire à une obligation. `instrument_kind` les sépare, un référentiel volontaire ne peut ni porter d'échéance de transposition ni être présenté comme contraignant. De même, « sans objet » (règlement directement applicable) et « non vérifié » sont deux états distincts de la transposition.
- **D1 — écart de vocabulaire signalé, non corrigé.** Le contrat P02 `WaterLegalStatus` mélange l'état d'un texte et le résultat d'une portée, et ne comporte pas `repealed`. Le registre garde un statut de texte pur ; la conversion vers le vocabulaire public est explicite et testée, et **perd de l'information** (`repealed` → `out_of_scope`). Étendre l'énumération toucherait le miroir TypeScript et la fixture gelée : arbitrage humain requis, hors périmètre D1. Signalé aussi : `WaterLegalRecord` exige un `WaterSourceReference` conçu pour un jeu de données, pas pour un texte de loi.
- **D2 — un lien public ne transporte jamais de paramètre.** Un lien écrit à la main dans le JSX peut recevoir un jour un `?site=12345`, et un identifiant de site voyagerait alors dans une surface publique, l'historique du navigateur et les journaux d'accès. Les neuf ponts sont donc déclarés en données, avec trois invariants vérifiés à la construction : chemin nu obligatoire depuis le public, aucun contexte tenant déclarable, aucun nom de champ tenant dans la cible. La page publique tire ses liens du registre au lieu de les écrire.
- **D2 — la synthèse compose, elle n'agrège pas.** Six facettes (risque, confiance, dépendance, ressource/matière, IRO, actions), aucun score ESG global ni score hydrique composite — vérifié sur la structure sérialisée ET sur les noms de fonctions du module. Trois `high` sans rapport coexistent dans le produit (`/water`, `/resources`, IRO) : chaque entrée porte donc le NOM de son vocabulaire, et aucune fonction ne permet de les comparer.
- **D2 — la frontière publique/tenant devient mécanique, pas seulement documentaire.** Le paquet `services/water_intelligence/` est pur par contrat (test AST interdisant tout import de base). Le lecteur tenant de la synthèse vit donc dans `services/water/`, aux côtés des autres lecteurs scopés. Trois barrières anti-IDOR : RLS, prédicat `company_id = %s` de chaque service, puis échec bruyant (`CrossTenantEntryError`) si une entrée d'un autre tenant atteint la composition — jamais de filtrage silencieux, qui masquerait une requête mal scopée.
- **D2 — dégradation par facette plutôt que 503 global.** Les tables 036 à 043 ne sont pas garanties présentes en production (déploiement avant migration, 036 exige une étape manuelle). Une source dont le schéma n'est pas prêt produit une absence MOTIVÉE et les autres facettes restent rendues ; « aucun enregistrement » et « schéma absent » restent deux motifs distincts. Une erreur qui n'est pas un schéma manquant remonte nue.
- **D2 — aucune migration.** Le lien ressource ↔ eau existait déjà (`link_kind='water_activity'`, `role='water'`, migration 043) et le lien screening ↔ IRO passe par `iros.origin_reference` (migration 040).
- **D3 — le moteur financier refuse trois choses, chacune verrouillée par un test.** Aucune écriture comptable : IAS 36, IAS 37, IFRIC 21, continuité, assurance et redevances sont émis comme QUESTIONS À EXAMINER, jamais comme conclusions. Aucun taux inventé : le taux d'actualisation est un paramètre obligatoire (un taux implicite est une hypothèse que personne ne peut contester), aucun taux fiscal ni d'inflation n'est encodé. Aucune probabilité produite par un modèle de langage : une probabilité `derived` est refusée à la construction.
- **D3 — sensibilité plutôt que certitude, et une variation à la fois.** Une valeur centrale n'est jamais rendue seule. Chaque inducteur varie séparément : croiser les variations produirait un intervalle qui ressemble à un intervalle de confiance sans en être un. Arithmétique en `Decimal` avec arrondi `ROUND_HALF_EVEN` explicite, montants sérialisés en chaînes — deux exécutions identiques rendent exactement la même charge.
- **D3 — unités contrôlées, absence jamais convertie en zéro.** Seules quatre combinaisons de produit sont autorisées ; multiplier des jours par des jours lève au lieu de rendre un montant plausible et faux. Une entrée manquante rend un résultat absent AVEC son motif.
- **D1/D3 — les deux previews de la Wave C ont été REMPLACÉES, pas complétées**, conformément à la consigne. `WiPreviewCard` disparaît avec la dernière plutôt que de rester du code mort. Les tests qui interdisaient à ces aperçus de rendre un chiffre ou une date ont été retirés en connaissance de cause : ils décrivaient des composants qui n'existent plus.
- **Wave D — trois documents canoniques, trois miroirs à l'octet près.** Le registre juridique, la carte des ponts et le contrat du moteur financier sont ÉMIS par leur module backend et copiés dans `apps/carbon` ; la parité est vérifiée des deux côtés, comme pour `FIXTURE_MANIFEST.json`. Ils ne doivent jamais être édités à la main.
- **Wave D — aucun moteur n'est branché sur une route HTTP.** `water_intelligence` n'a jamais eu de surface HTTP, et en créer une dépassait le périmètre des trois commits. C'est le manque le plus visible du chantier et le premier candidat de Wave E.

## 2026-07-25 — Wave E : ouverture, et ce que « finalisation » ne veut pas dire

- **La Wave E n'ouvre aucune vague suivante.** Après elle, le chantier n'attend pas une Wave F : il attend une **décision humaine de production**. `next_prompt` passe donc à `CLOSEOUT`, pas à un nom de vague.
- **Le pilotage était périmé à l'ouverture, et c'est un défaut à corriger avant de coder.** `PROJECT_STATE.yaml` décrivait encore la Wave D « en revue » alors qu'elle est fusionnée (PR #157, merge `618a222`), et `PROMPT_LEDGER.csv` marquait P13 à P15 `blocked` alors qu'ils sont livrés, P10 à P12 `review` alors qu'ils sont fusionnés. Un état documentaire faux est plus dangereux qu'un état absent : il se lit comme vérifié.
- **P18 est tranché de façon documentaire, sans redirect.** Décision retenue : conserver `/water-intelligence` et `/water` tels quels, ne créer aucun alias `/eau` dans cette vague, et ne réévaluer l'URL qu'avec des analytics et des retours utilisateurs réels. Créer un redirect maintenant reviendrait à figer un choix d'URL sans la seule donnée qui permettrait de le juger.

## 2026-07-25 — Wave E, commit E2 : les deux reliquats juridiques sont soldés

- **`repealed` entre au contrat partagé, et la conversion destructive est interdite.** Le vocabulaire public ne savait pas dire « abrogé » : un texte abrogé était donc publié comme `out_of_scope`. Les deux énoncés n'ont ni la même cause ni les mêmes conséquences — « hors de votre champ » suggère qu'un changement de taille ou de périmètre pourrait rendre le texte applicable, alors qu'un texte abrogé ne le redeviendra jamais. La valeur a été ajoutée atomiquement (Python, miroir Zod, fixture, documents canoniques, tests de parité) et un test interdit désormais l'association `repealed`/`out_of_scope` dans le convertisseur. Le test de la Wave D qui assertait la conversion a été remplacé en connaissance de cause : il verrouillait le défaut.
- **Un texte de loi n'est pas une release de jeu de données.** `WaterLegalRecord.source` exigeait une `WaterSourceReference`, donc une clé de release, une empreinte SHA-256 de 64 caractères et une décision de licence. La fixture gelée en portait la preuve : un texte fictif affublé d'un checksum de zéros. `OfficialLegalReference` remplace ce contrat — URL officielle, éditeur, identifiant d'instrument, version ou date de consolidation, date de relevé, juridiction, nature de source — et **aucun de ses champs n'est obligatoire** : un réviseur les renseigne au fil de son instruction. `is_verified` exige URL **et** date de relevé, parce qu'une référence non datée ne prouve rien sur un droit qui change.
- **`extra="forbid"` sur `OfficialLegalReference`, et c'est un choix.** Sans lui, passer une référence de jeu de données était silencieusement accepté et vidé de tous ses champs — le contrat aurait transformé une erreur de forme en référence vide plausible. Le refus doit être bruyant. Ce comportement a été révélé par un test, pas supposé.
- **Migration de fixture explicitement versionnée** : `manifest_version` passe de `1.0.0` à `1.1.0`. Un changement incompatible de schéma se versionne, il ne s'applique pas en silence.
- **E2 ne crée aucun fait juridique.** Aucune source officielle réelle n'a été renseignée, aucun verdict n'a changé : les neuf règles restent `unknown`, sans source ni réviseur. Trois tests le verrouillent.

## 2026-07-25 — Wave E, commit E5 : le test contre une vraie base a trouvé un vrai défaut

- **La troisième barrière anti-IDOR de la Wave D était inopérante.** Le lecteur de synthèse estampillait chaque entrée avec le `company_id` demandé plutôt qu'avec celui de la ligne lue : une ligne fuitée était réétiquetée au nom du demandeur, si bien que `CrossTenantEntryError` ne pouvait jamais se déclencher. Le garde-fou vérifiait une valeur qu'il venait lui-même de poser.
- **Aucun test à doubles ne pouvait le voir**, et c'est la justification rétrospective de l'exigence « pas de preuve d'isolation sans PostgreSQL réel » : un double de lecture ne peut pas omettre une clause `WHERE`, donc il ne peut pas produire la fuite qu'on prétend détecter. Le défaut est apparu à la PREMIÈRE exécution du test A/B en CI.
- **Correctif** : `_entry_company_id()` lit le tenant sur la ligne et **refuse** un enregistrement qui n'en déclare pas — prêter le tenant courant à un enregistrement anonyme serait exactement le défaut d'origine sous une autre forme. Les doubles des tests purs portent désormais un `company_id`, comme les objets réels.
- **Conséquence pour les tests d'isolation à venir** : vérifier qu'une entrée « appartient au bon tenant » n'a de valeur que si le tenant vient de la donnée, jamais du contexte d'appel.

## 2026-07-25 — Wave E-Interface & Closeout (PR #159, Draft)

Détail complet : `FINAL_TRACEABILITY.md`.

- **Le cockpit vit dans le groupe `(app)`, sans seconde garde.** `/water/decision`
  s'appuie sur la garde d'authentification du layout de groupe. Une garde locale
  supplémentaire aurait divergé de celle du groupe à la première évolution, et
  c'est cette divergence qui produit les pages accessibles par accident.
- **Le `company_id` renvoyé par la synthèse n'est pas affiché.** Le contrat
  serveur le porte ; la page ne le rend pas. Un identifiant de tenant rendu dans
  le DOM finit dans une capture d'écran ou une trace de support.
- **Le calculateur ne propose aucune valeur, y compris aucun `placeholder`
  chiffré.** Un « 0,08 » sous un taux d'actualisation est un taux recommandé
  quoi qu'en dise l'étiquette, et personne ne saurait dire ensuite qui l'a
  choisi. L'origine (observée / hypothèse) n'est pas non plus pré-cochée :
  la pré-cocher signerait une origine à la place de l'humain.
- **Deux jeux E2E physiquement séparés.** `e2e/public` (sans secret, joué sur
  `pull_request`) et `e2e/authenticated` (Preview, environnement protégé). Le
  `testDir` de la configuration historique est resserré sur `e2e/tests` pour que
  `npm run e2e` conserve exactement son périmètre — 137 tests, vérifié par
  `--list`. La politique de secrets de `e2e.yml` n'est pas modifiée.
- **L'environnement `e2e-preview` et ses secrets n'ont PAS été créés.** Déposer
  des identifiants dans un environnement de CI engage un compte réel, une
  Preview réelle et une durée de vie à surveiller : c'est un geste
  d'exploitation, pas un geste de code. Statut retenu et écrit partout :
  `prepared_not_executed_environment_not_configured`.
- **Un défaut trouvé par un test, pas par une relecture.** `reducedMotion`
  n'est pas une option de `use` en Playwright 1.59 — elle passe par
  `contextOptions`. Playwright l'ignorait en silence : la suite était verte et le
  projet « mouvement réduit » n'émulait rien. Deux tests comparent désormais
  l'état émulé au nom du projet, pour que la matrice ne puisse plus mentir.
- **Sept défauts corrigés en F5, tous mesurés.** Trois couleurs de texte sous le
  seuil AA (3,07 / 3,58 / 4,41), un lien à 3,77, un marqueur à 3,03 en thème
  sombre, un second `h1` alors que l'en-tête du groupe en rendait déjà un avec le
  même texte, un 304 du registre juridique traité comme une erreur, une limite de
  débit absente sur `decision-synthesis`, une validation client plus laxiste que
  le serveur.
- **Deux constats NON corrigés, et c'est délibéré.** `--color-muted-foreground`
  déclarée nulle part (correctif d'une ligne, mais 36 pages hors périmètre
  changeraient d'apparence sans qu'aucun humain les ait regardées) ; et les
  265 kB de zod sur `/water/decision` (arbitrage de contrat, pas défaut).
  Consignés plutôt que tranchés en douce.
- **Pilotage.** `active_prompt: HUMAN_REVIEW`, `status: review`,
  `last_merged_prompt: WAVE_E_CORE`, `next_prompt: PRODUCTION_DECISION`.
- **P18 inchangé.** `/water-intelligence`, `/water` et `/water/decision` sont
  conservées ; `/eau` n'est pas créée ; aucun redirect. Réévaluation seulement
  avec des analytics et des retours utilisateurs réels.

## 2026-07-26 — X2A : correction des dérives de schéma détectées en X1

- **BNPE prélèvements : `annee_min`/`annee_max` abandonnés au profit d'`annee`.**
  X1 avait établi la preuve (compte identique à 9724 lignes, borné ou non) que
  l'API Hub'Eau ignore silencieusement les paramètres de plage. Plutôt que de
  continuer à envoyer des paramètres inopérants, le connecteur n'expose plus
  que `annee` (valeur exacte). L'orchestration multi-année reste possible côté
  opérateur, mais devient explicite : une requête par année, une borne
  `--max-years` obligatoire refusant toute plage non bornée avant le premier
  appel réseau, et une vérification a posteriori que chaque ligne reçue porte
  bien l'année demandée — un écart est une erreur de contrat explicite, jamais
  un filtrage silencieux.
- **Hydrométrie : bascule du MVP d'`observations_elaborees` vers
  `observations_tr`.** Vérifié en direct le 2026-07-26 : `observations_tr`
  accepte H/Q (200) et refuse les codes élaborés (HIXM → 400) ;
  `observations_elaborees` fait l'inverse. Le MVP porte donc sur le temps
  réel. `obs_elab` n'est pas supprimé — il reste déclaré dans le socle
  Hub'Eau, marqué `derived_metrics_mapping_deferred`, en attente d'une
  décision humaine sur le mapping des grandeurs élaborées. Aucun repli
  automatique entre les deux endpoints : un connecteur qui interroge
  `observations_tr` n'essaiera jamais `obs_elab` en silence, et
  réciproquement.
- **EEA WEI+ : `manual_artifact_required` remplace `decoder_deferred`.** Aucun
  classeur EEA officiel n'a jamais été obtenu ni inspecté — inventer un
  mapping colonnes→schéma serait une invention, pas une vérification.
  `eea_artifact_inspector.py` cadre le mécanisme d'acceptation (extension,
  conteneur, release attendue, somme de contrôle, absence de macro si
  vérifiable, feuilles et en-têtes réels), mais `MAPPING_PROFILES` reste vide
  par construction : aucun profil n'est pré-rempli par supposition. Le statut
  `manual_artifact_required` nomme honnêtement ce qui manque (un artefact réel
  à obtenir et faire vérifier par un opérateur humain), distinct de
  `decoder_deferred` qui reste réservé à Copernicus (décodeur GeoTIFF non
  écrit, source elle-même déjà obtenue).
- **WRI Aqueduct et Copernicus EDO : aucun changement.**
  `blocked_registration_required` et `source_verified_decoder_deferred`
  restent inchangés — X2A ne visait que les dérives de schéma détectées en X1
  (BNPE, hydrométrie), pas ces deux sources dont le blocage est d'une autre
  nature (inscription non documentée / décodeur non écrit).
- **Aucune décision de publication modifiée.** X2A ne change aucun statut de
  licence, n'approuve aucune source, ne fait avancer aucun
  `WaterLicenseDecision`. Les corrections sont des corrections de connecteur
  (schéma réellement servi par l'API), pas des décisions humaines.
- **Pilotage.** `status: X2A_SCHEMA_REMEDIATION_COMPLETE`. Détail complet dans
  [X2A_SCHEMA_REMEDIATION_HANDOFF.md](activation/X2A_SCHEMA_REMEDIATION_HANDOFF.md).
  Prochaine étape possible : X2B (graveur Evidence Kernel), sur décision
  explicite — non commencée par X2A.

## 2026-07-26 — X2B : graveur Evidence Kernel et releases staging

- **Aucun second Evidence Kernel, aucun registre Water parallèle.** L'audit
  préalable (`activation/X2B_EVIDENCE_KERNEL_AUDIT.md`, dix questions
  répondues avant toute ligne de code) a établi que les six tables de la
  migration 028 suffisent. X2B ajoute un *graveur*, pas un *noyau*.
- **« staging » n'est pas un statut de base, et n'en deviendra pas un.**
  `source_releases_status_check` est fermé à six valeurs. Une release Eau en
  staging est écrite `status='validated'`, `published_at IS NULL`,
  `company_id IS NULL`. `validated` est la précondition exacte de
  `publish_release()` : X4 promouvra sans code nouveau. Aucune clé de statut
  n'est logée dans `metadata` — deux tests le vérifient sur la ligne
  réellement écrite. Aucune migration n'est donc proposée.
- **Les services intelligence ne sont pas appelés tels quels.** Chacun ouvre
  sa PROPRE `get_db()`, donc sa propre transaction : les enchaîner donnerait
  quatre à six transactions et un état partiel en cas d'échec au milieu. Le
  graveur reprend le motif de `snapshot_migration.import_snapshot` (helpers
  recevant un `cur` nu) tout en réutilisant les mêmes tables, le même
  vocabulaire, la même `license_policy` et les mêmes modèles.
- **« Rollback complet » = transaction avortée avant commit.**
  `evidence_kernel_guard` interdit toute UPDATE/DELETE sur `observations` et
  toute DELETE sur `source_releases` : rien n'est défaisable après commit.
  Le `--dry-run` exécute donc le VRAI chemin d'écriture puis avorte — un
  dry-run qui simulerait au lieu d'écrire ne prouverait ni les contraintes ni
  les triggers.
- **Le graveur ne crée aucune source.** Une source absente du Source Registry
  est refusée. Déclarer une source et ses booléens de licence est un geste
  humain, jamais un effet de bord d'ingestion.
- **Trois refus structurels plutôt que trois contournements.** Observation
  porteuse d'un scénario (identité irrécupérable après écriture) ; valeur
  retenue (`observations_value_presence_check` exige une valeur — une licence
  sans affichage rend les observations non insérables) ; statut de donnée non
  cartographié, `fixture` en tête (une donnée de fixture n'entre jamais dans
  le noyau de preuve).
- **`ObservationDraft.dedup_key()` n'est jamais utilisée.** Sa clé
  `(subject_type, subject_key, metric_code)` ignore la période : elle
  écraserait silencieusement toutes les périodes sauf la première. C'est le
  défaut que `WaterObservationIdentity` avait été écrit pour empêcher.
- **`ingest_release.py` est le seul script opérateur Eau autorisé à ouvrir la
  base.** Exemption NOMMÉE et testée dans le garde-fou X1, même idiome que
  `fetcher.py` pour le réseau : la règle reste vraie pour tous les autres, et
  un futur script qui écrirait en base ferait échouer le test tant qu'un
  humain ne l'a pas listé. Ce script n'ouvre lui-même aucun réseau.
- **Aucune publication, aucune décision de licence modifiée.** Les sept
  sources restent `proposed`/`refused` ; aucune release ne passe à
  `published` ; aucun `published_at` n'est posé.
- **Pilotage.** `status: X2B_INGESTION_WRITER_COMPLETE`. Détail dans
  [X2_EVIDENCE_INGESTION_HANDOFF.md](activation/X2_EVIDENCE_INGESTION_HANDOFF.md).
  Prochaine étape possible : X3 (répétition staging avec des artefacts réels),
  sur décision explicite — non commencée par X2B.

## 2026-07-26 — X3 : porte d'environnement staging (arrêt au gate)

- **Verdict `staging_environment_missing`, arrêt avant toute écriture.** Aucune
  base de staging n'existe : ni variable d'environnement, ni fichier `.env`,
  ni convention dans le dépôt, ni PostgreSQL local, ni runtime de conteneurs.
  Le seul environnement de base connu du dépôt est `production-db`, protégé
  par approbation humaine — et hors de question par construction.
- **Aucun repli sur la production, aucune donnée synthétique de compensation.**
  Une répétition sur des données inventées ne prouverait pas le parcours ;
  elle prouverait qu'on sait fabriquer un rapport. L'acquisition réseau n'a
  pas non plus été lancée : rejouer les recettes X2A sur des services publics
  officiels sans cible d'écriture n'aurait rien établi de neuf.
- **Défaut réel trouvé en ouvrant la porte, et corrigé.** En X2B,
  `--environment staging` ne contrôlait qu'une CHAÎNE ; la connexion venait de
  `get_admin_db()`, qui retombe silencieusement sur `DATABASE_URL`. Sur une
  machine portant les identifiants de production, `ingest_release --commit
  --environment staging` aurait écrit EN PRODUCTION. Le drapeau était une
  déclaration d'intention, pas une garde.
- **La destination est désormais prouvée, pas déclarée.**
  `WATER_STAGING_DATABASE_URL` obligatoire sous un nom réservé, aucun repli ;
  refus inconditionnel sur tout indicateur de production ; `--expect-database`
  confronté à `current_database()` DANS la transaction, avant toute écriture ;
  URL jamais journalisée ni passée en argument ; porte franchie en premier,
  dry-run non exempté.
- **Ce que la porte ne prouve pas, et c'est écrit.** Elle ne peut pas garantir
  qu'une base déclarée « staging » n'est pas la production : seul l'opérateur
  le sait. Ce qu'elle supprime, c'est l'accident silencieux.
- **Pilotage.** `status: X3_BLOCKED_STAGING_ENVIRONMENT_MISSING`. Prérequis
  exacts listés dans
  [X3_STAGING_REHEARSAL_GATE.md](activation/X3_STAGING_REHEARSAL_GATE.md) §5.
  X4 reste bloqué tant qu'aucune release `validated` n'existe sur un staging
  persistant.

## 2026-07-26 — X3 : répétition staging éphémère exécutée avec succès

- **Piste du staging persistant local abandonnée**, remplacée par un
  PostgreSQL éphémère GitHub Actions (`postgres:16`, service Docker d'un
  workflow `workflow_dispatch` dédié). Aucune ressource Neon, aucune variable
  Vercel, aucune variable Carbon&Co (`DATABASE_URL*`) touchée ni lue —
  `staging_environment.py` refuse tout repli sur elles.
- **Cinq exécutions réelles, chaque échec diagnostiqué puis corrigé, jamais
  maquillé.** `schema_migrations` supposé présent par un mécanisme qui ne le
  peuple jamais (corrigé par une vérité structurelle) ; collision d'identité
  réelle sur l'hydrométrie (traitée ci-dessous) ; `ruff` non installé dans le
  workflow ; faux positif du scanner de secrets sur son propre nom de
  variable. Le cinquième run (`30215981981`) a réussi ses 30 étapes.
- **HUBEAU_HYDROMETRIE différée, décision humaine.** Le premier run réel du
  graveur a révélé une collision d'identité authentique :
  `observations_tr` sert plusieurs lectures par jour, incompatibles avec le
  grain jour du contrat d'identité partagé par tout Water Intelligence. Ce
  n'est pas un bug — c'est un désaccord entre deux décisions architecturales
  antérieures et volontaires. Plutôt que de choisir unilatéralement entre
  étendre le contrat partagé au sous-journalier ou perdre délibérément la
  granularité intra-journalière (deux décisions de fond), la décision a été
  de différer l'ingestion : statut nommé `subdaily_identity_collision`, même
  discipline que les statuts EEA/WRI/Copernicus. `HUBEAU_ADES` et
  `HUBEAU_QUALITE_SURFACE`, ingérées sans collision dans le même run,
  confirment que le grain jour convient aux relevés véritablement quotidiens.
- **Trois releases `validated` produites et rejouées avec succès** :
  `HUBEAU_ADES` (182 observations), `HUBEAU_QUALITE_SURFACE` (50),
  `HUBEAU_BNPE_PRELEVEMENTS` (50). Idempotence prouvée : rejeu = 0 écriture,
  toutes déjà présentes, même `release_id`. Aucune ligne de tenant, aucune
  publication, aucun `published_at`.
- **Manifeste candidat privé produit** (`candidate_not_published`,
  `promotable_to_x4: false`) — jamais servi publiquement, jamais copié dans
  un Blob public, jamais committé avec ses observations.
- **X4 reste bloqué, sur deux plans distincts.** Techniquement : les releases
  de ce run ont disparu avec le job éphémère, donc non promouvables — X4
  exigera une ingestion sur un staging PERSISTANT. Humainement : aucune des
  sept sources n'est `approved` au registre des décisions de publication.
- **Pilotage.** `status: X3_EPHEMERAL_REHEARSAL_SUCCEEDED_3_OF_4_SOURCES`.
  Détail complet dans
  [X3_EPHEMERAL_STAGING_REHEARSAL.md](activation/X3_EPHEMERAL_STAGING_REHEARSAL.md)
  et [X3_PUBLICATION_CANDIDATE_SUMMARY.md](activation/X3_PUBLICATION_CANDIDATE_SUMMARY.md).
  Corrections de code fusionnées sur `master` via
  [PR #169](https://github.com/ludoviclabs-dotcom/finance-platform/pull/169)
  (merge `da6d0b1d47430456a78b4b80af9c137f34f05ea8`, 2026-07-26T19:16:45Z).
  X4 et la Phase B ne sont pas commencés.
