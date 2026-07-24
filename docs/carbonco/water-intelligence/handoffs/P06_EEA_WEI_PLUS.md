# P06 — Connecteur EEA / WISE / WEI+

**Livré dans :** Wave A (`feat/water-intelligence-wave-a-eu-connectors`).
**Contexte de vague, gate complet et décisions :**
[`WAVE_A_EU_CONNECTORS.md`](./WAVE_A_EU_CONNECTORS.md) §2.

---

## 1. Fichiers

| Fichier | Contenu |
|---|---|
| `apps/api/services/water_intelligence/connectors/eea_wei_plus.py` | Connecteur complet : identité de release vérifiée, schéma canonique, parsing, agrégat, comparatif borné, descripteur de couche, intégration P03 |
| `apps/api/tests/test_water_intelligence_eea_wei_plus.py` | 79 tests |
| `apps/api/tests/fixtures/eea_wei_plus_subunit_fixture.csv` | Extrait fixture (3 unités × 2 trimestres, dont une unité sans valeur) |
| `apps/api/tests/fixtures/eea_wei_plus_unknown_column_fixture.csv` | Extrait au schéma refusé (colonne de libellé) |

Aucune géométrie, aucun classeur, aucun binaire versionné.

## 2. Identité de release épinglée

Deux échelles vérifiées, édition `01.00`, publiées le 2026-01-29, étendue
2000-2023 trimestrielle, EPSG:3035, 1:250 000 :

- `subunit` → `eea_v_3035_250_k_wei-subunit-level_p_2023_v01_r00`,
  DOI `10.2909/b16bd284-f2ec-4164-90b7-674c1de399ba` ;
- `riverbasin` → `eea_v_3035_250_k_wei-riverbasin-level_p_2023_v01_r00`,
  DOI `10.2909/f25b4715-d18b-4f87-b869-7e96fd385700`.

Toute autre échelle est refusée : le module ne connaît que ce qu'il a vérifié.

## 3. Critères d'acceptation P06

| Critère | État |
|---|---|
| Release et période visibles | `DATASET_RELEASES` + `metric_code` portant le trimestre + métadonnées de draft |
| Distinction structurel / saisonnier | Le WEI+ **est** l'indicateur structurel ; la saisonnalité est le trimestre, jamais aplatie (test dédié) |
| Couverture et confiance séparées | `coverage_pct` sur l'agrégat, distinct du stress ; confiance documentaire jamais mélangée à la valeur |
| Couche conforme au budget | `build_layer_descriptor` refuse au-delà de 1 000 entités |
| Tests purs et import idempotent | Aucun réseau/BDD (AST), checksums stables, drafts idempotents |

## 4. Interdictions P06 — comment elles sont tenues

- **Aucune jointure par libellé** : seul `spatialUnitIdentifier` est accepté
  comme clé, aucune colonne de nom n'entre dans le schéma canonique, et le
  `label` d'une géographie est l'identifiant lui-même.
- **Aucun remplissage spatial arbitraire** : une valeur absente ne produit
  aucun draft ; elle n'est ni interpolée, ni mise à 0, ni interprétée comme
  « pas de stress ».
- **Aucune moyenne inter-bassins sans pondération documentée** : aucune
  moyenne du tout. Le WEI+ est un ratio et la release ne publie pas les
  volumes nécessaires à une pondération. L'agrégat est une distribution de
  comptes ; un test interdit tout champ `mean`/`avg`/`average`.
- **Aucune requête live depuis la page** : aucun frontend n'est touché,
  aucun client HTTP n'est importé (vérifié par AST).
- **Aucun historique complet non borné** : `bounded_periods()` refuse
  au-delà de 8 périodes distinctes.

## 5. Limites

1. **Vocabulaire d'en-tête officiel non vérifié** → format canonique défini
   par le connecteur, conversion = geste opérateur documenté (Wave A §2.4).
2. **Libellés officiels non repris** → `label` = identifiant.
3. **Période aplatie par P03** → trimestre encodé dans le `metric_code` ;
   arbitrage P10 attendu (Wave A §5.1).
4. **Incertitudes de source** : l'EEA signale de fortes incertitudes pour la
   Suisse et la France (données modélisées en baseline). À propager en P10.

## 6. Reliquats pour la suite

- Décider en P10 si `derive` doit propager `period_start`/`period_end` et les
  métadonnées du draft, ou si la convention `metric_code` devient officielle.
- Obtenir une `WaterLicenseDecision` réelle via `license_policy.evaluate()`
  sur une ligne `source_registry` (à créer hors P06) avant toute publication.
- Produire la couche cartographique réelle (P11) à partir du SHP officiel,
  hors dépôt, en respectant le budget de 1 000 entités.
