# Audit Faux Succès Silencieux — Phase 0 Sprint 1

> **Objectif** : recenser tous les endroits où l'app affiche du contenu fictif sans en avertir l'utilisateur.
> **Créé** : Jour 5 du Sprint 1 (Phase 0) — 2026-04-15
> **Méthode** : grep `fallback|mock|placeholder|sample|demo.data|fake` sur `apps/carbon/`

---

## Catégorie A — Faux succès réels (corrigés)

Ces cas affichaient des données fictives SANS avertissement à l'utilisateur.

| Fichier | Ligne | Pattern | Problème | Correction appliquée |
|---|---|---|---|---|
| `dashboard-page.tsx` | 127–128 | `pick(live, fallback)` | Chiffres émissions fictifs (ex: "5 955 tCO₂e") affichés si aucun snapshot importé | ✅ Bandeau "Données de démonstration" ajouté quand `!isLive && !carbonError && status !== loading` |
| `scopes-page.tsx` | 35–36 | `pick(live, fallback)` | Mêmes chiffres fictifs Scope 1/2/3 sans indication | ✅ Bandeau ajouté avec lien vers /upload |
| `esrs-page.tsx` | 156 | `liveStandards ?? esrsStandards` | Taux de conformité ESRS fictifs (85%, 72%...) affichés sans indication | ✅ Bandeau ajouté avec lien vers /materialite |

---

## Catégorie B — Faux positifs légitimes (à conserver)

Ces occurrences sont du comportement correct, pas des faux succès.

| Fichier | Pattern | Raison de conserver |
|---|---|---|
| `dashboard-page.tsx` | `carbonError` bandeau existant | Cas erreur API déjà traité correctement |
| `esrs-page.tsx` | `esgError` bandeau existant | Cas erreur API déjà traité correctement |
| `(app)/layout.tsx` | `fallback={<PageSkeleton />}` | Suspense React standard |
| `landing/mockup/*.tsx` | `MockupScreen`, `mockup-data.ts` | Démo pédagogique dans la landing — utilisateur non connecté, contexte clair |
| `copilot-page.tsx` | `placeholder="Posez une question…"` | Attribut HTML input, pas un faux succès |
| Tous les `placeholder=` | inputs de formulaires | Attributs HTML standards |
| `upload/page.tsx` | `sample_rows` | Propriété du parseur Excel (vrai nom de champ) |
| `api/csp-report/route.ts` | `script-sample` | Champ CSP violation report standard |

---

## Catégorie C — À surveiller (non corrigé, faible risque)

| Fichier | Ligne | Pattern | Risque | Décision |
|---|---|---|---|---|
| `dashboard-page.tsx` | 166 | `// static fallback (live data not yet available)` benchmark sectoriel | Benchmark fictif dans le dashboard mais commentaire interne correct | ⚠️ À surveiller — ajouter label "Exemple sectoriel" quand la section sera plus visible |
| `dashboard-page.tsx` | 156 | `esgScoreDisplay = esgScoreGlobal ?? 62` | Score ESG "62" fictif affiché sans label | ⚠️ À adresser en Phase 2 avec le KPI Provenance Drawer |
| `data.ts` | `aiResponses.cbam/taxonomie` | Chiffres CBAM/Taxonomie avec annotation `⚠️ Exemple pédagogique` | Annotation ajoutée Jour 2 — risque réduit | ✅ Traité Jour 2 |

---

## Commandes de vérification

```bash
# Vérifier qu'aucun nouveau faux succès silencieux n'a été introduit
grep -rn "fallback\|mock\|placeholder" apps/carbon/components apps/carbon/app apps/carbon/lib \
  | grep -v "\.next\|node_modules\|test-results\|placeholder=" \
  | grep -v "MockupScreen\|mockup-data\|MockupNav\|Suspense\|PageSkeleton\|csp-report\|sample_rows"
```

---

## Bilan

- **Faux succès corrigés** : 3 (dashboard, scopes, esrs)
- **Faux positifs légitimes** : ~8 occurrences (Suspense, HTML placeholders, mockup landing)
- **À surveiller** : 2 (benchmark sectoriel, ESG score fictif)
