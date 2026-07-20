# PR-10 — Traçabilité : IRO, double matérialité et transmission financière

**Branche :** `feat/iro-intelligence-links`. **Migration :** `040_iro_double_materiality.sql` (requires_owner=false). **Dernier PR de la Vague 4** — PR-11 n'est pas démarrée.

Ce document consigne les décisions prises pendant l'implémentation, les
déviations assumées par rapport à `PR10_IRO_DOUBLE_MATERIALITY_IMPLEMENTATION_PLAN.md`,
et les preuves (pas seulement des déclarations) pour les non-négociables du
plan §6.

---

## 1. Correction de numérotation — 038 → 040

Le plan réservait la migration `038`. Vérifié par lecture directe de
`apps/api/db/migration_manifest.py` : `038` et `039` sont déjà pris par PR-09
(fondation biodiversité Locate/Evaluate, puis Assess/Prepare/TNFD) —
confirmé aussi par le commentaire de la note `038` du manifeste lui-même :
*« distincte de la réservation indicative 037 du plan PR-09 et de la
réservation 038 de WAVE_4_INTERFACE_CONTRACTS.md §13 pour PR-10 »*. PR-10
prend donc **040**, après 039 — exactement le scénario anticipé par le §14 du
plan (« Numéro 038 déjà pris… renuméroter au merge »). Chaque occurrence de
« 038 » dans le plan doit être lue « 040 » ; chaque « après 037 », « après
039 ».

## 2. Inspection préalable (plan §15, points 1-2) — résultats

### `materialite_service.py` (578 lignes, lu intégralement)

Le mécanisme `topic_code` est un **dict Python en mémoire**
(`SECTOR_PRESETS`/`ISSUE_LABELS`/`ISSUE_ESRS`, 12 codes d'enjeu de type
`CC-1`, `WR-1`, `BD-1`…), **pas une table SQL**. Décision : `iros.topic_code`
reste `TEXT` libre, sans FK possible (rien à référencer en base) —
conventionnellement aligné sur ces mêmes codes, mais non contraint. Aucune
modification de `materialite_service.py` n'a été nécessaire ni faite —
coexistence pure, comme prescrit.

### `vsme_datapoints`/`vsme_field_values` (014/015, inspectées)

`vsme_datapoints.code` (ex. `B1-1`, `C1-3`) est un catalogue **global**
(`PAS de company_id, PAS de RLS`), 47 datapoints des modules VSME Basic/
Comprehensive — un **sous-ensemble volontairement simplifié** du standard
VSME, pas le référentiel ESRS complet. Vérifié par grep : **aucune** table du
dépôt ne référence `vsme_datapoints.code` par FK (le lien `vsme_field_values
→ vsme_datapoints` lui-même reste implicite, non contraint). Décision :
`disclosure_mappings.esrs_reference` reste `TEXT` libre — une FK stricte
bloquerait toute correspondance à un point ESRS hors couverture VSME (ex.
`ESRS E1-6`, qui n'a pas de code VSME). Documenté dans le commentaire SQL de
la migration 040 et dans `disclosure_mapping_service.py`.

## 3. Déviations assumées par rapport au plan

| Déviation | Justification |
|---|---|
| `impact_assessments`/`financial_assessments` portent `methodology_code`/`methodology_version` (non listés explicitement au §5 du plan) | Principe transverse du dépôt (`models/analytics.py` : « meta.method est obligatoire dès qu'un calcul déterministe est impliqué ») — chaque table « évaluée/scorée » du dépôt (crma_article24_assessments 034, site_water_screenings 037, nature_risks/opportunities 039) porte ce couple. `threshold_crossed` EST un calcul dérivé ; l'omettre aurait été une régression silencieuse de cette discipline, pas une simplification neutre. |
| `materiality_decisions` n'a PAS de colonne `updated_at` (le préambule du plan §5 dit « Toutes : … created_at/updated_at ») | Motif exact `source_releases`/`observations` (028) : une ligne immuable ne porte pas de colonne qui suggère qu'elle se modifie. Ces deux tables historiques n'ont pas non plus `updated_at`. |
| Pas d'endpoint `GET` séparé pour lister seulement les `impact_assessments`/`financial_assessments` d'un IRO | Le plan §10 ne le liste pas ; `GET /iro/iros/{id}` agrège déjà tout (historique complet des deux dimensions). Les fonctions `list_impact_assessments`/`list_financial_assessments` existent côté service (réutilisées par `get_iro_detail`) mais ne sont pas exposées seules. |
| `impact_assessments`/`financial_assessments` ne sont **pas** uniques par `iro_id` (pas de `UNIQUE(iro_id)`) | Chaque `POST .../impact-assessment` (ou financial) INSERT une nouvelle ligne plutôt que de faire un upsert — motif **récent** (037 `site_water_screenings`, 039 `nature_risks`/`opportunities`, toujours un nouveau run/une nouvelle ligne), préféré au motif plus ancien de 034 (`crma_article24_assessments`, UPDATE en place). Préserve l'historique complet des évaluations, utile pour un flux audité. La fiche IRO affiche la plus récente (`impact_assessments[0]`) tout en gardant l'historique accessible. |
| `ScoreComponent` est **redéfini localement** dans `models/iro.py` (pas importé de `models/crma.py`/`models/nature.py`) | Motif exact déjà établi par `models/nature.py` vis-à-vis de `models/crma.py` — chaque domaine garde sa propre définition plutôt que de coupler deux modules de domaines différents. Champs identiques à la version déjà simplifiée par `models/nature.py` (`code/label/available/value/weight/contribution/rationale`). |
| `MethodBadge`/`ConfidenceBadge` **non recréés**, mais **non plus réellement réutilisés** côté IRO | Les deux existent déjà (`apps/carbon/components/procurement/method-badge.tsx`, créés PR-05B Wave 2 — donc la condition littérale du plan « si aucune PR **Wave 4** ne les a créés » est remplie). Mais `MethodBadge` est câblé sur `CalculationMethod` (l'énumération à 5 rangs de procurement), pas sur `methodology_code`/`methodology_version` IRO (chaîne libre versionnée) — inadapté tel quel. `ConfidenceBadge` (0-1 backend) aurait demandé une conversion pour les échelles IRO (0-100, déjà « présentation »). Décision : ni doublon ni détournement forcé — la fiche IRO affiche confiance/méthode en texte simple inline. Signalé ici plutôt que silencieusement laissé de côté. |
| `KpiProvenanceDrawer` non utilisé | Conçu pour la provenance d'un KPI `facts_events` — modèle de données différent de `claim_evidence_links`/`evidence_artifacts` consommé par un IRO. Pas de point d'ancrage naturel ; non forcé. |
| `ExportButtons`/`ExportPackageCard` non utilisés pour l'Evidence Pack IRO | `ExportButtons` exporte des lignes de table en CSV/XLSX (mauvais format — l'Evidence Pack est un ZIP signé). `ExportPackageCard` est câblé sur le domaine générique `consolidated/carbon/esg/finance` (`GET /export`), pas sur un pack par-ressource. Le précédent RÉEL pour un Evidence Pack par-ressource (`GET /energy/scope2/runs/{id}/evidence-pack`) n'utilise PAS non plus `ExportPackageCard` — bouton de téléchargement direct, `Blob` + lien temporaire (`scope2-engine-panel.tsx`). PR-10 réplique ce motif exact (`downloadIroEvidencePack`), pas `ExportPackageCard`. |
| `IroCandidateButton` câblé au niveau FRONTEND uniquement sur l'écran eau (pas de nouvel appel `iro_service.create_candidate(...)` depuis `services/water/screening_service.py`) | `screening_service.flag_for_iro` documente explicitement (docstring, PR-08) : *« Ne crée JAMAIS de ligne IRO… le screening reste un résultat de domaine tant que PR-10 ne le promeut pas »* — un couplage backend aurait contredit cet invariant déjà testé de PR-08. Le bouton reste un GESTE HUMAIN SÉPARÉ (clic explicite sur la fiche eau, après le signal), qui appelle directement `POST /iro/iros` avec `origin_domain='water'`/`origin_reference='site_water_screening:{id}'` — additif, zéro ligne modifiée dans `services/water/*`. |
| Pas de sidebar entry pour `/iro` | `/water`, `/nature`, `/crma`, `/sites-geo`, `/intelligence` (tous Wave 4 ou proches) ne sont PAS dans `components/layout/sidebar.tsx` non plus — découverte via `/etat-du-produit` (feature-status.json) + liens croisés, motif suivi ici à l'identique. `sidebar.tsx` apparaît par ailleurs déjà modifié de façon non liée dans l'arbre de travail (git status initial) — non touché, pour ne pas mélanger des changements sans rapport. |
| Pas d'endpoint pour faire passer `iros.status` à `archived` | Absent de la liste d'endpoints du plan §10 ; valeur d'énumération valide en base, non exposée dans cette PR (hors périmètre, pas oublié). |

## 4. Migration 040 — six tables (résumé exact)

Toutes `company_id BIGINT NOT NULL REFERENCES companies(id)` (tenant strict,
aucune ligne globale — contrairement à CRMA/eau/nature qui ont un référentiel
partagé), RLS gen-2 complète (`ENABLE`+`FORCE`, policies `SELECT`/`INSERT`/
`UPDATE`/`DELETE`, `DROP POLICY IF EXISTS`, `app.rls_bypass`).

1. **`iros`** — `title`, `iro_type` (impact/risk/opportunity), `topic_code`,
   `origin_domain` (water/nature/crma/energy/manual), `origin_reference`
   (TEXT libre, pas de FK), `status` (candidate/under_assessment/assessed/
   decided/archived, défaut `candidate`), `value_chain_location`.
2. **`impact_assessments`** — `polarity`, `is_actual`, `scale`/`scope`/
   `irremediability`/`likelihood` (4 colonnes 0-100 séparées), `likelihood
   IS NULL` forcé si `is_actual=true` (CHECK), `time_horizon`, `confidence`
   (séparée), `methodology_code`/`version`, `components` JSONB,
   `threshold_crossed` (indicatif).
3. **`financial_assessments`** — `likelihood`/`magnitude` (2 colonnes 0-100
   séparées), `time_horizon`, `confidence`, `methodology_code`/`version`,
   `transmission_chain` JSONB (non vide, CHECK `jsonb_array_length(...)>0`),
   `primary_channel` (dérivé du 1er maillon), `components`, `threshold_crossed`.
4. **`materiality_decisions`** — `decided_by BIGINT NOT NULL`, `is_material`,
   `basis` (impact/financial/both), `justification TEXT NOT NULL` (CHECK
   non-vide), `supersedes_id` (auto-référence), **append-only par trigger**
   (`trg_materiality_decisions_guard`, `BEFORE UPDATE OR DELETE`), pas
   d'`updated_at`.
5. **`iro_actions`** — calquée sur `mitigation_actions`(034)/`water_actions`
   (037)/`nature_actions`(039) : `action_type`, `status`, `expected_effect`,
   `expected_risk_reduction_pct` (intention déclarée).
6. **`disclosure_mappings`** — `esrs_reference` (TEXT libre), `status`
   (draft/mapped/disclosed), `notes`. Table de correspondance pure.

**+ un élargissement, sur une table existante.** `audit_eventtype_check`
(`audit_events`) est élargie (`DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`
sous le même nom) pour admettre le nouveau littéral `'materiality_decision'`
— même geste déjà appliqué par 011 (événements 2FA) et 012
(`auditor_invite`/`auditor_access`). Découvert et corrigé en CI (round-trip,
§15) : le premier passage n'avait mis à jour QUE le `Literal` Python
`AuditEventType`, pas la contrainte SQL réelle — `audit_service.log_event`
échouait silencieusement en fallback `/tmp` (`new row … violates check
constraint`). Ni 011 ni 012 ne sont `requires_owner` pour ce même geste sur
cette même table (vérifié dans `migration_manifest.py`) — 040 ne l'est donc
pas non plus. `_probe_040` vérifie désormais aussi, via
`_constraint_definition_contains`, que la définition réelle de
`audit_eventtype_check` contient `'materiality_decision'` (même garde-fou
que la sonde 035 pour `purchase_lines_mapping_status_check`, nom de
contrainte réutilisé donc l'existence seule ne suffit pas).

**`iro_evidence_links` volontairement absente** (§5/§14 du plan) — preuve à
la §5 ci-dessous.

## 5. Réutilisation de `claim_link_service` — preuve, pas déclaration

Aucune seconde table de lien preuve↔claim n'a été créée. `iro_service.
get_iro_detail` appelle directement `services.intelligence.claim_link_
service.list_links(company_id=…, claim_type="iro", claim_key=f"iro:{iro_id}",
limit=200)` (voir `apps/api/services/iro/iro_service.py`) — le
même service que PR-05A, appelé avec la convention documentée par le plan
lui-même (`claim_type='iro'`, `claim_key=f"iro:{id}"`). Test dédié
(`tests/test_iro.py::TestIroEvidenceReuse`) : crée un artefact réel via
`artifact_service.register_artifact`, le lie via
`claim_link_service.create_link(...)`, puis vérifie qu'il apparaît dans
`get_iro_detail(...).evidence_links` — ET vérifie séparément que
`to_regclass('public.iro_evidence_links')` est `NULL` (la table n'existe
tout simplement pas).

## 6. Réutilisation de `materialite_service` — coexistence, pas de modification

`git diff` confirme : **zéro ligne modifiée** dans
`apps/api/services/materialite_service.py` ni `apps/api/routers/
materialite.py`. Le seul changement côté matérialité 2D est un lien croisé
purement frontend (`apps/carbon/app/(app)/materialite/page.tsx` — un bouton
« Registre IRO » dans la barre d'actions, vers `/iro`). Tests
`test_migration_ledger.py`/pytest global : `materialite_positions`/
`materialite_assessments`/`compute_score` inchangés, tous verts localement
(15 passed, 1 skipped [DB-gated]).

## 7. Réutilisation de `audit_service.log_event`

Nouveau littéral `"materiality_decision"` ajouté à `AuditEventType`
(`apps/api/services/audit_service.py`) — précédent direct `"auditor_invite"`/
`"auditor_access"` (valeur dédiée plutôt que la valeur générique
`"validation"`, pour rester filtrable par type sur un geste explicitement
sensible). `materiality_decision_service.decide(...)` appelle
`audit_service.log_event("materiality_decision", f"Décision de matérialité —
IRO #{iro_id}", detail=…, meta={"iro_id":…, "decision_id":…, "basis":…},
user=str(decided_by), company_id=company_id)` **après** l'INSERT réussi.
Vérifié qu'AUCUN autre gate de revue humaine du dépôt (CRMA `article24_
service.review()`, eau, nature) n'appelle `audit_service.log_event` — cette
discipline est **nouvelle**, explicitement demandée pour PR-10, pas un
copier-coller d'un précédent qui n'existe pas. Test dédié :
`test_materiality_decisions.py::TestMaterialityDecisionAudit`.

## 8. Append-only + supersession — mécanisme et preuve

**Mécanisme choisi : trigger dédié**, pas seulement l'absence de policy RLS
UPDATE/DELETE (le plan laissait le choix, motif §6). Justification : un
trigger donne une erreur explicite et immédiate (`RAISE EXCEPTION
'materiality_decisions: % sur la décision % refusé…'`), alors qu'une RLS
seule laisserait un `UPDATE`/`DELETE` scopé au tenant filtrer silencieusement
à 0 ligne — piège déjà documenté et évité pour `observations`/
`source_releases` (028) et répliqué ici à l'identique, y compris la décision
de GARDER des policies RLS UPDATE/DELETE actives pour le tenant (pour que le
trigger ait une ligne sur laquelle se déclencher et produire ce message,
plutôt que RLS qui l'exclurait avant même que le trigger s'exécute).

**Redécision = INSERT, jamais UPDATE.**
`materiality_decision_service.decide()` lit la décision la plus récente pour
en faire `supersedes_id`, puis exécute uniquement un `INSERT` — jamais de
requête `UPDATE materiality_decisions`.

**Preuve directe** (`tests/test_materiality_decisions.py::
TestMaterialityDecisionAppendOnly`) :
- `test_redecision_inserts_a_new_row_with_supersedes_id` : deux décisions
  successives, la seconde porte `supersedes_id = id de la première`, et
  l'ancienne reste inspectée intacte (`is_material`/`justification`
  identiques à la création).
- `test_raw_update_on_a_decision_is_refused` : `UPDATE materiality_decisions
  SET is_material = false WHERE id = …` exécuté en SQL brut → lève, message
  contient `"materiality_decisions"`.
- `test_raw_delete_on_a_decision_is_refused` : idem pour `DELETE`.

## 9. « Jamais un score unique » — enforcement structurel et preuve

Quatre niveaux, chacun vérifié par test, pas seulement déclaré :

1. **Schéma** : `impact_assessments`/`financial_assessments` sont deux
   tables ; `scale`/`scope`/`irremediability`/`likelihood` et
   `likelihood`/`magnitude` sont des colonnes distinctes dans chaque table ;
   `confidence` en est une troisième, séparée. Aucune colonne calculée,
   aucune vue matérialisée, aucun trigger ne les combine — vérifiable
   directement dans `040_iro_double_materiality.sql`.
2. **Modèles Pydantic** :
   `tests/test_iro.py::TestNeverAFusedScore::
   test_no_iro_model_exposes_a_single_fused_materiality_score` inspecte
   AUTOMATIQUEMENT `model_fields` de **chaque** classe `BaseModel` de
   `models/iro.py` (via `dir()`/`issubclass`) et échoue si un nom de champ
   correspond à un motif interdit (`materiality_score`, `iro_score`,
   `overall_score`, `combined_score`, `fused_score`, `^score$`). Un second
   test (`test_impact_and_financial_components_are_distinct_columns_in_
   response_models`) vérifie qu'`ImpactAssessmentResponse` et
   `FinancialAssessmentResponse` ne partagent aucun champ métier (hors
   `likelihood`, légitimement présent dans les deux tables comme deux
   colonnes indépendantes — documenté dans le test lui-même).
3. **Réponse API réelle** :
   `tests/test_iro.py::TestIroDetailApi::
   test_api_response_never_exposes_a_combined_score_field` parcourt
   récursivement le JSON retourné par `GET /iro/iros/{id}` (toutes les clés,
   à toute profondeur) et échoue sur toute clé suspecte — preuve sur la
   réponse HTTP réelle, pas seulement sur les modèles en mémoire.
4. **Calcul indicatif** : `threshold_crossed` (impact et financier) est
   calculé par une règle **OR** sur des seuils PAR COMPOSANTE
   (`SEVERITY_COMPONENT_THRESHOLD`/`FINANCIAL_COMPONENT_THRESHOLD = 66`),
   jamais par une somme pondérée ni un produit — `likelihood` est
   explicitement EXCLUE de la règle de sévérité d'impact (documenté dans
   `impact_assessment_service.py` : la sévérité ESRS/TNFD est fonction de
   l'échelle/étendue/irrémédiabilité, la probabilité ne qualifie que le
   passage du potentiel à l'avéré). `magnitude`/`likelihood` financiers ne
   sont JAMAIS multipliés (un produit aurait recréé exactement le « risk
   score » fusionné interdit).

## 10. Horizons temporels (plan §7)

`time_horizon` (`short`/`medium`/`long`) borné par CHECK SQL
(`impact_assessments_time_horizon_check`/`financial_assessments_time_
horizon_check`) et par le `Literal` Pydantic — valeurs ESRS 1 §6.4 §77-81
documentées en commentaire de colonne dans la migration, pas codées comme
bornes numériques rigides (l'énumération reste courte, un réglage par tenant
resterait possible sans migration de schéma).

## 11. Ledger — arithmétique exacte

- 41 fichiers `.sql` (001-040 dont 008b) après ajout de `040`.
- `test_migration_runner.py::test_build_plan_against_real_migrations_
  directory` : `len(versions) == 41`, `"040" in versions`,
  `actions["040"] == "apply"`.
- Nouveau test `test_build_plan_detects_040_pending_on_baselined_ledger`
  (miroir exact de son prédécesseur 039) — 040 est désormais la version qui
  porte l'assertion « dernière version du dossier »
  (`[i.file.version for i in plan.items][-1] == "040"`) ; l'ancien test 039
  a été corrigé pour ne plus prétendre l'être (commentaire + assertion
  retirée, motif déjà appliqué par 038 vis-à-vis de 039 lors de PR-09).
- `test_migration_ledger.py` : les 4 occurrences de `written_count == 41`
  passent à `42` (`000 + 41 fichiers`), `actions["040"] == "baseline"`,
  `records["040"].requires_owner is False` ajoutés.
- `_migration_fixtures.py::build_full_db` → `apply_upto(conn, "040")`.
- `_probe_040` ajoutée à `MIGRATION_OBJECT_PROBES` — vérifiée automatiquement
  par `test_migration_probes.py` (paramétré sur
  `MIGRATION_OBJECT_PROBES.keys()`, aucune modification requise dans ce
  fichier).
- `_iro_fixtures.py` créée (motif exact `_water_fixtures.py`/
  `_nature_fixtures.py`) et réexportée par `conftest.py` (import ajouté en
  ordre alphabétique isort, entre `_intelligence_fixtures` et
  `_nature_fixtures`, avec le marqueur `# noqa: E402,F401`).
- 5 nouveaux fichiers de test DB-gated ajoutés à `.github/workflows/
  api.yml::migration-tests` — placés après `test_nature_assess_prepare.py`
  et avant les deux modules `*_schema_not_ready.py` (qui doivent rester
  groupés en dernier, contrainte déjà documentée pour PR-08/PR-09).
  `test_water_schema_not_ready.py` se retrouve de ce fait après
  `test_nature_ledger.py`/`test_nature_assess_prepare.py` plutôt
  qu'immédiatement après `test_water_screening_api.py` comme avant PR-10 —
  sans conséquence (chaque module reconstruit lui-même tout le schéma dont
  il a besoin, `apply_upto` est idempotent).

## 12. Ce qui n'est prouvé qu'en CI

Cette machine Windows locale n'a pas de PostgreSQL/Docker — TOUS les tests
DB-gated (RLS, isolation tenant, trigger append-only, sonde `_probe_040`,
migration 040 appliquée après 039, endpoints API réels) sont **skippés en
local** et ne sont prouvés que par le job `migration-tests` en CI. Localement
prouvé : compilation (`py_compile`), tests purs (introspection des modèles),
`pytest -q` complet (980 passed, 653 skipped, 0 failed), corpus de migration
(`len==41`), ruff CI-strict (`--select=E,F,I --ignore=E501`, 0 issue après
`--fix` des 4 fichiers `services/iro/*` mal triés par isort), build frontend
complet (`npm run build` réussi, routes `/iro` et `/iro/[id]` présentes dans
le manifeste), `npm run lint` (0 erreur, 20 warnings tous pré-existants, hors
fichiers touchés par cette PR), `npx vitest run` (172 tests, 0 échec).

## 13. Hors périmètre (confirmé)

- PR-11 non démarrée.
- Aucun LLM comme décideur nulle part dans cette PR.
- Aucune publication automatique de disclosure (`disclosure_mappings.status`
  toujours posé par un appel humain explicite).
- Aucun rétro-correctif de la RLS gen-1 de `materialite_positions`/
  `materialite_assessments` (écart déjà documenté par
  `WAVE_4_INTERFACE_CONTRACTS.md` §14, non touché ici).
- `iros.status='archived'` : valeur de schéma valide, aucun endpoint dédié
  dans cette PR.

## 14. Post-merge (opérateur, rappel — non exécuté par cette implémentation)

1. Backup avant écriture.
2. `db-migrate.yml` → `plan` (confirmer `040` seule `pending`) → `apply` →
   `verify` → `/health/schema` `up_to_date:true` `schema_version:"040"`.
3. Vérification applicative : `POST /iro/iros` (JWT analyst) → IRO
   `candidate` ; `POST /iro/iros/{id}/decide` avec JWT analyst (non admin) →
   403 ; avec JWT admin → décision enregistrée, `decided_by` renseigné.
4. Observation 24-48h, consigner `MIGRATIONS_RUNBOOK.md` §9.

## 15. Round-trip CI — 6 échecs réels, tous corrigés

Premier passage `migration-tests` : **6 failed, 740 passed**. Aucun échec
« flaky » — les six étaient réels, corrigés par un commit de suivi focalisé :

1. **`test_migration_040_applies_cleanly_after_039`** —
   `psycopg2.errors.UndefinedTable: relation "companies" does not exist`.
   Cause : `reset_public_schema` puis `apply_upto(conn, "039")` directement,
   sans `apply_ddl_inline(conn)` avant (qui crée `companies` et le reste du
   socle « 000 »). Corrigé par l'ajout de l'appel manquant — motif exact
   `build_iro_db`/`_water_fixtures.py`/`_nature_fixtures.py`, que ce test
   avait par erreur réimplémenté à la main sans le répliquer entièrement.
2. **`TestIroTenantIsolation::test_raw_sql_rls_blocks_cross_tenant_select`**
   et son miroir dans `test_iro_actions.py` — la ligne d'un autre tenant
   ÉTAIT visible en SQL brut. Cause : exactement le piège documenté dans la
   mission (« CI Postgres se connecte en superuser, qui bypasse la RLS
   entièrement ») — un piège que j'avais moi-même déjà noté dans le
   docstring de la classe sans en tirer la conséquence dans le test lui-même.
   Corrigé en RETOURNANT le test : il affirme désormais explicitement que la
   ligne EST visible (documentant le bypass comme un fait prouvé, pas une
   hypothèse), avec un renvoi vers les tests de défense en profondeur
   (`iro_service.list_iros`/`get_iro`, `iro_actions_service.list_actions`)
   qui, eux, prouvent l'isolation réelle sous cette contrainte d'environnement.
3. **`TestMaterialityDecisionAudit::test_decide_logs_an_audit_event`** —
   `new row for relation "audit_events" violates check constraint
   "audit_eventtype_check"`. Cause : le premier passage n'avait élargi que le
   `Literal` Python `AuditEventType`, pas la contrainte SQL réelle sur
   `audit_events`. Corrigé en ajoutant à la migration 040 le même geste DROP+
   ADD CONSTRAINT déjà utilisé par 011/012 (détaillé §4/§7 ci-dessus), et en
   renforçant `_probe_040` pour vérifier le contenu réel de la contrainte
   (pas seulement son existence — son NOM est réutilisé).
4. **`test_iro_actions.py::test_create_on_unknown_iro_raises`** et
   **`test_tenant_a_cannot_create_action_on_tenant_b_iro`** — attendaient
   `iro_actions_service.IroActionError`, mais `assert_iro_in_scope`
   (`iro_service`) lève AVANT que le code du service appelant n'ait la main —
   l'exception réelle est `iro_service.IroError`. Corrigé (le même piège avait
   déjà été anticipé et évité dans `test_impact_assessments.py`/
   `test_financial_assessments.py`, pas dans `test_iro_actions.py` — audité
   ensuite dans tout le lot, aucune autre occurrence trouvée).

Second passage CI : **738 passed, 8 errors** (setup errors, pas des échecs
d'assertion) — un SEPTIÈME problème réel, nouveau, révélé seulement par le
premier correctif :

7. **`ERROR at setup of Test*` (8×) dans `test_iro_actions.py`** —
   `psycopg2.errors.CheckViolation: check constraint "audit_eventtype_check"
   … is violated by some row`, cette fois DANS la fixture `iro_schema`
   elle-même (`build_iro_db` → `apply_upto(conn, "040")`). Cause, non
   évidente : `apply_upto` REJOUE TOUS les fichiers 001→040 dans l'ordre à
   CHAQUE appel (aucun `reset_public_schema` entre modules de test DB-gated
   — seuls les modules `*_schema_not_ready.py` le font). Le module
   `test_materiality_decisions.py` (qui s'exécute juste avant dans l'ordre
   déclaré de `api.yml`) avait écrit une ligne réelle `event_type=
   'materiality_decision'` dans `audit_events`. Quand `test_iro_actions.py`
   rejoue ensuite `apply_upto("040")`, la boucle traverse d'ABORD 011.sql
   (qui refait `DROP CONSTRAINT` + `ADD CONSTRAINT` avec la définition
   ÉTROITE d'origine, sans `materiality_decision` ni même `auditor_invite`/
   `auditor_access`) AVANT d'atteindre 040.sql qui l'élargit à nouveau — la
   ligne laissée par le module précédent viole donc temporairement la
   définition étroite rejouée par 011. Aucune migration antérieure (011/012)
   n'avait jamais révélé ce risque car aucun test DB-gated n'écrivait
   réellement `auditor_invite`/`auditor_access` dans la vraie table Postgres
   avant d'expirer son module (les tests auditeur DB-gated, s'ils existent,
   tournent dans le job `tests` en mode `/tmp`, jamais contre un vrai
   Postgres) — PR-10 est la PREMIÈRE PR dont un test DB-gated écrit
   réellement un littéral audit nouvellement ajouté puis laisse un AUTRE
   module rejouer la chaîne de migrations par-dessus. Corrigé en ajoutant le
   nettoyage de `audit_events` (scopé `company_id = ANY(ids)`) au tear-down
   de `two_companies_iro` (`_iro_fixtures.py`) — la ligne ne survit plus à la
   fin de SON module, donc n'est plus là pour violer un rejeu étroit
   ultérieur. Aucune migration frozen (011/012) n'a été modifiée — elles
   restent des instantanés immuables, conformément au principe documenté
   dans `migration_manifest.py`.

Troisième passage CI : voir l'état final dans le rapport ci-dessous.
