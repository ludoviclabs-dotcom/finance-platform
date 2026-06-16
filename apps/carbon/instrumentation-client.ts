/**
 * Instrumentation client (Next.js) — report d'erreurs front vers Sentry (T1.7).
 *
 * Sans dépendance : implémentation minimale du transport « envelope » de Sentry.
 * ACTIVÉ uniquement si `NEXT_PUBLIC_SENTRY_DSN` est défini — sinon no-op total
 * (aucun appel réseau, aucun coût). Capture `window.onerror` et les rejets de
 * promesse non gérés ; n'envoie que la trace technique (message, stack, URL,
 * release), jamais de donnée métier ESG.
 */

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const RELEASE =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_COMMIT_SHA ?? "dev";

type ParsedDsn = { host: string; projectId: string; publicKey: string };

/** Parse un DSN `https://<publicKey>@<host>/<projectId>`. */
function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    if (!u.username || !u.host || !projectId) return null;
    return { host: u.host, projectId, publicKey: u.username };
  } catch {
    return null;
  }
}

function eventId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  }
}

function send(parsed: ParsedDsn, message: string, stack?: string): void {
  const id = eventId();
  const now = new Date();
  const envelopeHeader = JSON.stringify({ event_id: id, sent_at: now.toISOString() });
  const itemHeader = JSON.stringify({ type: "event" });
  const payload = JSON.stringify({
    event_id: id,
    timestamp: now.getTime() / 1000,
    platform: "javascript",
    level: "error",
    release: RELEASE,
    request: { url: typeof location !== "undefined" ? location.href : undefined },
    exception: { values: [{ type: "Error", value: message, stacktrace: stack ? { frames: [] } : undefined }] },
    extra: stack ? { stack: stack.slice(0, 4000) } : undefined,
  });
  const body = `${envelopeHeader}\n${itemHeader}\n${payload}\n`;
  const url = `https://${parsed.host}/api/${parsed.projectId}/envelope/?sentry_version=7&sentry_key=${parsed.publicKey}&sentry_client=carbonco-min%2F1.0`;
  try {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body,
      keepalive: true,
      mode: "cors",
    }).catch(() => {});
  } catch {
    /* best-effort : ne jamais casser l'app à cause du reporting */
  }
}

if (typeof window !== "undefined" && DSN) {
  const parsed = parseDsn(DSN);
  if (parsed) {
    window.addEventListener("error", (e: ErrorEvent) => {
      send(parsed, e.message || "Unhandled error", e.error?.stack);
    });
    window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const message =
        reason instanceof Error ? reason.message : String(reason ?? "Unhandled rejection");
      send(parsed, message, reason instanceof Error ? reason.stack : undefined);
    });
  }
}

export {};
