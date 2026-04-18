import Link from "next/link";
import { AndroidVisual } from "./shared/android-visual";

export function HeroUnified() {
  return (
    <section className="nhp-hero">
      <div className="nhp-hero-grain" />
      <div className="nhp-hero-inner nhp-container">
        <div className="nhp-hero-eyebrow">
          <span className="nhp-dot nhp-dot-green" /> Claude Sonnet · Partenaire Anthropic
        </div>

        <div className="nhp-hero-grid">
          <div className="nhp-hero-left">
            <h1 className="nhp-hero-title">
              <span>L&apos;intelligence</span>
              <span>augmentée,</span>
              <span>déployée.</span>
            </h1>
            <p className="nhp-hero-lead">
              168 agents Claude spécialisés. 7 branches métier. 6 secteurs.
              ROI contractualisé avant toute ligne de code.
            </p>
            <div className="nhp-hero-ctas">
              <Link href="/contact" className="nhp-btn nhp-btn-primary nhp-btn-xl">Réserver un audit →</Link>
              <Link href="/marketplace" className="nhp-btn nhp-btn-link">Voir la démo ▸</Link>
            </div>
            <div className="nhp-hero-foot">
              <div className="nhp-haf-l">Déployé chez</div>
              <div className="nhp-haf-logos">LVMH · Air France · AXA · Bouygues · Kering · BNP</div>
            </div>
          </div>

          <div className="nhp-hero-right">
            <AndroidVisual size={460}>
              <div className="nhp-badge nhp-badge-tl">
                <div className="nhp-hab-k">168</div>
                <div className="nhp-hab-l">agents actifs</div>
              </div>
              <div className="nhp-badge nhp-badge-br">
                <div className="nhp-hab-k">+340<span>%</span></div>
                <div className="nhp-hab-l">ROI an 1</div>
              </div>
              <div className="nhp-badge nhp-badge-bl">
                <div className="nhp-hab-pulse"><span/><span/><span/></div>
                <div className="nhp-hab-l">claude-sonnet · en ligne</div>
              </div>
            </AndroidVisual>
          </div>
        </div>
      </div>
    </section>
  );
}
