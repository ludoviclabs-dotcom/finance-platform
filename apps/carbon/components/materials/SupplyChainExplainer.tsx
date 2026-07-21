// Frise pédagogique de la chaîne de valeur — les 5 étapes et pays associés
// illustrent des mécanismes de concentration connus (extraction, raffinage,
// transformation, composants, produits finis), sans quantification chiffrée :
// le snapshot actuel ne mesure pas séparément chaque étape par matière.
const STEPS = [
  {
    icon: "⛏️", step: "01", label: "Extraction", color: "var(--mx-tier-high)",
    desc: "Mines à ciel ouvert ou souterraines. Production de concentré minéral selon les pays producteurs.",
    risk: "Concentration géographique · instabilité politique · coûts environnementaux",
    countries: ["Chine", "RD Congo", "Australie", "Chili"],
  },
  {
    icon: "🏭", step: "02", label: "Raffinage", color: "var(--mx-amber)",
    desc: "Hydrométallurgie et pyrométallurgie. Étape la plus concentrée géographiquement de la chaîne.",
    risk: "Capacités fortement concentrées dans un nombre limité de pays",
    countries: ["Chine", "Japon", "Estonie"],
  },
  {
    icon: "🔧", step: "03", label: "Transformation", color: "var(--mx-violet)",
    desc: "Fabrication d'alliages, aimants permanents NdFeB, précurseurs de batteries, oxydes spéciaux.",
    risk: "Capacités de transformation et d'aimants géographiquement concentrées",
    countries: ["Chine", "Japon", "Corée du Sud"],
  },
  {
    icon: "🔋", step: "04", label: "Composants", color: "var(--mx-cyan)",
    desc: "Moteurs électriques, semi-conducteurs GaN/GaAs, cellules photovoltaïques, turbines éoliennes.",
    risk: "Dépendance à des écosystèmes industriels spécialisés",
    countries: ["Chine", "Taïwan", "Corée du Sud"],
  },
  {
    icon: "🚗", step: "05", label: "Produits finis", color: "var(--mx-em)",
    desc: "Véhicules électriques, éoliennes, smartphones, satellites, systèmes de défense et guidage.",
    risk: "Impact direct sur souveraineté industrielle et capacités de défense",
    countries: ["Europe", "USA", "Chine", "Japon"],
  },
];

export default function SupplyChainExplainer() {
  return (
    <section id="chaine" className="mx-anchor space-y-5">
      <div>
        <p className="m-0 mb-1.5 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-em)" }}>
          <span className="w-[22px] h-px" style={{ background: "var(--mx-em)" }} />
          De la mine au produit fini
        </p>
        <h2 className="m-0 font-bold text-2xl tracking-tight" style={{ fontFamily: "var(--mx-font-display)", color: "var(--mx-fg)" }}>
          La chaîne d&apos;approvisionnement mondiale
        </h2>
        <p className="mt-1.5 mb-0 text-[13px] max-w-2xl" style={{ color: "var(--mx-muted)" }}>
          Chaque maillon est un point de vulnérabilité stratégique. La Chine domine les maillons intermédiaires
          — les plus critiques et les plus difficiles à dupliquer.
        </p>
        <p className="mt-1.5 mb-0 text-[10px] max-w-2xl" style={{ color: "var(--mx-subtle)" }}>
          Schéma pédagogique — le snapshot actuel ne quantifie pas séparément chaque étape ; les pays cités
          illustrent des mécanismes de concentration connus, pas une mesure auditée par matière.
        </p>
      </div>

      <div className="relative">
        <div className="hidden lg:block absolute top-[21px] left-10 right-10 h-0.5 rounded-full overflow-hidden" style={{ background: "linear-gradient(90deg, color-mix(in srgb, var(--mx-tier-high) 45%, transparent), color-mix(in srgb, var(--mx-amber) 45%, transparent), color-mix(in srgb, var(--mx-cyan) 45%, transparent), color-mix(in srgb, var(--mx-em) 45%, transparent))" }}>
          <div className="mx-beam absolute inset-0 w-2/5" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent)" }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {STEPS.map(s => (
            <div key={s.step} className="flex flex-col gap-3">
              <div className="flex justify-center">
                <div
                  className="relative z-10 w-11 h-11 rounded-full flex items-center justify-center border-2"
                  style={{ background: "var(--mx-surface)", borderColor: s.color, boxShadow: `0 0 18px color-mix(in srgb, ${s.color} 30%, transparent)` }}
                >
                  <span className="text-lg">{s.icon}</span>
                </div>
              </div>
              <div
                className="rounded-[14px] border p-4 flex flex-col gap-2.5 flex-1 transition-transform hover:-translate-y-[3px]"
                style={{ borderColor: "var(--mx-border)", background: "var(--mx-card)", boxShadow: "var(--mx-shadow)" }}
              >
                <div>
                  <span className="font-bold text-[13px]" style={{ fontFamily: "var(--mx-font-mono)", color: s.color }}>{s.step}</span>
                  <h4 className="m-0 font-semibold text-[14.5px]" style={{ fontFamily: "var(--mx-font-display)", color: "var(--mx-fg)" }}>{s.label}</h4>
                </div>
                <p className="m-0 text-xs leading-relaxed" style={{ color: "var(--mx-muted)" }}>{s.desc}</p>
                <p className="m-0 text-[11px] leading-snug" style={{ color: s.color }}>▲ {s.risk}</p>
                <div className="flex flex-wrap gap-1.5 mt-auto">
                  {s.countries.map(c => (
                    <span key={c} className="text-[10.5px] rounded-full px-2.5 py-0.5 border" style={{ background: "var(--mx-chip)", borderColor: "var(--mx-border)", color: "var(--mx-muted)" }}>{c}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
