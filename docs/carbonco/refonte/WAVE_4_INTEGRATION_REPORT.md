# Wave 4 — Rapport d'intégration (PR-08, PR-09, PR-10)

**But :** consigner, en un seul endroit vérifiable, l'état final de la Vague 4 de CarbonCo Intelligence (géospatial/eau, biodiversité/TNFD LEAP, IRO/double matérialité) après fusion et application des migrations en production. Toute affirmation ci-dessous a été **vérifiée en direct** (`git`, `gh`, workflow DB Migrate, `/health`, `/health/schema`) — pas déduite d'un plan.

**Date de rédaction :** 2026-07-21 (~00:10 UTC).
**Base :** `origin/master` = `b4d8c2f` (merge PR-10). Migrations `001`→`040` appliquées en production.

---

## 1. Vue d'ensemble des trois PR

| PR | Titre | #  | Branche | Merge commit | Fusionnée (UTC) | Migrations |
|----|-------|----|---------|--------------|-----------------|------------|
| PR-08 | Géospatial, ledger eau et screening hydrique auditable | [#114](https://github.com/ludoviclabs-dotcom/finance-platform/pull/114) | `feat/geospatial-sites-water` | `09d3358` | 2026-07-20 14:09:22 | **036**, **037** |
| PR-09 | Biodiversité, TNFD LEAP et risques nature auditables | [#115](https://github.com/ludoviclabs-dotcom/finance-platform/pull/115) | `feat/nature-leap` | `404476b` | 2026-07-20 19:10:10 | **038**, **039** |
| PR-10 | IRO, double matérialité et transmission financière | [#116](https://github.com/ludoviclabs-dotcom/finance-platform/pull/116) | `feat/iro-intelligence-links` | `b4d8c2f` | 2026-07-20 21:05:57 | **040** |

**Note de numérotation :** les plans Wave 4 réservaient `036`/`037`/`038` pour PR-08/09/10. L'ordre réel de fusion a consommé deux fichiers par PR pour PR-08 et PR-09 → PR-10 a pris `040` (renumérotation documentée en tête de `040_iro_double_materiality.sql`, exactement le scénario que `WAVE_4_INTERFACE_CONTRACTS.md` §13 anticipait : « le numéro réel est attribué au moment du merge »).

---

## 2. Migrations (fichiers réels sur master)

| Version | Fichier | `requires_owner` | Contenu |
|---------|---------|------------------|---------|
| 036 | `036_geospatial_sites_water.sql` | **`True`** | Extension géospatiale de `sites` (027) par `ALTER` + `site_geocode_candidates` + fondation ledger eau (tranche A). `requires_owner=true` car `sites` a été appliquée manuellement en prod (propriété `neondb_owner`). |
| 037 | `037_water_screening_actions.sql` | `False` | `site_water_screenings` (snapshot immuable), `water_targets`, `water_actions` — tables neuves. |
| 038 | `038_nature_leap_foundation.sql` | `False` | Fondation biodiversité Locate & Evaluate — tables neuves. |
| 039 | `039_nature_assess_prepare.sql` | `False` | `nature_risks`, `nature_opportunities`, `nature_actions`, `tnfd_disclosure_drafts` — tables neuves. |
| 040 | `040_iro_double_materiality.sql` | `False` | `iros`, `impact_assessments`, `financial_assessments`, `materiality_decisions`, `iro_actions`, `disclosure_mappings` — tables neuves + élargissement `audit_eventtype_check` (DROP+ADD, précédent 011/012). |

Seule `036` a nécessité le rôle propriétaire (`ALTER TABLE sites`). Les quatre autres ne créent que des tables neuves (`requires_owner=false`, geste 028/030/031/034/037).

---

## 3. Preuves DB Migrate (workflow protégé `production-db`, approbation humaine)

Le workflow `.github/workflows/db-migrate.yml` est le **seul** chemin d'écriture du schéma de prod (jamais un cold start applicatif). Chaque commande passe par l'environnement GitHub protégé `production-db` (approbation humaine requise).

| Commande | Run | Statut | Résultat |
|----------|-----|--------|----------|
| `plan` | [`29778936857`](https://github.com/ludoviclabs-dotcom/finance-platform/actions/runs/29778936857) | ✅ success (2026-07-20 23:12Z) | Plan complet sur `b4d8c2f`, `has_blocking_issues:false`. |
| `apply` | [`29787270897`](https://github.com/ludoviclabs-dotcom/finance-platform/actions/runs/29787270897) | ✅ success (2026-07-21 00:02Z) | `applied_count: 1`, `applied: [{version: "040"}]`. Les migrations 036-039 avaient déjà été appliquées lors de la finalisation de PR-08/PR-09. |
| `verify` | [`29789474959`](https://github.com/ludoviclabs-dotcom/finance-platform/actions/runs/29789474959) | ✅ success (2026-07-21 00:11Z) | `{"anomalies": []}` — aucune dérive objet-par-objet sur l'ensemble des versions (sondes `_probe_001`…`_probe_040`). |

> **Note :** l'état final `up_to_date=true, pending_count=0, manual_required_count=0` (§4) confirme déjà, au niveau du ledger, que toutes les versions 001-040 sont `applied`/`baseline` (aucune `pending`, `failed` ni `manual_required`). Le run `verify` ajoute la vérification objet-par-objet des sondes (`_probe_036`…`_probe_040`) — les mêmes sondes ayant déjà tourné en CI `migration-tests` avant chaque merge.

---

## 4. État final `/health` et `/health/schema` (vérifié en direct, 2026-07-21 00:02Z)

`GET /health/schema` :
```json
{"schema_version":"040","up_to_date":true,"pending_count":0,"manual_required_count":0}
```

`GET /health` :
```json
{"status":"ok","db":"ok","storage":"ok","worker":"worker","version":"404476bd9810"}
```

| Critère exigé | Valeur | OK |
|---------------|--------|----|
| `schema_version` | `040` | ✅ |
| `up_to_date` | `true` | ✅ |
| `pending_count` | `0` | ✅ |
| `manual_required_count` | `0` | ✅ |
| `db` | `ok` | ✅ |
| `storage` | `ok` | ✅ |

**Précision importante (§7) :** le champ `version` de `/health` est encore `404476bd9810` (code de PR-09), alors que `schema_version` est `040`. Ce n'est pas une incohérence : `schema_version` est lu depuis le **ledger de la base** (déjà à 040 après l'apply), tandis que `version` reflète le **bundle applicatif déployé** — le déploiement Vercel prod de `b4d8c2f` n'est pas encore passé (§7).

---

## 5. Décisions géospatiales (PR-08)

- **Extension de `sites` (027) par `ALTER`, pas de table géographique parallèle** — une donnée d'eau/biodiversité est un attribut d'un lieu ; précédent `supplier_sites` (030) qui porte déjà lat/lon sur la ligne du site. Colonnes ajoutées nullables (aucun backfill).
- **Pas de PostGIS.** La question du privilège `CREATE EXTENSION postgis` (probablement `neon_superuser`, jamais accordé à `carbonco_app`) a été laissée ouverte dans les contrats et **non tranchée par hypothèse**. L'implémentation utilise un **pré-filtre boîte-englobante + point-dans-polygone GeoJSON exact** (`geojson_point_in_polygon_v1`), jamais présenté comme `ST_Intersects`. `latitude`/`longitude` `NUMERIC` restent la source de vérité des points.
- **Revue humaine du géocodage obligatoire.** Toute coordonnée (adaptateur automatisé **ou saisie manuelle**) entre en candidat et n'est utilisable qu'après passage à `accepted` par un `require_analyst`. Vocabulaire `pending | accepted | flagged`, aligné sur `supplier_sites.geocode_review_status` (030) — pas un quatrième vocabulaire inventé.
- **Risque séparé de la confiance.** La péremption/imprécision d'une donnée dégrade la **confiance**, jamais le **risque** (précédent CRMA 034 : deux colonnes à `CHECK` indépendants). Aucun fallback silencieux : toute approximation de méthode est nommée dans `meta.method.code`.

---

## 6. Sécurité / RLS

- **Toutes les tables neuves de la Vague 4** (037-040 + compagnons de 036) : RLS **génération 2** — `ENABLE` + `FORCE ROW LEVEL SECURITY`, policies scopées **par commande** (SELECT/INSERT/UPDATE/DELETE), `DROP POLICY IF EXISTS` avant chaque `CREATE` (rejouable), garde `current_setting('app.rls_bypass')` + `NULLIF(current_setting('app.current_company_id'))::bigint`.
- **Portée :** tenant strict (`company_id BIGINT NOT NULL`) pour les données propres à un tenant (`site_water_screenings`, `iros` et les cinq tables IRO…) ; motif dual global/tenant (`company_id NULL` lisible par tous) pour les référentiels partagés (bassins, aires protégées), comme `material_groups` (034).
- **Défense en profondeur applicative obligatoire :** le PostgreSQL de CI se connecte en superuser (bypasse la RLS, `FORCE` compris) — chaque requête de service porte en plus son prédicat `company_id = %s` explicite. La RLS reste la garantie primaire en prod sous `carbonco_app`.
- **IRO — garanties structurelles (audit indépendant du `.sql` mergé) :** deux tables d'évaluation séparées, aucune colonne combinant matérialité d'impact et financière ; `scale`/`scope`/`irremediability`/`likelihood` (impact) et `likelihood`/`magnitude` (financier) + `confidence` = colonnes distinctes ; `threshold_crossed` booléen indicatif, jamais décisionnel ; décision `materiality_decisions` **humaine obligatoire** (`decided_by NOT NULL`, `justification NOT NULL` + `CHECK` non-vide) ; **append-only** par trigger `materiality_decisions_guard` (BEFORE UPDATE OR DELETE → RAISE EXCEPTION) + `supersedes_id` ; aucune table `iro_evidence_links` (réutilisation de `claim_link_service`) ; `audit_eventtype_check` élargie pour `materiality_decision`.
- **Écarts RLS pré-existants signalés, NON corrigés dans cette vague (documenté) :** `sites` (027) reste gen-1 (sans `FORCE`) ; `materialite_assessments`/`materialite_positions` (025) restent gen-1. Le retrofit vers gen-2 est un **candidat de durcissement séparé**, hors périmètre Wave 4.

---

## 7. Limites et points ouverts

1. **Déploiement Vercel prod de `b4d8c2f` en attente (bloquant fonctionnel côté API, PAS côté schéma).** `carbonco-api` sert encore le bundle de PR-09 (`/health` `version:404476b`), à cause d'un **rate-limit de build au niveau du compte Vercel** (`upgradeToPro=build-rate-limit`, déjà identifié). Conséquence : les endpoints `/iro/*` et le frontend IRO **ne sont pas encore servis en prod** ; ils le seront dès que le déploiement passera. Le schéma (040), `db=ok`, `storage=ok` sont **déjà** satisfaits car ils lisent le ledger / le runtime, pas le bundle. **Action côté Ludo :** attendre la fenêtre de reset du rate-limit ou passer le compte en Pro, puis vérifier que `/health` `version` reflète `b4d8c2f`.
2. **Pas de PostgreSQL local (ni Docker sur le poste Windows).** Tout le code DB-gated de la Vague 4 n'a été prouvé que par la CI `migration-tests` (contrainte méthodologique établie sur tout le chantier depuis PR-02A). Prévoir de facto un aller-retour CI à chaque écriture Postgres.
3. **PostGIS volontairement non adopté** (§5) — les opérations géospatiales reposent sur l'approximation boîte-englobante + point-dans-polygone, nommée explicitement dans les codes de méthode. L'adoption de PostGIS reste conditionnée à la confirmation du privilège `CREATE EXTENSION`.

---

## 8. Reporté à PR-11 (dernière PR du plan — NE PAS démarrer sans « go » explicite)

- **Couche de revue IA** (PR-11 = « IA review ») : suggestions IA (au plus un IRO candidat à revoir) avec **revue humaine obligatoire et preuve** — volet IA de la gate Phase 9 du plan d'architecture (§20). Aucun LLM décisionnaire n'est introduit avant cette PR.
- **Retrofit RLS gen-1 → gen-2** des tables historiques `sites` (027) et `materialite_assessments`/`materialite_positions` (025) — candidat de durcissement séparé (§6).
- **Points d'appel domaine → IRO candidat** (screening eau / évaluation nature / événement CRMA → `iro_service.create_candidate`) : additifs, un signal crée au plus un IRO `candidate`, jamais une décision automatique. À compléter/vérifier hors périmètre bloquant.
- **Extension de `supplier_sites`** au même niveau de provenance que `sites` (géométrie, candidats de géocodage) — extension naturelle, explicitement hors périmètre PR-08.
- **Adoption de PostGIS** si/quand le privilège `CREATE EXTENSION postgis` est confirmé sur la base réelle.

---

## 9. Conclusion

La Vague 4 (PR-08, PR-09, PR-10) est **fusionnée sur master et appliquée en production au niveau du schéma** : `schema_version=040`, `up_to_date=true`, `pending_count=0`, `manual_required_count=0`, `db=ok`, `storage=ok`. Le seul reliquat est **opérationnel et non-schéma** : le déploiement du bundle applicatif PR-10 sur Vercel, bloqué par un rate-limit de compte (§7.1), à débloquer côté Ludo. Le chantier Intelligence est prêt pour sa dernière phase, **PR-11 (revue IA)** — non démarrée.
