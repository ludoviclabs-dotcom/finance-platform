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
