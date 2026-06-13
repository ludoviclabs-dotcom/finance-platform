# Worker d'ingestion asynchrone (T1.3)

L'ingestion (rebuild des 4 snapshots + émission des facts) peut tourner selon
deux modes, pilotés par la variable d'environnement `WORKER_MODE`.

## Modes

| `WORKER_MODE` | Comportement de `POST /ingest` | Quand l'utiliser |
|---|---|---|
| `inline` (défaut) | Crée un job, l'exécute **synchronement**, renvoie 202 avec `ingestId` + résultats par domaine. Le job est journalisé (`ingest_jobs`). | Vercel (functions sans worker), dev local |
| `worker` | Crée un job, le **défère** à procrastinate, renvoie 202 immédiatement (< 1 s, statut `pending`). Un worker séparé l'exécute. | Quand un hôte worker existe (local long-running, GitHub Actions, VM) |

Dans les deux cas, le client suit l'avancement via `GET /ingests/{id}` :
`{ id, status: pending|processing|done|failed, error }`.

> ⚠️ Sur Vercel (functions éphémères), il n'y a pas de process worker : rester en
> `inline`. La réponse < 1 s n'est atteinte qu'en mode `worker`.

## Lancer le worker

```bash
pip install -r apps/api/requirements-worker.txt   # procrastinate + deps API
export DATABASE_URL_DIRECT="postgres://...neon.../db"   # connexion DIRECTE (LISTEN/NOTIFY)
export WORKER_MODE=worker                                # côté API aussi

# 1) Appliquer le schéma procrastinate (une fois)
python -m procrastinate --app jobs.app schema --apply

# 2a) Worker long-running
python apps/api/worker.py

# 2b) Draine la file puis sort (cron / GitHub Actions)
python apps/api/worker.py --until-empty
```

`DATABASE_URL_DIRECT` est **obligatoire** : LISTEN/NOTIFY ne passe pas par le
pooler Neon (mode transaction). L'API garde `DATABASE_URL` (poolé) pour ses
requêtes courantes.

## Option gratuite sans hôte dédié

`.github/workflows/worker.yml` exécute `worker.py --until-empty` à la demande
(`workflow_dispatch`) ou via cron (commenté) — l'option la plus honnête tant
qu'aucun hôte worker permanent n'existe.

## Critères d'acceptation (rejeu Ludo, Neon requis)

- `POST /ingest` en mode `worker` répond en < 1 s avec `ingestId` ;
- le job aboutit en arrière-plan (`GET /ingests/{id}` → `done`) ;
- un échec produit `status=failed` avec `error` exploitable (testé en inline).
