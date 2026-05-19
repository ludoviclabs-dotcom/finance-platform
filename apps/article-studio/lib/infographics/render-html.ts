/**
 * Server-side HTML rendering for infographic specs.
 *
 * The export pipeline embeds these into the standalone HTML document (and
 * therefore the PDF). We stay HTML/CSS-only — no SVG arc math, no canvas
 * dependency — so the exporter never needs Chromium just to draw a chart.
 *
 * Trade-off: line and pie charts are rendered as labelled data tables
 * rather than visual plots. The information is preserved (legible numbers
 * with their labels) at the cost of the visual; the on-screen editor uses
 * chart.js for the proper visualization.
 */

import type { ChartSpec } from "./chart-spec";

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const COLORS = ["#16a34a", "#2563eb", "#db2777", "#f59e0b"];

export function renderInfographicHtml(
  spec: ChartSpec,
  citationIds: string[],
): string {
  const body = renderBody(spec);
  const sourcesLine =
    citationIds.length > 0
      ? `<p class="ig-sources">Sources : ${citationIds
          .map((id) => `<span class="ig-source">[${escape(id)}]</span>`)
          .join(" ")}</p>`
      : "";
  return `<figure class="ig ig-${spec.kind}">
    <figcaption><strong>${escape(spec.title)}</strong> <span class="ig-kind">${spec.kind}</span></figcaption>
    ${body}
    ${sourcesLine}
  </figure>`;
}

function renderBody(spec: ChartSpec): string {
  switch (spec.kind) {
    case "bar":
      return renderBar(spec);
    case "line":
    case "table":
      return renderTable(spec);
    case "pie":
      return renderPie(spec);
    case "stat":
      return renderStat(spec);
  }
}

function renderBar(
  spec: Extract<ChartSpec, { kind: "bar" }>,
): string {
  // Render as a horizontal bar chart in HTML/CSS — one row per category,
  // proportional widths against the max value across all datasets.
  const allValues = spec.datasets.flatMap((d) => d.values);
  const max = Math.max(1, ...allValues.map(Math.abs));

  const rows = spec.categories
    .map((cat, ci) => {
      const bars = spec.datasets
        .map((ds, di) => {
          const value = ds.values[ci] ?? 0;
          const widthPct = max === 0 ? 0 : (Math.abs(value) / max) * 100;
          return `<div class="ig-bar-row">
            <span class="ig-bar-label">${escape(ds.label)}</span>
            <div class="ig-bar-track">
              <div class="ig-bar-fill" style="width:${widthPct.toFixed(1)}%;background:${COLORS[di % COLORS.length]}"></div>
            </div>
            <span class="ig-bar-value">${formatNum(value)}</span>
          </div>`;
        })
        .join("");
      return `<div class="ig-bar-group">
        <div class="ig-bar-cat">${escape(cat)}</div>
        ${bars}
      </div>`;
    })
    .join("");
  return `<div class="ig-bars">${rows}</div>`;
}

function renderTable(
  spec:
    | Extract<ChartSpec, { kind: "line" }>
    | Extract<ChartSpec, { kind: "table" }>,
): string {
  let headers: string[];
  let rows: string[][];
  if (spec.kind === "table") {
    headers = spec.headers;
    rows = spec.rows;
  } else {
    headers = ["", ...spec.categories];
    rows = spec.datasets.map((d) => [d.label, ...d.values.map(formatNum)]);
  }
  const thead = `<thead><tr>${headers.map((h) => `<th>${escape(h)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map(
      (r) => `<tr>${r.map((c) => `<td>${escape(c)}</td>`).join("")}</tr>`,
    )
    .join("")}</tbody>`;
  return `<table class="ig-table">${thead}${tbody}</table>`;
}

function renderPie(spec: Extract<ChartSpec, { kind: "pie" }>): string {
  const total = spec.slices.reduce((acc, s) => acc + s.value, 0) || 1;
  const items = spec.slices
    .map((s, i) => {
      const pct = (s.value / total) * 100;
      return `<li>
        <span class="ig-pie-swatch" style="background:${COLORS[i % COLORS.length]}"></span>
        <span class="ig-pie-label">${escape(s.label)}</span>
        <span class="ig-pie-pct">${pct.toFixed(1)} %</span>
        <span class="ig-pie-value">${formatNum(s.value)}</span>
      </li>`;
    })
    .join("");
  return `<ul class="ig-pie">${items}</ul>`;
}

function renderStat(spec: Extract<ChartSpec, { kind: "stat" }>): string {
  const caption = spec.caption
    ? `<div class="ig-stat-caption">${escape(spec.caption)}</div>`
    : "";
  return `<div class="ig-stat">
    <div class="ig-stat-value">${escape(spec.value)}</div>
    ${caption}
  </div>`;
}

function formatNum(value: number | string): string {
  if (typeof value === "string") return value;
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2);
}

/** CSS for `.ig-*` selectors — inlined into the HTML export template. */
export const INFOGRAPHIC_CSS = `
.ig {
  border: 1px solid #e4e4e7;
  border-radius: 6px;
  padding: 0.875rem 1rem;
  margin: 1.25rem 0;
  font-size: 0.92rem;
}
.ig figcaption { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.6rem; }
.ig-kind { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: #71717a; }
.ig-bars { display: flex; flex-direction: column; gap: 0.75rem; }
.ig-bar-group { display: flex; flex-direction: column; gap: 0.3rem; }
.ig-bar-cat { font-weight: 600; font-size: 0.85rem; }
.ig-bar-row { display: grid; grid-template-columns: 6rem 1fr auto; gap: 0.6rem; align-items: center; }
.ig-bar-label { font-size: 0.8rem; color: #52525b; }
.ig-bar-track { background: #f4f4f5; height: 12px; border-radius: 3px; overflow: hidden; }
.ig-bar-fill { height: 100%; }
.ig-bar-value { font-variant-numeric: tabular-nums; font-size: 0.8rem; }
.ig-table { width: 100%; border-collapse: collapse; margin-top: 0.4rem; }
.ig-table th, .ig-table td { border: 1px solid #e4e4e7; padding: 0.4rem 0.6rem; text-align: left; font-size: 0.85rem; }
.ig-table th { background: #f4f4f5; }
.ig-pie { list-style: none; padding: 0; margin: 0; }
.ig-pie li { display: grid; grid-template-columns: 1.25rem 1fr auto auto; gap: 0.6rem; padding: 0.3rem 0; border-bottom: 1px dashed #e4e4e7; }
.ig-pie-swatch { width: 0.85rem; height: 0.85rem; border-radius: 2px; align-self: center; }
.ig-pie-pct, .ig-pie-value { font-variant-numeric: tabular-nums; font-size: 0.85rem; color: #52525b; }
.ig-stat-value { font-size: 2.25rem; font-weight: 700; color: #16a34a; line-height: 1; }
.ig-stat-caption { font-size: 0.85rem; color: #52525b; margin-top: 0.3rem; }
.ig-sources { margin-top: 0.5rem; font-size: 0.75rem; color: #71717a; }
.ig-source { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #2563eb; margin-right: 0.25rem; }
`;
