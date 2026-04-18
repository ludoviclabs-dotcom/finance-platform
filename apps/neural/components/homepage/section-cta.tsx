import Link from "next/link";

export function SectionCTA() {
  return (
    <section className="nhp-cta">
      <div className="nhp-container nhp-cta-inner">
        <div>
          <div className="eyebrow eyebrow-violet">Prochaine étape</div>
          <h2 className="h-display h-massive">
            Audit gratuit.<br/>
            <span className="muted-dark">Pas d&apos;engagement.<br/>Un KPI concret en sortie.</span>
          </h2>
        </div>
        <div>
          <div className="nhp-cta-steps">
            <div className="nhp-cta-step"><span>01</span> Cadrage 30 min en visio</div>
            <div className="nhp-cta-step"><span>02</span> Identification de 3 cas d&apos;usage</div>
            <div className="nhp-cta-step"><span>03</span> Livrable : un ROI estimé signé</div>
          </div>
          <Link href="/contact" className="nhp-btn nhp-btn-primary nhp-btn-xl">Réserver mon audit →</Link>
          <div className="nhp-cta-sub">~ 72h pour être rappelé · Réservé aux entreprises &gt; 50 personnes</div>
        </div>
      </div>
    </section>
  );
}
