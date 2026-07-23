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
