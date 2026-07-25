# Acceptation temporaire de risque — GHSA-mh99-v99m-4gvg (brace-expansion)

**Statut : ACCEPTÉ TEMPORAIREMENT** · Décision : **2026-07-25** (PR #156)
· Responsable de la revue : **Ludo (mainteneur du dépôt)**
· Prochaine réévaluation : **2026-08-08** (ou plus tôt si un des événements
déclencheurs ci-dessous survient).

## Advisory

| Champ | Valeur |
|---|---|
| GHSA | `GHSA-mh99-v99m-4gvg` |
| CVE | CVE-2026-14257 |
| Sévérité | `high` — CVSS 7.5 (CWE-400 Uncontrolled Resource Consumption, CWE-770 Allocation of Resources Without Limits) |
| Paquet | `brace-expansion` |
| Plage vulnérable | `<=5.0.7` (couvre les branches majeures 1.x, 2.x, 3.x, 4.x et 5.x ≤ 5.0.7 — une seule ligne de correctif maintenue, pas de backport) |
| Version corrigée | `5.0.8` |

## Chemin de dépendance (4 installations distinctes, `npm explain brace-expansion`)

```
carbon@0.1.0 (apps/carbon)

1) brace-expansion@1.1.16  [dev]
   └─ minimatch@3.1.5 ← eslint@9.39.4 (@eslint/config-array, @eslint/eslintrc,
      eslint-plugin-import/jsx-a11y/react ← eslint-config-next@16.2.3)
      devDependency "eslint": "^9"

2) brace-expansion@5.0.7   [dev]
   └─ minimatch@10.2.4 ← @typescript-eslint/typescript-estree@8.57.2
      ← typescript-eslint@8.57.2 ← eslint-config-next@16.2.3
      devDependency "eslint-config-next": "16.2.3"

3) brace-expansion@5.0.7   [dev]
   └─ minimatch@10.2.5 ← test-exclude@7.0.2 ← @vitest/coverage-v8@3.2.6
      devDependency "@vitest/coverage-v8": "^3.2.6"

4) brace-expansion@2.1.2   [présent aussi dans le graphe de PRODUCTION]
   └─ minimatch@9.0.9 ← glob@10.5.0 ← rimraf@5.0.10 ← gaxios@7.1.3
      ← gcp-metadata@8.1.3 ← @opentelemetry/resource-detector-gcp@0.55.0
      ← @opentelemetry/auto-instrumentations-node@0.78.0
      ← inngest@4.3.0 (dependency DIRECTE, production, "inngest": "^4.3.0")
      (même install déduplique aussi le besoin dev de test-exclude/@vitest/coverage-v8)
```

## Portée dev/build vs runtime — vérifiée

- **Chemins 1, 2, 3** : uniquement `devDependencies` (eslint, typescript-eslint,
  vitest coverage). Jamais exécutés en dehors du lint/tests/CI — aucune présence
  dans le bundle applicatif ni dans le runtime Next.js déployé.
- **Chemin 4** : `brace-expansion` **est** atteignable depuis une dépendance de
  production (`inngest`), via l'auto-instrumentation OpenTelemetry GCP. Vérifié
  dans le code : ce chemin n'est emprunté qu'une seule fois, au démarrage du
  process, par la détection de ressource GCP d'OpenTelemetry (`gcp-metadata` /
  `gaxios` interrogent le serveur de métadonnées ; `rimraf`/`glob` n'y servent
  qu'à la résolution de motifs internes fixes, codés en dur dans ces librairies).
  Aucune valeur issue d'une requête utilisateur, d'un upload, ou d'une entrée de
  configuration Water Intelligence n'atteint ce chemin.

## Scénario d'exploitation (CVE-2026-14257)

La fonction `expand()` de `brace-expansion` limite le **nombre** de résultats
(`max`, défaut 100 000) mais pas la **longueur** de chaque résultat. Un motif du
type `'{a,b}'.repeat(1500)` (~7,5 Ko) fait croître les chaînes générées de façon
combinatoire à travers les niveaux de récursion, jusqu'à épuiser la mémoire du
process Node — crash fatal, non rattrapable (DoS).

**Condition d'exploitation : l'attaquant doit contrôler le motif texte passé à
`expand()`/`minimatch`.** Dans CarbonCo, aucun code applicatif ne transmet une
chaîne contrôlée par un utilisateur à `minimatch`/`glob`/`brace-expansion` :
tous les appels identifiés (lint, tests, détection de ressource GCP au
démarrage) utilisent des motifs fixes, internes aux outils. Risque résiduel
jugé **faible**.

## Pourquoi l'override `brace-expansion@5.0.8` n'est pas retenu

Testé sur cette branche via `"overrides": { "brace-expansion": "5.0.8" }` :

- `npm install` résout bien `brace-expansion@5.0.8` partout, y compris forcé
  sous `minimatch@3.1.5` (normalement `^1.1.7`).
- **`npm run lint` casse immédiatement** :
  ```
  TypeError: expand is not a function
      at Minimatch.braceExpand (node_modules/minimatch/minimatch.js:271:10)
      at Minimatch.make (node_modules/minimatch/minimatch.js:180:33)
      at new Minimatch (node_modules/minimatch/minimatch.js:156:8)
      at doMatch (node_modules/@eslint/config-array/dist/cjs/index.cjs:422:13)
  ```
  L'API de `brace-expansion` a changé de façon incompatible entre la branche
  1.x (consommée par `minimatch@3.1.5` → `@eslint/config-array`, dépendance
  d'ESLint 9) et la branche 5.x. `eslint` (donc `lint-and-build`, un gate CI
  obligatoire) devient inutilisable.
- Aucun correctif non cassant n'existe : npm ne propose qu'un bump majeur
  (`eslint@10.8.0`) comme remédiation, hors scope de cette PR (Wave C = produit
  public Water Intelligence, pas une montée de version d'outillage lint).

Décision : retirer l'override, tolérer temporairement `GHSA-mh99-v99m-4gvg`
seule, sur son identifiant exact (pas de `--omit=dev`, pas d'ignore par nom de
paquet).

## Résultats du test d'override (résumé)

| Étape | Résultat avec override 5.0.8 |
|---|---|
| `npm install` | OK — résolution forcée partout |
| `npm audit --json` | OK — 3 vulnérabilités restantes (dompurify/low, next/sharp déjà connues), 0 nouvelle |
| `npm run lint` | **ÉCHEC** — `TypeError: expand is not a function` |

→ Override abandonné après ce point (retiré de `package.json`/lockfile).

## Mesures compensatoires

- Gate `security-audit` **toujours bloquant** pour toute autre advisory
  high/critical (allowlist strictement limitée à `GHSA-f88m-g3jw-g9cj` et
  `GHSA-mh99-v99m-4gvg`, chacune sur son identifiant exact).
- `npm audit` reste exécuté sur l'arbre complet (prod + dev) — pas de
  `--omit=dev`, pas d'exclusion par nom de paquet.
- Aucun code applicatif CarbonCo n'invoque `minimatch`/`glob`/`brace-expansion`
  avec une entrée utilisateur (vérifié ci-dessus).
- Réévaluation programmée le 2026-08-08.

## Événements déclenchant un retrait immédiat de cette tolérance

- Publication d'un correctif compatible (backport sur les branches 1.x/2.x/3.x,
  ou bump non cassant d'ESLint/`@eslint/config-array` embarquant
  `brace-expansion>=5.0.8`).
- Mise à jour des dépendances parentes (`eslint`, `typescript-eslint`,
  `@vitest/coverage-v8`, `inngest`/OpenTelemetry) qui déplacerait naturellement
  la résolution hors de la plage vulnérable.
- Toute évolution de code qui ferait transiter une entrée contrôlée par un
  utilisateur vers `minimatch`/`glob`/`brace-expansion` (dev ou prod).
- Tout constat que le chemin `inngest` → OpenTelemetry → `gcp-metadata` est
  effectivement exercé au runtime avec un motif non fixe.
