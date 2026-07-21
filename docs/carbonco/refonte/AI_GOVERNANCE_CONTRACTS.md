# AI_GOVERNANCE_CONTRACTS — CarbonCo Intelligence (cadre PR-11)

> **Statut : contrat gelé, documentaire.** Aucun code, aucune migration, aucun appel modèle
> n'est introduit par ce document. Il fige les règles de gouvernance auxquelles toute
> implémentation IA de CarbonCo (à commencer par PR-11) doit se conformer.
>
> - Base : `origin/master` @ `93a513a` (merge PR #117), schéma `040`, `up_to_date=true`.
> - Rédigé le 2026-07-21. Supersède, pour le volet IA, la §16 de
>   `PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md` en la précisant (ne la contredit pas).
> - Vocabulaire, RLS, licences, pagination, erreurs : alignés sur
>   `WAVE_2_INTERFACE_CONTRACTS.md` (contrats gelés) et la migration `028_evidence_kernel.sql`.

---

## 0. Portée et intention

CarbonCo est une plateforme d'**intelligence auditable** de reporting durable (CSRD/ESRS, VSME,
Taxonomie, CBAM, CRMA, eau, biodiversité/TNFD, double matérialité IRO). L'IA y est un
**assistant de revue et d'explication**, jamais un moteur de décision.

Ces contrats s'appliquent à **tout composant qui envoie du texte à un modèle de langage** au nom
d'un utilisateur ou d'un tenant, qu'il tourne dans `apps/api` (Python/FastAPI) ou dans
`apps/carbon` (Next.js BFF). Ils s'appliquent donc :

- au **copilote existant** (`apps/carbon/app/api/copilot/route.ts`) et à la variante marketing
  (`apps/carbon/app/api/value-mapping-variant/route.ts`) — *rétroactivement, dans la mesure du
  raisonnable* (voir §12) ;
- à **tout nouveau service de revue IA** introduit par PR-11 et au-delà.

---

## 1. Principes (ce que l'IA PEUT faire)

Repris et précisés depuis `PLAN_ACTION…INTELLIGENCE.md` §16.1 et §1 (principes 7–11) :

1. **Résumer** des preuves déjà autorisées (artefacts dont `allow_display=true`).
2. Proposer un **brouillon** de texte (narratif de disclosure, réponse questionnaire) — toujours `DRAFT`.
3. Identifier des **informations manquantes** pour compléter un dossier.
4. **Expliquer un calcul déterministe déjà réalisé** (Scope 2/3, CRMA…) sans jamais le recalculer.
5. Proposer un **IRO candidat** (`iros.status='candidate'`) à partir d'un signal de domaine.
6. Suggérer des **questions de revue** pour un relecteur humain.
7. **Signaler des contradictions** entre un claim applicatif et ses preuves.
8. Aider à **naviguer** dans les preuves (pointer vers l'artefact d'origine).

Toute sortie est **advisory** : elle alimente un humain, elle ne mute jamais une donnée métier.

---

## 2. Interdictions (ce que l'IA ne peut JAMAIS faire)

Repris de `PLAN_ACTION…` §16.2, §1.8–1.9, §23, et durci ici. Chaque interdiction est
**vérifiable** (une gate d'évaluation lui correspond — voir `PR11_AI_EVALUATION_AND_RED_TEAM_PLAN.md`).

L'IA ne peut jamais :

- **décider qu'un IRO est matériel** — seule `materiality_decisions.decide()` (humain,
  `decided_by NOT NULL`, `justification NOT NULL`, trigger append-only `trg_materiality_decisions_guard`) le fait ;
- **approuver / valider un calcul** réglementaire ;
- **publier une disclosure** ou faire passer un statut en `disclosed`/`published`/`validated` ;
- **modifier une observation vérifiée** (les `observations` sont `frozen` par `evidence_kernel_guard('frozen')`) ;
- **sélectionner silencieusement un facteur** d'émission ou une méthode ;
- **créer une donnée factuelle sans source** (tout chiffre affirmé est cité ou marqué `unsupported`) ;
- **transformer une suggestion en donnée validée** — une `SUGGESTION` ne crée jamais de
  `claim_evidence_links`, d'`observation`, ni de ligne métier sans geste humain explicite ;
- **agir comme score officiel** (jamais présenté comme note UE/officielle — cf. « CarbonCo Supply Risk Score ») ;
- **contourner une licence** (voir §5) ou une règle de sensibilité (voir §6) ;
- **accéder aux données d'un autre tenant** (voir §7) ;
- **exécuter une action métier sans confirmation humaine** ;
- **effectuer un calcul réglementaire** — les calculs restent déterministes (`PLAN…` §1.7).

---

## 3. Étiquetage obligatoire des sorties

Toute sortie IA destinée à un humain porte **exactement l'un** de ces états, de façon visible
(UI) et structurée (payload) :

| Label | Sens | Conséquence |
|---|---|---|
| `DRAFT` | brouillon de texte à réécrire par l'humain | jamais publié tel quel |
| `SUGGESTION` | proposition (IRO candidat, question, donnée manquante) | jamais promue sans revue |
| `REVIEW_REQUIRED` | analyse/explication soumise à validation | jamais autoritative |

Aucune autre valeur. Un composant qui ne peut pas produire l'un de ces labels **n'émet pas**.
Ces labels sont distincts du vocabulaire *qualité de donnée* (`VERIFIED/ESTIMATED/MANUAL/INFERRED/STALE`)
et *licence* (`LICENSED/BLOCKED`) : une `SUGGESTION` peut citer une preuve `VERIFIED`, mais reste une `SUGGESTION`.

---

## 4. Grounding (ancrage factuel)

**Toute affirmation factuelle générée doit être reliée à une ou plusieurs références internes réelles.**
Le modèle ne reçoit jamais un accès libre à la base : il reçoit un **contexte pré-autorisé et minimisé**
(« reference pack ») assemblé par le backend.

Sources internes admissibles comme référence (et rien d'autre) :

- `source_registry` (`source_id`) et `source_releases` (`release_id`, immuable) ;
- `evidence_artifacts` (`artifact_id`, avec `page_reference` / `table_reference` / `cell_reference` / `excerpt`) ;
- `observations` (`observation_id`, `data_status`, `confidence`, `methodology_version`) ;
- `claim_evidence_links` (liens preuve↔claim existants, humains) ;
- résultats de calcul déterministe Scope 2/Scope 3 encapsulés dans l'**enveloppe analytique**
  (`models/analytics.py::AnalyticalEnvelope`, `{data, meta, evidence}`) ;
- évaluations CRMA / eau / nature / IRO (tables des migrations 034/036–040).

Règles de grounding :

- Le reference pack est **construit côté backend**, sous RLS du tenant, après filtrage licence/sensibilité.
  Le modèle ne voit que ce pack. **Pas d'accès direct** du modèle à PostgreSQL, à Vercel Blob, au réseau,
  ni à un outil arbitraire (voir §11 de l'implémentation).
- Les **extraits** envoyés au modèle sont **minimisés** (l'`excerpt` ou la cellule pertinente, pas le PDF entier).
- Une affirmation sans référence résolvable est **marquée `unsupported`** — jamais affichée comme un fait.

---

## 5. Contrat de citation

Une citation n'est **jamais une URL inventée par le modèle**. C'est une **structure typée** résolue
contre la base réelle. Chaque citation contient au minimum :

| Champ | Source réelle | Obligation |
|---|---|---|
| `resource_type` | `source` / `release` / `artifact` / `observation` / `claim_link` / `calc_result` | requis |
| `internal_id` | l'id BIGINT correspondant | requis |
| `source_id` / `release_id` | `source_registry.id` / `source_releases.id` | si pertinent |
| `artifact_id` | `evidence_artifacts.id` | si pertinent |
| `observation_id` | `observations.id` | si pertinent |
| `locator` | `page_reference` / `table_reference` / `cell_reference` / `excerpt` | si disponible |
| `data_status` | `observations.data_status` (`verified/estimated/manual/inferred`) | si observation |
| `sensitivity` | `evidence_artifacts.sensitivity` (`public/internal/confidential/restricted`) | si artefact |
| `license_decision` | `license_policy.evaluate(source).allow_display` (+ `allow_derived_use`) | requis si source externe |
| `retrieved_at` | `source_releases.retrieved_at` | si release |
| `stale` | dérivé freshness (release superseded, `valid_to` dépassé) | requis |

Règles de citation :

- **Chaque citation est résolue** : `internal_id` doit exister, appartenir au tenant (ou global
  `company_id IS NULL`), et être cohérent avec le `resource_type`. Une citation non résolue = **`unsupported`**.
- **Aucune citation cross-tenant** (voir §7).
- **Aucun artefact `confidential`/`restricted`** exposé sans permission (voir §6).
- `allow_display` et `allow_derived_use` sont **vérifiés avant l'envoi au modèle** (voir §5 licences ci-dessous
  et `license_policy.evaluate`).
- L'interface doit permettre d'**ouvrir la preuve d'origine** (drawer evidence, lien vers l'artefact).
- Chaque affirmation reçoit un **statut de support** (entailment claim↔preuve) :
  `supported` · `partially_supported` · `contradicted` · `unsupported`.
- Une citation **exacte mais non pertinente** (elle existe mais ne soutient pas l'affirmation) doit
  ressortir en `partially_supported` ou `unsupported`, jamais `supported`.

### Séparation stricte citation IA ↔ preuve validée

La table `claim_evidence_links` (Evidence Kernel) contient des liens **humains/validés**.
Les citations produites par le modèle sont stockées **séparément** (nouvelle table `ai_citations`,
voir plan d'implémentation) et **ne sont jamais écrites dans `claim_evidence_links`**.
Une citation IA ne devient un lien de preuve validé que par un **geste humain explicite** (accept),
qui crée alors une ligne `claim_evidence_links` via `claim_link_service` — traçant l'auteur humain.

---

## 5bis. Licences

Le seul juge de licence est **déterministe** : `services/intelligence/license_policy.py::evaluate(source)`
→ `LicenseDecision{allow_ingest, allow_store, allow_display, allow_derived_use, reasons[], warnings[]}`
(« Aucun LLM » — docstring du module). Ses entrées sont les colonnes booléennes de `source_registry`
(`automated_access_allowed, storage_allowed, commercial_use_allowed, redistribution_allowed,
derived_use_allowed, display_allowed, active, attribution_text`).

Règles :

- **Avant d'inclure un extrait de source externe dans le contexte modèle** : exiger `allow_display=true`.
- **Avant d'utiliser une donnée dans un raisonnement dérivé exposé** : exiger `allow_derived_use=true`
  (sinon `warning` propagé, contenu non exposé).
- Une release en statut `blocked_license` (`release_service.publish_release`) n'est **jamais** citable ni
  envoyée au modèle — `blocked_license` est un état de cycle de vie normal, pas une erreur.
- L'UI propage la licence en badge `LICENSED` / `BLOCKED` + un `LicenseWarning`.
- **Violation de licence = gate de merge bloquante** (compteur `licence violation = 0`).

---

## 6. Sensibilité et permissions

- `evidence_artifacts.sensitivity ∈ (public, internal, confidential, restricted)`.
- `confidential` / `restricted` ne sont **jamais** placés dans un contexte modèle ni affichés
  **sans permission explicite** ; ils ne sont servis que via proxy authentifié.
- Le **niveau minimal** nécessaire à la tâche est utilisé (minimisation, §4).
- Les **permissions** appliquées à l'utilisateur qui déclenche la revue s'appliquent **au reference pack** :
  le modèle ne peut jamais voir plus que ce que l'utilisateur pourrait voir lui-même.
- `sensitive leakage = 0` est une **gate de merge**.

---

## 7. Isolation tenant (RLS gen-2)

Pattern gelé (migrations `009/027/028`, `WAVE_2_INTERFACE_CONTRACTS.md` §7) :

```sql
USING (current_setting('app.rls_bypass', true) = 'on'
       OR company_id IS NULL
       OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint)
```

- **Lecture** : ligne du tenant **ou** ligne globale (`company_id IS NULL`). **Écriture** : tenant
  uniquement (jamais `IS NULL`). Policies par commande (`FOR SELECT/INSERT/UPDATE/DELETE`), `FORCE` RLS.
- **Défense en profondeur applicative obligatoire** : chaque requête de service porte AUSSI son prédicat
  de périmètre (`(company_id = %s OR company_id IS NULL)` en lecture, `company_id = %s` en écriture) —
  parce que le Postgres de CI se connecte en superuser et **bypasse RLS**. L'isolation ne repose donc
  jamais sur la seule RLS.
- Le reference pack et **toutes** les tables IA nouvelles (voir plan) suivent ce pattern, avec
  `company_id NOT NULL` (données strictement tenant, jamais globales).
- `cross-tenant leakage = 0` est une **gate de merge** (test tenant A / tenant B obligatoire).

---

## 8. Audit et journal de run

Chaque invocation modèle produit un **enregistrement de run auditable** (nouvelle table `ai_runs`,
voir plan). Un run trace :

`company_id` · utilisateur (`created_by`) · `use_case` · `provider` · `model` · `model_version` ·
`prompt_version` · `policy_version` · `input_hash` (SHA-256 du reference pack minimisé) ·
`allowed_reference_ids` (snapshot des références autorisées) · sortie structurée (via `ai_claims`) ·
citations (via `ai_citations`) · `status` · `tokens_input`/`tokens_output` · `cost_estimate` ·
`latency_ms` · `error_code` · `review_status` · reviewer + décision (via `ai_review_decisions`) · timestamps.

Règles :

- Réutiliser **`audit_service.log_event`** / `audit_events` pour l'**événement métier** de haut niveau
  (ex. « suggestion IRO créée », « revue approuvée ») — comme PR-10 a ajouté `materiality_decision` à
  `audit_eventtype_check`. Le **détail technique du run** (tokens, coût, hash, latence) va dans `ai_runs`,
  **pas** dans `audit_events` (dont le schéma n'a pas ces colonnes).
- **Aucun prompt brut sensible dans les logs généraux** : les logs applicatifs ne contiennent ni le
  contexte complet, ni les extraits d'artefacts, ni la réponse brute. On journalise des **identifiants et
  hachages**, pas du contenu. Le contenu détaillé, si conservé, l'est dans les tables IA sous RLS (voir §9).

---

## 9. Rétention

Décision **par défaut sûre**, à confirmer (`PR11_DECISIONS.md`) :

- **Par défaut : ne pas conserver les prompts bruts ni les réponses brutes.** On conserve la sortie
  **structurée** (`ai_claims`), les **citations** (`ai_citations`), les **métadonnées de run** (`ai_runs`)
  et les **décisions humaines** (`ai_review_decisions`) — suffisant pour l'audit sans stocker de PII/contenu
  confidentiel en clair.
- Si un input snapshot est conservé pour reproductibilité, il l'est **haché** (`input_hash`) ; le contenu
  clair n'est stocké que sur **opt-in tenant explicite**, sous RLS, avec purge programmée.
- Les artefacts confidentiels/restreints **ne sont jamais copiés** dans les tables IA ; on n'y garde que
  leur `artifact_id` + locator.
- Traitement **UE / région de données** : à confirmer (le gateway et le fournisseur doivent respecter la
  localisation attendue — `PR11_DECISIONS.md`).

---

## 10. Modèles et fournisseurs

État réel (inventaire, base `93a513a`) :

- SDK : **Vercel AI SDK** (`ai@^6`, `@ai-sdk/anthropic@^3`, `@ai-sdk/react@^3`).
- Fournisseur : **Anthropic via Vercel AI Gateway** ; identifiant modèle **`anthropic/claude-sonnet-4.6`**
  (codé en dur dans les deux route handlers actuels).
- CSP (`apps/carbon/proxy.ts`) : `connect-src` autorise `https://ai-gateway.vercel.sh` et `https://api.anthropic.com`.
- Abstraction existante : `apps/carbon/lib/ai/provider.ts` — `NEURAL_MODE ∈ {demo, live}` ; **`demo` par
  défaut** (réponses scriptées, **zéro appel payant**) ; `live` = appel réel (décision budgétaire explicite).

Contrats fournisseur :

- Une **abstraction fournisseur** doit permettre de **changer de modèle sans changer les contrats métier**
  (grounding, citations, gate, audit). L'identifiant modèle n'est **jamais** codé en dur dans la logique
  métier ; il est injecté (config + `ai_runs.model`/`model_version`).
- **Aucune substitution silencieuse** de modèle : si le modèle configuré est indisponible, on **échoue
  explicitement** (état `provider indisponible`), on ne bascule pas en douce sur un autre.
- Le **mode `demo`/`live`** est préservé : par défaut, aucune API payante ; le mode réel s'active par une
  décision explicite (variable d'environnement + décision budgétaire).

---

## 11. Coûts, quotas, erreurs, disponibilité

- **Rate limiting** : réutiliser le mécanisme existant (`apps/carbon/lib/rate-limit.ts`, Upstash Redis,
  fenêtre glissante 20/min + 200/jour). **Attention** : il est actuellement **fail-open** (si Redis absent,
  tout passe) — pour PR-11 sur des surfaces authentifiées coûteuses, préférer un comportement **fail-safe**
  (voir `PR11_DECISIONS.md`). Le backend applique en plus son propre garde par tenant/utilisateur.
- **Budget & timeout explicites** par use case (plafond tokens, plafond coût/run, `maxDuration`).
  Un run qui dépasse est coupé et marqué `error_code=budget|timeout`. Gate de merge : « budget coût et
  timeout explicites ».
- **Coût estimé** enregistré par run (`ai_runs.cost_estimate`) ; exposé en agrégat pour observabilité.
- **Erreurs** normalisées (fournisseur indisponible, rate limit, timeout, streaming interrompu) — aucune
  n'est silencieuse ; toutes ont un état UI dédié (voir §UI de l'implémentation).
- **Streaming interrompu** : la sortie **autoritative** (structurée + citations) ne provient jamais du flux
  partiel ; elle est persistée par le backend une fois complète et validée. Le stream ne sert qu'à
  l'affichage progressif d'un **brouillon**.

---

## 12. Revue humaine (human-in-the-loop)

- Toute sortie IA transite par une **gate de revue** avant tout effet métier.
- **Gate de publication** (`PLAN…` §16.4), condition nécessaire et non contournable :

  ```
  schema_valid AND citation_resolved AND license_allowed AND human_review = approved
  ```

- L'humain peut **accepter / rejeter / modifier**, avec **justification** enregistrée
  (`ai_review_decisions`, append-only, reviewer tracé).
- **Accepter** une suggestion ne la publie pas : cela déclenche le **geste métier humain** correspondant
  (ex. créer un `iros` candidate via `iro_service.create_candidate`, ou lier une preuve via
  `claim_link_service`) — jamais une écriture directe par le modèle.
- **Aucun bouton « publier automatiquement »**. La décision de matérialité reste exclusivement
  `materiality_decisions.decide()` (humain).

### Rappel : les documents sont des données, jamais des instructions

Aucun contenu d'un artefact importé (PDF, CSV, page web, questionnaire) ne peut **modifier les
instructions système** ni déclencher une action. Les documents sont traités comme **données non
fiables**. Le contexte modèle sépare structurellement *instructions système* (fixées, versionnées côté
code) et *données* (le reference pack, encapsulé/étiqueté comme non fiable). Les tests d'injection de
prompt (`PR11_AI_EVALUATION_AND_RED_TEAM_PLAN.md`) sont une **gate de merge**.

---

## 13. Récapitulatif des gates de merge (résumé exécutable)

Aucune de ces conditions ne peut être verte « à la main » ; chacune a un test associé.

- `cross-tenant leakage = 0`
- `sensitive leakage = 0` (confidential/restricted jamais exposé sans droit)
- `licence violation = 0`
- `decision automation = 0` (aucune décision de matérialité automatique)
- `deterministic calculation mutation = 0` (l'IA ne recalcule/mute jamais un résultat déterministe)
- `citations inventées = 0` (toute citation résout un id interne réel)
- aucun claim factuel non-soutenu laissé non marqué `unsupported`
- tests d'injection de prompt **verts**
- budget coût + timeout **explicites** et testés
- **aucun test CI obligatoire ne dépend d'un appel modèle payant/non déterministe** (mode `demo`/mock)

---

*Fin de AI_GOVERNANCE_CONTRACTS.md — contrat de référence pour PR-11 et les phases IA suivantes.*
