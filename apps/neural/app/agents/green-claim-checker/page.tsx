import type { Metadata } from "next";

import { LuxeCommsAgentPage } from "@/components/luxe-comms/LuxeCommsAgentPage";
import { ClaimCheckLive } from "@/components/luxe-comms/ClaimCheckLive";
import { ClaimStatusTiles } from "@/components/luxe-comms/ClaimStatusTiles";
import { JurisdictionHeatmap } from "@/components/luxe-comms/JurisdictionHeatmap";
import { LUXE_COMMS_SUMMARY } from "@/lib/data/luxe-comms-catalog";

export const metadata: Metadata = {
  title: "GreenClaimChecker — conformite Green Claims Directive | NEURAL",
  description:
    "AG-005 GreenClaimChecker : verifie chaque affirmation RSE contre preuves reelles et regulations (EU Green Claims Directive 2024, Loi Climat FR, CMA UK, FTC US). Matrice 5 juridictions. Demo live disponible.",
};

export default function GreenClaimCheckerPage() {
  const s = LUXE_COMMS_SUMMARY;
  return (
    <LuxeCommsAgentPage slug="green-claim-checker" hideDemoPlaceholder>
      <div className="space-y-12">
        {/* PEPITE : demo live */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-rose-200">
            Demo live — Sprint 4
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Testez un claim RSE contre 5 juridictions.
          </h2>
          <p className="mt-3 max-w-3xl text-white/60">
            Entrez votre affirmation, selectionnez la juridiction cible. L&apos;agent match contre la
            claim library, score le risque et cite la regulation concernee. Mode fallback deterministique
            si AI Gateway indisponible — vous verrez une decision coherente dans tous les cas.
          </p>
          <div className="mt-6">
            <ClaimCheckLive />
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
            Claims Registry runtime
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            {s.claimsTotal} claims · {s.jurisdictionsCount} claim-types mappes · {s.juridictionsCovered} juridictions
          </h2>
          <p className="mt-3 max-w-3xl text-white/60">
            GreenClaimChecker detecte chaque affirmation RSE dans un draft, la matche contre la base
            de claims eprouves (ou declenche un BLOCK si aucun), score le risque selon le wording
            (ABSOLUTE / QUALIFIED / COMPARATIVE) et la juridiction cible. L&apos;EU Green Claims Directive
            entre en application pleine en 2026 — l&apos;agent permet de s&apos;y preparer des aujourd&apos;hui.
          </p>
        </div>

        <ClaimStatusTiles />

        <JurisdictionHeatmap />
      </div>
    </LuxeCommsAgentPage>
  );
}
