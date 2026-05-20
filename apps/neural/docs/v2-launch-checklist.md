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
- [x] `npm run test` — 165 tests verts
- [x] `npm run qa:copy` — vert
- [x] `npm run build` — compile, `/produit` et `/ressources` statiques
- [ ] Preview Vercel validée visuellement (navbar, footer, homepage, hubs, mobile)
- [ ] Lighthouse a11y/perf homepage ≥ baseline V1
- [ ] Suivre 3 redirects archivés en preview → 200 final
- [ ] Search Console : surveillance J+7 et J+14 post-déploiement (action ops)

## Dette technique tracée (post-V2)

- ✅ PR 7 : les 6 pages secteur principales (luxe, banque, assurance,
  transport, aeronautique, saas) intègrent `CoverageGridFiltered`.
- ✅ PR 8 : les 7 pages branches `/solutions/[slug]` intègrent
  `CoverageGridFiltered` via la prop `coverageBranch` de `ReadinessPage`.
- 12 agents catalog-only à promouvoir dans `AGENT_ENTRIES` (cf.
  `KNOWN_CATALOG_ONLY_AGENTS` dans `tests/branch-catalogs-consistency.test.ts`).
- 5 agents Banque × Communication dans `KNOWN_STATUS_DIVERGENCES` — le module
  `lib/proof-status.ts` modélise désormais leur statut multidimensionnel, mais
  les 3 sources brutes restent à aligner (ou la divergence à assumer
  explicitement par convention).
- ✅ PR 9 : `ProofBadge` branché sur `/proof` (Proof Console) — palette
  alignée, badges ad-hoc + map `STATUS_CLASSES` locale supprimés.
- ✅ PR 10 : `agent-card.tsx` n'avait pas de badge de statut ad-hoc (juste
  un chip "Score N", distinct) ; le champ mort `EnrichedAgent.proof.statusLabel`
  (calculé mais jamais rendu) a été supprimé. Plus aucun badge proof ad-hoc.
- `/secteurs/[slug]` (fallback dynamique) non migré : route inerte tant que
  les 6 secteurs ont une page explicite, priorité basse.

## Rollback

Le flag `neuralV2` ayant été retiré, un rollback nécessite un `git revert` des
commits PR 6 (puis éventuellement PR 1-5). La V1 reste récupérable via
l'historique git tant que la branche n'est pas nettoyée.
