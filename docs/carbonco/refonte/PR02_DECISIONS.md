# PR-02 — Décisions nécessitant une validation humaine

Ce document ne contient **que** des décisions qui doivent être tranchées par Ludo avant d'écrire du code. Toute question déjà résolue sans ambiguïté par les documents de cadrage ou par l'inspection du code est traitée directement dans `PR02_ARCHITECTURE_PLAN.md`, pas ici.

**Portée** : aucune de ces décisions ne bloque **PR-02A** (découverte/modèle/checksum/planificateur, lecture seule, aucune base réelle touchée). **D-3 est résolue** (2026-07-17, vérifiée en lecture seule sur Neon production). **D-1, D-2, D-4, D-5 ont reçu une résolution scopée PR-02B de Ludo (2026-07-17)** — suffisante pour démarrer PR-02B (aucune migration/baseline de production dans cette étape), mais **pas une résolution définitive** : D-1 (isolation preview réelle, `vercel env ls`) et D-4 (provisionnement du secret `DATABASE_ADMIN_URL` côté GitHub Actions) restent à confirmer/exécuter avant PR-02C. Détail de chaque résolution dans sa section ci-dessous.

---

## D-1 — Isolation des bases preview Vercel

**Résolution scopée PR-02B (2026-07-17)** : Ludo tranche que PR-02B ne dépend pas de la réponse — tests et baseline sont limités à local/CI/staging, la vraie baseline de production reste reportée à PR-02C. Aucun indice direct (`vercel env ls`) n'a été obtenu ; seul un indice circonstanciel existe (`SETUP_PROGRESS.md:148` — `AUTH_JWT_SECRET` posé Production-only, ce qui suggère implicitement que le reste, dont probablement `DATABASE_URL`, est partagé Prod+Preview). **À vérifier explicitement avant PR-02C**, pas avant.

**Question** : les déploiements preview (branches PR) pointent-ils vers une base Neon partagée avec la production, ou vers une branche Neon isolée (feature Neon « branching ») ?

**Pourquoi ça compte** : détermine si `AUTO_MIGRATE=1` peut être activé sans risque en preview (base isolée → oui, migrations jetables) ou doit rester `0` comme en production (base partagée → un preview ne doit jamais migrer un schéma partagé).

**Options** :
1. Bases preview isolées (branche Neon dédiée par PR) → `AUTO_MIGRATE=1` sûr en preview.
2. Base partagée avec la production → `AUTO_MIGRATE=0` en preview, identique à la production.

**Avantages / Risques** : l'option 1 permet de tester le rollout complet du runner sur chaque PR sans risque ; si en réalité la config actuelle correspond à l'option 2 et qu'on suppose à tort l'option 1, une preview pourrait migrer un schéma partagé avec la prod de façon non désirée.

**Recommandation** : vérifier la configuration Neon actuelle (dashboard Neon, ou `vercel env ls` pour voir si `DATABASE_URL` diffère entre preview et production) avant de coder le comportement preview — ne pas le deviner.

---

## D-2 — Détection de l'environnement production pour les confirmations CLI

**Résolution PR-02B (2026-07-17)** : `VERCEL_ENV` — signal déjà existant dans le code, pas `APP_ENV` (qui n'existe nulle part dans le repo). Preuve directe trouvée : `apps/api/routers/auth.py::_is_prod()` implémente déjà exactement ce pattern (fail-secure : `VERCEL_ENV != "development"` ⟹ prod, y compris preview ; repli sur la variable locale `ENV` hors Vercel). Ludo valide la réutilisation de cette logique existante plutôt qu'une invention, avec extraction vers un helper minimal (`utils/env.py`) uniquement si utile — pas de refonte globale.

**Question** : quelle variable exacte fait foi pour que le CLI applique la confirmation renforcée avant `apply`/`baseline --commit` en production (`APP_ENV`, `VERCEL_ENV`, autre) ?

**Pourquoi ça compte** : une détection incorrecte pourrait soit demander une confirmation inutile en local/test (friction), soit — pire — ne PAS la demander en production (risque réel).

**Options** :
1. `VERCEL_ENV == "production"` (variable native Vercel, déjà présente à l'exécution sur la plateforme).
2. Une variable applicative dédiée déjà utilisée ailleurs dans le repo (aucune trouvée lors de l'inspection — à confirmer qu'il n'en existe vraiment aucune).
3. Détection combinée : présence de `DATABASE_ADMIN_URL` (D-4) **et** absence d'indicateur local/test.

**Recommandation** : combiner `VERCEL_ENV` (quand disponible, sur les déploiements) avec un flag explicite passé par le workflow GitHub (`db-migrate.yml`) plutôt que de deviner depuis l'intérieur du process Python — le workflow, qui sait déjà dans quel environnement protégé il s'exécute, peut passer `--yes` explicitement après l'approbation humaine de l'environnement GitHub.

---

## D-3 — État réel des migrations 004 et 009 en production ✅ RÉSOLUE (2026-07-17)

**Vérifié par Ludo en lecture seule sur Neon production** (`console.neon.tech`, projet `super-hill-23861127`, branche `main`, base `neondb`) :

```sql
SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('snapshots','facts_events','audit_events','alert_rules','products');
-- → 12 lignes. Confirmées : alert_rules (3 : _insert, _ins, _upd — cohérent avec la contribution
--   additionnelle de la migration 021 sur cette table), snapshots (2), facts_events (2),
--   audit_events (2), le solde revenant à products — non affiché explicitement mais couvert
--   sans ambiguïté par le résultat de la 2ᵉ requête ci-dessous.

SELECT relname, relforcerowsecurity FROM pg_class WHERE relname IN ('snapshots','facts_events','audit_events','alert_rules','products');
-- → 5/5 lignes avec relforcerowsecurity = true (snapshots, audit_events, products, facts_events, alert_rules).
```

**Conclusion** : `relforcerowsecurity = true` sur les 5 tables est la preuve décisive — **seule la migration 009 pose ce flag** (`ALTER TABLE ... FORCE ROW LEVEL SECURITY`) ; 004 ne fait qu'`ENABLE`. **La migration 009 a donc été exécutée en production**, malgré son exclusion du chemin automatique (`RLS_FORCE` gate) — appliquée manuellement, comme 027. Puisque 009 exécute `DROP POLICY IF EXISTS` puis recrée les mêmes noms de policies dans leur version *bypass-aware* (`app.rls_bypass`) avant de poser `FORCE`, le fait que `FORCE` soit actif prouve que l'intégralité du fichier 009 a tourné avec succès — les policies actuellement en place sont donc la version 009, pas la version 004 d'origine (004 est fonctionnellement absorbée/supersédée par 009 dans l'état réel de prod).

**Décision retenue** : dans `baseline()` (PR-02B), marquer **004 et 009 toutes deux `baseline`**, `requires_owner=false` (aucune des 5 tables n'a de mur de privilège — contrairement à 027/`actions`). La procédure de vérification objet-par-objet doit sonder `pg_class.relforcerowsecurity = true` (pas seulement l'existence de policies) pour ces deux versions spécifiquement — exactement le test qui vient d'être exécuté manuellement.

---

## D-4 — Variable dédiée pour les opérations privilégiées (`DATABASE_ADMIN_URL`)

**Résolution scopée PR-02B (2026-07-17)** : `DATABASE_ADMIN_URL` n'est **pas** rendue obligatoire en PR-02B — documentée dans `.env.example` comme réservée à PR-02C (workflow protégé), mais PR-02B utilise `DATABASE_URL`/`DATABASE_URL_DIRECT` selon les patterns existants pour ses tests et son CLI hors production. Le choix de nom (option 1, variable dédiée) reste la recommandation pour PR-02C ; le provisionnement réel du secret GitHub Actions et la confirmation du rôle Neon restent des actions de Ludo, non exécutées ici.

**Question** : introduire une nouvelle variable d'environnement `DATABASE_ADMIN_URL` (nom déjà utilisé dans `PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md`) dédiée au runner de migrations, ou réutiliser `DATABASE_URL_DIRECT` (déjà présente, mais sémantiquement liée au worker LISTEN/NOTIFY aujourd'hui) ?

**Pourquoi ça compte** : le runner de migrations a besoin d'une connexion **non poolée** (PgBouncer en mode transaction casse les `SET LOCAL`/advisory locks de session, comme déjà documenté dans le commentaire de `009_rls_force.sql`) et, pour les migrations `requires_owner`, potentiellement d'un rôle différent du rôle applicatif standard.

**Options** :
1. Nouvelle variable `DATABASE_ADMIN_URL`, secret GitHub Actions dédié, jamais exposée à l'application FastAPI elle-même (seulement au CLI/workflow).
2. Réutiliser `DATABASE_URL_DIRECT`, déjà provisionnée pour le worker.

**Avantages / Risques** : l'option 1 isole clairement le blast radius (un secret compromis pour les migrations n'expose pas le worker, et vice-versa) et correspond à ce que le document de planification prévoyait déjà. L'option 2 évite un nouveau secret à provisionner mais mélange deux responsabilités (worker vs migrations) sous la même variable, et le rôle Neon associé à `DATABASE_URL_DIRECT` aujourd'hui n'a peut-être pas les mêmes privilèges que ce qu'exigerait une migration `requires_owner`.

**Recommandation** : option 1 (nouvelle variable dédiée), mais nécessite que Ludo provisionne le secret côté GitHub Actions et confirme quel rôle Neon (`carbonco_app` ou un rôle intermédiaire) elle doit utiliser pour les migrations non-`requires_owner` — les migrations `requires_owner` restant de toute façon hors du chemin automatique (Neon SQL Editor ou action manuelle équivalente).

---

## D-5 — Endpoint HTTP de diagnostic détaillé

**Résolution PR-02B (2026-07-17)** : option 1 confirmée par Ludo — `GET /health/schema` reste minimal et non sensible (aucun secret, aucun SQL, aucun détail par version), le diagnostic détaillé reste exclusivement `python -m db.migration_cli status --json`. Pas de `/admin/schema` en PR-02B.

**Question** : au-delà de `GET /health/schema` (minimal, public), faut-il un endpoint HTTP authentifié (`/admin/schema` ou similaire) exposant le détail des migrations `pending`/`manual_required`/`failed`, ou le CLI (`migration_cli status --json`) suffit-il ?

**Pourquoi ça compte** : un endpoint supplémentaire est une surface d'attaque et de maintenance de plus ; à l'inverse, un accès HTTP authentifié pourrait être commode pour un futur tableau de bord opérationnel sans avoir besoin d'un accès shell/CI.

**Options** :
1. CLI uniquement (recommandé par défaut) — zéro nouvelle surface HTTP au-delà du endpoint public minimal.
2. Endpoint authentifié réutilisant le système de rôles déjà présent (`admin` router visible dans `main.py`) — cohérent avec l'existant si un tableau de bord admin est prévu à terme.

**Recommandation** : commencer par l'option 1 (CLI uniquement) pour PR-02 ; si un besoin de tableau de bord émerge (probablement en lien avec PR-03 Evidence Kernel qui prévoit déjà une UI interne « Sources »), réévaluer à ce moment-là plutôt que d'anticiper une UI qui n'existe pas encore.

---

## Note — drift déjà résolu, sans besoin de validation

Le document `PROMPT_CLAUDE_CODE_PR02_MIGRATION_LEDGER.md` (préexistant dans le repo) nommait le module CLI `python -m db.migration_runner status|plan|apply|verify`. Les instructions actuelles de ce chantier spécifient `python -m db.migration_cli status|plan|apply|verify|baseline|mark-applied` — un module dédié au CLI, distinct de `migration_runner.py` (qui porte la classe `MigrationRunner`), avec deux commandes supplémentaires (`baseline`, `mark-applied`). Traité comme une clarification, pas une divergence à trancher : les instructions les plus récentes et les plus détaillées font foi, adoptées telles quelles dans `PR02_ARCHITECTURE_PLAN.md` §13-14.

## Note — `apply` volontairement absent de PR-02B

`PR02_ARCHITECTURE_PLAN.md` §21 plaçait à l'origine `apply_one`/`apply_plan` dans le périmètre PR-02B. Ludo a explicitement tranché (2026-07-17) que PR-02B livre `status`/`plan`/`verify`/`baseline`/`mark-manual-verified` **sans** `apply` — rien à appliquer aujourd'hui (`baseline` couvre les 28 fichiers existants), et l'exécution SQL réelle est la pièce la plus risquée du runner, cohérente avec la logique de risque croissant déjà appliquée au découpage A/B/C. `apply_one`/`apply_plan`/CLI `apply`/`AUTO_MIGRATE` sont désormais explicitement reportés à PR-02C, aux côtés du workflow protégé qui les rendra utilisables en toute sécurité.
