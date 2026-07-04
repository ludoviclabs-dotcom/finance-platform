# VSME — Référentiel des datapoints (mapping)

> **Source de vérité** du référentiel VSME pour CarbonCo (T3.1).
> Données : [`apps/api/data/vsme_datapoints.json`](../../apps/api/data/vsme_datapoints.json) — ce document décrit la structure et les conventions.
> Standard : **VSME — Voluntary SME Standard, EFRAG (décembre 2024)**, modules Basic (B1-B11) et Comprehensive (C1-C9).
> ⚠️ Les intitulés exacts des datapoints doivent être recoupés avec le **PDF EFRAG officiel** (cf. annexe B.1 du PLAN_ACTION). Le présent référentiel modélise fidèlement les modules et les datapoints pour lesquels CarbonCo dispose d'une donnée mappable ; il est **versionné** (`version`) et toute évolution du standard = nouvelle migration + bump de version.

## Schéma d'un datapoint

| Champ | Rôle |
|---|---|
| `code` | identifiant stable (`B3-1`, `C9-2`…), clé primaire du catalogue |
| `module` | module EFRAG : `B1`…`B11` (Basic), `C1`…`C9` (Comprehensive) |
| `label` | intitulé FR |
| `type` | `quantitatif` \| `narratif` \| `booleen` |
| `unit` | unité (tCO2e, %, MWh…) ou `null` |
| `snapshot` | chemin dans le snapshot VSME existant (`models/vsme.py`), ou `null` si non encore collecté |
| `fact_code` | code sous lequel la valeur est émise dans `facts_events` (T3.2), ou `null` |
| `collect` | `mandatory` (Basic requis) \| `optional` |

## Convention de codes de fact (`fact_code`)

Aligné sur la convention **dotted** du `carbon_service` (`CC.GES.*`). Règle :
- **Réutiliser** le code carbon existant quand le KPI existe déjà — on ne réémet PAS Scope 1/2/3 sous un nouveau code. Ex. : `B3-1` → `CC.GES.SCOPE1`, `B3-6` → `CC.INTENSITE.CA`, `B3-7` → `CC.CONSO.ENERGIE`, `B3-8` → `CC.PART.ENR`.
- **Créer** un code `CC.VSME.*` uniquement pour un datapoint VSME propre sans équivalent carbon (eau, déchets, indicateurs S1/G1) — ex. `B6-1` → `CC.VSME.EAU_M3`, `B8-1` → `CC.VSME.S1.EFFECTIF`.
- Les datapoints **narratifs/booléens** n'ont pas de `fact_code` (`null`).
- `source_path` des facts émis (T3.2/T3.4) : `manual:user@email` (saisie guidée), `wizard:step_{N}` (parcours), `ingest:excel` (import). Cohérent avec le pattern existant `source_label:fichier!cellule`.

## Complétude (T3.2)

Dénominateur **honnête** = datapoints `mandatory` du périmètre Basic (B1-B11). Un datapoint auto-rempli depuis une donnée existante (E1, matérialité, S1, G1) affiche sa **source** et reste ré-éditable ; il n'est jamais présenté comme « saisi manuellement ». Un datapoint marqué « non applicable » exige une justification stockée.

## Tables

- **`vsme_datapoints`** (migration 014) — **catalogue global** du standard (identique pour toutes les organisations, comme `emission_factors`) : **pas de `company_id`, pas de RLS**. Seedé par `scripts/seed_vsme_datapoints.py`.
- **`vsme_field_values`** (migration 015, T3.2) — **valeurs par organisation** (RLS) : `company_id`, `datapoint_code`, `value`, `is_applicable`, `na_justification`, `fact_event_id`.
