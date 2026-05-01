/**
 * Infographies réglementaires — 6 visuels SVG inline réutilisables
 * (landing, brochure, carrousels LinkedIn).
 *
 * Chaque infographie est un composant autonome, dimensionné en viewBox
 * pour rester responsive. Aucune dépendance externe.
 */

const INK = "#0F172A";
const SLATE = "#475569";
const FOREST = "#14532D";
const EMERALD = "#059669";
const EMERALD_LIGHT = "#34D399";
const CYAN = "#0891B2";
const VIOLET = "#7C3AED";
const AMBER = "#D97706";
const MIST = "#ECFDF5";
const PAPER = "#FFFFFF";

interface InfoProps {
  className?: string;
}

/* 1. Scope 1 / 2 / 3 — vue d'ensemble */
export function ScopesInfographic({ className = "" }: InfoProps) {
  return (
    <svg
      viewBox="0 0 800 360"
      role="img"
      aria-labelledby="ig-scopes-title"
      className={`w-full h-auto ${className}`}
    >
      <title id="ig-scopes-title">Scope 1, 2 et 3 — vue d&apos;ensemble</title>
      <rect width="800" height="360" rx="16" fill={PAPER} />
      <text x="400" y="36" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="20" fill={INK}>
        Scope 1 · 2 · 3 — en un coup d&apos;œil
      </text>

      {/* SCOPE 1 */}
      <g>
        <rect x="40" y="64" width="240" height="260" rx="12" fill={MIST} stroke={EMERALD} strokeWidth="2" />
        <circle cx="160" cy="118" r="34" fill={PAPER} stroke={EMERALD} strokeWidth="3" />
        <text x="160" y="124" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="22" fill={EMERALD}>S1</text>
        <text x="160" y="180" textAnchor="middle" fontFamily="system-ui" fontWeight="700" fontSize="14" fill={INK}>Émissions directes</text>
        <text x="160" y="206" textAnchor="middle" fontFamily="system-ui" fontSize="11" fill={SLATE}>Combustion sur site</text>
        <text x="160" y="222" textAnchor="middle" fontFamily="system-ui" fontSize="11" fill={SLATE}>Flotte & véhicules</text>
        <text x="160" y="238" textAnchor="middle" fontFamily="system-ui" fontSize="11" fill={SLATE}>Fluides frigorigènes</text>
        <text x="160" y="254" textAnchor="middle" fontFamily="system-ui" fontSize="11" fill={SLATE}>Procédés industriels</text>
        <text x="160" y="290" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="13" fill={EMERALD}>Direct · sur site</text>
      </g>

      {/* SCOPE 2 */}
      <g>
        <rect x="280" y="64" width="240" height="260" rx="12" fill="#ECFEFF" stroke={CYAN} strokeWidth="2" />
        <circle cx="400" cy="118" r="34" fill={PAPER} stroke={CYAN} strokeWidth="3" />
        <text x="400" y="124" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="22" fill={CYAN}>S2</text>
        <text x="400" y="180" textAnchor="middle" fontFamily="system-ui" fontWeight="700" fontSize="14" fill={INK}>Énergie achetée</text>
        <text x="400" y="206" textAnchor="middle" fontFamily="system-ui" fontSize="11" fill={SLATE}>Électricité</text>
        <text x="400" y="222" textAnchor="middle" fontFamily="system-ui" fontSize="11" fill={SLATE}>Vapeur</text>
        <text x="400" y="238" textAnchor="middle" fontFamily="system-ui" fontSize="11" fill={SLATE}>Chaleur · froid</text>
        <text x="400" y="254" textAnchor="middle" fontFamily="system-ui" fontSize="11" fill={SLATE}>Réseau</text>
        <text x="400" y="290" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="13" fill={CYAN}>Indirect · énergie</text>
      </g>

      {/* SCOPE 3 */}
      <g>
        <rect x="520" y="64" width="240" height="260" rx="12" fill="#F5F3FF" stroke={VIOLET} strokeWidth="2" />
        <circle cx="640" cy="118" r="34" fill={PAPER} stroke={VIOLET} strokeWidth="3" />
        <text x="640" y="124" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="22" fill={VIOLET}>S3</text>
        <text x="640" y="180" textAnchor="middle" fontFamily="system-ui" fontWeight="700" fontSize="14" fill={INK}>Chaîne de valeur</text>
        <text x="640" y="206" textAnchor="middle" fontFamily="system-ui" fontSize="11" fill={SLATE}>Achats · capital</text>
        <text x="640" y="222" textAnchor="middle" fontFamily="system-ui" fontSize="11" fill={SLATE}>Transport · logistique</text>
        <text x="640" y="238" textAnchor="middle" fontFamily="system-ui" fontSize="11" fill={SLATE}>Usage des produits</text>
        <text x="640" y="254" textAnchor="middle" fontFamily="system-ui" fontSize="11" fill={SLATE}>Fin de vie · déchets</text>
        <text x="640" y="290" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="13" fill={VIOLET}>Indirect · amont/aval</text>
      </g>
    </svg>
  );
}

/* 2. Calendrier CSRD — qui, quand, quoi */
export function CsrdCalendarInfographic({ className = "" }: InfoProps) {
  const milestones = [
    { year: "2024", label: "Wave 1", who: "Grandes entités d'intérêt public > 500 salariés", color: EMERALD },
    { year: "2025", label: "Wave 2", who: "Grandes entreprises (≥ 250 salariés ou critères taille)", color: CYAN },
    { year: "2026", label: "Wave 3", who: "PME cotées (option report 2 ans)", color: VIOLET },
    { year: "2028", label: "Wave 4", who: "Filiales et sociétés extra-UE (€150 M CA UE)", color: AMBER },
  ];
  return (
    <svg
      viewBox="0 0 800 320"
      role="img"
      aria-labelledby="ig-csrd-title"
      className={`w-full h-auto ${className}`}
    >
      <title id="ig-csrd-title">Calendrier CSRD — qui, quand, quoi</title>
      <rect width="800" height="320" rx="16" fill={PAPER} />
      <text x="400" y="36" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="20" fill={INK}>
        Calendrier CSRD — qui doit publier, et quand
      </text>
      <line x1="80" y1="180" x2="720" y2="180" stroke={SLATE} strokeWidth="2" />
      {milestones.map((m, i) => {
        const cx = 110 + i * 200;
        return (
          <g key={m.year}>
            <line x1={cx} y1="180" x2={cx} y2={i % 2 === 0 ? 130 : 230} stroke={m.color} strokeWidth="2" strokeDasharray="3 3" />
            <circle cx={cx} cy="180" r="9" fill={m.color} />
            <circle cx={cx} cy="180" r="4" fill={PAPER} />
            <rect x={cx - 80} y={i % 2 === 0 ? 64 : 234} width="160" height="66" rx="8" fill={PAPER} stroke={m.color} strokeWidth="1.5" />
            <text x={cx} y={i % 2 === 0 ? 86 : 256} textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="16" fill={m.color}>
              {m.year} · {m.label}
            </text>
            <foreignObject x={cx - 76} y={i % 2 === 0 ? 92 : 262} width="152" height="36">
              <div style={{ fontFamily: "system-ui", fontSize: "10.5px", color: INK, lineHeight: 1.25, textAlign: "center" }}>
                {m.who}
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}

/* 3. Audit trail SHA-256 — fonctionnement */
export function AuditTrailInfographic({ className = "" }: InfoProps) {
  return (
    <svg
      viewBox="0 0 800 280"
      role="img"
      aria-labelledby="ig-audit-title"
      className={`w-full h-auto ${className}`}
    >
      <title id="ig-audit-title">Comment fonctionne l&apos;audit trail signé SHA-256</title>
      <rect width="800" height="280" rx="16" fill={PAPER} />
      <text x="400" y="36" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="20" fill={INK}>
        Audit trail signé SHA-256
      </text>

      {[
        { x: 60, label: "Entrée", sub: "Donnée + méta", color: CYAN },
        { x: 240, label: "Hash N", sub: "SHA-256(data)", color: EMERALD },
        { x: 420, label: "Hash N+1", sub: "SHA-256(N + data)", color: EMERALD },
        { x: 600, label: "Hash N+2", sub: "SHA-256(N+1 + data)", color: FOREST },
      ].map((s, i) => (
        <g key={s.x}>
          <rect x={s.x} y="100" width="140" height="80" rx="10" fill={PAPER} stroke={s.color} strokeWidth="2" />
          <text x={s.x + 70} y="130" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="14" fill={s.color}>
            {s.label}
          </text>
          <text x={s.x + 70} y="156" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="11" fill={SLATE}>
            {s.sub}
          </text>
          {i < 3 && (
            <path
              d={`M${s.x + 142} 140 L${s.x + 178} 140`}
              stroke={SLATE}
              strokeWidth="2"
              markerEnd="url(#audit-arrow)"
            />
          )}
        </g>
      ))}

      <defs>
        <marker id="audit-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill={SLATE} />
        </marker>
      </defs>

      <text x="400" y="234" textAnchor="middle" fontFamily="system-ui" fontSize="13" fill={SLATE}>
        Modifier une ligne casse la chaîne — l&apos;OTI détecte la rupture.
      </text>
      <text x="400" y="254" textAnchor="middle" fontFamily="system-ui" fontWeight="700" fontSize="13" fill={EMERALD}>
        Append-only · Immuable · Vérifiable hors ligne
      </text>
    </svg>
  );
}

/* 4. ESRS heatmap maturité */
export function EsrsHeatmapInfographic({ className = "" }: InfoProps) {
  const rows = [
    { code: "ESRS E1", label: "Climat",                 status: "live" },
    { code: "ESRS E2", label: "Pollution",              status: "beta" },
    { code: "ESRS E3", label: "Eau · ressources marines", status: "beta" },
    { code: "ESRS E4", label: "Biodiversité",           status: "beta" },
    { code: "ESRS E5", label: "Économie circulaire",    status: "planned" },
    { code: "ESRS S1", label: "Effectif propre",        status: "live" },
    { code: "ESRS S2", label: "Chaîne de valeur",       status: "beta" },
    { code: "ESRS S3", label: "Communautés affectées",  status: "planned" },
    { code: "ESRS S4", label: "Consommateurs",          status: "planned" },
    { code: "ESRS G1", label: "Conduite des affaires",  status: "beta" },
  ];
  const colorFor = (s: string) => (s === "live" ? EMERALD : s === "beta" ? AMBER : "#94A3B8");
  const labelFor = (s: string) => (s === "live" ? "Live" : s === "beta" ? "Beta" : "Planned");

  return (
    <svg
      viewBox="0 0 800 460"
      role="img"
      aria-labelledby="ig-esrs-title"
      className={`w-full h-auto ${className}`}
    >
      <title id="ig-esrs-title">Couverture ESRS — heatmap de maturité</title>
      <rect width="800" height="460" rx="16" fill={PAPER} />
      <text x="400" y="36" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="20" fill={INK}>
        Couverture ESRS — heatmap de maturité
      </text>
      {rows.map((r, i) => (
        <g key={r.code}>
          <rect x="60" y={68 + i * 36} width="680" height="28" rx="6" fill={MIST} />
          <text x="80" y={87 + i * 36} fontFamily="ui-monospace, monospace" fontSize="13" fontWeight="700" fill={INK}>
            {r.code}
          </text>
          <text x="180" y={87 + i * 36} fontFamily="system-ui" fontSize="13" fill={INK}>
            {r.label}
          </text>
          <rect x="600" y={72 + i * 36} width="120" height="20" rx="10" fill={colorFor(r.status)} opacity="0.15" />
          <circle cx="616" cy={82 + i * 36} r="5" fill={colorFor(r.status)} />
          <text x="630" y={87 + i * 36} fontFamily="system-ui" fontWeight="700" fontSize="12" fill={colorFor(r.status)}>
            {labelFor(r.status)}
          </text>
        </g>
      ))}
      <text x="400" y="446" textAnchor="middle" fontFamily="system-ui" fontSize="11" fill={SLATE}>
        ESRS E1 prioritaire (climat) · les autres standards en déploiement progressif.
      </text>
    </svg>
  );
}

/* 5. Workflow OTI — ce que l'auditeur veut voir */
export function OtiWorkflowInfographic({ className = "" }: InfoProps) {
  const steps = [
    { label: "1. Périmètre",  sub: "Scopes & sites" },
    { label: "2. Données",    sub: "Provenance + hash" },
    { label: "3. Méthode",    sub: "Facteur d'émission" },
    { label: "4. Calcul",     sub: "Reproductible" },
    { label: "5. Rapport",    sub: "PDF signé · OTI ready" },
  ];
  return (
    <svg
      viewBox="0 0 900 240"
      role="img"
      aria-labelledby="ig-oti-title"
      className={`w-full h-auto ${className}`}
    >
      <title id="ig-oti-title">Ce que l&apos;OTI doit pouvoir retracer</title>
      <rect width="900" height="240" rx="16" fill={PAPER} />
      <text x="450" y="36" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="20" fill={INK}>
        Ce que l&apos;OTI doit pouvoir retracer
      </text>
      {steps.map((s, i) => {
        const cx = 90 + i * 180;
        return (
          <g key={s.label}>
            <rect x={cx - 70} y="80" width="140" height="80" rx="10" fill={MIST} stroke={EMERALD} strokeWidth="2" />
            <text x={cx} y="110" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="14" fill={FOREST}>
              {s.label}
            </text>
            <text x={cx} y="134" textAnchor="middle" fontFamily="system-ui" fontSize="12" fill={SLATE}>
              {s.sub}
            </text>
            {i < steps.length - 1 && (
              <path d={`M${cx + 70} 120 L${cx + 110} 120`} stroke={EMERALD} strokeWidth="2" markerEnd="url(#oti-arrow)" />
            )}
          </g>
        );
      })}
      <defs>
        <marker id="oti-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill={EMERALD} />
        </marker>
      </defs>
      <text x="450" y="200" textAnchor="middle" fontFamily="system-ui" fontSize="12" fill={SLATE}>
        Si l&apos;une de ces étapes manque, le rapport ne passe pas le contrôle d&apos;assurance.
      </text>
    </svg>
  );
}

/* 6. De l'Excel au rapport auditable */
export function ExcelToReportInfographic({ className = "" }: InfoProps) {
  return (
    <svg
      viewBox="0 0 900 280"
      role="img"
      aria-labelledby="ig-excel-title"
      className={`w-full h-auto ${className}`}
    >
      <title id="ig-excel-title">Du fichier Excel au rapport auditable</title>
      <rect width="900" height="280" rx="16" fill={PAPER} />
      <text x="450" y="36" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="20" fill={INK}>
        Du fichier Excel au rapport auditable
      </text>

      {/* AVANT : Excel chaotique */}
      <g>
        <rect x="50" y="80" width="320" height="160" rx="12" fill="#FEF2F2" stroke="#DC2626" strokeWidth="2" />
        <text x="210" y="110" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="14" fill="#DC2626">
          Avant — Excel manuel
        </text>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={70} y={130 + i * 24} width={120 + (i % 2) * 30} height="6" rx="3" fill="#DC2626" opacity="0.4" />
            <rect x={210} y={130 + i * 24} width={80 + (i % 3) * 20} height="6" rx="3" fill="#DC2626" opacity="0.25" />
          </g>
        ))}
        <text x="210" y="232" textAnchor="middle" fontFamily="system-ui" fontSize="11" fill="#DC2626">
          Pas de provenance · pas de hash · risque de rejet OTI
        </text>
      </g>

      {/* FLECHE */}
      <path d="M380 160 L460 160" stroke={EMERALD} strokeWidth="3" markerEnd="url(#xtor-arrow)" />
      <defs>
        <marker id="xtor-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill={EMERALD} />
        </marker>
      </defs>

      {/* APRES : CarbonCo */}
      <g>
        <rect x="500" y="80" width="350" height="160" rx="12" fill={MIST} stroke={EMERALD} strokeWidth="2" />
        <text x="675" y="110" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="14" fill={EMERALD}>
          Après — CarbonCo
        </text>
        {[
          "Import Excel structuré",
          "Méthode + facteur tracés",
          "Hash de chaîne SHA-256",
          "PDF signé prêt OTI",
        ].map((label, i) => (
          <g key={label}>
            <circle cx="528" cy={140 + i * 24} r="6" fill={EMERALD} />
            <path d="M524 140 L527 143 L532 137" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform={`translate(0 ${i * 24})`} />
            <text x="544" y={144 + i * 24} fontFamily="system-ui" fontSize="12" fontWeight="600" fill={INK}>
              {label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

export interface InfographicDef {
  id: string;
  title: string;
  blurb: string;
  Component: React.FC<InfoProps>;
}

export const INFOGRAPHICS: readonly InfographicDef[] = [
  { id: "scopes",    title: "Scope 1 / 2 / 3",            blurb: "Lecture rapide pour décideurs.",                     Component: ScopesInfographic },
  { id: "csrd",      title: "Calendrier CSRD",            blurb: "Qui doit publier, à partir de quand.",               Component: CsrdCalendarInfographic },
  { id: "audit",     title: "Audit trail SHA-256",        blurb: "Comment chaque ligne reste vérifiable.",             Component: AuditTrailInfographic },
  { id: "esrs",      title: "Couverture ESRS",            blurb: "Heatmap de maturité par standard.",                  Component: EsrsHeatmapInfographic },
  { id: "oti",       title: "OTI workflow",                blurb: "Ce que votre auditeur tiers veut retrouver.",        Component: OtiWorkflowInfographic },
  { id: "excel",     title: "Excel → rapport auditable",  blurb: "Avant / après : la promesse CarbonCo.",              Component: ExcelToReportInfographic },
] as const;
