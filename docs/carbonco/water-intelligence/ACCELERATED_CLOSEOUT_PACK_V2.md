# Carbon&Co — Water Intelligence
## Pack accéléré de finalisation

**Version :** 2.0

### État de départ

- P00 à P05 fusionnés.
- P03B et P03C fusionnés.
- `/water` reste le cockpit authentifié.
- `/water-intelligence` existe comme shell public.
- Pipeline opérateur, contrats P02 et connecteur WRI disponibles.
- P06 est la mission active.
- La décision d'enregistrement WRI reste ouverte et interdit toute publication Aqueduct tant qu'elle n'est pas tranchée.

## Règle d'accélération

Les étapes restantes sont regroupées en cinq macro-PR :

1. Wave A — P06 EEA/WISE/WEI+ + P09 Copernicus EDO.
2. Wave B — P07/P08 Hub'Eau.
3. Wave C — P10/P11/P12 read model, carte et contenus.
4. Wave D — P13/P14/P15 conformité, synergies et finance.
5. Wave E — P16/P17 finalisation et Preview.

Chaque vague utilise :
- une branche ;
- une PR ;
- plusieurs commits atomiques ;
- un gate avant chaque sous-phase ;
- une revue humaine avant la vague suivante.

Une migration, si elle devient nécessaire, reste une PR séparée.

## En-tête invariant

Tu travailles dans `ludoviclabs-dotcom/finance-platform`.

1. Synchronise `master` et vérifie Git, Node, Python et les migrations.
2. Vérifie `PROJECT_STATE.yaml`, `CURRENT_TASK.md` et les PR précédentes.
3. Une vague = une branche = une PR, avec commits atomiques.
4. Ne fusionne rien et ne déploie jamais volontairement en production.
5. Préserve `/water`, l'authentification, la RLS et toutes les données tenant.
6. Aucun fait, chiffre, seuil, statut, événement, acteur ou mapping géographique n'est inventé.
7. Une fixture reste explicitement `fixture`/`demo` et n'apparaît jamais comme donnée réelle.
8. Aucun appel externe pendant le rendu, une requête utilisateur ou un test.
9. Les inspections réseau sont réservées au développement/opérateur, bornées et limitées aux sources officielles.
10. Réutilise P02, P03, `PageDecoder`, `AdapterError`, `PipelineDataUnavailableError` et l'Evidence Kernel.
11. Risque ≠ confiance ; absent ≠ zéro ; aucune correspondance ≠ risque faible.
12. Toute donnée publiable exige source, release nommée, checksum, période, méthode, licence et attribution.
13. Une décision de licence absente ou `display_allowed=false` interdit la publication.
14. Aucun package nouveau sans preuve de nécessité, licence et mesure d'impact.
15. Pas de modification de `.gitleaks.toml` sauf faux positif prouvé et ciblé.
16. Les erreurs attendues de parse/normalize héritent d'`AdapterError`.
17. Les erreurs attendues de géographie au stage derive utilisent `PipelineDataUnavailableError`.
18. Pas de `except Exception` général masquant des bugs programmeur.
19. Fournis commandes, résultats, fichiers, décisions, limites et risques.
20. Arrête-toi après push et ouverture de la PR.

---


# MACRO-PROMPT A — Connecteurs européens
## P06 EEA/WISE/WEI+ + P09 Copernicus EDO

**Branche :** `feat/water-intelligence-wave-a-eu-connectors`

## Objectif

Livrer deux connecteurs européens complémentaires, sans rendre leurs données publiques :

- EEA / WISE / WEI+ : rareté hydrique structurelle et saisonnière ;
- Copernicus EDO : situation courante de sécheresse.

## Préflight

1. Vérifie que PR #152 est fusionnée et que Vercel `master` est `READY`.
2. Vérifie `active_prompt: P06`, `status: ready`.
3. Inspecte P03/P03B/P03C et WRI P05.
4. Vérifie le resolver géographique WRI :
   - une géographie inconnue doit lever `PipelineDataUnavailableError` au stage derive ;
   - si ce n'est pas le cas, corrige-le dans un premier commit ;
   - ne change aucune règle métier ou licence WRI.

### Commit A1 éventuel

`fix(carbon): aligne le resolver géographique Water Intelligence`

Tests :
- géographie inconnue → rapport derive failed ;
- aucune exception brute ;
- pas de changement WRI hors erreur.

## Sous-phase A2 — EEA / WISE / WEI+

### Gate source officiel

Avant le code :

- identifier le jeu officiel ;
- pinner la release ;
- vérifier schéma, format, identifiants, unités, périodes et méthode ;
- vérifier licence, attribution, stockage, affichage et dérivation ;
- garder `unknown` quand non vérifié ;
- arrêter A2 si la source ou les droits restent insuffisants.

### Connecteur

Créer un connecteur isolé qui :

- choisit explicitement son `PageDecoder`;
- refuse `latest`, `current`, `head`;
- utilise uniquement les identifiants officiels de district/sous-unité ;
- ne joint jamais par libellé ;
- conserve saison, trimestre ou période ;
- conserve unités et valeurs manquantes ;
- distingue stress, saisonnalité, couverture et confiance ;
- n'agrège pas les bassins sans pondération documentée ;
- produit les métadonnées P02 ;
- fonctionne via P03 en dry-run ;
- ne persiste rien et ne touche pas le frontend.

Préparer sans publication :
- observations par sous-unité/période ;
- agrégat UE déterministe ;
- comparatif temporel borné ;
- descripteur de future couche.

Aucune géométrie lourde dans Git.

### Tests EEA

Couvrir :
- release nommée ;
- schéma valide/invalide ;
- identifiant inconnu ;
- doublons ;
- période absente ;
- unité incompatible ;
- null distinct de zéro ;
- saison conservée ;
- pondération ;
- licence autorisée/bloquée/inconnue ;
- attribution ;
- checksum/idempotence ;
- aucune requête réseau ;
- aucune écriture DB ;
- intégration pipeline et frontières d'erreur.

Commit :

`feat(carbon): ajoute le connecteur EEA WEI+ Water Intelligence`

## Sous-phase A3 — Copernicus EDO

### Gate officiel

Vérifier sur les sources Copernicus/JRC :

- produit retenu ;
- date de snapshot explicite ;
- paramètres WMS/WCS ou fichier de release ;
- licence et attribution ;
- résolution, couverture et limites ;
- compatibilité avec les dépendances existantes.

Aucun `latest` implicite.

### Implémentation

Choisir la voie la plus légère :

- fichier local opérateur ou réponse enregistrée comme artefact ;
- `TextPageDecoder` ou `RawBytesPageDecoder` explicite ;
- dérivation légère sans dépendance lourde.

Ne pas ajouter GDAL/rasterio sans ADR et preuve. Si aucun chemin robuste n'existe :

- livrer gate source, configuration, contrat, fixtures et tests ;
- documenter le blocage ;
- ne pas simuler une couche raster.

Invariants :
- sécheresse courante distincte du stress structurel ;
- snapshot daté ;
- aucune fausse précision ;
- aucune conclusion de conformité ;
- aucune animation d'archives.

Tests :
- date obligatoire ;
- paramètres ;
- licence ;
- corruption ;
- absence ;
- checksum ;
- idempotence ;
- budget ;
- aucun réseau en test/runtime ;
- distinction stress/sécheresse.

Commit :

`feat(carbon): ajoute le connecteur Copernicus EDO Water Intelligence`

## Sous-phase A4 — Handoff

Créer `handoffs/WAVE_A_EU_CONNECTORS.md`.

Mettre à jour :
- handoffs P06/P09 ;
- catalogue uniquement avec faits vérifiés ;
- `PROJECT_STATE.yaml` ;
- `PROMPT_LEDGER.csv` ;
- `CURRENT_TASK.md` vers Wave B.

La décision WRI reste ouverte.

## Validation

- tests EEA et Copernicus ;
- tests P03/P03B/P03C/WRI ;
- ruff ;
- suite API complète ;
- aucun frontend ;
- aucune migration ;
- aucun fichier lourd ;
- aucun runtime fetch.

Ouvre une PR unique et arrête-toi.
---


# MACRO-PROMPT B — Famille Hub'Eau
## P07 hydrométrie/piézométrie + P08 prélèvements/qualité

**Branche :** `feat/water-intelligence-wave-b-hubeau`

## Objectif

Livrer une intégration opérateur cohérente de Hub'Eau en mutualisant transport, pagination, bornes et référentiels.

Sous-connecteurs :
1. hydrométrie ;
2. piézométrie ;
3. prélèvements/BNPE ;
4. qualité de surface ;
5. qualité souterraine seulement si le gate est concluant.

## Commit B1 — Socle Hub'Eau

Créer un client opérateur borné :

- allowlist d'hôtes officiels ;
- endpoint explicite ;
- pagination ;
- timeout ;
- retry borné ;
- backoff ;
- limites de pages et d'octets ;
- filtre géographique obligatoire ;
- fenêtre temporelle obligatoire pour les chroniques ;
- logs sans secret ;
- cache local opérateur optionnel ;
- aucun appel pendant les tests/runtime ;
- aucune URL arbitraire.

Tests :
- pagination ;
- timeout ;
- retry ;
- 4xx/5xx ;
- limites ;
- domaine refusé ;
- absence de filtre ;
- reprise ;
- logs.

Commit :

`feat(carbon): ajoute le socle opérateur Hub'Eau borné`

## Commit B2 — Hydrométrie et piézométrie

Vérifier officiellement :
- endpoints/versions ;
- identifiants ;
- unités ;
- statuts ;
- pagination ;
- licence/attribution ;
- couverture.

Conserver séparément :
- débit ;
- hauteur/niveau ;
- piézométrie ;
- métadonnées de station ;
- observation instantanée ;
- agrégat déterministe.

MVP :
- zone explicite ;
- fenêtre courte ;
- dernier état ou agrégat documenté.

Jamais d'interpolation d'une valeur absente.

Tests :
- station inconnue ;
- valeur absente ;
- unité ;
- date ;
- pagination ;
- fraîcheur ;
- couverture ;
- licence ;
- checksum ;
- idempotence.

Commit :

`feat(carbon): ajoute hydrométrie et piézométrie Hub'Eau`

## Commit B3 — Prélèvements et qualité

Prélèvements :
- année/période ;
- volume ;
- usage ;
- type de ressource ;
- unité ;
- territoire ;
- couverture.

Absence de déclaration ≠ zéro.

Qualité :
- allowlist initiale sourcée ;
- codes SANDRE ;
- paramètre ;
- valeur ;
- unité ;
- limite de quantification ;
- statut ;
- date ;
- station ;
- source/release.

Interdictions :
- pas de classement sanitaire ;
- pas de conformité sans seuil juridique contextualisé ;
- pas d'agrégat entre paramètres incompatibles ;
- pas de jointure par nom ;
- pas d'aspiration de tous les analytes.

Tests :
- code inconnu ;
- paramètre hors allowlist ;
- unités incompatibles ;
- valeur censurée ;
- limite de quantification ;
- absence ;
- pagination ;
- période ;
- licence ;
- idempotence.

Commit :

`feat(carbon): ajoute prélèvements et qualité Hub'Eau`

## Commit B4 — Handoff

Créer `handoffs/WAVE_B_HUBEAU.md` avec :
- matrice endpoints/connecteurs/métriques ;
- budgets ;
- limites ;
- gestes opérateur.

Mettre à jour pilotage vers Wave C.

## Validation

- tests socle et connecteurs ;
- tests P03/P03B/P03C ;
- ruff ;
- suite API ;
- aucun frontend ;
- aucune migration ;
- aucun réseau en test/runtime ;
- aucun fichier lourd.

Ouvre une PR unique et arrête-toi.
---


# MACRO-PROMPT C — Produit public
## P10 snapshots + P11 carte + P12 contenus

**Branche :** `feat/water-intelligence-wave-c-public-data-product`

## Objectif

Construire le produit public complet :
- assembleur de snapshots ;
- read model ;
- cache/ETag ;
- carte multi-échelle ;
- contenus sourcés ;
- aucune donnée tenant.

## Gate licence

Avant le code :
1. inventorier les sources disponibles ;
2. vérifier stockage, affichage, dérivation et attribution ;
3. exclure toute source sans décision explicite ;
4. exclure WRI tant que l'enregistrement n'est pas tranché ;
5. inscrire les exclusions dans le manifest.

`unknown` ne devient jamais autorisé.

## Commit C1 — Read model P10

Réutiliser l'Evidence Kernel.

Créer un assembleur déterministe :

- entrées : releases publiées et autorisées ;
- sortie : manifest immuable + couches compactes ;
- aucun appel externe ;
- aucun tenant ;
- `generated_at` injecté ;
- release IDs/hashes ;
- décisions de licence ;
- couverture ;
- warnings ;
- budgets ;
- version de schéma.

Niveaux :
- monde ;
- Europe ;
- France ;
- métadonnées.

Stockage :
- artefacts lourds hors Git ;
- petits manifests/fixtures seulement ;
- aucun Blob public avec donnée bloquée ;
- ETag sur hash ;
- cache invalidé seulement à publication autorisée.

Créer un loader public borné et lecture seule.

Tests :
- déterminisme ;
- ordre indépendant ;
- display bloqué ;
- dérivation bloquée ;
- source inconnue ;
- aucune donnée tenant ;
- parité ;
- gzip ;
- ETag/cache ;
- absence.

Commit :

`feat(carbon): ajoute le read model public Water Intelligence`

## Commit C2 — Carte P11

Réutiliser D3/TopoJSON/World Atlas/Recharts déjà présents.

Créer :
- monde ;
- Europe ;
- France ;
- détail ;
- filtres territoire/période/scénario/dimension ;
- URL partageable ;
- chargement par couche ;
- légende/source/date/méthode/couverture/confiance/warnings.

Dimensions séparées :
- stress ;
- sécheresse ;
- prélèvements ;
- hydrométrie ;
- piézométrie ;
- qualité ;
- absence.

Aucun score composite.

Accessibilité :
- clavier ;
- focus ;
- table alternative ;
- pas couleur seule ;
- reduced motion.

Performance :
- couches à la demande ;
- entités bornées ;
- géométries simplifiées ;
- budgets ;
- Server Components par défaut.

Tests :
- filtres ;
- URL ;
- absence/licence ;
- table alternative ;
- mobile ;
- clavier ;
- reduced motion ;
- aucun fetch externe.

Commit :

`feat(carbon): ajoute la carte multi-échelle Water Intelligence`

## Commit C3 — Contenus P12

Créer des records P02 sourcés :
- situation ;
- secteurs ;
- acteurs ;
- climat ;
- événements ;
- innovations.

Chaque record exige :
- source ;
- date de revue ;
- territoire ;
- période ;
- statut ;
- limites ;
- réviseur.

Acteurs :
- aucun classement sans méthode.

Événements :
- date de l'événement distincte de la publication ;
- lieu/source ;
- aucune causalité inventée.

Innovations :
- maturité ;
- eau économisée si sourcée ;
- coût ;
- énergie/carbone ;
- secteurs ;
- limites.

Aucun texte factuel généré au runtime.

Commit :

`feat(carbon): ajoute les contenus sourcés Water Intelligence`

## Commit C4 — Intégration shell

Remplacer les placeholders uniquement avec :
- snapshots autorisés ;
- contenus sourcés ;
- valeurs absentes honnêtes ;
- attribution.

Aucune fixture visible.

Créer une Preview Vercel.

## Commit C5 — Handoff

Créer `handoffs/WAVE_C_PUBLIC_DATA_PRODUCT.md` :
- manifest ;
- budgets ;
- sources/exclusions ;
- résultats Preview ;
- passage vers Wave D.

## Validation

- API/front ;
- tsc/lint/build ;
- E2E/a11y ;
- budgets ;
- Preview READY ;
- aucun runtime fetch ;
- aucun tenant public ;
- `/water` intact.

Ouvre une PR unique et arrête-toi.
---


# MACRO-PROMPT D — Couche décisionnelle
## P13 conformité + P14 synergies + P15 finance

**Branche :** `feat/water-intelligence-wave-d-decision-layer`

## Objectif

Ajouter :
- registre juridique versionné ;
- ponts Carbon&Co ;
- scénarios financiers inspectables.

## Gate réglementaire

Utiliser uniquement des sources officielles et actuelles.

Chaque règle porte :
- juridiction ;
- texte/version ;
- statut ;
- adoption ;
- entrée en vigueur ;
- application ;
- transposition ;
- conditions ;
- source ;
- revue humaine.

Non vérifié → `unknown`.
Aucun conseil juridique.

## Commit D1 — Compliance P13

Périmètre :
- CSRD ;
- ESRS E3/E2/E4/ESRS 2 ;
- Taxonomie UE ;
- droit UE de l'eau/polluants ;
- GRI 303 ;
- CDP Water ;
- TNFD/LEAP ;
- SBTN ;
- France seulement si officiel.

Registre versionné, pas de dates dans JSX.

Moteur limité :
- in_scope ;
- out_of_scope ;
- conditional ;
- unknown.

Champ manquant → unknown.

Tests :
- version ;
- dates ;
- futur ;
- matérialité ;
- transposition ;
- source ;
- historique.

Commit :

`feat(carbon): ajoute le registre juridique Water Intelligence`

## Commit D2 — Synergies P14

Ponts :
- `/water`;
- `/sites-geo`;
- `/resources`;
- `/materials`;
- `/iro`;
- `/materialite`;
- énergie/Scope 2 ;
- achats/Scope 3 ;
- actions.

Réutiliser `water`, `water_activity`, objets, RLS/anti-IDOR.

Aucun tenant public.

Créer une synthèse authentifiée :
- risque ;
- confiance ;
- dépendance ;
- ressource/matière ;
- IRO ;
- actions.

Jamais de score ESG global.

Tests tenant A/B.

Si migration nécessaire :
- arrêter D2 ;
- documenter ;
- proposer PR dédiée ;
- ne pas la créer ici.

Commit :

`feat(carbon): relie Water Intelligence aux modules CarbonCo`

## Commit D3 — Finance P15

Moteur pur d'hypothèses :
- jours d'arrêt ;
- capacité ;
- revenu/marge ;
- OPEX ;
- CAPEX ;
- probabilité/scénario ;
- horizon ;
- taux d'actualisation explicite.

Séparer observé/hypothèse/dérivé.

Afficher sensibilité, pas certitude.

Signaux à examiner :
- IAS 36 ;
- IAS 37 ;
- IFRIC 21 ;
- continuité ;
- assurance ;
- redevances/taxes.

Aucune écriture comptable.
Aucun taux fiscal inventé.
Aucune probabilité LLM.

Tests :
- unités ;
- null ;
- scénarios ;
- arrondis ;
- reproductibilité ;
- sensibilités.

Commit :

`feat(carbon): ajoute les scénarios financiers hydriques`

## Commit D4 — Handoff

Créer `handoffs/WAVE_D_DECISION_LAYER.md` :
- matrice règle/donnée/preuve/module ;
- matrice synergies ;
- doc calculateur ;
- passage vers Wave E.

## Validation

- tests juridiques ;
- RLS/anti-IDOR ;
- finance ;
- API/front ;
- tsc/lint/build ;
- aucune conclusion automatique ;
- aucun tenant public ;
- aucune migration inattendue.

Ouvre une PR unique et arrête-toi.
---


# MACRO-PROMPT E — Finalisation
## P16 QA + P17 Preview ; P18 optionnel

**Branche :** `release/water-intelligence-wave-e-finalization`

## Objectif

Clore le module avec :
- preuve de qualité ;
- sécurité ;
- performance ;
- accessibilité ;
- Preview Vercel ;
- dossier de décision.

Aucune production volontaire.

## Commit E1 — Données

Vérifier :
- parité ;
- fraîcheur ;
- licence ;
- attribution ;
- couverture ;
- unités ;
- géographies ;
- périodes ;
- valeurs absentes ;
- méthode ;
- scénarios ;
- fixtures invisibles.

WRI :
- enregistrement effectué et preuve + décision explicite ;
- ou exclusion du snapshot final.

## Commit E2 — Sécurité

Vérifier :
- aucun tenant public ;
- RLS/anti-IDOR ;
- aucune URL arbitraire ;
- allowlist ;
- secrets/logs ;
- CSP ;
- caches public/privé ;
- licence révoquée ;
- SSRF ;
- dépendances.

## Commit E3 — Performance/a11y

Mesurer :
- bundle ;
- gzip ;
- requêtes ;
- cache/ETag ;
- carte ;
- mobile ;
- clavier ;
- lecteur d'écran ;
- contraste ;
- table alternative ;
- reduced motion ;
- focus.

Ajouter budgets CI.

## Commit E4 — Résilience

Tester :
- source absente ;
- release stale ;
- couche manquante ;
- cache froid ;
- parsing ;
- licence bloquée ;
- snapshot incomplet ;
- erreur opérateur ;
- EDO indisponible ;
- qualité censurée.

Aucun fallback silencieux.

## Commit E5 — Dossier final

Créer :
- `FINAL_TRACEABILITY.md`;
- inventaire sources/releases ;
- manifest final ;
- tests/mesures ;
- licences/exclusions ;
- risques résiduels ;
- gestes opérateur ;
- rollback ;
- décision de production.

Mettre à jour le statut produit avec preuves exactes.

## Preview

Créer et tester :
- `/water-intelligence`;
- `/water`;
- desktop/mobile ;
- clair/sombre ;
- source disponible/absente/stale ;
- carte ;
- conformité ;
- bridges authentifiés ;
- logs runtime.

Preview = READY.

## P18

Produire seulement une décision documentaire :
- garder `/water-intelligence`;
- canonical `/eau`;
- alias.

Aucun redirect sans décision humaine.

## Validation finale

- API/front ;
- DB-gated CI ;
- E2E ;
- build/lint/tsc ;
- gitleaks ;
- Vercel ;
- zéro erreur console ;
- budgets ;
- a11y ;
- sécurité.

Ouvre une Draft PR finale.
Ne merge pas.
Ne promeus pas en production.
Arrête-toi.
---


# Mode d'utilisation

1. Lancer Macro A dans une nouvelle session.
2. Relire, corriger et fusionner Wave A.
3. Nouvelle session : Macro B.
4. Relire et fusionner Wave B.
5. Nouvelle session : Macro C.
6. Relire et fusionner Wave C.
7. Nouvelle session : Macro D.
8. Relire et fusionner Wave D.
9. Nouvelle session : Macro E.

Ne donne pas les cinq macro-prompts dans une seule session.

Le gain de vitesse vient :
- du regroupement par architecture ;
- des commits atomiques ;
- des tests communs ;
- d'une PR par vague ;
- pas de la suppression de la revue humaine.
