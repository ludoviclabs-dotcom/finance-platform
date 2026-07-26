# Validation live — HUBEAU_BNPE_PRELEVEMENTS

**Verdict :** `schema_drift`  
**Release :** `hubeau-bnpe-chroniques-2026-07-26-recette-x1`  
**Exécuté le :** 2026-07-26T09:21:51.870538+00:00  
**Méthode :** `CC-WI-HUBEAU-BNPE-PASSTHROUGH 1.0.0`  
**Écriture en base :** aucune (`dry_run=true`)  
**Durée :** 0.151 s

## Transferts

| # | URL (sans query) | HTTP | Content-Type | Octets | SHA-256 | Durée |
|---|---|---|---|---|---|---|
| 1 | `https://hubeau.eaufrance.fr/api/v1/prelevements/chroniques` | 206 | application/json | 46369 | `338178bd32cc2df1…` | 0.149 s |

## Acquisition

- pages : **1**
- octets : **46369**
- format réellement reçu : **application/json**
- checksum du payload (SHA-256) : `338178bd32cc2df10306b5b158c36c5473f43effe2c44868bcf93b9e1a84f758`

## Normalisation

- records reçus : **0**
- records normalisés : **0**
- records rejetés : **50**
- valeurs absentes conservées absentes : **0**
- records publiables : **0** (X1 ne publie rien, par construction)
- causes de rejet :
  - HubeauUsageSchemaError : page 1 ligne 1 : année 2008 hors de la fenêtre demandée (2020-2021).

## Contenu observé

- unités : _aucune_
- périodes : _aucune_
- géographies : _aucune_

## Pipeline (dry-run)

- étapes exécutées : _aucune_
- étapes en échec : _aucune_

## Bornes demandées

- `max_bytes` : 1000000
- `max_pages` : 1
- `page_size` : 50
- `timeout_seconds` : 20.0

## Paramètres de recette

- `annee_max` : `2021`
- `annee_min` : `2020`
- `code_departement` : `34`

## Avertissements

- _aucun_

## Erreurs

- _aucune_

## Notes

- Échantillon TECHNIQUE de recette : les bornes géographiques et temporelles ont été choisies pour valider le connecteur, pas pour documenter un territoire.
- Aucune décision de licence fournie : toutes les valeurs sont retenues (`value_withheld`), `records_publishable` reste à 0.

---

<details><summary>Rapport structuré (JSON)</summary>

```json
{
  "bytes_received": 46369,
  "dry_run": true,
  "duration_seconds": 0.151,
  "errors": [],
  "executed_at": "2026-07-26T09:21:51.870538+00:00",
  "geographies": [],
  "limits": {
    "max_bytes": 1000000,
    "max_pages": 1,
    "page_size": 50,
    "timeout_seconds": 20.0
  },
  "method": "CC-WI-HUBEAU-BNPE-PASSTHROUGH 1.0.0",
  "notes": [
    "Échantillon TECHNIQUE de recette : les bornes géographiques et temporelles ont été choisies pour valider le connecteur, pas pour documenter un territoire.",
    "Aucune décision de licence fournie : toutes les valeurs sont retenues (`value_withheld`), `records_publishable` reste à 0."
  ],
  "pages_fetched": 1,
  "payload_format": "application/json",
  "payload_sha256": "338178bd32cc2df10306b5b158c36c5473f43effe2c44868bcf93b9e1a84f758",
  "periods": [],
  "pipeline_steps_executed": [],
  "pipeline_steps_failed": [],
  "query_parameters": {
    "annee_max": "2021",
    "annee_min": "2020",
    "code_departement": "34"
  },
  "records_absent_value": 0,
  "records_normalized": 0,
  "records_publishable": 0,
  "records_received": 0,
  "records_rejected": 50,
  "rejection_causes": [
    "HubeauUsageSchemaError : page 1 ligne 1 : année 2008 hors de la fenêtre demandée (2020-2021)."
  ],
  "release_key": "hubeau-bnpe-chroniques-2026-07-26-recette-x1",
  "source_code": "HUBEAU_BNPE_PRELEVEMENTS",
  "transfers": [
    {
      "bytes_received": 46369,
      "content_type": "application/json",
      "elapsed_seconds": 0.149,
      "error": null,
      "params": [
        [
          "annee_max",
          "2021"
        ],
        [
          "annee_min",
          "2020"
        ],
        [
          "code_departement",
          "34"
        ],
        [
          "page",
          "1"
        ],
        [
          "size",
          "50"
        ]
      ],
      "redirects": [],
      "sha256": "338178bd32cc2df10306b5b158c36c5473f43effe2c44868bcf93b9e1a84f758",
      "status_code": 206,
      "url": "https://hubeau.eaufrance.fr/api/v1/prelevements/chroniques"
    }
  ],
  "units": [],
  "verdict": "schema_drift",
  "warnings": []
}
```

</details>
