# Score audit (0-100) — formule

> Source de vérité : `apps/api/services/quality_service.py` (`compute_score`,
> fonction pure et reproductible). Ce document EST la spécification ; tout
> changement de formule doit être répercuté ici **et** couvert par un test.

## Qualité d'un datapoint (1-5)

La qualité est **déduite** du `source_path` du fact (aucune migration, aucune
mutation des events append-only), avec override possible via `meta.quality` :

| Niveau | Libellé | Déduction (`derive_quality`) |
|---|---|---|
| 1 | mesure primaire | `meta.quality = 1` explicite |
| 2 | facture / justificatif | pièce justificative active attachée, ou `source_path = master*` |
| 3 | donnée d'activité estimée | `upload:*`, `manual:*`, ou défaut |
| 4 | ratio monétaire | `source_path = fec:*` (screening FEC, T4.3) |
| 5 | extrapolation | `meta.quality = 5` explicite |

## Indicateurs (`compute_indicators`)

- **evidence_coverage** = datapoints avec ≥1 pièce active / total datapoints (0-1)
- **avg_quality** = moyenne des niveaux 1-5 sur les datapoints
- **chain_ok** = `verify_chain()` de la company (booléen)
- **fe_versions** = versions de facteurs d'émission ADEME référencées (fraîcheur)
- **open_anomalies** = anomalies ouvertes (branché au moteur d'alertes en T5.3)

## Formule du score

```
quality_goodness = (6 - avg_quality) / 5      # quality 1 → 1.0 ; quality 5 → 0.2
                 = 0.4 si avg_quality est indéfini (aucun datapoint)

freshness = 1.0 si au moins une version de facteur est référencée, sinon 0.5
chain     = 1.0 si la chaîne est intègre, sinon 0.0

score = 100 × ( 0.30 × evidence_coverage
              + 0.30 × quality_goodness
              + 0.30 × chain
              + 0.10 × freshness )

score = round( clamp(score, 0, 100) )
```

### Poids

| Composante | Poids | Justification |
|---|---|---|
| Couverture de preuve | 0.30 | présence de pièces justificatives par datapoint |
| Qualité de la donnée | 0.30 | primauté de la mesure sur l'estimation |
| Intégrité de la chaîne | 0.30 | non-altération du journal hash-chaîné |
| Fraîcheur des facteurs | 0.10 | actualité des facteurs d'émission appliqués |

### Exemples reproductibles

- Aucune donnée : `coverage=0, avg=∅, chain=ok, fe=∅`
  → `100 × (0 + 0.30×0.4 + 0.30×1 + 0.10×0.5) = round(47) = 47`
- Couverture totale, qualité 2 moyenne, chaîne OK, facteurs présents :
  → `100 × (0.30×1 + 0.30×0.8 + 0.30×1 + 0.10×1) = round(94) = 94`
- Chaîne rompue (tout le reste idéal) : la composante `chain` tombe à 0
  → plafond `≈ 70` : une rupture d'intégrité plombe structurellement le score.
