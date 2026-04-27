/**
 * McpServersList — liste des MCP servers enregistrés dans l'Operator Gateway.
 */

import { Activity, AlertTriangle, ShieldCheck } from "lucide-react";

interface McpServer {
  id: string;
  name: string;
  category: string;
  status: string;
  rbacEnabled: boolean;
  rateLimit: string;
  lastActivity: string;
  totalCalls24h: number;
}

const STATUS_CLS: Record<string, { dot: string; text: string }> = {
  operational: { dot: "bg-emerald-400", text: "text-emerald-300" },
  degraded: { dot: "bg-amber-400", text: "text-amber-200" },
  outage: { dot: "bg-red-400", text: "text-red-300" },
};

const CATEGORY_CLS: Record<string, string> = {
  LLM: "border-violet-400/25 bg-violet-400/[0.08] text-violet-200",
  Routing: "border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-200",
  Internal: "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200",
  Sectoriel: "border-amber-400/25 bg-amber-400/[0.08] text-amber-200",
  Compliance: "border-rose-400/25 bg-rose-400/[0.08] text-rose-200",
  Connecteur: "border-white/15 bg-white/[0.04] text-white/70",
};

export function McpServersList({ servers }: { servers: McpServer[] }) {
  return (
    <div className="space-y-3">
      {servers.map((srv) => {
        const sCls = STATUS_CLS[srv.status] || STATUS_CLS["operational"];
        const cCls = CATEGORY_CLS[srv.category] || CATEGORY_CLS["Connecteur"];
        return (
          <div
            key={srv.id}
            className="grid grid-cols-1 gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-4 transition-colors hover:border-white/16 md:grid-cols-[1.6fr_0.8fr_1fr_0.8fr_0.6fr] md:items-center"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 ${sCls.dot}`} />
                  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${sCls.dot}`} />
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{srv.name}</p>
                <p className={`mt-0.5 text-[10px] uppercase tracking-[0.16em] ${sCls.text}`}>
                  {srv.status === "operational" ? "Opérationnel" : srv.status}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center self-start rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${cCls}`}
            >
              {srv.category}
            </span>
            <div className="text-xs text-white/55">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Rate limit</p>
              <p className="mt-0.5 text-white/75">{srv.rateLimit}</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-white/45">
              <span className="inline-flex items-center gap-1">
                {srv.rbacEnabled ? (
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-3 w-3 text-amber-400" />
                )}
                RBAC
              </span>
              <span className="inline-flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {srv.lastActivity}
              </span>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">24h</p>
              <p className="font-display text-lg font-bold tabular-nums text-white">
                {new Intl.NumberFormat("fr-FR").format(srv.totalCalls24h)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
