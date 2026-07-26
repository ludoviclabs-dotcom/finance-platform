# Validation live — HUBEAU_HYDROMETRIE

**Verdict :** `schema_drift`  
**Release :** `hubeau-hydrometrie-obs-elab-2026-07-26-recette-x1`  
**Exécuté le :** 2026-07-26T09:21:49.944484+00:00  
**Méthode :** `CC-WI-HUBEAU-HYDRO-PASSTHROUGH 1.0.0`  
**Écriture en base :** aucune (`dry_run=true`)  
**Durée :** 0.141 s

## Transferts

| # | URL (sans query) | HTTP | Content-Type | Octets | SHA-256 | Durée |
|---|---|---|---|---|---|---|
| 1 | `https://hubeau.eaufrance.fr/api/v2/hydrometrie/obs_elab` | 200 | application/json | 12451 | `738ed7f6089496b2…` | 0.140 s |

## Acquisition

- pages : **1**
- octets : **12451**
- format réellement reçu : **application/json**
- checksum du payload (SHA-256) : `738ed7f6089496b2e07dc8206e48e233a7c889a7526073d458ec8184df70aae4`

## Normalisation

- records reçus : **0**
- records normalisés : **0**
- records rejetés : **32**
- valeurs absentes conservées absentes : **0**
- records publiables : **0** (X1 ne publie rien, par construction)
- causes de rejet :
  - HubeauSchemaError : page 1 ligne 1 : grandeur 'HIXM' hors vocabulaire officiel ['H', 'Q'].

## Contenu observé

- unités : _aucune_
- périodes : _aucune_
- géographies : _aucune_

## Pipeline (dry-run)

- étapes exécutées : _aucune_
- étapes en échec : _aucune_

## Bornes demandées

- `max_bytes` : 1000000
- `max_pages` : 2
- `page_size` : 100
- `timeout_seconds` : 20.0

## Paramètres de recette

- `code_entite` : `O400101101`
- `date_debut_obs_elab` : `2026-06-01`
- `date_fin_obs_elab` : `2026-06-07`

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
  "bytes_received": 12451,
  "dry_run": true,
  "duration_seconds": 0.141,
  "errors": [],
  "executed_at": "2026-07-26T09:21:49.944484+00:00",
  "geographies": [],
  "limits": {
    "max_bytes": 1000000,
    "max_pages": 2,
    "page_size": 100,
    "timeout_seconds": 20.0
  },
  "method": "CC-WI-HUBEAU-HYDRO-PASSTHROUGH 1.0.0",
  "notes": [
    "Échantillon TECHNIQUE de recette : les bornes géographiques et temporelles ont été choisies pour valider le connecteur, pas pour documenter un territoire.",
    "Aucune décision de licence fournie : toutes les valeurs sont retenues (`value_withheld`), `records_publishable` reste à 0."
  ],
  "pages_fetched": 1,
  "payload_format": "application/json",
  "payload_sha256": "738ed7f6089496b2e07dc8206e48e233a7c889a7526073d458ec8184df70aae4",
  "periods": [],
  "pipeline_steps_executed": [],
  "pipeline_steps_failed": [],
  "query_parameters": {
    "code_entite": "O400101101",
    "date_debut_obs_elab": "2026-06-01",
    "date_fin_obs_elab": "2026-06-07"
  },
  "records_absent_value": 0,
  "records_normalized": 0,
  "records_publishable": 0,
  "records_received": 0,
  "records_rejected": 32,
  "rejection_causes": [
    "HubeauSchemaError : page 1 ligne 1 : grandeur 'HIXM' hors vocabulaire officiel ['H', 'Q']."
  ],
  "release_key": "hubeau-hydrometrie-obs-elab-2026-07-26-recette-x1",
  "source_code": "HUBEAU_HYDROMETRIE",
  "transfers": [
    {
      "bytes_received": 12451,
      "content_type": "application/json",
      "elapsed_seconds": 0.14,
      "error": null,
      "params": [
        [
          "code_entite",
          "O400101101"
        ],
        [
          "date_debut_obs_elab",
          "2026-06-01"
        ],
        [
          "date_fin_obs_elab",
          "2026-06-07"
        ],
        [
          "page",
          "1"
        ],
        [
          "size",
          "100"
        ]
      ],
      "redirects": [],
      "sha256": "738ed7f6089496b2e07dc8206e48e233a7c889a7526073d458ec8184df70aae4",
      "status_code": 200,
      "url": "https://hubeau.eaufrance.fr/api/v2/hydrometrie/obs_elab"
    }
  ],
  "units": [],
  "verdict": "schema_drift",
  "warnings": []
}
```

</details>
