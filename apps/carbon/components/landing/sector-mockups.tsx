/**
 * Mockups sectoriels — 3 variantes du dashboard CarbonCo (Industrie, Services,
 * Agroalimentaire) avec des données plausibles par secteur. Chaque mockup est
 * un SVG inline auto-suffisant pour rester rapide et maintenable.
 *
 * Le but : permettre à un décideur de se reconnaître immédiatement dans la
 * prévisualisation produit selon son industrie.
 */

const PALETTE = {
  paper: "#FFFFFF",
  ink: "#0F172A",
  slate: "#475569",
  subtle: "#94A3B8",
  border: "#E2E8F0",
  emerald: "#059669",
  emeraldLight: "#34D399",
  cyan: "#0891B2",
  violet: "#7C3AED",
  amber: "#D97706",
  mist: "#ECFDF5",
} as const;

type SectorId = "industrie" | "services" | "agro";

interface SectorMeta {
  id: SectorId;
  title: string;
  tagline: string;
  unit: string;
  totalLabel: string;
  totalValue: string;
  totalUnit: string;
  scope1: number;
  scope2: number;
  scope3: number;
  hotspot: { label: string; share: string; color: string };
  postes: { label: string; value: string; share: number; color: string }[];
}

const SECTORS: Record<SectorId, SectorMeta> = {
  industrie: {
    id: "industrie",
    title: "Industrie",
    tagline: "Métallurgie · chimie · automobile",
    unit: "kWh / unité",
    totalLabel: "Émissions totales 2025",
    totalValue: "12 480",
    totalUnit: "tCO₂e",
    scope1: 38,
    scope2: 24,
    scope3: 38,
    hotspot: { label: "Combustion gaz process", share: "31 %", color: PALETTE.emerald },
    postes: [
      { label: "Combustion gaz process",  value: "3 871 tCO₂e", share: 31, color: PALETTE.emerald },
      { label: "Électricité atelier",      value: "2 245 tCO₂e", share: 18, color: PALETTE.cyan },
      { label: "Achats matières (acier)",  value: "1 996 tCO₂e", share: 16, color: PALETTE.violet },
      { label: "Logistique amont",         value: "1 372 tCO₂e", share: 11, color: PALETTE.amber },
    ],
  },
  services: {
    id: "services",
    title: "Services",
    tagline: "Conseil · banque · numérique",
    unit: "kgCO₂e / FTE",
    totalLabel: "Émissions totales 2025",
    totalValue: "1 845",
    totalUnit: "tCO₂e",
    scope1: 8,
    scope2: 22,
    scope3: 70,
    hotspot: { label: "Déplacements professionnels", share: "34 %", color: PALETTE.violet },
    postes: [
      { label: "Déplacements pro (avion)",  value: "627 tCO₂e", share: 34, color: PALETTE.violet },
      { label: "Cloud & data centers",       value: "295 tCO₂e", share: 16, color: PALETTE.cyan },
      { label: "Locaux (élec & chauffage)", value: "240 tCO₂e", share: 13, color: PALETTE.emerald },
      { label: "Services achetés",           value: "203 tCO₂e", share: 11, color: PALETTE.amber },
    ],
  },
  agro: {
    id: "agro",
    title: "Agroalimentaire",
    tagline: "Transformation · distribution",
    unit: "kgCO₂e / tonne",
    totalLabel: "Émissions totales 2025",
    totalValue: "8 730",
    totalUnit: "tCO₂e",
    scope1: 18,
    scope2: 12,
    scope3: 70,
    hotspot: { label: "Matières premières agricoles", share: "42 %", color: PALETTE.amber },
    postes: [
      { label: "Matières premières (lait, blé)", value: "3 666 tCO₂e", share: 42, color: PALETTE.amber },
      { label: "Logistique chaîne du froid",       value: "1 484 tCO₂e", share: 17, color: PALETTE.cyan },
      { label: "Emballages",                       value: "1 047 tCO₂e", share: 12, color: PALETTE.violet },
      { label: "Procédés thermiques",              value: "873 tCO₂e",   share: 10, color: PALETTE.emerald },
    ],
  },
};

interface SectorMockupProps {
  sector: SectorId;
  className?: string;
}

export function SectorMockup({ sector, className = "" }: SectorMockupProps) {
  const data = SECTORS[sector];
  const w = 720;
  const h = 460;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`Aperçu du dashboard CarbonCo pour le secteur ${data.title}`}
      className={`w-full h-auto ${className}`}
    >
      {/* fenêtre */}
      <rect width={w} height={h} rx="14" fill={PALETTE.paper} stroke={PALETTE.border} strokeWidth="1" />
      {/* barre de fenêtre */}
      <rect x="0" y="0" width={w} height="32" rx="14" fill="#F8FAFC" />
      <circle cx="18" cy="16" r="5" fill="#FCA5A5" />
      <circle cx="34" cy="16" r="5" fill="#FCD34D" />
      <circle cx="50" cy="16" r="5" fill="#86EFAC" />
      <text x={w / 2} y="20" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="11" fill={PALETTE.subtle}>
        carbonco.fr/dashboard — {data.title}
      </text>

      {/* sidebar */}
      <rect x="0" y="32" width="170" height={h - 32} fill="#F8FAFC" />
      <rect x="14" y="50" width="142" height="32" rx="8" fill={PALETTE.emerald} />
      <text x="32" y="71" fontFamily="system-ui" fontWeight="700" fontSize="13" fill={PALETTE.paper}>Dashboard</text>
      {["Scopes", "ESRS", "Matérialité", "Datapoints", "Audit", "Rapports"].map((label, i) => (
        <text key={label} x="32" y={102 + i * 28} fontFamily="system-ui" fontSize="12" fill={PALETTE.slate}>
          {label}
        </text>
      ))}

      {/* en-tête */}
      <text x="190" y="60" fontFamily="system-ui" fontWeight="800" fontSize="18" fill={PALETTE.ink}>
        Bilan carbone {data.title}
      </text>
      <text x="190" y="80" fontFamily="system-ui" fontSize="12" fill={PALETTE.slate}>
        {data.tagline} · Période 2025 · Unité {data.unit}
      </text>

      {/* KPI total */}
      <rect x="190" y="100" width="220" height="84" rx="10" fill={PALETTE.mist} stroke={PALETTE.emerald} strokeWidth="1" />
      <text x="206" y="124" fontFamily="system-ui" fontSize="11" fontWeight="600" fill={PALETTE.emerald}>
        {data.totalLabel.toUpperCase()}
      </text>
      <text x="206" y="160" fontFamily="system-ui" fontWeight="800" fontSize="28" fill={PALETTE.ink}>
        {data.totalValue}
      </text>
      <text x="312" y="160" fontFamily="system-ui" fontSize="13" fill={PALETTE.slate}>
        {data.totalUnit}
      </text>
      <text x="206" y="176" fontFamily="system-ui" fontSize="11" fill={PALETTE.slate}>
        Vérifié OTI ready · audit trail SHA-256
      </text>

      {/* Hotspot */}
      <rect x="426" y="100" width="276" height="84" rx="10" fill={PALETTE.paper} stroke={PALETTE.border} strokeWidth="1" />
      <text x="442" y="124" fontFamily="system-ui" fontSize="11" fontWeight="600" fill={PALETTE.subtle}>
        POSTE PRINCIPAL
      </text>
      <text x="442" y="148" fontFamily="system-ui" fontWeight="700" fontSize="14" fill={PALETTE.ink}>
        {data.hotspot.label}
      </text>
      <rect x="442" y="158" width="168" height="14" rx="7" fill={PALETTE.border} />
      <rect x="442" y="158" width={168 * (parseFloat(data.hotspot.share) / 100)} height="14" rx="7" fill={data.hotspot.color} />
      <text x="618" y="170" fontFamily="system-ui" fontWeight="700" fontSize="12" fill={data.hotspot.color}>
        {data.hotspot.share}
      </text>

      {/* Répartition Scope (donut) */}
      <ScopeDonut cx={250} cy={264} r={48} s1={data.scope1} s2={data.scope2} s3={data.scope3} />
      <text x="190" y="216" fontFamily="system-ui" fontWeight="700" fontSize="13" fill={PALETTE.ink}>
        Répartition Scope
      </text>
      <g fontFamily="system-ui" fontSize="11" fill={PALETTE.slate}>
        <circle cx="320" cy="244" r="5" fill={PALETTE.emerald} />
        <text x="332" y="248">S1 — {data.scope1}%</text>
        <circle cx="320" cy="266" r="5" fill={PALETTE.cyan} />
        <text x="332" y="270">S2 — {data.scope2}%</text>
        <circle cx="320" cy="288" r="5" fill={PALETTE.violet} />
        <text x="332" y="292">S3 — {data.scope3}%</text>
      </g>

      {/* Postes principaux */}
      <text x="426" y="216" fontFamily="system-ui" fontWeight="700" fontSize="13" fill={PALETTE.ink}>
        Top postes d&apos;émission
      </text>
      {data.postes.map((p, i) => {
        const py = 232 + i * 38;
        return (
          <g key={p.label}>
            <text x="426" y={py + 12} fontFamily="system-ui" fontSize="12" fontWeight="600" fill={PALETTE.ink}>
              {p.label}
            </text>
            <text x="694" y={py + 12} textAnchor="end" fontFamily="ui-monospace, monospace" fontSize="11" fill={PALETTE.slate}>
              {p.value}
            </text>
            <rect x="426" y={py + 18} width="268" height="6" rx="3" fill={PALETTE.border} />
            <rect x="426" y={py + 18} width={268 * (p.share / 100)} height="6" rx="3" fill={p.color} />
          </g>
        );
      })}

      {/* Statut audit */}
      <rect x="190" y="402" width="512" height="40" rx="8" fill="#F0FDF4" stroke={PALETTE.emeraldLight} strokeWidth="1" />
      <circle cx="208" cy="422" r="6" fill={PALETTE.emerald} />
      <text x="222" y="426" fontFamily="system-ui" fontSize="12" fontWeight="700" fill={PALETTE.emerald}>
        Statut OTI : prêt
      </text>
      <text x="320" y="426" fontFamily="system-ui" fontSize="11" fill={PALETTE.slate}>
        100 % des datapoints tracés · 0 alerte critique · export PDF disponible
      </text>
    </svg>
  );
}

/* Donut helpers (stroke-dasharray sur cercle) */
function ScopeDonut({ cx, cy, r, s1, s2, s3 }: { cx: number; cy: number; r: number; s1: number; s2: number; s3: number }) {
  const C = 2 * Math.PI * r;
  const seg = (pct: number) => (pct / 100) * C;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={PALETTE.border} strokeWidth="14" />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={PALETTE.emerald}
        strokeWidth="14"
        strokeDasharray={`${seg(s1)} ${C - seg(s1)}`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={PALETTE.cyan}
        strokeWidth="14"
        strokeDasharray={`${seg(s2)} ${C - seg(s2)}`}
        transform={`rotate(${-90 + (s1 / 100) * 360} ${cx} ${cy})`}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={PALETTE.violet}
        strokeWidth="14"
        strokeDasharray={`${seg(s3)} ${C - seg(s3)}`}
        transform={`rotate(${-90 + ((s1 + s2) / 100) * 360} ${cx} ${cy})`}
      />
    </g>
  );
}

interface SectorShowcaseProps {
  className?: string;
}

export function SectorShowcase({ className = "" }: SectorShowcaseProps) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${className}`}>
      {(Object.keys(SECTORS) as SectorId[]).map((s) => (
        <article
          key={s}
          className="rounded-2xl bg-white border border-neutral-200 shadow-sm p-5 hover:shadow-lg transition-shadow"
        >
          <header className="mb-4">
            <p className="text-xs font-bold text-green-600 uppercase tracking-widest">
              Cas sectoriel
            </p>
            <h3 className="font-extrabold text-xl text-neutral-900 mt-1">{SECTORS[s].title}</h3>
            <p className="text-xs text-neutral-500 mt-0.5">{SECTORS[s].tagline}</p>
          </header>
          <SectorMockup sector={s} />
          <p className="mt-4 text-xs text-neutral-500 leading-relaxed">
            Données illustratives. Le dashboard se reconfigure automatiquement selon votre secteur et vos sources d&apos;activité.
          </p>
        </article>
      ))}
    </div>
  );
}
