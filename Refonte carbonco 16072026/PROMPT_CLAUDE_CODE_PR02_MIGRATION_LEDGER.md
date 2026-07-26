# Prompt Claude Code — PR-02 `feat/schema-migration-ledger`

Tu travailles uniquement sur le ledger de migrations du monorepo `finance-platform`.
Ne construis pas encore les tables d’intelligence. Ne committe et ne pousse rien.

## Objectif

Remplacer le contrôle de schéma fondé sur une seule sentinelle par un registre strict, compatible base existante, base vide, local, tests et Vercel serverless.

## Inspection obligatoire

- `apps/api/db/migrations.py`
- `apps/api/db/database.py`
- `apps/api/db/tenant.py`
- tous les fichiers `apps/api/db/migrations/*.sql`
- `apps/api/main.py`
- `apps/api/routers/health.py`
- tests de migrations et santé
- workflows GitHub existants
- configuration Vercel de `apps/api`

## Architecture attendue

1. `schema_migrations(version, checksum, status, applied_at, execution_ms, applied_by, notes)`.
2. Verrou PostgreSQL advisory.
3. Baseline contrôlée du schéma historique jusqu’à 027.
4. Checksum obligatoire pour 028+.
5. Transaction par migration.
6. Arrêt strict sur erreur pour 028+.
7. Support des migrations `manual-owner`.
8. Endpoint `GET /health/schema`.
9. CLI : `python -m db.migration_runner status|plan|apply|verify`.
10. `AUTO_MIGRATE=0` par défaut en production ; comportement local/test documenté.
11. Workflow `.github/workflows/db-migrate.yml` en `workflow_dispatch`, environnement protégé et `DATABASE_ADMIN_URL`.

## Règles de bootstrap

- Ne marque jamais aveuglément toutes les migrations historiques comme appliquées.
- Si la structure historique attendue est confirmée, inscris `baseline-027` avec une note détaillée.
- Si elle ne l’est pas, le statut doit rester incomplet et explicite.
- Le endpoint de santé doit signaler les migrations manuelles et les écarts.
- Utilise un advisory lock pour empêcher deux cold starts de migrer simultanément.
- Une migration appliquée dont le fichier a changé doit provoquer une erreur de checksum.

## Tests obligatoires

- base vide ;
- base existante baseline 027 ;
- checksum modifié ;
- migration échouée ;
- deux runners concurrents ;
- migration `manual-owner` ;
- `AUTO_MIGRATE` off/on ;
- health endpoint.

## Documentation

Créer `docs/carbonco/MIGRATIONS_RUNBOOK.md` avec :

- architecture ;
- bootstrap ;
- commandes ;
- workflow production ;
- rollback ;
- opérations nécessitant le propriétaire Neon ;
- diagnostic en cas de schéma incomplet.

## Commandes

```bash
cd apps/api
python -m pytest -q
cd ../..
git diff --check
```

## Compte rendu final

Résume :

1. architecture ;
2. logique de bootstrap ;
3. fichiers modifiés ;
4. tests ajoutés ;
5. commandes et résultats ;
6. opérations manuelles ;
7. risques restant ouverts.

Puis arrête-toi.
