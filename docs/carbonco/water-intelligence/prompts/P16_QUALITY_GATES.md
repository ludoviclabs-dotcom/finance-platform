# P16 — QA globale : données, sécurité, performance et accessibilité


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

**Branche :** `chore/water-intelligence-p16-quality-gates`

### Objectif

Auditer et renforcer le module complet sans ajouter de fonctionnalité métier.

### Tâches

1. Data quality :
   - parité ;
   - fraîcheur ;
   - licence ;
   - couverture ;
   - valeurs absentes ;
   - unités ;
   - géographies ;
   - dates.
2. Sécurité :
   - aucune donnée tenant publique ;
   - aucune URL arbitraire SSRF ;
   - allowlist des hôtes opérateur ;
   - secrets absents des logs ;
   - CSP inchangée ou modification minimale justifiée ;
   - anti-IDOR.
3. Performance :
   - bundle ;
   - payload gzip ;
   - nombre de requêtes ;
   - cache ;
   - temps de rendu carte ;
   - chargement mobile.
4. Accessibilité :
   - clavier ;
   - lecteur d’écran ;
   - contraste ;
   - table alternative ;
   - reduced motion ;
   - focus.
5. Résilience :
   - source indisponible ;
   - release stale ;
   - couche manquante ;
   - cache froid ;
   - erreur de parsing ;
   - licence révoquée.
6. Ajouter les tests et budgets à la CI existante.
7. Produire un rapport de défauts corrigés et résiduels.

### Interdictions

- aucune refonte visuelle générale ;
- aucune nouvelle source ;
- aucune migration ;
- aucun changement de formule ;
- aucun assouplissement de test pour faire passer la CI.

### Critères d’acceptation

- build/lint/unit/E2E verts ;
- zéro erreur console ;
- budgets contrôlés automatiquement ;
- aucun appel externe pendant les tests ;
- rapport WCAG et sécurité ;
- erreurs explicites, jamais fallback silencieux.
