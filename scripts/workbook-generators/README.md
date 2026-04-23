# Workbook Generators

Scripts Python qui génèrent les fichiers Excel (`.xlsx`) consommés par les agents NEURAL. Archivés ici parce que :

1. Les workbooks générés sont ensuite synchronisés vers `apps/neural/content/{vertical}/*.json` via `apps/neural/scripts/sync-*.ts`.
2. L'app Next.js lit uniquement les JSON — les `.xlsx` et les générateurs ne font pas partie du runtime.
3. On veut pouvoir reconstruire un workbook à l'identique (déterminisme) si un audit ou une update est nécessaire.

## Structure

- `luxe-comms/` — générateurs des 7 workbooks de la branche Luxe / Communication (Sprint 1 du projet NEURAL). Produisent les xlsx consommés par `sync-luxe-comms.ts`.
- `neural-legacy/` — générateurs antérieurs (pré-Sprint 1) qui ont alimenté d'autres verticales (LuxeTrace, ArtisanalQuality, SkillsMap Aero, ClientelingAI). Conservés pour la traçabilité historique.

## Utilisation type

```bash
# Depuis la racine du repo
python scripts/workbook-generators/luxe-comms/generate_foundations.py
# → produit apps/neural/data/luxe-comms/NEURAL_LUXE_COMMS_FOUNDATIONS.xlsx

cd apps/neural
npx tsx scripts/sync-luxe-comms.ts
# → lit le .xlsx et écrit content/luxe-comms/foundations.json
```

## Pas encore généré

La branche Banque / Communication utilise actuellement des seeds JSON directs (enrichis dans `apps/neural/content/bank-comms/*.json`). Quand les workbooks xlsx correspondants seront produits, ils devraient atterrir dans `scripts/workbook-generators/bank-comms/`.
