# Validation live — EEA_WEI_PLUS

**Verdict :** `decoder_deferred`  
**Release :** `eea_v_3035_250_k_wei-subunit-level_p_2023_v01_r00`  
**Exécuté le :** 2026-07-26T09:21:48.696057+00:00  
**Méthode :** `CC-WI-EEA-WEI-PLUS-PASSTHROUGH 1.0.0`  
**Écriture en base :** aucune (`dry_run=true`)  
**Durée :** 0.434 s

## Transferts

| # | URL (sans query) | HTTP | Content-Type | Octets | SHA-256 | Durée |
|---|---|---|---|---|---|---|
| 1 | `https://sdi.eea.europa.eu/catalogue/srv/api/records/b16bd284-f2ec-4164-90b7-674c1de399ba` | 200 | application/json | 54903 | `4a9ab1eac95600d4…` | 0.433 s |

## Acquisition

- pages : **0**
- octets : **0**
- format réellement reçu : **n/a**
- checksum du payload (SHA-256) : `n/a`

## Normalisation

- records reçus : **0**
- records normalisés : **0**
- records rejetés : **0**
- valeurs absentes conservées absentes : **0**
- records publiables : **0** (X1 ne publie rien, par construction)
- causes de rejet : _aucune_

## Contenu observé

- unités : _aucune_
- périodes : _aucune_
- géographies : _aucune_

## Pipeline (dry-run)

- étapes exécutées : _aucune_
- étapes en échec : _aucune_

## Bornes demandées

- `max_bytes` : 5000000
- `timeout_seconds` : 25.0

## Paramètres de recette

- `dataset_code` : `eea_v_3035_250_k_wei-subunit-level_p_2023_v01_r00`
- `doi` : `10.2909/b16bd284-f2ec-4164-90b7-674c1de399ba`
- `edition` : `01.00`
- `release_scale` : `subunit`

## Avertissements

- identité vérifiée sur la fiche officielle : code de jeu, titre et licence CC-BY-4.0 concordent avec la release épinglée.

## Erreurs

- _aucune_

## Notes

- Le conteneur officiel n'est ni CSV ni texte : la fiche EEA annonce « Spatial data in SHP format » et « WEI+ data in Excel format ». Le connecteur ne décode aucun des deux et refuse de deviner les noms de colonnes du classeur — la conversion vers le format canonique (spatialUnitIdentifier, year, quarter, wei_plus_pct, unit) reste un geste opérateur, à livrer avant X2.
- Aucun extrait fourni : cette exécution vérifie l'IDENTITÉ de la release, pas son contenu. Elle ne peut donc pas conclure `ready_for_staging`.
- Aucune décision de licence fournie au pipeline : la licence CC-BY 4.0 est LUE sur la fiche officielle et citée, jamais transformée en autorisation de publier. `records_publishable` reste à 0.

---

<details><summary>Rapport structuré (JSON)</summary>

```json
{
  "bytes_received": 0,
  "dry_run": true,
  "duration_seconds": 0.434,
  "errors": [],
  "executed_at": "2026-07-26T09:21:48.696057+00:00",
  "geographies": [],
  "limits": {
    "max_bytes": 5000000,
    "timeout_seconds": 25.0
  },
  "method": "CC-WI-EEA-WEI-PLUS-PASSTHROUGH 1.0.0",
  "notes": [
    "Le conteneur officiel n'est ni CSV ni texte : la fiche EEA annonce « Spatial data in SHP format » et « WEI+ data in Excel format ». Le connecteur ne décode aucun des deux et refuse de deviner les noms de colonnes du classeur — la conversion vers le format canonique (spatialUnitIdentifier, year, quarter, wei_plus_pct, unit) reste un geste opérateur, à livrer avant X2.",
    "Aucun extrait fourni : cette exécution vérifie l'IDENTITÉ de la release, pas son contenu. Elle ne peut donc pas conclure `ready_for_staging`.",
    "Aucune décision de licence fournie au pipeline : la licence CC-BY 4.0 est LUE sur la fiche officielle et citée, jamais transformée en autorisation de publier. `records_publishable` reste à 0."
  ],
  "pages_fetched": 0,
  "payload_format": null,
  "payload_sha256": null,
  "periods": [],
  "pipeline_steps_executed": [],
  "pipeline_steps_failed": [],
  "query_parameters": {
    "dataset_code": "eea_v_3035_250_k_wei-subunit-level_p_2023_v01_r00",
    "doi": "10.2909/b16bd284-f2ec-4164-90b7-674c1de399ba",
    "edition": "01.00",
    "release_scale": "subunit"
  },
  "records_absent_value": 0,
  "records_normalized": 0,
  "records_publishable": 0,
  "records_received": 0,
  "records_rejected": 0,
  "rejection_causes": [],
  "release_key": "eea_v_3035_250_k_wei-subunit-level_p_2023_v01_r00",
  "source_code": "EEA_WEI_PLUS",
  "transfers": [
    {
      "bytes_received": 54903,
      "content_type": "application/json",
      "elapsed_seconds": 0.433,
      "error": null,
      "params": [],
      "redirects": [],
      "sha256": "4a9ab1eac95600d499afc4e922a4b5974b03bd47fbba854d0212128c3729aaba",
      "status_code": 200,
      "url": "https://sdi.eea.europa.eu/catalogue/srv/api/records/b16bd284-f2ec-4164-90b7-674c1de399ba"
    }
  ],
  "units": [],
  "verdict": "decoder_deferred",
  "warnings": [
    "identité vérifiée sur la fiche officielle : code de jeu, titre et licence CC-BY-4.0 concordent avec la release épinglée."
  ]
}
```

</details>
