import Link from "next/link";

import { PUBLIC_METRICS } from "@/lib/public-catalog";
import { AndroidVisual } from "./shared/android-visual";

export function HeroUnified() {
  return (
    <section className="nhp-hero">
      <div className="nhp-hero-grain" />
      <div className="nhp-hero-inner nhp-container">
        <div className="nhp-hero-eyebrow">
          <span className="nhp-dot nhp-dot-green" /> Workbooks Excel · agents gouvernes
        </div>

        <div className="nhp-hero-grid">
          <div className="nhp-hero-left">
            <h1 className="nhp-hero-title">
              <span>L&apos;intelligence</span>
              <span>augmentee,</span>
              <span>prouvee.</span>
            </h1>
            <p className="nhp-hero-lead">
              {PUBLIC_METRICS.liveAgents} agents avec données Excel,{" "}
              {PUBLIC_METRICS.runtimeWorkbooks} workbooks embarqués et{" "}
              {PUBLIC_METRICS.liveCells}/{PUBLIC_METRICS.frameworkCells} cellules alimentées.
              Les 168 agents restent la capacité cible du framework, pas le périmètre live.
            </p>
            <div className="nhp-hero-ctas">
              <Link href="/proof" className="nhp-btn nhp-btn-primary nhp-btn-xl">
                Voir la preuve →
              </Link>
              <Link href="/secteurs/luxe/finance" className="nhp-btn nhp-btn-link">
                Ouvrir le noyau live ▸
              </Link>
            </div>
            <div className="nhp-hero-foot">
              <div className="nhp-haf-l">Etat du catalogue</div>
              <div className="nhp-haf-logos">Luxe Finance + Luxe Communication en noyau prouve</div>
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
                <div className="nhp-hab-l">{PUBLIC_METRICS.liveCells}/42 cellules alimentées</div>
              </div>
            </AndroidVisual>
          </div>
        </div>
      </div>
    </section>
  );
}
