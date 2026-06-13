/**
 * Spécification OpenAPI 3.1 de l'API publique CarbonCo.
 *
 * Source unique de vérité pour :
 *   - la page de documentation /dev (lit ENDPOINTS pour afficher le tableau)
 *   - la route /api/openapi qui sert le document JSON-LD complet
 *
 * Mettre à jour ce fichier à chaque ajout d'endpoint pour garder les deux
 * surfaces synchronisées. Les endpoints marqués `x-status: "beta"` ne sont
 * pas considérés comme stables et peuvent évoluer sans préavis.
 */

export type EndpointMethod = "GET" | "POST" | "PUT" | "DELETE";
export type EndpointAuth = "Bearer" | "Public" | "Webhook";
export type EndpointStatus = "stable" | "beta";

export interface ApiEndpoint {
  method: EndpointMethod;
  path: string;
  scope: string;
  auth: EndpointAuth;
  blurb: string;
  status?: EndpointStatus;
}

export const ENDPOINTS: readonly ApiEndpoint[] = [
  { method: "POST", path: "/api/copilot",                 scope: "Copilote IA",  auth: "Bearer",  blurb: "Streaming Anthropic. Body : messages[]. Retourne SSE." },
  { method: "POST", path: "/api/upload",                  scope: "Ingestion",    auth: "Bearer",  blurb: "Upload Excel/Word/PDF. multipart/form-data." },
  { method: "POST", path: "/api/rag/upload",              scope: "RAG",          auth: "Bearer",  blurb: "Indexation document dans Upstash Vector." },
  { method: "POST", path: "/api/rag/ingest",              scope: "RAG",          auth: "Bearer",  blurb: "Re-ingestion d'un corpus existant.", status: "beta" },
  { method: "POST", path: "/api/rag/search",              scope: "RAG",          auth: "Bearer",  blurb: "Recherche sémantique sur la base ESRS." },
  { method: "POST", path: "/api/datapoints/extract",      scope: "Datapoints",   auth: "Bearer",  blurb: "Extraction LLM de datapoints depuis un document.", status: "beta" },
  { method: "GET",  path: "/api/datapoints/list",         scope: "Datapoints",   auth: "Bearer",  blurb: "Lecture des datapoints du tenant courant." },
  { method: "POST", path: "/api/value-mapping-variant",   scope: "ESG",          auth: "Bearer",  blurb: "Variantes de mapping de la chaîne de valeur.", status: "beta" },
  { method: "POST", path: "/api/invites",                 scope: "Utilisateurs", auth: "Bearer",  blurb: "Crée un lien d'invitation signé. Capacité : manage:users." },
  { method: "POST", path: "/api/stripe/checkout",         scope: "Billing",      auth: "Public",  blurb: "Crée une session Stripe Checkout. Body : { plan, customerEmail }." },
  { method: "POST", path: "/api/stripe/portal",           scope: "Billing",      auth: "Bearer",  blurb: "Crée une session de portail client Stripe." },
  { method: "POST", path: "/api/stripe/webhook",          scope: "Billing",      auth: "Webhook", blurb: "Réception des évènements Stripe (signature v1 SHA-256)." },
  { method: "POST", path: "/api/csp-report",              scope: "Sécurité",     auth: "Public",  blurb: "Réception des rapports de violation CSP." },
];

const TAG_DESCRIPTIONS: Record<string, string> = {
  "Copilote IA": "Endpoints d'interaction avec le copilote NEURAL (LLM Anthropic via Vercel AI Gateway).",
  Ingestion: "Upload de fichiers métier (Excel CSRD, factures énergie, documents RAG).",
  RAG: "Indexation et recherche vectorielle sur le corpus ESRS.",
  Datapoints: "Extraction et lecture des datapoints ESRS.",
  ESG: "Outils de cartographie et de variantes ESG.",
  Utilisateurs: "Gestion d'invitations et de comptes.",
  Billing: "Souscription, portail client et webhooks Stripe.",
  Sécurité: "Reporting passif d'incidents (CSP).",
};

/**
 * Convertit le tableau ENDPOINTS en document OpenAPI 3.1.
 *
 * La doc reste volontairement légère (pas de schémas de payload détaillés) :
 * elle référence les endpoints, leur authentification et leur statut. Les
 * payloads précis sont documentés dans le code source des routes.
 */
export function buildOpenApiSpec() {
  const tags = Array.from(new Set(ENDPOINTS.map((e) => e.scope))).map((name) => ({
    name,
    description: TAG_DESCRIPTIONS[name] ?? "",
  }));

  // Regroupe les endpoints par path pour respecter le format OpenAPI (paths
  // est un objet, pas un tableau ; chaque path peut avoir plusieurs méthodes).
  const paths: Record<string, Record<string, unknown>> = {};
  for (const ep of ENDPOINTS) {
    const pathItem = paths[ep.path] ?? {};
    pathItem[ep.method.toLowerCase()] = {
      summary: ep.blurb,
      tags: [ep.scope],
      security:
        ep.auth === "Bearer"
          ? [{ bearerAuth: [] }]
          : ep.auth === "Webhook"
            ? [{ stripeWebhook: [] }]
            : [],
      responses: {
        "200": { description: "Succès" },
        "401":
          ep.auth === "Bearer"
            ? { description: "Jeton JWT manquant ou invalide" }
            : undefined,
        "403":
          ep.auth === "Bearer"
            ? { description: "Capacité RBAC insuffisante" }
            : undefined,
        "429": { description: "Rate limit dépassé" },
      },
      ...(ep.status === "beta" ? { "x-status": "beta", deprecated: false } : {}),
    };
    paths[ep.path] = pathItem;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "CarbonCo API",
      version: "0.1.0",
      description:
        "Référence des endpoints REST exposés par la plateforme CarbonCo. " +
        "L'authentification se fait via un en-tête `Authorization: Bearer <jwt>`. " +
        "Les jetons sont signés HS256 avec un payload `{ sub, role, cid, exp }`. " +
        "Les endpoints marqués `x-status: beta` peuvent évoluer sans préavis.",
      contact: {
        name: "CarbonCo Support",
        email: "contact@carbonco.fr",
        url: "https://carbonco.fr/aide",
      },
      license: {
        name: "Propriétaire — usage soumis aux CGU",
        url: "https://carbonco.fr/cgu",
      },
    },
    servers: [
      {
        url: "https://carbonco.fr",
        description: "Production",
      },
    ],
    tags,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Jeton JWT signé HS256 avec payload `{ sub, role, cid, exp }`. " +
            "`cid` identifie le tenant, `role` ∈ {admin, auditor, reader, daf}.",
        },
        stripeWebhook: {
          type: "apiKey",
          in: "header",
          name: "Stripe-Signature",
          description: "Signature v1 SHA-256 émise par Stripe.",
        },
      },
    },
    paths,
  } as const;
}
