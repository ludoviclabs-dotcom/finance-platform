# Validation live — HUBEAU_BNPE_PRELEVEMENTS

**Verdict :** `ready_for_staging`  
**Release :** `hubeau-bnpe-chroniques-2026-07-26-x2a`  
**Exécuté le :** 2026-07-26T11:22:34.151989+00:00  
**Méthode :** `CC-WI-HUBEAU-BNPE-PASSTHROUGH 1.0.0`  
**Écriture en base :** aucune (`dry_run=true`)  
**Durée :** 0.000 s

## Transferts

| # | URL (sans query) | HTTP | Content-Type | Octets | SHA-256 | Durée |
|---|---|---|---|---|---|---|
| 1 | `https://hubeau.eaufrance.fr/api/v1/prelevements/chroniques` | 206 | application/json | 47890 | `a72f6e472f0db12f…` | 0.153 s |

## Acquisition

- pages : **1**
- octets : **47890**
- format réellement reçu : **application/json**
- checksum du payload (SHA-256) : `a72f6e472f0db12f0717f7d2831ab5caa03bff568a05131c6220e2c505a559e4`

## Normalisation

- records reçus : **50**
- records normalisés : **50**
- records rejetés : **0**
- valeurs absentes conservées absentes : **0**
- records publiables : **0** (X1 ne publie rien, par construction)
- causes de rejet : _aucune_

## Contenu observé

- unités : `m3`
- périodes : `2020 → 2020 (1 requête(s) distincte(s))`
- géographies : `OPR0000028733`, `OPR0000028734`, `OPR0000028735`, `OPR0000028736`, `OPR0000028737`, `… (+45)`

## Pipeline (dry-run)

- étapes exécutées : `derive`, `fetch`, `normalize`, `parse`, `plan`, `publish`, `validate`
- étapes en échec : _aucune_

## Bornes demandées

- `max_bytes_per_year` : 1000000
- `max_pages_per_year` : 1
- `max_total_bytes` : 1000000
- `max_years` : 1
- `page_size` : 50
- `timeout_seconds` : 20.0

## Paramètres de recette

- `annee_from` : `2020`
- `annee_to` : `2020`
- `code_departement` : `34`
- `orchestration` : `une requête distincte par année (annee=<AAAA>)`

## Avertissements

- année 2020 : Couverture partielle par construction : les volumes prélevés pour des usages exonérés de redevance ne sont pas connus, et les volumes inférieurs à 10000 m³ ne sont pas déclarés. Une absence de déclaration n'est JAMAIS un prélèvement nul.
- année 2020 : licence inconnue (aucune license_decision fournie ; catalogue P01b également 'unknown') — toutes les valeurs sont retenues (value_withheld).
- année 2020 : 50 observation(s) retenue(s) (value_withheld), 0/50 publiable(s).

## Erreurs

- _aucune_

## Notes

- Échantillon TECHNIQUE de recette : les bornes géographiques et temporelles ont été choisies pour valider le connecteur, pas pour documenter un territoire.
- Une requête HTTP distincte par année (`annee=<AAAA>`) — jamais `annee_min`/`annee_max`, ignorés en silence par la plateforme (cf. X1_LIVE_VALIDATION_HANDOFF.md §2.2).
- Aucune décision de licence fournie : toutes les valeurs sont retenues (`value_withheld`), `records_publishable` reste à 0.

---

<details><summary>Rapport structuré (JSON)</summary>

```json
{
  "bytes_received": 47890,
  "dry_run": true,
  "duration_seconds": 0.0,
  "errors": [],
  "executed_at": "2026-07-26T11:22:34.151989+00:00",
  "geographies": [
    "OPR0000028733",
    "OPR0000028734",
    "OPR0000028735",
    "OPR0000028736",
    "OPR0000028737",
    "… (+45)"
  ],
  "limits": {
    "max_bytes_per_year": 1000000,
    "max_pages_per_year": 1,
    "max_total_bytes": 1000000,
    "max_years": 1,
    "page_size": 50,
    "timeout_seconds": 20.0
  },
  "method": "CC-WI-HUBEAU-BNPE-PASSTHROUGH 1.0.0",
  "notes": [
    "Échantillon TECHNIQUE de recette : les bornes géographiques et temporelles ont été choisies pour valider le connecteur, pas pour documenter un territoire.",
    "Une requête HTTP distincte par année (`annee=<AAAA>`) — jamais `annee_min`/`annee_max`, ignorés en silence par la plateforme (cf. X1_LIVE_VALIDATION_HANDOFF.md §2.2).",
    "Aucune décision de licence fournie : toutes les valeurs sont retenues (`value_withheld`), `records_publishable` reste à 0."
  ],
  "pages_fetched": 1,
  "payload_format": "application/json",
  "payload_sha256": "a72f6e472f0db12f0717f7d2831ab5caa03bff568a05131c6220e2c505a559e4",
  "periods": [
    "2020 → 2020 (1 requête(s) distincte(s))"
  ],
  "pipeline_steps_executed": [
    "derive",
    "fetch",
    "normalize",
    "parse",
    "plan",
    "publish",
    "validate"
  ],
  "pipeline_steps_failed": [],
  "query_parameters": {
    "annee_from": "2020",
    "annee_to": "2020",
    "code_departement": "34",
    "orchestration": "une requête distincte par année (annee=<AAAA>)"
  },
  "records_absent_value": 0,
  "records_normalized": 50,
  "records_publishable": 0,
  "records_received": 50,
  "records_rejected": 0,
  "rejection_causes": [],
  "release_key": "hubeau-bnpe-chroniques-2026-07-26-x2a",
  "source_code": "HUBEAU_BNPE_PRELEVEMENTS",
  "transfers": [
    {
      "bytes_received": 47890,
      "content_type": "application/json",
      "elapsed_seconds": 0.153,
      "error": null,
      "params": [
        [
          "annee",
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
      "sha256": "a72f6e472f0db12f0717f7d2831ab5caa03bff568a05131c6220e2c505a559e4",
      "status_code": 206,
      "url": "https://hubeau.eaufrance.fr/api/v1/prelevements/chroniques"
    }
  ],
  "units": [
    "m3"
  ],
  "verdict": "ready_for_staging",
  "warnings": [
    "année 2020 : Couverture partielle par construction : les volumes prélevés pour des usages exonérés de redevance ne sont pas connus, et les volumes inférieurs à 10000 m³ ne sont pas déclarés. Une absence de déclaration n'est JAMAIS un prélèvement nul.",
    "année 2020 : licence inconnue (aucune license_decision fournie ; catalogue P01b également 'unknown') — toutes les valeurs sont retenues (value_withheld).",
    "année 2020 : 50 observation(s) retenue(s) (value_withheld), 0/50 publiable(s)."
  ]
}
```

</details>
