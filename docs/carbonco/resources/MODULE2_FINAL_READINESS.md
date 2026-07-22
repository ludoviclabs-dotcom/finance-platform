# MODULE 2 — READINESS FINAL (MVP)

> **Module :** Ressources stratégiques & dépendances industrielles étendues.
> **Date :** 2026-07-22 · **Base :** `origin/master` = `6479e11` · **Schéma prod :** `043`.
> **Statut :** `MODULE2_MVP_COMPLETE` — **live et vérifié en production**.
> Complète `MODULE2_INTEGRATION_REPORT.md` (preuves) et `MODULE2_HANDOFF.md` (état / NEXT_ACTION).

---

## 1. Posture de readiness

Le MVP Module 2 est **complet, appliqué et fonctionnel en production**. Les quatre tranches
(M2A catalogue, M2B moteur d'assessment, M2C cockpit, M2D démonstration) sont mergées ; la
migration `043` est appliquée au ledger de production ; les deux correctifs d'infrastructure
découverts pendant l'intégration (runtime Python Vercel, migrations au cold start) sont résolus,
mergés et confirmés en production. **Aucune précondition ouverte.**

| Dimension | Prêt ? | Commentaire |
|---|---|---|
| Périmètre MVP livré | ✅ | Catalogue, expositions, moteur auditable, cockpit lecture, démonstration fictive |
| Garanties méthodologiques | ✅ | Risque≠confiance, manquant≠zéro, sourcé-ou-avoué, jamais de fusion inter-étapes, jamais « note officielle UE » |
| Sécurité / isolation | ✅ | RLS gen-2 FORCE + défense applicative + anti-IDOR + immutabilité des runs |
| Sourcing / preuve | ✅ | Evidence Kernel réutilisé ; gate licence dégrade la confiance, jamais le risque |
| Frontière Défense/Spatial | ✅ | Usages = classification supply-chain seule ; aucune colonne technique |
| Local-first / zéro live externe | ✅ | 0 appel HTTP ; démo `synthetic=true` |
| Tests | ✅ | Backend 1030/0 fail ; frontend 246/246 ; parité démo 5/5 ; DB-gated verts en CI |
| **Migration 043 en base de prod** | ✅ | Appliquée (apply run `29934245339`) ; `/health/schema=043` |
| **Backend `carbonco-api` en prod** | ✅ | `dpl_9Jm8JXb` READY, `/health`=`6479e11`, runtime Python autodetect |
| **Migrations startup en prod** | ✅ | Désactivées ; plus de `permission denied` au cold start |
| **Frontend `carbon` en prod** | ✅ | READY, application complète servie |

---

## 2. Périmètre MVP livré

### 2.1 Backend (`apps/api`)
- **Catalogue transversal** `resource_catalog` + alias legacy (pont `material_id TEXT` sans réécriture),
  statuts réglementaires **non exclusifs et sourcés** (une ligne par régime), usages sectoriels
  (classification supply-chain seule).
- **Expositions** `company_resource_exposure_links` : pont tenant → objet existant (BOM/achat/énergie/
  eau/déclaration/manuel), exactement une cible, **aucun recalcul carbone** (D-4).
- **Moteur d'assessment PUR** `services/resources/scoring.py` : HHI **0-10000**, couverture, substituabilité
  séparée, evidence_coverage, **risque≠confiance**, `risk_score=None` si concentration absente, `input_hash`
  déterministe, sensibilité OAT ±20 %.
- **Runs immuables** + dimensions inspectables (provenance par composante).
- **API** : 14 endpoints `/resources/*`, `schema_ready_guard` (503 `schema_not_ready`), pagination,
  lecture `get_current_user` / écriture `require_analyst`.

### 2.2 Frontend (`apps/carbon`)
- 5 pages `/resources` (catalogue, fiche `[slug]`, expositions, assessments, méthodologie).
- Client typé + agrégateur HHI pur côté client + `SchemaNotReadyError`.
- Composants **décomposés** : jamais de jauge opaque, risque et confiance séparés, « donnée manquante »
  (jamais 0), provenance par composante, indice secondaire + disclaimer non officiel, motion `motion-safe:`.
- Feature `resources-module` (**beta**) enregistrée.

### 2.3 Démonstration (`/demo/asterion-resources`)
- Séquence « Dépendances industrielles étendues » : 10 beats rendant les **vrais** composants `/resources`
  avec 5 ressources synthétiques ; `DemoShell` rétrocompatible (`/demo/asterion-motion` intact) ; seed via
  le **moteur réel** (idempotent `input_hash`). 100 % fictif, tenant-scoped, zéro appel externe.

---

## 3. Reports fonctionnels (documentés, non bloquants)

- **Émission de signal IRO** (`origin_domain='strategic_resources'`, D-5) : `iros_origin_domain_check`
  non élargie ; `iro_signal_id` FK nullable forward-compatible.
- **`resource_roles` / `resource_stage_applicability`** (D-1/D-6) : rôle porté par colonne, étapes dérivées
  des observations ; tables dédiées reportées à la première famille qui les consomme.
- **Union du legacy `material_stage_observations`** dans le HHI ressources : pont par alias prévu, non câblé.
- **Risque-pays v2 (WGI)** (D-3) : MVP = `third_country_dependency` ; v2 gated (licence + release + confiance
  séparée).
- **Analyse de sensibilité** (O-5) : OAT ±20 % livrée ; extensions ouvertes.
- **ESRS simplifiés** (O-9) : acte délégué non adopté — aucun champ figé dessus.

---

## 4. Go / No-Go

| Décision | Verdict |
|---|---|
| MVP Module 2 complet (code) | ✅ **GO** |
| Migration 043 en production | ✅ **GO** (appliquée, `/health/schema=043`) |
| API `/resources/*` servie en production | ✅ **GO** (`carbonco-api` READY sur `6479e11`) |
| Cockpit `/resources` + démo fonctionnels | ✅ **GO** (frontend READY) |
| Runtime prod propre (pas de bruit cold start) | ✅ **GO** (migrations startup désactivées) |
| Démarrer un futur pack (EUDR, etc.) | ✅ possible — **sur décision explicite de Ludo**, une PR à la fois |

**Synthèse : Module 2 MVP est en production, complet et vérifié. Aucune précondition résiduelle.**
Prochaine étape au choix de Ludo : **pack EUDR** (`MODULE2_FUTURE_PACKS.md` §1) **ou audit produit final**.

---

## 5. Opérations post-clôture (optionnelles, décision Ludo)

- **Démo « vivante »** : `demo-scenario action=seed mode=commit` (gate `production-db`) pour peupler le
  tenant `asterion-motion-demo` (schéma prod déjà à 043). La cinématique fonctionne déjà hors-ligne sans seed.
- **Rapport formel `DB Migrate verify`** (run `29935638849`) : approuver le gate pour archiver le JSON
  `anomalies=[]`/`checksum_mismatches=[]` (état déjà cross-confirmé par `/health/schema`).
- **Nettoyage `ensure_schema()`** : suppression du code historique inerte, hors périmètre de la clôture.
