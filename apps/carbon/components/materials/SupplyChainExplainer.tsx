import { Pickaxe, Factory, Wrench, BatteryCharging, Car, type LucideIcon } from "lucide-react";
import { Section } from "./industry/Section";
import { SectionKicker, SectionTitle } from "./industry/SectionKicker";

// Frise pédagogique de la chaîne de valeur — les 5 étapes et pays associés
// illustrent des mécanismes de concentration connus (extraction, raffinage,
// transformation, composants, produits finis), sans quantification chiffrée :
// le snapshot actuel ne mesure pas séparément chaque étape par matière.
//
// Les emojis de la version précédente sont remplacés par des icônes Lucide au
// trait 1.5 : le système de design proscrit les traits épais et les aplats
// décoratifs, et une même teinte acier porte désormais toute la frise (plus de
// couleur par étape).
const STEPS: { icon: LucideIcon; step: string; label: string; desc: string; risk: string; countries: string[] }[] = [
  {
    icon: Pickaxe, step: "01", label: "Extraction",
    desc: "Mines à ciel ouvert ou souterraines. Production de concentré minéral selon les pays producteurs.",
    risk: "Concentration géographique · instabilité politique · coûts environnementaux",
    countries: ["Chine", "RD Congo", "Australie", "Chili"],
  },
  {
    icon: Factory, step: "02", label: "Raffinage",
    desc: "Hydrométallurgie et pyrométallurgie. Étape la plus concentrée géographiquement de la chaîne.",
    risk: "Capacités fortement concentrées dans un nombre limité de pays",
    countries: ["Chine", "Japon", "Estonie"],
  },
  {
    icon: Wrench, step: "03", label: "Transformation",
    desc: "Fabrication d'alliages, aimants permanents NdFeB, précurseurs de batteries, oxydes spéciaux.",
    risk: "Capacités de transformation et d'aimants géographiquement concentrées",
    countries: ["Chine", "Japon", "Corée du Sud"],
  },
  {
    icon: BatteryCharging, step: "04", label: "Composants",
    desc: "Moteurs électriques, semi-conducteurs GaN/GaAs, cellules photovoltaïques, turbines éoliennes.",
    risk: "Dépendance à des écosystèmes industriels spécialisés",
    countries: ["Chine", "Taïwan", "Corée du Sud"],
  },
  {
    icon: Car, step: "05", label: "Produits finis",
    desc: "Véhicules électriques, éoliennes, smartphones, satellites, systèmes de défense et guidage.",
    risk: "Impact direct sur souveraineté industrielle et capacités de défense",
    countries: ["Europe", "USA", "Chine", "Japon"],
  },
];

export default function SupplyChainExplainer({ revealDelay }: { revealDelay?: number }) {
  return (
    <Section id="chaine" revealDelay={revealDelay} paddingBottom={72}>
      <SectionKicker>05 · De la mine au produit fini</SectionKicker>
      <SectionTitle>La chaîne d’approvisionnement mondiale</SectionTitle>
      <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: "24px", maxWidth: "64ch", color: "var(--ink-78)" }}>
        Chaque maillon est un point de vulnérabilité stratégique. La Chine domine les maillons intermédiaires — les
        plus critiques et les plus difficiles à dupliquer.
      </p>
      <p style={{ margin: "8px 0 40px", fontSize: 13, lineHeight: "20px", maxWidth: "72ch", color: "var(--ink-70)" }}>
        Schéma pédagogique — le snapshot actuel ne quantifie pas séparément chaque étape ; les pays cités illustrent
        des mécanismes de concentration connus, pas une mesure auditée par matière.
      </p>

      <div className="relative">
        {/* Le trait de liaison se dessine derrière les nœuds. Masqué tant que
            les colonnes sont empilées : il relierait des repères qui ne sont
            plus sur une ligne. */}
        <svg
          viewBox="0 0 1000 40"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="hidden lg:block absolute"
          style={{ left: "10%", width: "80%", top: 0, height: 40, overflow: "visible" }}
        >
          <line x1="0" y1="20" x2="1000" y2="20" stroke="var(--color-divider)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <line
            className="ind-draw"
            x1="0" y1="20" x2="1000" y2="20"
            stroke="var(--color-accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke"
            strokeDasharray={1000} strokeDashoffset={1000}
          />
        </svg>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-6">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              // Entrée échelonnée jouée au chargement, aux retards de la maquette.
              <div key={s.step} className="ind-reveal flex flex-col gap-5" style={{ animationDelay: `${0.5 + i * 0.18}s` }}>
                {/* Nœud sans repères « + » : la maquette n'en trace pas ici (son
                    <i class="corner"> n'est pas l'enfant direct d'un
                    .blueprint, la règle qui dessine la croix ne s'y applique pas). */}
                <div className="flex justify-center relative z-10">
                  <div
                    className="relative flex items-center justify-center"
                    style={{
                      width: 40, height: 40,
                      background: "var(--color-bg)",
                      border: "1px solid var(--color-text)",
                      color: "var(--color-text)",
                    }}
                  >
                    <Icon width={20} height={20} strokeWidth={1.5} aria-hidden="true" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>
                    {s.step}
                  </span>
                  <h4
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-heading)",
                      fontWeight: 600,
                      fontSize: 22,
                      lineHeight: "24px",
                      letterSpacing: ".02em",
                      textTransform: "uppercase",
                    }}
                  >
                    {s.label}
                  </h4>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: "20px", color: "var(--ink-78)" }}>{s.desc}</p>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: "20px", color: "var(--color-accent-700)" }}>▲ {s.risk}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {s.countries.map(c => (
                      <span key={c} className="ind-tag ind-tag-neutral">{c}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
