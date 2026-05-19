# Audit décisionnel des 32 routes top-level — Refonte NEURAL V2

## Contexte

L'audit V2 (`Analyse_audit_NEURAL_V2.md`) demande une navigation primaire à 6 entrées (Produit · Preuves · Secteurs · Ressources · À propos · Contact). Le site expose aujourd'hui 32 routes top-level dans `apps/neural/app/`. Cet audit assigne **une décision par route** avant la mise en production de `lib/navigation.ts`.

## Légende des décisions

- **PRIMARY NAV** — entrée directe dans la nav primaire à 6 items
- **NAV CHILD** — enfant d'un dropdown primaire
- **FOOTER** — accessible uniquement via footer (ou hub étendu)
- **HUB CHILD** — accessible via une page hub (PR 3 finalisera les hubs)
- **GATED (flag)** — déjà masqué derrière un `features.ts` flag, statu quo
- **ARCHIVE** — redirect 308 vers la cible la plus proche

Aucune route n'est supprimée sans redirect. Les routes déjà gated derrière `isFeatureOn(...)` restent en l'état (la refonte ne réactive pas ce qui était volontairement masqué).

## Règles de décision par défaut

1. Volume Search Console < 50 visites/mois + duplicate content avec une route conservée → ARCHIVE (308)
2. Volume Search Console ≥ 50 visites/mois → ARCHIVE (307) le temps d'observer, puis 308 à J+30
3. Page gated derrière feature flag → statu quo, hors scope refonte
4. Page < 60 lignes + composant principal nul/vide → candidate à ARCHIVE

L'analyse Search Console n'est pas accessible dans ce contexte ; les décisions ci-dessous se basent sur la taille du fichier et le rôle qualitatif de la page. Toute décision ARCHIVE doit être confirmée par un coup d'œil Search Console avant merge final (PR 6).

## Tableau de décision

| Route | Lignes | Décision | Cible / parent | Justification |
|---|---|---|---|---|
| `/` | 38 | PRIMARY NAV (implicite) | Homepage | Refactorée en PR 2 |
| `/about` | 15 | **PRIMARY NAV** | À propos | 1 des 6 items |
| `/agents` | 92 | NAV CHILD | Produit → Catalogue agents | Catalogue lisible, mérite découverte |
| `/cas-types` | 117 | NAV CHILD | Ressources → Cas-types | Hub Ressources V2 explicite |
| `/changelog` | 127 | FOOTER | Trust / Transparence | Historique technique, pas primaire |
| `/conformite` | 122 | NAV CHILD | Preuves → Conformité (sous Trust) | Trust Center, pertinent acheteur régulé |
| `/connecteurs` | 67 | NAV CHILD | Produit → Connecteurs | V2 doc §2 explicite |
| `/contact` | 218 | **PRIMARY NAV** | Contact (CTA) | 1 des 6 items, CTA bouton |
| `/contre` | 185 | FOOTER | Ressources → Comparatifs | Argumentaire commercial, utile mais pas primaire |
| `/dev` | 134 | FOOTER | Ressources → Developer | Surface niche, audience technique |
| `/docs` | 114 | NAV CHILD | Ressources → Documentation | V2 doc §2 explicite |
| `/dossier` | 214 | NAV CHILD | Preuves → Dossier de preuve | V2 doc §10 ; renommage UI seul, route inchangée |
| `/forfaits` | 130 | **GATED (flag `forfaits`)** | — | Déjà masqué, statu quo |
| `/glossaire` | 42 | NAV CHILD | Ressources → Glossaire IA | V2 doc §2 explicite |
| `/legal` | 80 | FOOTER | Footer Entreprise | Mentions légales |
| `/marketplace` | 15 | **GATED (flag `marketplace`)** | — | Déjà masqué, statu quo |
| `/newsletter` | 145 | FOOTER | Footer Entreprise | Engagement, pas primaire |
| `/operator-gateway` | 339 | NAV CHILD | Produit → Operator Gateway | V2 doc §2 explicite |
| `/outils` | 176 | NAV CHILD | Ressources → Outils gratuits | Hub Ressources V2 |
| `/presse` | 316 | FOOTER | Footer Entreprise | Presse, pas primaire |
| `/proof` | 383 | **NAV CHILD (primaire de "Preuves")** | Preuves → Console de preuve | V2 doc §13 ; renommage UI seul, route `/proof` conservée |
| `/publications` | 35 | NAV CHILD | Ressources → Publications | V2 doc §10 ; sortie du top-level |
| `/recipes` | 42 | NAV CHILD | Ressources → Recipes | Hub Ressources V2 |
| `/resources` | 56 | **GATED (flag `resources`)** | — | Déjà masqué, statu quo. Sera réactivé en PR 3 comme hub Ressources (potentiellement renommé /ressources) |
| `/roadmap` | 112 | NAV CHILD | Preuves → Roadmap | Hub Preuves V2 |
| `/sandbox` | 166 | NAV CHILD | Ressources → Sandbox | Hub Ressources V2 |
| `/secteurs` | 93 | **PRIMARY NAV** | Secteurs | 1 des 6 items, dropdown 6 secteurs |
| `/simulation` | 201 | NAV CHILD | Produit → Simulation Studio | Démo interactive, naturellement Produit |
| `/solutions` | 40 | NAV CHILD | Produit → Branches métier | Distinction Secteurs (industrie) vs Solutions (fonction) documentée dans V2 doc §1 |
| `/status` | 201 | NAV CHILD | Preuves → Status | Hub Preuves V2 |
| `/temoignages` | 84 | FOOTER | Footer Entreprise | Témoignages, retiré du top-level (V1 retirait déjà SectionTestimonials du rendu cf. `app/page.tsx:13-15`) |
| `/trust` | 495 | NAV CHILD | Preuves → Trust Center | Hub Preuves V2 ; route conservée, exposée comme enfant |

## Synthèse par destination

### Primary nav (6 entrées exactes)
1. **Produit** → href `/produit` (page créée en PR 3) ; children : Catalogue agents, Operator Gateway, Connecteurs, Simulation, Branches métier
2. **Preuves** → href `/proof` ; children : Console de preuve, Dossier de preuve, Trust Center, Status, Roadmap, Conformité
3. **Secteurs** → href `/secteurs` ; children : Luxe, Banque, Assurance, Transport, Aéronautique, SaaS (lus depuis `SECTOR_ENTRIES`)
4. **Ressources** → href `/ressources` (= `/resources` réactivée en PR 3) ; children : Documentation, Publications, Glossaire, Outils, Cas-types, Recipes, Sandbox
5. **À propos** → href `/about`
6. **Contact** → href `/contact` (CTA bouton, dernier item)

### Footer (5 colonnes, après réduction par hubs)
1. Produit : Agent Pack, Operator Gateway, Connecteurs, Démo live
2. Preuves : Console de preuve, Dossier, Trust Center, Status, Roadmap, Changelog
3. Secteurs : Luxe, Banque, Assurance, Transport, Aéronautique, SaaS
4. Ressources : Documentation, Publications, Glossaire, Outils, Comparatifs, Developer
5. Entreprise : À propos, Témoignages, Presse, Newsletter, Contact, Mentions légales

### Routes gated (statu quo)
- `/marketplace` (flag `marketplace`)
- `/forfaits` (flag `forfaits`)
- `/resources` (flag `resources`, sera réactivé comme hub Ressources en PR 3)

### Routes à redirection 308 (aucune en PR 1)
Aucune route n'est archivée en PR 1. Les renommages "Proof Console → Console de preuve", "Dossier → Dossier de preuve", "Audit gratuit → Cadrage offert" sont des changements UI **sans changement d'URL**, donc sans besoin de redirect.

Le hub Ressources sera réactivé en PR 3 ; s'il prend le slug `/ressources` (français), un redirect `/resources → /ressources` (308) sera ajouté à `next.config.ts` à ce moment-là. Hors scope PR 1.

## Risques et mitigation

| Risque | Mitigation |
|---|---|
| Une route archivée a du trafic non-nul | Aucune route archivée en PR 1, donc pas de risque. Les renommages UI n'affectent pas les URLs. |
| Liens internes vers `/publications` ou `/dossier` cassent | Routes conservées, seul leur label dans la nav change. Les liens internes ne sont pas affectés. |
| Feature flag `neuralV2` oublié, V2 active par défaut | Default `false` côté `features.ts`. Navbar/Footer V1 restent actifs jusqu'à PR 6. |
| `/resources` (déjà gated) confondue avec future `/ressources` | Décision : garder `/resources` gated jusqu'à PR 3 ; le slug final (FR vs EN) est tranché à ce moment-là, avec redirect 308 si besoin. |

## Décisions reportées à PR 3

- Slug final du hub Ressources : `/ressources` (FR) ou `/resources` (EN actuelle). Décision : aligner sur la convention FR du reste du site → `/ressources`, avec 308 depuis `/resources`.
- Création de `/produit` (n'existe pas aujourd'hui).
- Refonte `/trust` pour qu'il devienne un vrai Trust Center hub (rassemblant `/conformite`, `/status`, `/roadmap`, `/changelog`).

Ces décisions ne bloquent pas PR 1 : la nav V2 pointe d'ores et déjà vers les routes cibles, même si certaines (comme `/produit`) renvoient un 404 tant que PR 3 n'est pas mergée. Le feature flag `neuralV2` permet de tenir cet état transitoire en preview sans impact production.
