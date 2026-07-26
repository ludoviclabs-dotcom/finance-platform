# Validation live — HUBEAU_QUALITE_SURFACE

**Verdict :** `ready_for_staging`  
**Release :** `hubeau-naiades-analyse-pc-2026-07-26-recette-x1`  
**Exécuté le :** 2026-07-26T09:21:52.814128+00:00  
**Méthode :** `CC-WI-HUBEAU-NAIADES-PASSTHROUGH 1.0.0`  
**Écriture en base :** aucune (`dry_run=true`)  
**Durée :** 0.208 s

## Transferts

| # | URL (sans query) | HTTP | Content-Type | Octets | SHA-256 | Durée |
|---|---|---|---|---|---|---|
| 1 | `https://hubeau.eaufrance.fr/api/v2/qualite_rivieres/analyse_pc` | 206 | application/json | 293799 | `cc88d7071ad05926…` | 0.183 s |

## Acquisition

- pages : **1**
- octets : **293799**
- format réellement reçu : **application/json**
- checksum du payload (SHA-256) : `cc88d7071ad059264905570f59e9f59738604f92697f3ffbea45a2a030ce0e45`

## Normalisation

- records reçus : **50**
- records normalisés : **50**
- records rejetés : **0**
- valeurs absentes conservées absentes : **0**
- records publiables : **0** (X1 ne publie rien, par construction)
- causes de rejet : _aucune_

## Contenu observé

- unités : `mg(NO2)/L`, `mg(NO3)/L`
- périodes : `2024-01-03 → 2024-01-15`
- géographies : `06000579`, `06000580`, `06178006`, `06178014`, `06181150`, `… (+16)`

## Pipeline (dry-run)

- étapes exécutées : `plan`, `fetch`, `parse`, `normalize`, `derive`, `validate`, `publish`
- étapes en échec : _aucune_

## Bornes demandées

- `max_bytes` : 1000000
- `max_pages` : 1
- `page_size` : 50
- `timeout_seconds` : 20.0

## Paramètres de recette

- `code_departement` : `34`
- `code_parametre` : `1340,1339`
- `date_debut_prelevement` : `2024-01-01`
- `date_fin_prelevement` : `2024-03-31`

## Avertissements

- Aucun code de remarque n'a été déclaré comme censurant : les remarques sont transportées verbatim et aucune censure n'est déduite. Le vocabulaire SANDRE de `code_remarque` n'a pas été vérifié par ce connecteur.
- licence inconnue (aucune license_decision fournie ; catalogue P01b également 'unknown') — toutes les valeurs sont retenues (value_withheld).
- 50 observation(s) retenue(s) (value_withheld), 0/50 publiable(s).

## Erreurs

- _aucune_

## Notes

- Échantillon TECHNIQUE de recette : les bornes géographiques et temporelles ont été choisies pour valider le connecteur, pas pour documenter un territoire.
- Aucune décision de licence fournie : toutes les valeurs sont retenues (`value_withheld`), `records_publishable` reste à 0.

---

<details><summary>Rapport structuré (JSON)</summary>

```json
{
  "bytes_received": 293799,
  "dry_run": true,
  "duration_seconds": 0.208,
  "errors": [],
  "executed_at": "2026-07-26T09:21:52.814128+00:00",
  "geographies": [
    "06000579",
    "06000580",
    "06178006",
    "06178014",
    "06181150",
    "… (+16)"
  ],
  "limits": {
    "max_bytes": 1000000,
    "max_pages": 1,
    "page_size": 50,
    "timeout_seconds": 20.0
  },
  "method": "CC-WI-HUBEAU-NAIADES-PASSTHROUGH 1.0.0",
  "notes": [
    "Échantillon TECHNIQUE de recette : les bornes géographiques et temporelles ont été choisies pour valider le connecteur, pas pour documenter un territoire.",
    "Aucune décision de licence fournie : toutes les valeurs sont retenues (`value_withheld`), `records_publishable` reste à 0."
  ],
  "pages_fetched": 1,
  "payload_format": "application/json",
  "payload_sha256": "cc88d7071ad059264905570f59e9f59738604f92697f3ffbea45a2a030ce0e45",
  "periods": [
    "2024-01-03 → 2024-01-15"
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
    "code_departement": "34",
    "code_parametre": "1340,1339",
    "date_debut_prelevement": "2024-01-01",
    "date_fin_prelevement": "2024-03-31"
  },
  "records_absent_value": 0,
  "records_normalized": 50,
  "records_publishable": 0,
  "records_received": 50,
  "records_rejected": 0,
  "rejection_causes": [],
  "release_key": "hubeau-naiades-analyse-pc-2026-07-26-recette-x1",
  "source_code": "HUBEAU_QUALITE_SURFACE",
  "transfers": [
    {
      "bytes_received": 293799,
      "content_type": "application/json",
      "elapsed_seconds": 0.183,
      "error": null,
      "params": [
        [
          "code_departement",
          "34"
        ],
        [
          "code_parametre",
          "1340,1339"
        ],
        [
          "date_debut_prelevement",
          "2024-01-01"
        ],
        [
          "date_fin_prelevement",
          "2024-03-31"
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
      "sha256": "cc88d7071ad059264905570f59e9f59738604f92697f3ffbea45a2a030ce0e45",
      "status_code": 206,
      "url": "https://hubeau.eaufrance.fr/api/v2/qualite_rivieres/analyse_pc"
    }
  ],
  "units": [
    "mg(NO2)/L",
    "mg(NO3)/L"
  ],
  "verdict": "ready_for_staging",
  "warnings": [
    "Aucun code de remarque n'a été déclaré comme censurant : les remarques sont transportées verbatim et aucune censure n'est déduite. Le vocabulaire SANDRE de `code_remarque` n'a pas été vérifié par ce connecteur.",
    "licence inconnue (aucune license_decision fournie ; catalogue P01b également 'unknown') — toutes les valeurs sont retenues (value_withheld).",
    "50 observation(s) retenue(s) (value_withheld), 0/50 publiable(s)."
  ]
}
```

</details>
