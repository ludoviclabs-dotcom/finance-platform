
# Carbon&Co — Water Intelligence
## Plan d’architecture et pack de prompts séquencés

**Version :** 1.0  
**Date de cadrage :** 23 juillet 2026  
**Dépôt :** `ludoviclabs-dotcom/finance-platform`  
**Projet Vercel :** `carbon`

---

## 1. Décision d’architecture

Le projet n’est pas un chantier vierge. Carbon&Co possède déjà :

- un cockpit authentifié `/water` ;
- un ledger de prélèvements, consommations et rejets ;
- des permis ;
- des sites géocodés avec revue humaine ;
- des zones de risque hydrique sourcées ;
- un moteur déterministe de screening ;
- des runs immuables, cibles, actions et signaux IRO ;
- un Evidence Kernel pour les sources, releases, artefacts, observations, licences et fraîcheur ;
- un contrat d’adaptateur déterministe ;
- des composants de provenance réutilisables ;
- des tests backend, frontend et migrations.

La bonne cible est donc une architecture à **deux surfaces complémentaires** :

1. **Cockpit entreprise authentifié** — route existante `/water`  
   Données tenant, sites, activités, permis, screening, cibles, actions, IRO.

2. **Module public d’intelligence hydrique** — route initiale recommandée `/water-intelligence`  
   Contexte mondial/européen/français, cartographie multi-échelle, secteurs, événements, innovations, obligations et passerelles Carbon&Co.

La migration éventuelle d’URL est isolée dans un prompt optionnel. Elle ne doit pas être mélangée au développement fonctionnel.

---

## 2. Architecture cible

```text
Sources officielles
  ├─ WRI Aqueduct
  ├─ EEA / WISE / WEI+
  ├─ Copernicus EDO
  ├─ Hub'Eau / ADES / BNPE / Naïades
  ├─ SANDRE / BRGM / Géorisques
  └─ sources entreprise déjà présentes
          │
          ▼
Jobs opérateur protégés / CLI / GitHub Actions
  - téléchargement borné
  - cache HTTP et reprise
  - checksum
  - validation de structure
  - licence et attribution
  - aucune utilisation d'un LLM
          │
          ▼
Evidence Kernel existant
  source_registry → source_releases → evidence_artifacts → observations
          │
          ├─ brut conservé hors bundle frontend
          ├─ release immuable
          ├─ provenance et fraîcheur
          └─ droits d'affichage / stockage / dérivation
          │
          ▼
Build de snapshots compacts
  - manifest versionné
  - agrégats par échelle
  - géométries simplifiées
  - index et crosswalks explicites
  - contrôles de parité
          │
          ▼
Read model public
  - données publiées uniquement
  - cache/ISR/ETag
  - pagination et chargement par couche
          │
          ▼
/water-intelligence
  Server Component + îlots interactifs
  - contexte
  - carte
  - secteurs/acteurs
  - climat/événements
  - innovations
  - conformité
  - passerelles financières
  - sources et preuves
          │
          ├─ lien vers /water (cockpit)
          ├─ lien vers /materials
          ├─ lien vers /resources
          └─ lien vers /iro et /materialite
```

---

## 3. Principe anti-volume

Les jeux bruts ne doivent jamais être :

- importés dans le bundle React ;
- sérialisés entièrement dans le HTML/RSC ;
- récupérés directement auprès d’un portail externe à chaque visite ;
- chargés sans borne temporelle ou géographique ;
- dupliqués à la fois dans Git, PostgreSQL et Blob ;
- convertis en milliers d’observations inutiles sans cas d’usage défini.

### Budgets internes initiaux

Ces valeurs sont des budgets Carbon&Co proposés, non des limites Vercel :

| Objet | Budget initial |
|---|---:|
| Manifest public non compressé | 100 Ko |
| Données critiques du premier écran non compressées | 250 Ko |
| Une couche géographique compressée | 400 Ko |
| Requêtes réseau initiales de la page | 6 maximum |
| Séries temporelles initiales par graphique | 120 points maximum |
| Entités affichées simultanément sur la carte | 1 000 maximum |
| Sources nouvelles dans une PR de connecteur | 1 famille de source |
| Historique initial | snapshot courant + un comparatif explicite |

Tout dépassement doit être mesuré, expliqué et validé dans la PR.

### Stratégie géographique

- Monde : agrégats et géométries très simplifiées.
- Europe : districts ou sous-unités EEA, chargés à la demande.
- France : bassins/sous-bassins, stations et points chargés selon la zone visible.
- Site : uniquement dans le cockpit authentifié, jamais dans le dataset public.
- Les rapprochements utilisent des identifiants officiels ou des tables de correspondance revues ; aucun fuzzy matching silencieux.

---

## 4. Principe anti-hallucination

### Données quantitatives

Chaque valeur doit être une observation sourcée ou une dérivation déterministe dont la formule est versionnée.

### Contenus éditoriaux

Les textes sur les industries, acteurs, catastrophes, innovations et normes sont stockés comme enregistrements structurés avec :

```text
id
title
summary
jurisdiction
valid_from
valid_to
status
source_refs[]
reviewed_on
reviewed_by
data_status
confidence_note
```

Aucun texte factuel n’est généré par un LLM au runtime.

### Juridique

La page ne conclut jamais simplement « obligatoire ». Elle distingue au minimum :

```text
in_force
adopted_not_applicable
proposed
transposition_pending
materiality_dependent
voluntary
out_of_scope
unknown
```

Une règle sans source officielle et date de revue ne peut pas être publiée.

### Scoring

Le module ne crée pas un score hydrique unique opaque. Les dimensions restent séparées :

- stress structurel ;
- sécheresse ;
- inondation ;
- eaux souterraines ;
- qualité/pollution ;
- dépendance opérationnelle ;
- sensibilité réglementaire ;
- capacité d’adaptation ;
- confiance documentaire.

---

## 5. Protocole de livraison

Chaque prompt correspond à une PR autonome.

```text
P00 → audit et décisions
P01 → catalogue de sources
P02 → contrats de données
P03 → pipeline opérateur générique
P04 → shell public
P05 → WRI Aqueduct
P06 → EEA / WEI+
P07 → Hub'Eau hydrométrie et piézométrie
P08 → Hub'Eau prélèvements et qualité
P09 → Copernicus sécheresse
P10 → assembleur de snapshots et cache
P11 → cartographie interactive
P12 → contenu secteurs, acteurs, événements, innovations
P13 → registre juridique et conformité
P14 → synergies Carbon&Co
P15 → passerelle financière
P16 → qualité finale
P17 → Preview et dossier de livraison
P18 → rationalisation d’URL optionnelle
```

Un prompt ne commence que lorsque la PR précédente est fusionnée, `master` est vert et la base de travail est resynchronisée.

---


# P00 — Audit immuable et ADR de frontière


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `docs/water-intelligence-p00-baseline`

Travail documentaire uniquement. Ne modifie aucun code applicatif, package, migration ou configuration Vercel.

### Objectif

Établir la vérité du dépôt avant toute implémentation et figer les frontières entre le cockpit eau existant et le nouveau module public.

### Inspection obligatoire

- route existante `apps/carbon/app/(app)/water/page.tsx` ;
- client `apps/carbon/lib/api/water.ts` ;
- modèles, routes, services et migrations eau dans `apps/api` ;
- Evidence Kernel et Source Admin ;
- `/materials`, `/resources`, `/iro`, `/materialite` ;
- configuration de navigation, authentification, CSP, feature status ;
- workflows frontend/API/migrations ;
- projet et dernières Preview/Production Vercel ;
- CSV de sources fourni par l’opérateur.

### Livrables

Créer uniquement :

- `docs/carbonco/water-intelligence/00_BASELINE_AUDIT.md`
- `docs/carbonco/water-intelligence/01_ADR_SURFACES_AND_ROUTES.md`
- `docs/carbonco/water-intelligence/02_CURRENT_CAPABILITIES_MATRIX.md`
- `docs/carbonco/water-intelligence/03_RISKS_AND_STOP_CONDITIONS.md`

L’ADR doit retenir par défaut :

- `/water` = cockpit authentifié existant, inchangé ;
- `/water-intelligence` = module public ;
- aucune donnée tenant dans la surface publique ;
- aucun appel externe au runtime ;
- réutilisation de l’Evidence Kernel ;
- aucune migration tant qu’un manque concret de schéma n’est pas démontré.

### Critères d’acceptation

- carte exacte des routes et groupes Next.js ;
- liste des tables et invariants déjà présents ;
- liste des composants réutilisables ;
- liste des collisions potentielles ;
- décision explicite sur les données brutes, dérivées et publiées ;
- SHA de base, commandes et résultats consignés ;
- zéro fichier hors `docs/carbonco/water-intelligence/`.

---


# P01 — Normalisation du catalogue de sources fourni


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `feat/water-intelligence-p01-source-catalog`

### Objectif

Transformer le CSV opérateur en un catalogue versionné et validé, sans télécharger de données et sans enregistrer encore de release réelle.

### Entrée

Le CSV contient les portails Eaufrance, HydroPortail, ADES, SIGES, InfoTerre, Naïades, SANDRE, BNPE, SISPEA, Sextant, data.gouv/SIE et Géoportail/Géorisques.

### Tâches

1. Définir un schéma de catalogue distinct d’une observation :
   - `source_code`
   - `portal_name`
   - `theme`
   - `geographic_scope`
   - `source_role`
   - `connector_candidate`
   - `access_mode`
   - `official_domain`
   - `priority`
   - `planned_prompt`
   - `notes`
2. Ajouter un parseur pur et déterministe du CSV.
3. Normaliser les espaces, accents et codes, sans corriger silencieusement un contenu ambigu.
4. Produire un fichier normalisé et un rapport de validation.
5. Distinguer :
   - portail de découverte ;
   - référentiel ;
   - API ;
   - service OGC ;
   - téléchargement de release ;
   - donnée contextuelle non ingérée.
6. Ne créer aucune ligne factuelle dans `source_registry` à ce stade.
7. Ajouter des tests avec le CSV complet et des cas invalides.

### Interdictions

- aucun appel réseau ;
- aucune URL devinée ;
- aucun statut de licence supposé ;
- aucune migration ;
- aucun seed automatique de production ;
- aucune donnée métier.

### Critères d’acceptation

- les 12 lignes sont conservées et traçables ;
- zéro doublon de `source_code` ;
- ambiguïtés explicites dans le rapport ;
- résultat stable byte pour byte ;
- tests purs verts ;
- documentation expliquant quels portails deviennent des connecteurs et lesquels restent des index.

---


# P02 — Contrats du read model public et budgets


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `feat/water-intelligence-p02-contracts`

### Objectif

Définir les contrats Python et TypeScript du module public, sans migration et sans UI complète.

### Tâches

1. Inspecter `models/analytics.py`, `models/water.py`, `lib/api/water.ts`, les modèles Intelligence et les badges existants.
2. Créer des contrats miroir pour :
   - `WaterIntelligenceManifest`
   - `WaterMetricObservation`
   - `WaterGeoLayerDescriptor`
   - `WaterSourceReference`
   - `WaterLicenseDecision`
   - `WaterQualityMetadata`
   - `WaterScenario`
   - `WaterGeographyRef`
   - `WaterEditorialRecord`
   - `WaterLegalRecord`
3. Garantir par les types :
   - risque et confiance séparés ;
   - valeur absente distincte de zéro ;
   - période et géographie obligatoires ;
   - source/release obligatoires pour une donnée publiée ;
   - licence d’affichage explicite ;
   - méthode et version explicites ;
   - statut `observed`, `modelled`, `estimated`, `manual`, `fixture`.
4. Ajouter un mini manifest de fixture clairement étiqueté.
5. Ajouter des validateurs Zod côté frontend et Pydantic côté API.
6. Ajouter un test de compatibilité contractuelle entre la fixture Python et TypeScript.
7. Documenter les budgets de payload et les niveaux de zoom.

### Interdictions

- aucune table ;
- aucun endpoint public ;
- aucune donnée réelle ;
- aucun score composite ;
- aucun package nouveau.

### Critères d’acceptation

- un manifest invalide est refusé avec une erreur lisible ;
- un record sans release ou avec `display_allowed=false` ne peut pas être publié ;
- une valeur `null` ne devient jamais `0` ;
- schémas versionnés ;
- tests backend et frontend verts.

---


# P03 — Pipeline opérateur générique hors runtime


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `feat/water-intelligence-p03-ingestion-pipeline`

### Objectif

Construire l’ossature d’ingestion réutilisable autour du `SourceAdapter` et de l’Evidence Kernel, uniquement avec des fixtures locales.

### Tâches

1. Réutiliser le contrat `detect_releases → fetch_release → parse → normalize`.
2. Ajouter une couche d’orchestration eau :
   - plan ;
   - fetch ;
   - parse ;
   - normalize ;
   - derive ;
   - validate ;
   - publish.
3. Séparer strictement :
   - adaptateur de source ;
   - normalisation ;
   - dérivation ;
   - écriture Evidence Kernel ;
   - construction du snapshot public.
4. Ajouter une CLI opérateur, jamais appelée par une route HTTP.
5. Ajouter :
   - checksum ;
   - idempotence ;
   - reprise ;
   - rapport de parité ;
   - dry-run ;
   - journal machine-readable ;
   - refus de publication si licence ou validation bloquent.
6. Introduire une interface de transport HTTP injectable, mais uniquement un faux transport dans cette PR.
7. Fixer les bornes : nombre de pages, volume brut, durée, fenêtre temporelle et fréquence.
8. Ajouter des fixtures minimales et des tests de reprise, duplication, corruption, licence bloquée et donnée absente.

### Interdictions

- aucun connecteur réel ;
- aucun secret ;
- aucun cron ;
- aucun endpoint d’écriture utilisateur ;
- aucune migration sauf preuve préalable d’un manque et PR séparée ;
- aucun LLM.

### Critères d’acceptation

- mêmes octets → même release et même snapshot ;
- second passage → zéro doublon ;
- échec partiel → pas de release publiée ;
- logs sans secret ;
- dry-run sans écriture ;
- tests entièrement hors réseau.

---


# P04 — Shell public Water Intelligence


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `feat/water-intelligence-p04-public-shell`

### Objectif

Créer la route publique sans toucher au cockpit `/water`.

### Route

Créer `apps/carbon/app/water-intelligence/page.tsx`, en dehors du groupe authentifié `(app)`.

### Tâches

1. Créer metadata, canonical, Open Graph et contenu sémantique français.
2. Créer un thème `Water Intelligence` cohérent avec `/materials`, sans réutiliser des noms `Mx*` propres aux matières.
3. Extraire seulement les primitives réellement communes si cela réduit la duplication sans régression.
4. Créer :
   - navigation ancrée ;
   - hero ;
   - bandeau snapshot/provenance ;
   - sections vides structurées ;
   - pied de page ;
   - états erreur, indisponible, stale et fixture.
5. Utiliser uniquement le mini manifest de fixture P02, clairement marqué « démonstration ».
6. Ajouter un lien vers le cockpit `/water` avec libellé explicite.
7. Préserver le rendu serveur et charger les composants clients uniquement quand nécessaire.
8. Ajouter tests de route, metadata, accessibilité de base et absence de conflit avec `/water`.

### Interdictions

- pas de vraie carte ;
- pas de chiffres réels ;
- pas de fetch externe ;
- pas de copie intégrale du code `/materials` ;
- pas de migration ;
- pas de modification du cockpit.

### Critères d’acceptation

- `/water` continue de résoudre vers le cockpit authentifié ;
- `/water-intelligence` est publique ;
- aucun bailout CSR global ;
- thème clair/sombre accessible ;
- build, lint et tests verts.

---


# P05 — Connecteur WRI Aqueduct


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `feat/water-intelligence-p05-aqueduct`

### Objectif

Ajouter le premier connecteur réel, limité à WRI Aqueduct, pour le screening mondial structurel et les scénarios publiés.

### Tâches

1. Vérifier la source officielle, la version, la licence et les obligations d’attribution au moment de l’exécution.
2. Définir une configuration de release opérateur ; aucun téléchargement au runtime.
3. Accepter un fichier officiel local ou un téléchargement explicite CLI.
4. Conserver l’artefact brut avec checksum et métadonnées.
5. Normaliser seulement les indicateurs approuvés par l’ADR :
   - stress hydrique structurel ;
   - variabilité/sécheresse si disponible dans la release ;
   - scénarios/horizons explicitement publiés.
6. Utiliser les identifiants HydroBASINS/PFAF_ID fournis, sans jointure par nom.
7. Construire une couche monde simplifiée et un résumé par pays/région.
8. Présenter Aqueduct comme outil de priorisation, pas comme preuve locale de conformité.
9. Ajouter tests à partir d’un sous-échantillon officiel minimal figé.
10. Documenter la taille brute, normalisée et publiée.

### Interdictions

- ne pas committer le dataset complet ;
- ne pas télécharger toutes les versions historiques ;
- ne pas inventer de projection ;
- ne pas appeler Aqueduct depuis le navigateur ;
- ne pas convertir une classe en conclusion réglementaire.

### Critères d’acceptation

- release sourcée, licenciée et idempotente ;
- crosswalk sans fuzzy matching ;
- snapshot compact sous budget ou dépassement justifié ;
- attribution visible ;
- données manquantes conservées comme telles ;
- tests réseau zéro.

---


# P06 — Connecteur EEA / WISE / WEI+


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `feat/water-intelligence-p06-eea-wei`

### Objectif

Ajouter la couche européenne de rareté hydrique par bassin/sous-unité et période.

### Tâches

1. Vérifier et pinner la release EEA/WISE officielle disponible.
2. Enregistrer source, release, artefact, licence, date et méthodologie.
3. Normaliser les identifiants officiels des districts et sous-unités.
4. Conserver la saison/période ; ne pas aplatir une série saisonnière en une valeur annuelle sans méthode.
5. Importer uniquement les périodes nécessaires au MVP.
6. Construire :
   - agrégat UE ;
   - couche district/sous-unité simplifiée ;
   - comparatif temporel borné.
7. Stocker les seuils et définitions dans les métadonnées de méthode ; ne pas les dupliquer dans le JSX.
8. Ajouter tests sur doublons, unités, période, géographie inconnue, absence de valeur et licence.

### Interdictions

- aucune jointure par libellé ;
- aucun remplissage spatial arbitraire ;
- aucune moyenne inter-bassins sans pondération documentée ;
- aucune requête live depuis la page ;
- aucun historique complet non borné.

### Critères d’acceptation

- release et période visibles ;
- distinction structurel/saisonnier ;
- couverture et confiance séparées ;
- couche conforme au budget ;
- tests purs et import idempotent.

---


# P07 — Hub’Eau — hydrométrie et piézométrie


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `feat/water-intelligence-p07-hubeau-hydro-piezo`

### Objectif

Ajouter les observations françaises de débit/niveau et nappes, avec requêtes opérateur bornées.

### Tâches

1. Utiliser uniquement les API officielles actuelles et leurs versions.
2. Créer deux adaptateurs séparés :
   - hydrométrie ;
   - piézométrie.
3. Le transport HTTP doit gérer :
   - pagination ;
   - timeout ;
   - retry borné ;
   - backoff ;
   - cache local ;
   - statut HTTP ;
   - limites configurables ;
   - arrêt sur schéma inattendu.
4. Requêtes MVP :
   - métadonnées des stations d’une zone explicite ;
   - fenêtre temporelle courte ;
   - dernier état ou agrégats déterministes ;
   - aucune récupération France entière de toutes les chroniques.
5. Utiliser les codes stations et référentiels officiels.
6. Produire des agrégats région/bassin séparés des observations de station.
7. Surface publique : uniquement agrégats et points sélectionnés ; pas toutes les mesures.
8. Ajouter des fixtures de réponses officielles minimales et tests de pagination, limite, erreur, données absentes et fraîcheur.

### Interdictions

- aucun appel navigateur ;
- aucune requête sans filtre géographique ou temporel ;
- aucune interpolation inventée ;
- aucune fusion débit/niveau ;
- aucun package de cartographie nouveau.

### Critères d’acceptation

- nombre maximum de pages configurable et testé ;
- arrêt propre en cas de limite ;
- source/release par extraction ;
- taille publiée mesurée ;
- valeurs et unités conservées ;
- tests hors réseau.

---


# P08 — Hub’Eau — prélèvements et qualité


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `feat/water-intelligence-p08-hubeau-withdrawals-quality`

### Objectif

Ajouter les volumes de prélèvement et un sous-ensemble maîtrisé de données de qualité de surface/souterraine.

### Tâches

1. Créer des adaptateurs distincts pour :
   - prélèvements/BNPE ;
   - qualité des cours d’eau/plans d’eau ;
   - qualité des eaux souterraines si retenue.
2. Définir une allowlist initiale de paramètres de qualité, documentée et approuvée ; ne pas aspirer tous les analytes.
3. Utiliser les codes SANDRE et identifiants officiels.
4. Conserver :
   - année/période ;
   - usage ;
   - type de ressource ;
   - unité ;
   - statut et éventuelles limites connues de couverture.
5. Ne pas interpréter l’absence de prélèvement déclaré comme zéro.
6. Pour la qualité :
   - conserver limite de quantification, statut de mesure et unité si disponibles ;
   - ne pas conclure « conforme/non conforme » sans seuil juridique contextualisé ;
   - ne pas agréger des paramètres incompatibles.
7. Construire des résumés bornés par territoire et paramètre.
8. Ajouter tests de codes inconnus, unités incompatibles, valeurs censurées, absence, pagination et idempotence.

### Interdictions

- aucun classement sanitaire ;
- aucun seuil inventé ;
- aucune jointure par nom de station ;
- aucun historique illimité ;
- aucune exposition de coordonnées sensibles non autorisées.

### Critères d’acceptation

- caveats de couverture visibles ;
- paramètres et unités inspectables ;
- agrégats reproductibles ;
- licence et attribution respectées ;
- tests hors réseau.

---


# P09 — Copernicus EDO — snapshot sécheresse


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `feat/water-intelligence-p09-copernicus-drought`

### Objectif

Ajouter une couche de situation courante de sécheresse distincte du stress structurel.

### Tâches

1. Inspecter les services officiels WMS/WCS et choisir le mode le plus léger compatible avec le dépôt.
2. Pinner une date de snapshot ; ne jamais utiliser implicitement « latest » dans un build reproductible.
3. Enregistrer requête, paramètres, date, checksum, licence et attribution.
4. Construire une couche dérivée légère ou une image géoréférencée adaptée à l’UI existante.
5. Ne pas ajouter GDAL ou une dépendance lourde sans ADR et mesure. Si aucun chemin robuste n’existe avec les outils présents, livrer le connecteur/fixture et documenter le blocage sans simuler la donnée.
6. Séparer explicitement :
   - stress structurel Aqueduct/WEI+ ;
   - indicateur courant de sécheresse Copernicus.
7. Ajouter tests de date, paramètres, absence, corruption et budget.

### Interdictions

- aucun appel WMS/WCS depuis le navigateur ;
- aucune date flottante ;
- aucune animation automatique d’archives ;
- aucune fusion avec le score de stress ;
- aucune fausse précision locale.

### Critères d’acceptation

- snapshot daté et reproductible ;
- attribution visible ;
- couche sous budget ;
- date et statut de fraîcheur affichés ;
- absence rendue comme indisponible, jamais faible.

---


# P10 — Assembleur de snapshots, stockage et cache


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `feat/water-intelligence-p10-snapshot-read-model`

### Objectif

Assembler les releases publiées en un read model public compact et stable.

### Tâches

1. Inspecter `artifact_service`, Vercel Blob, le mode de stockage existant et les patterns de cache.
2. Définir un manifest immuable :
   - version ;
   - generated_at fourni explicitement au build ;
   - input release IDs ;
   - input hashes ;
   - layers ;
   - metrics ;
   - coverage ;
   - warnings ;
   - license decisions.
3. Construire les sorties par niveau :
   - monde ;
   - Europe ;
   - France ;
   - métadonnées des couches.
4. Ne publier que les valeurs `display_allowed`.
5. Si `derived_use_allowed=false`, refuser la construction de la couche dérivée.
6. Stocker les gros artefacts hors Git ; seuls manifest exemple et fixtures restent dans le dépôt.
7. Ajouter cache/ETag/ISR ou cache tags selon le pattern du projet.
8. Ajouter un endpoint/loader public en lecture seule, borné et sans données tenant.
9. Ajouter vérification de parité entre observations et snapshot.
10. Ajouter un test de budget gzip dans la CI.

### Interdictions

- aucune lecture de l’intégralité des observations à chaque requête ;
- aucun blob privé exposé sans contrôle ;
- aucune valeur sous licence bloquée dans le JSON public ;
- aucune horloge implicite dans un calcul reproductible ;
- aucune mutation depuis la page.

### Critères d’acceptation

- même ensemble de releases → même hash de snapshot ;
- cache invalidé seulement lors d’une publication ;
- payloads sous budgets ou exception documentée ;
- endpoint public sans authentification tenant et sans fuite ;
- ETag fonctionnel ;
- tests de licence et parité verts.

---


# P11 — Explorateur cartographique interactif


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `feat/water-intelligence-p11-map`

### Objectif

Créer la pièce maîtresse cartographique à partir du read model P10.

### Tâches

1. Réutiliser D3, TopoJSON, World Atlas et les primitives déjà installées.
2. Créer une carte multi-échelle :
   - monde ;
   - Europe ;
   - France ;
   - panneau de détail.
3. Charger les couches à la demande selon niveau, territoire, période, scénario et dimension.
4. Conserver chaque dimension séparée ; un sélecteur change la couche, pas un score fusionné.
5. Synchroniser sélection et filtres dans l’URL.
6. Ajouter légende, source, date, méthode, confiance, couverture et avertissements.
7. Prévoir :
   - navigation clavier ;
   - focus visible ;
   - table alternative ;
   - labels non fondés sur la couleur seule ;
   - `prefers-reduced-motion`.
8. Limiter les features actives et mesurer le temps de rendu.
9. Ajouter tests unitaires des sélections et E2E desktop/mobile.

### Interdictions

- pas de Mapbox/Google Maps ;
- pas de tuiles externes au runtime ;
- pas de coordonnées tenant ;
- pas de tooltip contenant une valeur non sourcée ;
- pas de « risque faible » pour une couche absente.

### Critères d’acceptation

- première interaction sans chargement de toutes les couches ;
- URL partageable ;
- table alternative complète ;
- pas d’erreur console ;
- respect des budgets ;
- tests reduced-motion et clavier.

---


# P12 — Contexte, secteurs, acteurs, événements et innovations


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `feat/water-intelligence-p12-editorial`

### Objectif

Ajouter les contenus explicatifs et comparatifs sans introduire de faits non vérifiés.

### Tâches

1. Créer des fichiers de contenu structurés validés par le schéma P02.
2. Sections :
   - situation générale de l’eau ;
   - industries exposées ;
   - acteurs de l’écosystème ;
   - conditions climatiques ;
   - événements/catastrophes ;
   - innovations et adaptation.
3. Chaque record comporte sources, date de revue, territoire, période et statut.
4. Les « acteurs majeurs » ne sont classés que si une méthode objective et sourcée existe ; sinon présenter un écosystème non classé.
5. Les événements comportent date de l’événement et date de publication distinctes.
6. Les innovations affichent aussi arbitrages énergie/carbone, maturité et limites.
7. Ajouter une UI filtrable et des composants de citation/provenance.
8. Ajouter tests refusant tout record sans source ou date de revue.

### Interdictions

- aucun texte factuel généré au runtime ;
- aucune citation longue ;
- aucun chiffre sans source ;
- aucune entreprise présentée comme leader sur simple intuition ;
- aucune catastrophe sans date et lieu ;
- aucune innovation présentée comme bénéfice net sans caveat.

### Critères d’acceptation

- 100 % des records publiés sont sourcés ;
- méthodologie des classements visible ;
- distinctions monde/UE/France ;
- contenus accessibles sans carte ;
- aucune donnée tenant.

---


# P13 — Registre juridique et Compliance Cockpit


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `feat/water-intelligence-p13-legal-registry`

### Objectif

Créer un registre versionné de règles et référentiels, sans conseil juridique automatique.

### Périmètre initial

- CSRD et périmètre applicable ;
- ESRS E3, E2, E4 et ESRS 2 ;
- Taxonomie européenne ;
- droit européen de l’eau et polluants ;
- GRI 303 ;
- CDP Water Security ;
- TNFD/LEAP ;
- SBTN Freshwater ;
- règles nationales sélectionnées lorsque sourcées officiellement.

### Tâches

1. Définir les champs :
   - juridiction ;
   - texte/référentiel ;
   - version ;
   - statut juridique ;
   - adoption ;
   - entrée en vigueur ;
   - application ;
   - transposition ;
   - conditions ;
   - données/preuves attendues ;
   - liens Carbon&Co ;
   - sources officielles ;
   - revue humaine.
2. Ne jamais coder les dates et statuts directement dans le JSX.
3. Créer un moteur déterministe limité à :
   - affichage de conditions ;
   - résultat `in_scope`, `out_of_scope`, `conditional`, `unknown`.
4. Tout champ manquant conduit à `unknown`, jamais à une conclusion favorable.
5. Afficher clairement « information, pas conseil juridique ».
6. Ajouter tests de changement de version, date future, transposition, matérialité dépendante et champ inconnu.

### Interdictions

- aucune conclusion fiscale/comptable automatique ;
- aucune source secondaire lorsque le texte officiel est disponible ;
- aucune règle « obligatoire » sans condition et date ;
- aucune mise à jour par LLM ;
- aucune suppression d’une version ancienne.

### Critères d’acceptation

- historique des versions conservé ;
- statut et dates visibles ;
- sources officielles liées ;
- `unknown` correctement rendu ;
- tests de non-régression réglementaire ;
- revue humaine requise avant publication.

---


# P14 — Synergies avec les modules Carbon&Co


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `feat/water-intelligence-p14-carbonco-bridges`

### Objectif

Créer des liens cohérents entre Water Intelligence et les modules existants sans dupliquer les données ni fusionner les scores.

### Tâches

1. Cartographier les ponts existants :
   - `/water` ;
   - `/sites-geo` ;
   - `/resources` ;
   - `/materials` ;
   - `/iro` ;
   - `/materialite` ;
   - Scope 2/3 et actions.
2. Utiliser les relations déjà prévues `ResourceRole="water"` et `LinkKind="water_activity"`.
3. Ajouter des liens contextuels :
   - matière → exposition hydrique ;
   - ressource → activité eau ;
   - site → bassin/screening ;
   - screening → candidat IRO ;
   - IRO → double matérialité.
4. Ne pas copier les activités d’un tenant dans le read model public.
5. Créer une vue de synthèse authentifiée qui juxtapose :
   - risque hydrique ;
   - confiance ;
   - dépendance opérationnelle ;
   - ressource/matière associée ;
   - IRO et actions.
6. Respecter RLS et anti-IDOR ; tests croisés tenant A/B.
7. Ajouter des liens publics vers les explications Water Intelligence, sans exposer de détails tenant.

### Interdictions

- aucun score ESG global ;
- aucune moyenne eau + carbone + ressources ;
- aucune mutation automatique d’un IRO ;
- aucune donnée tenant dans le cache public ;
- aucune duplication de table.

### Critères d’acceptation

- chaque lien trace vers son objet source ;
- tenant A ne voit jamais tenant B ;
- risque et confiance restent séparés ;
- public et privé ont des caches distincts ;
- tests d’autorisation verts.

---


# P15 — Passerelle financière et scénarios


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `feat/water-intelligence-p15-financial-bridge`

### Objectif

Traduire une exposition hydrique en hypothèses financières inspectables, sans produire d’écriture comptable ou fiscale automatique.

### Tâches

1. Créer un calculateur pur de scénarios avec entrées explicites :
   - jours d’interruption ;
   - capacité affectée ;
   - marge/revenu journalier ;
   - OPEX additionnel ;
   - CAPEX de résilience ;
   - probabilité/scénario ;
   - horizon ;
   - taux d’actualisation si utilisé.
2. Séparer :
   - données observées ;
   - hypothèses utilisateur ;
   - résultats dérivés.
3. Versionner formule, unités et arrondis.
4. Afficher une analyse de sensibilité, pas un montant unique présenté comme certain.
5. Ajouter des signaux « à examiner » :
   - dépréciation ;
   - provision/remise en état ;
   - continuité d’exploitation ;
   - redevances/taxes ;
   - assurance.
6. Aucun signal n’est une conclusion comptable ou fiscale.
7. Ajouter tests d’unités, cas limites, valeurs nulles, scénarios et reproductibilité.

### Interdictions

- aucune écriture comptable ;
- aucun taux fiscal inventé ;
- aucune probabilité produite par un LLM ;
- aucun mélange montant réel/hypothèse ;
- aucun résultat sans unités.

### Critères d’acceptation

- audit trail des hypothèses ;
- formule lisible ;
- résultats reproductibles ;
- sensibilité multi-scénarios ;
- avertissement et source du cadre comptable ;
- aucun montant par défaut trompeur.

---


# P16 — QA globale : données, sécurité, performance et accessibilité


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `chore/water-intelligence-p16-quality-gates`

### Objectif

Auditer et renforcer le module complet sans ajouter de fonctionnalité métier.

### Tâches

1. Data quality :
   - parité ;
   - fraîcheur ;
   - licence ;
   - couverture ;
   - valeurs absentes ;
   - unités ;
   - géographies ;
   - dates.
2. Sécurité :
   - aucune donnée tenant publique ;
   - aucune URL arbitraire SSRF ;
   - allowlist des hôtes opérateur ;
   - secrets absents des logs ;
   - CSP inchangée ou modification minimale justifiée ;
   - anti-IDOR.
3. Performance :
   - bundle ;
   - payload gzip ;
   - nombre de requêtes ;
   - cache ;
   - temps de rendu carte ;
   - chargement mobile.
4. Accessibilité :
   - clavier ;
   - lecteur d’écran ;
   - contraste ;
   - table alternative ;
   - reduced motion ;
   - focus.
5. Résilience :
   - source indisponible ;
   - release stale ;
   - couche manquante ;
   - cache froid ;
   - erreur de parsing ;
   - licence révoquée.
6. Ajouter les tests et budgets à la CI existante.
7. Produire un rapport de défauts corrigés et résiduels.

### Interdictions

- aucune refonte visuelle générale ;
- aucune nouvelle source ;
- aucune migration ;
- aucun changement de formule ;
- aucun assouplissement de test pour faire passer la CI.

### Critères d’acceptation

- build/lint/unit/E2E verts ;
- zéro erreur console ;
- budgets contrôlés automatiquement ;
- aucun appel externe pendant les tests ;
- rapport WCAG et sécurité ;
- erreurs explicites, jamais fallback silencieux.

---


# P17 — Preview Vercel et dossier de livraison


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `release/water-intelligence-p17-preview`

### Objectif

Préparer une Preview vérifiable et un dossier de décision, sans production.

### Tâches

1. Rebaser sur `master`, résoudre les conflits sans modifier les invariants.
2. Vérifier toutes les migrations : aucune nouvelle migration inattendue.
3. Mettre à jour le registre de statut produit avec preuve exacte.
4. Mettre à jour navigation/sitemap uniquement selon la décision P00.
5. Générer une Preview Vercel.
6. Tester :
   - `/water-intelligence` public ;
   - `/water` authentifié ;
   - mobile/desktop ;
   - mode clair/sombre ;
   - données disponibles/absentes/stale ;
   - liens vers sources et cockpit ;
   - cache et ETag ;
   - logs runtime.
7. Produire :
   - `FINAL_TRACEABILITY.md`
   - inventaire des sources/releases ;
   - manifest de build ;
   - résultats tests ;
   - mesures de payload ;
   - checklist de rollback ;
   - risques résiduels ;
   - gestes opérateur.
8. Ouvrir une Draft PR. Ne pas la passer en Ready et ne pas merge.

### Critères d’acceptation

- Preview READY ;
- aucune erreur runtime ;
- aucune source externe appelée par le navigateur ;
- aucune donnée tenant dans la surface publique ;
- preuve de chaque chiffre ;
- rollback documenté ;
- décision humaine encore requise pour production.

---


# P18 — Rationalisation d’URL optionnelle — ne pas exécuter par défaut


## En-tête invariant à placer au début de chaque mission

Tu travailles dans le dépôt `ludoviclabs-dotcom/finance-platform`, application principale `apps/carbon` et API `apps/api`.

Règles absolues :

1. Commence par synchroniser et inspecter `master`, afficher `git status`, `git rev-parse HEAD`, les versions Node/Python et l’état des migrations. Ne suppose jamais que le SHA observé dans un document ancien est encore la base courante.
2. Utilise une branche dédiée à cette seule mission. Une mission = une préoccupation = une PR. Ne mélange jamais une migration, un connecteur de données, une refonte UI et une modification réglementaire dans la même PR.
3. Ne fusionne rien et ne déploie jamais en production. Une Preview Vercel est autorisée seulement lorsque le prompt la demande.
4. Préserve le module authentifié existant `app/(app)/water/page.tsx`, donc la route `/water`. N’ajoute pas une seconde page résolue sur la même URL.
5. Aucun fait, chiffre, acteur, événement, seuil, statut juridique, donnée géographique ou série temporelle ne peut être inventé. Une fixture doit être explicitement étiquetée `fixture` ou `demo` et ne doit jamais être présentée comme une observation réelle.
6. Aucune source externe n’est appelée pendant le rendu d’une page ou une requête utilisateur. Les téléchargements externes sont des gestes opérateur ou des jobs protégés. Le frontend ne consomme que des releases publiées et des snapshots compacts.
7. Réutilise le noyau existant `source_registry` / `source_releases` / `evidence_artifacts` / `observations`, les règles de licence, les badges de statut, les composants de provenance et le contrat `SourceAdapter`. Ne crée pas de registre parallèle.
8. Conserve les invariants existants : risque ≠ confiance ; donnée manquante ≠ zéro ; aucune zone appariée ≠ risque faible ; géocodage utilisable uniquement après revue humaine ; méthode géométrique réellement exécutée toujours affichée.
9. Toute donnée externe doit porter au minimum : `source_code`, `release_key`, checksum SHA-256, date de publication si connue, date de récupération, période observée, version de méthode, statut de donnée, licence, attribution, autorisations d’affichage/stockage/usage dérivé et avertissements.
10. Aucun nouveau package sans preuve qu’une dépendance existante ne suffit pas. Toute nouvelle dépendance exige justification, analyse de licence, impact bundle et test.
11. Les tests n’effectuent aucun appel réseau. Ils utilisent des fixtures minimales figées et vérifient les cas d’erreur, les données absentes, l’idempotence, la provenance et les licences.
12. À la fin : exécute les commandes de validation pertinentes, fournis les sorties exactes, la liste des fichiers modifiés, les décisions, les limites, les risques résiduels et les étapes opérateur. Arrête-toi avant merge.


## Mission spécifique

**Branche :** `feat/water-intelligence-p18-route-rationalization`

**Condition préalable :** exécuter uniquement après décision humaine explicite fondée sur les données SEO, analytics et retours utilisateurs de la Preview.

### Objectif

Décider si la canonical publique reste `/water-intelligence`, devient `/eau`, ou reçoit un alias, tout en conservant `/water` pour le cockpit authentifié.

### Tâches

1. Auditer tous les liens, bookmarks, tests, analytics, sitemap et metadata.
2. Comparer trois options :
   - conserver `/water-intelligence` ;
   - canonical `/eau` + redirect depuis `/water-intelligence` ;
   - alias non canonical.
3. Ne jamais déplacer le cockpit `/water` sans un plan de migration distinct et une analyse de rupture.
4. Ajouter redirects permanents seulement après preuve d’absence de collision.
5. Mettre à jour tests, sitemap, canonical et documentation.
6. Vérifier que l’auth guard ne capture pas la route publique.

### Interdictions

- ne pas transformer `/water` en page publique dans cette PR ;
- ne pas casser les liens du cockpit ;
- ne pas créer de redirect conditionnel selon l’utilisateur ;
- ne pas modifier de donnée ou de connecteur.

### Critères d’acceptation

- décision documentée ;
- aucun cycle de redirect ;
- canonical unique ;
- `/water` inchangé ;
- tests de routes et SEO verts.

---

# 6. Gates entre prompts

Avant de lancer le prompt suivant, vérifier :

```text
[ ] PR précédente fusionnée
[ ] master synchronisé
[ ] CI verte
[ ] Preview vérifiée lorsque requise
[ ] aucun défaut critique ouvert
[ ] aucune donnée non sourcée
[ ] aucun dépassement de budget non approuvé
[ ] aucune migration en attente
[ ] aucune licence inconnue pour une donnée publiée
[ ] traçabilité mise à jour
```

## Conditions d’arrêt immédiat

L’agent doit s’arrêter et documenter, plutôt que contourner, si :

- la licence ne permet pas le stockage, l’affichage ou l’usage dérivé ;
- la source officielle a changé de schéma sans fixture et validation ;
- une jointure géographique n’a pas d’identifiant stable ;
- une donnée sensible ne peut pas être désensibilisée proprement ;
- une migration serait nécessaire alors qu’elle n’est pas le périmètre du prompt ;
- la route entrerait en conflit avec `/water` ;
- la CI ou la Preview présente une régression non expliquée ;
- une donnée manque et la seule solution serait de l’inventer ;
- l’agent ne peut pas établir la provenance d’une affirmation juridique ;
- le payload excède le budget sans stratégie de découpage.

---

# 7. Ordre de priorité des sources

## MVP

1. WRI Aqueduct — contexte mondial structurel et scénarios.
2. EEA/WISE/WEI+ — contexte européen par bassin/sous-unité.
3. Hub’Eau hydrométrie/piézométrie — contexte français courant et stations.
4. Hub’Eau prélèvements/qualité — usages et qualité avec périmètre maîtrisé.
5. Copernicus EDO — snapshot de sécheresse courant.
6. SANDRE — identifiants, référentiels et interopérabilité.

## Phase suivante

- SIGES et InfoTerre pour l’hydrogéologie détaillée ;
- SISPEA pour les services eau/assainissement ;
- Géorisques pour certains aléas territoriaux ;
- Sextant/Ifremer pour mer et littoral ;
- USGS pour extension américaine ;
- jeux nationaux supplémentaires selon les clients.

---

# 8. Résultat attendu

À la fin de P17, Carbon&Co doit disposer :

- d’un module public lisible et différenciant ;
- d’un cockpit entreprise préservé ;
- de données multi-échelles versionnées ;
- d’une cartographie progressive ;
- d’un registre de sources et de licences ;
- de contenus juridiques et éditoriaux revus ;
- de passerelles vers matériaux, ressources, IRO et finance ;
- d’une architecture qui peut accueillir de nouvelles sources sans gonfler le bundle ni appeler les portails au runtime ;
- d’un dossier de preuve permettant à un humain de décider du passage en production.
