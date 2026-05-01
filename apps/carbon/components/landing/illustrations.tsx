/**
 * Illustrations custom CarbonCo — SVG vectoriels, sobres, alignés sur la palette
 * de marque (vert forêt #14532D, émeraude #059669, slate #0F172A).
 *
 * 8 pictos narratifs réutilisables sur la landing, dans la brochure et les
 * carrousels LinkedIn. Aucun asset binaire : tout est inline pour rester sous
 * le contrôle du design system.
 */

const ROOT_PROPS = {
  xmlns: "http://www.w3.org/2000/svg",
  fill: "none",
  viewBox: "0 0 200 160",
  role: "img",
  className: "w-full h-auto",
} as const;

const COLOR = {
  forest: "#14532D",
  emerald: "#059669",
  emeraldLight: "#34D399",
  mist: "#ECFDF5",
  ink: "#0F172A",
  slate: "#475569",
  cyan: "#0891B2",
  violet: "#7C3AED",
  paper: "#FFFFFF",
  sand: "#F1F5F9",
} as const;

interface IllustrationProps {
  className?: string;
  title?: string;
}

/* 1. COLLECTE — fichiers Excel et CSV pris en charge */
export function CollecteIllustration({ className = "", title }: IllustrationProps) {
  return (
    <svg {...ROOT_PROPS} className={`${ROOT_PROPS.className} ${className}`} aria-label={title ?? "Collecte de données"}>
      <rect width="200" height="160" rx="12" fill={COLOR.mist} />
      <rect x="34" y="36" width="58" height="76" rx="6" fill={COLOR.paper} stroke={COLOR.emerald} strokeWidth="2" />
      <rect x="40" y="46" width="46" height="6" rx="2" fill={COLOR.emerald} />
      <rect x="40" y="58" width="46" height="3" rx="1.5" fill={COLOR.slate} opacity="0.4" />
      <rect x="40" y="66" width="36" height="3" rx="1.5" fill={COLOR.slate} opacity="0.4" />
      <rect x="40" y="74" width="40" height="3" rx="1.5" fill={COLOR.slate} opacity="0.4" />
      <rect x="40" y="82" width="32" height="3" rx="1.5" fill={COLOR.slate} opacity="0.4" />
      <rect x="40" y="90" width="44" height="3" rx="1.5" fill={COLOR.slate} opacity="0.4" />
      <rect x="40" y="98" width="28" height="3" rx="1.5" fill={COLOR.slate} opacity="0.4" />
      <rect x="108" y="50" width="58" height="62" rx="6" fill={COLOR.paper} stroke={COLOR.cyan} strokeWidth="2" />
      <rect x="114" y="58" width="34" height="4" rx="2" fill={COLOR.cyan} />
      <rect x="114" y="68" width="46" height="2.5" rx="1.25" fill={COLOR.slate} opacity="0.35" />
      <rect x="114" y="76" width="38" height="2.5" rx="1.25" fill={COLOR.slate} opacity="0.35" />
      <rect x="114" y="84" width="42" height="2.5" rx="1.25" fill={COLOR.slate} opacity="0.35" />
      <path d="M92 76 L108 76" stroke={COLOR.forest} strokeWidth="2" strokeDasharray="3 3" />
      <circle cx="100" cy="76" r="6" fill={COLOR.emerald} />
      <path d="M97 76 L99.5 78.5 L103.5 74" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* 2. CALCUL — engrenages + calcul automatique */
export function CalculIllustration({ className = "", title }: IllustrationProps) {
  return (
    <svg {...ROOT_PROPS} className={`${ROOT_PROPS.className} ${className}`} aria-label={title ?? "Calcul automatisé"}>
      <rect width="200" height="160" rx="12" fill={COLOR.mist} />
      <circle cx="80" cy="80" r="34" fill={COLOR.paper} stroke={COLOR.emerald} strokeWidth="2.5" />
      <circle cx="80" cy="80" r="10" fill={COLOR.emerald} />
      <g stroke={COLOR.emerald} strokeWidth="2.5" strokeLinecap="round">
        <path d="M80 40 L80 50" /><path d="M80 110 L80 120" />
        <path d="M40 80 L50 80" /><path d="M110 80 L120 80" />
        <path d="M52 52 L60 60" /><path d="M100 100 L108 108" />
        <path d="M108 52 L100 60" /><path d="M60 100 L52 108" />
      </g>
      <circle cx="138" cy="58" r="20" fill={COLOR.paper} stroke={COLOR.cyan} strokeWidth="2" />
      <circle cx="138" cy="58" r="6" fill={COLOR.cyan} />
      <g stroke={COLOR.cyan} strokeWidth="2" strokeLinecap="round">
        <path d="M138 38 L138 44" /><path d="M138 72 L138 78" />
        <path d="M118 58 L124 58" /><path d="M152 58 L158 58" />
      </g>
      <text x="100" y="142" textAnchor="middle" fontFamily="system-ui" fontSize="10" fontWeight="700" fill={COLOR.ink}>
        ADEME · IPCC · DEFRA
      </text>
    </svg>
  );
}

/* 3. AUDIT — loupe sur ligne traçable */
export function AuditIllustration({ className = "", title }: IllustrationProps) {
  return (
    <svg {...ROOT_PROPS} className={`${ROOT_PROPS.className} ${className}`} aria-label={title ?? "Audit trail"}>
      <rect width="200" height="160" rx="12" fill={COLOR.mist} />
      <rect x="30" y="40" width="120" height="80" rx="8" fill={COLOR.paper} stroke={COLOR.forest} strokeWidth="2" />
      <rect x="38" y="50" width="104" height="6" rx="2" fill={COLOR.forest} />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <circle cx="44" cy={68 + i * 10} r="2.5" fill={COLOR.emerald} />
          <rect x="52" y={66 + i * 10} width="80" height="3" rx="1.5" fill={COLOR.slate} opacity="0.35" />
        </g>
      ))}
      <circle cx="138" cy="108" r="22" fill={COLOR.paper} stroke={COLOR.emerald} strokeWidth="3" />
      <line x1="153" y1="123" x2="170" y2="140" stroke={COLOR.emerald} strokeWidth="4" strokeLinecap="round" />
      <text x="138" y="112" textAnchor="middle" fontFamily="system-ui" fontSize="10" fontWeight="700" fill={COLOR.emerald}>
        SHA-256
      </text>
    </svg>
  );
}

/* 4. RAPPORT — document signé */
export function RapportIllustration({ className = "", title }: IllustrationProps) {
  return (
    <svg {...ROOT_PROPS} className={`${ROOT_PROPS.className} ${className}`} aria-label={title ?? "Rapport ESG signé"}>
      <rect width="200" height="160" rx="12" fill={COLOR.mist} />
      <path d="M58 32 L120 32 L142 54 L142 132 Q142 138 136 138 L58 138 Q52 138 52 132 L52 38 Q52 32 58 32 Z" fill={COLOR.paper} stroke={COLOR.forest} strokeWidth="2" />
      <path d="M120 32 L120 54 L142 54" fill="none" stroke={COLOR.forest} strokeWidth="2" />
      <rect x="64" y="64" width="50" height="5" rx="2" fill={COLOR.emerald} />
      <rect x="64" y="76" width="68" height="3" rx="1.5" fill={COLOR.slate} opacity="0.35" />
      <rect x="64" y="84" width="60" height="3" rx="1.5" fill={COLOR.slate} opacity="0.35" />
      <rect x="64" y="92" width="64" height="3" rx="1.5" fill={COLOR.slate} opacity="0.35" />
      <circle cx="118" cy="118" r="14" fill={COLOR.emerald} />
      <path d="M111 118 L116 123 L125 113" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* 5. SCOPE 1 — émissions directes (cheminée d'usine) */
export function Scope1Illustration({ className = "", title }: IllustrationProps) {
  return (
    <svg {...ROOT_PROPS} className={`${ROOT_PROPS.className} ${className}`} aria-label={title ?? "Scope 1 — émissions directes"}>
      <rect width="200" height="160" rx="12" fill={COLOR.mist} />
      <rect x="48" y="80" width="44" height="50" fill={COLOR.paper} stroke={COLOR.emerald} strokeWidth="2" />
      <rect x="92" y="68" width="34" height="62" fill={COLOR.paper} stroke={COLOR.emerald} strokeWidth="2" />
      <rect x="126" y="92" width="32" height="38" fill={COLOR.paper} stroke={COLOR.emerald} strokeWidth="2" />
      <rect x="100" y="50" width="10" height="22" fill={COLOR.forest} />
      <circle cx="105" cy="42" r="4" fill={COLOR.emerald} opacity="0.4" />
      <circle cx="98" cy="34" r="6" fill={COLOR.emerald} opacity="0.3" />
      <circle cx="112" cy="28" r="5" fill={COLOR.emerald} opacity="0.25" />
      <text x="100" y="148" textAnchor="middle" fontFamily="system-ui" fontSize="14" fontWeight="800" fill={COLOR.emerald}>
        SCOPE 1
      </text>
    </svg>
  );
}

/* 6. SCOPE 2 — électricité et chaleur (éclair) */
export function Scope2Illustration({ className = "", title }: IllustrationProps) {
  return (
    <svg {...ROOT_PROPS} className={`${ROOT_PROPS.className} ${className}`} aria-label={title ?? "Scope 2 — énergie achetée"}>
      <rect width="200" height="160" rx="12" fill={COLOR.mist} />
      <path d="M104 30 L78 88 L96 88 L84 130 L130 70 L110 70 L122 30 Z" fill={COLOR.cyan} stroke={COLOR.cyan} strokeWidth="2" strokeLinejoin="round" />
      <line x1="40" y1="140" x2="160" y2="140" stroke={COLOR.slate} strokeWidth="2" />
      <line x1="50" y1="138" x2="50" y2="142" stroke={COLOR.slate} strokeWidth="2" />
      <line x1="80" y1="138" x2="80" y2="142" stroke={COLOR.slate} strokeWidth="2" />
      <line x1="120" y1="138" x2="120" y2="142" stroke={COLOR.slate} strokeWidth="2" />
      <line x1="150" y1="138" x2="150" y2="142" stroke={COLOR.slate} strokeWidth="2" />
      <text x="100" y="156" textAnchor="middle" fontFamily="system-ui" fontSize="14" fontWeight="800" fill={COLOR.cyan}>
        SCOPE 2
      </text>
    </svg>
  );
}

/* 7. SCOPE 3 — chaîne de valeur (réseau) */
export function Scope3Illustration({ className = "", title }: IllustrationProps) {
  return (
    <svg {...ROOT_PROPS} className={`${ROOT_PROPS.className} ${className}`} aria-label={title ?? "Scope 3 — chaîne de valeur"}>
      <rect width="200" height="160" rx="12" fill={COLOR.mist} />
      <line x1="48" y1="80" x2="100" y2="50" stroke={COLOR.violet} strokeWidth="1.5" opacity="0.6" />
      <line x1="48" y1="80" x2="100" y2="110" stroke={COLOR.violet} strokeWidth="1.5" opacity="0.6" />
      <line x1="100" y1="50" x2="152" y2="80" stroke={COLOR.violet} strokeWidth="1.5" opacity="0.6" />
      <line x1="100" y1="110" x2="152" y2="80" stroke={COLOR.violet} strokeWidth="1.5" opacity="0.6" />
      <line x1="100" y1="50" x2="100" y2="110" stroke={COLOR.violet} strokeWidth="1.5" opacity="0.6" />
      <circle cx="48" cy="80" r="10" fill={COLOR.violet} />
      <circle cx="100" cy="50" r="10" fill={COLOR.violet} />
      <circle cx="100" cy="110" r="10" fill={COLOR.violet} />
      <circle cx="152" cy="80" r="10" fill={COLOR.violet} />
      <circle cx="100" cy="80" r="14" fill={COLOR.paper} stroke={COLOR.violet} strokeWidth="2.5" />
      <text x="100" y="84" textAnchor="middle" fontFamily="system-ui" fontSize="11" fontWeight="800" fill={COLOR.violet}>
        S3
      </text>
      <text x="100" y="148" textAnchor="middle" fontFamily="system-ui" fontSize="14" fontWeight="800" fill={COLOR.violet}>
        SCOPE 3
      </text>
    </svg>
  );
}

/* 8. OTI — examen tiers indépendant (badge à cocher) */
export function OtiIllustration({ className = "", title }: IllustrationProps) {
  return (
    <svg {...ROOT_PROPS} className={`${ROOT_PROPS.className} ${className}`} aria-label={title ?? "Examen tiers indépendant (OTI)"}>
      <rect width="200" height="160" rx="12" fill={COLOR.mist} />
      <path d="M100 26 L130 38 L130 86 Q130 108 100 134 Q70 108 70 86 L70 38 Z" fill={COLOR.paper} stroke={COLOR.forest} strokeWidth="2.5" />
      <path d="M100 26 L130 38 L130 86 Q130 108 100 134 Q70 108 70 86 L70 38 Z" fill={COLOR.emerald} opacity="0.08" />
      <path d="M88 78 L98 90 L114 70" stroke={COLOR.emerald} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <text x="100" y="148" textAnchor="middle" fontFamily="system-ui" fontSize="11" fontWeight="700" fill={COLOR.forest}>
        OTI · Vérifié
      </text>
    </svg>
  );
}

export interface IllustrationDef {
  id: string;
  title: string;
  description: string;
  Component: React.FC<IllustrationProps>;
}

export const PRODUCT_ILLUSTRATIONS: readonly IllustrationDef[] = [
  { id: "collecte", title: "Collecte simplifiée",   description: "Import Excel et connecteurs API en quelques clics.",       Component: CollecteIllustration },
  { id: "calcul",   title: "Calcul automatique",    description: "Facteurs ADEME, IPCC, DEFRA appliqués en continu.",        Component: CalculIllustration },
  { id: "audit",    title: "Audit trail intégral",  description: "Chaque chiffre justifiable, hash de chaîne SHA-256.",      Component: AuditIllustration },
  { id: "rapport",  title: "Rapport prêt OTI",      description: "Export auditeur signé, conforme ESRS et VSME.",             Component: RapportIllustration },
  { id: "scope1",   title: "Scope 1 — directes",    description: "Combustion sur site, flotte, fluides frigorigènes.",        Component: Scope1Illustration },
  { id: "scope2",   title: "Scope 2 — énergie",     description: "Électricité, vapeur, chaleur achetées.",                   Component: Scope2Illustration },
  { id: "scope3",   title: "Scope 3 — valeur",      description: "Achats, transport, usage produits, fournisseurs.",          Component: Scope3Illustration },
  { id: "oti",      title: "OTI ready",             description: "Traçabilité prête pour l'organisme tiers indépendant.",     Component: OtiIllustration },
] as const;

interface IllustrationGalleryProps {
  className?: string;
}

export function IllustrationGallery({ className = "" }: IllustrationGalleryProps) {
  return (
    <ul
      role="list"
      aria-label="Famille d'illustrations CarbonCo"
      className={`grid grid-cols-2 md:grid-cols-4 gap-5 ${className}`}
    >
      {PRODUCT_ILLUSTRATIONS.map(({ id, title, description, Component }) => (
        <li
          key={id}
          className="group rounded-2xl bg-white border border-neutral-200 shadow-sm p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
        >
          <Component title={title} className="mb-3" />
          <p className="font-bold text-sm text-neutral-900 leading-tight">{title}</p>
          <p className="mt-1 text-xs text-neutral-500 leading-snug">{description}</p>
        </li>
      ))}
    </ul>
  );
}
