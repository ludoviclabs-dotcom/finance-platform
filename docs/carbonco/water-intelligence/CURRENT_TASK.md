> **Mission active — Wave B (MACRO-PROMPT B) uniquement.**
> **Ne pas lancer la Wave C.**

# Wave B — Famille Hub'Eau (P07 hydrométrie/piézométrie + P08 prélèvements/qualité)

**Branche :** `feat/water-intelligence-wave-b-hubeau`
**Base :** `master` @ `a56ab62`
**Prompt de référence :** `ACCELERATED_CLOSEOUT_PACK_V2.md` → MACRO-PROMPT B.

---

## État à l'entrée

- **Wave A : fusionnée** via [PR #153](https://github.com/ludoviclabs-dotcom/finance-platform/pull/153),
  merge SHA `e36c97c`. Connecteurs EEA WEI+ et Copernicus EDO livrés, aucune
  donnée publiée. Voir [`handoffs/WAVE_A_EU_CONNECTORS.md`](./handoffs/WAVE_A_EU_CONNECTORS.md).
- **Blueprint UX/UI Wave C : fusionné** via [PR #154](https://github.com/ludoviclabs-dotcom/finance-platform/pull/154),
  merge SHA `a56ab62`. Dossier [`ux/`](./ux/) — **documentaire uniquement, à ne
  pas modifier pendant la Wave B**.
- P00 à P05, P03B et P03C : fusionnés.
- `/water` reste le cockpit authentifié ; `/water-intelligence` reste un shell
  public sans données. **Ni l'un ni l'autre n'est touché par la Wave B.**
- Dernière migration en base : `043`. Wave B n'en attend aucune.

## Acquis de la Wave A à réutiliser

1. **`PeriodResolver` — LIVRÉ.** `derive_observations()`/`run_pipeline()`
   acceptent un `PeriodResolver` injectable
   (`Callable[[ObservationDraft], tuple[date, date]]`). Le résolveur par
   défaut reste rétrocompatible (`period_start == period_end ==
   observed_at.date()`). `period_start <= period_end` est vérifié de façon
   générique dans `derive_observations()`, quel que soit le résolveur branché.
   **Toute chronique Hub'Eau doit fournir son propre résolveur de fenêtre
   temporelle** — c'est le mécanisme prévu, il n'y a plus rien à contourner.
2. **Le trimestre EEA n'est plus stocké dans `metric_code`.**
   `eea_wei_plus.metric_code(scale, facet)` est stable et indépendant de la
   saison ; la période vit exclusivement dans `period_start`/`period_end`.
   Le contournement par `metric_code` est **caduc** et ne doit pas être repris
   pour Hub'Eau.

## Décisions ouvertes qui pèsent sur Wave B

1. **Identité persistée d'une série temporelle.** `ObservationDraft.dedup_key()`
   (`services/intelligence/adapters/base.py`, contrat PR-04 partagé avec
   l'import `/materials`) retourne `(subject_type, subject_key, metric_code)`
   — **sans période**. Elle ne doit **jamais** être réutilisée telle quelle
   comme clé d'identité persistée d'une chronique : toute identité future doit
   inclure explicitement la période, ou être protégée par une vérification de
   collision. Arbitrage à rendre par le futur graveur Evidence Kernel (P10).
2. **Copernicus EDO** — statut formel `source_verified_decoder_deferred`,
   **inchangé par la Wave B** ; exclu du snapshot public tant que l'ADR n'est
   pas rendue.
3. **Enregistrement WRI** — toujours non effectué ; aucune valeur Aqueduct
   publiable. **Inchangé par la Wave B.**

## Contrats à respecter d'emblée

- **Erreurs** : `AdapterError` (et sous-classes) pour toute erreur métier
  attendue levée en `parse`/`normalize` ; `PipelineDataUnavailableError` pour
  une géographie **ou une période** non résolue au stage `derive` ;
  `TransportError` pour le transport ; `PipelineError` pour les bornes et le
  plan. Aucun `except Exception` général.
- **Décodeur de page** : toujours choisi explicitement
  (`JsonPageDecoder`/`TextPageDecoder`/`RawBytesPageDecoder`), jamais deviné.
- **Licence** : aucun connecteur ne construit de `WaterLicenseDecision` ; la
  porte reste pilotée par l'appelant. Sans décision, tout est `value_withheld`.
- **Catalogue** : `source_code` inconnu du catalogue P01b = refusé au stage
  `plan`. Les codes Hub'Eau (`HUBEAU_HYDROMETRIE`, `HUBEAU_ADES`,
  `HUBEAU_BNPE_PRELEVEMENTS`, `HUBEAU_QUALITE_SURFACE`) y figurent déjà, avec
  `license_status: unknown` — à vérifier avant toute publication.

## Point d'attention majeur

Le socle Hub'Eau est le **premier transport réellement réseau** du chantier.
`Transport.fetch_page()` est le seul point d'insertion prévu. Le
MACRO-PROMPT B impose : allowlist d'hôtes officiels, endpoint explicite,
pagination, timeout, retry borné, backoff, limites de pages et d'octets,
filtre géographique obligatoire, fenêtre temporelle obligatoire pour les
chroniques, logs sans secret, et **aucun appel pendant les tests ou le
runtime**.
