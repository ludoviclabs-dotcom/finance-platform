> **Mission suivante — Wave B (MACRO-PROMPT B) uniquement.**
> **Ne pas démarrer avant revue humaine et fusion de la PR Wave A.**

# Wave B — Famille Hub'Eau (P07 hydrométrie/piézométrie + P08 prélèvements/qualité)

**Branche :** `feat/water-intelligence-wave-b-hubeau`
**Prompt de référence :** `ACCELERATED_CLOSEOUT_PACK_V2.md` → MACRO-PROMPT B.

---

## État à l'entrée

- Wave A (`feat/water-intelligence-wave-a-eu-connectors`) : **PR ouverte, non
  fusionnée**. Connecteurs EEA WEI+ et Copernicus EDO livrés, aucune donnée
  publiée. Voir [`handoffs/WAVE_A_EU_CONNECTORS.md`](./handoffs/WAVE_A_EU_CONNECTORS.md).
- P00 à P05, P03B et P03C : fusionnés.
- `/water` reste le cockpit authentifié ; `/water-intelligence` reste un shell
  public sans données.
- Dernière migration en base : `043`. Wave B n'en attend aucune.

## Décisions ouvertes qui pèsent sur Wave B

1. **Période aplatie par P03** — `derive_observations()` fixe
   `period_start == period_end` et ne recopie pas les métadonnées du draft.
   Wave A a contourné en encodant le trimestre dans le `metric_code`. Hub'Eau
   expose de vraies chroniques : cet arbitrage (P10) devra être rendu, ou la
   convention `metric_code` reprise à l'identique et documentée comme telle.
2. **Copernicus EDO bloqué** — décodage raster refusé sans ADR ; à exclure du
   snapshot public tant que l'arbitrage n'est pas rendu.
3. **Enregistrement WRI** — toujours non effectué ; aucune valeur Aqueduct
   publiable. Sans effet sur Wave B.

## Contrats à respecter d'emblée

- **Erreurs** : `AdapterError` (et sous-classes) pour toute erreur métier
  attendue levée en `parse`/`normalize` ; `PipelineDataUnavailableError` pour
  une géographie non résolue au stage `derive` ; `TransportError` pour le
  transport ; `PipelineError` pour les bornes et le plan. Aucun
  `except Exception` général.
- **Décodeur de page** : toujours choisi explicitement
  (`JsonPageDecoder`/`TextPageDecoder`/`RawBytesPageDecoder`), jamais deviné.
- **Licence** : aucun connecteur ne construit de `WaterLicenseDecision` ; la
  porte reste pilotée par l'appelant. Sans décision, tout est `value_withheld`.
- **Catalogue** : `source_code` inconnu du catalogue P01b = refusé au stage
  `plan`. Les codes Hub'Eau (`HUBEAU_HYDROMETRIE`, `HUBEAU_ADES`,
  `HUBEAU_BNPE_PRELEVEMENTS`, `HUBEAU_QUALITE_SURFACE`) y figurent déjà, avec
  `license_status: unknown` — à vérifier avant toute publication.

## Point d'attention majeur

Le socle Hub'Eau sera le **premier transport réellement réseau** du chantier.
`Transport.fetch_page()` est le seul point d'insertion prévu. Le
MACRO-PROMPT B impose : allowlist d'hôtes officiels, endpoint explicite,
pagination, timeout, retry borné, backoff, limites de pages et d'octets,
filtre géographique obligatoire, fenêtre temporelle obligatoire pour les
chroniques, logs sans secret, et **aucun appel pendant les tests ou le
runtime**.
