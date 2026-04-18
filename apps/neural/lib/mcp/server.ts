/**
 * NEURAL — MCP Server (Sprint 6)
 *
 * Exposes NEURAL agents as tools consumable by any MCP-compatible client
 * (Claude Desktop, Cursor, Cline, Continue, custom agents…).
 *
 * Transport: WebStandardStreamableHTTPServerTransport — stateless per-request,
 * fully compatible with Vercel Fluid Compute / serverless.
 *
 * Registered tools:
 *   neural_list_agents     — catalogue des surfaces IA disponibles
 *   neural_ask             — question → réponse complète (generateText via Gateway)
 *   neural_get_run         — statut + réponse d'un AgentRun
 *   neural_get_trace       — graphe d'explainabilité d'un run
 *   neural_recall_memory   — lecture d'une entrée de mémoire
 *   neural_list_runs       — liste des runs récents pour un agent
 *
 * Usage: createNeuralMcpServer() is called once per request in app/api/mcp/route.ts
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { generateText, gateway } from "ai";
import { z } from "zod";

import { getAiSurfaceReadiness, getAiGatewayAuthMode } from "@/lib/ai/router";
import { getTrace, listRuns } from "@/lib/trace/builder";
import { recallOrg, recallUser, recallAgent } from "@/lib/memory";

// ── Server factory ────────────────────────────────────────────────────────────

export function createNeuralMcpServer(): McpServer {
  const server = new McpServer({
    name: "neural-ai",
    version: "0.1.0",
  });

  // ── Tool 1 : list agents ─────────────────────────────────────────────────

  server.registerTool(
    "neural_list_agents",
    {
      title: "Lister les agents NEURAL",
      description:
        "Retourne le catalogue des surfaces IA disponibles dans NEURAL : identifiant, modèle, statut (live / prepared) et périmètre de données.",
      inputSchema: {},
    },
    async () => {
      const surfaces = getAiSurfaceReadiness();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(surfaces, null, 2),
          },
        ],
      };
    },
  );

  // ── Tool 2 : ask ─────────────────────────────────────────────────────────

  server.registerTool(
    "neural_ask",
    {
      title: "Interroger l'assistant NEURAL",
      description:
        "Pose une question en langage naturel à l'assistant public NEURAL et retourne une réponse complète. Répond en français, de façon concise et professionnelle.",
      inputSchema: {
        question: z.string().min(1).describe("La question à poser à NEURAL."),
        userId: z
          .string()
          .default("mcp-client")
          .describe("Identifiant utilisateur pour le tracking (optionnel)."),
      },
    },
    async ({ question, userId }) => {
      const authMode = getAiGatewayAuthMode();

      if (authMode === "missing") {
        return {
          content: [
            {
              type: "text",
              text: "⚠️ AI Gateway non configuré. Ajoutez AI_GATEWAY_API_KEY ou déployez sur Vercel.",
            },
          ],
          isError: true,
        };
      }

      try {
        const { text } = await generateText({
          model: gateway("anthropic/claude-haiku-3"),
          messages: [{ role: "user", content: question }],
          system: `Tu es l'assistant public de NEURAL, plateforme d'IA pour l'entreprise.
NEURAL propose des agents spécialisés en finance, comptabilité (IFRS, PCG), RH, Supply Chain et Marketing.
Réponds en français, de façon concise (max 300 mots) et professionnelle.
Si la question dépasse ton périmètre public, oriente vers contact@neural-ai.fr.`,
          maxOutputTokens: 800,
          providerOptions: {
            gateway: {
              user: userId,
              tags: ["mcp", "public-chat", "product:neural"],
            },
          },
        });

        return { content: [{ type: "text", text }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Erreur LLM : ${msg}` }],
          isError: true,
        };
      }
    },
  );

  // ── Tool 3 : get run ─────────────────────────────────────────────────────

  server.registerTool(
    "neural_get_run",
    {
      title: "Récupérer une exécution agent",
      description:
        "Retourne le statut, la réponse et le score de confiance d'un AgentRun identifié par son ID.",
      inputSchema: {
        runId: z.string().cuid().describe("Identifiant du run (format cuid)."),
      },
    },
    async ({ runId }) => {
      const trace = await getTrace(runId);

      if (!trace) {
        return {
          content: [{ type: "text", text: `Run « ${runId} » introuvable.` }],
          isError: true,
        };
      }

      const summary = {
        id: trace.id,
        agentId: trace.agentId,
        status: trace.status,
        confidence: trace.confidence,
        confidencePct:
          trace.confidence !== null
            ? `${Math.round(trace.confidence * 100)} %`
            : null,
        steps: trace.decisions.length,
        answer: trace.answer,
        startedAt: trace.startedAt,
        completedAt: trace.completedAt,
        latencyMs:
          trace.completedAt
            ? trace.completedAt.getTime() - trace.startedAt.getTime()
            : null,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      };
    },
  );

  // ── Tool 4 : get trace ───────────────────────────────────────────────────

  server.registerTool(
    "neural_get_trace",
    {
      title: "Lire le graphe d'explainabilité",
      description:
        "Retourne les étapes de décision (RETRIEVE / COMPUTE / REASON / VALIDATE) et leurs sources pour un AgentRun donné.",
      inputSchema: {
        runId: z.string().cuid().describe("Identifiant du run à analyser."),
      },
    },
    async ({ runId }) => {
      const trace = await getTrace(runId);

      if (!trace) {
        return {
          content: [{ type: "text", text: `Run « ${runId} » introuvable.` }],
          isError: true,
        };
      }

      const steps = trace.decisions.map((d) => ({
        étape: d.orderIndex + 1,
        type: d.kind,
        durée: `${d.durationMs} ms`,
        sources: d.sources.map((s) =>
          s.url ? `[${s.kind}] ${s.ref} — ${s.url}` : `[${s.kind}] ${s.ref}`,
        ),
        résumé_sortie: JSON.stringify(d.output).slice(0, 300),
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { runId, agent: trace.agentId, étapes: steps },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── Tool 5 : recall memory ───────────────────────────────────────────────

  server.registerTool(
    "neural_recall_memory",
    {
      title: "Lire une mémoire persistante",
      description:
        "Récupère une entrée de mémoire NEURAL par scope (ORG / USER / AGENT), identifiant et clé.",
      inputSchema: {
        scope: z
          .enum(["ORG", "USER", "AGENT"])
          .describe("Portée de la mémoire."),
        scopeId: z
          .string()
          .describe(
            "ID de l'entité (organizationId, userId ou agentId selon le scope).",
          ),
        key: z
          .string()
          .describe(
            "Clé de la mémoire (ex: chart-of-accounts, agent-preferences).",
          ),
      },
    },
    async ({ scope, scopeId, key }) => {
      const entry =
        scope === "ORG"
          ? await recallOrg(scopeId, key)
          : scope === "USER"
            ? await recallUser(scopeId, key)
            : await recallAgent(scopeId, key);

      if (!entry) {
        return {
          content: [
            {
              type: "text",
              text: `Mémoire "${key}" (${scope}:${scopeId}) introuvable.`,
            },
          ],
        };
      }

      return {
        content: [
          { type: "text", text: JSON.stringify(entry.value, null, 2) },
        ],
      };
    },
  );

  // ── Tool 6 : list runs ───────────────────────────────────────────────────

  server.registerTool(
    "neural_list_runs",
    {
      title: "Lister les exécutions récentes",
      description:
        "Retourne les N derniers AgentRuns pour un agent donné, avec statut et confiance.",
      inputSchema: {
        agentId: z
          .string()
          .describe("Identifiant de l'agent (ex: ifrs9-ecl, tva-transport)."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe("Nombre de runs à retourner (défaut: 10)."),
      },
    },
    async ({ agentId, limit }) => {
      const runs = await listRuns(agentId, limit);
      return {
        content: [
          { type: "text", text: JSON.stringify(runs, null, 2) },
        ],
      };
    },
  );

  return server;
}
