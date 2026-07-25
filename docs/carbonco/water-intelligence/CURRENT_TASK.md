> **Mission en cours — Wave E (MACRO-PROMPT E), dernière vague du chantier.**
> **Gate d'entrée levé** : la PR Wave D (#157) est fusionnée dans `master`
> (merge `618a222`, 2026-07-25).
> **Aucune vague ne suit.** Après la Wave E, le chantier attend une décision
> humaine de production, pas un prompt suivant.

# Wave E — Finalisation, activation fonctionnelle contrôlée, QA et dossier final

**Branche :** `feat/water-intelligence-wave-e-finalisation`
**Prompt de référence :** `ACCELERATED_CLOSEOUT_PACK_V2.md` → MACRO-PROMPT E
(P16 QA + P17 preview ; P18 documentaire uniquement).

---

## État à l'entrée

| Vague | Statut | PR | Merge SHA |
|---|---|---|---|
| Wave A — connecteurs européens | **fusionnée** | #153 | `e36c97c` |
| Blueprint UX/UI | **fusionné** | #154 | `a56ab62` |
| Wave B — famille Hub'Eau | **fusionnée** | #155 | `daaf8f0` |
| Wave C — produit public | **fusionnée** | #156 | `eb2a898` |
| Wave D — couche décisionnelle | **fusionnée** | #157 | `618a222` |

- Vercel `carbon` production sur `618a222` : **READY**, aucune erreur runtime
  sur 24 h (vérifié au préflight de la Wave E).
- Dernière migration en base : `043`. Aucune vague n'en a créé, et la Wave E
  n'en créera aucune.

## Les deux dettes que la Wave E doit solder

1. **Les moteurs de la Wave D n'étaient branchés sur rien.** Registre juridique,
   synthèse tenant et moteur financier existaient, purs et testés, sans aucune
   surface HTTP — `water_intelligence` n'en avait jamais eu.
2. **La page publique mentait par obsolescence.** Elle décrivait encore un
   « squelette » aux « connecteurs non branchés », affichait un manifest de
   fixture et annonçait comme futures des étapes P05 à P13 déjà livrées. Aucun
   de ces énoncés n'était vrai après la Wave D.

## Contraintes constantes, inchangées depuis la Wave A

- aucune donnée tenant sur `/water-intelligence` ;
- aucune source approuvée par le modèle ;
- aucun texte juridique instruit de mémoire ou par supposition ;
- aucune probabilité ni taux d'actualisation par défaut ;
- aucun score hydrique ou ESG composite ;
- aucune migration ;
- aucune dépendance lourde ;
- aucun appel aux portails externes au runtime ni dans les tests ;
- aucune fixture présentée comme une donnée réelle.

## Pièges d'infrastructure relevés au préflight

- **Un test DB-gated ne tourne que s'il est ajouté nommément** à la liste
  `pytest` du job `migration-tests` (`.github/workflows/api.yml`). Un fichier
  oublié est skippé partout, silencieusement.
- **Le workflow E2E ne se déclenche pas sur `pull_request`**
  (`.github/workflows/e2e.yml`) : `push` sur `master` ou `workflow_dispatch`.
  Un test Playwright ajouté sans corriger ce déclencheur ne tourne pas dans la
  CI de la PR.

## Décisions à ne jamais prendre à la place d'un humain

Désigner un réviseur juridique · approuver une source de publication ·
fournir une probabilité de scénario ou un taux d'actualisation · valider un
contenu éditorial · promouvoir en production.
