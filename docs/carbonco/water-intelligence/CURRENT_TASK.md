> **Mission suivante — Wave C (MACRO-PROMPT C) uniquement.**
> **Ne pas démarrer avant revue humaine et fusion de la PR Wave B.**

# Wave C — Produit public (P10 snapshots + P11 carte + P12 contenus)

**Branche :** `feat/water-intelligence-wave-c-public-data-product`
**Prompt de référence :** `ACCELERATED_CLOSEOUT_PACK_V2.md` → MACRO-PROMPT C.

---

## État à l'entrée

- **Wave A : fusionnée** — PR #153, merge SHA `e36c97c`.
- **Blueprint UX/UI Wave C : fusionné** — PR #154, merge SHA `a56ab62`.
  Dossier [`ux/`](./ux/) : blueprint maître, wireframes, spécification des
  composants. **C'est le point de départ de conception de la Wave C.**
- **Wave B : PR ouverte, non fusionnée** — famille Hub'Eau. Voir
  [`handoffs/WAVE_B_HUBEAU.md`](./handoffs/WAVE_B_HUBEAU.md).
- P00 à P05, P03B et P03C : fusionnés.
- `/water` et `/water-intelligence` restent inchangés à ce jour.
- Dernière migration en base : `043`.

## Acquis à réutiliser

1. **`PeriodResolver`** (Wave A) — utilisé par toutes les chroniques Hub'Eau.
   Les `metric_code` sont stables et ne portent jamais de date.
2. **Socle Hub'Eau borné** (Wave B) — allowlist d'hôtes, URL composée jamais
   reçue, champ `next` jamais suivi, budgets, retry borné, journal sans
   secret. **Aucun client HTTP n'est importé** : le transport réel est injecté.
3. **Quatre connecteurs Hub'Eau** en dry-run : hydrométrie, piézométrie,
   prélèvements, qualité des cours d'eau.

## Décisions ouvertes qui pèsent sur Wave C

1. **Identité persistée d'une série temporelle — à trancher avant tout
   graveur.** `ObservationDraft.dedup_key()` retourne `(subject_type,
   subject_key, metric_code)`, **sans période**. La Wave B produit désormais
   de vraies chroniques : un graveur P10 qui réutiliserait cette clé telle
   quelle **écraserait silencieusement toutes les périodes sauf la première**.
   L'identité persistée doit inclure explicitement la période, ou être
   protégée par une vérification de collision.
2. **Sources exclues du snapshot public** :
   - `COPERNICUS_EDO` — statut `source_verified_decoder_deferred`, décodage
     raster reporté, ADR requise ;
   - `WRI_AQUEDUCT` — enregistrement WRI non effectué, publication bloquée.
   Les deux doivent figurer comme **exclusions explicites** dans le manifest.
3. **Licences Hub'Eau par jeu.** La Licence Ouverte Etalab couvre la
   plateforme ; le catalogue P01b garde `license_status: unknown` par entrée
   tant qu'une décision explicite n'est pas rendue. `unknown` ne devient
   jamais autorisé.

## Invariants métier à ne pas perdre à l'assemblage

- **Absence ≠ zéro.** L'avertissement BNPE (usages exonérés de redevance
  inconnus, volumes < 10 000 m³ non déclarés) et les couvertures partielles
  doivent rester visibles. Rendre une absence comme un zéro serait une
  régression métier, pas un détail d'affichage.
- **Unités natives.** l/s, mm, m NGF, m, m³ doivent être portées telles
  quelles, ou toute conversion documentée explicitement — jamais en silence.
- **Aucune conclusion de conformité** à partir des analyses Naïades : le
  registre juridique est l'affaire de P13.
- **Couverture ≠ risque** et **risque ≠ confiance**.

## Contrats à respecter d'emblée

- **Erreurs** : `AdapterError` en `parse`/`normalize` ;
  `PipelineDataUnavailableError` pour une géographie **ou une période** non
  résolue en `derive` ; `TransportError` pour le transport ; `PipelineError`
  pour les bornes et le plan. Aucun `except Exception` général.
- **Licence** : aucun connecteur ne construit de `WaterLicenseDecision` ; sans
  décision explicite, tout est `value_withheld`.
- **Aucune donnée tenant** dans le produit public.
