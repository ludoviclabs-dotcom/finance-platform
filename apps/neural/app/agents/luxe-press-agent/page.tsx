import type { Metadata } from "next";

import { LuxeCommsAgentPage } from "@/components/luxe-comms/LuxeCommsAgentPage";
import { MediaMatrixGrid } from "@/components/luxe-comms/MediaMatrixGrid";
import { PressAngleLive } from "@/components/luxe-comms/PressAngleLive";
import { LUXE_COMMS_SUMMARY } from "@/lib/data/luxe-comms-catalog";

export const metadata: Metadata = {
  title: "LuxePressAgent — rediger pour Vogue ET le FT | NEURAL",
  description:
    "AG-002 LuxePressAgent : redige communiques dans le registre du luxe. Adapte presse lifestyle (Vogue, HB, Numero) vs. business (FT, BoF, WWD) via media matrix, gere embargos et press pickup. Demo live angle generator.",
};

export default function LuxePressAgentPage() {
  const s = LUXE_COMMS_SUMMARY;
  return (
    <LuxeCommsAgentPage slug="luxe-press-agent" hideDemoPlaceholder>
      <div className="space-y-12">
        {/* PEPITE : demo live */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
            Demo live — Sprint 4
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Un brief, 7 angles — selon l&apos;outlet cible.
          </h2>
          <p className="mt-3 max-w-3xl text-white/60">
            Collez votre brief, choisissez Vogue / FT / BoF / T Magazine… L&apos;agent genere l&apos;angle,
            l&apos;accroche (&lt;140 chars), le lede, la structure et — si l&apos;outlet l&apos;attend — la quote CEO.
            Conforme charte luxe : aucun superlatif, vocabulaire atelier preserve.
          </p>
          <div className="mt-6">
            <PressAngleLive />
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
            Media Directory runtime
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            {s.mediaDirectoryCount} medias references · {s.p1MediaCount} priorite 1
          </h2>
          <p className="mt-3 max-w-3xl text-white/60">
            Chaque outlet a son angle editorial, sa longueur cible, son protocole embargo, son statut
            relation. LuxePressAgent lit la matrice (7 types) pour adapter le draft : une accroche
            Vogue n&apos;est pas une accroche FT. Le handoff BRAND va a AG-001, le handoff CLAIM va a AG-005
            quand un terme RSE est detecte.
          </p>
          <div className="mt-8">
            <MediaMatrixGrid />
          </div>
        </div>
      </div>
    </LuxeCommsAgentPage>
  );
}
