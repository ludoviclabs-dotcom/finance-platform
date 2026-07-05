# PLAN D'ACTION CARBONCO — Juin → Décembre 2026

> Fichier destiné à Claude Code. Déposer à la racine du repo (ou dans `docs/`) et travailler tâche par tâche.
> Contrainte budgétaire : **aucune API payante ni abonnement dans les phases P0 → P5.** Tout ce qui coûte de l'argent est isolé en P6 (différé) et ne doit PAS être démarré.

---

## 0. MODE D'EMPLOI (pour Claude Code)

1. Traiter les phases dans l'ordre : **P0 → P1 → P2 → P3 → P4 → P5**. P3 peut démarrer en parallèle de P2 dès que T1.1 est terminée.
2. **Une tâche = une branche = une PR.** Nommage : `feat/T2.1-evidence-par-datapoint`, `fix/T0.3-terminologie-esrs`.
3. Avant de coder une tâche : relire ses **Critères d'acceptation (CA)**. Une tâche n'est terminée que si tous les CA sont vérifiables (test automatisé ou capture reproductible).
4. Cocher la case `[ ]` du titre de tâche dans CE fichier à chaque merge, et ajouter une ligne au `CHANGELOG.md`.
5. À la fin de chaque phase : mettre à jour `/etat-du-produit` et `/couverture` (via le registre de features, cf. T0.2) avec la date du jour.
6. En cas d'ambiguïté : choisir l'option la plus sobre/honnête et noter la décision dans la PR. Ne jamais résoudre une ambiguïté en ajoutant une promesse marketing.

### Garde-fous absolus (s'appliquent à toutes les tâches)

- ❌ Ne jamais créer ou conserver : témoignages fictifs, logos clients fictifs, chiffres clients fictifs, mentions d'entité légale inexistante, claims "disponible" pour une feature non livrée.
- ❌ Ne jamais introduire de clé API payante, de SDK nécessitant un abonnement, ni de service sans free tier (vérifier avant tout `npm install` / `pip install` lié à un service externe).
- ✅ Tout statut produit affiché sur le site provient EXCLUSIVEMENT de `apps/carbon/data/feature-status.json` (T0.2). Aucun statut codé en dur dans un composant.
- ✅ Respecter le contrat de données `CC_*` (`docs/carbonco/BLOCK_A_DATA_CONTRACT.md`) : aucun nouveau champ consommé sans entrée au contrat.
- ✅ Les classeurs masters (`docs/carbonco/workbook_master_registry.json`) sont en lecture seule pour le code.
- ✅ Secrets uniquement via variables d'environnement ; mettre à jour `.env.example` à chaque nouvelle variable.
- ✅ Tests (pytest côté API, vitest/Playwright côté front) verts avant merge.

### Décisions humaines requises (NE PAS trancher dans le code — demander à Ludo)

| ID | Décision | Défaut appliqué si silence |
|---|---|---|
| D1 | Vitrine : purge commerciale + bandeau "Programme pilote" (recommandé) OU bandeau "Démonstrateur technique — données fictives" | Purge + programme pilote (annexe A) |
| D2 | Entité légale : tant qu'aucune société n'est immatriculée, retirer toute mention "CarbonCo SAS" | Retrait, remplacé par "CarbonCo — projet édité par [Prénom Nom]" |
| D3 | Achat du domaine `carbonco.fr` (~10 €/an — seul micro-achat recommandé, optionnel) | Canonical = URL de déploiement réelle via env (T0.6) |
| D4 | Stockage objet : Vercel Blob (inclus plan Hobby, limites faibles) vs Cloudflare R2 (free tier 10 Go) | Adapter abstrait, backend `vercel-blob` par défaut |

---

## P0 — MISE EN VÉRACITÉ DE LA VITRINE (Sprint 1 · ~3-4 jours · coût : 0 €)

> Objectif : qu'aucun relecteur (DAF, expert-comptable, auditeur, recruteur Big 4) ne puisse prendre le site en défaut factuel. Rien d'autre n'a de valeur tant que P0 n'est pas mergée.

### [x] T0.1 — Purge des claims invérifiables (home + pages)
**Étapes :**
1. Supprimer la section témoignages / "Programme Early Adopter" (citations "M.C.", "T.P.", "E.L." et logos ATELIER·5, Cabinet Lyra, TERRA·ROOTS, N·FINANCE, orbit, AXIS & Co). Remplacer par le bloc "Programme pilote" (annexe A.4).
2. Supprimer le tableau comparatif CarbonCo vs Workiva/Enablon/Greenly. Remplacer par le bloc "Pourquoi la preuve d'abord" (annexe A.5).
3. Supprimer la mention "Conçu avec des experts CSRD & ESG" (ou remplacer par "Construit sur les référentiels publics EFRAG, GHG Protocol et ADEME").
4. Supprimer "Pénalités jusqu'à 2 % du CA mondial" et "Deadline rapport ESRS : exercice 2025" (faux post-Omnibus).
5. Remplacer toute occurrence de "Bilan Carbone" utilisé comme nom de livrable par "bilan GES" ou "empreinte carbone (méthodologie GHG Protocol)" — Bilan Carbone® est une marque déposée (ABC) nécessitant une licence.
6. Remplacer "CarbonCo SAS" partout (footer, mentions légales, CGU) selon D2.
**CA :**
- `grep -ri "SAS\|Early Adopter\|2% du CA\|Workiva\|Enablon" apps/carbon/app apps/carbon/components` ne retourne aucun claim résiduel (hors annexes internes).
- Aucune citation attribuée à une personne ou entreprise non réelle sur tout le site.

### [x] T0.2 — Registre unique des statuts de features (`feature-status.json`)
**Objectif :** rendre structurellement impossible l'incohérence home ↔ `/couverture` ↔ `/etat-du-produit` (ex. actuel : iXBRL "beta" sur la home mais "planifié" sur l'état du produit ; "Multi-sites" promis sur la home, absent de l'état du produit).
**Étapes :**
1. Créer `apps/carbon/data/feature-status.json` : `[{ id, label, description, statut: "live"|"beta"|"planifie", normes: ["ESRS E1", ...], page_detail?, derniere_maj }]`. Initialiser avec le contenu actuel de `/etat-du-produit` (qui est la source la plus honnête), PAS celui de la home.
2. Refactorer `/etat-du-produit`, `/couverture` et les badges/sections features de la home pour consommer ce JSON.
3. iXBRL ESEF → `planifie`. Multi-sites/filiales → `planifie`. SSO/RBAC → `planifie`. Connecteurs ERP/énergie → voir T0.4.
4. Test : un test vitest itère sur le JSON et vérifie que tout label affiché sur la home avec un statut existe dans le registre avec le même statut.
**CA :** modifier un statut dans le JSON met à jour les trois pages sans toucher aux composants ; le test d'intégrité passe.

### [x] T0.3 — Correction de la terminologie ESRS et du discours réglementaire
**Étapes :**
1. Remplacer partout "ESRS Set 2" par "ESRS (Set 1)" ou simplement "ESRS" — le Set 2 désignait les normes sectorielles, abandonnées par l'Omnibus. Vérifier home, `/couverture`, pricing, meta descriptions, OG tags.
2. Remplacer "moteur complet" / "ESRS Set 2 complet" par "127 datapoints prioritaires couverts (sous-ensemble outillé du référentiel ESRS, aligné sur la réduction d'environ 60 % des datapoints actée par l'Omnibus)".
3. Réécrire la section "Le problème" et le sous-titre hero avec la copy post-Omnibus fournie en **annexe A.1 et A.2** (seuils 1 000 salariés ET 450 M€, VSME comme standard de chaîne de valeur, BEGES France).
4. Mettre à jour la mention CBAM du plan Enterprise avec la copy **annexe A.3** (régime définitif 2026, seuil 50 t, certificats fév. 2027).
5. Renommer le lien footer "Guide CSRD 2027" si son contenu est périmé ; sinon créer une page courte "CSRD & VSME après l'Omnibus (2026)" reprenant l'annexe A.1.
**CA :** plus aucune occurrence de "Set 2" hors contexte historique ; les dates et seuils affichés correspondent à l'annexe A ; relecture complète de la home sans claim réglementaire faux.

### [x] T0.4 — Page `/integrations` : vérité sur les connecteurs
**Étapes :**
1. Restructurer la page en trois sections issues du registre T0.2 : **"Disponible"** (uniquement : import Excel structuré ; API REST si elle est réellement documentée sur `/dev` — sinon la passer en beta), **"Imports fichiers (sans OAuth)"** (nouvelle catégorie, voir T5.4 : CSV AWS Customer Carbon Footprint, export GCP Carbon Footprint, relevés Qonto CSV, FEC), **"Roadmap"** (Sage, Cegid, SAP, Dynamics, Pennylane, Qonto OAuth, TotalEnergies, Lucca).
2. Corriger l'erreur technique : remplacer le connecteur "EDF Entreprises — consommations 30 min par PDL" par "Enedis Data Connect (roadmap — API du gestionnaire de réseau, homologation requise)". Supprimer "Engie Pro" tel que décrit (pas d'API publique correspondante).
3. Supprimer les durées de setup ("30 minutes", "OAuth 2.0") pour tout ce qui est en roadmap.
4. Aligner `/etat-du-produit` (qui affirme actuellement "Sage, Cegid, SAP déjà disponibles") sur ce nouveau découpage.
**CA :** chaque connecteur affiché "Disponible" correspond à du code existant dans le repo (chemin cité dans la PR) ; zéro connecteur OAuth tiers affiché comme livré.

### [x] T0.5 — Jeu de données démo unique et cohérent
**Étapes :**
1. Créer `apps/carbon/data/demo-dataset.json` : une seule entreprise fictive clairement étiquetée (totaux par scope, postes, YoY, secteur). Faire converger les chiffres actuellement contradictoires de la home (12 847 t vs 12 480 t, répartitions différentes selon les sections).
2. Brancher toutes les sections de démo (dashboard interactif, cas sectoriels, démo 90 s) sur ce JSON. Les cas sectoriels deviennent 3 variantes du même schéma de données.
3. Corriger les composants sans accents ("Repartition", "Annee", "acces") — typographie française complète.
4. Mention visible sous chaque bloc démo : "Données fictives à but de démonstration".
5. Test de cohérence : somme des postes = total ; somme des parts de scopes = 100 %.
**CA :** un seul fichier de vérité pour tous les chiffres démo ; test de cohérence vert ; zéro caractère non accentué dans les libellés FR.

### [x] T0.6 — SEO, canonical et pages légales honnêtes
**Étapes :**
1. Variable `NEXT_PUBLIC_SITE_URL` ; canonical, OG `og:url` et sitemap générés depuis cette variable (actuellement le canonical pointe vers `carbonco.fr` alors que la prod vit sur `*.vercel.app` → SEO canonicalisé vers le vide si D3 non actée).
2. Mentions légales conformes LCEN version "projet" : éditeur réel (personne physique), hébergeurs (Vercel, Neon) avec adresses, contact. Aligner CGU/confidentialité (retirer toute référence à une société inexistante, à des "clients" ou à des engagements de SLA non tenus).
3. Page `/trust/sub-processors` : vérifier que la liste = la réalité du repo (Vercel, Neon, Sentry une fois T1.7 faite). Retirer tout sous-traitant non utilisé.
**CA :** `curl` de la home montre un canonical résolvable ; mentions légales sans entité fictive ; liste sous-traitants = dépendances réelles.

---

## P1 — SOCLE TECHNIQUE FIABLE (Sprints 2-3 · ~7-9 jours · coût : 0 €)

### [x] T1.1 — Terminer la Phase 1.B backend (couche preuve en base)
**Référence :** `docs/carbonco/PHASE1_INGESTION_PLAN.md` (spec déjà écrite — l'implémenter telle quelle).
**Étapes :** tables `emission_factors`, `facts_events`, `facts_current` (vue matérialisée) ; fonction `compute_hash` (format `.6f`, séparateur `|`, `GENESIS`) ; `emit_fact` avec `FOR UPDATE` ; `verify_chain` ; RLS (`SET LOCAL app.current_company_id`, `ENABLE` + `FORCE`) sur `facts_events`, `snapshots`, `audit_events`, `alert_rules` ; migration hash de `audit_events` (script idempotent) ; endpoints `/factors`, `/facts`, `/facts/{code}/trail`, `/facts/verify`, `/facts/replay` avec rôles viewer/analyst/admin ; émission de facts depuis `carbon_service`, `esg_service`, `finance_service` via `SNAPSHOT_FIELD_TO_FACT_CODE`.
**Point d'attention Neon :** `FOR UPDATE` + `SET LOCAL` exigent que verrou, SET et INSERT vivent dans la MÊME transaction sur une connexion directe (pas via pooler en mode transaction si le code ouvre plusieurs transactions). Ajouter un test d'intégration qui le vérifie.
**CA :** les critères DoD de la spec — `test_facts_hash` vert sur fixture 100 events ; test d'isolation RLS (user A ne voit pas les facts de B) ; `verify_chain` retourne `{ok: true}` ; trail < 500 ms p95 ; E2E Phase 0/1.A non régressés.

### [x] T1.2 — Seed ADEME Base Empreinte® (gratuit, compte ADEME requis)
**Étapes :**
1. Script `apps/api/scripts/seed_emission_factors.py` : ingestion du CSV d'export Base Empreinte (placé manuellement dans `apps/api/data/` — le téléchargement nécessite un compte ADEME gratuit ; documenter la procédure dans le README du script, ne pas committer le fichier brut si la licence l'interdit).
2. Normalisation vers `emission_factors` : `ef_code` stable (`ADEME.<version>.<slug>`), scope, catégorie, unité, `valid_from/until`, `raw` JSONB complet, version (`v2025`/`v2026`).
3. Inclure les **ratios monétaires** (facteurs en kgCO2e/€) — indispensables pour T4.3 (FEC).
4. Endpoint `/factors` paginé + filtres (scope, catégorie, version, recherche plein texte sur label).
**CA :** `SELECT COUNT(*) FROM emission_factors WHERE version='v2025'` ≥ 500 ; recherche "électricité france" retourne le bon facteur ; chaque facteur affiché en UI montre source + version.

### [x] T1.3 — Ingestion asynchrone (file de jobs sur Postgres, sans Redis)
**Étapes :**
1. Intégrer `procrastinate` (file de tâches Python adossée à Postgres — zéro infra supplémentaire). Worker dédié ; connexion DIRECTE à Neon pour LISTEN/NOTIFY (le pooler ne le supporte pas) — documenter la double URL (`DATABASE_URL` poolée pour l'API, `DATABASE_URL_DIRECT` pour le worker).
2. Migrer l'ingestion de classeurs en job : statut `pending → processing → done|failed`, endpoint de suivi `/ingests/{id}`, polling côté UI (toast de progression).
3. Refresh `CONCURRENTLY` de `facts_current` en fin de job (jamais dans la requête HTTP).
**CA :** upload d'un classeur 40 feuilles → réponse HTTP < 1 s avec `ingest_id` ; le job aboutit en arrière-plan ; un échec produit un statut `failed` avec message exploitable, pas un 500.

### [x] T1.4 — 2FA TOTP (`pyotp` + QR code)
**Étapes :** secret TOTP chiffré en base ; enrôlement (QR via lib `qrcode`, affiché une fois) ; vérification au login ; 8 codes de récupération hashés ; obligation 2FA paramétrable par organisation (défaut : optionnel, obligatoire pour rôle Admin) ; événements `audit_events` (activation, échec, récupération).
**CA :** flux complet testé Playwright (enrôlement → logout → login + code) ; un code invalide 5× ratelimit le compte 15 min ; `/etat-du-produit` mis à jour (retirer "TOTP pas encore implémenté").

### [x] T1.5 — Durcissement uploads + rate limiting
**Étapes :**
1. `slowapi` sur l'API : 100 req/min/IP global, 10 uploads/h/utilisateur, 20 req/min sur `/auth/*`.
2. Uploads : taille max 15 Mo ; vérification magic bytes (xlsx = zip) ; garde anti zip-bomb (ratio décompression max 100×, nombre de feuilles max 60, cellules max 2 M) ; `openpyxl read_only=True data_only=True`.
3. Neutralisation injection de formule sur TOUS les exports Excel/CSV : préfixer `'` toute cellule commençant par `=`, `+`, `-`, `@`, TAB, CR.
4. En-têtes sécurité front (CSP de base, `X-Content-Type-Options`, `Referrer-Policy`) via `next.config`.
**CA :** test unitaire zip-bomb rejeté ; test export contenant `=HYPERLINK(...)` neutralisé ; 11e upload de l'heure → 429.

### [x] T1.6 — Stockage objet abstrait (Evidence Packs, pièces jointes)
**Étapes :** interface `StorageAdapter` (`put/get/delete/signed_url`) avec trois backends : `local` (dev), `vercel-blob` (défaut prod, inclus Hobby — surveiller la limite, lever une erreur claire si quota), `r2` (optionnel, D4). Taille max pièce : 5 Mo. Clés : `org/{company_id}/evidence/{fact_id}/{sha256}.{ext}`.
**CA :** tests des trois backends (local réel, autres mockés) ; aucune écriture disque hors adapter ; URL signées expirables (15 min).

### [x] T1.7 — Observabilité et statut (free tiers)
**Étapes :** Sentry (free tier) front + API avec `release` = SHA de commit ; endpoint `/health` (DB, worker, storage) ; page publique `/status` statique consommant `/health` côté client ; logs structurés JSON côté API.
**CA :** une exception volontaire en staging apparaît dans Sentry avec le bon release ; `/status` reflète une DB coupée en < 60 s.

### [x] T1.8 — Sauvegardes et CI
**Étapes :**
1. GitHub Action cron quotidienne : `pg_dump` de Neon → artefact chiffré (clé en secret GitHub) conservé 30 jours ; doc de restauration testée une fois (runbook `docs/ops/RESTORE.md`).
2. CI sur PR : lint + typecheck + pytest + vitest + **validator de classeurs** (le script Block A devient un gate : toute PR modifiant un master ou le contrat `CC_*` doit passer le validator).
**CA :** badge CI vert requis pour merge ; une restauration de dump documentée et rejouée avec succès en local.

---

## P2 — BOUCLE DE PREUVE COMPLÈTE (Sprints 4-5 · ~5-7 jours · coût : 0 €)

> C'est le différenciateur. Tout ce qui est promis sur la home ("audit trail signé", "/verify/{hash}", "Evidence Pack") doit devenir démontrable bout-en-bout.

### [x] T2.1 — Pièce justificative par datapoint
**Étapes :** upload d'une pièce (PDF/PNG/JPG, 5 Mo max) rattachée à un `fact_id` ; SHA-256 de la pièce stocké dans `facts_events.meta.evidence = [{sha256, filename, size, uploaded_by, uploaded_at}]` via un NOUVEL event chaîné (pas de mutation de l'event d'origine — append-only) ; visualisation inline ; suppression = event de révocation chaîné, le fichier reste adressé par hash.
**CA :** ajouter une pièce crée un event ; `verify_chain` reste vert ; le hash affiché en UI = `sha256sum` du fichier téléchargé.

### [x] T2.2 — Rôle "Auditeur invité" (lecture seule, par lien)
**Étapes :** invitation par email → token scoped (`company_id`, expiration 30 j, révocable) ; vue dédiée : KPIs, trail par datapoint, pièces, statut `verify_chain`, export du pack ; chaque consultation journalisée dans `audit_events` ; aucun droit d'écriture (test RLS + test d'API exhaustif sur les méthodes POST/PUT/DELETE).
**CA :** un auditeur invité peut remonter d'un KPI à la cellule Excel source et à la pièce jointe en ≤ 3 clics ; toute tentative d'écriture → 403 journalisé.

### [x] T2.3 — `/verify/{hash}` public, branché de bout en bout
**Étapes :** génération d'un **manifeste JSON** par export (liste des fichiers du pack + sha256 individuels + hash global + `fact_id` couverts + horodatage) ; page publique sans auth : saisie ou URL d'un hash → statut "authentique / inconnu / altéré" en recomputant côté serveur ; rate-limit dédié ; aucune donnée métier exposée, uniquement le statut et les métadonnées du manifeste.
**CA :** générer un pack, modifier 1 octet du ZIP, re-vérifier → "altéré" ; le hash imprimé en pied de PDF (T2.4) résout sur la page publique.

### [x] T2.4 — Evidence Pack ZIP signé
**Étapes :** job asynchrone (T1.3) assemblant : rapport PDF, export Excel à hash par ligne, pièces jointes, `manifest.json`, `README_VERIFICATION.txt` (procédure de vérification sans outil propriétaire : `sha256sum` + URL `/verify`) ; hash global imprimé en pied de page du PDF.
**CA :** pack téléchargeable depuis l'UI et depuis la vue auditeur ; vérification manuelle `sha256sum -c` documentée et fonctionnelle.

### [x] T2.5 — `verify_chain` planifié + badge de confiance
**Étapes :** job quotidien par organisation ; résultat horodaté en base ; badge dashboard "Chaîne d'intégrité vérifiée le JJ/MM à HH:MM — N events" ; alerte (in-app) si `broken_at`.
**CA :** corruption volontaire d'un `hash_self` en staging → badge rouge + alerte sous 24 h (ou au déclenchement manuel).

### [x] T2.6 — Indicateurs de preuve et de qualité de donnée
**Étapes :** champ `quality` (1-5 : 1=mesure primaire, 2=facture, 3=donnée d'activité estimée, 4=ratio monétaire, 5=extrapolation) sur chaque fact, défaut déduit de `source_path` ; widgets dashboard : % datapoints avec pièce, répartition primaire/estimé, score qualité moyen pondéré, version des FE appliqués (fraîcheur), nombre d'anomalies ouvertes ; ces indicateurs alimentent le "score audit 0-100" existant avec une formule documentée dans `docs/carbonco/AUDIT_SCORE.md`.
**CA :** la formule du score est publiée et reproductible ; les widgets reflètent un changement de qualité en temps réel après ré-ingestion.

---

## P3 — LIVRABLE MARCHÉ : MODULE VSME (Sprints 5-7 · ~7-9 jours · coût : 0 €)

> Le VSME (EFRAG) est le standard volontaire que banques et donneurs d'ordre attendent des PME/ETI hors CSRD ; l'acte délégué est attendu au plus tard le 19 juillet 2026. Le référentiel est public et gratuit. C'est LE produit vendable de CarbonCo en 2026 — avant tout module ESRS supplémentaire (geler E2-E5).

### [x] T3.1 — Modèle de données VSME
**Étapes :** table/seed `vsme_datapoints` reprenant le standard EFRAG (déc. 2024) : **Module Basic B1-B11** et **Module Comprehensive C1-C9** (intitulés en annexe B.1) ; pour chaque datapoint : id (`B3-1`…), libellé FR, type (quantitatif/narratif/booléen), unité, mapping éventuel vers une clé `CC_*` ou un `fact code`, statut de collecte.
**CA :** seed complet versionné ; toute évolution du standard = migration tracée.

### [x] T3.2 — Moteur de mapping existant → VSME + jauge de complétude
**Étapes :** mapper automatiquement ce que CarbonCo possède déjà : E1 → B3 (énergie & GES : scopes 1/2/3, intensités), matérialité ESRS 2 → B1/B2 et C1/C2, S1 (beta) → B8-B10, G1 → B11 et C6/C7 partiels ; écran "Complétude VSME" par module (collecté / manquant / non applicable avec justification) ; saisie guidée des datapoints manquants (formulaires courts, chaque saisie = fact chaîné avec `source_path = manual:user@…`).
**CA :** une organisation ayant complété E1 + matérialité voit B1-B3 ≥ 80 % sans ressaisie ; chaque champ "non applicable" exige une justification stockée.

### [x] T3.3 — Export "Rapport VSME" (PDF + annexe Excel)
**Étapes :** générateur PDF suivant la structure du template EFRAG (sommaire par modules, tableaux quantitatifs, narratifs, périmètre et base de préparation B1) ; annexe Excel : un onglet par module, hash par ligne (réutiliser T2) ; intégration à l'Evidence Pack ; mention de version du standard et des FE utilisés en page de garde.
**CA :** rapport généré sur le jeu démo, relu sans erreur de structure ; chaque chiffre du PDF est cliquable/traçable dans l'app vers son fact.

### [x] T3.4 — Parcours "VSME en 10 étapes"
**Étapes :** wizard onboarding : périmètre (T4.4 si dispo, sinon mono-entité) → import Excel/saisie énergie → questionnaire matérialité allégé → S1 minimal → G1 → revue des anomalies → génération du rapport ; barre de progression persistée ; reprise possible.
**CA :** test Playwright du parcours complet en < 30 min chrono sur le jeu démo, sans cul-de-sac.

### [x] T3.5 — Repositionnement éditorial VSME-first
**Étapes :** home : le bloc principal devient "Votre rapport VSME, auditable" ; pricing : Starter renommé "VSME" (annexe A.6 — sans changer les prix sans décision de Ludo, mais en clarifiant le livrable) ; `/couverture` : ajouter une ligne VSME avec statut réel issu du registre ; article court `/blog` "VSME : le standard de la chaîne de valeur après l'Omnibus" (réutiliser annexe A.1).
**CA :** le mot "VSME" apparaît au-dessus de la ligne de flottaison ; statut VSME = `beta` tant que T3.1-T3.4 ne sont pas toutes mergées, `live` ensuite (via le registre).

---

## P4 — ANCRAGE FRANÇAIS : BEGES, SCOPE 3, FEC, PÉRIMÈTRE (Sprints 7-9 · ~9-12 jours · coût : 0 €)

### [x] T4.1 — Quinze catégories Scope 3 GHG Protocol explicites
**Étapes :** modèle `scope3_category` (1-15, libellés annexe B.2) sur chaque fact/poste concerné ; re-mapping des postes existants ("achats" → 3.1, "transport amont" → 3.4, "déplacements pro" → 3.6, "numérique/cloud" → 3.1/3.8 selon nature…) ; vue dashboard "Scope 3 par catégorie" avec catégories non couvertes affichées en creux (honnêteté sur la couverture partielle).
**CA :** chaque tCO2e Scope 3 porte une catégorie 1-15 ; le total par catégories = total Scope 3 ; les catégories vides sont visibles comme "non évaluées", pas masquées.

### [x] T4.2 — Export BEGES réglementaire (France)
**Étapes :** table de passage GHG Protocol → nomenclature BEGES v5 (6 catégories / 22 postes, arrêté du 25/01/2022 — annexe B.3) ; export tableur + PDF au format attendu pour le dépôt sur la plateforme ADEME (bilans-ges.ademe.fr — dépôt manuel par l'utilisateur, lien et checklist fournis) ; note méthodologique générée (périmètre, FE, incertitudes qualitatives) ; encart d'éligibilité ("obligatoire tous les 4 ans pour les entreprises > 500 salariés en métropole, > 250 en outre-mer").
**CA :** export généré sur le jeu démo conforme à la nomenclature 6×22 ; total BEGES = total GHG après passage (test de réconciliation automatique).

### [x] T4.3 — Import FEC → screening Scope 3 monétaire ⭐
**Étapes :**
1. Parser FEC (format art. A.47 A-1 LPF : 18 champs, séparateur `|` ou tabulation, encodage à détecter) avec validations (équilibre débit/crédit, exercice, doublons).
2. Moteur de mapping comptes de charges (classe 6) → catégories Scope 3 (table de correspondance PCG → cat. 3.x livrée en seed, éditable par l'utilisateur, versionnée).
3. Application des ratios monétaires Base Empreinte (T1.2) → estimation kgCO2e par compte/fournisseur, qualité = 4 (monétaire).
4. Écran de revue obligatoire avant émission des facts (rien n'entre dans la chaîne sans validation humaine) ; chaque fact émis référence `source_path = fec:{filename}:{ligne}`.
5. Restitution : top comptes émissifs, % du spend couvert, suggestion des postes à passer en donnée d'activité réelle.
**CA :** un FEC de test (fixture anonymisée) produit un screening complet en < 2 min ; aucun fact émis sans validation ; le % de spend mappé est affiché et > 90 % sur la fixture.

### [x] T4.4 — Périmètre organisationnel et multi-entités (base)
**Étapes :** réglage par organisation : approche de consolidation (contrôle opérationnel / contrôle financier / parts de capital) avec définition affichée ; hiérarchie d'entités (`companies.parent_id`, % de détention) ; consolidation simple des facts enfants → vue groupe (lecture seule, calculée, jamais ré-émise comme facts) ; le rapport (VSME B1, BEGES) imprime l'approche retenue et la liste des entités.
**CA :** 1 groupe + 2 filiales en démo : la vue groupe = somme pondérée selon l'approche ; changer d'approche recalcule et journalise un event de périmètre.

### [x] T4.5 — Année de référence et politique de recalcul
**Étapes :** baseline gelée par organisation (année + snapshot référencé) ; règles de recalcul déclenchables (changement de périmètre > seuil %, changement de version FE, erreur matérielle) — chaque recalcul = events chaînés avec motif ; affichage systématique "vs année de référence" à côté du YoY ; section dédiée dans le rapport.
**CA :** modifier la version FE et recalculer crée un trail complet motif inclus ; l'ancienne valeur reste consultable dans le trail.

---

## P5 — PILOTAGE & RESTITUTION (Sprints 9-10 · ~5-7 jours · coût : 0 €)

### [x] T5.1 — Courbe de coût d'abattement (MACC)
**Étapes :** modèle `actions` enrichi (investissement €, réduction tCO2e/an, durée de vie) → calcul €/tCO2e ; graphique MACC (barres triées par coût croissant, largeur = potentiel) ; export image/PDF ; données démo issues de l'équivalent `Plan_Transition` du classeur master.
**CA :** la MACC du jeu démo trie correctement ; le coût marginal affiché = invest / (réduction × durée) documenté.

### [x] T5.2 — Plan de transition opérationnel
**Étapes :** actions avec statut (proposée/engagée/réalisée), responsable, jalon, CapEx, lien vers les postes d'émission visés ; vue Kanban + vue trajectoire (émissions projetées si actions réalisées vs trajectoire de référence) ; chaque changement de statut journalisé.
**CA :** cocher une action "réalisée" met à jour la trajectoire projetée ; export PDF "Plan de transition" intégrable au rapport.

### [x] T5.3 — Alertes stabilisées (in-app d'abord)
**Étapes :** moteur de règles simple sur `facts_current` (seuil absolu, variation % vs N-1, donnée manquante à J-X de la clôture) ; centre de notifications in-app ; e-mail OPTIONNEL derrière un flag `EMAIL_ENABLED` (Resend free tier 100/j — ne l'activer que si Ludo crée le compte ; sinon in-app uniquement, zéro dépendance).
**CA :** la règle "gaz +50 % vs N-1" se déclenche sur la fixture ; aucune dépendance e-mail requise pour que la feature soit `live`.

### [x] T5.4 — Adaptateurs d'import fichiers (les "connecteurs" honnêtes et gratuits)
**Étapes :** parseurs de fichiers exportés manuellement par l'utilisateur : **AWS Customer Carbon Footprint (CSV)** → Scope 3 cat. 3.1/3.8 cloud ; **GCP Carbon Footprint (export CSV/BigQuery)** ; **Qonto (export CSV des transactions)** → pré-screening monétaire (réutilise T4.3) ; chaque import = source tracée + écran de revue. Mettre à jour `/integrations` (section "Imports fichiers — disponibles") via le registre.
**CA :** un export AWS CCFT réel (fixture) s'importe et ventile correctement ; la page intégrations reflète le statut sans intervention manuelle.

### [x] T5.5 — Diff multi-exercices et mapping questionnaires
**Étapes :** écran de comparaison de deux snapshots (variations par poste, nouveaux postes, FE changés) ; export "réponses prêtes" mappant les facts vers les questions types des questionnaires clients (CDP allégé / EcoVadis section environnement) en CSV — simple table de correspondance versionnée, pas d'intégration API.
**CA :** le diff de deux exercices démo identifie 100 % des variations injectées ; l'export questionnaire couvre ≥ 20 questions types avec la référence du fact source.

---

## P6 — DIFFÉRÉ : PAYANT / ABONNEMENT — ⛔ NE PAS DÉMARRER SANS DÉCISION EXPLICITE

| Élément | Coût estimé | Condition de déclenchement | Préparation gratuite autorisée dès maintenant |
|---|---|---|---|
| Copilote NEURAL en mode live (API Anthropic via Vercel AI Gateway) | à l'usage (tokens) | 1er pilote réel OU budget dédié | **T6.0 (gratuit, autorisée)** : flag `NEURAL_MODE=demo\|live` ; en `demo`, réponses scriptées clairement labellisées "Démonstration — réponses préenregistrées" ; abstraction `lib/ai/provider` + journalisation des échanges IA dans `audit_events` (prêt à brancher) |
| Serveur MCP `carbonco` (lecture seule : snapshot, trail, facteurs, verify) | dev gratuit ; utile via un client Claude (abonnement côté utilisateur) | après P2 | Spécification d'interface OK ; implémentation possible car coût serveur nul — à classer en bonus de fin de P5 si le temps le permet |
| Domaine `carbonco.fr` + redirection | ~10 €/an | D3 | T0.6 rend le site indépendant de cette décision |
| Connecteurs OAuth réels (Pennylane, Qonto, Enedis Data Connect, Sage…) | comptes partenaires, homologations | demande client réelle | Les adaptateurs fichiers (T5.4) couvrent 70 % du besoin sans OAuth |
| E-mails transactionnels (Resend) | free tier puis payant | activation alertes e-mail | Flag prévu en T5.3 |
| Stripe (billing) | % par transaction | 1er client payant | Aucune |
| Signature qualifiée eIDAS (Yousign/Universign) | abonnement | exigence client | Le hash public `/verify` (T2.3) est la valeur probante de niveau démonstrable |
| iXBRL ESEF (partenaire CoreFiling/ParsePort/IRIS) | 3-8 k€/an | client CSRD réel | Garder statut `planifie` dans le registre |
| Hébergement souverain SecNumCloud (Scaleway/OVH) | infra payante | exigence contractuelle | `StorageAdapter` (T1.6) et l'abstraction DB rendent la migration faisable |
| ISO 27001 / SOC 2 | 20-40 k€ | grand compte | Les pratiques P1/P2 constituent déjà le dossier de preuves |
| Ecoinvent (ACV produit) | licence onéreuse | jamais sans client dédié | Rester sur Base Empreinte |

---

## P7 — SUITE DE L'AUDIT EXTERNE (juillet 2026 · coût : 0 €)

> Origine : audit externe (veille Perplexity) du 02/07/2026, confronté au code réel et aux
> faits réglementaires re-vérifiés. Écarté car déjà livré : module BEGES (T4.2), matrice de
> matérialité (Phase 4), questionnaire fournisseur tokenisé (Phase 4), pages
> /double-materialite (blog) et guide VSME. Écarté car contraire aux garde-fous : comparateur
> concurrents (supprimé en T0.1, non réintroduit), grille tarifaire partenaire inventée,
> export « JSON/XML ADEME » (la plateforme bilans-ges.ademe.fr n'a pas d'API publique de dépôt).
> Corrections apportées au plan source : le scope 3 significatif est OBLIGATOIRE dans le BEGES
> depuis le décret 2022-982 (pas « recommandé ») ; sanctions 50 k€/100 k€ (loi Industrie verte) ;
> le VSME devient « VS » (projet d'acte délégué du 06/05/2026, texte final attendu mi-juillet 2026).

### [x] T7.1 — Pages SEO réglementaires (BEGES, CBAM, Scope 3 fournisseurs, VSME→VS)
`/bilan-carbone-beges`, `/cbam`, `/scope3-fournisseurs` (FAQ + JSON-LD FAQPage, faits sourcés,
capacités produit alignées sur le registre), article blog `vsme-devient-vs-2026`, encart de mise
à jour dans le guide, sitemap.
**CA :** aucune capacité citée au-delà du registre ; faits réglementaires datés et sourcés en pied de page.

### [x] T7.2 — Suivi des dépôts BEGES et rappels de renouvellement
Table `beges_filings` (023, RLS), échéance +4 ans calculée, rappels par paliers J-180/J-30/échéance
(notifications in-app, anti-spam par palier, e-mail optionnel), endpoint cron
`/beges/reminders/run` (CRON_SERVICE_TOKEN), section « Suivi des dépôts » sur `/beges`.
**CA :** 16 tests (29 février, paliers, anti-spam, cron token) verts ; le cron Vercel unique orchestre tout.

### [x] T7.3 — Campagnes de collecte fournisseurs
Table `supplier_campaigns` (024) + tokens rattachés (`campaign_id`, `viewed_at`), import CSV
dédupliqué, invitations en masse, suivi pending/viewed/completed, relances J-14/J-7/deadline
(e-mails fournisseurs derrière EMAIL_ENABLED), revue OBLIGATOIRE des réponses (anomalies pures,
accept → estimation GES fournisseur). Page `/fournisseurs/campagnes`.
**CA :** flux complet testé bout-en-bout en mode /tmp (20 tests) ; rien n'entre sans validation humaine.

### [x] T7.4 — Double matérialité conforme ESRS 1
Règle « OU » (impact OU financier ≥ seuil) remplaçant le produit sqrt(x×y) ; détail par dimension ;
justification par enjeu ; standards ESRS à couvrir déduits ; évaluations archivées immuables (025) ;
export ZIP auditable (domaine `materialite` → `/verify`). Panneau « Versions archivées ».
**CA :** un impact 5/financier 0,5 est matériel (12 tests) ; l'archive reste identique après modification des positions.

### [x] T7.5 — Programme partenaire experts-comptables (fondation)
Page publique `/partenaires` (honnête : existant vs « en construction », pas de tarif inventé),
candidatures en base (026) + pipeline admin, honeypot. Espace multi-dossiers → registre `planifie`.
**CA :** validation e-mail/SIRET, honeypot silencieux, listing admin protégé (13 tests).

### [ ] T7.6 — Espace cabinet multi-dossiers (memberships multi-organisations) — NON DÉMARRÉ
Chantier de sécurité dédié : table d'appartenances user↔organisations, switch de tenant (ré-émission
JWT), revue RLS complète, UI de bascule. À cadrer avant tout code — ne pas livrer approximativement.

---

## ANNEXE A — COPY DE REMPLACEMENT (prête à coller, FR)

### A.1 — Bloc "Le contexte réglementaire" (remplace la section "Le problème")
> Depuis la directive Omnibus (en vigueur depuis mars 2026), seules les entreprises de plus de 1 000 salariés réalisant plus de 450 M€ de chiffre d'affaires restent soumises à la CSRD — environ 10 000 entreprises dans l'UE, avec de premiers rapports attendus en 2028 sur l'exercice 2027. Pour toutes les autres, la pression ne disparaît pas : elle change de canal. Banques, assureurs et donneurs d'ordre exigent des données ESG structurées, et le standard volontaire VSME — dont l'adoption par acte délégué est attendue à l'été 2026 — devient le langage commun de la chaîne de valeur. En France, le bilan d'émissions de GES (BEGES) reste par ailleurs obligatoire pour les entreprises de plus de 500 salariés.

### A.2 — Sous-titre hero
> Votre reporting ESG volontaire (VSME) et votre bilan GES, traçables jusqu'à la cellule source — et vérifiables par votre auditeur sans aucun outil propriétaire.

### A.3 — Encart CBAM (plan Enterprise)
> CBAM : régime définitif depuis le 1er janvier 2026. Les importateurs sous 50 tonnes/an de marchandises couvertes sont exemptés ; au-delà, statut de déclarant agréé requis, achat de certificats à partir de février 2027 et première déclaration annuelle au 30 septembre 2027. CarbonCo aide à estimer l'exposition et à préparer les données d'émissions intégrées.

### A.4 — Remplacement de la section témoignages
> **Programme pilote — 3 places pour l'exercice 2026.** Nous équipons gratuitement trois organisations (PME, ETI ou cabinet) pour produire leur premier rapport VSME auditable, en échange d'un retour d'expérience publiable. Vos données restent en zone UE, votre auditeur dispose d'un accès lecture seule, et chaque chiffre est vérifiable par hash public. → contact@…

### A.5 — Remplacement du tableau comparatif
> **Pourquoi la preuve d'abord.** La plupart des plateformes collectent et calculent. CarbonCo ajoute ce que les auditeurs demandent en premier : un journal inviolable. Chaque donnée porte sa source (fichier, onglet, cellule), sa méthode, son auteur et un hash chaîné SHA-256 ; chaque export inclut un Evidence Pack vérifiable publiquement, sans compte ni outil tiers. Nous publions par ailleurs l'état exact de notre couverture, standard par standard, sur /couverture — y compris ce qui n'est pas encore prêt.

### A.6 — Clarification pricing (sans changer les montants)
> Starter "VSME" : rapport VSME complet (modules Basic), bilan GES Scopes 1 & 2, audit trail, export PDF + Evidence Pack. — Business : + Scope 3 (questionnaires fournisseurs, screening FEC), comparaison multi-exercices, accès auditeur invité. — Enterprise : + multi-entités, consolidation, exposition CBAM. (Les fonctionnalités listées doivent provenir du registre `feature-status.json` avec statut `live` ou `beta` explicitement badgé.)

---

## ANNEXE B — RÉFÉRENTIELS À EMBARQUER

### B.1 — VSME (EFRAG, déc. 2024)
**Module Basic :** B1 Base de préparation · B2 Pratiques, politiques et initiatives futures · B3 Énergie et émissions de GES · B4 Pollution de l'air, de l'eau et des sols · B5 Biodiversité · B6 Eau · B7 Utilisation des ressources, économie circulaire et déchets · B8 Effectifs — caractéristiques générales · B9 Effectifs — santé et sécurité · B10 Effectifs — rémunération, négociation collective et formation · B11 Condamnations et amendes pour corruption.
**Module Comprehensive :** C1 Modèle d'affaires et stratégie · C2 Description des pratiques (approfondie) · C3 Cibles de réduction de GES et transition climatique · C4 Risques climatiques · C5 Caractéristiques additionnelles des effectifs · C6 Politiques droits humains · C7 Incidents graves droits humains · C8 Revenus de certains secteurs / benchmarks d'exclusion · C9 Ratio de diversité de genre dans la gouvernance.
*(Vérifier les intitulés exacts contre le PDF EFRAG lors de T3.1 et corriger le seed si écart.)*

### B.2 — Scope 3 GHG Protocol (catégories 1-15)
3.1 Biens et services achetés · 3.2 Biens d'équipement · 3.3 Énergie et carburants (amont, hors S1/S2) · 3.4 Transport et distribution amont · 3.5 Déchets générés · 3.6 Déplacements professionnels · 3.7 Domicile-travail · 3.8 Actifs loués (amont) · 3.9 Transport et distribution aval · 3.10 Transformation des produits vendus · 3.11 Utilisation des produits vendus · 3.12 Fin de vie des produits vendus · 3.13 Actifs loués (aval) · 3.14 Franchises · 3.15 Investissements.

### B.3 — BEGES réglementaire v5 (arrêté du 25/01/2022 — 6 catégories / 22 postes)
1. Émissions directes · 2. Émissions indirectes liées à l'énergie · 3. Émissions indirectes liées au transport · 4. Émissions indirectes liées aux produits achetés · 5. Émissions indirectes liées aux produits vendus · 6. Autres émissions indirectes.
*(Charger la table détaillée des 22 postes depuis la documentation ADEME lors de T4.2 ; dépôt manuel sur bilans-ges.ademe.fr.)*

### B.4 — FEC
Format de l'article A.47 A-1 du LPF : 18 champs obligatoires (JournalCode, JournalLib, EcritureNum, EcritureDate, CompteNum, CompteLib, CompAuxNum, CompAuxLib, PieceRef, PieceDate, EcritureLib, Debit, Credit, EcritureLet, DateLet, ValidDate, Montantdevise, Idevise), séparateur `|` ou tabulation.

---

## ANNEXE C — MODÈLE DE TÂCHE & CONVENTIONS

**Modèle pour toute nouvelle tâche ajoutée au plan :**
```
### [ ] Tx.y — Titre
Objectif : (1 phrase, valeur utilisateur)
Étapes : (numérotées, fichiers probables)
CA : (critères testables uniquement)
Dépend de : / Estimation :
```

**Conventions :** commits conventionnels (`feat:`, `fix:`, `chore:`, `docs:`) préfixés de l'ID de tâche ; toute nouvelle variable d'env documentée dans `.env.example` ; toute page de transparence modifiée porte "Dernière mise à jour : <date>" ; jamais de données réelles dans les fixtures (anonymisation systématique).

**Récapitulatif charge (solo, indicatif) :** P0 ≈ 3-4 j · P1 ≈ 7-9 j · P2 ≈ 5-7 j · P3 ≈ 7-9 j · P4 ≈ 9-12 j · P5 ≈ 5-7 j → **36 à 48 jours-homme**, soit environ 4 à 5 mois en soirées/week-ends. Jalon de visibilité maximal : fin P3 (rapport VSME auditable démontrable), atteignable avant l'automne.

---

## ANNEXE D — PÉRIMÈTRE « INTELLIGENCE » (décisions du 5 juillet 2026)

Suite à l'intégration du module Matières premières critiques (`/materials`), les
axes d'extension évoqués en brainstorm ont été arbitrés. Objectif inchangé :
**professionnaliser l'existant sans pivot de positionnement** — CarbonCo reste
une plateforme de conformité CSRD/VSME ; les modules d'exploration éclairent la
conformité, ils ne la remplacent pas.

### D.1 — Intégré (juillet 2026)
- **Matières premières critiques** : bande module sur la homepage (chiffres réels
  du snapshot au build), pont Scope 3/double matérialité sur `/materials`,
  entrée au registre `feature-status.json` (statut `live`), callout sur `/produit`.
- **Animations unifiées** : `Reveal` et `AnimatedCounter` extraits vers
  `components/ui/` (le hook d'origine était neutralisé depuis 66ce7ea —
  scroll-reveal restauré avec garde-fous reduced-motion + no-IntersectionObserver).

### D.2 — Hors périmètre (décision explicite — ne pas démarrer)
- **Nucléaire / géopolitique** (réacteurs, sanctions, routes maritimes) : aucune
  donnée en base, éloignés de la mission conformité — registre « plateforme de
  renseignement » écarté.
- **Live feed / ticker temps réel** : contraire à l'architecture locale-first
  (fraîcheur = batch hebdomadaire Git, aucune API au runtime).
- **Moteur de scénarios génératif** (« restriction Gallium → impacts ») :
  impossible sans graphe matière→secteur structuré en base ; une réponse générée
  sans données citées violerait la règle « no uncited normative answer ».

### D.3 — Candidats futurs (dans cet ordre, si extension décidée)
1. **Décarbonation — bibliothèque de leviers + modélisation de site industriel** :
   seul axe directement aligné avec la mission (réduire, pas seulement déclarer).
   Nouveau modèle de données (leviers : coût/gain CO2/TRL/ROI), chantier séparé.
2. **Scope 1 combustion — formulaire direct** : les facteurs ADEME
   énergie/carburants (gaz, fioul, kérosène, GNV…) sont déjà en base
   (`emission_factors`, 502 entrées) et câblés dans le screening FEC ; il manque
   seulement une UI de saisie directe des consommations.
3. **Eau — au-delà du datapoint VSME B6-1** : la consommation (m³) est déjà
   collectée ; une surcouche « stress hydrique » serait un nouveau pilier — à
   n'ouvrir que sur demande client documentée.
