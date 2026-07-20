# PR-10 — IRO et double matérialité · Plan d'implémentation

**Branche prévue :** `feat/iro-intelligence-links`
**Phase du plan d'architecture :** Phase 9 (`PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md` §15, §20) — « IRO et double matérialité ».
**Statut de ce document :** plan uniquement. Aucune écriture de code, aucune migration, aucune donnée. Rien commité hors `docs/carbonco/refonte/`.
**Contrats communs :** `WAVE_2_INTERFACE_CONTRACTS.md`, `WAVE_4_INTERFACE_CONTRACTS.md`.
**Dépendances directes :** PR-08 (signaux eau), PR-09 (signaux nature), PR-07/CRMA (signaux matières, déjà mergée) — PR-10 est le point de convergence des signaux des autres modules, jamais leur remplaçant.

> **Constat de départ (inspection lecture seule, vérifiée).** Le module `materialite` existe déjà et fonctionne : migration `025` (`materialite_assessments` — évaluations archivées **immuables**, `materialite_positions` — positions 2D avec `justification`), `routers/materialite.py` (8 endpoints : presets, positions, score, assessments, export), `services/materialite_service.py::compute_score` applique déjà la **règle ESRS 1 « impact OU financier »** (matérialité = union des deux dimensions, jamais leur fusion) au niveau d'un **enjeu** (topic) positionné à la main sur la matrice 2D. **Ce que ce module ne fait pas** : il n'existe aucune entité IRO individuelle, évidencée, reliée à un signal externe (matière/eau/énergie/nature) ; le score reste manuel (drag & drop) et global à l'enjeu, pas granulaire à un risque ou une opportunité précise. PR-10 **étend** ce module, il ne le remplace pas — le plan §15 le dit explicitement : *« le score 2D existant peut rester un outil de visualisation et de tri. Il ne doit pas remplacer les attributs et justifications sous-jacents »*.
>
> Autre vérification déterminante : `claim_evidence_links` (migration 028) **a déjà son service**, livré par PR-05A — `apps/api/services/intelligence/claim_link_service.py` (`create_link`/`get_link`/`list_links`, vocabulaire `relation_type ∈ supports|contradicts|contextualizes|derived_from`). Ce n'est **plus** une dette de PR-03 à combler. PR-10 **réutilise ce service tel quel**, il n'en écrit pas un second.

---

## 1. Périmètre

Introduire l'**IRO** (Impact, Risque ou Opportunité) comme entité centrale, granulaire, individuellement évidencée — reliée aux signaux produits par les autres modules (matières critiques/CRMA, eau, énergie, nature) sans jamais transformer un signal en décision automatiquement. Chaque IRO porte deux dimensions d'évaluation **strictement séparées** (matérialité d'impact, matérialité financière), chacune décomposée en composantes **jamais fusionnées** en un score unique. La décision de matérialité reste **humaine**, systématiquement.

**PR-10 (migration `038`) — livrée en une seule tranche, pas de découpage A/B.** Justification de ce choix (le plan invite explicitement à motiver l'absence de coupure quand elle n'apporte rien) : contrairement à Scope 3/Scope 2 (PR-05/06), il n'y a pas ici de moteur de calcul lourd et réutilisable à isoler dans une tranche B — la valeur du module est un **registre structuré et revu humainement**, dont le flux (candidat → évaluation impact → évaluation financière → décision → actions/disclosures) doit être testable de bout en bout pour que la discipline « jamais de score unique » soit vérifiable dans son ensemble. C'est le même choix que PR-07 (CRMA) a fait — une seule migration, un seul PR, une seule traçabilité.

Contenu :
1. **`iros`** : entité centrale, type explicite (`impact`/`risque`/`opportunité`), état de cycle de vie incluant `candidate` (§2 des contrats Wave 4 : un signal externe crée un candidat, jamais une décision).
2. **`impact_assessments`** / **`financial_assessments`** : deux tables séparées, chacune avec ses composantes propres (§5, §6) — **jamais un champ qui les combine**.
3. **`materiality_decisions`** : décision humaine obligatoire, `basis` explicite (quelle dimension a fait pencher la décision), append-only (une re-décision crée une nouvelle ligne).
4. **`iro_actions`** : actions liées à un IRO (calquées sur `mitigation_actions`, 034, sans réutiliser directement cette table — voir §5).
5. **`disclosure_mappings`** : correspondance IRO ↔ exigence de disclosure.
6. **Réutilisation de `claim_link_service.py`** pour toute preuve complémentaire — **aucune** table `iro_evidence_links` n'est créée (voir §5).

---

## 2. Hors périmètre

- **Aucun score de matérialité unique et opaque** — le non-négociable central de cette PR, répété structurellement à chaque section de ce document (§6).
- **Aucune décision de matérialité automatique** — un signal (CRMA, eau, nature, énergie ou manuel) crée au plus un `iros` en `status='candidate'` ; seule une action humaine explicite le fait progresser (`WAVE_4_INTERFACE_CONTRACTS.md` §10).
- **Pas de remplacement de `materialite_positions`/`materialite_assessments`** — la matrice 2D existante reste l'outil de visualisation/tri ; elle n'est ni supprimée ni dépréciée.
- **Pas de seconde table de lien preuve↔claim** (`iro_evidence_links` du plan §15 n'est **pas** créée — `claim_evidence_links`/`claim_link_service.py` existent déjà et suffisent, voir constat de départ).
- **Pas de calcul financier réglementaire par un LLM** — l'IA ne peut, au mieux, que proposer un IRO candidat à revoir (PR-11, hors périmètre ici).
- **Pas de rétro-modification de la RLS de `materialite_assessments`/`materialite_positions`** (gen-1, sans `FORCE`) — écart documenté, pas corrigé ici (`WAVE_4_INTERFACE_CONTRACTS.md` §7.4).
- **Pas de nouvelle taxonomie ESRS** — si un référentiel de points de données existe déjà (`vsme_datapoints`/`vsme_field_values`, migrations 014/015), `disclosure_mappings` s'y raccorde ou reste une table de correspondance libre selon ce que l'inspection de PR-10 confirmera (§5, marqué À CONFIRMER) — PR-10 n'invente pas un second référentiel ESRS.

---

## 3. Dépendances

| Élément | Rôle dans PR-10 |
|---|---|
| `services/intelligence/claim_link_service.py` (livré PR-05A) | **réutilisé directement** pour toute preuve complémentaire d'un IRO/d'une évaluation — `claim_type='iro'`/`'impact_assessment'`/`'financial_assessment'`, `claim_key=f"iro:{id}"` etc. |
| `services/crma/scoring.py` + `services/crma/article24_service.py::review()` (034) | **précédent direct**, pas un nouveau motif : composantes séparées avec `available`/`rationale`, renormalisation sur composante indisponible, gate de revue humaine (`reviewed_by` non optionnel, refus de calculer sur une ligne déjà approuvée) |
| `materialite_service.py::compute_score` (règle ESRS 1 « impact OU financier ») | précédent du **motif d'union**, pas de fusion — `materiality_decisions.basis` en est la généralisation à l'échelle de l'IRO |
| PR-08 (`site_water_screenings`, tranche B), PR-09 (`nature_risks`/`nature_opportunities`, tranche B), CRMA (`trade_or_regulatory_events`, 034) | sources de signaux — chacune peut, au mieux, faire naître un `iros` en `status='candidate'`, jamais au-delà |
| `source_registry`/`source_releases`/`evidence_artifacts` (028) | si le signal source d'un IRO provient d'une donnée externe, sa provenance reste tracée par ce chemin, pas dupliquée dans `iros` |
| `models/analytics.py::AnalyticalEnvelope` | forme de tout endpoint qui **présente** un IRO avec ses composantes (pas un calcul déterministe classique, mais la même discipline « date + source + statut + méthode » s'applique) |
| `vsme_datapoints`/`vsme_field_values` (014/015) | candidat de rattachement pour `disclosure_mappings` — **À CONFIRMER** par inspection au démarrage, pas supposé ici |
| `routers/_errors.py`, `audit_service.log_event` | erreurs partagées, audit de toute décision de matérialité (action sensible, doit être auditée) |

---

## 4. Migration réservée : `038`

**`038_iro_double_materiality.sql`** — `iros`, `impact_assessments`, `financial_assessments`, `materiality_decisions`, `iro_actions`, `disclosure_mappings`. Toutes des `CREATE TABLE` neufs — **pas** de privilège propriétaire requis (comme 028/030/031/034/037 ; à la différence de PR-08 qui touche `sites`).

RLS gen-2 complète sur toutes les tables (`ENABLE`+`FORCE`, policies par commande, `DROP POLICY IF EXISTS`, `app.rls_bypass`) — **tenant strict partout** (`company_id BIGINT NOT NULL`, aucune ligne globale : un IRO est par nature propre à un tenant, contrairement aux référentiels CRMA/eau/nature qui ont une portion globale). Sonde `_probe_038`, `build_full_db` mis à jour, tests DB-gated dans `migration-tests`, GRANT conditionnel `carbonco_app`.

---

## 5. Tables

Toutes : `id BIGSERIAL`, `company_id BIGINT NOT NULL`, `created_at`/`updated_at`, RLS FORCE.

| Table | Colonnes clés | Notes |
|---|---|---|
| `iros` | `title`, `description`, `iro_type TEXT NOT NULL` (impact/risk/opportunity), `topic_code TEXT` (rattachement indicatif à la taxonomie ESRS des enjeux déjà utilisée par `materialite_positions` — mécanisme exact À CONFIRMER par inspection de `materialite_service.py`, §2), `origin_domain TEXT` (water/nature/crma/energy/manual), `origin_reference TEXT` (pointeur libre vers l'enregistrement source, ex. `'site_water_screening:123'` — **volontairement pas une FK** pour ne pas coupler la migration 038 aux migrations 036/037 dans un ordre précis), `status TEXT NOT NULL DEFAULT 'candidate'` (candidate/under_assessment/assessed/decided/archived), `value_chain_location TEXT` (upstream/own_operations/downstream), `created_by` | Entité centrale. `status='candidate'` **est** le point d'entrée unique décrit en `WAVE_4_INTERFACE_CONTRACTS.md` §10 — pas de table de candidats par domaine. |
| `impact_assessments` | `iro_id BIGINT REFERENCES iros(id)`, `polarity TEXT` (positive/negative), `is_actual BOOLEAN` (impact avéré vs potentiel), `scale INTEGER` (0-100), `scope INTEGER` (0-100), `irremediability INTEGER` (0-100), `likelihood INTEGER` (0-100, NULL si `is_actual=true` — un impact avéré n'a pas besoin de probabilité), `time_horizon TEXT` (short/medium/long, §7), `confidence INTEGER` (0-100, **colonne séparée** de toutes les précédentes), `components JSONB NOT NULL DEFAULT '[]'` (une entrée par composante, motif `ScoreComponent` de `models/crma.py` : `code/label/available/value/rationale`), `threshold_crossed BOOLEAN`, `rationale TEXT`, `calculated_at`, `prepared_by` | **Scale, scope, irremediability et likelihood restent quatre colonnes distinctes** — aucune combinaison stockée. `threshold_crossed` **informe** une décision, n'en **est** pas une (§6). |
| `financial_assessments` | `iro_id BIGINT REFERENCES iros(id)`, `likelihood INTEGER` (0-100), `magnitude INTEGER` (0-100, **séparée** de `likelihood`), `time_horizon TEXT` (short/medium/long, §7), `confidence INTEGER` (0-100), `transmission_chain JSONB NOT NULL DEFAULT '[]'` (chaîne structurée, §8 — jamais un chiffre unique), `primary_channel TEXT` (revenue/cost/asset_value/capital_cost/liability/other, dérivé du premier maillon de la chaîne, pour le filtrage), `components JSONB NOT NULL DEFAULT '[]'`, `threshold_crossed BOOLEAN`, `rationale TEXT`, `calculated_at`, `prepared_by` | Même discipline que `impact_assessments` : `likelihood` et `magnitude` ne sont **jamais** multipliés ni combinés en base — une vue de présentation peut les juxtaposer, jamais les fusionner en un champ stocké. |
| `materiality_decisions` | `iro_id BIGINT REFERENCES iros(id)`, `decided_by BIGINT NOT NULL` (jamais nul — décision humaine obligatoire), `decided_at TIMESTAMPTZ NOT NULL`, `is_material BOOLEAN NOT NULL`, `basis TEXT NOT NULL` (impact/financial/both — **laquelle** des deux dimensions a motivé la décision, généralisation du « impact OU financier » déjà codé dans `materialite_service.compute_score`), `justification TEXT NOT NULL` (jamais optionnelle), `supersedes_id BIGINT REFERENCES materiality_decisions(id)` | **Append-only** : une décision révisée insère une nouvelle ligne avec `supersedes_id`, ne réécrit jamais l'ancienne — même philosophie que `source_releases`/`observations` (028). |
| `iro_actions` | `iro_id BIGINT REFERENCES iros(id)`, `action_type`, `title`, `description`, `status` (planned/in_progress/completed/cancelled), `owner`, `due_date`, `expected_effect TEXT`, `expected_risk_reduction_pct NUMERIC` | Vocabulaire calqué sur `mitigation_actions` (034) pour la cohérence UI, mais **table propre** — ne modifie pas `mitigation_actions` (évite de coupler PR-10 à une ALTER sur une table d'un autre domaine) et n'ALTER jamais `mitigation_actions.assessment_id` pour y ajouter une FK IRO. `expected_risk_reduction_pct` reste une **intention déclarée**, jamais soustraite automatiquement d'un score (même règle que 034). |
| `disclosure_mappings` | `iro_id BIGINT REFERENCES iros(id)`, `esrs_reference TEXT` (ex. code de datapoint VSME/ESRS si le rattachement est confirmé possible — **À CONFIRMER**, §2/§3), `status TEXT` (draft/mapped/disclosed), `notes TEXT` | Table de correspondance ; ne déclenche aucune publication automatique. |

**Table volontairement absente : `iro_evidence_links`.** Le plan §15 la liste, mais `claim_evidence_links` (028) + `claim_link_service.py` (livré PR-05A, vérifié réel) couvrent exactement ce besoin — `claim_type` libre, `relation_type ∈ supports|contradicts|contextualizes|derived_from`. La créer quand même dupliquerait un mécanisme déjà générique et déjà servi par un service existant — la même correction que celle déjà appliquée à `water_dataset_releases` (PR-08) et `nature_dataset_releases` (PR-09) vis-à-vis de `source_releases`.

---

## 6. Le principe structurant : jamais un score unique

C'est le non-négociable le plus important de cette PR (rappel explicite du plan §15 et de `WAVE_4_INTERFACE_CONTRACTS.md` §6) — appliqué **structurellement**, pas seulement en commentaire :

1. **Au niveau du schéma :** `impact_assessments` et `financial_assessments` sont deux tables séparées ; à l'intérieur de chacune, `scale`/`scope`/`irremediability`/`likelihood` (impact) et `likelihood`/`magnitude` (financier) sont des colonnes distinctes ; `confidence` est encore une colonne séparée de toutes les précédentes dans les deux tables. **Aucune colonne calculée, aucune vue matérialisée, aucun trigger ne combine ces valeurs en un nombre unique.**
2. **Au niveau de l'API :** aucun endpoint ne renvoie un champ `materiality_score`/`iro_score` unique. La réponse d'un IRO expose ses composantes individuellement (`components: list[...]`, motif `ScoreComponent`), à charge du frontend de les présenter côte à côte.
3. **Au niveau de la décision :** `materiality_decisions.is_material` est un booléen **décidé par un humain** (`decided_by NOT NULL`), motivé (`justification NOT NULL`), qui indique **quelle** dimension (`basis`) a pesé — ce n'est pas un score qui franchit un seuil automatiquement, c'est une personne qui regarde les composantes et tranche. Le calcul, au mieux, **propose** `threshold_crossed` par dimension à titre indicatif (comme `crma_article24_assessments` calcule un `risk_score` sans jamais l'auto-approuver).
4. **Au niveau de l'interface :** aucun badge « score IRO : 72/100 » nulle part. Les composantes s'affichent en grille ou en liste, chacune avec sa valeur, son poids éventuel et sa justification — motif déjà éprouvé par la page `/crma` (PR-07) pour le CarbonCo Material Exposure Score, à répliquer, pas à simplifier.

---

## 7. Horizons temporels — alignement CSRD/ESRS 1, vérifié

L'ESRS 1 (§6.4, paragraphes 77-81) définit trois horizons, retenus tels quels par défaut :
- **Court terme :** la période couverte par les états financiers de l'entreprise (généralement 1 an).
- **Moyen terme :** de la fin du court terme jusqu'à 5 ans.
- **Long terme :** au-delà de 5 ans.

L'ESRS 1 autorise explicitement une entreprise à adopter des horizons différents si les horizons par défaut ne reflètent pas ses cycles réels (ex. cycles d'investissement, secteurs à cycle long) — PR-10 fige donc les valeurs par défaut (`short`/`medium`/`long` avec les bornes ci-dessus documentées en commentaire de colonne) mais ne les code pas en dur comme une vérité absolue non paramétrable ; un futur réglage par tenant reste possible sans migration de schéma (la colonne reste une énumération courte, pas un entier de bornes).

---

## 8. Transmission financière — une chaîne documentée, jamais un chiffre

`financial_assessments.transmission_chain` (JSONB) porte la mécanique demandée par le plan (« comment un risque physique/de transition se traduit en effet financier — revenu, coût, valeur d'actif, capital — documenté, pas un chiffre unique ») :

```json
[
  {
    "step": 1,
    "mechanism": "Hausse du coût de traitement de l'eau sur le site concerné",
    "channel": "cost",
    "rationale": "Le screening PR-08 signale un stress hydrique élevé sur le bassin du site."
  },
  {
    "step": 2,
    "mechanism": "Risque de dépréciation de l'actif industriel si la ressource devient indisponible",
    "channel": "asset_value",
    "rationale": "Dépend de la durée de vie résiduelle de l'actif, à documenter au cas par cas."
  }
]
```

Chaque maillon porte son propre `channel` (`revenue`/`cost`/`asset_value`/`capital_cost`/`liability`/`other`) et sa `rationale` — la chaîne peut avoir plusieurs maillons, elle n'est jamais réduite à un seul montant. Un montant chiffré (`estimated_amount_eur`) reste **optionnel** à l'intérieur d'un maillon quand l'information existe et est fiable ; son absence ne bloque pas l'enregistrement de la chaîne (un raisonnement qualitatif documenté est déjà une information utile, contrairement à un chiffre inventé).

---

## 9. Services

| Service | Responsabilité |
|---|---|
| `services/iro/iro_service.py` | CRUD `iros`, création d'un candidat (appelée par les modules eau/nature/CRMA **ou** manuellement), progression de `status` avec validations propres à chaque transition (ex. passage à `assessed` exige au moins une évaluation impact **ou** financière calculée). |
| `services/iro/impact_assessment_service.py` | CRUD `impact_assessments`, composition des `components`, calcul de `threshold_crossed` (indicatif, jamais décisionnel). |
| `services/iro/financial_assessment_service.py` | CRUD `financial_assessments`, validation de `transmission_chain` (non vide, chaque maillon avec `channel` et `rationale`). |
| `services/iro/materiality_decision_service.py` | Gate de revue humaine — motif direct de `services/crma/article24_service.py::review()` : `decided_by` obligatoire, refuse une décision sur un IRO sans aucune évaluation calculée, une redécision crée une nouvelle ligne (`supersedes_id`) plutôt que d'écraser. |
| `services/iro/iro_actions_service.py` | CRUD actions, calqué sur `services/crma/article24_service.py` (fonctions `create_action`/`list_actions`). |
| `services/iro/disclosure_mapping_service.py` | CRUD correspondances ; **n'écrit jamais** dans `vsme_datapoints`/`vsme_field_values` — lien en lecture seule si confirmé pertinent. |

### Réutilisés (ne pas dupliquer)
`claim_link_service.py` (preuve complémentaire), `materialite_service.py` (aucune modification requise pour PR-10 — coexistence, pas d'intégration forcée dans cette PR), `audit_service.log_event` (chaque décision de matérialité auditée), `export_package` (Evidence Pack IRO, motif `SCOPE2_PACK_DOMAIN` de `services/export_package.py` — un `IRO_PACK_DOMAIN` dédié, pas une intégration dans le domaine `consolidated`/`carbon`/`esg`/`finance` générique).

---

## 10. Endpoints

Préfixe `/iro`.

- `GET /iro/iros` — `get_current_user` — pagination, filtres (`status`, `iro_type`, `origin_domain`).
- `POST /iro/iros` — `require_analyst` — création manuelle **ou** interne (appelée par les services eau/nature/CRMA) en `status='candidate'`.
- `GET /iro/iros/{id}` — `get_current_user` — vue complète : IRO + évaluations + décisions + actions + preuves (`claim_link_service.list_links`).
- `POST /iro/iros/{id}/impact-assessment` — `require_analyst`.
- `POST /iro/iros/{id}/financial-assessment` — `require_analyst`.
- `POST /iro/iros/{id}/decide` — `require_admin` — **jamais** `require_analyst` seul : une décision de matérialité est un geste à autorité plus élevée que sa préparation, motif cohérent avec `require_admin` déjà utilisé pour `POST /energy/scope2/runs/{id}/approve`.
- `GET /iro/iros/{id}/decisions` — historique complet (append-only, §5).
- `POST /iro/iros/{id}/actions`, `GET /iro/iros/{id}/actions` — `require_analyst`/`get_current_user`.
- `POST/GET /iro/iros/{id}/disclosure-mappings`.
- `GET /iro/iros/{id}/evidence-pack` — `require_analyst` — via `export_package`.

Tous : pagination (`WAVE_2_INTERFACE_CONTRACTS.md` §5), erreurs (§6), isolation (§7), licence (§8 si une preuve citée provient d'une source sous licence).

---

## 11. Interface frontend

**Créer** une nouvelle vue IRO, référencée depuis la page `materialite` existante (lien croisé, pas une fusion de pages).

- **Registre IRO** : liste filtrable par statut/type/domaine d'origine.
- **Fiche IRO** : deux panneaux distincts et toujours visibles côte à côte — « Matérialité d'impact » (scale/scope/irremediability/likelihood, chacun affiché séparément) et « Matérialité financière » (likelihood/magnitude séparés, chaîne de transmission en étapes numérotées) — **jamais un score combiné affiché**, motif §6.
- **Décision** : formulaire de décision humaine (`is_material`, `basis`, `justification` obligatoire), historique des décisions précédentes visible (append-only).
- **`IroCandidateButton`** (annoncé depuis Wave 2 §17, jamais créé) : PR-10 le crée enfin — bouton d'action explicite sur un écran de domaine (screening eau, évaluation nature, événement CRMA) pour promouvoir un signal en IRO candidat. Un seul geste humain, jamais un déclenchement automatique.
- Réutiliser `DataStatusBadge`, `ReviewStatusBadge`, `KpiProvenanceDrawer`, `ExportButtons`/`ExportPackageCard` ; créer `MethodBadge`/`ConfidenceBadge` si aucune autre PR Wave 4 ne les a créés avant (`WAVE_4_INTERFACE_CONTRACTS.md` §12).
- Client API : `apps/carbon/lib/api/iro.ts`.

---

## 12. Tests

- **Unitaires** : aucune fonction du domaine ne produit un score combiné (test qui inspecte les réponses des services et échoue si un champ numérique unique apparaît hors des composantes individuelles) ; `transmission_chain` refuse un tableau vide ou un maillon sans `channel`/`rationale` ; horizons temporels bornés à `short`/`medium`/`long` ; `materiality_decision_service` refuse `decided_by` nul et refuse une décision sur un IRO sans évaluation calculée.
- **DB-gated (job `migration-tests`)** : migration `038` applicable après `037` ; RLS + défense en profondeur (tenant A ne voit pas les IRO de B) ; `materiality_decisions` append-only vérifié (pas d'UPDATE possible sur une décision existante, seulement un `supersedes_id` neuf).
- **API** : `POST /iro/iros/{id}/decide` refusé à un rôle `require_analyst` seul (exige `require_admin`) ; 404 sans fuite d'existence cross-tenant.
- **Ledger** : `038` `pending` sur base `037` ; `plan`/`apply`/`verify` verts ; `_probe_038`.
- **Non-régression** : `materialite_positions`/`materialite_assessments`/`compute_score` inchangés — la matrice 2D existante continue de fonctionner à l'identique.
- **Frontend** : fiche IRO (deux panneaux jamais fusionnés visuellement), formulaire de décision, `IroCandidateButton` déclenché depuis un écran de domaine ; accessibilité.

---

## 13. Fichiers à créer / modifier

### Créés (backend)
- `apps/api/db/migrations/038_iro_double_materiality.sql`
- `apps/api/services/iro/__init__.py`, `iro_service.py`, `impact_assessment_service.py`, `financial_assessment_service.py`, `materiality_decision_service.py`, `iro_actions_service.py`, `disclosure_mapping_service.py`
- `apps/api/models/iro.py`
- `apps/api/routers/iro.py`
- `apps/api/tests/test_iro.py`, `test_impact_assessments.py`, `test_financial_assessments.py`, `test_materiality_decisions.py`, `test_iro_actions.py`

### Modifiés (backend)
- `apps/api/main.py` (router `/iro`)
- `apps/api/db/migration_manifest.py` (`038`), `migration_probes.py` (`_probe_038`), `tests/_migration_fixtures.py`
- `.github/workflows/api.yml` (tests DB-gated)
- `apps/api/services/export_package.py` (`IRO_PACK_DOMAIN`, motif `SCOPE2_PACK_DOMAIN`)
- **(Candidats, à valider au démarrage)** `apps/api/services/water/*`, `apps/api/services/nature/*` : point d'appel vers `iro_service.create_candidate(...)` depuis un screening/une évaluation qui dépasse un seuil — sans que PR-08/09 ne dépendent techniquement de PR-10 pour fonctionner seules (le signal reste visible dans leur propre interface même si PR-10 n'est pas encore mergée).

### Créés (frontend)
- `apps/carbon/lib/api/iro.ts`
- `apps/carbon/app/(app)/iro/page.tsx` (nouvelle route, ou sous-route de `materialite` — à trancher au démarrage selon la structure réelle de navigation)
- `apps/carbon/components/iro/*` (dont `IroCandidateButton`)

### Modifiés (frontend)
- `apps/carbon/app/(app)/materialite/page.tsx` (lien croisé vers le registre IRO — à confirmer le fichier exact par inspection, `routers/materialite.py` ne préjuge pas du chemin frontend)
- `apps/carbon/app/(app)/layout.tsx` (entrée `pageConfig`) ; `data/feature-status.json` (BETA)

---

## 14. Risques

| Risque | Mitigation |
|---|---|
| **Score unique réintroduit malgré la règle** (par commodité d'affichage) | Interdiction structurelle au niveau du schéma (colonnes séparées, aucune colonne calculée combinée) + test automatisé qui échoue sur tout champ numérique combiné dans les réponses API (§6, §12). |
| **Décision de matérialité prise sans évaluation préalable** | `materiality_decision_service` refuse explicitement (motif `article24_service.review`, qui refuse d'approuver une évaluation jamais calculée). |
| **Duplication de `claim_evidence_links`** | Décision gelée : pas de table `iro_evidence_links`, réutilisation de `claim_link_service.py` (§5). |
| **Couplage fort avec PR-08/PR-09** (si elles ne sont pas mergées avant PR-10) | `origin_reference` en `TEXT` libre, pas une FK — PR-10 fonctionne pour les signaux CRMA (déjà mergée) même si PR-08/09 ne le sont pas encore ; les points d'appel domaine→IRO sont additifs, pas bloquants. |
| **`disclosure_mappings` invente un second référentiel ESRS** | Marqué À CONFIRMER, inspection de `vsme_datapoints`/`vsme_field_values` obligatoire avant d'écrire le DDL définitif (§2/§3). |
| **Horizons temporels mal alignés CSRD** | Valeurs par défaut vérifiées (ESRS 1 §6.4, §7), ajustables par une énumération plutôt qu'un entier codé en dur. |
| Pas de PostgreSQL local | CI `migration-tests` = seule preuve. |
| Numéro `038` déjà pris (si l'ordre 08/09/10 change) | `command=plan` avant apply ; renuméroter au merge (`WAVE_4_INTERFACE_CONTRACTS.md` §13). |

---

## 15. Étapes d'implémentation

1. Inspection obligatoire de `materialite_service.py` en entier (578 lignes, non lu intégralement en phase de plan) pour confirmer le mécanisme exact de `topic_code`/taxonomie des enjeux avant d'écrire `iros.topic_code`.
2. Inspection de `vsme_datapoints`/`vsme_field_values` pour trancher `disclosure_mappings.esrs_reference`.
3. Migration `038` (six tables, RLS gen-2, tenant strict) + sonde + fixtures + job CI.
4. `iro_service` (cycle de vie, création de candidat) + tests.
5. `impact_assessment_service`/`financial_assessment_service` (composantes séparées, `transmission_chain`) + tests anti-fusion.
6. `materiality_decision_service` (gate humain, append-only) + tests.
7. `iro_actions_service`, `disclosure_mapping_service`.
8. Router `/iro` (`POST .../decide` en `require_admin`).
9. Points d'appel additifs depuis PR-08/09/CRMA (si déjà mergées) vers `iro_service.create_candidate`.
10. Frontend : registre, fiche IRO à deux panneaux, `IroCandidateButton`, formulaire de décision.
11. Tests complets ; `git diff --check` ; lint.

---

## 16. Critères de merge

- CI verte (`tests`, `migration-tests`, front, `validate`, `security-audit`, `gitleaks`).
- `ruff`/`git diff --check` propres ; TS strict.
- **Aucun score de matérialité unique détectable** dans le schéma, les réponses API ou l'UI — vérifié par test dédié, pas seulement par revue.
- Décision de matérialité systématiquement humaine, motivée, append-only.
- Isolation tenant testée (RLS gen-2 + défense en profondeur) sur les six tables.
- `materialite_positions`/`materialite_assessments` non régressés.
- Aucune table dupliquant `claim_evidence_links`.
- Aucune écriture prod par Claude. PR non mergée automatiquement.

---

## 17. Opérations post-merge

1. **Backup** avant écriture.
2. `db-migrate.yml` → `plan` (confirmer `038` `pending`, seul) → `apply` → `verify` → `/health/schema` `up_to_date:true` `schema_version:"038"`.
3. Vérification applicative : `POST /iro/iros` (JWT analyst) → IRO `candidate` ; `POST /iro/iros/{id}/decide` avec un JWT analyst (non admin) → refusé ; avec JWT admin → décision enregistrée, `decided_by` renseigné.
4. Observation 24-48h. Consigner `MIGRATIONS_RUNBOOK.md` §9.
5. **Gate Phase 9** : « aucun claim IA publié sans revue et preuve » et « IRO liés aux signaux » (plan §20) — vérifiés pour la partie non-IA (PR-11 couvre le volet IA).
