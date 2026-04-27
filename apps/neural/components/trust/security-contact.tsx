/**
 * SecurityContact — bloc dédié à la divulgation de vulnérabilités (VDP)
 * et au contact sécurité.
 */

import { Mail, ShieldAlert, Bug } from "lucide-react";

export function SecurityContact() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/[0.10] text-emerald-300">
            <Mail className="h-4 w-4" aria-hidden="true" />
          </div>
          <h3 className="font-display text-xl font-bold tracking-tight text-white">
            Contact sécurité
          </h3>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-white/65">
          Pour toute question de sécurité, signalement de vulnérabilité ou demande
          d&apos;information sur nos pratiques :
        </p>
        <a
          href="mailto:security@neural-ai.fr"
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/[0.10] px-4 py-2 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-400/[0.16]"
        >
          security@neural-ai.fr
        </a>
        <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-white/35">
          Clé PGP publiée — empreinte sur demande
        </p>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-400/[0.10] text-violet-200">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          </div>
          <h3 className="font-display text-xl font-bold tracking-tight text-white">
            Politique de divulgation (VDP)
          </h3>
        </div>
        <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-white/65">
          <li className="flex gap-2">
            <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-violet-400" />
            <span>
              Signalement responsable encouragé. Confirmation sous 72h ouvrées.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-violet-400" />
            <span>
              Pas de poursuite contre un chercheur agissant de bonne foi (safe harbor).
            </span>
          </li>
          <li className="flex gap-2">
            <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-violet-400" />
            <span>
              Communication coordonnée du correctif avec crédits si souhaité.
            </span>
          </li>
        </ul>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/[0.10] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">
          <Bug className="h-3 w-3" aria-hidden="true" />
          Bug bounty privé — Roadmap T3 2026
        </div>
      </div>
    </div>
  );
}
