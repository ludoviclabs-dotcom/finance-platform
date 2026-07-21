# PR11_DECISIONS

> **Documentaire.** Décisions **réellement ouvertes** avant d'implémenter PR-11. Chaque décision :
> options · recommandation · risques · **valeur par défaut sûre** · **bloquant ?**.
> Base `93a513a`. Rien n'est tranché unilatéralement ici — ce sont des choix pour Ludo.
> Les points **déjà tranchés** par les contrats gelés (RLS gen-2, licence déterministe, pagination,
> gate §16.4, « pas de LLM décisionnaire ») ne figurent pas ici.

---

## D-1 — Fournisseur et modèle du MVP

- **Options** : (a) Anthropic **via Vercel AI Gateway** (déjà intégré : `ai@6`, CSP ouverte, crédit
  gateway) ; (b) Anthropic **API directe** (SDK Python côté backend) ; (c) multi-fournisseur d'emblée.
- **Recommandation** : (a) au MVP — réutilise l'existant, une seule surface à sécuriser. Appel depuis le
  **backend** via l'abstraction `provider.py`, id modèle **configuré** (pas codé en dur). Modèle : classe
  **Sonnet** (équilibre coût/qualité pour la revue) ; classe **Haiku** pour les sous-tâches d'éval/tri.
  Le dépôt référence aujourd'hui `anthropic/claude-sonnet-4.6` — **id exact à confirmer** au moment du code.
- **Risques** : dépendance gateway ; id modèle obsolète ; coût si `live`.
- **Défaut sûr** : rester en **`NEURAL_MODE=demo`** (zéro appel payant) tant que le modèle/budget n'est pas
  validé ; abstraction fournisseur pour changer sans toucher les contrats métier.
- **Bloquant ?** : **Non** pour coder (l'abstraction + le mock suffisent). **Oui** pour activer `live`.

## D-2 — Conservation des prompts / réponses (rétention)

- **Options** : (a) ne conserver **que** la sortie structurée + citations + métadonnées de run (pas de
  prompt/réponse brut) ; (b) conserver aussi l'input/répons e bruts (repro/debug) ; (c) (b) sur opt-in tenant.
- **Recommandation** : (a) par défaut ; input conservé **haché** (`input_hash`) ; contenu clair seulement
  sur **opt-in tenant** (c), sous RLS, avec purge programmée. Jamais copier d'artefact confidential/restricted.
- **Risques** : (b) stocke potentiellement de la PII/confidentiel en clair ; (a) limite le debug reproductible.
- **Défaut sûr** : (a).
- **Bloquant ?** : **Non** (défaut (a) sûr et suffisant pour l'audit).

## D-3 — Cas d'usage du MVP

- **Options** : les 8 cas du brief ; en retenir ≤ 2.
- **Recommandation** : **UC-1 (revue IRO candidate) + UC-2 (explication S2/S3 déterministe)**
  (justification comparative : `PR11_AI_REVIEW_ASSISTANT_IMPLEMENTATION_PLAN.md` §3). Fast-follow : UC-7
  (données manquantes) puis UC-6 (contradictions). UC-8 (narratif) plus tard, `DRAFT` strict.
- **Risques** : élargir le MVP dilue l'auditabilité et la qualité d'éval.
- **Défaut sûr** : commencer par **UC-2 seul** (risque le plus bas) si l'on veut minimiser encore.
- **Bloquant ?** : **Oui** (détermine endpoints, prompts, dataset d'éval) — à confirmer avant de coder.

## D-4 — Migration 041 (périmètre des tables)

- **Options** : (a) **4 tables** `ai_runs / ai_claims / ai_citations / ai_review_decisions` (recommandé) ;
  (b) 5 tables du plan (`+ ai_tasks`) ; (c) liste étendue du brief (policy/prompt/feedback/eval séparées).
- **Recommandation** : (a). `ai_tasks` fusionnée dans `ai_runs` (`subject_*`) ; prompt/policy **versionnés en
  code** ; feedback = colonne de `ai_review_decisions` ; résultats d'éval = artefacts CI, pas une table prod.
  Aucune réutilisation de `claim_evidence_links` pour les citations modèle (séparation stricte).
- **Risques** : sous-modéliser (si tâches multi-run futures) ; sur-modéliser (tables vides).
- **Défaut sûr** : (a), extensible.
- **Bloquant ?** : **Oui** (c'est la seule migration ; à figer avant `041`).

## D-5 — Streaming

- **Options** : (a) **non-streaming** pour la sortie autoritative (structurée + citations) au MVP ;
  (b) streamer aussi le brouillon narratif (réutilise `useChat`/`toUIMessageStreamResponse`).
- **Recommandation** : (a) pour l'autoritatif (simple à valider/auditer) ; (b) **optionnel** pour le seul
  **brouillon** textuel, jamais comme source de vérité. Streaming interrompu ⇒ sortie ignorée.
- **Risques** : (b) complexifie la validation ; UX perçue plus lente en (a).
- **Défaut sûr** : (a).
- **Bloquant ?** : **Non**.

## D-6 — Découpage (1 PR vs 2 tranches)

- **Options** : (a) **1 PR** `feat/ai-evidence-review` ; (b) PR-11A (ledger+provider+grounding+citations+
  sécurité+éval) puis PR-11B (endpoints+UI).
- **Recommandation** : (a) si le diff reste révisable et les garanties se testent ensemble ; sinon (b).
- **Risques** : (a) gros diff ; (b) double cycle CI/revue.
- **Défaut sûr** : préparer le code pour permettre (b) (PR-11A auto-suffisante) même si l'on vise (a).
- **Bloquant ?** : **Non** (peut se décider à mi-parcours selon la taille réelle).

## D-7 — Budget et quotas

- **Options** : plafonds tokens/coût par run et par tenant/jour ; rate-limit **fail-open** (actuel) vs
  **fail-safe** ; réutiliser Upstash vs quota backend.
- **Recommandation** : plafonds explicites par use case (tokens + coût + `maxDuration`) ; **fail-safe** sur
  les surfaces authentifiées coûteuses de PR-11 ; garde backend par tenant en plus d'Upstash.
- **Risques** : fail-open = abus/coût non maîtrisés si Redis absent.
- **Défaut sûr** : refuser (fail-safe) si le quota ne peut être évalué, en mode `live` uniquement.
- **Bloquant ?** : **Non** pour coder ; **Oui** avant `live`.

## D-8 — Rétention (durée / purge)

- **Options** : durée de conservation des runs/décisions (ex. 12/24 mois) ; purge auto ; export avant purge.
- **Recommandation** : conserver le **ledger structuré** (audit) selon la politique de conformité du dossier
  durable ; purge programmée du contenu clair opt-in (cf. D-2).
- **Risques** : rétention trop longue de contenu clair ; trop courte = perte d'auditabilité.
- **Défaut sûr** : conserver métadonnées/décisions (audit), ne pas conserver de contenu clair par défaut.
- **Bloquant ?** : **Non**.

## D-9 — Emplacement géographique du traitement

- **Options** : région de traitement du gateway/fournisseur (UE vs autre) ; exigence de résidence des données.
- **Recommandation** : privilégier un traitement **UE** si disponible via le gateway/fournisseur ; documenter
  la région effective ; ne jamais envoyer d'artefact confidential/restricted hors des garanties attendues.
- **Risques** : non-conformité résidence de données si non vérifié.
- **Défaut sûr** : `demo` (aucun envoi externe) tant que la région n'est pas confirmée.
- **Bloquant ?** : **Oui** avant `live` (pas pour coder).

## D-10 — Opt-in tenant

- **Options** : (a) fonctionnalité IA **désactivée par défaut**, activée par tenant (opt-in) ; (b) activée
  pour tous.
- **Recommandation** : (a) — cohérent avec badges `BETA`, coût à l'usage, et exigences de consentement.
- **Risques** : (b) expose tous les tenants au coût/risque sans consentement.
- **Défaut sûr** : (a), off par défaut.
- **Bloquant ?** : **Non** pour coder ; **Oui** avant activation large.

## D-11 — Évaluation « vrai modèle » dans un workflow manuel

- **Options** : (a) workflow `workflow_dispatch` manuel, budget plafonné, dataset anonymisé, rapport JSON
  archivé, **hors CI bloquante** ; (b) pas d'éval réelle automatisée du tout.
- **Recommandation** : (a). Rejoué à chaque changement de modèle/prompt (détection de dérive).
- **Risques** : (b) aucune mesure de qualité réelle ; (a) coût maîtrisé si plafonné.
- **Défaut sûr** : (a), déclenché à la demande.
- **Bloquant ?** : **Non**.

---

## Dettes/durcissements connexes (à trancher, non bloquants pour le cadrage)

- **`value-mapping-variant/route.ts` sans auth ni rate-limit** — endpoint LLM public. Recommandation :
  ajouter auth + rate-limit (ou confiner au strict marketing en `demo`). À traiter dans PR-11 ou une PR de
  durcissement dédiée.
- **Rate-limit `lib/rate-limit.ts` fail-open** — voir D-7.

---

## Synthèse : ce qui bloque le démarrage de l'implémentation

| Décision | Bloquant pour CODER ? | Bloquant pour `live` (prod payant) ? |
|---|---|---|
| D-3 Cas d'usage MVP | **Oui** | — |
| D-4 Tables 041 | **Oui** | — |
| D-1 Modèle/fournisseur | Non (mock) | **Oui** |
| D-7 Budget/quotas | Non | **Oui** |
| D-9 Région données | Non | **Oui** |
| D-2/D-5/D-6/D-8/D-10/D-11 | Non | selon activation |

**Pour lancer l'implémentation, il suffit de trancher D-3 et D-4.** Tout le reste a un défaut sûr
(`demo`, off, non-streaming, 1 PR extensible) et peut être confirmé avant l'activation `live`.

*Fin de PR11_DECISIONS.md.*
