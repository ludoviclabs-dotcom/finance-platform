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
