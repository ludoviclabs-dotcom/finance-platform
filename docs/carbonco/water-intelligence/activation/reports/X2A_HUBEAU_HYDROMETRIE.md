# Validation live — HUBEAU_HYDROMETRIE

**Verdict :** `ready_for_staging`  
**Release :** `hubeau-hydrometrie-observations-tr-2026-07-26-x2a`  
**Exécuté le :** 2026-07-26T11:22:23.677207+00:00  
**Méthode :** `CC-WI-HUBEAU-HYDRO-PASSTHROUGH 1.0.0`  
**Écriture en base :** aucune (`dry_run=true`)  
**Durée :** 0.462 s

## Transferts

| # | URL (sans query) | HTTP | Content-Type | Octets | SHA-256 | Durée |
|---|---|---|---|---|---|---|
| 1 | `https://hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr` | 206 | application/json | 51305 | `a84ea7e4535100ad…` | 0.288 s |
| 2 | `https://hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr` | 206 | application/json | 51305 | `f3c7c09ff5e1b9dd…` | 0.144 s |

## Acquisition

- pages : **2**
- octets : **102610**
- format réellement reçu : **application/json**
- checksum du payload (SHA-256) : `7bd24e0c3502293fe6c6589c85aed7266adefb5ed5b82182b8dc7176e7329155`

## Normalisation

- records reçus : **200**
- records normalisés : **200**
- records rejetés : **0**
- valeurs absentes conservées absentes : **0**
- records publiables : **0** (X1 ne publie rien, par construction)
- causes de rejet : _aucune_

## Contenu observé

- unités : `mm`
- périodes : `2026-07-21 → 2026-07-26`
- géographies : `O400101101`

## Pipeline (dry-run)

- étapes exécutées : `plan`, `fetch`, `parse`, `normalize`, `derive`, `validate`, `publish`
- étapes en échec : _aucune_

## Bornes demandées

- `max_bytes` : 1000000
- `max_pages` : 2
- `page_size` : 100
- `timeout_seconds` : 20.0

## Paramètres de recette

- `code_entite` : `O400101101`
- `date_debut_obs` : `2026-07-20`
- `date_fin_obs` : `2026-07-26`
- `grandeur_hydro` : `H`

## Avertissements

- licence inconnue (aucune license_decision fournie ; catalogue P01b également 'unknown') — toutes les valeurs sont retenues (value_withheld).
- 200 observation(s) retenue(s) (value_withheld), 0/200 publiable(s).

## Erreurs

- _aucune_

## Notes

- Échantillon TECHNIQUE de recette : les bornes géographiques et temporelles ont été choisies pour valider le connecteur, pas pour documenter un territoire.
- Aucune décision de licence fournie : toutes les valeurs sont retenues (`value_withheld`), `records_publishable` reste à 0.

---

<details><summary>Rapport structuré (JSON)</summary>

```json
{
  "bytes_received": 102610,
  "dry_run": true,
  "duration_seconds": 0.462,
  "errors": [],
  "executed_at": "2026-07-26T11:22:23.677207+00:00",
  "geographies": [
    "O400101101"
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
  "pages_fetched": 2,
  "payload_format": "application/json",
  "payload_sha256": "7bd24e0c3502293fe6c6589c85aed7266adefb5ed5b82182b8dc7176e7329155",
  "periods": [
    "2026-07-21 → 2026-07-26"
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
    "code_entite": "O400101101",
    "date_debut_obs": "2026-07-20",
    "date_fin_obs": "2026-07-26",
    "grandeur_hydro": "H"
  },
  "records_absent_value": 0,
  "records_normalized": 200,
  "records_publishable": 0,
  "records_received": 200,
  "records_rejected": 0,
  "rejection_causes": [],
  "release_key": "hubeau-hydrometrie-observations-tr-2026-07-26-x2a",
  "source_code": "HUBEAU_HYDROMETRIE",
  "transfers": [
    {
      "bytes_received": 51305,
      "content_type": "application/json",
      "elapsed_seconds": 0.288,
      "error": null,
      "params": [
        [
          "code_entite",
          "O400101101"
        ],
        [
          "date_debut_obs",
          "2026-07-20"
        ],
        [
          "date_fin_obs",
          "2026-07-26"
        ],
        [
          "grandeur_hydro",
          "H"
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
      "sha256": "a84ea7e4535100adda4a38235de52cd559a53da9f9e4f7869415c31d92702944",
      "status_code": 206,
      "url": "https://hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr"
    },
    {
      "bytes_received": 51305,
      "content_type": "application/json",
      "elapsed_seconds": 0.144,
      "error": null,
      "params": [
        [
          "code_entite",
          "O400101101"
        ],
        [
          "date_debut_obs",
          "2026-07-20"
        ],
        [
          "date_fin_obs",
          "2026-07-26"
        ],
        [
          "grandeur_hydro",
          "H"
        ],
        [
          "page",
          "2"
        ],
        [
          "size",
          "100"
        ]
      ],
      "redirects": [],
      "sha256": "f3c7c09ff5e1b9ddb9b86d2b918e01e6e85ac8c12d58491f8db0806202c23c40",
      "status_code": 206,
      "url": "https://hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr"
    }
  ],
  "units": [
    "mm"
  ],
  "verdict": "ready_for_staging",
  "warnings": [
    "licence inconnue (aucune license_decision fournie ; catalogue P01b également 'unknown') — toutes les valeurs sont retenues (value_withheld).",
    "200 observation(s) retenue(s) (value_withheld), 0/200 publiable(s)."
  ]
}
```

</details>
