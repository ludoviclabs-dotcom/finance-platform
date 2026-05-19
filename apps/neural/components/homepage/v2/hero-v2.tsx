import Link from "next/link";

import { PUBLIC_METRICS } from "@/lib/public-catalog";
import { AndroidVisual } from "../shared/android-visual";

export function HeroV2() {
  return (
    <section className="nhp-hero">
      <div className="nhp-hero-grain" />
      <div className="nhp-hero-inner nhp-container">
        <div className="nhp-hero-eyebrow">
          <span className="nhp-dot nhp-dot-green" /> Agents IA gouvernés · preuves publiques
        </div>

        <div className="nhp-hero-grid">
          <div className="nhp-hero-left">
            <h1 className="nhp-hero-title">
              <span>L&apos;intelligence</span>
              <span>augmentée,</span>
              <span>prouvée.</span>
            </h1>
            <p className="nhp-hero-lead">
              NEURAL expose un noyau public vérifiable : {PUBLIC_METRICS.liveAgents} agents avec
              données Excel, {PUBLIC_METRICS.runtimeWorkbooks} workbooks embarqués et{" "}
              {PUBLIC_METRICS.liveCells}/{PUBLIC_METRICS.frameworkCells} combinaisons secteur ×
              métier alimentées. La capacité cible reste 168 — pas le périmètre live d&apos;aujourd&apos;hui.
            </p>
            <div className="nhp-hero-ctas">
              <Link href="/secteurs/luxe/finance" className="nhp-btn nhp-btn-primary nhp-btn-xl">
                Voir la démo live →
              </Link>
              <Link href="/proof" className="nhp-btn nhp-btn-link">
                Vérifier les preuves ▸
              </Link>
            </div>
            <div className="nhp-hero-foot">
              <div className="nhp-haf-l">Noyau prouvé</div>
              <div className="nhp-haf-logos">
                <span>Luxe Finance + Luxe Communication</span>{" "}
                <span>· exports signés, supervision humaine</span>
              </div>
            </div>
          </div>

          <div className="nhp-hero-right">
            <AndroidVisual size={460}>
              <div className="nhp-badge nhp-badge-tl">
                <div className="nhp-hab-k">{PUBLIC_METRICS.liveAgents}</div>
                <div className="nhp-hab-l">agents avec données</div>
              </div>
              <div className="nhp-badge nhp-badge-br">
                <div className="nhp-hab-k">{PUBLIC_METRICS.runtimeWorkbooks}</div>
                <div className="nhp-hab-l">workbooks runtime</div>
              </div>
              <div className="nhp-badge nhp-badge-bl">
                <div className="nhp-hab-pulse"><span/><span/><span/></div>
                <div className="nhp-hab-l">{PUBLIC_METRICS.liveCells}/{PUBLIC_METRICS.frameworkCells} cellules alimentées</div>
              </div>
            </AndroidVisual>
          </div>
        </div>
      </div>
    </section>
  );
}
