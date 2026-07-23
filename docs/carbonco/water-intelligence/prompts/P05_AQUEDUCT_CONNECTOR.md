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
