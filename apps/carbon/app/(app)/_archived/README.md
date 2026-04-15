# Pages archivées — Hors wedge Sprint 1

Ces pages ont été mises en pause lors du Sprint 1 (Phase 0) de la refonte 90j.
Elles sont fonctionnelles mais **ne sont plus accessibles depuis le menu**.

Next.js ignore les dossiers commençant par `_` — ces routes ne sont donc pas exposées.

## Pages archivées

| Dossier | Route était | Raison de mise en pause |
|---|---|---|
| `social/` | `/social` | ESRS S1-S4 hors wedge E1 — réactivable quand demande client |
| `dpp/` | `/dpp` | Digital Product Passport (ESPR) — marché pas encore mature |
| `finance/` | `/finance` | Pilier finance durable — hors scope CSRD fournisseurs Phase 0 |

## Réactivation

Pour réactiver une page :
1. Déplacer le dossier hors de `_archived/` vers `(app)/`
2. Ré-ajouter l'entrée dans `components/layout/sidebar.tsx`
3. Tester le build : `npm run build`

## Items backlog associés

Voir [BACKLOG_POST_90J.md](/BACKLOG_POST_90J.md) :
- Catégorie 4 — Modules ESRS complémentaires (Social S1-S4)
- Catégorie 1 — DPP (si marché ESPR porteur)
