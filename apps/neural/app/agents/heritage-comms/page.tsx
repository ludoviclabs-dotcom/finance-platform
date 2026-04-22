import type { Metadata } from "next";

import { LuxeCommsAgentPage } from "@/components/luxe-comms/LuxeCommsAgentPage";
import { HeritageQuoteLive } from "@/components/luxe-comms/HeritageQuoteLive";
import { HeritageSourceTree } from "@/components/luxe-comms/HeritageSourceTree";
import { LUXE_COMMS_SUMMARY } from "@/lib/data/luxe-comms-catalog";

export const metadata: Metadata = {
  title: "HeritageComms — sourcing patrimonial sans hallucination | NEURAL",
  description:
    "AG-004 HeritageComms : sourcing patrimonial discipline. Aucune sortie sans source cataloguee + citation formatee. 10 sources classifiees PRIMARY/SECONDARY/TERTIARY. Demo live disponible.",
};

export default function HeritageCommsPage() {
  const s = LUXE_COMMS_SUMMARY;
  return (
    <LuxeCommsAgentPage slug="heritage-comms" hideDemoPlaceholder>
      <div className="space-y-12">
        {/* PEPITE : demo live */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
            Demo live — Sprint 4
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Sourcez un fait patrimonial.
          </h2>
          <p className="mt-3 max-w-3xl text-white/60">
            Tapez une query historique. L&apos;agent cherche UNIQUEMENT dans les faits approuves
            et le source catalog runtime. Si rien ne matche, il le dit — aucune invention jamais.
            4 formats de citation disponibles (Maison-style, Chicago, APA, Juridique).
          </p>
          <div className="mt-6">
            <HeritageQuoteLive />
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
            Source catalog runtime
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            {s.heritageSourcesCount} sources cataloguees · {s.primarySourcesCount} primaires
          </h2>
          <p className="mt-3 max-w-3xl text-white/60">
            HeritageComms applique la regle d&apos;or : aucune affirmation historique sans source active.
            Les sources TERTIARY declenchent une revue obligatoire. La date de revision est surveillee
            par un CF J-30 automatique — une source STALE bloque l&apos;usage.
          </p>
          <div className="mt-8">
            <HeritageSourceTree />
          </div>
        </div>
      </div>
    </LuxeCommsAgentPage>
  );
}
