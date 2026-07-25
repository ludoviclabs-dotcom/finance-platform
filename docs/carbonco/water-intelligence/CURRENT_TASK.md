> **Mission en cours — Wave D (MACRO-PROMPT D) uniquement.**
> **Gate d'entrée levé** : la PR Wave C (#156) est fusionnée dans `master`
> (merge `eb2a898`, 2026-07-25). Wave E ne doit pas démarrer avant la fusion
> de la Wave D.

# Wave D — Couche décisionnelle (P13 conformité + P14 synergies + P15 finance)

**Branche :** `feat/water-intelligence-wave-d-decision-layer`
**Prompt de référence :** `ACCELERATED_CLOSEOUT_PACK_V2.md` → MACRO-PROMPT D.

---

## État à l'entrée

| Vague | Statut | PR | Merge SHA |
|---|---|---|---|
| Wave A — connecteurs européens | **fusionnée** | #153 | `e36c97c` |
| Blueprint UX/UI | **fusionné** | #154 | `a56ab62` |
| Wave B — famille Hub'Eau | **fusionnée** | #155 | `daaf8f0` |
| Wave C — produit public | **fusionnée** | #156 | `eb2a898` |

- `/water` reste le cockpit authentifié, inchangé par les Waves A, B et C.
- `/water-intelligence` est intégré et **ne publie rien** (voir ci-dessous).
- Dernière migration en base : `043`. Aucune vague n'en a créé.

## Le fait central à comprendre avant Wave D

**Aucune source n'est publiable.** Le gate licence exige une décision humaine
explicite et signée par source ; aucune n'est active :

- `WRI_AQUEDUCT` — refusée (enregistrement WRI non effectué) ;
- `COPERNICUS_EDO` — refusée (`source_verified_decoder_deferred`) ;
- `EEA_WEI_PLUS` et les quatre sources Hub'Eau — `proposed`, donc inactives.

Le snapshot public est donc **vide, valide et rendu honnêtement**. Wave D
travaillera sur un produit qui ne publie rien tant qu'une décision humaine
n'est pas rendue — ce n'est pas un blocage à contourner, c'est l'état correct.

## Acquis à réutiliser

1. **`WaterObservationIdentity`** (Wave C) — identité incluant période,
   géographie, scénario et horizon, avec détection de collision explicite.
   **Tout graveur doit l'utiliser**, jamais `ObservationDraft.dedup_key()`
   (contrat PR-04 partagé avec `/materials`, inchangé).
2. **`WaterPublicSnapshot`** — enveloppe publique, ETag sur hash, double
   barrière licence, garde-fou anti-tenant.
3. **`PublicationDecisionRegistry`** — le seul endroit qui autorise une
   publication.
4. **`PeriodResolver`** (Wave A) — utilisé par toutes les chroniques.
5. **Fondations UI `Wi*`** et décideur d'état pur (huit états, priorité).

## Interdictions structurantes pour Wave D

- **P13 est la seule surface autorisée à parler de conformité.** Ni les
  connecteurs, ni le read model, ni l'UI publique ne portent de seuil
  réglementaire — c'est vérifié par AST côté qualité Hub'Eau. Aucune
  conclusion de conformité ne doit remonter ailleurs.
- **Les previews C15/C16 doivent être remplacées, pas complétées.** Elles ne
  rendent aujourd'hui aucun chiffre ni date, et deux tests l'imposent : les
  remplacer par du réel exige de retirer ces tests en connaissance de cause.
- **P14 touche au tenant.** Frontière stricte : aucune donnée d'entreprise sur
  `/water-intelligence`. Les ponts sont unidirectionnels, du public vers le
  cockpit, et ne transportent aucun paramètre dérivé du contexte utilisateur.
- **P15 : aucune écriture comptable, aucun taux fiscal inventé, aucune
  probabilité produite par un modèle de langage.** Séparer observé, hypothèse
  et dérivé ; afficher la sensibilité, pas la certitude.
- **Si une migration devient nécessaire (P14) : arrêter, documenter, proposer
  une PR dédiée — ne pas la créer dans la vague.**
- Aucun score ESG global, aucun score hydrique composite.

## Contrats à respecter

- **Erreurs** : `AdapterError` en `parse`/`normalize` ;
  `PipelineDataUnavailableError` pour géographie **ou période** non résolue en
  `derive` ; `TransportError` pour le transport ; `PipelineError` pour les
  bornes et le plan.
- **Licence** : sans décision explicite et signée, rien n'est publié.
- **UI** : thème `--wi-*`, Server Components par défaut, aucune dépendance
  nouvelle.
