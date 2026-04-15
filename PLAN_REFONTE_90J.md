# CarbonCo — Plan de refonte 90 jours

> Document de référence pour la refonte produit, technique, visuelle et contenu
> de CarbonCo sur 12 semaines, en configuration solo full-time, outils gratuits,
> architecture hybride Excel-as-engine + couche de preuve DB.
>
> **Version** : 1.0 — 2026-04-15
> **Auteur** : Ludovic L. + audit de faisabilité 360°
> **Horizon** : 12 semaines calendaires / ~65 jours ouvrés / ~400 heures productives

---

## 0. Résumé exécutif

CarbonCo est un SaaS B2B de pilotage ESG/CSRD dont le discours commercial
est en avance de 12 mois sur la réalité produit. Ce plan consolide les
décisions prises à l'issue d'un audit 8 zones et définit le chemin de
refondation qui fera passer la note globale de **3,9/10 à 6,8–7,5/10**
sans recrutement et sans dépense externe significative.

### Transformation visée

| Axe | Avant | Après |
|---|---|---|
| Note globale | 3,9/10 | 6,8–7,5/10 |
| Positionnement | "Tout CSRD pour tous segments" | "Outil de preuve pour ETI fournisseurs grands comptes" |
| Discours produit | Promesses absolues non tenues | Machine à preuve auditable, vocabulaire vérifiable |
| Architecture | Excel parser → JSONB → UI | Excel engine + couche `facts_events` event-sourced + provenance visible |
| Surface maintenue | 20 pages dispersées | 13 pages focalisées sur le wedge |
| Site | Vaporware brillant | Trust-first, honnête, sandbox publique |

### Wedge produit unique

**ESRS E1 + Scope 1/2/3 + Double Matérialité + Export package signé + Audit trail**

Tout le reste est **Beta**, **Planned**, ou **hors scope 90 jours**.

### Segmentation cible

- **ICP primaire (85%)** : ETI 80–400M€ de CA, fournisseurs de grands comptes CSRD assujettis, tous secteurs
- **ICP opportuniste (15%)** : PME <40M€ en mode self-serve (captation passive)
- **Exclu** : Grands comptes >750M€ (besoin SecNumCloud + équipe sales)

---

## 1. Décisions structurantes

| # | Décision | Choix |
|---|---|---|
| V1 | iXBRL ESRS | **Reporté en roadmap** — export PDF + Excel structuré + audit trail dans scope 90j |
| V2 | Segmentation | ICP primaire ETI fournisseurs + ICP opportuniste PME, tous secteurs |
| V3 | Infrastructure | Rester Vercel/Neon, retrait total de "OVH HDS / souverain" |
| V4 | Moteur de calcul | Hybride Option C — Excel source de vérité, couche preuve DB par-dessus |
| V5 | Outils externes | Zéro coût récurrent — tous free tier |
| V6 | Domaine | `carbonco.fr` + sous-domaines `app./www./demo./docs./status./verify.` |

---

## 2. Périmètre

### ✅ Inclus

**Produit — durcissement du wedge**
- Couche `emission_factors` versionnée en DB (extraite du workbook)
- Couche `facts_events` append-only avec hash chaîne Merkle
- KPI Provenance Drawer systématique
- Data Quality Center (page dédiée)
- Workflow validation "proposé → revue → validé → figé" avec timeout 2h
- Snapshot comparison UX (diff, revert)
- Module Matérialité upgrade (366 lignes existantes)
- Supplier Data Collection (questionnaires scope 3 + token public)
- Copilote NEURAL recadré en RAG sourcé
- Export package ZIP (PDF + Excel + audit_trail.json + hash local)
- Mode "Vue OTI" (toggle audit)
- Cockpit Dashboard 4 questions
- Empty states intelligents + suppression faux succès silencieux
- Tests E2E wedge principal en CI

**Site & contenu**
- Refonte homepage + landing + `data.ts` (vocabulaire safe)
- Pages : `/couverture`, `/etat-du-produit`, `/integrations`, `/trust`, `/methodologie`
- Sandbox publique `/demo`
- 4 articles SEO fondateurs + 2 guides téléchargeables
- Newsletter veille CSRD hebdo
- Vidéo démo 90s
- Méthodologie publique (workbook téléchargeable CC-BY-NC-ND)

**Infrastructure & qualité**
- Retrait mentions interdites
- Row-Level Security Postgres
- PostHog + UptimeRobot + Vercel Blob + Upstash QStash

### ❌ Exclu

- iXBRL ESRS (roadmap)
- Migration infra souveraine OVH/Scaleway
- Réécriture moteur en Python natif
- Connecteurs ERP natifs
- Signature eIDAS qualifiée
- OCR factures automatisé
- Certifications SOC 2 / SecNumCloud
- Licences Ecoinvent / IEA
- Recrutement
- Démarche commerciale
- Rédaction juridique CGV/DPA

---

## 3. Prérequis globaux

| # | Prérequis | État | Action |
|---|---|---|---|
| P1 | Environnement local fonctionnel | ✅ | — |
| P2 | Branche `refonte-90j` | ❌ | `git checkout -b refonte-90j` |
| P3 | Tag baseline workbooks | ❌ | `git tag workbooks-baseline-v2025.0` |
| P4 | Design tokens TS | ❌ | Tâche 0.15 (Phase 0) |
| P5 | Compte PostHog | ❌ | Sprint 1 |
| P6 | Compte UptimeRobot | ❌ | Sprint 1 |
| P7 | Compte Resend | ❌ | Sprint 6 |
| P8 | Sous-domaines DNS Vercel | ❌ | Sprint 6 |

---

## 4. Phases & jalons

| Phase | Sprint | Semaines | Focus | Jours | Jalon |
|---|---|---|---|---|---|
| 0 — Alignement | S1 | 1–2 | Nettoyage claims + retrait promesses | ~10 | Site V2 honnête en prod |
| 1 — Couche preuve backend | S2 | 3–4 | `emission_factors` + `facts_events` + RLS | ~13 | Provenance backend opérationnelle |
| 2 — Couche preuve frontend | S3 | 5–6 | Provenance Drawer + DQC + Cockpit | ~16 | UI preuve visible |
| 3 — Workflow & export | S4 | 7–8 | Validation + Snapshot compare + Export signé | ~17 | Rapport auditable `/verify` |
| 4 — Wedge différenciant | S5 | 9–10 | Matérialité + Supplier + Copilote RAG | ~15 | 3 modules démontables |
| 5 — Site & contenu | S6 | 11–12 | Homepage + Sandbox + Academy + Méthodo | ~23 | Lead gen opérationnelle |

**Total** : ~94j phases + ~15j transverses = ~109 j-h solo

---

### Phase 0 — Alignement (Sprint 1)

| # | Tâche | Dép. | Effort | Fichiers |
|---|---|---|---|---|
| 0.1 | Audit claims → `CLAIMS_AUDIT.md` | P2 | 0,5 | `landing-page.tsx`, `data.ts` |
| 0.2 | Retirer logos non contractualisés | 0.1 | 0,2 | assets, `data.ts` |
| 0.3 | Scénarios sectoriels anonymisés (3) | 0.2 | 0,5 | `data.ts` |
| 0.4 | Retirer "OVH HDS / souverain" | 0.1 | 0,2 | `data.ts` |
| 0.5 | Requalifier "12 ESRS natifs" | 0.1 | 0,2 | `data.ts` |
| 0.6 | Retirer "SAP 2 jours" | 0.1 | 0,2 | `data.ts` |
| 0.7 | Retirer "SLA 99,9%" | 0.1 | 0,2 | `data.ts`, CGV |
| 0.8 | Unifier grille tarifaire | 0.1 | 0,5 | `data.ts`, `pricing` |
| 0.9 | `lib/claims-dictionary.ts` | 0.1 | 0,3 | nouveau |
| 0.10 | Page `/couverture` | 0.1 | 1,5 | nouveau |
| 0.11 | Page `/etat-du-produit` | 0.1 | 1 | nouveau |
| 0.12 | Audit faux succès silencieux | — | 1 | grep mocks |
| 0.13 | `<SmartEmptyState>` composant + intégration | 0.12 | 2 | pages (app)/* |
| 0.14 | Archiver pages hors wedge (`_archived/`) | — | 0,5 | structure |
| 0.15 | Export `lib/design-tokens.ts` | — | 0,5 | nouveau |
| 0.16 | Tests E2E Phase 0 | 0.10, 0.11 | 0,5 | `e2e/` |
| 0.17 | Déploiement preview → prod | tout | 0,5 | Vercel |

**Total : ~9,8 jours**

---

### Phase 1 — Couche de preuve backend (Sprint 2)

| # | Tâche | Dép. | Effort |
|---|---|---|---|
| 1.1 | Extraction `Facteurs_Emission` workbook → JSON | — | 0,5 |
| 1.2 | Migration `emission_factors` | P1 | 0,5 |
| 1.3 | Script `import_factors.py` v2025.0 | 1.1, 1.2 | 1,5 |
| 1.4 | Table `emission_factor_catalogs` | 1.2 | 0,3 |
| 1.5 | Migration `facts_events` (append-only + hash chain) | 1.2 | 0,5 |
| 1.6 | Index facts_events | 1.5 | 0,2 |
| 1.7 | Service `facts_service.py` (insert, hash, trail, verify) | 1.5 | 1,5 |
| 1.8 | Vue matérialisée `facts_current` | 1.5 | 0,3 |
| 1.9 | Adapter `carbon_service.py` → écrit facts | 1.7 | 2 |
| 1.10 | Idem `esg_service.py` + `finance_service.py` | 1.9 | 1 |
| 1.11 | Résolution `factor_id` auto lors write | 1.9 | 1 |
| 1.12 | RLS Postgres ENABLE | 1.5 | 1 |
| 1.13 | Policies RLS `app.current_company_id` | 1.12 | 0,5 |
| 1.14 | Middleware `SET LOCAL` | 1.13 | 0,5 |
| 1.15 | Tests isolation RLS | 1.14 | 0,5 |
| 1.16 | Endpoints `/facts/*`, `/factors/*` | 1.7, 1.8 | 1 |
| 1.17 | Migration hash `audit_events` | — | 0,5 |
| 1.18 | `audit_service.log_event()` hash chaîné | 1.17 | 0,5 |

**Total : ~13,3 jours**

---

### Phase 2 — Couche de preuve frontend (Sprint 3)

| # | Tâche | Dép. | Effort |
|---|---|---|---|
| 2.1 | `<KPIProvenanceDrawer>` (framer-motion) | 1.16 | 1,5 |
| 2.2 | Hook `useKpiProvenance` | 1.16 | 0,5 |
| 2.3 | Drawer sur dashboard KPIs | 2.1, 2.2 | 1,5 |
| 2.4 | Drawer sur scopes | 2.1 | 0,5 |
| 2.5 | Refonte Cockpit Dashboard 4 questions | — | 2 |
| 2.6 | Bloc progression reporting | 2.5 | 0,3 |
| 2.7 | Bloc qualité données (donut T1/T2/T3) | 2.5 | 0,5 |
| 2.8 | Upgrade `qc/page.tsx` → Data Quality Center | 1.16, 2.1 | 3 |
| 2.9 | DQC : tableau filtrable | 2.8 | 1,5 |
| 2.10 | DQC : suggestions correctives | 2.8 | 1 |
| 2.11 | Composant `<SmartEmptyState>` finalisé | — | 0,5 |
| 2.12 | Intégration empty states 13 pages | 2.11 | 2 |
| 2.13 | Mode "Vue OTI" toggle | 2.1, 2.8 | 1 |
| 2.14 | Tests E2E Phase 2 | — | 0,8 |

**Total : ~16,1 jours**

---

### Phase 3 — Workflow & export (Sprint 4)

| # | Tâche | Dép. | Effort |
|---|---|---|---|
| 3.1 | Enum `DatapointStatus` | 1.5 | 0,2 |
| 3.2 | Table `datapoint_reviews` | 1.5 | 0,3 |
| 3.3 | `review_service.py` + règles (timeout 2h, admin freeze) | 3.1, 3.2 | 1 |
| 3.4 | Endpoints `/facts/*/review`, `/freeze`, `/reviews/inbox` | 3.3 | 0,7 |
| 3.5 | Page `/revue` — Inbox | 3.4, 2.1 | 2 |
| 3.6 | Badges statut sur KPIs | 3.1, 2.3 | 0,8 |
| 3.7 | Gel auto à génération rapport | 3.3 | 1 |
| 3.8 | Page `/snapshots/compare` | — | 2 |
| 3.9 | Vue diff datapoint par datapoint | 3.8 | 1 |
| 3.10 | Revert snapshot + audit event | 3.8 | 0,5 |
| 3.11 | Upgrade `audit/page.tsx` hash chain | 1.18 | 1,5 |
| 3.12 | Service `export_package.py` (ZIP complet) | 1.7 | 2 |
| 3.12a | Vercel Blob temporaire exports | 3.12 | 1 |
| 3.13 | Watermark PDF (hash + date) | 3.12 | 1 |
| 3.14 | Page publique `/verify/{hash}` | 3.12 | 1 |
| 3.15 | Tests E2E workflow complet | — | 1 |

**Total : ~17 jours**

---

### Phase 4 — Wedge différenciant (Sprint 5)

| # | Tâche | Dép. | Effort |
|---|---|---|---|
| 4.1 | Matérialité upgrade : drag & drop 2D | materialite | 1,5 |
| 4.2 | Bibliothèque sujets ESRS 5 secteurs | — | 1 |
| 4.3 | Score auto matérialité | 4.2 | 1 |
| 4.4 | Export PDF matérialité + narratif LLM | 4.1 | 1 |
| 4.5 | Table `suppliers` | 1.12 | 0,3 |
| 4.6 | Tables questionnaires + responses | 4.5 | 0,5 |
| 4.7 | `supplier_service.py` + token public | 4.6 | 1,5 |
| 4.8 | Page `/fournisseurs` top 20 | 4.7 | 2 |
| 4.9 | Page publique `/q/{token}` | 4.7 | 1,5 |
| 4.10 | Template questionnaire scope 3 | 4.6 | 0,5 |
| 4.11 | Corpus ESRS markdown (E1, ESRS 1/2) | — | 1 |
| 4.12 | Extension pgvector Neon | P1 | 0,3 |
| 4.13 | `embed_corpus.py` via AI Gateway | 4.11, 4.12 | 1 |
| 4.14 | Endpoint `/copilot/ask` + citations | 4.13 | 1 |
| 4.15 | Prompt garde-fou "ne calcule pas" | 4.14 | 0,3 |
| 4.16 | UI Copilote sources affichées | 4.14 | 0,5 |
| 4.17 | Tests E2E Phase 4 | — | 1 |

**Total : ~15 jours**

---

### Phase 5 — Site & contenu (Sprint 6)

| # | Tâche | Dép. | Effort |
|---|---|---|---|
| 5.1 | Refonte homepage | Phase 0 | 2 |
| 5.2 | Sandbox `/demo` mode read-only | toutes | 3 |
| 5.2a | Workbook anonymisé "ETI Exemple SA" | — | 0,5 |
| 5.3 | Middleware demo mode | 5.2 | 1 |
| 5.4 | Page `/trust` Trust Center | Phase 0 | 1,5 |
| 5.5 | Page `/methodologie` | Phase 1 | 1,5 |
| 5.5a | Méthodologie publique (workbook CC-BY-NC-ND) | 5.5 | 1 |
| 5.6 | Page `/integrations` 4 tiers | — | 1 |
| 5.7 | 4 articles SEO fondateurs | — | 4 |
| 5.8 | 2 guides téléchargeables PDF | — | 2 |
| 5.9 | Lead magnet form Resend | 5.8, P7 | 0,5 |
| 5.10 | Newsletter setup + 2 numéros | P7 | 1 |
| 5.11 | Vidéo démo 90s | 5.2 | 1,5 |
| 5.12 | PostHog intégration + events | P5 | 0,8 |
| 5.13 | UptimeRobot + `/status` | P6 | 0,5 |
| 5.14 | Sous-domaines DNS Vercel | P8 | 0,5 |
| 5.15 | Page `/design-system` (optionnel) | — | 0,5 |
| 5.16 | Tests E2E parcours public | — | 0,7 |

**Total : ~22,5 jours**

---

## 5. Chantiers transverses

| # | Tâche | Cadence | Effort |
|---|---|---|---|
| T.1 | Test E2E wedge principal en CI | Dès Phase 1, maintenu | ~5j |
| T.2 | Newsletter hebdo | 1/semaine dès S3 | ~5j cumulés |
| T.3 | Article SEO supplémentaire | 1/sprint | ~3j |
| T.4 | Revue PostHog hebdo | 1/semaine dès S6 | ~1j |
| T.5 | Mise à jour ADEME | Ad hoc | 0,5j |

**Total transverse : ~15j**

---

## 6. Risques par phase

| Phase | Risque | Prob. | Mitigation |
|---|---|---|---|
| 0 | Casser le site | 🟠 | Branche + preview Vercel |
| 0 | Perte de leads | 🟡 | Garder CTA démo actifs |
| 1 | Volume ADEME > Neon free | 🟠 | Partir de `Facteurs_Emission` workbook (854 valeurs) |
| 1 | Casser `carbon_service.py` parsing | 🔴 | Tests fixtures + feature flag fallback |
| 1 | RLS bloque requêtes légitimes | 🟠 | Preview + policy admin bypass |
| 1 | Hash chain mal calculée | 🟠 | Tests sérialisation + fixtures |
| 2 | Drawer ralentit dashboard | 🟡 | Lazy loading + SWR |
| 2 | DQC trop complexe vs existant | 🟠 | Refactor progressif `/qc-v2` |
| 3 | Workflow bloque démo | 🟠 | Auto-validation en demo mode |
| 3 | Export ZIP dépasse limite Vercel | 🟠 | Vercel Blob + QStash async |
| 3 | Hash chain illisible | 🟡 | Vue agrégée + drill-down |
| 4 | Questionnaires publics spam | 🟠 | Token unique + rate limit + Turnstile |
| 4 | pgvector taille limite | 🟡 | Corpus ciblé |
| 4 | Copilote RAG hallucine | 🟠 | Prompt strict + sources + temp basse |
| 5 | Sandbox expose données | 🔴 | Middleware read-only strict + RLS + tests |
| 5 | Articles SEO pauvres IA | 🟠 | Relecture humaine + sources |
| Transv. | Burn-out solo | 🔴 | 1j off/semaine sacré |
| Transv. | Feature creep | 🔴 | `BACKLOG_POST_90J.md` obligatoire |
| Transv. | Régression non détectée | 🟠 | E2E obligatoire avant merge |

---

## 7. Définition du "done"

### Phase 0
- 0 logo client non contractualisé en prod
- 0 mention "OVH HDS / SAP 2 jours / 12 ESRS / SLA 99,9%"
- Page `/couverture` avec ≥12 ESRS + 3 statuts
- Page `/etat-du-produit` avec 3 sections
- 0 occurrence `fallback:` / `mock:` dans 13 pages maintenues
- Pages hors wedge archivées dans `_archived/`
- `lib/design-tokens.ts` importable

### Phase 1
- ≥500 facteurs depuis workbook en DB
- `verify_chain()` vert sur fixture 100 events
- RLS isolation test vert
- `/facts/{code}/trail` <500ms p95

### Phase 2
- Provenance Drawer sur ≥5 KPIs, <300ms
- Dashboard 4 blocs 0 fictif
- DQC score + tableau filtrable + 3 actions
- Toutes pages utilisent `<SmartEmptyState>`
- Mode OTI toggle persistant

### Phase 3
- 4 statuts implémentés + timeout 2h
- Inbox `/revue` accessible
- Snapshot diff + revert fonctionnels
- ZIP export + `/verify/{hash}` opérationnels

### Phase 4
- Matérialité drag & drop + 5 secteurs + narratif LLM
- Supplier CRUD + token public + réponses intégrées facts
- Copilote avec citations ESRS (test 10 questions)

### Phase 5
- Homepage Lighthouse ≥90
- Sandbox `/demo` read-only testée
- Trust Center 4 sections + DPA
- Méthodologie workbook publié
- 4 articles + 2 guides + lead magnet opérationnel
- Newsletter 2 numéros + opt-in
- PostHog ≥5 events + UptimeRobot ≥3 endpoints
- Sous-domaines DNS fonctionnels

### Transverse
- Test E2E wedge principal vert en CI
- 0 régression critique

---

## 8. Questions ouvertes

| # | Question | À décider |
|---|---|---|
| Q.a | Licence workbook public (recommandé CC-BY-NC-ND) | S11 |
| Q.b | Dump ADEME public enrichissement | Post-90j |
| Q.c | Revue juridique site v2 | Si budget/pro-bono |
| Q.d | Cadence newsletter post-6 numéros | Post-90j |
| Q.e | Sélection 5 secteurs matérialité | Avant S9 |
| Q.f | Seuils qualité DQC anomalies | Avant S5 |

---

## 9. Métriques de pilotage

### Techniques (continu)
- Tests E2E CI : 100% verts avant merge
- Couverture audit trail : 100% datapoints ont un fact
- `/facts/*/trail` : <500ms p95
- Génération rapport : <30s p95
- Isolation RLS : 100% verts

### Produit (dès Phase 5)
- Visiteurs uniques homepage/mois : ≥500
- Sessions sandbox `/demo` : ≥50/mois
- Téléchargements guides : ≥30/mois
- Inscrits newsletter : ≥100
- Ouverture newsletter : ≥35%
- Uptime : ≥99%

### Santé
- Jours off/semaine : ≥1 sacré
- Nuits complètes/semaine : ≥5
- Séances sport/semaine : ≥2
- Nuits blanches : 0

---

## 10. Score projeté à J+90

| Zone | Avant | Après | Delta |
|---|---|---|---|
| 1 — Marché | 5,0 | 6,5 | +1,5 |
| 2 — Business model | 4,0 | 4,5 | +0,5 |
| 3 — Produit | 4,5 | 7,5 | +3,0 |
| 4 — Données | 4,0 | 8,0 | +4,0 |
| 5 — GTM | 3,5 | 6,0 | +2,5 |
| 6 — Chaîne de valeur | 3,5 | 7,5 | +4,0 |
| 7 — Risques | 3,0 | 6,0 | +3,0 |
| **Moyenne** | **3,9** | **6,6–7,3** | **+2,7–3,4** |

---

## 11. Philosophie directrice

> CarbonCo doit montrer **comment il sait**,
> pas seulement **ce qu'il affiche**.

### Les 5 commandements

1. Tout ce qui est en prod doit être vrai, démontrable, auditable
2. Un seul wedge : ESRS E1 + Scope 1/2/3 + Matérialité + Export + Audit trail
3. Chaque chiffre doit avoir sa provenance cliquable en ≤1 seconde
4. Aucun faux succès silencieux — erreurs explicites
5. Pas de feature creep : tout ajout non prévu va dans `BACKLOG_POST_90J.md`

---

## 12. Rituels d'exécution

### Quotidien
- Stand-up solo (5 min)
- Commit fin de journée avec message clair
- Mise à jour `SPRINT_LOG.md` (3 lignes bilan)

### Hebdomadaire
- Revue de sprint (1h, vendredi)
- Revue métriques PostHog (30 min)
- Newsletter envoyée (Phase 5+)
- 1 jour off sacré

### Par sprint (2 semaines)
- Revue de phase (2h, fin sprint) : DoD, jalon, rétro
- Déploiement prod (preview d'abord)
- `CHANGELOG.md` public mis à jour

---

## 13. Ressources & comptes

| Outil | Usage | Coût | Quand |
|---|---|---|---|
| Vercel | Hosting | Free Hobby | ✅ |
| Neon Postgres | DB | Free 0,5 Go | ✅ |
| Upstash QStash | Jobs async | Free 500/j | ✅ |
| Vercel Blob | Storage exports | Free 0,5 Go | Sprint 4 |
| PostHog | Analytics | Free 1M events | Sprint 1 |
| UptimeRobot | Monitoring | Free 50 | Sprint 1 |
| Resend | Email + newsletter | Free 3000/mois | Sprint 6 |
| Cloudflare Turnstile | Captcha | Gratuit | Sprint 5 |

**Budget externe : 0 €/mois**

---

## 14. Glossaire

| Terme | Définition |
|---|---|
| **Wedge** | Cœur de valeur minimal et différenciant |
| **facts_events** | Table append-only stockant chaque datapoint avec provenance et hash chaîné |
| **Provenance Drawer** | UI affichant historique complet d'un chiffre |
| **Data Quality Center** | Page qualité données T1/T2/T3 |
| **Gap filling** | Remplissage données manquantes (moyennes ou proxies) |
| **Tier 1/2/3** | Qualité : primaire / sectoriel / proxy monétaire |
| **iXBRL** | Format machine CSRD (reporté) |
| **RLS** | Row-Level Security Postgres |
| **Hash chain** | Chaîne cryptographique liant events |
| **OTI** | Organisme Tiers Indépendant auditeur CSRD |
| **Mode Vue OTI** | Toggle "prêt à auditer" |
| **Cockpit** | Dashboard 4 questions |
| **Sandbox publique** | Version read-only sans login pour démo |

---

## 15. Maintenance du document

- **Version actuelle** : 1.0
- **Dernière mise à jour** : 2026-04-15
- **À réviser** : après chaque fin de sprint (2 semaines)
- **Maintenu par** : Ludovic L.
- **Source de vérité** : `/PLAN_REFONTE_90J.md` racine du repo
