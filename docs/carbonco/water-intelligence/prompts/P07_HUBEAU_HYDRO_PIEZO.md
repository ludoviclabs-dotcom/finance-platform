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
