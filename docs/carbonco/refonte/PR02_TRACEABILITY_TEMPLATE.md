# PR-02 — `feat/schema-migration-ledger` · Gabarit de traçabilité

**À utiliser à la fin de l'implémentation de chaque sous-PR** (le découpage A/B/C est décidé, voir `PR02_ARCHITECTURE_PLAN.md` §21) — dupliquer ce gabarit une fois par sous-PR, sur le modèle de `PR01_TRACEABILITY.md`. Ce document est un **gabarit vide** — aucune case n'est cochée, aucun statut n'est encore réel. Remplir au fur et à mesure, pas après coup.

**Répartition des sections par sous-PR** — lors du remplissage d'une traçabilité PR-02A, marquer **NON APPLICABLE** (pas « À REMPLIR ») toute exigence hors de sa colonne :

| Section du §1 | Sous-PR |
|---|---|
| Registre et découverte (1.1-1.7) | **PR-02A** |
| Concurrence et transactions (2.1-2.5) | PR-02B |
| Migrations manuelles / `requires_owner` (3.1-3.5) | PR-02B |
| Baseline (4.1-4.7) | PR-02B |
| CLI (5.1-5.9) | PR-02B (`plan`/`status` en lecture seule peuvent être livrés dès PR-02A si le CLI existe déjà à ce stade — à noter explicitement si c'est le cas) |
| Santé et observabilité (6.1-6.3) | PR-02B |
| GitHub Actions et déploiement (7.1-7.5) | PR-02C |
| Retrait de l'ancien mécanisme (8.1-8.3) | PR-02C uniquement |

> Convention de statut : **FAIT** · **PARTIEL** · **NON FAIT** · **NON APPLICABLE**.

---

## 1. Exigences PR-02 et statut

### Registre et découverte

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 1.1 | Table `schema_migrations` créée avec le schéma exact de `PR02_ARCHITECTURE_PLAN.md` §5 | À REMPLIR | |
| 1.2 | Découverte déterministe des fichiers (regex + tri `(int, suffix)`, pas un tri lexicographique brut) | À REMPLIR | |
| 1.3 | Ordre stable vérifié explicitement pour 008/008b/009 | À REMPLIR | |
| 1.4 | Checksum SHA-256 sur octets bruts, calculé et stocké | À REMPLIR | |
| 1.5 | Détection des migrations déjà appliquées (`load_records`) | À REMPLIR | |
| 1.6 | Détection des fichiers appliqués puis modifiés (`ChecksumMismatchError`) | À REMPLIR | |
| 1.7 | Plan calculé avant toute exécution (`build_plan`, aucune écriture) | À REMPLIR | |

### Concurrence et transactions

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 2.1 | Advisory lock PostgreSQL de session, clé documentée | À REMPLIR | |
| 2.2 | Budget de nouvelle tentative borné (pas de blocage indéfini) | À REMPLIR | |
| 2.3 | Une transaction par migration, sur connexion unique tenue pour tout `apply_plan()` | À REMPLIR | |
| 2.4 | Gestion explicite des migrations non transactionnelles (champ `transactional`) | À REMPLIR | |
| 2.5 | Deux runners concurrents : un seul progresse (test dédié) | À REMPLIR | |

### Migrations manuelles / `requires_owner`

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 3.1 | Gestion déclarative des migrations `requires_owner` (manifeste, pas de liste cachée dans le runner) | À REMPLIR | |
| 3.2 | `MANUAL_ONLY_PREFIXES` / gate `RLS_FORCE` de l'ancien système retirés ou reliés au nouveau manifeste | À REMPLIR | |
| 3.3 | `mark-applied`/`mark-manual-verified` exige `applied_by` + preuve | À REMPLIR | |
| 3.4 | 027 déclarée `requires_owner=true` et vérifiée comme telle dans le plan | À REMPLIR | |
| 3.5 | Décision D-3 tranchée (état réel de 004/009) avant leur baseline | À REMPLIR | |

### Baseline

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 4.1 | Baseline vérifie chaque version objet par objet (jamais aveugle 001→027) | À REMPLIR | |
| 4.2 | Base neuve : toutes les versions `pending`, `apply` fonctionne de bout en bout | À REMPLIR | |
| 4.3 | Base de test vide : identique à base neuve | À REMPLIR | |
| 4.4 | Base de développement partielle : baseline différentielle correcte | À REMPLIR | |
| 4.5 | Base preview : comportement tranché selon D-1 | À REMPLIR | |
| 4.6 | Production complète : dry-run cohérent avec l'inventaire §3 du plan d'architecture | À REMPLIR | |
| 4.7 | 027 spécifiquement vérifiée (table + colonne `actions.site_id` + `relforcerowsecurity`) | À REMPLIR | |

### CLI

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 5.1 | `status` | À REMPLIR | |
| 5.2 | `plan` | À REMPLIR | |
| 5.3 | `apply` | À REMPLIR | |
| 5.4 | `verify` | À REMPLIR | |
| 5.5 | `baseline` (`--dry-run`/`--commit`) | À REMPLIR | |
| 5.6 | `mark-applied` | À REMPLIR | |
| 5.7 | Sorties `--json` disponibles sur toutes les commandes | À REMPLIR | |
| 5.8 | Codes de sortie stables et documentés (0/1/2/3/4) | À REMPLIR | |
| 5.9 | Confirmation renforcée en production (D-2 tranchée) | À REMPLIR | |

### Santé et observabilité

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 6.1 | `GET /health/schema` — réponse publique minimale, aucun secret/SQL exposé | À REMPLIR | |
| 6.2 | Timeout borné, comportement correct si DB indisponible | À REMPLIR | |
| 6.3 | Logs structurés (tous les champs du plan §18) | À REMPLIR | |

### GitHub Actions et déploiement

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 7.1 | `.github/workflows/db-migrate.yml` créé, `workflow_dispatch` uniquement | À REMPLIR | |
| 7.2 | Environnement GitHub protégé configuré (action manuelle Ludo, hors code) | À REMPLIR | |
| 7.3 | Aucun workflow existant modifié pour déclencher des migrations automatiquement | À REMPLIR | |
| 7.4 | `AUTO_MIGRATE=0` par défaut en production, documenté dans `.env.example` | À REMPLIR | |
| 7.5 | D-4 tranchée (`DATABASE_ADMIN_URL` introduite ou `DATABASE_URL_DIRECT` réutilisée) | À REMPLIR | |

### Retrait de l'ancien mécanisme (PR-02C uniquement)

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 8.1 | `ensure_schema_mw` retiré de `main.py` | À REMPLIR | |
| 8.2 | Aucune migration ne se déclenche plus pendant une requête utilisateur (observé en logs post-bascule) | À REMPLIR | |
| 8.3 | `_SENTINEL_TABLE`/`ensure_schema()` dépréciés ou supprimés proprement | À REMPLIR | |

### Contraintes non négociables (rappel de la mission)

| # | Contrainte | Statut | Preuve |
|---|---|---|---|
| C1 | Une migration appliquée n'est jamais modifiée silencieusement | À REMPLIR | |
| C2 | Une migration échouée n'est jamais marquée appliquée | À REMPLIR | |
| C3 | Deux process ne peuvent pas appliquer la même migration simultanément | À REMPLIR | |
| C4 | La présence d'une seule table ne représente plus l'état complet du schéma | À REMPLIR | |
| C5 | Aucune base existante n'est baselinée aveuglément 001→027 | À REMPLIR | |
| C6 | Une migration `requires_owner` est visible dans le plan mais bloquée en exécution automatique | À REMPLIR | |
| C7 | `schema_migrations` est globale, sans `company_id` | À REMPLIR | |
| C8 | Le runner ne dépend pas du RLS tenant | À REMPLIR | |
| C9 | Aucun secret/SQL sensible exposé par un endpoint public | À REMPLIR | |
| C10 | Aucun rollback automatique destructif inventé | À REMPLIR | |
| C11 | La production Neon n'a pas été modifiée pendant la phase d'architecture | **FAIT** (vérifié à la clôture de cette phase — aucune commande d'écriture n'a été exécutée) |
| C12 | Compatible base neuve / partielle / production existante | À REMPLIR | |

---

## 2. Fichiers modifiés / créés

_À remplir avec la liste réelle, sur le modèle de `PR01_TRACEABILITY.md` §2 — un item par fichier, une ligne expliquant le changement._

### Modifiés

- (vide)

### Créés

- (vide)

---

## 3. Tests associés

_Lister chaque fichier de test avec le nombre de cas et ce qu'il couvre, en reprenant la matrice `PR02_ARCHITECTURE_PLAN.md` §22 comme check-list de couverture._

---

## 4. Commandes exécutées et résultats

| Commande | Résultat |
|---|---|
| `git diff --check` | À REMPLIR |
| `cd apps/api && python -m pytest -q` | À REMPLIR |
| `python -m db.migration_cli plan` (base de test) | À REMPLIR |
| `python -m db.migration_cli baseline --dry-run` (copie structure prod) | À REMPLIR |

---

## 5. Limites restantes

_À remplir — sur le modèle de `PR01_TRACEABILITY.md` §5, avec renvoi explicite vers les décisions D-1 à D-5 non tranchées le cas échéant._

---

## 6. Explicitement reporté aux PR suivantes

- **PR-03 (Evidence Kernel)** : consommateur du ledger comme fondation stable — aucune modification attendue du runner lui-même.
- Nettoyage de la duplication de bootstrap dans `seed_factors.py`/`seed_emission_factors.py` (signalé en `PR02_ARCHITECTURE_PLAN.md` §2, hors périmètre strict PR-02).
- Migration de `seed_admin.py` vers le nouveau CLI plutôt que l'appel direct à `run_migrations()`.

---

## 7. Opérations Neon manuelles effectuées

_Table à remplir avec : opération, version de migration concernée, acteur, date, preuve (commande exécutée ou capture)._

| Opération | Version | Acteur | Date | Preuve |
|---|---|---|---|---|
| (vide) | | | | |
