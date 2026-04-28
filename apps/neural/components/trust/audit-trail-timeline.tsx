import { Fingerprint } from "lucide-react";

import {
  auditTimeline,
  type AuditTimelineItem,
} from "@/lib/data/agent-safety";

export function AuditTrailTimeline({
  items = auditTimeline,
}: {
  items?: AuditTimelineItem[];
}) {
  return (
    <div className="relative">
      <div className="absolute bottom-0 left-5 top-0 hidden w-px bg-white/10 md:block" />
      <div className="space-y-4">
        {items.map((item, index) => (
          <article key={item.id} className="relative md:pl-14">
            <div className="absolute left-0 top-5 hidden h-10 w-10 items-center justify-center rounded-full border border-violet-400/25 bg-[#111D35] md:flex">
              <span className="font-mono text-xs text-violet-200">
                {index + 1}
              </span>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-xl font-bold text-white">
                  {item.title}
                </h3>
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.07] px-3 py-1 font-mono text-xs text-cyan-100">
                  <Fingerprint className="h-3.5 w-3.5" />
                  {item.evidence}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                {item.detail}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
