# Validation live — HUBEAU_ADES

**Verdict :** `ready_for_staging`  
**Release :** `hubeau-piezometrie-chroniques-2026-07-26-recette-x1`  
**Exécuté le :** 2026-07-26T09:21:50.883714+00:00  
**Méthode :** `CC-WI-HUBEAU-HYDRO-PASSTHROUGH 1.0.0`  
**Écriture en base :** aucune (`dry_run=true`)  
**Durée :** 0.189 s

## Transferts

| # | URL (sans query) | HTTP | Content-Type | Octets | SHA-256 | Durée |
|---|---|---|---|---|---|---|
| 1 | `https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/chroniques` | 200 | application/json | 52139 | `52bc5f94759d7c96…` | 0.164 s |

## Acquisition

- pages : **1**
- octets : **52139**
- format réellement reçu : **application/json**
- checksum du payload (SHA-256) : `52bc5f94759d7c96b06ef2853fd417342e2a9e409f77e2900af9ad2518bbd7c6`

## Normalisation

- records reçus : **182**
- records normalisés : **182**
- records rejetés : **0**
- valeurs absentes conservées absentes : **0**
- records publiables : **0** (X1 ne publie rien, par construction)
- causes de rejet : _aucune_

## Contenu observé

- unités : `m`, `m NGF`
- périodes : `2024-01-01 → 2024-03-31`
- géographies : `09892X0679/EXH70`

## Pipeline (dry-run)

- étapes exécutées : `plan`, `fetch`, `parse`, `normalize`, `derive`, `validate`, `publish`
- étapes en échec : _aucune_

## Bornes demandées

- `max_bytes` : 1000000
- `max_pages` : 2
- `page_size` : 100
- `timeout_seconds` : 20.0

## Paramètres de recette

- `code_bss` : `09892X0679/EXH70`
- `date_debut_mesure` : `2024-01-01`
- `date_fin_mesure` : `2024-03-31`

## Avertissements

- licence inconnue (aucune license_decision fournie ; catalogue P01b également 'unknown') — toutes les valeurs sont retenues (value_withheld).
- 182 observation(s) retenue(s) (value_withheld), 0/182 publiable(s).

## Erreurs

- _aucune_

## Notes

- Échantillon TECHNIQUE de recette : les bornes géographiques et temporelles ont été choisies pour valider le connecteur, pas pour documenter un territoire.
- Aucune décision de licence fournie : toutes les valeurs sont retenues (`value_withheld`), `records_publishable` reste à 0.

---

<details><summary>Rapport structuré (JSON)</summary>

```json
{
  "bytes_received": 52139,
  "dry_run": true,
  "duration_seconds": 0.189,
  "errors": [],
  "executed_at": "2026-07-26T09:21:50.883714+00:00",
  "geographies": [
    "09892X0679/EXH70"
  ],
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
  "payload_sha256": "52bc5f94759d7c96b06ef2853fd417342e2a9e409f77e2900af9ad2518bbd7c6",
  "periods": [
    "2024-01-01 → 2024-03-31"
  ],
  "pipeline_steps_executed": [
    "plan",
    "fetch",
    "parse",
    "normalize",
    "derive",
    "validate",
    "publish"
  ],
  "pipeline_steps_failed": [],
  "query_parameters": {
    "code_bss": "09892X0679/EXH70",
    "date_debut_mesure": "2024-01-01",
    "date_fin_mesure": "2024-03-31"
  },
  "records_absent_value": 0,
  "records_normalized": 182,
  "records_publishable": 0,
  "records_received": 182,
  "records_rejected": 0,
  "rejection_causes": [],
  "release_key": "hubeau-piezometrie-chroniques-2026-07-26-recette-x1",
  "source_code": "HUBEAU_ADES",
  "transfers": [
    {
      "bytes_received": 52139,
      "content_type": "application/json",
      "elapsed_seconds": 0.164,
      "error": null,
      "params": [
        [
          "code_bss",
          "09892X0679/EXH70"
        ],
        [
          "date_debut_mesure",
          "2024-01-01"
        ],
        [
          "date_fin_mesure",
          "2024-03-31"
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
      "sha256": "52bc5f94759d7c96b06ef2853fd417342e2a9e409f77e2900af9ad2518bbd7c6",
      "status_code": 200,
      "url": "https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/chroniques"
    }
  ],
  "units": [
    "m",
    "m NGF"
  ],
  "verdict": "ready_for_staging",
  "warnings": [
    "licence inconnue (aucune license_decision fournie ; catalogue P01b également 'unknown') — toutes les valeurs sont retenues (value_withheld).",
    "182 observation(s) retenue(s) (value_withheld), 0/182 publiable(s)."
  ]
}
```

</details>
