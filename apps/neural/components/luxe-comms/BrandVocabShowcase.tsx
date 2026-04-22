/**
 * BrandVocabShowcase — Server Component
 * Expose 6 termes FORBIDDEN + 6 PREFERRED tires du catalogue FR.
 * Met en valeur la discipline vocabulaire : ce qui est banni / ce qui est encourage.
 */
import { Ban, Sparkles } from "lucide-react";

import { VOCAB_FR, type VocabFr } from "@/lib/data/luxe-comms-catalog";

function pick(type: VocabFr["term_type"], n: number): VocabFr[] {
  return VOCAB_FR.filter((v) => v.term_type === type).slice(0, n);
}

export function BrandVocabShowcase() {
  const forbidden = pick("FORBIDDEN", 6);
  const preferred = pick("PREFERRED", 6);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* FORBIDDEN */}
      <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/[0.04] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-400/10">
            <Ban className="h-4 w-4 text-rose-300" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-rose-300">
              Hard-fail
            </p>
            <h3 className="font-display text-xl font-bold text-white">Vocabulaire banni</h3>
          </div>
        </div>
        <p className="mt-3 text-sm text-white/60">
          Refus automatique a la detection. Zero tolerance, quelle que soit la langue.
        </p>
        <ul className="mt-5 space-y-2">
          {forbidden.map((v) => (
            <li
              key={v.term_id}
              className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm"
            >
              <span className="font-mono text-rose-200">{v.terme}</span>
              <span className="text-right text-xs text-white/45">
                {v.suggestion_remplacement && v.suggestion_remplacement !== "-"
                  ? `→ ${v.suggestion_remplacement}`
                  : v.contexte ?? ""}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* PREFERRED */}
      <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/[0.04] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10">
            <Sparkles className="h-4 w-4 text-emerald-300" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-300">
              Bonus charte
            </p>
            <h3 className="font-display text-xl font-bold text-white">Vocabulaire valorise</h3>
          </div>
        </div>
        <p className="mt-3 text-sm text-white/60">
          Termes preferes qui bonifient le score brand — savoir-faire, heritage, metier.
        </p>
        <ul className="mt-5 space-y-2">
          {preferred.map((v) => (
            <li
              key={v.term_id}
              className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm"
            >
              <span className="font-mono text-emerald-200">{v.terme}</span>
              <span className="text-right text-xs text-white/45">{v.categorie ?? ""}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
