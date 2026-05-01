import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation API — CarbonCo",
  description:
    "Référence des endpoints REST CarbonCo : authentification, datapoints, RAG, copilote IA, " +
    "Stripe et invitations.",
  alternates: { canonical: "https://carbonco.fr/dev" },
};

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  scope: string;
  auth: "Bearer" | "Public" | "Webhook";
  blurb: string;
}

const ENDPOINTS: readonly Endpoint[] = [
  { method: "POST", path: "/api/copilot",                 scope: "Copilote IA", auth: "Bearer", blurb: "Streaming Anthropic. Body : messages[]. Retourne SSE." },
  { method: "POST", path: "/api/upload",                  scope: "Ingestion",   auth: "Bearer", blurb: "Upload Excel/Word/PDF. multipart/form-data." },
  { method: "POST", path: "/api/rag/upload",              scope: "RAG",         auth: "Bearer", blurb: "Indexation document dans Upstash Vector." },
  { method: "POST", path: "/api/rag/ingest",              scope: "RAG",         auth: "Bearer", blurb: "Re-ingestion d'un corpus existant." },
  { method: "POST", path: "/api/rag/search",              scope: "RAG",         auth: "Bearer", blurb: "Recherche sémantique sur la base ESRS." },
  { method: "POST", path: "/api/datapoints/extract",      scope: "Datapoints",  auth: "Bearer", blurb: "Extraction LLM de datapoints depuis un document." },
  { method: "GET",  path: "/api/datapoints/list",         scope: "Datapoints",  auth: "Bearer", blurb: "Lecture des datapoints du tenant courant." },
  { method: "POST", path: "/api/value-mapping-variant",   scope: "ESG",         auth: "Bearer", blurb: "Variantes de mapping de la chaîne de valeur." },
  { method: "POST", path: "/api/invites",                 scope: "Utilisateurs", auth: "Bearer", blurb: "Crée un lien d'invitation signé. Capacité : manage:users." },
  { method: "POST", path: "/api/stripe/checkout",         scope: "Billing",     auth: "Public", blurb: "Crée une session Stripe Checkout. Body : { plan, customerEmail }." },
  { method: "POST", path: "/api/stripe/portal",           scope: "Billing",     auth: "Bearer", blurb: "Crée une session de portail client Stripe." },
  { method: "POST", path: "/api/stripe/webhook",          scope: "Billing",     auth: "Webhook", blurb: "Réception des évènements Stripe (signature v1 SHA-256)." },
  { method: "POST", path: "/api/csp-report",              scope: "Sécurité",    auth: "Public", blurb: "Réception des rapports de violation CSP." },
];

export default function DevDocPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <header className="mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-green-600 mb-2">
            Documentation publique
          </p>
          <h1 className="text-4xl font-extrabold tracking-tighter text-neutral-900">
            API CarbonCo — Référence
          </h1>
          <p className="mt-3 text-neutral-600 max-w-2xl">
            Référence des endpoints REST exposés par la plateforme. Tous les appels sont
            préfixés par <code className="px-1.5 py-0.5 rounded bg-neutral-100 text-sm">https://carbonco.fr</code>.
            L&apos;authentification se fait via un en-tête <code className="px-1.5 py-0.5 rounded bg-neutral-100 text-sm">Authorization: Bearer &lt;jwt&gt;</code>.
          </p>
        </header>

        <section className="mb-12 rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500 mb-3">
            Authentification
          </h2>
          <p className="text-sm text-neutral-700 leading-relaxed">
            Les jetons sont signés en HS256 et portent un payload typé{" "}
            <code className="px-1 py-0.5 rounded bg-white border border-neutral-200 text-xs">
              {`{ sub, role, cid, exp }`}
            </code>{" "}
            où <code className="text-xs">cid</code> identifie le tenant (company id) et{" "}
            <code className="text-xs">role</code> ∈ {`{admin, auditor, reader, daf}`}.
            Toute API protégée vérifie la signature et applique le contrôle de capacités RBAC
            avant de répondre.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500 mb-4">
            Endpoints
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr className="text-left">
                  <th className="px-4 py-3 font-bold text-neutral-700">Méthode</th>
                  <th className="px-4 py-3 font-bold text-neutral-700">Endpoint</th>
                  <th className="px-4 py-3 font-bold text-neutral-700">Auth</th>
                  <th className="px-4 py-3 font-bold text-neutral-700">Description</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((e) => (
                  <tr key={`${e.method}-${e.path}`} className="border-b border-neutral-100 last:border-b-0">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-bold ${
                        e.method === "GET" ? "bg-blue-100 text-blue-700" :
                        e.method === "POST" ? "bg-green-100 text-green-700" :
                        e.method === "PUT" ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {e.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12.5px] text-neutral-900">{e.path}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-medium text-neutral-500">{e.auth}</span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 leading-snug">
                      <p>{e.blurb}</p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">{e.scope}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12 rounded-2xl bg-neutral-900 text-neutral-100 p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-green-400 mb-3">
            Exemple — appel datapoints
          </h2>
          <pre className="text-xs leading-relaxed font-mono overflow-x-auto">
{`curl -X GET "https://carbonco.fr/api/datapoints/list" \\
  -H "Authorization: Bearer $CARBONCO_JWT" \\
  -H "Content-Type: application/json"`}
          </pre>
        </section>

        <p className="mt-12 text-xs text-neutral-400">
          Spécification OpenAPI 3.1 prochainement publiée à <code>/api/openapi.json</code>.
          Pour toute question : <a href="mailto:contact@carbonco.fr" className="underline">contact@carbonco.fr</a>.
        </p>
      </div>
    </main>
  );
}
