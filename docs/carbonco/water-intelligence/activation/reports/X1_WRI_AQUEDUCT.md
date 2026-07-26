# Validation live — WRI_AQUEDUCT

**Verdict :** `blocked`  
**Release :** `aqueduct-4.0`  
**Exécuté le :** 2026-07-26T11:23:39.419759+00:00  
**Méthode :** `CC-WI-WRI-AQUEDUCT-PASSTHROUGH 1.0.0`  
**Écriture en base :** aucune (`dry_run=true`)  
**Durée :** 0.000 s

## Transferts

| # | URL (sans query) | HTTP | Content-Type | Octets | SHA-256 | Durée |
|---|---|---|---|---|---|---|
| — | _aucun transfert_ | — | — | — | — | — |

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

- `network_calls_allowed` : 0

## Paramètres de recette

- `dataset_version` : `4.0`
- `license_code` : `CC-BY-4.0`
- `published_at` : `2023-08-16`

## Avertissements

- Statut : blocked_registration_required. Aucun enregistrement WRI n'est documenté dans le dépôt.

## Erreurs

- _aucune_

## Notes

- AUCUN appel réseau n'a été émis vers WRI, volontairement. Le pack l'interdit tant que l'enregistrement n'est pas documenté, et vérifier l'accessibilité d'une ressource qu'on n'a pas le droit de collecter reviendrait à commencer à la collecter.
- Le connecteur `wri_aqueduct.py` est livré et testé : ce n'est pas un manque technique. Ce qui manque est un acte contractuel, qu'un script ne peut ni effectuer ni attester.
- Voie de déblocage sans enregistrement : valider le connecteur sur un artefact local obtenu légalement par un opérateur, en le passant en entrée — la commande de validation reste à écrire le jour où cet artefact existe.

---

<details><summary>Rapport structuré (JSON)</summary>

```json
{
  "bytes_received": 0,
  "dry_run": true,
  "duration_seconds": 0.0,
  "errors": [],
  "executed_at": "2026-07-26T11:23:39.419759+00:00",
  "geographies": [],
  "limits": {
    "network_calls_allowed": 0
  },
  "method": "CC-WI-WRI-AQUEDUCT-PASSTHROUGH 1.0.0",
  "notes": [
    "AUCUN appel réseau n'a été émis vers WRI, volontairement. Le pack l'interdit tant que l'enregistrement n'est pas documenté, et vérifier l'accessibilité d'une ressource qu'on n'a pas le droit de collecter reviendrait à commencer à la collecter.",
    "Le connecteur `wri_aqueduct.py` est livré et testé : ce n'est pas un manque technique. Ce qui manque est un acte contractuel, qu'un script ne peut ni effectuer ni attester.",
    "Voie de déblocage sans enregistrement : valider le connecteur sur un artefact local obtenu légalement par un opérateur, en le passant en entrée — la commande de validation reste à écrire le jour où cet artefact existe."
  ],
  "pages_fetched": 0,
  "payload_format": null,
  "payload_sha256": null,
  "periods": [],
  "pipeline_steps_executed": [],
  "pipeline_steps_failed": [],
  "query_parameters": {
    "dataset_version": "4.0",
    "license_code": "CC-BY-4.0",
    "published_at": "2023-08-16"
  },
  "records_absent_value": 0,
  "records_normalized": 0,
  "records_publishable": 0,
  "records_received": 0,
  "records_rejected": 0,
  "rejection_causes": [],
  "release_key": "aqueduct-4.0",
  "source_code": "WRI_AQUEDUCT",
  "transfers": [],
  "units": [],
  "verdict": "blocked",
  "warnings": [
    "Statut : blocked_registration_required. Aucun enregistrement WRI n'est documenté dans le dépôt."
  ]
}
```

</details>
