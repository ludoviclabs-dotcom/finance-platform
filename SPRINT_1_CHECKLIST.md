# Sprint 1 — Phase 0 "Alignement"

> **Durée** : 2 semaines (S1–S2), ~10 jours ouvrés
> **Objectif** : Site V2 honnête en production, aucune promesse non tenue
> **Jalon final** : déploiement prod avec 0 mention interdite

---

## Préparation (J0 — avant de démarrer)

- [ ] `git checkout master && git pull`
- [ ] `git checkout -b refonte-90j`
- [ ] `git tag workbooks-baseline-v2025.0`
- [ ] `git push -u origin refonte-90j`
- [ ] `git push origin workbooks-baseline-v2025.0`
- [ ] Créer compte PostHog free tier → noter API key dans `.env.local`
- [ ] Créer compte UptimeRobot free tier → noter API key
- [ ] Vérifier que le site actuel tourne en local (`cd apps/carbon && npm run dev`)
- [ ] Vérifier que l'API tourne en local (`cd apps/api && uvicorn main:app --reload`)

---

## Jour 1 (lundi S1) — Audit claims (0.1)

**Objectif** : Lister toutes les promesses à corriger dans un document dédié.

### Tâches

- [ ] Créer `CLAIMS_AUDIT.md` à la racine (template fourni)
- [ ] Ouvrir `apps/carbon/components/pages/landing-page.tsx` et lister chaque claim
- [ ] Ouvrir `apps/carbon/lib/data.ts` et lister chaque claim
- [ ] Grep `apps/carbon/` pour :
  - [ ] `grep -rn "OVH\|HDS\|souverain\|hébergement" apps/carbon/`
  - [ ] `grep -rn "99.9\|SLA\|uptime" apps/carbon/`
  - [ ] `grep -rn "SAP\|Oracle\|Sage\|Cegid" apps/carbon/`
  - [ ] `grep -rn "12 ESRS\|tous les ESRS\|natif" apps/carbon/`
  - [ ] `grep -rn "Vinci\|Schneider\|TotalEnergies\|BNP\|LVMH" apps/carbon/`
  - [ ] `grep -rn "120+ entreprises\|plus de 100\|1000+ clients" apps/carbon/`
- [ ] Remplir `CLAIMS_AUDIT.md` section par section
- [ ] Commit : `docs: audit des claims site v1 (tâche 0.1)`

**DoD** : `CLAIMS_AUDIT.md` contient ≥10 claims listés avec statut (garder/retirer/requalifier).

---

## Jour 2 (mardi S1) — Retrait logos + scénarios sectoriels (0.2, 0.3)

**Objectif** : Remplacer les faux témoignages par des scénarios honnêtes.

### Tâches

- [ ] Lister les logos clients affichés dans `landing-page.tsx` et `data.ts`
- [ ] Vérifier **contractualisation** de chaque logo (probablement aucun)
- [ ] Retirer tous les logos non contractualisés des assets
- [ ] Dans `data.ts`, remplacer par 3 scénarios sectoriels anonymisés :
  - [ ] **Scénario 1** : "ETI industrielle française, 1 200 salariés, secteur métallurgie"
  - [ ] **Scénario 2** : "ETI services B2B, 400 salariés, conseil aux entreprises"
  - [ ] **Scénario 3** : "ETI agroalimentaire, 800 salariés, transformation laitière"
- [ ] Pour chaque scénario inclure : contexte + challenge + approche + résultat (honnête, chiffré quand possible)
- [ ] Mettre à jour `landing-page.tsx` pour afficher les scénarios à la place des logos
- [ ] Test local : `npm run dev` et vérifier visuellement
- [ ] Commit : `refactor(landing): remplace logos clients par scénarios sectoriels anonymisés (0.2, 0.3)`

**DoD** : 0 logo client visible sur le site local, 3 scénarios affichés proprement.

---

## Jour 3 (mercredi S1) — Requalification des promesses (0.4 à 0.7)

**Objectif** : Remplacer les claims absolus par du vocabulaire safe.

### Tâches (dans `data.ts` et `landing-page.tsx`)

- [ ] **0.4** : Retirer toute mention "OVH HDS", "hébergement souverain", "cloud français"
  - Remplacer par : "Hébergé sur infrastructure Vercel (UE) — migration souveraine en roadmap"
- [ ] **0.5** : Remplacer "12 ESRS natifs"
  - → "Couverture prioritaire ESRS E1 (Climate) + ESRS 1/2 (transverse) — autres standards en roadmap"
- [ ] **0.6** : Remplacer "intégration SAP/Oracle en 2 jours"
  - → "Compatible via upload Excel structuré ou export ERP. Connecteurs natifs en roadmap"
- [ ] **0.7** : Retirer "SLA 99,9%"
  - → "Disponibilité best-effort, monitoring public transparent (voir /status)"
- [ ] Relire chaque page du site pour détecter d'autres promesses fortes
- [ ] Commit : `refactor(content): requalification des claims produit (0.4-0.7)`

**DoD** : `grep -rn "99.9\|OVH HDS\|12 ESRS\|SAP.*2 jours" apps/carbon/` retourne 0 résultat.

---

## Jour 4 (jeudi S1) — Grille tarifaire + lexique safe (0.8, 0.9)

**Objectif** : Unifier le pricing et créer un dictionnaire de vocabulaire.

### Tâches

- [ ] **0.8** : Auditer toutes les pages pricing (`pricing/page.tsx`, `data.ts`, landing)
- [ ] Identifier les incohérences de prix (plan/montant/features)
- [ ] Décider une grille unique simple :
  - Plan **Starter** : pour TPE/PME en reporting volontaire
  - Plan **Business** : pour ETI fournisseurs grands comptes
  - Plan **Enterprise** : "sur devis" uniquement
- [ ] Mettre à jour `data.ts` avec la grille unique
- [ ] Mettre à jour `pricing/page.tsx` en conséquence
- [ ] **0.9** : Créer `apps/carbon/lib/claims-dictionary.ts` :

```typescript
// Lexique safe pour éviter les promesses non opposables
export const SAFE_CLAIMS = {
  // Couverture produit
  coverage_e1: "Couverture prioritaire ESRS E1",
  coverage_other: "Autres standards ESRS en roadmap",
  integration_excel: "Compatible via upload Excel structuré",
  integration_api: "API REST disponible (Beta)",
  integration_erp: "Connecteurs ERP natifs en roadmap",

  // Hébergement
  hosting: "Hébergé sur infrastructure Vercel (UE)",
  hosting_roadmap: "Migration vers infrastructure souveraine en roadmap",

  // Méthodologie
  methodology: "Méthodologie publique et téléchargeable",
  factors: "Facteurs d'émission ADEME Base Empreinte",

  // Preuve
  audit_trail: "Audit trail cryptographique append-only",
  provenance: "Provenance tracée pour chaque chiffre",

  // Statuts honnêtes
  status_live: "Disponible aujourd'hui",
  status_beta: "Beta — en cours de stabilisation",
  status_planned: "Roadmap — dates indicatives",
} as const;
```

- [ ] Commit : `feat(content): grille tarifaire unifiée + lexique safe (0.8, 0.9)`

**DoD** : grille tarifaire cohérente sur toutes les pages, `claims-dictionary.ts` créé et importable.

---

## Jour 5 (vendredi S1) — Page `/couverture` (0.10)

**Objectif** : Créer la Coverage Matrix ESRS publique.

### Tâches

- [ ] Créer `apps/carbon/app/couverture/page.tsx`
- [ ] Structure :
  - Hero : "Ce que CarbonCo couvre vraiment"
  - Tableau avec colonnes : Standard / Description / Statut / Export / Preuves
  - Statuts : 🟢 Live / 🟡 Beta / ⚪ Planned
- [ ] Lignes du tableau (minimum 12) :
  - ESRS E1 Climate → 🟢 Live → PDF/Excel
  - ESRS E2 Pollution → 🟡 Beta
  - ESRS E3 Water → ⚪ Planned
  - ESRS E4 Biodiversité → ⚪ Planned
  - ESRS E5 Circular → ⚪ Planned
  - ESRS S1 Workforce → 🟡 Beta
  - ESRS S2 Value chain workers → ⚪ Planned
  - ESRS S3 Communities → ⚪ Planned
  - ESRS S4 Consumers → ⚪ Planned
  - ESRS G1 Conduct → 🟢 Live
  - ESRS 1 (général) → 🟢 Live
  - ESRS 2 (gouvernance + double matérialité) → 🟢 Live
- [ ] Design : sobre, tableau responsive, pas d'animations excessives
- [ ] Lien depuis le footer + menu principal
- [ ] Commit : `feat(site): page /couverture Coverage Matrix ESRS (0.10)`

**DoD** : page accessible à `/couverture`, tableau avec 12 ESRS affichés, 3 statuts distincts visibles.

---

## Jour 6 (lundi S2) — Page `/etat-du-produit` (0.11)

**Objectif** : Page anti-objection "Ce que CarbonCo fait aujourd'hui".

### Tâches

- [ ] Créer `apps/carbon/app/etat-du-produit/page.tsx`
- [ ] Structure en 3 sections :

**🟢 Live — Disponible aujourd'hui**
- Upload workbook Excel + validation
- Calcul scope 1/2/3 via méthodologie CarbonCo
- Dashboard interactif + KPI provenance
- Export PDF + Excel + audit trail
- Double matérialité ESRS 2
- Copilote IA avec citations ESRS

**🟡 Beta — En cours de stabilisation**
- Questionnaire fournisseurs scope 3
- Snapshot comparison multi-exercices
- Workflow validation "proposé → figé"
- Data Quality Center

**⚪ Planned — Roadmap**
- Connecteurs ERP natifs (SAP, Oracle, Sage, Cegid)
- Export iXBRL ESRS
- Signature électronique qualifiée eIDAS
- OCR factures énergie automatisé
- Certifications SOC 2 / SecNumCloud
- Benchmarks anonymisés inter-clients

- [ ] Pour chaque item : description ≥20 mots honnête
- [ ] Lien depuis footer
- [ ] Commit : `feat(site): page /etat-du-produit Live/Beta/Planned (0.11)`

**DoD** : page accessible, 3 sections complètes, chaque item ≥20 mots.

---

## Jour 7 (mardi S2) — Audit faux succès silencieux (0.12)

**Objectif** : Identifier toutes les pages qui affichent du contenu fictif au lieu d'erreurs.

### Tâches

- [ ] Grep systématique :
  - [ ] `grep -rn "fallback\|mock\|placeholder\|sample\|demo-data\|fake" apps/carbon/`
- [ ] Lister chaque occurrence dans un nouveau fichier `FAKE_SUCCESS_AUDIT.md`
- [ ] Pour chaque occurrence, classer :
  - 🟢 OK (dev-only, jamais en prod)
  - 🔴 À CORRIGER (apparaît en prod quand données absentes)
- [ ] Parcourir manuellement les 13 pages maintenues (dashboard, scopes, esrs, copilot, reports, vsme, materialite, qc, ingest, audit, history, admin, upload) en mode "pas de données"
- [ ] Documenter chaque écran qui "ment" dans le fichier audit
- [ ] Commit : `docs: audit des faux succès silencieux (0.12)`

**DoD** : `FAKE_SUCCESS_AUDIT.md` liste ≥5 occurrences avec statut et action.

---

## Jour 8 (mercredi S2) — SmartEmptyState + corrections (0.13)

**Objectif** : Composant réutilisable d'état vide + correction des faux succès.

### Tâches

- [ ] Créer `apps/carbon/components/ui/smart-empty-state.tsx` :

```typescript
interface SmartEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  severity?: "info" | "warning" | "error";
}
```

- [ ] Design : card centrée avec icône, titre, description, CTA
- [ ] Variantes : info (bleu), warning (orange), error (rouge)
- [ ] Corriger chaque entrée de `FAKE_SUCCESS_AUDIT.md` :
  - Remplacer les mocks/fallbacks par `<SmartEmptyState>`
  - Proposer une action contextuelle (ex: "Uploader un fichier", "Connecter une source")
- [ ] Test local : naviguer sur toutes les pages sans données, vérifier affichage
- [ ] Commit : `feat(ui): SmartEmptyState + correction des faux succès silencieux (0.13)`

**DoD** : composant créé, 0 occurrence de mock/fallback en condition "pas de données" sur les 13 pages maintenues.

---

## Jour 9 (jeudi S2) — Archivage pages hors wedge + design tokens (0.14, 0.15)

**Objectif** : Réduire la surface maintenue + exposer les tokens en TypeScript.

### Tâches

- [ ] **0.14** : Créer dossier `apps/carbon/app/_archived/`
- [ ] Déplacer les pages hors wedge :
  - [ ] `(app)/finance/` → `_archived/finance/` (Pilier 2 hors scope)
  - [ ] `(app)/social/` → `_archived/social/` (ESRS S hors scope E1)
  - [ ] `(app)/dpp/` → `_archived/dpp/` (Digital Product Passport hors CSRD)
  - [ ] `(app)/insights/adhesion-volontaire/` → `_archived/insights-adhesion/`
  - [ ] `value-mapping-esg/` → `_archived/value-mapping-esg/`
- [ ] Créer `_archived/README.md` expliquant la mise en pause et la possibilité de réactivation
- [ ] Retirer les liens vers ces pages dans le menu sidebar
- [ ] Vérifier qu'aucun import cassé : `npm run build`
- [ ] **0.15** : Créer `apps/carbon/lib/design-tokens.ts` :

```typescript
// Extraction depuis globals.css pour usage React
export const brandColors = {
  forest: "#14532D",
  emerald: "#059669",
  emeraldLight: "#34D399",
  slate: "#0F172A",
  navy: "#1E293B",
  white: "#FFFFFF",
  mist: "#F0FDF4",
} as const;

export const statusColors = {
  success: "#059669",
  successBg: "#ECFDF5",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  danger: "#DC2626",
  dangerBg: "#FEF2F2",
} as const;

export const radii = {
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  "2xl": "1.5rem",
  full: "9999px",
} as const;
```

- [ ] Commit : `refactor(app): archivage pages hors wedge + design tokens TS (0.14, 0.15)`

**DoD** : `npm run build` passe, dossier `_archived/` en place, `design-tokens.ts` importable.

---

## Jour 10 (vendredi S2) — Tests E2E + déploiement (0.16, 0.17)

**Objectif** : Tests verts + site V2 en production.

### Tâches

- [ ] **0.16** : Écrire tests E2E Playwright :
  - [ ] `apps/carbon/e2e/tests/phase-0.spec.ts`
  - [ ] Test 1 : homepage se charge, 0 mention interdite (grep réponse HTML)
  - [ ] Test 2 : `/couverture` accessible, tableau visible
  - [ ] Test 3 : `/etat-du-produit` accessible, 3 sections visibles
  - [ ] Test 4 : pages `_archived/` retournent 404
  - [ ] Test 5 : footer contient liens vers `/couverture` et `/etat-du-produit`
- [ ] Lancer tests en local : `cd apps/carbon && npm run e2e`
- [ ] Corriger les failures éventuelles
- [ ] **0.17** : Déploiement preview
  - [ ] `git push origin refonte-90j`
  - [ ] Ouvrir l'URL preview Vercel
  - [ ] Parcourir manuellement le site complet
  - [ ] Valider visuellement toutes les pages
  - [ ] Vérifier que 0 régression visible
- [ ] Merge vers master :
  - [ ] Créer PR `refonte-90j` → `master` intitulée `feat(phase-0): alignement discours/réalité`
  - [ ] Review solo (relire la diff)
  - [ ] Merge
  - [ ] Déploiement prod automatique Vercel
- [ ] Vérification prod :
  - [ ] `/couverture` en ligne ✓
  - [ ] `/etat-du-produit` en ligne ✓
  - [ ] 0 logo client non contractualisé ✓
  - [ ] 0 mention interdite (grep sur la HTML prod) ✓
- [ ] Revue de sprint (1h) :
  - [ ] DoD Phase 0 validée ?
  - [ ] Jalon atteint ?
  - [ ] Retour d'expérience dans `SPRINT_LOG.md`
- [ ] **🎉 Jalon atteint : Site V2 honnête en production**

**DoD** : tests E2E verts, site V2 déployé en prod, checklist DoD Phase 0 complète.

---

## Checklist finale Phase 0

### Définition du "done" à valider avant de passer au Sprint 2

- [ ] 0 logo client non contractualisé visible en prod
- [ ] 0 mention "OVH HDS / hébergement souverain"
- [ ] 0 mention "12 ESRS natifs"
- [ ] 0 mention "SAP/Oracle en 2 jours"
- [ ] 0 mention "SLA 99,9%"
- [ ] 3 scénarios sectoriels anonymisés affichés
- [ ] Grille tarifaire unique cohérente sur toutes les pages
- [ ] `claims-dictionary.ts` créé et utilisé dans ≥2 composants
- [ ] Page `/couverture` avec ≥12 ESRS et 3 statuts
- [ ] Page `/etat-du-produit` avec 3 sections complètes
- [ ] `FAKE_SUCCESS_AUDIT.md` rempli
- [ ] Composant `<SmartEmptyState>` créé
- [ ] 0 occurrence de mock/fallback dans les 13 pages maintenues
- [ ] Dossier `_archived/` avec README, 5 modules archivés
- [ ] `lib/design-tokens.ts` exporté et utilisé
- [ ] Tests E2E Phase 0 tous verts en CI
- [ ] Branche mergée sur master
- [ ] Déploiement prod effectué et validé
- [ ] `SPRINT_LOG.md` à jour
- [ ] `BACKLOG_POST_90J.md` contient les items reportés
- [ ] 1 jour off pris pendant le sprint

---

## Ressources

- **Plan global** : `PLAN_REFONTE_90J.md`
- **Log quotidien** : `SPRINT_LOG.md`
- **Backlog** : `BACKLOG_POST_90J.md`
- **Audit claims** : `CLAIMS_AUDIT.md` (créé jour 1)
- **Audit faux succès** : `FAKE_SUCCESS_AUDIT.md` (créé jour 7)

---

**Après Sprint 1** : Passer à `SPRINT_2_CHECKLIST.md` (à générer quand Sprint 1 validé).
