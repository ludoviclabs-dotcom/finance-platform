# CarbonCo - Block A Governance

Date: 2026-04-12

## Purpose

Block A secures the Excel foundation before any deeper integration work.

Its role is to eliminate ambiguity around:

- which workbook is the master for each domain
- which fields are contractually exposed to the product
- which workbook changes are allowed without breaking the web layer
- how workbook evolution is logged and validated

## Master Workbooks

The following files are the only masters for Phase 0:

- `CarbonCo_Calcul_Carbone_v2.xlsx`
- `CarbonCo_ESG_Social.xlsx`
- `CarbonCo_Finance_DPP_v1_3.xlsx`

No duplicate or alternate workbook should be used as a source of truth during Block A.

## Current Status

### Carbon workbook

- Role: carbon source of truth
- Status: strongest workbook structurally
- Strengths: `Claude Log` present, canonical `CC_*` named ranges now added for shared fields
- Risk: contains both legacy and newer detailed tabs, so source ownership must be made explicit

### ESG Social workbook

- Role: voluntary VSME, materiality, ESRS S/G
- Status: structurally ready
- Strengths: clear thematic split, liaison sheet present
- Risk: almost no named range governance, liaison still partly manual
- Progress: `Claude Log` has now been added during Block A kickoff

### Finance DPP workbook

- Role: climate finance, DPP, benchmark, investor exports
- Status: structurally ready
- Strengths: `Claude Log` present, liaison sheet present
- Risk: formulas already consume liaison rows beyond the headline fields, so the data contract must cover more than the visible top block
- Progress: liaison source notes have been corrected on the critical shared fields

## Governance Rules

### Rule 1

Every master workbook must contain:

- `Couverture`
- `Sommaire`
- `Liaison_Donnees` when the workbook consumes shared enterprise or carbon data
- `Claude Log`

### Rule 2

Every cross-workbook shared field must be represented by a target contract key in `CC_*` format.

Workbook formulas may continue using local cells during transition, but the product layer must only depend on `CC_*`.

### Rule 3

Cosmetic edits must never be treated as reliable integration points.

The product must never depend on:

- column colors
- row ordering alone
- visible labels alone
- ad hoc manual notes

### Rule 4

A workbook change is considered integration-safe only if:

- the expected sheet still exists
- the expected named range still exists, or the approved fallback cell still exists
- the workbook version is compatible
- the validation checklist passes

### Rule 5

No new field should be consumed by the web app unless it is first added to the documented data contract.

## Immediate Block A Actions

1. Create and enforce the canonical `CC_*` contract.
2. Align the `Liaison_Donnees` sheets with that contract.
3. Create a machine-readable workbook registry.
4. Create a validator that checks workbook compatibility before ingestion.

Status update:

- items 1 to 3 are now started
- item 4 is implemented as a repo script and should become mandatory before ingestion

## Known Risks To Neutralize First

### Risk

Conflicting workbook variants.

Mitigation:

- freeze the three masters above
- treat other workbook variants as archive only

### Risk

Broken source mapping in liaison sheets.

Mitigation:

- use named ranges where available
- document approved fallback cells where named ranges do not yet exist
- correct mismatches before backend ingestion depends on them

### Risk

Workbook changes are logged unevenly.

Mitigation:

- standardize `Claude Log`
- require a version and change summary for structural edits

## Definition of Done for Block A

Block A is complete when:

- the 3 master workbooks are explicitly governed
- the workbook registry is documented and stored in the repo
- the draft `CC_*` contract is approved and usable
- the main liaison mismatches are identified and corrected on the priority fields
- future work can proceed without guessing where a field comes from
