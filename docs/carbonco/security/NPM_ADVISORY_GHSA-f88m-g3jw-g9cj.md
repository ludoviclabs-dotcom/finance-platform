# Acceptation temporaire de risque — GHSA-f88m-g3jw-g9cj (sharp / libvips)

**Statut : ACCEPTÉ TEMPORAIREMENT** · Dernière réévaluation : **2026-07-23** (PR #137)
· Prochaine réévaluation : **2026-10-23** (ou plus tôt si next publie un `sharp>=0.35.0`).

## Advisory

| Champ | Valeur |
|---|---|
| GHSA | `GHSA-f88m-g3jw-g9cj` |
| CVE | CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 |
| Sévérité | `high` (CWE-1395 — dépendance vulnérable héritée) |
| Paquet | `sharp` |
| Version installée | `0.34.5` |
| Plage vulnérable | `<0.35.0` |
| Version corrigée | `>=0.35.0` |

## Chemin de dépendance

```
carbon@0.1.0 (apps/carbon)
└─ next@16.2.11              (dépendance DIRECTE, production)
   └─ sharp@0.34.5           (TRANSITIVE, déclarée OPTIONNELLE : `optional sharp@"^0.34.5"`)
```

`sharp` n'est **jamais déclarée** dans `apps/carbon/package.json` : elle est tirée
uniquement par `next` pour l'optimisation d'images.

## Pourquoi aucun correctif non cassant

Réévalué sur la PR #137 après l'upgrade `next` 16.2.6 → **16.2.11** (qui corrige
quatre autres advisories `high`, voir plus bas) :

- `next@16.2.11` exige toujours `sharp@^0.34.5` → npm résout `0.34.5`, la plage
  vulnérable. L'upgrade de Next **ne déplace pas** sharp.
- Forcer `sharp>=0.35.0` par `overrides` sortirait de la plage semver exigée par
  Next (`^0.34.5`) : configuration non supportée, risque de rupture du pipeline
  d'images en production. Écarté.
- Le seul « correctif » historiquement proposé par npm était un **downgrade de
  Next** (cassant) — refusé.

Décision : **conserver** l'entrée dans l'allowlist de `.github/workflows/frontend.yml`
(elle n'est pas étendue ; aucune autre advisory n'est tolérée).

## Exploitabilité dans CarbonCo

Faible :

- `sharp` est une dépendance **optionnelle** de l'optimiseur d'images de Next ;
  CarbonCo n'expose **aucun pipeline de traitement d'images piloté par
  l'utilisateur** (aucun upload d'image transformé côté serveur).
- Les vulnérabilités libvips concernées supposent le **décodage d'images
  attaquant-contrôlées**. Les seules images servies sont des assets statiques du
  dépôt.
- Plateforme locale-first, pas de service public de redimensionnement.

## Mesures compensatoires

- Gate `security-audit` **toujours bloquant** pour toute autre advisory
  high/critical (allowlist strictement limitée à ce seul GHSA).
- Aucun endpoint d'upload d'image transformée par sharp.
- Réévaluation trimestrielle + retrait immédiat de l'entrée dès que `next`
  embarque `sharp>=0.35.0`.

## Corrigé en parallèle sur la même PR (pour mémoire)

L'échec réel de `security-audit` sur #137 venait de **quatre advisories `high` sur
`next` lui-même**, toutes corrigées par l'upgrade patch `16.2.6 → 16.2.11`
(`isSemVerMajor: false`) :

| GHSA | Intitulé | CWE |
|---|---|---|
| `GHSA-6gpp-xcg3-4w24` | Middleware / Proxy bypass (App Router, Turbopack, locale unique) | CWE-285 |
| `GHSA-m99w-x7hq-7vfj` | Déni de service (App Router, Server Actions) | CWE-834 |
| `GHSA-89xv-2m56-2m9x` | SSRF (Server Actions sur serveurs personnalisés) | CWE-918 |
| `GHSA-p9j2-gv94-2wf4` | SSRF (rewrites, hostname de destination contrôlé) | CWE-918 |

Plage vulnérable commune : `>=16.0.0 <16.2.11`.
