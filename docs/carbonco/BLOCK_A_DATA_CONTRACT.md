# CarbonCo - Block A Data Contract Draft

Date: 2026-04-12

## Goal

This contract defines the shared fields that the product is allowed to consume from the Excel layer.

During Phase 0:

- the carbon workbook is the primary source of truth for shared enterprise and carbon KPIs
- the ESG Social and Finance DPP workbooks consume those values via `Liaison_Donnees`
- the backend will normalize these values under stable `CC_*` keys

## Priority Shared Fields

| Target key | Current source | Current fallback cell | Main consumers |
| --- | --- | --- | --- |
| `CC_Raison_Sociale` | canonical named range | `Parametres!B4` | ESG, Finance |
| `CC_Annee_Reporting` | canonical named range | `Parametres!B7` | ESG, Finance |
| `CC_CA_Net` | canonical named range | `Parametres!B9` | ESG, Finance |
| `CC_ETP` | canonical named range | `Parametres!B11` | ESG, Benchmark |
| `CC_Secteur_Activite` | canonical named range | `Parametres!B6` | ESG, Finance |
| `CC_Secteur_NAF` | canonical named range | `Parametres!C6` | Benchmark |
| `CC_Surface_Totale` | canonical named range | `Parametres!B12` | ESG |
| `CC_CapEx_Total` | canonical named range | `Parametres!B14` | Finance |
| `CC_OpEx_Eligible_Taxo` | canonical named range | `Parametres!B15` | Finance, SFDR |
| `CC_GES_Scope1` | canonical named range | `Synthese_GES!C10` | ESG, Finance |
| `CC_GES_Scope2_LB` | canonical named range | `Synthese_GES!C15` | ESG, Finance |
| `CC_GES_Scope2_MB` | canonical named range | `Synthese_GES!C17` | ESG, Finance |
| `CC_GES_Scope3` | canonical named range | `Synthese_GES!C35` | ESG, Finance |
| `CC_GES_Total_S123` | canonical named range | `Synthese_GES!C47` | ESG, Finance |
| `CC_Intensite_CA` | canonical named range | `Synthese_GES!C50` | ESG, Finance |
| `CC_Intensite_ETP` | canonical named range | `Synthese_GES!C51` | Benchmark |
| `CC_Part_Scope1` | canonical named range | `Synthese_GES!C53` | Finance |
| `CC_Part_Scope2` | canonical named range | `Synthese_GES!C54` | Finance |
| `CC_Part_Scope3` | canonical named range | `Synthese_GES!C55` | Finance, Benchmark |
| `CC_Conso_Energie_MWh` | canonical named range | `Energie!E19` | ESG, Finance |
| `CC_Part_ENR` | canonical named range | `Energie!E20` | VSME, Finance, SFDR, Benchmark |
| `CC_CBAM_Cout_Estime` | canonical named range | `CBAM!M24` | Finance, SFDR |
| `CC_Taxo_CA_Aligne` | canonical named range | `Taxonomie!E27` | Finance, SFDR |
| `CC_Taxo_CapEx_Aligne` | canonical named range | `Taxonomie!E28` | Finance, SFDR |
| `CC_Taxo_OpEx_Aligne` | canonical named range | `Taxonomie!E29` | Finance, SFDR |
| `CC_SBTI_Taux_S12` | canonical named range | `Trajectoire_SBTi!B8` | Finance |
| `CC_SBTI_Baseline_S12` | canonical named range | `Trajectoire_SBTi!B5` | Finance |
| `CC_SBTI_Annee_Baseline` | canonical named range | `Trajectoire_SBTi!B4` | Finance |
| `CC_PT_Prix_Carbone` | fallback only for now | `Plan_Transition!C20` | Finance |
| `CC_PT_Total_Invest` | fallback only for now | `Plan_Transition!D16` | Finance |
| `CC_PT_Total_Reduction` | fallback only for now | `Plan_Transition!F16` | Finance |

## Confirmed Mapping Issues

These priority mismatches have now been corrected in the liaison sheets. They remain documented here because the validator must keep checking them.

### ESG Social workbook

- `Scope 2 Location-based` now points to `Synthese_GES!C15`
- `Scope 2 Market-based` now points to `Synthese_GES!C17`
- `Scope 3 total` now points to `Synthese_GES!C35`

### Finance DPP workbook

- `Scope 2 LB` now points to `Synthese_GES!C15`
- `Scope 2 MB` now points to `Synthese_GES!C17`
- `Scope 3 total` now points to `Synthese_GES!C35`
- aggregated total has been clarified as `Total S1+S2(LB)+S3 (tCO2e)`

## Phase 0 Contract Rules

1. Use named ranges first whenever they exist.
2. Use fallback cells only when the named range is missing.
3. Any new shared field must receive a `CC_*` key before backend or frontend consumption.
4. The backend snapshot must expose only normalized keys, not workbook cell coordinates.

## Next Contract Actions

1. Keep the validator in sync with the `CC_*` contract before any new field is consumed.
2. Extend the contract to `Plan_Transition` and future ESG Social outputs when those fields become product-facing.
3. Build the backend normalizer around this contract.
