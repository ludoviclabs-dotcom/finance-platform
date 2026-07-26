# Validation live — COPERNICUS_EDO

**Verdict :** `decoder_deferred`  
**Release :** `Combined Drought Indicator (CDI) v4.1`  
**Exécuté le :** 2026-07-26T09:21:53.786669+00:00  
**Méthode :** `CC-WI-COPERNICUS-EDO-SNAPSHOT 1.0.0`  
**Écriture en base :** aucune (`dry_run=true`)  
**Durée :** 0.397 s

## Transferts

| # | URL (sans query) | HTTP | Content-Type | Octets | SHA-256 | Durée |
|---|---|---|---|---|---|---|
| 1 | `https://edo.jrc.ec.europa.eu/edov2/php/index.php` | 200 | text/html; charset=utf-8 | 4115 | `83d3ddd771d48063…` | 0.396 s |
|  | ↳ redirections : `https://drought.emergency.copernicus.eu/edov2/php/index.php`, `https://drought.emergency.copernicus.eu/tumbo/edo/map`, `https://drought.emergency.copernicus.eu/tumbo/edo/map/` | | | | | |

## Acquisition

- pages : **0**
- octets : **0**
- format réellement reçu : **text/html; charset=utf-8**
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

- `decoding` : aucun
- `max_bytes` : 1000000
- `timeout_seconds` : 25.0

## Paramètres de recette

- `connector_status` : `source_verified_decoder_deferred`
- `crs` : `EPSG:4326`
- `product` : `Combined Drought Indicator (CDI)`
- `resolution` : `1/24 decimal degree (around 5 km at the Equator)`
- `version` : `v4.1`

## Avertissements

- service joignable, mais le nom du produit épinglé n'a pas été retrouvé dans la page servie — identité à reconfirmer à la main avant toute ingestion.
- EDO (avertissement officiel) : les sorties du modèle hydrologique donnent un signal trop sec dans certaines régions, à l'est de la Pologne. Le CDI (ainsi que LFI et SMI Anomaly) doit être interprété avec prudence depuis la mi-mai 2025, particulièrement dans la partie orientale du domaine.

## Erreurs

- _aucune_

## Notes

- Aucun raster n'a été téléchargé et aucun octet n'a été décodé : le connecteur porte `source_verified_decoder_deferred`, et X1 ne lève pas ce statut.
- Les avertissements officiels de l'EDO sont repris tels quels ci-dessus : ils conditionnent toute interprétation future, et ne sont pas des remarques de mise en œuvre.
- Formats publiés par la source : tif, nc — aucun n'est décodable par le connecteur en l'état.

---

<details><summary>Rapport structuré (JSON)</summary>

```json
{
  "bytes_received": 0,
  "dry_run": true,
  "duration_seconds": 0.397,
  "errors": [],
  "executed_at": "2026-07-26T09:21:53.786669+00:00",
  "geographies": [],
  "limits": {
    "decoding": "aucun",
    "max_bytes": 1000000,
    "timeout_seconds": 25.0
  },
  "method": "CC-WI-COPERNICUS-EDO-SNAPSHOT 1.0.0",
  "notes": [
    "Aucun raster n'a été téléchargé et aucun octet n'a été décodé : le connecteur porte `source_verified_decoder_deferred`, et X1 ne lève pas ce statut.",
    "Les avertissements officiels de l'EDO sont repris tels quels ci-dessus : ils conditionnent toute interprétation future, et ne sont pas des remarques de mise en œuvre.",
    "Formats publiés par la source : tif, nc — aucun n'est décodable par le connecteur en l'état."
  ],
  "pages_fetched": 0,
  "payload_format": "text/html; charset=utf-8",
  "payload_sha256": null,
  "periods": [],
  "pipeline_steps_executed": [],
  "pipeline_steps_failed": [],
  "query_parameters": {
    "connector_status": "source_verified_decoder_deferred",
    "crs": "EPSG:4326",
    "product": "Combined Drought Indicator (CDI)",
    "resolution": "1/24 decimal degree (around 5 km at the Equator)",
    "version": "v4.1"
  },
  "records_absent_value": 0,
  "records_normalized": 0,
  "records_publishable": 0,
  "records_received": 0,
  "records_rejected": 0,
  "rejection_causes": [],
  "release_key": "Combined Drought Indicator (CDI) v4.1",
  "source_code": "COPERNICUS_EDO",
  "transfers": [
    {
      "bytes_received": 4115,
      "content_type": "text/html; charset=utf-8",
      "elapsed_seconds": 0.396,
      "error": null,
      "params": [],
      "redirects": [
        "https://drought.emergency.copernicus.eu/edov2/php/index.php",
        "https://drought.emergency.copernicus.eu/tumbo/edo/map",
        "https://drought.emergency.copernicus.eu/tumbo/edo/map/"
      ],
      "sha256": "83d3ddd771d48063205deb5b0ebb7ae625fde9cc3c85a0a13673450d1280d8c1",
      "status_code": 200,
      "url": "https://edo.jrc.ec.europa.eu/edov2/php/index.php"
    }
  ],
  "units": [],
  "verdict": "decoder_deferred",
  "warnings": [
    "service joignable, mais le nom du produit épinglé n'a pas été retrouvé dans la page servie — identité à reconfirmer à la main avant toute ingestion.",
    "EDO (avertissement officiel) : les sorties du modèle hydrologique donnent un signal trop sec dans certaines régions, à l'est de la Pologne. Le CDI (ainsi que LFI et SMI Anomaly) doit être interprété avec prudence depuis la mi-mai 2025, particulièrement dans la partie orientale du domaine."
  ]
}
```

</details>
