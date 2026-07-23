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
