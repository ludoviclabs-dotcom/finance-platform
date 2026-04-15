# Audit des Claims — Site CarbonCo v1

> **Objectif** : recenser toutes les promesses faites par le site actuel et statuer dessus.
> **Créé** : Jour 1 du Sprint 1 (Phase 0)
> **Rempli** : 2026-04-15
> **Règle** : chaque claim → GARDER / RETIRER / REQUALIFIER

---

## Méthode appliquée

1. ✅ Lecture complète de `apps/carbon/lib/data.ts` (366 lignes)
2. ✅ Grep ciblé sur `apps/carbon/components/pages/landing-page.tsx` (1257 lignes)
3. ✅ Recherche des termes : logos clients, "99.9", "SLA", "OVH", "HDS", "souverain", "hébergement", "SAP...2 jours", "12 ESRS", "120+", "ISO", "SecNumCloud"
4. ✅ Vérification de la réalité technique contre le codebase

---

## Section 1 — Logos clients & témoignages (CRITIQUE JURIDIQUE)

**Localisation** : `landing-page.tsx` ligne 629 (wall of logos) + lignes 934–957 (témoignages détaillés avec nom/prénom/fonction)

| Logo / témoignage | Ligne | Réalité | Décision | Action |
|---|---|---|---|---|
| **Vinci** (logo) | 629 | ❌ Aucun contrat | 🔴 RETIRER | Supprimer du tableau |
| **Société Générale** (logo) | 629 | ❌ Aucun contrat | 🔴 RETIRER | Supprimer |
| **Schneider Electric** (logo) | 629 | ❌ Aucun contrat | 🔴 RETIRER | Supprimer |
| **TotalEnergies** (logo) | 629 | ❌ Aucun contrat | 🔴 RETIRER | Supprimer |
| **Veolia** (logo) | 629 | ❌ Aucun contrat | 🔴 RETIRER | Supprimer |
| **Danone** (logo) | 629 | ❌ Aucun contrat | 🔴 RETIRER | Supprimer |
| **Michelin** (logo) | 629 | ❌ Aucun contrat | 🔴 RETIRER | Supprimer |
| **"Marie L. Directrice RSE, Vinci"** + citation | 937-942 | ❌ Témoignage inventé | 🔴 RETIRER | Remplacer par scénario sectoriel industrielle |
| **"Thomas M. CFO, Groupe Schneider"** + citation SAP 2j | 944-949 | ❌ Témoignage inventé + claim SAP intenable | 🔴 RETIRER | Remplacer par scénario sectoriel services |
| **"Sophie R. Responsable ESG, TotalEnergies"** + citation | 951-957 | ❌ Témoignage inventé | 🔴 RETIRER | Remplacer par scénario sectoriel agro |

**Risque juridique** : parasitisme (art. L121-2 Code consommation) + pratique commerciale trompeuse. Ces entreprises peuvent exiger retrait + dommages-intérêts.

---

## Section 2 — Hébergement & souveraineté

**Localisation** : `landing-page.tsx` lignes 552, 570, 1052-1054, 1152-1160, 1218

| Claim v1 | Ligne | Réalité | Décision | Remplacement |
|---|---|---|---|---|
| "Hébergement souverain, IA conforme EU AI Act" (hero) | 552 | Vercel + Neon AWS eu-central-1 | 🔴 RETIRER | "Hébergé sur infrastructure Vercel (UE)" |
| "Hébergement OVH France" (badge hero) | 570 | ❌ Vercel, pas OVH | 🔴 RETIRER | "Infrastructure EU (Vercel)" |
| "Cloud souverain SecNumCloud" (plan Souverain) | `data.ts` 310 | ❌ Aucun SecNumCloud | 🔴 RETIRER | Supprimer ligne |
| "Données hébergées en France" (plan Souverain) | `data.ts` 312 | ❌ AWS Francfort | 🔴 RETIRER | Supprimer ligne |
| "SLA 99,95%" (plan Souverain) | `data.ts` 313 | ❌ Pas de SLA | 🔴 RETIRER | Supprimer |
| Plan **"Souverain"** entier | `data.ts` 304-319 | ❌ Vaporware | 🔴 RETIRER | Supprimer le plan entièrement |
| "infrastructure 100% française (OVH Cloud HDS)" | 1152 | ❌ Vercel/Neon | 🔴 RETIRER | "Infrastructure EU" |
| "chiffrement de bout en bout AES-256" | 1152 | ⚠️ Partiellement vrai (TLS oui, E2E non vérifié) | 🟡 REQUALIFIER | "Chiffrement TLS 1.3 en transit, AES-256 au repos" |
| "zéro transfert hors UE" | 1153 | ⚠️ Anthropic API via AI Gateway = potentiellement US | 🟡 REQUALIFIER | "Traitement prioritaire en UE via Vercel AI Gateway" |
| "RGPD Compliant — Données hébergées exclusivement en France — OVH Cloud HDS" | 1159 | ❌ Faux sur OVH | 🔴 RETIRER | "Conforme RGPD — hébergement EU (Vercel/Neon)" |
| "SecNumCloud — Certification ANSSI en cours — Qualification Q3 2026" | 1160 | ⚠️ "En cours" = pas démarré | 🟡 REQUALIFIER | "Roadmap sécurité — certifications en évaluation" |
| "Hébergement OVH France · ISO 27001" (footer) | 1218 | ❌ ISO non obtenu | 🔴 RETIRER | "Infrastructure EU" |

---

## Section 3 — SLA & disponibilité

| Claim v1 | Ligne | Réalité | Décision | Remplacement |
|---|---|---|---|---|
| "99.9% SLA Garanti" (badge hero) | 589-590 | ❌ Aucun monitoring, aucune astreinte, aucun SLA contractuel | 🔴 RETIRER | Badge supprimé OU "Monitoring public sur /status" |
| "99.9% Disponibilité SLA" (stats) | 1128 | ❌ Pas mesuré | 🔴 RETIRER | Supprimer ce chiffre des stats |
| "Support prioritaire 7j/7" (plan Enterprise) | 1036 | ❌ Fondateur solo, pas de support 7j/7 | 🔴 RETIRER | "Support email en semaine (9h-18h)" |

---

## Section 4 — Intégrations ERP

| Claim v1 | Ligne | Réalité | Décision | Remplacement |
|---|---|---|---|---|
| "Connecteurs ERP — SAP, Oracle, Sage, Cegid — intégration en 2 jours" | 828 | ❌ Uniquement parser Excel | 🔴 RETIRER | "Import Excel structuré. Connecteurs ERP en roadmap" |
| "L'intégration avec notre ERP SAP a été réalisée en 2 jours" (témoignage Schneider) | 944 | ❌ Faux témoignage + claim technique faux | 🔴 RETIRER | Supprimer avec le témoignage |
| "2j intégration ERP" (métrique témoignage) | 948 | ❌ | 🔴 RETIRER | Supprimer |
| "API & connecteurs ERP" (plan Enterprise) | 1036 | ⚠️ API existe, connecteurs non | 🟡 REQUALIFIER | "API REST + import Excel — connecteurs ERP en roadmap" |
| "Connecteurs certifiés ISO 27001" | 875 | ❌ Aucune certif | 🔴 RETIRER | Supprimer mention |

---

## Section 5 — Couverture ESRS

| Claim v1 | Ligne | Réalité | Décision | Remplacement |
|---|---|---|---|---|
| "12 ESRS natifs" (plan Business features) | 1036 | 🟡 Pages existent, E1 couvert, autres partiels | 🟡 REQUALIFIER | "Couverture prioritaire E1 + ESRS 1/2" |
| "12 ESRS complets" (`data.ts` plan Business) | `data.ts` 275 | 🟡 | 🟡 REQUALIFIER | "Couverture prioritaire E1 + ESRS 1/2" |
| "12 Standards intégrés nativement" (stats) | 642 | 🟡 Pages présentes, profondeur variable | 🟡 REQUALIFIER | Retirer le chiffre, renvoyer vers `/couverture` |
| "3 ESRS de base" (plan Starter `data.ts`) | `data.ts` 260 | 🟡 | 🟡 REQUALIFIER | "ESRS E1 (Climate) couverture prioritaire" |
| "12 ESRS + Taxonomie" (plan Enterprise `data.ts`) | `data.ts` 293 | 🟡 | 🟡 REQUALIFIER | "ESRS E1 approfondi + autres en Beta" |

---

## Section 6 — Statistiques & chiffres d'audience

| Claim v1 | Ligne | Réalité | Décision | Remplacement |
|---|---|---|---|---|
| "120+ Entreprises clientes" (stats) | 639 | ❌ 0 client payant | 🔴 RETIRER | Supprimer la stat OU remplacer par "Méthodologie ouverte disponible" |
| "87% Réduction du temps de reporting" | 640 | ❌ Non mesuré sur clients réels | 🔴 RETIRER | Supprimer |
| "4.8/5 Satisfaction client" | 641 | ❌ Aucun NPS/CSAT | 🔴 RETIRER | Supprimer |
| "Rejoignez 120+ entreprises qui ont déjà automatisé..." | 1194 | ❌ | 🔴 RETIRER | "Rejoignez la communauté CarbonCo" |
| "Ils nous font confiance" (titre section logos) | 627 | ❌ Personne ne fait confiance à ce stade | 🔴 RETIRER | "Conçu avec les experts CSRD" OU section entièrement retirée |

---

## Section 7 — Essai gratuit 14 jours

| Claim v1 | Ligne | Réalité | Décision | Remplacement |
|---|---|---|---|---|
| "Démarrer gratuitement — 14 jours" (CTA hero) | 557 | ⚠️ Factuellement possible mais stratégiquement mauvais (voir Zone 2) | 🟡 REQUALIFIER | "Voir la démo" → sandbox publique Phase 5 |
| "Aucune carte bancaire" | 568 | ✅ Vrai (pas de paiement) | 🟢 GARDER | — |

---

## Section 8 — IA & Copilote NEURAL

| Claim v1 | Ligne | Réalité | Décision | Remplacement |
|---|---|---|---|---|
| "IA conforme EU AI Act" | 552 | ⚠️ Non audité, classification IA Act non faite | 🟡 REQUALIFIER | Retirer jusqu'à audit |
| "Copilote NEURAL" (plan Business) | 1036 | 🟢 Existe | 🟢 GARDER | Mais recadrer "assistant, ne calcule pas" (Phase 4) |
| "Copilote IA avancé" (plan Enterprise) | `data.ts` 296 | 🟡 | 🟡 REQUALIFIER | "Copilote IA avec citations ESRS sourcées" |

---

## Section 9 — Taxonomie & CBAM (aiResponses data.ts)

| Claim v1 | Ligne | Réalité | Décision | Remplacement |
|---|---|---|---|---|
| Mock réponse "Votre exposition CBAM : ~240 tCO₂e" | `data.ts` 363 | ⚠️ Chiffre fictif sans source | 🟡 REQUALIFIER | Marquer comme exemple pédagogique explicite |
| Mock "42% du CA" taxonomie | `data.ts` 365 | ⚠️ Fictif | 🟡 REQUALIFIER | Idem |

---

## Section 10 — Grille tarifaire

**Problème majeur** : 4 plans (Starter 490€ / Business 1290€ / Enterprise 2990€ / Souverain sur devis) créent l'effet "no man's land" identifié en Zone 2.

| Décision | Action |
|---|---|
| 🔴 RETIRER plan "Souverain" | Supprimer complètement (lignes 304-319 de `data.ts`) |
| 🟡 REQUALIFIER plan "Starter" | "Pour PME en reporting volontaire" → wedge PME opportuniste |
| 🟡 REQUALIFIER plan "Business" | "Pour ETI fournisseurs grands comptes CSRD" → wedge principal |
| 🟡 REQUALIFIER plan "Enterprise" | "Sur devis" uniquement, retirer prix fixe 2990€ |

---

## Bilan chiffré

- **Claims audités** : 43
- **🔴 À RETIRER** : 28
- **🟡 À REQUALIFIER** : 14
- **🟢 GARDÉS tels quels** : 1

---

## Plan d'action pour Jours 2–4

### Jour 2 — Témoignages & logos (tâches 0.2, 0.3)
- [ ] Supprimer le tableau de logos ligne 629
- [ ] Supprimer la section "Ce que disent nos clients" (922–990) OU remplacer par scénarios anonymisés
- [ ] Créer 3 scénarios sectoriels dans `data.ts` (industrielle / services / agro)

### Jour 3 — Hébergement & SLA (tâches 0.4, 0.7)
- [ ] Retirer tous les "OVH", "HDS", "souverain", "SecNumCloud", "99.9%", "SLA", "ISO 27001"
- [ ] Retirer le plan "Souverain" entier
- [ ] Retirer le badge "99.9% SLA Garanti" du hero
- [ ] Retirer la stat "99.9% Disponibilité SLA"

### Jour 3 — Intégrations & ESRS (tâches 0.5, 0.6)
- [ ] Retirer "intégration en 2 jours" ligne 828
- [ ] Requalifier "12 ESRS natifs" / "12 ESRS complets"
- [ ] Retirer "Connecteurs certifiés ISO 27001"

### Jour 4 — Grille tarifaire (tâche 0.8)
- [ ] Unifier à 3 plans : Starter / Business / Enterprise (supprimer Souverain)
- [ ] Vérifier cohérence prix entre `data.ts` et `pricing/page.tsx`
- [ ] Features par plan alignées avec le wedge

### Jour 4 — Lexique safe (tâche 0.9)
- [ ] Créer `apps/carbon/lib/claims-dictionary.ts` avec vocabulaire réutilisable

---

## Risques juridiques immédiats

🚨 **Les 7 logos de grandes entreprises** (Vinci, SG, Schneider, TotalEnergies, Veolia, Danone, Michelin) **ET** les 3 témoignages nominatifs inventés (Marie L., Thomas M., Sophie R.) constituent le **risque juridique n°1** identifié en audit Zone 7.

**Action prioritaire** : supprimer ces éléments **dès le Jour 2 du Sprint 1** avant toute autre tâche.

---

## Commandes de vérification finale (à lancer fin de Phase 0)

```bash
# Doit retourner 0 résultat après correction
grep -rn "OVH\|HDS" apps/carbon/components apps/carbon/lib apps/carbon/app
grep -rn "99\.9\|99,9" apps/carbon/components apps/carbon/lib apps/carbon/app
grep -rn "Vinci\|Schneider\|TotalEnergies\|Veolia\|Danone\|Michelin" apps/carbon/components apps/carbon/lib
grep -rn "120+\|120 +" apps/carbon/components apps/carbon/lib
grep -rn "intégration en 2 jours\|SAP.*2 jours" apps/carbon/components apps/carbon/lib
grep -rn "SecNumCloud" apps/carbon/components apps/carbon/lib apps/carbon/app
grep -rn "12 ESRS natifs\|12 ESRS complets" apps/carbon/components apps/carbon/lib
```
