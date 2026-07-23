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
