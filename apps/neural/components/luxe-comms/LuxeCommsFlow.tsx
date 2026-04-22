/**
 * LuxeCommsFlow — Server Component
 * Diagramme de flux visuel des 5 agents et gates.
 * Montre le wedge : Input -> AG-002/003 -> AG-001 BRAND gate -> AG-005 CLAIM gate -> Review
 * + connexion AG-004 Heritage pour enrichissement.
 */
import { ArrowRight, Users, Zap, ShieldCheck, Leaf, Newspaper, Sparkles, Landmark, CheckCheck } from "lucide-react";

function Agent({
  id,
  name,
  Icon,
  tint,
  note,
}: {
  id: string;
  name: string;
  Icon: typeof ShieldCheck;
  tint: "violet" | "emerald" | "rose" | "amber" | "sky";
  note?: string;
}) {
  const tintClass = {
    violet: "border-violet-400/30 bg-violet-400/[0.08]",
    emerald: "border-emerald-400/30 bg-emerald-400/[0.08]",
    rose: "border-rose-400/30 bg-rose-400/[0.08]",
    amber: "border-amber-400/30 bg-amber-400/[0.08]",
    sky: "border-sky-400/30 bg-sky-400/[0.08]",
  }[tint];
  const iconClass = {
    violet: "text-violet-200",
    emerald: "text-emerald-200",
    rose: "text-rose-200",
    amber: "text-amber-200",
    sky: "text-sky-200",
  }[tint];

  return (
    <div className={`rounded-2xl border ${tintClass} p-4`}>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05]">
          <Icon className={`h-4 w-4 ${iconClass}`} />
        </div>
        <div>
          <p className="text-[10px] font-mono font-semibold text-white/45">{id}</p>
          <p className="text-sm font-semibold text-white">{name}</p>
        </div>
      </div>
      {note ? <p className="mt-2 text-[11px] text-white/55">{note}</p> : null}
    </div>
  );
}

function Arrow({ label, vertical = false }: { label?: string; vertical?: boolean }) {
  if (vertical) {
    return (
      <div className="flex flex-col items-center py-2">
        <div className="h-6 w-px bg-gradient-to-b from-transparent via-white/30 to-white/30" />
        <ArrowRight className="h-3.5 w-3.5 -mt-1 rotate-90 text-white/40" />
        {label ? <span className="mt-1 text-[10px] text-white/40">{label}</span> : null}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-2 text-white/40">
      <div className="h-px w-8 bg-gradient-to-r from-transparent via-white/30 to-white/30" />
      <ArrowRight className="h-3.5 w-3.5" />
      {label ? <span className="text-[10px]">{label}</span> : null}
    </div>
  );
}

function Gate({ name, tint }: { name: string; tint: "emerald" | "amber" | "violet" | "rose" }) {
  const cls = {
    emerald: "border-emerald-400/40 text-emerald-200 bg-emerald-400/[0.06]",
    amber: "border-amber-400/40 text-amber-200 bg-amber-400/[0.06]",
    violet: "border-violet-400/40 text-violet-200 bg-violet-400/[0.06]",
    rose: "border-rose-400/40 text-rose-200 bg-rose-400/[0.06]",
  }[tint];
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${cls}`}>
      <CheckCheck className="h-3 w-3" />
      Gate {name}
    </div>
  );
}

export function LuxeCommsFlow() {
  return (
    <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-6 md:p-8">
      <div className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
          Flux wedge
        </p>
        <h3 className="mt-2 font-display text-2xl font-bold text-white md:text-3xl">
          Le parcours d&apos;une communication luxe
        </h3>
        <p className="mt-2 max-w-2xl text-sm text-white/60">
          Chaque sortie traverse au minimum 2 gates (BRAND + CLAIM) avant validation humaine.
          Le mode crise active un fast-track SLA 4h.
        </p>
      </div>

      {/* Desktop flow */}
      <div className="hidden md:block">
        <div className="grid grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto_1fr_auto] items-center gap-2">
          {/* Inputs */}
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <Users className="mx-auto h-4 w-4 text-white/50" />
              <p className="mt-1 text-xs font-semibold text-white/75">USER brief</p>
            </div>
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-center">
              <Zap className="mx-auto h-4 w-4 text-rose-300" />
              <p className="mt-1 text-xs font-semibold text-rose-200">CRISIS flag</p>
            </div>
          </div>

          <Arrow />

          {/* Generation */}
          <div className="flex flex-col gap-3">
            <Agent id="AG-002" name="LuxePressAgent" Icon={Newspaper} tint="violet" note="Brief → draft" />
            <Agent id="AG-003" name="LuxeEventComms" Icon={Sparkles} tint="amber" note="Pack event" />
          </div>

          <Arrow label="draft" />

          {/* Brand gate */}
          <div className="flex flex-col items-center gap-2">
            <Gate name="BRAND" tint="emerald" />
            <Agent id="AG-001" name="MaisonVoiceGuard" Icon={ShieldCheck} tint="emerald" note="Score /100 + hard-fail" />
          </div>

          <Arrow label="si claim RSE" />

          {/* Claim gate */}
          <div className="flex flex-col items-center gap-2">
            <Gate name="CLAIM" tint="rose" />
            <Agent id="AG-005" name="GreenClaimChecker" Icon={Leaf} tint="rose" note="Evidence + juridiction" />
          </div>

          <Arrow />

          {/* Review */}
          <div>
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.08] p-3 text-center">
              <CheckCheck className="mx-auto h-4 w-4 text-emerald-300" />
              <p className="mt-1 text-xs font-semibold text-emerald-200">Review humaine</p>
              <p className="mt-0.5 text-[10px] text-white/50">Brand Dir / PR Dir / CMO</p>
            </div>
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/55">
                Publication
              </p>
            </div>
          </div>
        </div>

        {/* Heritage side-loop */}
        <div className="mt-8 flex items-center gap-3 rounded-2xl border border-violet-400/15 bg-violet-400/[0.03] p-4">
          <Agent id="AG-004" name="HeritageComms" Icon={Landmark} tint="violet" note="Sources + citations" />
          <Arrow label="blocs narratifs" />
          <p className="text-xs text-white/55">
            Enrichit AG-002 (presse) et AG-003 (events) en blocs patrimoniaux sources — gate HERITAGE
            bloquante si source TERTIARY seule ou STALE.
          </p>
        </div>
      </div>

      {/* Mobile flow (vertical stack) */}
      <div className="flex flex-col gap-2 md:hidden">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center text-xs text-white/75">
          USER brief (+ CRISIS flag)
        </div>
        <Arrow vertical />
        <Agent id="AG-002" name="LuxePressAgent" Icon={Newspaper} tint="violet" />
        <Agent id="AG-003" name="LuxeEventComms" Icon={Sparkles} tint="amber" />
        <Arrow vertical label="draft" />
        <Gate name="BRAND" tint="emerald" />
        <Agent id="AG-001" name="MaisonVoiceGuard" Icon={ShieldCheck} tint="emerald" />
        <Arrow vertical label="si claim" />
        <Gate name="CLAIM" tint="rose" />
        <Agent id="AG-005" name="GreenClaimChecker" Icon={Leaf} tint="rose" />
        <Arrow vertical />
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.08] p-3 text-center text-xs font-semibold text-emerald-200">
          Review humaine + Publication
        </div>
        <div className="mt-3 rounded-xl border border-violet-400/15 bg-violet-400/[0.03] p-3 text-xs text-white/60">
          <Agent id="AG-004" name="HeritageComms" Icon={Landmark} tint="violet" note="Enrichit AG-002 et AG-003 — gate HERITAGE" />
        </div>
      </div>
    </div>
  );
}
