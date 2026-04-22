import type { Metadata } from "next";

import { LuxeCommsAgentPage } from "@/components/luxe-comms/LuxeCommsAgentPage";
import { BrandVocabShowcase } from "@/components/luxe-comms/BrandVocabShowcase";
import { VoiceGuardLiveScorer } from "@/components/luxe-comms/VoiceGuardLiveScorer";
import { LUXE_COMMS_SUMMARY } from "@/lib/data/luxe-comms-catalog";

export const metadata: Metadata = {
  title: "MaisonVoiceGuard — score brand + hard-fail | NEURAL",
  description:
    "AG-001 MaisonVoiceGuard : scorer chaque communication sur la conformite charte. 15 regles ponderees, 17 hard-fail FR+EN, seuils configurables par maison. Demo live scorer.",
};

export default function MaisonVoiceGuardPage() {
  const s = LUXE_COMMS_SUMMARY;
  return (
    <LuxeCommsAgentPage slug="maison-voice-guard" hideDemoPlaceholder>
      <div className="space-y-12">
        {/* PEPITE : Live Scorer en haut */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
            Demo live — Sprint 3
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Testez l&apos;agent avec votre texte.
          </h2>
          <p className="mt-3 max-w-3xl text-white/60">
            Collez un communique, un post, une invitation. Verdict en moins de 3 secondes — avec
            score /100, hard-fail detectes, et suggestion de reecriture. Aucune donnee stockee,
            rate-limit 20 requetes/min par IP, traces Langfuse anonymes.
          </p>
          <div className="mt-6">
            <VoiceGuardLiveScorer />
          </div>
        </div>

        {/* Ce que voit l'agent */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
            Ce que voit l&apos;agent
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            {s.brandRulesCount} regles ponderees · {s.hardFailRulesCount} hard-fail · {s.forbiddenTermsCount} mots interdits
          </h2>
          <p className="mt-3 max-w-3xl text-white/60">
            MaisonVoiceGuard lit trois sources : la charte editoriale (15 regles avec poids CRITICAL/HIGH/MEDIUM),
            le dictionnaire hard-fail (17 patterns zero-tolerance FR+EN) et le vocabulaire normatif (25 termes FR).
            Score /100 calcule en temps reel, decision APPROVE/REWORK/REJECT selon seuil par langue.
          </p>
          <div className="mt-8">
            <BrandVocabShowcase />
          </div>
        </div>
      </div>
    </LuxeCommsAgentPage>
  );
}
