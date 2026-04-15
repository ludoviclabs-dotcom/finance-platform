# Sprint Log — Refonte 90 jours

> Bilan quotidien court (3 lignes) pour tracer l'avancement.
> Format : date / ce qui est livré / blocages.

---

## Sprint 1 — Phase 0 (Alignement)

### Semaine 1

#### Lundi — Jour 1 (2026-04-15)
- **Livré** : Tâche 0.1 — audit complet des claims (43 recensés : 28 à retirer, 14 à requalifier, 1 gardé). CLAIMS_AUDIT.md rempli. Setup branch refonte-90j + tag workbooks-baseline-v2025.0.
- **Blocages** : aucun
- **Demain** : Tâche 0.2 + 0.3 — retrait des 7 logos + 3 témoignages inventés, création des 3 scénarios sectoriels anonymisés dans data.ts

#### Mardi — Jour 2 (2026-04-15)
- **Livré** : Tâches 0.2 + 0.3 — Suppression des 7 logos fictifs + 3 témoignages inventés. Remplacement par 3 scénarios sectoriels anonymisés (Industrie / Services / Agroalimentaire) avec tag "Scénario illustratif". Suppression de toutes les stats non vérifiées (120+ clients, 87%, 4.8/5). Nettoyage complet OVH/HDS/SLA 99.9%/SecNumCloud dans la landing. Plan "Souverain" supprimé de data.ts. Features des 3 plans requalifiées. Risque juridique immédiat éliminé.
- **Blocages** : aucun
- **Demain** : Tâches 0.4–0.6 — Audit hébergement/SLA dans autres fichiers, requalification "12 ESRS natifs", lexique safe claims-dictionary.ts

#### Mercredi — Jour 3 (2026-04-15)
- **Livré** : Tâches 0.4–0.9 — Nettoyage complet de tous les fichiers restants (login-screen, layout.tsx, opengraph-image, confidentialite, cgu). Suppression dernières mentions souverain/OVH/HDS/99.9%/120+ partout. Grille tarifaire pricing-page.tsx alignée (4→3 colonnes). Création `claims-dictionary.ts` — lexique safe réutilisable pour tout le code UI. Grep de vérification finale : 0 mention interdite dans tout le codebase.
- **Blocages** : aucun
- **Demain** : Tâches 0.10–0.11 — Pages `/couverture-esrs` et `/etat-du-produit` (transparence niveau de complétude réel)

#### Jeudi — Jour 4 (2026-04-15)
- **Livré** : Tâches 0.10–0.11 — Page `/couverture` (Coverage Matrix 12 ESRS, 3 statuts Live/Beta/Planifié) et page `/etat-du-produit` (9 Live, 5 Beta, 8 Planned — chaque item ≥20 mots honnêtes). Liens dans le footer. Correction "Hébergé en France" → "Hébergé en EU". 
- **Blocages** : aucun
- **Demain** : Tâche 0.12 — Audit faux succès silencieux (grep fallback/mock/placeholder dans tout l'app)

#### Vendredi — Jour 5 (2026-04-15)
- **Livré** : Tâche 0.12 — Audit faux succès silencieux complet. 3 corrigés (dashboard, scopes, esrs — bandeau "Données de démonstration" avec lien vers import). 8 faux positifs légitimes identifiés. 2 éléments à surveiller en Phase 2 (ESG score 62, benchmark sectoriel). FAKE_SUCCESS_AUDIT.md créé.
- **Blocages** : aucun
- **Demain** : Tâches 0.13–0.14 — SmartEmptyState component + archivage pages hors-wedge (DPP, Social)

### Semaine 2

#### Lundi — Jour 6 (2026-04-15)
- **Livré** : Tâches 0.13–0.15 — SmartEmptyState (3 variantes, compact/full, CTA). design-tokens.ts (source de vérité TS brandColors/statusColors/scopeColors/radii/shadows). Archivage social/dpp/finance → _archived/ (Next.js ignore _). Liens retirés du sidebar. npm run build ✅.
- **Blocages** : aucun
- **Demain** : Tâches 0.16–0.17 — Tests E2E Phase 0 + déploiement prod (push refonte-90j, vérification Vercel)

#### Mardi — Jour 7
- **Livré** : Tâche 0.16 — Tests E2E Phase 0 Playwright (13 tests, 5 suites) : homepage 0 mentions interdites, /couverture ≥12 lignes ESRS, /etat-du-produit 3 sections, pages archivées 404, footer liens transparence. 13/13 ✅ en local.
- **Blocages** : aucun
- **Demain** : Tâche 0.17 — Déploiement prod : push refonte-90j, PR refonte-90j → master, merge, vérification Vercel

#### Mercredi — Jour 8
- **Livré** :
- **Blocages** :
- **Demain** :

#### Jeudi — Jour 9
- **Livré** :
- **Blocages** :
- **Demain** :

#### Vendredi — Jour 10
- **Livré** :
- **Blocages** :
- **Demain** :

### Revue de Sprint 1

- **DoD Phase 0 validée** : ☐ Oui ☐ Non
- **Jalon atteint** (site V2 honnête en prod) : ☐ Oui ☐ Non
- **Tâches reportées au Sprint suivant** :
- **Leçons apprises** :
- **Ajustements pour Sprint 2** :

---

## Sprint 2 — Phase 1 (Couche preuve backend)

_À remplir au démarrage du sprint._

---

## Sprint 3 — Phase 2 (Couche preuve frontend)

_À remplir au démarrage du sprint._

---

## Sprint 4 — Phase 3 (Workflow & export)

_À remplir au démarrage du sprint._

---

## Sprint 5 — Phase 4 (Wedge différenciant)

_À remplir au démarrage du sprint._

---

## Sprint 6 — Phase 5 (Site & contenu)

_À remplir au démarrage du sprint._
