/**
 * Zod schema for the infographic spec stored on Infographic.spec.
 *
 * Kept narrow on purpose for V1: one of bar/line/pie/table/stat. Anything
 * fancier (scatter, area, sankey…) goes through `kind: "table"` with
 * structured data and a custom renderer.
 *
 * `sourceCitationIds` lives at the Infographic row level (not in the spec)
 * so that re-rendering the chart with new data doesn't require touching the
 * spec — the renderer pulls citations from the row.
 */

import { z } from "zod";

const datasetSchema = z.object({
  label: z.string().min(1),
  /** Values are numbers (positions on the value axis). */
  values: z.array(z.number()),
});

export const barSpecSchema = z.object({
  kind: z.literal("bar"),
  title: z.string().min(1),
  xAxisLabel: z.string().optional(),
  yAxisLabel: z.string().optional(),
  /** Categories rendered on the x-axis (length must match each dataset.values). */
  categories: z.array(z.string().min(1)),
  datasets: z.array(datasetSchema).min(1).max(4),
});

export const lineSpecSchema = z.object({
  kind: z.literal("line"),
  title: z.string().min(1),
  xAxisLabel: z.string().optional(),
  yAxisLabel: z.string().optional(),
  categories: z.array(z.string().min(1)),
  datasets: z.array(datasetSchema).min(1).max(4),
});

export const pieSpecSchema = z.object({
  kind: z.literal("pie"),
  title: z.string().min(1),
  slices: z
    .array(z.object({ label: z.string().min(1), value: z.number() }))
    .min(2)
    .max(8),
});

export const tableSpecSchema = z.object({
  kind: z.literal("table"),
  title: z.string().min(1),
  headers: z.array(z.string().min(1)).min(1),
  rows: z.array(z.array(z.string())).min(1),
});

export const statSpecSchema = z.object({
  kind: z.literal("stat"),
  title: z.string().min(1),
  value: z.string().min(1),
  /** Tagline displayed under the big number. */
  caption: z.string().optional(),
});

export const chartSpecSchema = z.discriminatedUnion("kind", [
  barSpecSchema,
  lineSpecSchema,
  pieSpecSchema,
  tableSpecSchema,
  statSpecSchema,
]);

export type ChartSpec = z.infer<typeof chartSpecSchema>;
export type ChartKind = ChartSpec["kind"];
