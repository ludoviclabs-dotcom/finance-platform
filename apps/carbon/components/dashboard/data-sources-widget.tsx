"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Plus, RefreshCw, Zap } from "lucide-react";
import { useToast } from "@/components/ui/toast";

const SOURCES = [
  {
    id: "sap",
    name: "SAP ERP",
    type: "ERP",
    status: "connected" as const,
    lastSync: "il y a 12 min",
    entries: 18420,
    quality: 98,
    icon: "🏢",
  },
  {
    id: "energy",
    name: "ENEDIS API",
    type: "Énergie",
    status: "connected" as const,
    lastSync: "il y a 1h",
    entries: 8760,
    quality: 95,
    icon: "⚡",
  },
  {
    id: "fleet",
    name: "Alphabet Fleet",
    type: "Flotte véhicules",
    status: "connected" as const,
    lastSync: "il y a 3h",
    entries: 1240,
    quality: 91,
    icon: "🚗",
  },
  {
    id: "hr",
    name: "Workday RH",
    type: "Ressources Humaines",
    status: "warning" as const,
    lastSync: "il y a 2 jours",
    entries: 3845,
    quality: 74,
    icon: "👥",
  },
  {
    id: "suppliers",
    name: "Fournisseurs (Scope 3)",
    type: "Chaîne d'approvisionnement",
    status: "idle" as const,
    lastSync: "Jamais",
    entries: 0,
    quality: 0,
    icon: "🌐",
  },
];

const statusConfig = {
  connected: { label: "Connecté", color: "text-[var(--color-success)]", bg: "bg-[var(--color-success)]/10", dot: "bg-[var(--color-success)]" },
  warning: { label: "Attention", color: "text-orange-400", bg: "bg-orange-400/10", dot: "bg-orange-400" },
  idle: { label: "Non connecté", color: "text-[var(--color-foreground-subtle)]", bg: "bg-[var(--color-background)]", dot: "bg-[var(--color-foreground-subtle)]" },
};

function QualityBar({ score }: { score: number }) {
  const color = score >= 90 ? "bg-[var(--color-success)]" : score >= 70 ? "bg-orange-400" : "bg-[var(--color-foreground-subtle)]";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[var(--color-background)] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: score > 0 ? `${score}%` : "0%" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className={`h-full ${color} rounded-full`}
        />
      </div>
      <span className="text-[10px] text-[var(--color-foreground-muted)] w-6 text-right">{score > 0 ? `${score}%` : "—"}</span>
    </div>
  );
}

export function DataSourcesWidget() {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState<string | null>(null);

  const handleSync = (id: string, name: string) => {
    setSyncing(id);
    setTimeout(() => {
      setSyncing(null);
      toast(`Synchronisation de ${name} terminée avec succès.`, "success");
    }, 2000);
  };

  const connectedCount = SOURCES.filter((s) => s.status === "connected").length;
  const avgQuality = Math.round(SOURCES.filter((s) => s.quality > 0).reduce((a, s) => a + s.quality, 0) / SOURCES.filter((s) => s.quality > 0).length);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold text-sm text-[var(--color-foreground)]">Sources de données</h3>
          <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">{connectedCount}/5 sources connectées</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-foreground-muted)]">Qualité globale</span>
          <span className={`text-sm font-bold ${avgQuality >= 90 ? "text-[var(--color-success)]" : "text-orange-400"}`}>{avgQuality}%</span>
        </div>
      </div>

      <div className="space-y-2.5">
        {SOURCES.map((source) => {
          const cfg = statusConfig[source.status];
          const isSyncing = syncing === source.id;
          return (
            <div key={source.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors group">
              <span className="text-lg flex-shrink-0">{source.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-[var(--color-foreground)] truncate">{source.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[var(--color-foreground-subtle)]">{source.lastSync}</span>
                  {source.entries > 0 && <span className="text-[10px] text-[var(--color-foreground-muted)]">{source.entries.toLocaleString("fr-FR")} entrées</span>}
                </div>
                {source.status !== "idle" && (
                  <div className="mt-1.5">
                    <QualityBar score={source.quality} />
                  </div>
                )}
              </div>
              <button
                onClick={() => handleSync(source.id, source.name)}
                disabled={isSyncing}
                aria-label={`Synchroniser ${source.name}`}
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-raised)] transition-colors opacity-0 group-hover:opacity-100 cursor-pointer focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => toast("Ouverture du gestionnaire de connecteurs...", "info")}
        className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-[var(--color-border)] text-xs font-medium text-[var(--color-foreground-muted)] hover:text-carbon-emerald-light hover:border-carbon-emerald/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60"
      >
        <Plus className="w-3.5 h-3.5" />
        Connecter une source
      </button>
    </div>
  );
}
