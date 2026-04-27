/**
 * HostingGrid — détail des couches d'infrastructure (où vivent les données).
 */

import { Database, Globe2, LineChart, Sparkles } from "lucide-react";

import hosting from "@/content/trust/hosting.json";

const ICONS = {
  Database,
  Globe2,
  LineChart,
  Sparkles,
} as const;

export function HostingGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {hosting.items.map((layer) => {
        const Icon = ICONS[layer.icon as keyof typeof ICONS] || Globe2;
        return (
          <div
            key={layer.id}
            className="group flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-white/20"
          >
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/[0.08] text-cyan-200">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                  {layer.layer}
                </p>
                <p className="font-display text-base font-bold tracking-tight text-white">
                  {layer.provider}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Région</p>
              <p className="mt-1 text-sm text-white/80">{layer.region}</p>
            </div>
            <p className="text-sm leading-relaxed text-white/55">{layer.description}</p>
          </div>
        );
      })}
    </div>
  );
}
