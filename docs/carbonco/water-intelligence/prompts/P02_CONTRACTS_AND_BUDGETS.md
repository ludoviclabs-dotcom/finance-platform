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
