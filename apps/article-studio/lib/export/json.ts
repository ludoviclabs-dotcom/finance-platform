/**
 * JSON export — the most lossless format.
 *
 * Carries everything: brief, outline, body markdown, citations with their
 * source provenance, infographics with their full ChartSpec. Consumers can
 * round-trip this into their own CMS / analytics pipeline.
 */

import type { ExportPayload, ExportResult } from "./types";

export function exportJson(payload: ExportPayload): ExportResult {
  // Stable JSON — pretty-printed, deterministic key order via JSON.stringify
  // (insertion order). The payload itself has a fixed shape so two exports
  // of the same article diff cleanly.
  const body = JSON.stringify(
    {
      schema: "article-studio.export.v1",
      ...payload,
    },
    null,
    2,
  );
  return {
    body,
    contentType: "application/json; charset=utf-8",
    filename: `${payload.slug}.json`,
  };
}
