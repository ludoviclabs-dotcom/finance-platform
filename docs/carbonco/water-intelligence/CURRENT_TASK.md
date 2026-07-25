> **Mission active — Wave C (MACRO-PROMPT C) uniquement.**
> **Ne pas lancer la Wave D.**

# Wave C — Produit public (P10 read model + P11 carte + P12 contenus)

**Branche :** `feat/water-intelligence-wave-c-public-data-product`
**Base :** `master` @ `daaf8f0`
**Prompt de référence :** `ACCELERATED_CLOSEOUT_PACK_V2.md` → MACRO-PROMPT C.
**Conception :** [`ux/`](./ux/) — blueprint fusionné (PR #154). **Source de
vérité de l'UI ; ne pas le modifier.**

---

## État à l'entrée

| Vague | Statut | PR | Merge SHA |
|---|---|---|---|
| Wave A — connecteurs européens (P06 + P09) | **fusionnée** | #153 | `e36c97c` |
| Blueprint UX/UI Wave C | **fusionné** | #154 | `a56ab62` |
| Wave B — famille Hub'Eau (P07 + P08) | **fusionnée** | #155 | `daaf8f0` |

- P00 à P05, P03B et P03C : fusionnés.
- `/water` reste le cockpit authentifié, **inchangé par la Wave C**.
- `/water-intelligence` est la surface publique à intégrer.
- Dernière migration en base : `043`. Wave C n'en attend aucune.

## Acquis à réutiliser

1. **`PeriodResolver`** (Wave A) — livré et utilisé par toutes les chroniques.
   Les `metric_code` sont stables et ne portent jamais de date. Le
   contournement par `metric_code` est **caduc**.
2. **Connecteurs en dry-run** : EEA WEI+ (Wave A), hydrométrie, piézométrie,
   prélèvements BNPE, qualité des cours d'eau (Wave B). Aucun n'a encore
   publié quoi que ce soit.
3. **Socle Hub'Eau borné** — allowlist d'hôtes, URL composée, `next` jamais
   suivi, budgets, journal sans secret, aucun client HTTP importé.
4. **Contrats P02** (`models/water_intelligence.py` ↔
   `lib/water-intelligence/contracts.ts`) et **primitives `Wi*`** du shell P04.

## Gate licence — à appliquer AVANT tout code de snapshot

1. Inventorier les sources disponibles.
2. Vérifier stockage, affichage, dérivation, attribution.
3. **Exclure toute source sans décision humaine explicite.**
4. **Exclure WRI** tant que l'enregistrement n'est pas tranché.
5. Inscrire chaque exclusion **dans le manifest**, avec son motif.

`unknown` ne devient **jamais** autorisé. Identifier la licence générale
d'une plateforme (Etalab pour Hub'Eau, CC BY pour l'EEA) **ne rend pas** ses
jeux publiables : il faut une décision humaine explicite et revue.

**Conséquence attendue du MVP :** il est probable qu'aucune couche ne soit
publiable. Cet état vide doit être **valide, testé et correctement rendu** —
c'est le comportement honnête, pas une régression.

## Décisions ouvertes qui pèsent sur Wave C

1. **Identité persistée d'une série temporelle.** `ObservationDraft.dedup_key()`
   retourne `(subject_type, subject_key, metric_code)` — **sans période**. La
   Wave B produit de vraies chroniques : réutiliser cette clé telle quelle
   écraserait silencieusement toutes les périodes sauf la première. **C1 doit
   créer une identité propre à Water Intelligence**, sans modifier le contrat
   PR-04 partagé avec `/materials` sans démonstration de non-régression.
2. **WRI Aqueduct** — enregistrement non effectué ⇒ **exclu du snapshot**.
3. **Copernicus EDO** — `source_verified_decoder_deferred` ⇒ **exclu du
   snapshot**, aucune valeur décodée.

## Interdictions structurantes (héritées, non négociables)

- aucun **score composite**, aucune fusion de dimensions ;
- **risque ≠ confiance**, **absence ≠ zéro**, **non apparié ≠ risque faible** ;
- aucune **donnée tenant** sur la surface publique ;
- aucun **appel externe au runtime** ;
- **aucune fixture affichée** comme une donnée (décision P04B) ;
- aucune **conclusion de conformité** (registre juridique = P13, Wave D) ;
- aucune **conversion silencieuse d'unité** (l/s, mm, m NGF, m, m³) ;
- aucun **prélèvement manquant rendu à zéro**.

## Contrats à respecter

- **Erreurs** : `AdapterError` en `parse`/`normalize` ;
  `PipelineDataUnavailableError` pour géographie **ou période** non résolue en
  `derive` ; `TransportError` pour le transport ; `PipelineError` pour les
  bornes et le plan.
- **Licence** : aucun connecteur ne construit de `WaterLicenseDecision` ; sans
  décision explicite, tout est `value_withheld`.
- **UI** : thème `--wi-*` uniquement, jamais `--mx-*` ni palette Tailwind
  brute ; Server Components par défaut ; `use client` seulement pour une
  interaction réelle ; aucune nouvelle dépendance.
