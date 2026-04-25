import Link from "next/link";

const sectors = [
  { id: "tra", label: "Transport",    desc: "Logistique, maintenance prédictive, OIV",    bg: "#0A1628", href: "/secteurs/transport" },
  { id: "lux", label: "Luxe",         desc: "Inventaire multi-maisons, ESG, recrutement", bg: "#1A0F2E", href: "/secteurs/luxe" },
  { id: "aer", label: "Aéronautique", desc: "Supply critique, EASA, MRO intelligent",     bg: "#0B1C2E", href: "/secteurs/aeronautique" },
  { id: "saa", label: "SaaS",         desc: "PLG analytics, churn, revenue",              bg: "#0E1F2A", href: "/secteurs/saas" },
  { id: "ban", label: "Banque",        desc: "Communication regulee, marketing AMF/ACPR, MiFID, MiCA", bg: "#07111C", href: "/secteurs/banque" },
  { id: "ass", label: "Assurance",    desc: "Supply Chain sinistres, Marketing DDA, RGPD", bg: "#10231D", href: "/secteurs/assurance" },
];

export function SectionSectors() {
  return (
    <section className="nhp-sectors section-dark">
      <div className="nhp-container">
        <div className="nhp-section-head">
          <div className="eyebrow eyebrow-violet">06 secteurs</div>
          <h2 className="h-display h-tight">Calibrés par industrie.</h2>
          <p className="lead lead-dark">Chaque secteur a ses contraintes. Nos agents arrivent déjà formés aux vôtres.</p>
        </div>
        <div className="nhp-sectors-grid">
          {sectors.map((s, i) => (
            <Link key={s.id} href={s.href} className="nhp-sector-card" style={{ background: s.bg }}>
              <div className="nhp-sector-bg" />
              <div className="nhp-sector-body">
                <div className="nhp-sector-num">S/0{i + 1}</div>
                <div className="nhp-sector-label">{s.label}</div>
                <div className="nhp-sector-desc">{s.desc}</div>
                <div className="nhp-sector-arrow">Découvrir →</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
