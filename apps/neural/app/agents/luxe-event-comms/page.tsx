import type { Metadata } from "next";

import { LuxeCommsAgentPage } from "@/components/luxe-comms/LuxeCommsAgentPage";
import { LUXE_COMMS_SUMMARY, EVENTS_CALENDAR } from "@/lib/data/luxe-comms-catalog";

export const metadata: Metadata = {
  title: "LuxeEventComms — packs evenementiels luxe | NEURAL",
  description:
    "AG-003 LuxeEventComms : genere le pack complet pour defiles, lancements, expositions. Invitations VIP, scripts, social live, captions — avec gates brand et heritage.",
};

export default function LuxeEventCommsPage() {
  const s = LUXE_COMMS_SUMMARY;
  const topEvents = EVENTS_CALENDAR.slice(0, 6);
  return (
    <LuxeCommsAgentPage slug="luxe-event-comms">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
          Calendrier evenementiel runtime
        </p>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
          {s.eventsCount} evenements mappes · defile, expo, lancement, client day, pop-up
        </h2>
        <p className="mt-3 max-w-3xl text-white/60">
          Chaque evenement porte son niveau VIP, son angle patrimoine, ses claims attendus,
          son score de sensibilite. LuxeEventComms genere le pack multi-format adapte au type
          d&apos;evenement : un defile exige teaser + invitation VIP + social live, une exposition
          exige catalogue + wall text bilingue + invitation presse.
        </p>

        <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {topEvents.map((e) => (
            <div
              key={e.event_id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-white/45">{e.event_id}</span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                    e.vip_level === "HIGH"
                      ? "bg-amber-400/10 text-amber-200"
                      : e.vip_level === "MEDIUM"
                      ? "bg-violet-400/10 text-violet-200"
                      : "bg-white/[0.06] text-white/55"
                  }`}
                >
                  VIP {e.vip_level}
                </span>
              </div>
              <p className="mt-2 font-display text-sm font-semibold text-white">{e.nom}</p>
              <p className="mt-1 text-[11px] text-white/55">
                {e.type} · {e.lieu}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {e.heritage_angle === "YES" ? (
                  <span className="rounded-md bg-violet-400/10 px-2 py-0.5 text-[10px] text-violet-200">
                    Heritage
                  </span>
                ) : null}
                {e.claims_expected === "YES" ? (
                  <span className="rounded-md bg-rose-400/10 px-2 py-0.5 text-[10px] text-rose-200">
                    Claims attendus
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </LuxeCommsAgentPage>
  );
}
