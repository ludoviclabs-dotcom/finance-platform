"use client";

import { CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";

/**
 * Schéma d'architecture sécurité — pipeline traçabilité interactif.
 *
 * Le composant reste volontairement sobre : il conserve le schéma en cinq étapes
 * existant, mais expose les preuves conservées à chaque passage pour rendre le
 * flux auditable plus tangible sans ajouter de promesses non opposables.
 */

interface SecurityArchitectureProps {
  className?: string;
}

const SAMPLE_RECEIPT = {
  datapoint: "Scope 1 · Gaz naturel · fact_id CC.GES.SCOPE1",
  source: "source.xlsx · onglet Energie · cellule B42",
  method: "GHG Protocol · facteur ADEME versionné",
  hash: "8f3a2c91…91c4",
  validator: "validé par analyste",
};

const STAGES = [
  {
    id: "ingest",
    label: "Saisie",
    sub: "Excel · API · UI",
    status: "capturé",
    color: "#0EA5E9",
    description: "Fichier, onglet, cellule et auteur conservés.",
    dataKept: "source, cellule, auteur, timestamp",
    control: "format attendu + rattachement fact_id",
    evidence: "fact_id CC.GES.SCOPE1",
    auditorView: "trace de la donnée jusqu'au fichier d'origine",
  },
  {
    id: "transit",
    label: "Transit",
    sub: "TLS 1.3",
    status: "chiffré",
    color: "#0891B2",
    description: "Transport TLS 1.3, payload non exposé en clair.",
    dataKept: "événement de réception + horodatage",
    control: "canal chiffré en transit",
    evidence: "journal d'ingest horodaté",
    auditorView: "preuve que la donnée n'a pas été ressaisie hors flux",
  },
  {
    id: "storage",
    label: "Stockage UE",
    sub: "AES-256 · Neon EU",
    status: "stocké UE",
    color: "#059669",
    description: "Données stockées sur infrastructure EU, AES-256 au repos.",
    dataKept: "valeur normalisée, unité, source primaire",
    control: "stockage PostgreSQL EU + chiffrement au repos",
    evidence: "ligne source reliée au KPI",
    auditorView: "accès à la donnée normalisée et à sa source",
  },
  {
    id: "audit",
    label: "Audit Trail",
    sub: "Append-only · SHA-256",
    status: "journalisé",
    color: "#14532D",
    description: "Écriture append-only avec hash SHA-256 chaîné.",
    dataKept: "avant/après, utilisateur, méthode, hash précédent",
    control: "chaînage SHA-256 détectant toute altération",
    evidence: "hash 8f3a2c91…91c4",
    auditorView: "vérification ligne par ligne du trail",
  },
  {
    id: "export",
    label: "Export auditeur",
    sub: "PDF signé · OTI ready",
    status: "vérifiable",
    color: "#7C3AED",
    description: "PDF, Excel, Evidence Pack ZIP et manifeste vérifiable.",
    dataKept: "rapport figé, manifeste, hash global",
    control: "package signé + vérification publique",
    evidence: "/verify/{hash}",
    auditorView: "contrôle sans compte via hash public",
  },
] as const;

type StageIndex = 0 | 1 | 2 | 3 | 4;

export function SecurityArchitecture({ className = "" }: SecurityArchitectureProps) {
  const [hoveredIndex, setHoveredIndex] = useState<StageIndex | null>(null);
  const [lockedIndex, setLockedIndex] = useState<StageIndex | null>(null);

  const activeIndex = lockedIndex ?? hoveredIndex ?? 0;
  const activeStage = STAGES[activeIndex];

  const activeLineWidth = useMemo(() => 220 * activeIndex, [activeIndex]);

  const setPreview = (index: number | null) => {
    setHoveredIndex(index === null ? null : (index as StageIndex));
  };

  const lockStage = (index: number) => {
    setLockedIndex((current) => (current === index ? null : (index as StageIndex)));
  };

  return (
    <div className={`w-full ${className}`} data-testid="security-architecture">
      <div className="hidden md:block" data-testid="pipeline-desktop">
        <svg
          viewBox="0 0 1080 220"
          role="img"
          aria-labelledby="sec-archi-title sec-archi-desc"
          className="w-full h-auto block"
          preserveAspectRatio="xMidYMid meet"
        >
          <title id="sec-archi-title">Architecture de sécurité CarbonCo</title>
          <desc id="sec-archi-desc">
            Pipeline en cinq étapes : saisie des données, transit chiffré TLS 1.3,
            stockage en Europe avec chiffrement AES-256, audit trail append-only
            signé SHA-256, et export auditeur avec manifeste vérifiable.
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

          <style>
            {`
              .pipeline-stage {
                cursor: pointer;
                outline: none;
              }

              .pipeline-stage-ring,
              .pipeline-stage-dot,
              .pipeline-stage-label,
              .pipeline-stage-check,
              .pipeline-active-line {
                transition: opacity 220ms ease, stroke-width 220ms ease, transform 220ms ease, fill 220ms ease;
              }

              .pipeline-stage:focus-visible .pipeline-stage-ring {
                stroke-width: 4;
              }

              .pipeline-draw-line {
                stroke-dasharray: 880;
                stroke-dashoffset: 880;
                animation: pipeline-draw 900ms ease-out 120ms forwards;
              }

              .pipeline-flow-dot {
                animation: pipeline-flow 2800ms ease-in-out 900ms 1 both;
              }

              @keyframes pipeline-draw {
                to { stroke-dashoffset: 0; }
              }

              @keyframes pipeline-flow {
                0% { transform: translateX(0); opacity: 0; }
                10% { opacity: 0.9; }
                90% { opacity: 0.9; }
                100% { transform: translateX(880px); opacity: 0; }
              }

              @media (prefers-reduced-motion: reduce) {
                .pipeline-stage-ring,
                .pipeline-stage-dot,
                .pipeline-stage-label,
                .pipeline-stage-check,
                .pipeline-active-line {
                  transition: opacity 120ms ease;
                }

                .pipeline-draw-line,
                .pipeline-flow-dot {
                  animation: none;
                  stroke-dashoffset: 0;
                  opacity: 0;
                }
              }
            `}
          </style>

          <rect x="0" y="0" width="1080" height="220" rx="16" fill="url(#sec-bg)" />

          <line
            x1="100"
            x2="980"
            y1="110"
            y2="110"
            stroke="url(#sec-line)"
            strokeWidth="3"
            strokeLinecap="round"
            className="pipeline-draw-line"
          />

          {activeIndex > 0 && (
            <line
              x1="100"
              x2={100 + activeLineWidth}
              y1="110"
              y2="110"
              stroke={activeStage.color}
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.22"
              className="pipeline-active-line"
            />
          )}

          <circle
            cx="100"
            cy="110"
            r="4"
            fill="#0F172A"
            opacity="0"
            className="pipeline-flow-dot"
          />

          {STAGES.map((stage, i) => {
            const cx = 100 + i * 220;
            const isActive = i === activeIndex;
            const isPassed = i <= activeIndex;

            return (
              <g
                key={stage.id}
                className="pipeline-stage"
                tabIndex={0}
                role="button"
                aria-label={`${stage.label} : ${stage.description}`}
                aria-pressed={isActive}
                onMouseEnter={() => setPreview(i)}
                onMouseLeave={() => setPreview(null)}
                onFocus={() => setPreview(i)}
                onBlur={() => setPreview(null)}
                onClick={() => lockStage(i)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    lockStage(i);
                  }
                }}
              >
                <circle
                  cx={cx}
                  cy={110}
                  r={isActive ? 52 : 48}
                  fill={stage.color}
                  opacity={isActive ? "0.08" : "0"}
                  className="pipeline-stage-ring"
                />
                <circle
                  cx={cx}
                  cy={110}
                  r="44"
                  fill="#FFFFFF"
                  stroke={stage.color}
                  strokeWidth={isActive ? "3" : "2"}
                  className="pipeline-stage-ring"
                />
                <circle
                  cx={cx}
                  cy={110}
                  r={isActive ? "12" : "10"}
                  fill={stage.color}
                  className="pipeline-stage-dot"
                />
                <text
                  x={cx}
                  y={70}
                  textAnchor="middle"
                  fontSize={isActive ? "16" : "15"}
                  fontWeight={isActive ? "800" : "700"}
                  fill="#0F172A"
                  fontFamily="system-ui, sans-serif"
                  className="pipeline-stage-label"
                >
                  {stage.label}
                </text>
                <text
                  x={cx}
                  y={170}
                  textAnchor="middle"
                  fontSize="12"
                  fill={isActive ? "#334155" : "#475569"}
                  fontFamily="system-ui, sans-serif"
                >
                  {stage.sub}
                </text>
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
                {isPassed && (
                  <g className="pipeline-stage-check" opacity={isActive ? "1" : "0.72"}>
                    <circle cx={cx + 31} cy={82} r="8" fill="#FFFFFF" stroke={stage.color} strokeWidth="1.5" />
                    <path
                      d={`M${cx + 27.5} 82 L${cx + 30.2} 84.7 L${cx + 35.2} 78.8`}
                      fill="none"
                      stroke={stage.color}
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                )}
              </g>
            );
          })}

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
      </div>

      <div
        className="md:hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-white px-4 py-5"
        data-testid="pipeline-mobile"
      >
        <div className="relative space-y-3">
          <div className="absolute left-[21px] top-8 bottom-8 w-px bg-gradient-to-b from-sky-300 via-emerald-500 to-violet-500" />
          {STAGES.map((stage, i) => (
            <details key={stage.id} className="relative z-10 group" open={i === 0}>
              <summary className="grid w-full cursor-pointer list-none grid-cols-[44px_1fr] gap-3 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white [&::-webkit-details-marker]:hidden">
                <span
                  className="mt-1 flex h-11 w-11 items-center justify-center rounded-full border bg-white text-xs font-bold"
                  style={{ borderColor: stage.color, color: stage.color }}
                >
                  {i + 1}
                </span>
                <span className="flex items-center justify-between gap-3 pb-3">
                  <span>
                    <span className="block text-sm font-bold text-slate-950">{stage.label}</span>
                    <span className="block text-xs text-slate-500">{stage.sub}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: stage.color }} aria-hidden />
                    {stage.status}
                  </span>
                </span>
              </summary>
              <div className="ml-[56px] pb-3">
                <StageProof stage={stage} compact />
              </div>
            </details>
          ))}
        </div>
      </div>

      <div className="mt-5 hidden border-t border-neutral-200 pt-5 md:block">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
              Étape sélectionnée · {activeStage.status}
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-950">{activeStage.description}</p>
          </div>
          <a
            href={activeStage.id === "export" ? "/verify" : "/trust"}
            className="text-xs font-semibold text-neutral-500 underline decoration-dotted underline-offset-4 transition-colors hover:text-neutral-950"
          >
            {activeStage.id === "export" ? "Voir /verify" : "Voir Trust Center"}
          </a>
        </div>

        <StageProof stage={activeStage} />

        <div className="mt-4 grid gap-2 text-[11px] text-neutral-500 md:grid-cols-4">
          <code className="rounded-md bg-neutral-50 px-2 py-1 font-mono text-neutral-600">
            {SAMPLE_RECEIPT.datapoint}
          </code>
          <code className="rounded-md bg-neutral-50 px-2 py-1 font-mono text-neutral-600">
            {SAMPLE_RECEIPT.source}
          </code>
          <code className="rounded-md bg-neutral-50 px-2 py-1 font-mono text-neutral-600">
            hash {SAMPLE_RECEIPT.hash}
          </code>
          <code className="rounded-md bg-neutral-50 px-2 py-1 font-mono text-neutral-600">
            {SAMPLE_RECEIPT.validator}
          </code>
        </div>
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-neutral-500">
        Chaque export inclut PDF, Excel, Evidence Pack ZIP et manifeste SHA-256 vérifiable publiquement.
      </p>
    </div>
  );
}

function StageProof({
  stage,
  compact = false,
}: {
  stage: (typeof STAGES)[number];
  compact?: boolean;
}) {
  return (
    <div
      className={`grid gap-2 ${
        compact ? "mt-3 text-[11px]" : "text-xs md:grid-cols-4"
      }`}
    >
      <ProofPill label="Donnée" value={stage.dataKept} />
      <ProofPill label="Contrôle" value={stage.control} />
      <ProofPill label="Preuve" value={stage.evidence} emphasized />
      <ProofPill label="Vue OTI" value={stage.auditorView} />
    </div>
  );
}

function ProofPill({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div className="min-w-0 border-l border-neutral-200 pl-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{label}</p>
      <p
        className={`mt-1 leading-snug ${
          emphasized ? "font-mono text-neutral-950" : "text-neutral-600"
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
