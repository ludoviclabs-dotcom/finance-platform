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
