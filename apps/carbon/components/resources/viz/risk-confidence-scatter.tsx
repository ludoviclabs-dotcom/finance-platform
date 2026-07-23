"use client";

/**
 * RiskConfidenceScatter — nuage de points risque × confiance (Module 2).
 *
 * Un point par ressource : x = risk_score (0-100), y = confidence (0-100),
 * rayon ∝ √HHI (surface proportionnelle à la concentration réelle, jamais au
 * risque ni à la confiance — pas de double encodage). Couleur = bande de risque
 * (`riskToneHex`, mêmes seuils que partout ailleurs dans l'app).
 *
 * Volontairement PAS de zone de danger géométrique à seuil fixe dessinée sur le
 * graphique : le seuil « ≥ 66.0 » n'existe dans l'app que sous forme de texte
 * libre dans les messages d'alerte backend (`ResourceAlert.message`), jamais
 * comme constante typée exposée par l'API — le parser depuis du texte libre
 * serait fragile et pourrait dériver silencieusement si le backend change son
 * seuil. Les bandes de couleur (issues de `riskBand`, une fonction typée et
 * documentée) portent déjà cette lecture sans reposer sur un nombre non exposé.
 *
 * Un point avec risk_score OU confidence null n'est PAS placé sur le graphique
 * (aucune position 0/0 qui laisserait croire à un risque ou une confiance nuls) ;
 * il reste listé dans la vue tableau, qui accompagne TOUJOURS le graphique.
 */

import { useState } from "react";
import type { ResourceAssessmentSummary } from "@/lib/api/resources";
import { riskToneHex } from "@/lib/resources-viz";

type ScatterPoint = {
  slug: string;
  name: string;
  risk: number;
  confidence: number;
  hhi: number | null;
};

export function RiskConfidenceScatter({
  runs,
  namesBySlug,
  width = 470,
  height = 300,
  testId,
}: {
  runs: ResourceAssessmentSummary[];
  namesBySlug: Map<string, string>;
  width?: number;
  height?: number;
  testId?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const padL = 40;
  const padR = 16;
  const padT = 14;
  const padB = 34;
  const iW = width - padL - padR;
  const iH = height - padT - padB;
  const x = (v: number) => padL + (iW * v) / 100;
  const y = (v: number) => padT + iH - (iH * v) / 100;

  const points: ScatterPoint[] = runs
    .filter((r) => r.risk_score !== null && r.confidence !== null)
    .map((r) => ({
      slug: r.resource_slug,
      name: namesBySlug.get(r.resource_slug) ?? r.resource_slug,
      risk: r.risk_score as number,
      confidence: r.confidence as number,
      hhi: r.observed_hhi,
    }));

  const skipped = runs.length - points.length;

  if (runs.length === 0) return null;

  const ticks = [0, 25, 50, 75, 100];

  return (
    <div data-testid={testId}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Nuage de points risque contre confiance, taille proportionnelle à la concentration HHI"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={padT} y2={padT + iH} stroke="var(--color-border)" strokeWidth={1} />
            <line x1={padL} x2={padL + iW} y1={y(t)} y2={y(t)} stroke="var(--color-border)" strokeWidth={1} />
            <text x={x(t)} y={height - 18} textAnchor="middle" fontSize={9} fill="var(--color-foreground-subtle)">
              {t}
            </text>
            <text x={padL - 8} y={y(t) + 3} textAnchor="end" fontSize={9} fill="var(--color-foreground-subtle)">
              {t}
            </text>
          </g>
        ))}
        <text
          x={padL + iW / 2}
          y={height - 4}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-muted-foreground)"
        >
          Exposition / risque →
        </text>
        <text
          x={12}
          y={padT + iH / 2}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-muted-foreground)"
          transform={`rotate(-90 12 ${padT + iH / 2})`}
        >
          Confiance du socle ↑
        </text>

        {points.map((p) => {
          const color = riskToneHex(p.risk);
          const radius = 7 + (p.hhi !== null ? Math.sqrt(p.hhi) / 16 : 0);
          const cx = x(p.risk);
          const cy = y(p.confidence);
          const dimmed = hover !== null && hover !== p.slug;
          return (
            <g
              key={p.slug}
              onMouseEnter={() => setHover(p.slug)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
              tabIndex={0}
              role="button"
              aria-label={`${p.name} : risque ${Math.round(p.risk)}, confiance ${Math.round(p.confidence)}${p.hhi !== null ? `, HHI ${Math.round(p.hhi)}` : ""}`}
              onFocus={() => setHover(p.slug)}
              onBlur={() => setHover(null)}
            >
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={color}
                fillOpacity={dimmed ? 0.18 : 0.42}
                stroke={color}
                strokeWidth={1.6}
                style={{ transition: "fill-opacity .2s" }}
              />
              <circle cx={cx} cy={cy} r={2.4} fill={color} />
              {hover === p.slug && (
                <g>
                  <rect
                    x={Math.min(cx + 9, width - 132)}
                    y={cy - 28}
                    width={124}
                    height={36}
                    rx={7}
                    fill="var(--color-surface)"
                    stroke="var(--color-border)"
                  />
                  <text
                    x={Math.min(cx + 18, width - 123)}
                    y={cy - 13}
                    fontSize={11.5}
                    fontWeight={700}
                    fill="var(--color-foreground)"
                  >
                    {p.name}
                  </text>
                  <text
                    x={Math.min(cx + 18, width - 123)}
                    y={cy + 1}
                    fontSize={9.5}
                    fill="var(--color-muted-foreground)"
                  >
                    risque {Math.round(p.risk)} · conf {Math.round(p.confidence)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {skipped > 0 && (
        <p
          data-testid="scatter-skipped-note"
          className="mt-1 text-[10px] text-[var(--color-foreground-subtle)]"
        >
          {skipped} ressource(s) non positionnée(s) — risque ou confiance non calculé, consultez le
          tableau des assessments.
        </p>
      )}
    </div>
  );
}
