# P03 — Pipeline opérateur générique Water Intelligence

**Mission :** P03 — Pipeline opérateur générique hors runtime.
**Branche :** `feat/water-intelligence-p03-ingestion-pipeline`

---

## 1. Rôle du pipeline

Fournir l'ossature d'ingestion **réutilisable** que P05-P09 brancheront chacun à un connecteur réel, sans qu'aucun d'eux n'ait à réinventer l'orchestration, le rapport d'exécution, la gestion d'erreur ou la porte de licence. Sept étapes explicites, traçables et remplaçables :

```
plan -> fetch -> parse -> normalize -> derive -> validate -> publish
```

- **plan** — résout `source_code` dans le catalogue normalisé P01b ([`SOURCE_CATALOG_NORMALIZED_V1.csv`](../SOURCE_CATALOG_NORMALIZED_V1.csv)). Une source absente du catalogue est refusée, jamais devinée.
- **fetch** — assemble les octets bruts, page par page, via un `Transport` injectable. Aucun décodage sémantique ici : une page peut arriver corrompue au sens du transport (timeout, HTTP 5xx, checksum invalide) sans que ce soit un échec de *parsing*.
- **parse** — décode chaque page en JSON. Un JSON malformé échoue *ici*, distinctement d'une corruption détectée par le transport.
- **normalize** — réutilise le contrat `SourceAdapter.normalize()` existant (PR-04) pour produire des `ObservationDraft`.
- **derive** — traduit chaque `ObservationDraft` en candidat `WaterMetricObservation` (P02) : résout la géographie, la période, la méthode et la confiance de présentation. Un draft dont la géographie ou la date d'observation ne peut pas être résolue est écarté et nommé dans le rapport, jamais complété par une valeur inventée.
- **validate** — applique le contrat `WaterMetricObservation` (validation Pydantic automatique) et la porte de licence : sans `license_decision` fournie, tout est retenu (`value_withheld`), jamais publié par défaut.
- **publish** — strictement **dry-run** dans cette PR (voir §3).

Chaque exécution produit un `PipelineExecutionReport` unique, qu'elle réussisse ou échoue — un échec de stage arrête les stages suivants mais renvoie toujours un rapport complet, jamais une exception nue.

## 2. Ce qui est livré

| Fichier | Contenu |
|---|---|
| `apps/api/services/water_intelligence/pipeline_transport.py` | Contrat `Transport` (paginé, jamais réel) + `FakeTransport` (scripté en mémoire : succès, erreur HTTP, timeout, réponse corrompue) |
| `apps/api/services/water_intelligence/pipeline.py` | `PipelinePlan`, `PipelineExecutionReport`, `TransportAdapter` (assemble les pages en un `SourceAdapter` standard), `derive_observations`, `validate_candidates`, `publish_dry_run`, `run_pipeline` (orchestrateur) |
| `apps/api/tests/test_water_intelligence_pipeline.py` | 21 tests : exécution complète dry-run, idempotence, échec parsing vs corruption transport, échec de validation (géographie/date non résolues), licence bloquée vs licence inconnue, source inconnue, pagination bornée, dépassement de limite, reprise contrôlée, absence de réseau/BDD (preuve par analyse AST), conservation de `null` |

Réutilisation confirmée, pas de duplication : `SourceAdapter`/`ObservationDraft`/`AdapterError` (`adapters/base.py`, PR-04) inchangés ; `MethodRef` et `confidence_to_display()` (`models/analytics.py`) réutilisés tels quels pour la conversion confiance 0-1 → 0-100 ; `WaterMetricObservation`/`WaterSourceReference`/`WaterLicenseDecision`/`WaterGeographyRef`/`WaterQualityMetadata` (`models/water_intelligence.py`, P02) **non modifiés** ; le catalogue P01b (`load_source_catalog`) est la seule source de vérité sur les `source_code` connus.

## 3. Ce qui n'est pas livré

- **Aucun connecteur réel.** `Transport` n'a qu'une implémentation, `FakeTransport`, scriptée en mémoire.
- **Aucune écriture en base.** `publish_dry_run(dry_run=False)` **lève une erreur explicite** plutôt que d'écrire ou de silencieusement ne rien faire — P03 ne fournit aucun graveur Evidence Kernel réel (aucun appel à `services.intelligence.release_service`/`artifact_service`/`observation_service`).
- **Aucune ligne `source_registry`.** Le catalogue P01b reste un fichier, pas une table.
- **Aucune évaluation de licence automatique.** `validate_candidates` ne consulte jamais `license_policy.evaluate()` — elle attend une `WaterLicenseDecision` explicitement fournie par l'appelant, ou reste `unknown`.
- **Aucune fenêtre temporelle ni fréquence réelle.** `plan` fixe des bornes (pages, octets) mais ne planifie pas encore de calendrier d'exécution (cron explicitement interdit dans cette PR).
- **Aucun UI, route ou migration.**

## 4. Pourquoi aucun connecteur réel n'est encore créé

Un connecteur réel (Hub'Eau, WRI Aqueduct…) implique un appel réseau réel, donc une évaluation de licence réelle, donc au minimum une entrée `source_registry` réelle — trois choses explicitement interdites à ce stade par le pack maître. Router un connecteur maintenant obligerait soit à enfreindre ces interdictions, soit à construire un faux connecteur qui masquerait les vraies difficultés (pagination réelle, erreurs réseau réelles, formats réels) derrière une façade rassurante. P03 livre l'ossature et la preuve qu'elle fonctionne sur des fixtures représentatives ; P05 est explicitement la première PR autorisée à brancher un accès réel (§7 du pack maître : WRI Aqueduct en premier).

## 5. Comment P05/P06/P07/P08/P09 devront brancher leurs connecteurs

1. Implémenter un `Transport` réel (client HTTP véritable) respectant le contrat `fetch_page(page_token) -> FetchPage` — remplace `FakeTransport`, ne modifie pas `TransportAdapter` ni l'orchestrateur.
2. Fournir un `normalizer` propre au format de la source (mapping JSON/CSV réel → `ObservationDraft`), injecté à `run_pipeline` — jamais un normalizer générique qui devinerait la structure.
3. Fournir un `geography_resolver` réel (référentiel de codes officiels — bassins SANDRE, districts EEA…) au lieu du résolveur fixture ; il doit continuer à lever `PipelineDataUnavailableError` pour un code non résolu, jamais inventer une géographie par défaut.
4. Obtenir une `WaterLicenseDecision` réelle via `services.intelligence.license_policy.evaluate()` sur la ligne `source_registry` correspondante (à créer dans la PR du connecteur, hors P03) avant d'appeler `validate_candidates` — jamais réutiliser le `None` par défaut de P03 en production.
5. Ne changer `dry_run=False` qu'après avoir fourni un vrai graveur Evidence Kernel (P10, ou une extension explicite de `publish_dry_run`) — tant que ce graveur n'existe pas, `dry_run=False` continuera de lever une erreur, par construction.
6. Respecter les bornes de `plan` (pages, octets) avec des valeurs adaptées à la source réelle, documentées et justifiées dans la PR du connecteur (budgets §3 du pack maître, `docs/carbonco/water-intelligence/contracts/P02_DATA_CONTRACTS.md` §7).

## 6. Garanties

| Risque | Garantie apportée par P03 |
|---|---|
| **Volume** | Pages bornées (`max_pages`, `PipelineLimitExceeded` explicite) ; volume brut borné (`max_raw_bytes`) ; aucun appel sans borne. |
| **Erreurs** | Chaque stage est isolé : un échec s'arrête et se documente (`steps_failed`, `errors`) sans corrompre les stages précédents ni propager une exception nue. Reprise contrôlée (`resume_from_token`) sans re-fetch des pages déjà obtenues. |
| **Hallucinations** | `derive` refuse une géographie ou une date non résolues plutôt que d'inventer une valeur ; `normalize` (hérité de PR-04) refuse un draft sans valeur ; aucune donnée métier par défaut. |
| **Licences** | `validate_candidates` ne suppose jamais une licence permissive : sans décision explicite, tout est `value_withheld`. Une licence bloquée et une licence inconnue produisent des rapports distincts (raisons documentées vs avertissement générique), jamais confondues. |
| **Secrets** | `PipelineExecutionReport` ne contient jamais d'octet brut, de jeton de page ni de contenu de fixture — uniquement identités, checksums et compteurs. |
| **Réseau/BDD réels** | Vérifié par analyse statique (AST) du code source dans les tests, pas seulement documenté : aucun import `requests`/`httpx`/`urllib`/`socket`/`db`/`psycopg` n'existe dans ce paquet. |
| **Reproductibilité** | `input_checksum`/`output_checksum` déterministes (mêmes octets → mêmes checksums, testé). Seule exception horloge autorisée : `executed_at` du rapport, toujours injectée via un `clock` explicite, jamais `datetime.now()` en dur. |
