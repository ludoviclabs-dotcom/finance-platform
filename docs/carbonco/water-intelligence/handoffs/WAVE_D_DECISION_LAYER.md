# Wave D — Couche décisionnelle (P13 conformité + P14 synergies + P15 finance)

**Branche :** `feat/water-intelligence-wave-d-decision-layer`
**Base :** `master` @ `eb2a898` (PR #156 Wave C fusionnée le 2026-07-25).
**Périmètre :** MACRO-PROMPT D uniquement. Wave E non lancée.

---

## 1. Le résultat en une phrase

**La couche décisionnelle est livrée, et elle ne décide rien** — parce qu'aucun
texte juridique n'est instruit, aucune donnée tenant n'est publiable, et aucun
montant ne peut être calculé sans hypothèses fournies par un humain. Les trois
moteurs sont réels, testés et inspectables ; leur silence est le résultat
correct de leurs gates, pas un inachèvement.

C'est la même honnêteté que la Wave C, qui a livré un produit public qui ne
publie rien.

## 2. Commits

| Commit | Objet |
|---|---|
| `docs` | D0 — synchronisation du pilotage après la fusion #156 |
| `feat` | D1 — registre juridique versionné + moteur de portée (P13) |
| `feat` | D2 — ponts CarbonCo + synthèse authentifiée (P14) |
| `feat` | D3 — scénarios financiers hydriques (P15) |
| `docs` | D4 — ce handoff + pilotage vers Wave E |

---

## 3. D1 — Registre juridique (P13)

### 3.1 Ce qui est livré, et ce qui est vide

| Livré | État |
|---|---|
| Schéma de règle versionné, historisé | ✅ |
| Moteur de portée (4 verdicts) | ✅ |
| Gate de preuve (source + revue humaine) | ✅ |
| Pont vers le contrat public P02 | ✅ |
| **Contenu normatif des textes** | ❌ **aucun** |

**Aucune règle n'est vérifiée.** Le chantier n'a pas de réviseur juridique
désigné, et la connaissance mémorisée d'un modèle ne vaut pas vérification de
l'état du droit au jour de la lecture. Les neuf entrées nomment les textes à
instruire ; aucune ne porte de date ni de statut.

Conséquence testée : `evaluate()` répond `unknown` pour les neuf règles, avec
le motif `no_official_source`.

### 3.2 Matrice règle / donnée / preuve / module

| `rule_id` | Nature | Juridiction | Preuve manquante | Module CarbonCo concerné |
|---|---|---|---|---|
| `EU_CSRD` | Directive | UE | source, revue, statut, application, transposition | `/esrs`, `/vsme`, `/materialite` |
| `EU_ESRS_SET` | Acte délégué | UE | source, revue, statut, application | `/esrs`, `/materialite`, `/water` |
| `EU_TAXONOMY` | Règlement | UE | source, revue, statut, application | `/esrs`, `/resources` |
| `EU_WATER_LAW` | Directives | UE | source, revue, statut, application, transposition | `/water` (screening, permis) |
| `FR_NATIONAL` | Texte national | FR | source, revue, statut, application | `/water` |
| `GRI_303` | **Volontaire** | Int. | source, revue, statut, application | `/esrs`, `/water` |
| `CDP_WATER` | **Volontaire** | Int. | source, revue, statut, application | `/water` |
| `TNFD_LEAP` | **Volontaire** | Int. | source, revue, statut, application | `/nature` (LEAP déjà implémenté) |
| `SBTN` | **Volontaire** | Int. | source, revue, statut, application | `/nature`, `/water` |

**Quatre entrées sur neuf ne sont pas du droit.** Les présenter au milieu de la
CSRD sans distinction ferait croire à une obligation légale. `instrument_kind`
les sépare, un test l'impose, et la surface les rend dans un groupe distinct.

### 3.3 Ce que le moteur ne calcule jamais

Aucun seuil réglementaire n'est encodé — ni effectif, ni chiffre d'affaires, ni
total de bilan. Le registre déclare des **critères nommés** ; l'entité fournit
des **déterminations humaines** datées, signées et prouvées ; le moteur ne fait
que les composer. Un test AST refuse toute comparaison à un littéral numérique
dans le module.

Conséquence : une évolution de seuil ne casse pas le code, elle change une
détermination.

### 3.4 Écart de vocabulaire signalé, non corrigé

Le contrat P02 déclare `WaterLegalStatus` (huit valeurs, mirroré en TypeScript),
qui **mélange** l'état d'un texte (`in_force`, `proposed`,
`transposition_pending`) et le résultat d'une portée (`out_of_scope`,
`materiality_dependent`), et **ne comporte pas `repealed`**.

Le registre a besoin d'un statut de texte pur, abrogation comprise. Les deux
vocabulaires coexistent donc, avec une conversion explicite et testée
(`to_public_legal_status`). La conversion **perd de l'information** : `repealed`
devient `out_of_scope`, faute de mieux.

**À arbitrer en Wave E ou plus tard** : soit étendre `WaterLegalStatus` (ce qui
touche le miroir TS et la fixture gelée), soit acter la conversion. Non tranché
ici parce que modifier un contrat public gelé dépasse le périmètre de D1.

Écart voisin observé, non traité : `lib/api/resources.ts::ListingStatus` (huit
valeurs) recoupe partiellement `WaterLegalStatusEnum`. Duplication préexistante.

### 3.5 Impédance signalée : une loi n'est pas un jeu de données

`WaterLegalRecord` (P02) exige un `WaterSourceReference`, lui-même porteur d'un
`release_key`, d'un `checksum_sha256` de 64 caractères et d'une décision de
licence. Ce contrat a été conçu pour un jeu de données, pas pour un texte de
loi. Un réviseur devra donc *checksummer le document officiel qu'il a lu* pour
publier une règle dans le manifest — c'est défendable, mais ce n'est pas
évident, et personne ne l'avait écrit.

**Aucun `WaterLegalRecord` n'est produit à ce jour** (aucune règle vérifiée),
donc `legal_records` reste `[]` dans le snapshot public, inchangé.

---

## 4. D2 — Synergies (P14)

### 4.1 Matrice des synergies

| Pont | Cible | Signal hydrique | Sens | Tenant |
|---|---|---|---|---|
| `water_cockpit` | `/water` | stress, sécheresse, nappes, qualité | public → cockpit | non |
| `sites_geo` | `/sites-geo` | rattachement site ↔ bassin | public → cockpit | non |
| `resources_exposures` | `/resources/exposures` | dépendance opérationnelle | public → cockpit | non |
| `materials_public` | `/materials` | intensité hydrique des filières | public → public | non |
| `iro_register` | `/iro` | promotion d'un screening en IRO | public → cockpit | non |
| `materialite` | `/materialite` | matérialité du thème eau (ESRS E3) | public → cockpit | non |
| `energy_scope2` | `/scopes` | dépendance hydrique de l'électricité | public → cockpit | non |
| `procurement_scope3` | `/fournisseurs/scope3` | exposition hydrique amont | public → cockpit | non |
| `actions` | `/actions` | capacité d'adaptation documentée | public → cockpit | non |

Chaque cible correspond à une **route réelle** vérifiée dans `apps/carbon/app`.

### 4.2 Le risque que le registre rend impossible

Un lien écrit à la main dans le JSX peut recevoir un paramètre : `/water?site=12345`.
Ce jour-là, un identifiant de site voyage dans une surface publique, dans
l'historique du navigateur et dans les journaux d'accès.

Trois invariants sont donc vérifiés **à la construction** :

1. un pont partant du public vise un **chemin nu** — aucun paramètre, aucune ancre ;
2. aucun pont public ne peut déclarer transporter du contexte tenant ;
3. aucune cible ne peut contenir `company_id`, `tenant_id`, `site_id`,
   `organisation_id` ou `user_id`.

La page publique tire ses liens du registre : elle hérite du refus au lieu de le
réimplémenter.

### 4.3 Synthèse authentifiée — six facettes, aucun score

| Facette | Source | Vocabulaire nommé |
|---|---|---|
| `risk` | `screening_service.list_screenings` | `water_stress_category_v1` |
| `confidence` | mêmes lignes, champ distinct | `water_screening_confidence_pct_v1` |
| `dependency` | `activities_service.list_activities` | `water_activity_type_v1` |
| `resource_material` | `exposure_link_service.list_links(link_kind="water_activity")` | `resource_exposure_role_v1` |
| `iro` | `iro_service.list_iros(origin_domain="water")` | `iro_type_v1` |
| `action` | `targets_actions_service.list_actions` | `water_action_status_v1` |

**Jamais de score ESG global.** Aucun champ `score`, aucune moyenne, aucune
pondération — vérifié sur la structure sérialisée *et* sur les noms de fonctions
du module. Trois `high` sans rapport coexistent dans le produit (`/water`,
`/resources`, IRO) : chaque entrée porte donc le **nom de son vocabulaire**, et
le module n'expose aucune fonction pour les comparer.

### 4.4 Frontière publique / tenant, vérifiée mécaniquement

| Module | Rôle | Peut lire la base ? |
|---|---|---|
| `water_intelligence/tenant_synthesis.py` | **compose** | non — test AST |
| `water/water_synthesis_service.py` | **lit** | oui, scopé |

Le paquet `water_intelligence` est pur par contrat. Le lecteur tenant vit donc
dans `services/water/`. Cette frontière n'est pas seulement documentée : un test
parcourt tous les modules du paquet et refuse tout import de `db.database` ou
psycopg.

**Trois barrières anti-IDOR**, dans cet ordre : RLS PostgreSQL, prédicat
`company_id = %s` dans chaque service existant, puis échec bruyant
(`CrossTenantEntryError`) si une entrée d'un autre tenant atteint la composition.
Jamais de filtrage silencieux — il masquerait une requête mal scopée.

### 4.5 Dégradation par facette

Les tables 036 à 043 **ne sont pas garanties présentes en production** : le code
est déployé avant l'application des migrations, et 036 exige une étape manuelle
Neon. Avec la garde `schema_ready_guard` classique, une seule table absente
renverrait 503 pour toute la synthèse.

La synthèse dégrade donc **facette par facette** : une source dont le schéma
n'est pas prêt produit une absence motivée (`schema_not_ready`), les autres
facettes restent rendues, et « aucun enregistrement » (`no_record`) reste un
motif distinct. Une erreur qui n'est **pas** un schéma manquant remonte nue.

### 4.6 Aucune migration

Vérifié : le lien ressource ↔ eau existe déjà (`link_kind='water_activity'`,
`role='water'`, migration 043) et le lien screening ↔ IRO passe par
`iros.origin_reference` (convention `site_water_screening:{id}`, migration 040).
Dernière migration du dépôt : **043**, inchangée.

---

## 5. D3 — Scénarios financiers (P15)

### 5.1 Le calculateur

Entrées, toutes explicites et toutes obligatoires sauf la probabilité :

| Paramètre | Unité | Obligatoire |
|---|---|---|
| `outage_days` | jours | oui |
| `affected_capacity_share` | ratio | oui |
| `revenue_per_day` | montant/jour | oui |
| `margin_rate` | ratio | oui |
| `additional_opex_per_day` | montant/jour | oui |
| `adaptation_capex` | montant | oui |
| `discount_rate` | ratio | **oui** |
| `probability` | ratio | non |

Chaîne de calcul, chaque étape portant sa base :

```
jours perdus        = jours d'arrêt × part de capacité affectée
revenu à risque     = jours perdus × revenu journalier
marge à risque      = revenu à risque × taux de marge
surcoût opératoire  = jours perdus × OPEX journalier
total               = marge à risque + surcoût + CAPEX d'adaptation
valeur actualisée   = total ÷ (1 + taux)^(horizon − année de base)
```

### 5.2 Les trois refus

| Refus | Verrouillage |
|---|---|
| Aucune écriture comptable | IAS 36/37, IFRIC 21, continuité, assurance, redevances émis comme **questions à examiner** ; aucune fonction ne peut s'appeler `entry`/`journal`/`posting`/`provision` |
| Aucun taux inventé | `discount_rate` obligatoire ; aucune constante `*RATE*` ; aucun champ `tax_rate`/`inflation_rate` |
| Aucune probabilité produite par un modèle | une probabilité `derived` est refusée ; aucun import de source d'aléatoire |

### 5.3 Décisions de conception

- **Unités contrôlées** : seules quatre combinaisons de produit sont autorisées.
  Multiplier des jours par des jours lève, au lieu de rendre un montant
  plausible et faux.
- **Absence ≠ zéro** : une entrée manquante rend un résultat absent **avec son
  motif**. Un zéro se lirait « pas d'exposition ».
- **Sensibilité plutôt que certitude** : une valeur centrale n'est jamais rendue
  seule. Chaque inducteur varie **séparément** — croiser les variations
  produirait un intervalle qui ressemble à un intervalle de confiance sans en
  être un.
- **Reproductibilité** : `Decimal`, arrondi `ROUND_HALF_EVEN` explicite, montants
  sérialisés en chaînes. Aucun flottant binaire ne traverse la charge.

### 5.4 Surface publique : aucun montant

Le moteur calcule sur des données d'entreprise. La page publique rend donc le
**contrat** du moteur (paramètres, unités, refus, signaux comptables), émis
depuis le code Python, et **aucun montant** — un chiffre d'exemple, même
étiqueté, se lirait comme un ordre de grandeur validé. Même leçon que les
valeurs de fixture retirées en P04B.

---

## 6. Contrats partagés — trois documents, trois miroirs

La Wave D reprend la discipline du `FIXTURE_MANIFEST.json` : le backend **émet**
un document canonique, `apps/carbon` en détient une copie à l'octet près, et la
parité est vérifiée des deux côtés.

| Document canonique | Miroir | Émis par |
|---|---|---|
| `contracts/REGULATORY_REGISTRY.json` | `lib/water-intelligence/regulatory-registry.json` | `regulatory_registry.canonical_json()` |
| `contracts/MODULE_BRIDGES.json` | `lib/water-intelligence/module-bridges.json` | `module_bridges.as_public_document()` |
| `contracts/FINANCIAL_ENGINE.json` | `lib/water-intelligence/financial-engine.json` | `financial_scenarios.contract_document()` |

Aucun de ces documents ne contient de champ tenant — vérifié des deux côtés.

**Régénération** (depuis `apps/api`, après toute modification d'un registre) :

```bash
python -c "import json;from services.water_intelligence.regulatory_registry import current_registry;from services.water_intelligence.module_bridges import current_bridges;from services.water_intelligence.financial_scenarios import contract_document;
open('../../docs/carbonco/water-intelligence/contracts/REGULATORY_REGISTRY.json','w',encoding='utf-8',newline='\n').write(current_registry().canonical_json()+'\n')"
```

Un document désynchronisé fait échouer la CI des deux côtés — il ne doit jamais
être édité à la main.

---

## 7. Previews remplacées, pas complétées

La consigne était explicite. Les deux l'ont été, et `WiPreviewCard` disparaît
avec la dernière plutôt que de rester du code mort :

| Preview supprimée | Remplacée par | Commit |
|---|---|---|
| `WiCompliancePreview` | `WiRegulatory.tsx` (registre réel) | D1 |
| `WiFinancialBridgePreview` | `WiFinancialEngine.tsx` (contrat réel) | D3 |

Les tests qui interdisaient à ces aperçus de rendre un chiffre ou une date ont
été **retirés en connaissance de cause** : ils décrivaient des composants qui
n'existent plus. Les composants qui les remplacent affichent légitimement une
version de registre et des unités, et ont leurs propres suites.

Une régression d'accessibilité introduite au passage a été corrigée : les
nouvelles cartes passaient en `h4` directement sous un `h2`. Niveau aligné sur
la structure, classe inchangée pour la taille — même correctif qu'en Wave C sur
le Water Pulse.

---

## 8. Validation

| Contrôle | Résultat |
|---|---|
| Suite API complète | **1725 passed, 714 skipped**, 0 échec |
| Suite frontend complète | **538 passed, 38 fichiers**, 0 échec |
| Nouveaux tests | **160** (111 backend + 49 frontend) |
| `ruff check . --select=E,F,I --ignore=E501` | propre |
| `tsc --noEmit` | propre |
| `eslint .` | **0 erreur** |
| `npm run build` | réussi |
| `/water-intelligence` | **`○` prérendu statique** |
| `/water` | **`○`, intact** |
| Migrations | **0** (dernière : 043) |
| Dépendances ajoutées | **0** |
| Donnée tenant sur surface publique | **aucune** |
| Score ESG global / hydrique composite | **aucun** |
| Décisions WRI / Copernicus | **inchangées** |
| Blueprint `ux/` | **non modifié** |

---

## 9. Limites connues

1. **Le registre juridique ne conclut rien.** Neuf textes nommés, zéro instruit.
   Lever un `unknown` exige un réviseur juridique désigné qui renseigne source
   officielle, revue signée, statut, date d'application et — pour les directives
   — état de transposition. Tant que ce réviseur n'existe pas, la surface P13
   affiche la liste des champs manquants, ce qui est la seule chose honnête à
   afficher.
2. **La synthèse authentifiée n'a jamais été exercée sur une vraie base.** Les
   tests couvrent la composition et la dégradation avec des doubles ; les
   lectures SQL sont couvertes par les suites de chaque module, mais aucun test
   bout-en-bout tenant A/B n'a tourné contre PostgreSQL. À faire au premier
   déploiement où 036/037 sont appliquées.
3. **La synthèse n'est branchée sur aucune route.** `build_synthesis` existe et
   est testée, mais aucun routeur ne l'expose et aucune page ne la consomme :
   `water_intelligence` n'avait jusqu'ici aucune surface HTTP, et en créer une
   dépassait le périmètre de D2. C'est le premier candidat de Wave E.
4. **Le moteur financier n'a aucun appelant.** Comme ci-dessus : le calcul exige
   des hypothèses d'entreprise, donc une surface authentifiée qui les recueille.
5. **`WaterLegalStatus` perd `repealed`** à la conversion (§3.4) — arbitrage à
   rendre.
6. **Trois îlots clients de la Wave C restent non branchés** (`WiFilterBar`,
   `WiMapCanvas`, `WiProvenanceDrawer`) : ils attendent une couche publiée, donc
   une décision de publication humaine. Inchangé par la Wave D.

---

## 10. Passage vers Wave E

Wave E (P16 QA + P17 preview ; P18 optionnel) hérite d'un chantier où :

- les trois moteurs décisionnels existent, sont purs et testés ;
- **aucun n'est branché sur une route HTTP** — c'est le manque le plus visible ;
- la frontière publique/tenant est vérifiée mécaniquement, pas seulement écrite ;
- aucune migration n'est due, dernière en base : `043`.

Gates d'entrée à respecter avant de démarrer Wave E :

- [ ] PR Wave D fusionnée après revue humaine ;
- [ ] `master` synchronisé ;
- [ ] CI verte ;
- [ ] Preview Vercel vérifiée manuellement sur `/water-intelligence` (les deux
      nouvelles sections P13 et P15 n'ont jamais été regardées par un humain
      dans un navigateur).

Décisions à ne pas prendre à la place d'un humain : désigner un réviseur
juridique, approuver une source de publication, fournir une probabilité de
scénario, ou trancher l'écart `WaterLegalStatus`.
