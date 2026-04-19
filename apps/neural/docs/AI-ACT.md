# NEURAL × AI Act — décision du 19 avril 2026

## Contexte réglementaire

L'**AI Act UE** (règlement 2024/1689) classe comme *systèmes d'IA à haut risque*
(Annexe III § 4) les outils qui assistent :

- le recrutement,
- l'évaluation de candidats,
- les décisions de promotion ou de licenciement,
- la répartition de tâches.

Les **obligations associées** sont opérables depuis août 2026 :

- enregistrement du système dans le registre public européen,
- analyse d'impact préalable,
- plan de gouvernance des données,
- supervision humaine significative,
- transparence utilisateur et log d'audit,
- évaluation régulière des biais.

## Périmètre NEURAL concerné

La section `/secteurs/luxe/rh` et ses agents (Artisan Talent, Comp & Benchmark,
Onboarding, orchestrateur Maison Talent Core) produisent :

- cartographie des métiers rares et gap analysis,
- plans de succession sur postes sensibles,
- benchmark salarial multi-pays avec alertes d'équité,
- simulateur de package (fixe, variable, expatriation),
- évaluation continue sur 7 critères et 5 jalons d'onboarding,
- orchestrateur qui fusionne les signaux et émet des recommandations arbitrées.

Ces capacités tombent intégralement sous **Annexe III § 4.a-d**.

## Décision

**Option B — masquage public** jusqu'à mise en conformité documentée.

## Implémentation (Sprint P0 — 19 avril 2026)

- Flag `NEXT_PUBLIC_FEATURE_RH_LUXE` (défaut = `0`).
- `apps/neural/app/secteurs/luxe/rh/layout.tsx` appelle `notFound()` tant que le flag est off.
- La branche `rh` reste présente dans le catalogue (`BRANCH_ENTRIES`) pour ne pas
  casser la structure, mais elle est filtrée en sortie de navigation (`status !== "planned"`).
- Le code, les parsers, les fichiers Excel sources et les API `/api/data` restent
  en place — aucune perte de travail.

## Conditions de réouverture

Pour flipper le flag en production, les livrables suivants doivent exister :

1. **Analyse d'impact AI Act** rédigée et publiée sur `/trust`.
2. **Registre** d'enregistrement haut risque déposé et numéro de référence public.
3. **Politique de gouvernance** des données personnelles des candidats/salariés.
4. **Disclaimer utilisateur** et consentement explicite intégrés à chaque
   interaction RH de l'UI.
5. **Audit de biais** initial documenté (méthodologie + résultats).
6. **Plan de supervision humaine** nommant explicitement les points de
   décision qui ne peuvent pas être automatisés.

Ces livrables sont préalables à toute ouverture commerciale de la section RH.

## Dernière mise à jour

19 avril 2026 — décision initiale, option B retenue.
