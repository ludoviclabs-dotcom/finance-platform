# CarbonCo - Phase 0

Date: 2026-04-12

## Sauvegarde

Sauvegarde creee avant tout demarrage de la phase 0:

- Repo: `backups/phase0-20260412-160426-repo.zip`
- Excel: `backups/phase0-20260412-160426-excel.zip`

## Objectif

La phase 0 a pour but de securiser et standardiser le socle CarbonCo avant les evolutions fonctionnelles majeures:

- figer les classeurs maitres
- standardiser les liaisons Excel -> web
- preparer l'ingestion backend
- supprimer la dependance aux mocks cote produit
- definir un cadre QA et de versioning robuste

## Classeur maitres retenus

- `CarbonCo_Calcul_Carbone_v2.xlsx`
- `CarbonCo_ESG_Social.xlsx`
- `CarbonCo_Finance_DPP_v1_3.xlsx`

## Audit rapide des criteres de reussite

Mise a jour apres demarrage du Block A:

- sauvegarde repo + Excel effectuee
- `Claude Log` ajoute au classeur ESG Social
- premieres corrections de `Liaison_Donnees` appliquees dans ESG et Finance
- premieres plages nommees `CC_*` appliquees dans le classeur carbone
- validateur automatique Block A ajoute au repo

### Critere 1

Trois classeurs structures, versionnes et tracables.

Statut: Partiel

Constat:

- la separation en 3 domaines est bien en place
- `Claude Log` existe maintenant dans les 3 masters
- la gouvernance de version n'est pas encore harmonisee sur les 3 fichiers

### Critere 2

Liaisons inter-fichiers normalisees.

Statut: Partiel

Constat:

- les onglets `Liaison_Donnees` existent dans ESG Social et Finance
- la logique de liaison reste partiellement manuelle
- les cellules source les plus critiques ont ete recalees sur les bons totaux carbone
- le classeur carbone expose maintenant une premiere base canonique de plages `CC_*`

### Critere 3

API capable de produire un snapshot consolide sans mocks.

Statut: Absent

Constat:

- l'API sait lire un fichier Excel par feuille, cellule ou plage
- aucune route metier Carbon consolidee n'existe encore
- aucun snapshot JSON transversal n'est produit aujourd'hui

### Critere 4

Dashboard web capable d'afficher des KPIs centraux a partir des vraies donnees.

Statut: Absent

Constat:

- le front Carbon consomme encore des donnees statiques locales
- les ecrans dashboard, ESRS, reports et copilot ne sont pas connectes a une source metier Carbon reelle

### Critere 5

Une modification cosmetique Excel ne casse plus l'integration.

Statut: Partiel

Constat:

- le projet ne dispose pas encore d'un contrat de donnees suffisamment decouple de la mise en forme
- un validateur de structure et de compatibilite existe maintenant, mais il n'est pas encore branche a l'ingestion produit

## Conclusion d'audit

La phase 0 est bien justifiee et necessaire.

Le projet est suffisamment avance pour la lancer sans risque majeur, mais les criteres de reussite ne sont pas encore atteints. Le socle existant est bon, surtout cote structure Excel, mais il reste a l'industrialiser.

## Perimetre de la phase 0

### Axe A - Gouvernance Excel

- confirmer les 3 classeurs maitres
- ajouter `Claude Log` dans le classeur ESG Social
- harmoniser les sections de versioning et compatibilite
- documenter les onglets critiques et les cellules structurantes

### Axe B - Contrat de donnees

- definir une nomenclature unique `CC_*`
- mapper les cellules source du classeur carbone
- recabler les feuilles `Liaison_Donnees` vers cette nomenclature
- produire un dictionnaire de donnees minimal

### Axe C - Backend d'ingestion

- ajouter un service Carbon dedie dans l'API
- valider la structure des 3 classeurs
- lire les donnees critiques par plage nommee ou fallback controle
- produire un snapshot JSON consolide

### Axe D - Front prepare au reel

- introduire une couche d'acces aux donnees Carbon
- remplacer progressivement `apps/carbon/lib/data.ts`
- preparer le dashboard pour afficher les KPIs reels prioritaires

### Axe E - QA et recette

- definir une checklist de compatibilite des classeurs
- tester template vide, partiel et quasi complet
- controler les regressions de liaisons

## Ordre d'execution

1. Inventaire et gouvernance des 3 classeurs maitres
2. Specification du contrat `CC_*`
3. Harmonisation des feuilles `Liaison_Donnees`
4. Validation automatique des masters Excel
5. Creation du normaliseur backend Carbon
6. Exposition du snapshot consolide via API
7. Branchement du front sur ce snapshot
8. Verification des criteres de reussite

## Livrables de fin de phase 0

- un socle Excel gouverne et trace
- un contrat de donnees `CC_*` documente
- un endpoint Carbon de snapshot consolide
- un dashboard branche au reel pour les KPIs de base
- une checklist QA de compatibilite

## Point de depart recommande

Premier chantier a lancer:

- ajouter la gouvernance manquante sur `CarbonCo_ESG_Social.xlsx`
- inventorier les plages nommees et les correspondances cibles `CC_*`
- ecrire la specification du snapshot Carbon consolide
