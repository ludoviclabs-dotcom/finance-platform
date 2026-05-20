# Refonte NEURAL V2 — Checklist de lancement

## Contexte

La refonte V2 a été livrée en 7 PR internes (commits) sur la branche
`claude/review-neural-project-r91jp`. PR 6 retire le feature flag `neuralV2` :
la V2 est désormais le **comportement par défaut**, la V1 est supprimée.

## Ce qui a changé (PR 0 → PR 6)

| PR | Livraison |
|----|-----------|
| PR 0 | Hygiène copy : 4 typos corrigées, "Audit gratuit" → "Cadrage offert" |
| PR 1 | Nav V2 (6 entrées), `lib/navigation.ts`, StatusChip, test pivot cohérence inter-sources |
| PR 2 | Homepage V2 (8 sections), CoverageGrid unique lu depuis le registry |
| PR 3 | Hubs `/produit`, `/ressources`, Trust Center enrichi, redirect `/resources` → `/ressources` |
| PR 4 | `CoverageGridFiltered`, test cross-catalogues, démo migration page Luxe |
| PR 5 | `lib/proof-status.ts` unifié, composant `ProofBadge` |
| PR 6 | Retrait du flag `neuralV2`, suppression V1, sitemap, cette checklist |

## État final

### Navigation
- 6 entrées : Produit · Preuves · Secteurs · Ressources · À propos · Contact
- Source unique : `lib/navigation.ts` (`NAV_V2`, `FOOTER_V2`)
- Footer : 5 colonnes hiérarchisées

### Homepage
- 8 sections (vs 13 en V1)
- Une seule matrice de couverture (`CoverageGrid`), lue depuis `agents-registry.ts`
- Hero : 2 CTA

### Composants supprimés (V1)
- `components/layout/navbar.tsx` / `footer.tsx` V1 → remplacés par les V2 renommés
- `components/homepage/` : hero-unified, section-branches, section-matrix,
  section-problem, section-orchestration, section-sectors, section-resources
- `app/resources/page.tsx` (hub remplacé par `/ressources`)
- `lib/public-catalog.ts` : `NAVIGATION`, `NAVIGATION_SECONDARY`, `FOOTER_LINKS`
- `lib/features.ts` : flag `neuralV2`

### Routes
- Nouvelles : `/produit`, `/ressources`
- Redirect 308 : `/resources` → `/ressources`
- Conservée : `/resources/[...slug]` (alias actif `/resources/blog/*` → `/publications/*`)

## Checklist avant déploiement production

- [x] `npm run lint` — vert
- [x] `npm run typecheck` — vert
- [x] `npm run test` — 166 tests verts
- [x] `npm run qa:copy` — vert
- [x] `npm run build` — compile, `/produit` et `/ressources` statiques
- [x] Validation visuelle locale — 2026-05-20 (navbar, footer, homepage, hubs, mobile) ; 2 bugs corrigés, cf. section ci-dessous
- [x] Lighthouse — **a11y 96/100** ; perf mesurée sur preview Vercel le 2026-05-20 (LCP 706 ms, CLS 0). Les 39 nœuds `color-contrast` pré-existants corrigés, cf. « Cleanup a11y » ci-dessous
- [x] Redirects vérifiés (local) — `/resources` → 308 → `/ressources` (200) ; `/resources/blog/*` → 307 → `/publications/*` (200)
- [ ] Search Console : surveillance J+7 (2026-05-27) et J+14 (2026-06-03) post-déploiement — rappels planifiés (action ops)

## Validation visuelle — 2026-05-20

Branche `review-neural-project-r91jp` (PR 11) sortie en worktree, `next dev`,
parcours desktop (1440×900) et mobile (≤500 px) sur Chrome.

### Bugs trouvés et corrigés

- **CoverageGrid invisible (homepage).** `SectionCoverageExplorer` place `CoverageGrid`
  — composant conçu pour fond sombre (texte blanc, `bg-white/[0.02]`) — dans la section
  claire `.nhp-branches` (`#FAF8F5`). Libellés d'axes (`<th>`), légende et boutons de
  filtre rendus blanc sur clair, donc invisibles. *Correctif :* `.nhp-branches` passée
  en thème sombre dans `homepage.css`.
- **Menu mobile tronqué.** Le panneau de nav mobile (`navbar.tsx`) était plafonné à
  `max-height: 640px` + `overflow: hidden` ; le contenu de la nav V2 mesure 1167 px.
  « Ressources », « À propos » et le CTA « Contact » étaient inaccessibles.
  *Correctif :* panneau scrollable, hauteur bornée au viewport (`calc(100dvh - 4rem)`).
- **Hero — espace manquant.** « 7/42combinaisons » → « 7/42 combinaisons » (`hero.tsx`).

### Copy corrigée

- `section-coverage-explorer.tsx` : « Plus deux représentations divergentes »
  → « Fini les représentations divergentes ».
- `proof-catalog.ts` : « Excel cree » / « Workbook cree » → « Excel créé » /
  « Workbook créé ».

### Lighthouse — homepage

- **Accessibilité : 96/100** (build prod local). Seul audit en échec :
  `color-contrast`. Les 2 contrastes introduits par le passage en thème sombre
  ont été corrigés (eyebrow `.eyebrow-violet`, en-tête CoverageGrid
  `text-white/55`). Les 39 nœuds pré-existants ont depuis été corrigés —
  cf. « Cleanup a11y » ci-dessous.
- **Performance : mesurée sur preview Vercel le 2026-05-20** — LCP 706 ms,
  CLS 0, TTFB 17 ms (desktop, sans throttling). Le LCP ~5 s observé en local
  était un artefact de charge machine. SEO 63/100 sur la preview : les
  2 échecs (`x-robots-tag: noindex`, manifest 401) sont des artefacts de la
  protection preview Vercel, absents du domaine de production.

### Cleanup a11y — 2026-05-20

Les 39 nœuds `color-contrast` pré-existants (homepage) corrigés pour franchir
le seuil WCAG AA 4.5:1 :

- **Liens de footer** (`footer.tsx`) — `text-gray-500` → `text-gray-400`
  (liens) et `text-gray-600` → `text-gray-400` (copyright).
- **Sous-labels proof-levels** (`homepage.css`, `.nhp-proof-level`) —
  `rgba(10,22,40,0.52)` → `0.65`.
- **Prix** (`homepage.css`, `.nhp-tp-from` / `.nhp-tp-u` /
  `.nhp-tier-price-to`) — `opacity: 0.55` → `0.65`.

## Dette technique tracée (post-V2)

- ✅ PR 7 : les 6 pages secteur principales (luxe, banque, assurance,
  transport, aeronautique, saas) intègrent `CoverageGridFiltered`.
- ✅ PR 8 : les 7 pages branches `/solutions/[slug]` intègrent
  `CoverageGridFiltered` via la prop `coverageBranch` de `ReadinessPage`.
- ✅ PR 11 : les 12 agents Marketing (Aéro / Banque / Assurance) promus dans
  `AGENT_ENTRIES` avec statut conservateur `planned` / `content_only`
  (score de preuve 0). `KNOWN_CATALOG_ONLY_AGENTS` est désormais vide.
- ✅ Post-V2 (2026-05-20) : les 12 agents Marketing ajoutés dans
  `content/agents-meta.json` — ils apparaissent désormais dans le catalogue
  filtrable `/agents`. Classification AI Act : `limite` pour les 12 (motif
  art. 50, contenu marketing IA-généré / audité), cohérente avec les agents
  Communication existants. `deployTime` / `roiEstimate` sont des estimations
  à faire valider par NEURAL.
- ✅ Post-V2 (2026-05-20) : divergence Banque × Communication assumée par
  convention. Les 3 sources mesurent 3 choses distinctes (data source / démo
  publique / preuve d'export) et ne sont pas alignables sans mentir sur l'une
  d'elles ; `lib/proof-status.ts` (PR 5) les compose canoniquement.
  `sources-consistency.test.ts` documente le motif et vérifie via
  `getUnifiedStatus` que la couche canonique résout chaque divergence réelle
  (`reg-bank-comms`, `bank-evidence-guard`).
- ✅ PR 9 : `ProofBadge` branché sur `/proof` (Proof Console) — palette
  alignée, badges ad-hoc + map `STATUS_CLASSES` locale supprimés.
- ✅ PR 10 : `agent-card.tsx` n'avait pas de badge de statut ad-hoc (juste
  un chip "Score N", distinct) ; le champ mort `EnrichedAgent.proof.statusLabel`
  (calculé mais jamais rendu) a été supprimé. Plus aucun badge proof ad-hoc.
- ✅ Post-V2 (2026-05-20) : `/secteurs/[slug]` (fallback dynamique) migré —
  `ReadinessPage` reçoit une prop `coverageSector` qui rend
  `CoverageGridFiltered`, en miroir de `coverageBranch` (`/solutions/[slug]`).

## Rollback

Le flag `neuralV2` ayant été retiré, un rollback nécessite un `git revert` des
commits PR 6 (puis éventuellement PR 1-5). La V1 reste récupérable via
l'historique git tant que la branche n'est pas nettoyée.
