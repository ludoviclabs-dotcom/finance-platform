# NEURAL security audit note

Date: 2026-05-12

## Actions applied

- Sensitive routes are now private by default in production:
  - `/api/cron/regulatory-watch` requires `CRON_SECRET`.
  - `/api/mcp` requires `MCP_PUBLIC_TOKEN`.
  - `/api/internal/*` and `/api/approvals` require `INTERNAL_REVIEW_TOKEN`.
- Public EvidenceGuard UI now calls `/api/demo/evidence-guard/resolve`; the internal resolver remains protected.
- Contact form now requires `email`, supports optional `phone`, validates with Zod server-side, and sends `replyTo`.
- Cal.com embed was removed from `/contact` until a verified slug is configured.
- Public legal and privacy pages were rewritten with editor, hosting, data categories, purposes, retention, rights, cookies and embeds.
- `/forfaits`, `/secteurs` and `/secteurs/luxe/rh` no longer return public 404s.
- `qa:prod` / `qa:site` now crawls internal links, checks 404s, favicon/manifest assets, mojibake and protected endpoints in production.

## Required production env vars

- `CRON_SECRET`: required for `/api/cron/regulatory-watch`.
- `MCP_PUBLIC_TOKEN`: required if `/api/mcp` remains active.
- `INTERNAL_REVIEW_TOKEN`: required for `/api/internal/*` and `/api/approvals`.
- `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL`: required for live contact delivery.

## Residual npm audit findings

`npm audit --omit=dev` still reports 8 vulnerabilities:

- `xlsx`: high severity, no fix available upstream. Current mitigation: no public workbook upload, trusted bundled workbooks only, size-controlled files, and migration/isolation required before accepting client-provided Excel files.
- `@hono/node-server` through `@modelcontextprotocol/sdk` and Prisma tooling: moderate severity, no non-breaking fix available in the current dependency graph. Current mitigation: `/api/mcp` is token-protected in production.
- `postcss` through `next`: moderate severity. Next `16.2.6` is installed; npm still reports the bundled transitive PostCSS issue with no direct non-breaking fix.

## Do not force yet

Do not run `npm audit fix --force` without a dedicated migration pass. It can introduce breaking changes in Prisma / Vercel-related dependencies.
