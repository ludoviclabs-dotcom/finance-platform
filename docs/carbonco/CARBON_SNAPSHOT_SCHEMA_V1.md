# CarbonCo - Carbon Snapshot Schema v1

Date: 2026-04-12

## Purpose

This document defines the first backend snapshot shape that will bridge the Excel masters and the CarbonCo web product.

The snapshot is intentionally narrow:

- enough for the dashboard and ingestion health checks
- stable against workbook cosmetic changes
- based on the `CC_*` contract first

## Scope for Phase 0

Snapshot v1 covers:

- workbook compatibility status
- company identity and reporting context
- carbon KPIs
- energy KPIs
- taxonomy and CBAM KPIs
- SBTi baseline and target KPIs

Snapshot v1 does not yet cover:

- detailed ESRS social metrics
- DPP product rows
- benchmark sector tables
- SFDR investor tables

## Proposed JSON shape

```json
{
  "snapshotVersion": "v1",
  "generatedAt": "2026-04-12T16:30:00Z",
  "source": {
    "carbonWorkbook": {
      "filename": "CarbonCo_Calcul_Carbone_v2.xlsx",
      "status": "ok"
    },
    "esgWorkbook": {
      "filename": "CarbonCo_ESG_Social.xlsx",
      "status": "ok"
    },
    "financeWorkbook": {
      "filename": "CarbonCo_Finance_DPP_v1_3.xlsx",
      "status": "ok"
    }
  },
  "validation": {
    "status": "ok",
    "failures": []
  },
  "company": {
    "name": "Carbon & Co",
    "reportingYear": 2025,
    "sectorActivity": "Conseil",
    "nafCode": "70.22Z",
    "revenueNetEur": 2500000,
    "fte": 18,
    "surfaceSqm": 420,
    "capexTotalEur": 120000,
    "opexEligibleTaxoEur": 15000
  },
  "carbon": {
    "scope1Tco2e": 12.4,
    "scope2LbTco2e": 8.1,
    "scope2MbTco2e": 2.3,
    "scope3Tco2e": 148.9,
    "totalS123Tco2e": 169.4,
    "intensityRevenueTco2ePerMEur": 67.8,
    "intensityFteTco2ePerFte": 9.4,
    "shareScope1Pct": 7.3,
    "shareScope2Pct": 4.8,
    "shareScope3Pct": 87.9
  },
  "energy": {
    "consumptionMWh": 96.5,
    "renewableSharePct": 42
  },
  "taxonomy": {
    "turnoverAlignedPct": 18,
    "capexAlignedPct": 24,
    "opexAlignedPct": 12
  },
  "cbam": {
    "estimatedCostEur": 0
  },
  "sbti": {
    "baselineYear": 2022,
    "baselineS12Tco2e": 34.1,
    "baselineS3Tco2e": 188.5,
    "targetReductionS12Pct": 42,
    "targetReductionS3Pct": 25
  }
}
```

## Mapping rules

The backend should resolve values in this order:

1. canonical `CC_*` named range
2. approved fallback cell documented in `BLOCK_A_DATA_CONTRACT.md`
3. validation failure if neither exists

The frontend should never consume workbook coordinates directly.

## Field mapping

| Snapshot field | Contract key |
| --- | --- |
| `company.name` | `CC_Raison_Sociale` |
| `company.reportingYear` | `CC_Annee_Reporting` |
| `company.sectorActivity` | `CC_Secteur_Activite` |
| `company.nafCode` | `CC_Secteur_NAF` |
| `company.revenueNetEur` | `CC_CA_Net` |
| `company.fte` | `CC_ETP` |
| `company.surfaceSqm` | `CC_Surface_Totale` |
| `company.capexTotalEur` | `CC_CapEx_Total` |
| `company.opexEligibleTaxoEur` | `CC_OpEx_Eligible_Taxo` |
| `carbon.scope1Tco2e` | `CC_GES_Scope1` |
| `carbon.scope2LbTco2e` | `CC_GES_Scope2_LB` |
| `carbon.scope2MbTco2e` | `CC_GES_Scope2_MB` |
| `carbon.scope3Tco2e` | `CC_GES_Scope3` |
| `carbon.totalS123Tco2e` | `CC_GES_Total_S123` |
| `carbon.intensityRevenueTco2ePerMEur` | `CC_Intensite_CA` |
| `carbon.intensityFteTco2ePerFte` | `CC_Intensite_ETP` |
| `carbon.shareScope1Pct` | `CC_Part_Scope1` |
| `carbon.shareScope2Pct` | `CC_Part_Scope2` |
| `carbon.shareScope3Pct` | `CC_Part_Scope3` |
| `energy.consumptionMWh` | `CC_Conso_Energie_MWh` |
| `energy.renewableSharePct` | `CC_Part_ENR` |
| `taxonomy.turnoverAlignedPct` | `CC_Taxo_CA_Aligne` |
| `taxonomy.capexAlignedPct` | `CC_Taxo_CapEx_Aligne` |
| `taxonomy.opexAlignedPct` | `CC_Taxo_OpEx_Aligne` |
| `cbam.estimatedCostEur` | `CC_CBAM_Cout_Estime` |
| `sbti.baselineYear` | `CC_SBTI_Annee_Baseline` |
| `sbti.baselineS12Tco2e` | `CC_SBTI_Baseline_S12` |
| `sbti.baselineS3Tco2e` | `CC_SBTI_Baseline_S3` |
| `sbti.targetReductionS12Pct` | `CC_SBTI_Taux_S12` |
| `sbti.targetReductionS3Pct` | `CC_SBTI_Taux_S3` |

## Validation behavior

The backend should attach a top-level validation block:

- `ok` when all required fields resolve cleanly
- `warning` when optional fields are missing but the dashboard can still load
- `failed` when required workbooks, sheets, or `CC_*` keys are missing

## Minimum required fields for dashboard v1

The first connected dashboard can ship if these fields resolve:

- `company.name`
- `company.reportingYear`
- `company.revenueNetEur`
- `carbon.totalS123Tco2e`
- `carbon.intensityRevenueTco2ePerMEur`
- `energy.renewableSharePct`
- `taxonomy.turnoverAlignedPct`
- `validation.status`

## Next implementation target

The backend step that follows this document should add:

- a workbook validator service
- a Carbon snapshot normalizer
- one API route returning Snapshot v1
