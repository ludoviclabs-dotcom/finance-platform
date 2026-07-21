# DEMO_QA_CHECKLIST — recette de la démonstration « Asterion Motion »

> **100 % FICTIF · IA SIMULÉE · ZÉRO APPEL EXTERNE.** Liste de contrôle qualité de la
> démonstration `asterion-motion-v1`. Cocher chaque point avant toute présentation publique.
> Références : [`ASTERION_SCENARIO.md`](./ASTERION_SCENARIO.md),
> [`DEMO_ARCHITECTURE.md`](./DEMO_ARCHITECTURE.md).
>
> **Note d'honnêteté.** Il n'y a **pas de PostgreSQL local** ici : les points marqués
> **[CI]** sont validés par la CI (base éphémère du pipeline), pas exécutés localement. Les
> points marqués **[cockpit]** sont vérifiables hors-ligne sur `/demo/asterion-motion`.

## 1. Badges & honnêteté fictive [cockpit]

- [ ] Les trois badges **IA SIMULÉE · ZÉRO APPEL EXTERNE · DÉMONSTRATION FICTIVE** sont
      visibles en permanence, sur **toutes** les étapes et dans **tous** les modes.
- [ ] Aucun chiffre n'est présenté comme réel ; Asterion Motion n'est jamais présenté comme
      un client réel.
- [ ] Les données affichées portent un statut visible (`estimated` / `manual` / `verified` /
      `derived`) via `DataStatusBadge`.

## 2. Revue IA & gouvernance [cockpit]

- [ ] **Aucun chain-of-thought** n'est affiché : seules les **6 étapes fonctionnelles**
      apparaissent (sélection, licence/sensibilité, résolution, confrontation, brouillon,
      attente de revue). Pas de « pensée » ni de tokens de raisonnement.
- [ ] Les **4 statuts** sont présents et **correctement étiquetés** :
  - [ ] aimants 61,8 % Scope 3 → **`supported`** (voie UC-2, corroboration de calcul) ;
  - [ ] dépendance terres rares > 90 % → **`partially_supported`** (observation `estimated`) ;
  - [ ] contenu recyclé déclaré 80 % → **`contradicted`** (audit prouve 35 %) ;
  - [ ] fournisseur alternatif < 90 j → **`unsupported`** (aucune preuve interne).
- [ ] Les artefacts **exclus** apparaissent dans la trace avec leur motif : grille tarifaire
      → *sensibilité* ; benchmark → *licence*.
- [ ] La **gate de revue** (`ReviewGate`) est présente : *Accepter / Rejeter / Modifier* +
      justification. Aucun effet métier sans geste humain.
- [ ] Les statuts sont **calculés** (pas déclarés par le modèle) : rejouer le parcours donne
      **exactement** les mêmes verdicts (déterminisme).

## 3. Citations & Evidence Pack [cockpit]

- [ ] Cliquer une **citation** ouvre la preuve correspondante (`SourceDrawer`).
- [ ] Aucun identifiant de preuve n'est codé en dur incohérent : chaque citation pointe vers
      une preuve réelle du reference pack (marqueur → artefact).
- [ ] L'**Evidence Pack** affiche pour chaque valeur **source · date · statut · méthode**.
- [ ] *Estimé ≠ vérifié* et *risque ≠ confiance* sont matérialisés (dépendance `estimated` ;
      stress hydrique élevé **et** confiance 0,81 sur deux axes distincts).

## 4. Accessibilité & navigation [cockpit]

- [ ] **`prefers-reduced-motion`** respecté : animations neutralisées, contenu toujours
      lisible et complet.
- [ ] Navigation **clavier** : **→ / Espace** (suivant), **←** (précédent), **R** (reset),
      **Échap** (quitter) fonctionnent à chaque étape.
- [ ] En mode `director`, une frappe fléchée bascule proprement en `guided` sans perte du fil.
- [ ] Les 10 étapes sont atteignables et chacune expose un lien **« Explorer dans
      l'application »** cohérent (`/dashboard`, `/fournisseurs/scope3`, `/scopes`, `/crma`,
      `/scopes`, `/water`, `/iro`, `/iro`, `/iro`, `/intelligence/sources`).

## 5. Reset [cockpit] + [CI]

- [ ] **[cockpit]** La touche **R** ramène le tour à l'**étape 1**.
- [ ] **[CI]** `demo_reset.py` / action `reset` du workflow purge **uniquement** le tenant
      `asterion-motion-demo` (garde-slug) ; refus si le slug ne correspond pas.
- [ ] **[CI]** Aucune donnée réelle n'est touchée par le reset.

## 6. Réseau & coût [cockpit]

- [ ] **Aucun appel réseau externe** pendant le parcours en mode démo (vérifier l'onglet
      réseau : pas de requête sortante vers un fournisseur de modèle).
- [ ] **Aucun modèle payant** : `AI_REVIEW_MODE=demo` ; le mode `live` n'est pas activé.
- [ ] Aucun upload externe, aucune permission globale accordée par la session démo.

## 7. Accès sécurisé (`POST /auth/demo`) [CI]

- [ ] L'endpoint émet un **JWT court** (rôle `analyst`, claim `demo:true`), **sans refresh
      cookie** (auto-expiration).
- [ ] **Aucun secret client** n'est livré au frontend (l'ancien mot de passe démo codé en dur
      est supprimé).
- [ ] L'endpoint est **rate-limited** et **ne seed pas** (il assure seulement l'existence de
      l'entreprise + utilisateur démo).

## 8. Seed & vérification (base) [CI]

- [ ] **Zéro migration SQL** : le seed n'utilise que des tables/services existants.
- [ ] Le **seed est idempotent** : deux exécutions successives convergent vers le même état,
      sans doublon.
- [ ] Le seed est **transactionnel** et dispose d'un mode **dry-run**.
- [ ] Le seed est **borné au tenant démo** (garde-slug) ; refus si slug non conforme.
- [ ] **`demo_verify` — parité arithmétique OK** : somme Scope 3 = **3 480 tCO2e**, part
      aimants = **61,8 %**, couverture contractuelle = **54 %**, eau = **72 000 m³**,
      dépendance = **92 %**.
- [ ] Le **loader** rejette tout JSON non conforme au schéma Pydantic (aucun JSON non typé).

## 9. CI/CD & preview

- [ ] **[CI]** Le pipeline est **vert** (lint, types, tests d'ingestion / récupération /
      revue ; validation du scénario).
- [ ] Le **preview Vercel** charge **`/demo/asterion-motion`** sans erreur.
- [ ] La route cinématique existante **`/demo`** n'est **pas** cassée ni écrasée (route sœur
      intacte).
- [ ] Le cockpit se charge **hors-ligne** (sans base ni seed) et reste complet.

---

**Verdict de recette :** la démonstration est prête lorsque tous les points **[cockpit]**
sont cochés sur l'environnement de présentation et que les points **[CI]** sont verts sur le
dernier pipeline. En présentation locale sans base, s'appuyer sur le **cockpit figé**
(mode nominal hors connexion).

*Fin de DEMO_QA_CHECKLIST.md.*
