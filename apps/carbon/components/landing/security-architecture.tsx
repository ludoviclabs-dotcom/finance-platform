/**
 * Schéma d'architecture sécurité — SVG inline, vectoriel, responsive.
 *
 * Pipeline représenté :
 *   Saisie → Chiffrement TLS 1.3 (transit) → Datacenter EU (AES-256 au repos)
 *          → Audit trail append-only (signé SHA-256) → Export auditeur
 *
 * Pensé pour la section "Sécurité et conformité" de la landing : le but est de
 * matérialiser visuellement la chaîne de protection que nos clients OTI doivent
 * pouvoir tracer.
 */

interface SecurityArchitectureProps {
  className?: string;
}

const STAGES = [
  {
    id: "ingest",
    label: "Saisie",
    sub: "Excel · API · UI",
    color: "#0EA5E9",
  },
  {
    id: "transit",
    label: "Transit",
    sub: "TLS 1.3",
    color: "#0891B2",
  },
  {
    id: "storage",
    label: "Stockage UE",
    sub: "AES-256 · Neon EU",
    color: "#059669",
  },
  {
    id: "audit",
    label: "Audit Trail",
    sub: "Append-only · SHA-256",
    color: "#14532D",
  },
  {
    id: "export",
    label: "Export auditeur",
    sub: "PDF signé · OTI ready",
    color: "#7C3AED",
  },
] as const;

export function SecurityArchitecture({ className = "" }: SecurityArchitectureProps) {
  return (
    <div className={`w-full ${className}`}>
      <svg
        viewBox="0 0 1080 220"
        role="img"
        aria-labelledby="sec-archi-title sec-archi-desc"
        className="w-full h-auto block"
        preserveAspectRatio="xMidYMid meet"
      >
        <title id="sec-archi-title">
          Architecture de sécurité CarbonCo
        </title>
        <desc id="sec-archi-desc">
          Pipeline en cinq étapes : saisie des données, transit chiffré TLS 1.3,
          stockage en Europe avec chiffrement AES-256, audit trail append-only
          signé SHA-256, et export auditeur prêt pour OTI.
        </desc>

        <defs>
          <linearGradient id="sec-bg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#F0FDF4" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>
          <linearGradient id="sec-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#0EA5E9" />
            <stop offset="50%" stopColor="#059669" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="#475569" />
          </marker>
        </defs>

        <rect x="0" y="0" width="1080" height="220" rx="16" fill="url(#sec-bg)" />

        {/* Connecteur principal en gradient */}
        <line
          x1="100"
          x2="980"
          y1="110"
          y2="110"
          stroke="url(#sec-line)"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {STAGES.map((stage, i) => {
          const cx = 100 + i * 220;
          return (
            <g key={stage.id}>
              {/* halo */}
              <circle cx={cx} cy={110} r="44" fill="#FFFFFF" stroke={stage.color} strokeWidth="2" />
              {/* point */}
              <circle cx={cx} cy={110} r="10" fill={stage.color} />
              {/* étiquette */}
              <text
                x={cx}
                y={70}
                textAnchor="middle"
                fontSize="15"
                fontWeight="700"
                fill="#0F172A"
                fontFamily="system-ui, sans-serif"
              >
                {stage.label}
              </text>
              <text
                x={cx}
                y={170}
                textAnchor="middle"
                fontSize="12"
                fill="#475569"
                fontFamily="system-ui, sans-serif"
              >
                {stage.sub}
              </text>
              {/* numéro discret */}
              <text
                x={cx}
                y={114}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#FFFFFF"
                fontFamily="system-ui, sans-serif"
              >
                {i + 1}
              </text>
            </g>
          );
        })}

        {/* flèche d'orientation au bout */}
        <line
          x1="970"
          x2="985"
          y1="110"
          y2="110"
          stroke="#7C3AED"
          strokeWidth="3"
          markerEnd="url(#arrow)"
        />
      </svg>

      <p className="mt-3 text-center text-xs text-neutral-500 leading-relaxed">
        Chaque donnée extra-financière traverse cette chaîne et conserve sa
        provenance, sa méthode de calcul et son hash de chaîne — auditables ligne par ligne.
      </p>
    </div>
  );
}
