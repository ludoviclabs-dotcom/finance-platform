"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import { Bar, Line, Pie } from "react-chartjs-2";

import type { ChartSpec } from "@/lib/infographics/chart-spec";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
);

interface Props {
  spec: ChartSpec;
  sourceCitationIds: string[];
}

/**
 * Renders one detected infographic. Chart.js for bar/line/pie, HTML for
 * tables and stats. Sticks to the dark theme of the studio.
 *
 * Source palette — three brand-ish colors that read well on the dark bg.
 */
const COLORS = ["#34d399", "#60a5fa", "#f472b6", "#fbbf24"];

const CHART_OPTIONS: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: "#e4e4e7" } },
  },
  scales: {
    x: { ticks: { color: "#a1a1aa" }, grid: { color: "rgba(255,255,255,0.06)" } },
    y: { ticks: { color: "#a1a1aa" }, grid: { color: "rgba(255,255,255,0.06)" } },
  },
};

export function InfographicBlock({ spec, sourceCitationIds }: Props) {
  return (
    <figure className="my-6 rounded border border-white/10 bg-black/20 p-4">
      <figcaption className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{spec.title}</h3>
        <span className="text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
          {spec.kind}
        </span>
      </figcaption>

      <div className="min-h-[180px]">{renderSpec(spec)}</div>

      {sourceCitationIds.length > 0 && (
        <p className="mt-3 text-[11px] text-[color:var(--muted)]">
          Sources :{" "}
          {sourceCitationIds.map((id) => (
            <span key={id} className="mr-1 font-mono text-emerald-300">
              [{id}]
            </span>
          ))}
        </p>
      )}
    </figure>
  );
}

function renderSpec(spec: ChartSpec) {
  switch (spec.kind) {
    case "bar":
      return (
        <div className="h-64">
          <Bar
            options={CHART_OPTIONS as ChartOptions<"bar">}
            data={{
              labels: spec.categories,
              datasets: spec.datasets.map((d, i) => ({
                label: d.label,
                data: d.values,
                backgroundColor: COLORS[i % COLORS.length],
              })),
            }}
          />
        </div>
      );
    case "line":
      return (
        <div className="h-64">
          <Line
            options={CHART_OPTIONS as ChartOptions<"line">}
            data={{
              labels: spec.categories,
              datasets: spec.datasets.map((d, i) => ({
                label: d.label,
                data: d.values,
                borderColor: COLORS[i % COLORS.length],
                backgroundColor: COLORS[i % COLORS.length] + "33",
                tension: 0.2,
              })),
            }}
          />
        </div>
      );
    case "pie":
      return (
        <div className="mx-auto h-64 max-w-md">
          <Pie
            options={{
              ...CHART_OPTIONS,
              scales: undefined,
            } as ChartOptions<"pie">}
            data={{
              labels: spec.slices.map((s) => s.label),
              datasets: [
                {
                  data: spec.slices.map((s) => s.value),
                  backgroundColor: spec.slices.map((_, i) => COLORS[i % COLORS.length]),
                  borderColor: "transparent",
                },
              ],
            }}
          />
        </div>
      );
    case "table":
      return (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {spec.headers.map((h) => (
                <th
                  key={h}
                  className="border border-white/10 bg-white/5 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spec.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border border-white/10 px-2 py-1.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "stat":
      return (
        <div className="flex flex-col items-start gap-1 py-2">
          <span className="text-4xl font-bold tabular-nums text-emerald-300">
            {spec.value}
          </span>
          {spec.caption && (
            <span className="text-xs text-[color:var(--muted)]">{spec.caption}</span>
          )}
        </div>
      );
  }
}
