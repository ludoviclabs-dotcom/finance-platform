# Audit des Claims — Site CarbonCo v1

> **Objectif** : recenser toutes les promesses faites par le site actuel et statuer dessus.
> **Créé** : Jour 1 du Sprint 1 (Phase 0)
> **Règle** : chaque claim → GARDER / RETIRER / REQUALIFIER

---

## Méthode

1. Parcours manuel de `apps/carbon/components/pages/landing-page.tsx` et `apps/carbon/lib/data.ts`
2. Grep ciblé pour les termes sensibles
3. Vérification de la réalité technique pour chaque claim
4. Décision : garder tel quel, retirer complètement, ou requalifier avec vocabulaire safe

---

## Section 1 — Couverture fonctionnelle

| Claim v1 | Réalité | Décision | Remplacement |
|---|---|---|---|
| _à remplir jour 1_ | | | |

---

## Section 2 — Hébergement & souveraineté

| Claim v1 | Réalité | Décision | Remplacement |
|---|---|---|---|
| "Hébergement OVH HDS" | Infra Vercel/Neon (AWS eu-central-1) | RETIRER | "Hébergé sur infrastructure Vercel (UE) — migration souveraine en roadmap" |

---

## Section 3 — Intégrations

| Claim v1 | Réalité | Décision | Remplacement |
|---|---|---|---|
| "Intégration SAP en 2 jours" | Parsing Excel uniquement | REQUALIFIER | "Compatible via upload Excel structuré / connecteur natif en roadmap" |

---

## Section 4 — Performance & SLA

| Claim v1 | Réalité | Décision | Remplacement |
|---|---|---|---|
| "SLA 99,9%" | Aucun monitoring, aucune astreinte | RETIRER | "Disponibilité best-effort, monitoring public sur /status" |

---

## Section 5 — Témoignages & logos clients

| Logo / témoignage | Client réel ? | Décision | Remplacement |
|---|---|---|---|
| Vinci | À vérifier | RETIRER si non contractualisé | Scénario sectoriel "ETI industrielle" |
| Schneider | À vérifier | RETIRER si non contractualisé | Scénario sectoriel "ETI industrielle" |
| TotalEnergies | À vérifier | RETIRER si non contractualisé | Scénario sectoriel "ETI énergie" |
| (autres) | | | |

---

## Section 6 — Méthodologie & IA

| Claim v1 | Réalité | Décision | Remplacement |
|---|---|---|---|
| "IA autonome calcule tout" | LLM assistance seulement | REQUALIFIER | "Assisté par IA, validation humaine obligatoire" |
| "12 ESRS natifs" | E1 + ESRS 1/2 bien couverts | REQUALIFIER | "Couverture prioritaire E1, autres en roadmap" |

---

## Section 7 — Certifications

| Claim v1 | Réalité | Décision | Remplacement |
|---|---|---|---|
| (à vérifier) | | | |

---

## Section 8 — Chiffres & statistiques

| Claim v1 | Réalité | Décision | Remplacement |
|---|---|---|---|
| "120+ entreprises accompagnées" | 0 client payant | RETIRER | Pas de chiffre, scénarios sectoriels |

---

## Bilan

- **Claims audités** : _à remplir_
- **Retirés** : _à remplir_
- **Requalifiés** : _à remplir_
- **Gardés tels quels** : _à remplir_

---

## Commandes de vérification

```bash
# Vocabulaire à bannir
grep -rn "OVH\|HDS\|souverain" apps/carbon/
grep -rn "99.9\|SLA" apps/carbon/
grep -rn "12 ESRS\|tous les ESRS" apps/carbon/
grep -rn "SAP.*2 jours\|Oracle.*2 jours" apps/carbon/
grep -rn "120+\|plus de 100" apps/carbon/

# Logos clients (à vérifier la contractualisation)
grep -rn "vinci\|schneider\|totalenergies\|bnp\|lvmh\|carrefour" apps/carbon/ -i
```
