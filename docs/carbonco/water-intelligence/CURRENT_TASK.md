> **Mission suivante — Wave E (MACRO-PROMPT E) uniquement.**
> **Ne pas démarrer avant revue humaine et fusion de la PR Wave D.**

# Wave E — Finalisation (P16 QA + P17 preview ; P18 optionnel)

**Branche :** `feat/water-intelligence-wave-e-finalisation`
**Prompt de référence :** `ACCELERATED_CLOSEOUT_PACK_V2.md` → MACRO-PROMPT E.

---

## État à l'entrée

| Vague | Statut | PR | Merge SHA |
|---|---|---|---|
| Wave A — connecteurs européens | **fusionnée** | #153 | `e36c97c` |
| Blueprint UX/UI | **fusionné** | #154 | `a56ab62` |
| Wave B — famille Hub'Eau | **fusionnée** | #155 | `daaf8f0` |
| Wave C — produit public | **fusionnée** | #156 | `eb2a898` |
| Wave D — couche décisionnelle | **en revue** | — | — |

- `/water` reste le cockpit authentifié, inchangé par les Waves A à D.
- `/water-intelligence` publie toujours **zéro donnée** : aucune source n'a de
  décision humaine de publication active.
- Dernière migration en base : `043`. Aucune vague n'en a créé.

## Le fait central à comprendre avant Wave E

**Les trois moteurs décisionnels existent et ne sont branchés sur aucune
route.** `water_intelligence` n'a jamais eu de surface HTTP : la Wave D a livré
le registre juridique, la carte des ponts, la synthèse tenant et le moteur
financier — tous purs, tous testés, aucun exposé.

C'est le manque le plus visible du chantier, et c'est le premier candidat de
Wave E. Détail complet : `handoffs/WAVE_D_DECISION_LAYER.md` §9 et §10.

## Acquis à réutiliser

1. **Trois documents canoniques** (`contracts/REGULATORY_REGISTRY.json`,
   `MODULE_BRIDGES.json`, `FINANCIAL_ENGINE.json`), chacun émis par son module
   backend et miroité à l'octet près dans `apps/carbon`. Ne jamais les éditer à
   la main — les régénérer (recette dans le handoff Wave D §6).
2. **Frontière publique/tenant vérifiée mécaniquement** : le paquet
   `services/water_intelligence/` est pur (test AST), le lecteur tenant vit dans
   `services/water/`. Ne pas déplacer un lecteur DB dans le paquet pur.
3. **Dégradation par facette** plutôt que 503 global (synthèse P14) : les tables
   036-043 ne sont pas garanties en production.
4. Acquis des vagues précédentes : `WaterObservationIdentity`,
   `WaterPublicSnapshot`, `PublicationDecisionRegistry`, `PeriodResolver`,
   fondations UI `Wi*` et décideur d'état pur.

## Interdictions structurantes pour Wave E

- **Ne pas instruire le droit à la place d'un humain.** Les neuf règles du
  registre restent `unknown` tant qu'un réviseur juridique désigné n'a pas
  renseigné source officielle et revue signée. Remplir ces champs depuis la
  connaissance d'un modèle est explicitement interdit.
- **Ne pas approuver une source de publication.** Le gate licence de la Wave C
  reste intact : aucune source n'est `approved`, et l'approuver est une décision
  humaine par jeu de données.
- **Ne pas fournir de probabilité de scénario** ni de taux d'actualisation par
  défaut : ce sont des hypothèses humaines.
- **Aucun score ESG global, aucun score hydrique composite** — règle constante
  du chantier depuis la Wave C.
- **Aucune donnée tenant sur `/water-intelligence`.**
- **Si une migration devient nécessaire : arrêter, documenter, proposer une PR
  dédiée — ne pas la créer dans la vague.**

## Reliquat non tranché, hérité de la Wave D

- `WaterLegalStatus` (contrat P02) ne sait pas exprimer `repealed` : la
  conversion depuis le registre perd de l'information. Étendre l'énumération
  toucherait le miroir TS et la fixture gelée. Arbitrage humain requis
  (handoff Wave D §3.4).
- `WaterLegalRecord` exige un `WaterSourceReference` conçu pour un jeu de
  données (release, checksum, licence), pas pour un texte de loi (§3.5).

## Contrats à respecter

- **Erreurs** : `AdapterError` en `parse`/`normalize` ;
  `PipelineDataUnavailableError` pour géographie ou période non résolue en
  `derive` ; `TransportError` pour le transport ; `PipelineError` pour les
  bornes et le plan.
- **Licence** : sans décision explicite et signée, rien n'est publié.
- **UI** : thème `--wi-*`, Server Components par défaut, aucune dépendance
  nouvelle.
