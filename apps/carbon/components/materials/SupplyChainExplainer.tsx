// Frise pédagogique de la chaîne de valeur — les 5 étapes et pays associés
// illustrent des mécanismes de concentration connus (extraction, raffinage,
// transformation, composants, produits finis), sans quantification chiffrée :
// le snapshot actuel ne mesure pas séparément chaque étape par matière.
const STEPS = [
  {
    icon: "⛏️", step: "01", label: "Extraction",
    desc: "Mines à ciel ouvert ou souterraines. Production de concentré minéral selon les pays producteurs.",
    risk: "Concentration géographique · Instabilité politique · Coûts environnementaux",
    countries: ["Chine", "RD Congo", "Australie", "Chili"],
  },
  {
    icon: "🏭", step: "02", label: "Raffinage",
    desc: "Hydrométallurgie et pyrométallurgie. Étape la plus concentrée géographiquement de la chaîne.",
    risk: "Capacités de raffinage fortement concentrées dans un nombre limité de pays",
    countries: ["Chine", "Japon", "Estonie"],
  },
  {
    icon: "🔧", step: "03", label: "Transformation",
    desc: "Fabrication d'alliages, aimants permanents NdFeB, précurseurs de batteries, oxydes spéciaux.",
    risk: "Capacités de transformation et de fabrication d'aimants géographiquement concentrées",
    countries: ["Chine", "Japon", "Corée du Sud"],
  },
  {
    icon: "🔋", step: "04", label: "Composants",
    desc: "Moteurs électriques, semi-conducteurs GaN/GaAs, cellules photovoltaïques, turbines éoliennes.",
    risk: "Dépendance à des écosystèmes industriels spécialisés",
    countries: ["Chine", "Taïwan", "Corée du Sud"],
  },
  {
    icon: "🚗", step: "05", label: "Produits finis",
    desc: "Véhicules électriques, éoliennes, smartphones, satellites, systèmes de défense et guidage.",
    risk: "Impact direct sur souveraineté industrielle et capacités de défense",
    countries: ["Europe", "USA", "Chine", "Japon"],
  },
];

export default function SupplyChainExplainer() {
  return (
    <section id="supply-chain" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">La chaîne d&apos;approvisionnement mondiale</h2>
        <p className="text-zinc-400 text-sm mt-1 max-w-2xl">
          De la mine au produit fini, chaque maillon est un point de vulnérabilité stratégique.
          La Chine domine les maillons intermédiaires — les plus critiques et les plus difficiles à dupliquer.
        </p>
        <p className="text-[10px] text-zinc-600 mt-1.5 max-w-2xl">
          Schéma pédagogique — le snapshot actuel ne quantifie pas séparément chaque étape ; les pays
          cités illustrent des mécanismes de concentration connus, pas une mesure auditée par matière.
        </p>
      </div>
      <div className="relative">
        <div className="absolute top-8 left-8 right-8 h-0.5 bg-gradient-to-r from-red-500/40 via-amber-500/40 to-emerald-500/40 hidden lg:block" />
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {STEPS.map(s => (
            <div key={s.step} className="relative">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-zinc-900 border-2 border-zinc-700 flex items-center justify-center z-10 relative">
                  <span className="text-2xl">{s.icon}</span>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
                <div>
                  <span className="text-xs font-mono text-zinc-600">{s.step}</span>
                  <h4 className="font-bold text-white">{s.label}</h4>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{s.desc}</p>
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-2 py-1.5">
                  <p className="text-xs text-red-400 leading-snug">⚠ {s.risk}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {s.countries.map(c => (
                    <span key={c} className="text-[10px] rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-400">{c}</span>
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
