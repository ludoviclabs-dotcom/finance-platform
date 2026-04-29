/**
 * Trust badges — 8 visuels de conformité (SVG inline, sobres, vectoriels).
 *
 * Statuts :
 *   - verified : conformité native (RGPD, hébergement EU, audit trail SHA-256, AES-256, CSRD)
 *   - in-progress : certification en cours d'évaluation (SOC 2, ISO 27001, DORA)
 *
 * Chaque badge est autonome (titre, statut, mini-icône). Affichage en grille
 * responsive 2 → 4 → 8 colonnes selon la largeur.
 */

type BadgeStatus = "verified" | "in-progress";

interface BadgeDef {
  id: string;
  title: string;
  short: string;
  status: BadgeStatus;
  icon: React.ReactNode;
}

const ICON_PROPS = {
  width: 28,
  height: 28,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const Lock = (
  <svg {...ICON_PROPS} aria-hidden>
    <rect x="4" y="11" width="16" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
const ShieldCheck = (
  <svg {...ICON_PROPS} aria-hidden>
    <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
const Globe = (
  <svg {...ICON_PROPS} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
);
const FileCheck = (
  <svg {...ICON_PROPS} aria-hidden>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5M9 14l2 2 4-4" />
  </svg>
);
const Hash = (
  <svg {...ICON_PROPS} aria-hidden>
    <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
  </svg>
);
const KeyRound = (
  <svg {...ICON_PROPS} aria-hidden>
    <circle cx="8" cy="15" r="4" />
    <path d="m11 12 9-9 3 3-3 3 2 2-2 2-2-2-3 3" />
  </svg>
);
const Building = (
  <svg {...ICON_PROPS} aria-hidden>
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M11 21v-3h2v3" />
  </svg>
);
const Award = (
  <svg {...ICON_PROPS} aria-hidden>
    <circle cx="12" cy="9" r="6" />
    <path d="m9 14-2 7 5-3 5 3-2-7" />
  </svg>
);

export const TRUST_BADGES: readonly BadgeDef[] = [
  { id: "rgpd",        title: "RGPD",                 short: "Conforme",        status: "verified",    icon: ShieldCheck },
  { id: "eu",          title: "Hébergement EU",       short: "Vercel · Neon",   status: "verified",    icon: Globe },
  { id: "aes256",      title: "AES-256 + TLS 1.3",    short: "Chiffrement",     status: "verified",    icon: KeyRound },
  { id: "audit",       title: "Audit Trail",          short: "Append-only",     status: "verified",    icon: FileCheck },
  { id: "sha256",      title: "Signature SHA-256",    short: "Hash de chaîne",  status: "verified",    icon: Hash },
  { id: "csrd",        title: "CSRD-Ready",           short: "ESRS E1 prio.",   status: "verified",    icon: Award },
  { id: "soc2",        title: "SOC 2 Type II",        short: "En évaluation",   status: "in-progress", icon: Lock },
  { id: "iso27001",    title: "ISO 27001",            short: "En évaluation",   status: "in-progress", icon: Building },
] as const;

interface TrustBadgesProps {
  className?: string;
}

export function TrustBadges({ className = "" }: TrustBadgesProps) {
  return (
    <ul
      role="list"
      aria-label="Badges de conformité et de sécurité"
      className={`grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 ${className}`}
    >
      {TRUST_BADGES.map((badge) => {
        const isVerified = badge.status === "verified";
        return (
          <li
            key={badge.id}
            className="group relative flex flex-col items-center text-center px-3 py-4 rounded-xl bg-white border border-neutral-200 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
          >
            <span
              aria-hidden
              className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${
                isVerified ? "bg-green-500" : "bg-amber-500"
              }`}
              title={isVerified ? "Conforme" : "Certification en cours"}
            />
            <div
              className={`flex items-center justify-center w-12 h-12 rounded-full mb-2 ${
                isVerified
                  ? "bg-green-50 text-green-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {badge.icon}
            </div>
            <span className="font-bold text-[13px] text-neutral-900 leading-tight">
              {badge.title}
            </span>
            <span className="mt-0.5 text-[11px] text-neutral-500 leading-tight">
              {badge.short}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
