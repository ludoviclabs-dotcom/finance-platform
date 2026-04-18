/**
 * NEURAL — MCP HTTP endpoint (Sprint 6)
 *
 * Handles all MCP protocol messages over Streamable HTTP transport.
 * One fresh server + transport per request (stateless, Fluid Compute compatible).
 *
 * Endpoint:  POST | GET | DELETE /api/mcp
 *
 * MCP clients (Claude Desktop, Cursor, etc.) connect with:
 *   {
 *     "mcpServers": {
 *       "neural": {
 *         "url": "https://neural-five.vercel.app/api/mcp",
 *         "transport": "http"
 *       }
 *     }
 *   }
 *
 * Docs: https://modelcontextprotocol.io/docs/concepts/transports
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp";
import { createNeuralMcpServer } from "@/lib/mcp/server";

async function handleMcp(req: Request): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = createNeuralMcpServer();
  await server.connect(transport);
  return transport.handleRequest(req);
}

export const GET    = handleMcp;
export const POST   = handleMcp;
export const DELETE = handleMcp;
