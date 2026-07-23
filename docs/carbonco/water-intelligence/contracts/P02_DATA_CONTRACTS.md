# P02 — Contrats du read model public Water Intelligence

**Mission :** P02 — Contrats du read model public et budgets.
**Branche :** `feat/water-intelligence-p02-data-contracts`

Définit la forme que devra prendre le futur snapshot public de `/water-intelligence`, avant tout connecteur réel (P05+) et avant toute UI complète (P04+). Aucune table, aucun endpoint, aucune donnée réelle.

---

## 1. Ce qu'est un contrat ici

Un **contrat** = un type Pydantic (`apps/api/models/water_intelligence.py`) et son miroir Zod (`apps/carbon/lib/water-intelligence/contracts.ts`), tous deux nommés à l'identique et validant les mêmes champs en snake_case. Les 10 contrats demandés par le prompt maître :

| Contrat | Rôle |
|---|---|
| `WaterIntelligenceManifest` | Enveloppe publique unique — ce qu'un futur endpoint `/water-intelligence/manifest` (P10+) renverra |
| `WaterMetricObservation` | Une valeur publiée + toute sa preuve (source, méthode, qualité) |
| `WaterGeoLayerDescriptor` | Une couche cartographique publiable (P11) |
| `WaterSourceReference` | Provenance minimale imposée par l'en-tête invariant du pack maître (règle 9) |
| `WaterLicenseDecision` | **Réexport direct** de `models.intelligence.LicenseDecision` — pas un second calcul de droits |
| `WaterQualityMetadata` | Confiance/couverture/avertissements, toujours séparés de la valeur |
| `WaterScenario` | Une projection nommée (ex. Aqueduct 2030) |
| `WaterGeographyRef` | Référence géographique (monde/Europe/France + code officiel) |
| `WaterEditorialRecord` | Contenu secteurs/acteurs/événements/innovations (P12) |
| `WaterLegalRecord` | Registre juridique (P13) |

`MethodRef` n'est pas un 11ᵉ contrat nouveau : c'est `models.analytics.MethodRef` réutilisé tel quel (même forme que Wave 2).

La preuve de compatibilité contractuelle entre les deux langages n'est pas un test séparé par langage : **les deux suites de tests valident le même fichier** [`FIXTURE_MANIFEST.json`](./FIXTURE_MANIFEST.json) — `apps/api/tests/test_water_intelligence_contracts.py` côté Python, `apps/carbon/lib/water-intelligence/contracts.test.ts` côté TypeScript.

## 2. Invariants portés par les types (pas seulement documentés)

| Invariant | Mécanisme |
|---|---|
| Risque/valeur ≠ confiance | `value` (sur `WaterMetricObservation`) et `confidence` (sur `WaterQualityMetadata`, champ imbriqué séparé) ne sont jamais le même champ |
| Valeur absente ≠ zéro | `value: StrictFloat \| StrictStr \| StrictBool \| None` (Python) / `z.union([z.number(), z.string(), z.boolean(), z.null()])` (TS) — aucun défaut à 0, types stricts sans coercition silencieuse |
| Fixture/demo explicitement étiquetée | `WaterIntelligenceManifest.fixture_label: "fixture" \| "demo" \| None` au niveau manifest, `WaterQualityMetadata.data_status="fixture"` au niveau observation |
| Période obligatoire | `WaterMetricObservation.period_start` / `period_end` non optionnels |
| Géographie obligatoire | `WaterMetricObservation.geography` non optionnel ; `WaterGeographyRef.code` obligatoire dès que `scope != "world"` |
| Source/release obligatoires pour une donnée publiée | `WaterMetricObservation.source: WaterSourceReference` non optionnel ; `WaterSourceReference.release_key` non optionnel — impossible de construire une observation sans release |
| Licence d'affichage explicite | `WaterSourceReference.license: WaterLicenseDecision` imbriqué, jamais un booléen nu |
| `display_allowed` contrôlé au niveau publication | Validateur sur `WaterMetricObservation` : `license.allow_display=false` **exige** `value_withheld=true` **et** `value=None` — reprend le pattern `value_withheld` déjà existant de `models/water.py` (cockpit `/water`), pas un second mécanisme |
| Méthode et version explicites | `WaterMetricObservation.method: MethodRef` non optionnel |
| Statut de donnée contrôlé | `WaterQualityMetadata.data_status: Literal["observed","modelled","estimated","manual","fixture"]` |

## 3. Vocabulaire `WaterDataStatus` — pourquoi distinct du noyau

`models.intelligence.DataStatus` (`verified/estimated/manual/inferred`) décrit le statut d'**ingestion** d'une observation du Evidence Kernel. Le prompt maître P02 impose un vocabulaire différent pour le read model **public** : `observed/modelled/estimated/manual/fixture`. Une mesure directe (station Hub'Eau) et une projection de scénario (Aqueduct 2030) ne sont pas de même nature — distinction que le noyau ne fait pas. Les deux vocabulaires ne sont jamais mélangés dans le code ; une conversion, si un futur connecteur en a besoin, sera un choix explicite documenté dans sa PR, pas une équivalence implicite.

## 4. Ce qui n'est pas encore implémenté

- **Aucune table.** Ces contrats ne correspondent à aucune migration. Le futur snapshot (P10) sera assemblé à partir du Evidence Kernel existant (`source_registry`/`source_releases`/`evidence_artifacts`/`observations`), pas d'un nouveau schéma.
- **Aucun endpoint public.** Rien n'est exposé au réseau. Un futur `GET /water-intelligence/manifest` (P10+) est hors périmètre de P02.
- **Aucun connecteur réel.** Les fixtures sont construites à la main, jamais récupérées d'un portail. P05-P09 restent les premières implémentations réelles du contrat `SourceAdapter` existant (`apps/api/services/intelligence/adapters/base.py`, cf. audit P00).
- **Aucune UI.** Pas de composant React consommant ces types — réservé à P04 (shell public) et P11 (carte).
- **Aucun score composite.** Chaque dimension (`WaterQualityMetadata`, `value`, futures couches thématiques) reste un champ séparé ; aucun agrégat opaque n'est introduit.

## 5. Pourquoi aucune donnée réelle

Le pack maître interdit d'inventer un fait, un chiffre, une date ou un statut juridique (règle 5 de l'en-tête invariant). Tant qu'aucun connecteur réel (P05+) n'a tourné, toute valeur concrète serait nécessairement inventée. La seule fixture de ce PR ([`FIXTURE_MANIFEST.json`](./FIXTURE_MANIFEST.json)) est donc explicitement marquée `fixture_label: "fixture"` au niveau manifest et `data_status: "fixture"` au niveau observation — jamais présentée comme une observation réelle, conformément à l'invariant.

## 6. Comment P03 devra réutiliser ces contrats

P03 (pipeline opérateur générique) construit l'orchestration `plan → fetch → parse → normalize → derive → validate → publish` à partir de fixtures locales, sans connecteur réel. Il devra :

- faire produire par chaque étape `normalize`/`derive` des instances de `WaterMetricObservation` (ou des dicts validables par `WaterMetricObservationSchema`/`.model_validate()`) plutôt que des structures ad hoc ;
- construire `WaterSourceReference` à partir des lignes `source_registry`/`source_releases` déjà existantes (pas un second registre) ;
- respecter le validateur `display_allowed` dès l'étape `validate` — un enregistrement destiné à `publish` avec licence bloquée doit déjà porter `value_withheld=true` avant que P10 n'assemble le snapshot ;
- réutiliser `WaterQualityMetadata` pour transporter `data_status` + `confidence` au lieu de champs recréés localement.

P03 ne doit *pas* redéfinir de schéma parallèle : tout écart de forme découvert doit corriger ce module (`models/water_intelligence.py` + `contracts.ts`), pas contourner le contrat.

## 7. Budgets de payload (pack maître §3)

| Objet | Budget | Contrat concerné |
|---|---:|---|
| Manifest public non compressé | 100 Ko | `WaterIntelligenceManifest` |
| Données critiques du premier écran non compressées | 250 Ko | sous-ensemble de `observations`/`geo_layers` chargé au premier rendu |
| Une couche géographique compressée | 400 Ko | `WaterGeoLayerDescriptor.payload_bytes_gzip` (champ prévu pour la mesure) |
| Requêtes réseau initiales de la page | 6 maximum | — (P04) |
| Séries temporelles initiales par graphique | 120 points maximum | listes d'`observations` par métrique |
| Entités affichées simultanément sur la carte | 1 000 maximum | `WaterGeoLayerDescriptor.feature_count` (borné `le=1000` / `.max(1000)` dans les deux schémas) |
| Sources nouvelles dans une PR de connecteur | 1 famille de source | — (P05+) |
| Historique initial | snapshot courant + un comparatif explicite | — (P10+) |

Tout dépassement doit être mesuré, expliqué et validé dans la PR qui l'introduit (pack maître §3).

## 8. Niveaux de zoom (pack maître §3 « Stratégie géographique »)

`WaterGeographyRef.scope` et `WaterGeoLayerDescriptor.zoom_level` sont bornés à exactement 3 valeurs :

- **`world`** — agrégats et géométries très simplifiées ; seul niveau où `code` peut être omis.
- **`europe`** — districts ou sous-unités EEA, chargés à la demande.
- **`france`** — bassins/sous-bassins, stations et points chargés selon la zone visible.

Le niveau **site** (position exacte d'un site) n'existe **pas** dans ces contrats : il reste réservé au cockpit authentifié `/water` (pack maître : « jamais dans le dataset public »). Aucun contrat de ce module ne porte de coordonnées de site.

## 9. Réutilisation confirmée du noyau (pas de duplication)

- `WaterLicenseDecision` = `models.intelligence.LicenseDecision` (réexport direct, testé par `test_water_license_decision_is_the_core_license_decision`).
- `MethodRef` = `models.analytics.MethodRef` (réutilisé tel quel, pas réimporté sous un autre nom Python — seul le côté TS en a un miroir puisqu'aucun Zod `MethodRef` n'existait avant).
- Le pattern `value_withheld` reprend exactement celui de `models/water.py` (`WaterScreeningData.value_withheld`, cf. audit P00 §00_BASELINE_AUDIT).
