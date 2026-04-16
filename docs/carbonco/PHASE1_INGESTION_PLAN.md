# Phase 1.B — Spec technique « Couche preuve backend »

> Consommé par [SPRINT_2_CHECKLIST.md](../../SPRINT_2_CHECKLIST.md). Complète [CARBON_SNAPSHOT_SCHEMA_V1.md](CARBON_SNAPSHOT_SCHEMA_V1.md) et [BLOCK_A_DATA_CONTRACT.md](BLOCK_A_DATA_CONTRACT.md).

## 1. Objectifs

Transformer `snapshots` (JSONB opaque, source d'usage) en source **auditable** : chaque KPI numérique affiché au dashboard doit retrouver (a) sa source Excel/ERP, (b) le facteur d'émission appliqué, (c) l'auteur et l'horodatage du calcul, (d) un hash qui prouve qu'il n'a pas été modifié a posteriori.

Trois tables nouvelles :
- `emission_factors` — catalogue ADEME Base Empreinte versionné
- `facts_events` — append-only, une ligne = un calcul d'un KPI à un instant donné
- `facts_current` (vue matérialisée) — dernière valeur par `(company_id, code)`

Deux couvertures nouvelles :
- **RLS Postgres** — isolation stricte multi-tenant via `current_setting('app.current_company_id')`
- **Hash Merkle chaîné** sur `facts_events` et `audit_events`

## 2. Schéma SQL

### 2.1 `emission_factors`

```sql
CREATE TABLE emission_factors (
    id            SERIAL PRIMARY KEY,
    ef_code       TEXT        NOT NULL,          -- ex: ADEME.2025.ELEC.FR
    label         TEXT        NOT NULL,
    scope         SMALLINT,                       -- 1|2|3|NULL (transverse)
    category      TEXT,                           -- energy|transport|waste|...
    factor_kgco2e NUMERIC(14,4) NOT NULL,
    unit          TEXT        NOT NULL,           -- kWh|kg|km|t|m3|€
    source        TEXT        NOT NULL DEFAULT 'ADEME Base Empreinte',
    version       TEXT        NOT NULL,           -- v2025.0
    valid_from    DATE,
    valid_until   DATE,
    raw           JSONB,                          -- ligne ADEME complète
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ef_code, version)
);

CREATE INDEX idx_ef_scope_cat ON emission_factors(scope, category);
CREATE INDEX idx_ef_version   ON emission_factors(version);
```

### 2.2 `facts_events`

```sql
CREATE TABLE facts_events (
    id           BIGSERIAL PRIMARY KEY,
    company_id   INTEGER     NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code         TEXT        NOT NULL,            -- ex: carbon.scope1Tco2e
    value        NUMERIC(20,6),
    unit         TEXT        NOT NULL,
    ef_id        INTEGER     REFERENCES emission_factors(id), -- NULL si pas de facteur (KPI composite)
    source_path  TEXT        NOT NULL,            -- upload:CarbonCo_v2.xlsx!Synthese_GES!C10 | master | manual
    computed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    hash_prev    TEXT,                             -- hex 64 chars, NULL sur le 1er event de la chaîne company
    hash_self    TEXT        NOT NULL,            -- hex 64 chars, calculé par application
    meta         JSONB,                            -- contexte additionnel (user_email, ingest_id, workbook_name)
    UNIQUE (company_id, code, computed_at)
);

CREATE INDEX idx_facts_company_code  ON facts_events(company_id, code);
CREATE INDEX idx_facts_computed_desc ON facts_events(computed_at DESC);
CREATE INDEX idx_facts_ef            ON facts_events(ef_id);
```

### 2.3 `facts_current` (vue matérialisée)

```sql
CREATE MATERIALIZED VIEW facts_current AS
SELECT DISTINCT ON (company_id, code)
    company_id, code, value, unit, ef_id, source_path, computed_at, hash_self
FROM facts_events
ORDER BY company_id, code, computed_at DESC;

CREATE UNIQUE INDEX idx_facts_current_pk ON facts_current(company_id, code);
```

Refresh stratégie : `REFRESH MATERIALIZED VIEW CONCURRENTLY facts_current;` déclenché par l'application après chaque `emit_fact` batch (fin d'ingest). Ne pas mettre de trigger DB pour éviter les verrous.

## 3. Hash Merkle chaîné

### 3.1 Formule

```python
def compute_hash(
    *,
    hash_prev: str | None,
    company_id: int,
    code: str,
    value: float | int | None,
    unit: str,
    ef_id: int | None,
    source_path: str,
    computed_at: datetime,
) -> str:
    """SHA-256 hex lowercase sur tuple ordonné, séparateur '|'."""
    tpl = "|".join([
        hash_prev or "GENESIS",
        str(company_id),
        code,
        "" if value is None else f"{float(value):.6f}",
        unit,
        "" if ef_id is None else str(ef_id),
        source_path,
        computed_at.isoformat(timespec="microseconds"),
    ])
    return hashlib.sha256(tpl.encode("utf-8")).hexdigest()
```

### 3.2 Insertion atomique

```python
def emit_fact(**kwargs) -> FactEvent:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT hash_self FROM facts_events "
                "WHERE company_id=%s ORDER BY computed_at DESC LIMIT 1 "
                "FOR UPDATE",
                (kwargs["company_id"],),
            )
            row = cur.fetchone()
            hash_prev = row["hash_self"] if row else None
            hash_self = compute_hash(hash_prev=hash_prev, **kwargs)
            cur.execute(
                "INSERT INTO facts_events (...) VALUES (...) RETURNING *",
                ...,
            )
    return FactEvent(...)
```

Le `FOR UPDATE` empêche la race condition deux-inserts-simultanés-avec-même-hash_prev. Sous charge (>100 inserts/sec), passer à un `advisory lock` par `(company_id)` hashé.

### 3.3 Vérification

```python
def verify_chain(company_id: int) -> ChainVerification:
    """Retourne (ok, broken_at_id) en O(N)."""
    prev = None
    with get_db() as conn:
        with conn.cursor("named_cursor_verify") as cur:  # server-side cursor
            cur.execute(
                "SELECT * FROM facts_events WHERE company_id=%s "
                "ORDER BY computed_at ASC, id ASC",
                (company_id,),
            )
            for row in cur:
                recomputed = compute_hash(
                    hash_prev=prev,
                    company_id=row["company_id"],
                    code=row["code"],
                    value=row["value"],
                    unit=row["unit"],
                    ef_id=row["ef_id"],
                    source_path=row["source_path"],
                    computed_at=row["computed_at"],
                )
                if row["hash_self"] != recomputed:
                    return ChainVerification(ok=False, broken_at=row["id"])
                prev = row["hash_self"]
    return ChainVerification(ok=True, broken_at=None)
```

## 4. RLS Postgres

### 4.1 Policies

```sql
-- S'applique à snapshots, facts_events, audit_events, alert_rules, products
CREATE POLICY tenant_isolation ON facts_events
  USING (company_id = current_setting('app.current_company_id', true)::int);
CREATE POLICY tenant_isolation_insert ON facts_events
  FOR INSERT WITH CHECK (company_id = current_setting('app.current_company_id', true)::int);

ALTER TABLE facts_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts_events FORCE  ROW LEVEL SECURITY;  -- même pour owner
```

### 4.2 Session setter

Dans `apps/api/db/database.py`, modifier `get_db()` :

```python
@contextmanager
def get_db(company_id: int | None = None):
    conn = pool.getconn()
    try:
        conn.autocommit = False
        with conn.cursor() as cur:
            cur.execute(
                "SET LOCAL app.current_company_id = %s;",
                (str(company_id or 0),),
            )
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)
```

Propager `company_id` depuis les routeurs FastAPI via `Depends(get_company_id)` (déjà présent).

### 4.3 Test isolation

```python
def test_rls_isolation(client, company_a_token, company_b_token, seeded_facts):
    ra = client.get("/facts/carbon.scope1Tco2e/trail",
                    headers={"Authorization": f"Bearer {company_a_token}"})
    rb = client.get("/facts/carbon.scope1Tco2e/trail",
                    headers={"Authorization": f"Bearer {company_b_token}"})
    assert ra.json() != rb.json()
    assert all(ev["company_id"] == 1 for ev in ra.json()["events"])
    assert all(ev["company_id"] == 2 for ev in rb.json()["events"])
```

## 5. Endpoints

| Méthode | Path | Auth | Rôle | Description |
|---------|------|------|------|-------------|
| `GET` | `/factors?scope=&category=&version=` | optional | viewer | Liste paginée |
| `GET` | `/factors/{ef_code}?version=` | optional | viewer | Détail |
| `GET` | `/facts?code=` | required | viewer | Latest par code (depuis facts_current) |
| `GET` | `/facts/{code}/trail?limit=50&offset=0` | required | viewer | Historique |
| `GET` | `/facts/verify` | required | analyst | Exécute verify_chain, retourne {ok, broken_at} |
| `POST` | `/facts/replay` | required | admin | Recalcule facts_current (refresh view) |

## 6. Migration hash `audit_events`

```sql
ALTER TABLE audit_events ADD COLUMN hash_prev TEXT;
ALTER TABLE audit_events ADD COLUMN hash_self TEXT;
```

Script `apps/api/scripts/migrate_audit_hash.py` :
1. `SELECT * FROM audit_events ORDER BY created_at ASC, id ASC`
2. Pour chaque row : `hash_self = sha256(prev|company_id|event_type|title|detail|status|meta|created_at)`
3. Update row
4. `hash_prev = hash_self` pour le suivant

À lancer une fois en prod, idempotent (skip si `hash_self IS NOT NULL`).

## 7. Changes côté services métier

### `carbon_service.py`

Nouveau mapping :
```python
SNAPSHOT_FIELD_TO_FACT_CODE = {
    "carbon.scope1Tco2e": ("CC.GES.SCOPE1", "tCO2e", None),  # ef_id None car composite
    "carbon.scope2LbTco2e": ("CC.GES.SCOPE2_LB", "tCO2e", None),
    # ... etc
}
```

À la fin de `_build_snapshot_from_workbooks`, itérer sur `SNAPSHOT_FIELD_TO_FACT_CODE` et appeler `facts_service.emit_fact()` avec :
- `code` du mapping
- `value` depuis snapshot_data
- `source_path` construit depuis `source_label` + feuille + cellule
- `company_id` reçu en param (nouvelle signature du core)

### `esg_service.py`, `finance_service.py`

Seuls les KPIs numériques non-textuels émettent des facts (`scoreGlobal`, `greenCapexPct`, etc.). Les listes qualitatives (issues de matérialité, Q&R VSME) n'en ont pas besoin.

## 8. Critères DoD

- [ ] `SELECT COUNT(*) FROM emission_factors WHERE version='v2025.0';` ≥ 500
- [ ] `SELECT COUNT(*) FROM facts_events;` > 0 après un ingest complet
- [ ] `pytest tests/test_facts_hash.py` vert sur fixture 100 events
- [ ] Test isolation RLS : user_A ne voit pas facts company_B
- [ ] `/facts/carbon.scope1Tco2e/trail` < 500ms p95
- [ ] `verify_chain(company_id=1)` retourne `{ok: true}`
- [ ] Tests E2E Phase 0 et 1.A toujours verts (non-régression)

## 9. Points d'attention

- **Performance écriture** : 30 facts × N domaines × ingest → bulk insert avec `COPY` ou `executemany`, pas un INSERT par fact
- **Refresh view** : `CONCURRENTLY` requiert l'index unique — sinon refresh bloquant
- **Hash précision float** : formatter `value` en `.6f` pour éviter les divergences de hash dues à IEEE 754
- **Backfill** : les snapshots existants (pre-Phase 1.B) n'auront pas de facts rétroactifs — documenter que la provenance démarre à la date de déploiement
- **Index BRIN** possible sur `computed_at` si la table grossit vite, mais pas prioritaire avant 1M rows
