# Water Intelligence — Journal de décisions

Décisions actées au démarrage du chantier, avant l'exécution de P00.

- `/water` reste le cockpit authentifié existant.
- `/water-intelligence` devient la surface publique.
- Aucun appel externe au runtime.
- Evidence Kernel comme registre unique.
- Aucune donnée inventée.
- Une source ou famille de source par PR.
- Pas de migration sans besoin démontré.

## 2026-07-23 — Clôture P00 / préparation P01

- Le fichier `WATER_SOURCE_REGISTRY_SEED_V1.csv` contient 16 lignes de données au total : 12 d'origine `user_csv` (fournies telles quelles par l'opérateur) et 4 d'origine `recommended_addition` (WRI Aqueduct, EEA/WEI+, Copernicus EDO, USGS).
- Le registre normalisé produit par P01 doit couvrir les 16 entrées, sans jamais faire croire que le CSV opérateur initial ne comptait que 12 lignes.
- La distinction entre les deux origines reste explicite dans le registre normalisé (champ d'origine ou équivalent), jamais fusionnée silencieusement.
