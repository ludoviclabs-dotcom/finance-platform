# NEURAL security audit note

Date: 2026-05-10

## Actions applied

- `npm audit fix` applied non-breaking dependency updates.
- `next` updated from `16.2.0` to `16.2.6`.
- `.vercelignore` added at repository root and app level to exclude `.env*` from deployment uploads while keeping `.env.example`.
- Internal approval endpoints now support `INTERNAL_REVIEW_TOKEN` and only fall back to `x-reviewer-id` when the token is not configured.

## Residual npm audit findings

`npm audit --omit=dev` still reports 8 vulnerabilities:

- `xlsx`: high severity, no fix available upstream. NEURAL uses `xlsx` for local workbook parsing/export. Mitigation: keep public uploads disabled, process only bundled or controlled workbooks, and plan migration or isolation before customer-provided files.
- `@hono/node-server` through `@modelcontextprotocol/sdk` and Prisma tooling: moderate severity, no non-breaking fix available in the current dependency graph.
- `postcss` through `next`: moderate severity. Next `16.2.6` is installed; npm still reports the bundled transitive PostCSS issue with no direct non-breaking fix.

## Do not force yet

`npm audit fix --force` proposes breaking changes around Prisma/Vercel config. Do not run it without a dedicated migration/test pass.
