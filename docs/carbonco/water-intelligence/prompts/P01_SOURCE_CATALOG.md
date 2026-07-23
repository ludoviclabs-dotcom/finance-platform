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
