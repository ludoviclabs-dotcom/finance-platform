# Seed des facteurs d'émission — ADEME Base Empreinte®

Deux scripts peuplent la table `emission_factors` :

| Script | Source | Usage |
|---|---|---|
| `seed_factors.py` | ~502 facteurs **recopiés à la main** (valeurs publiques de référence) | **fixture dev/test** — fonctionne hors ligne, sans compte ADEME |
| `seed_emission_factors.py` | **export CSV officiel** de la Base Empreinte | **source canonique** (prod) — inclut les ratios monétaires kgCO2e/€ (FEC, T4.3) |

## Procédure (CSV officiel)

1. Créer un **compte ADEME gratuit** sur <https://base-empreinte.ademe.fr>.
2. Télécharger l'**export complet** de la Base Empreinte au format CSV.
3. Placer le fichier dans `apps/api/data/ademe/` (ce dossier est **gitignoré** —
   ne jamais committer le CSV brut, voir licence ci-dessous).
4. Lancer :

   ```bash
   python apps/api/scripts/seed_emission_factors.py \
     --csv apps/api/data/ademe/base_empreinte.csv \
     --version v2025
   ```

   Ajouter `--dry-run` pour compter les facteurs sans écrire en base.

## Colonnes attendues

Le parser détecte automatiquement (par sous-chaîne, insensible à la casse) :
`Identifiant de l'élément`, `Nom base français`, `Nom attribut français`,
`Code de la catégorie`, `Unité français`, `Total poste non décomposé`.

L'`Unité français` au format `kgCO2e/<unité>` donne l'unité du dénominateur ;
`kgCO2e/€` est détecté comme **ratio monétaire** (indispensable au screening FEC).

## Licence

La Base Empreinte® est diffusée par l'ADEME sous conditions d'utilisation
spécifiques. **La redistribution du fichier d'export brut n'est pas autorisée** :
le CSV reste local (`data/ademe/` gitignoré). Seules les valeurs normalisées,
stockées en base, sont utilisées par l'application, avec mention de la source et
de la version sur chaque facteur affiché.

## Critère d'acceptation (rejeu Neon)

```sql
SELECT COUNT(*) FROM emission_factors WHERE version = 'v2025';  -- >= 500
```
