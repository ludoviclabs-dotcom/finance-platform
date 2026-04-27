/**
 * SubProcessorTable — affiche la liste publique des sous-processeurs
 * (RGPD art. 28). Liens DPA externes, région et données concernées explicites.
 */

import { ExternalLink, MapPin } from "lucide-react";

import subProcessors from "@/content/trust/sub-processors.json";

export function SubProcessorTable() {
  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04]">
      <div className="hidden grid-cols-[1.4fr_1.4fr_1fr_1.4fr_0.6fr] gap-4 border-b border-white/8 px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35 md:grid">
        <span>Sous-processeur</span>
        <span>Service</span>
        <span>Région</span>
        <span>Données concernées</span>
        <span className="text-right">DPA</span>
      </div>
      {subProcessors.items.map((sp) => (
        <div
          key={sp.id}
          className="grid grid-cols-1 gap-3 border-b border-white/8 px-5 py-4 last:border-b-0 md:grid-cols-[1.4fr_1.4fr_1fr_1.4fr_0.6fr] md:items-center"
        >
          <div>
            <p className="text-sm font-semibold text-white">{sp.name}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-white/35">
              {sp.country}
            </p>
          </div>
          <div className="text-sm text-white/70">{sp.service}</div>
          <div className="flex items-center gap-1.5 text-sm text-white/55">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span>{sp.region}</span>
          </div>
          <div className="text-sm leading-relaxed text-white/55">{sp.dataScope}</div>
          <div className="md:text-right">
            <a
              href={sp.dpaUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-200 transition-colors hover:bg-white/[0.08]"
            >
              DPA
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      ))}
      <div className="border-t border-white/10 bg-violet-500/[0.06] px-5 py-4">
        <p className="text-xs leading-relaxed text-violet-100/80">
          <span className="font-semibold">Engagement :</span>{" "}
          {subProcessors.notificationCommitment}
        </p>
        <p className="mt-1.5 text-[11px] uppercase tracking-[0.18em] text-white/35">
          Mise à jour : {subProcessors.lastUpdated}
        </p>
      </div>
    </div>
  );
}
