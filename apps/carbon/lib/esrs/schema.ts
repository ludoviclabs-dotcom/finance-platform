import { z } from "zod";
import esrsSet2 from "../esrs-set2.json";

export const DatapointTypeEnum = z.enum(["number", "text", "boolean", "enum"]);
export type DatapointType = z.infer<typeof DatapointTypeEnum>;

export const StandardEnum = z.enum(["E1", "E2", "E3", "E4", "E5", "S1", "S2", "S3", "S4", "G1"]);
export type Standard = z.infer<typeof StandardEnum>;

export const EsrsDatapointDefSchema = z.object({
  id: z.string(),
  standard: StandardEnum,
  code: z.string(),
  label_fr: z.string(),
  label_en: z.string(),
  type: DatapointTypeEnum,
  unit: z.string().optional(),
  mandatory: z.boolean(),
  description: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
});
export type EsrsDatapointDef = z.infer<typeof EsrsDatapointDefSchema>;

export const EsrsSet2Schema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  datapoints: z.array(EsrsDatapointDefSchema),
});

export const ESRS_SET2 = EsrsSet2Schema.parse(esrsSet2);

export function findDatapoint(id: string): EsrsDatapointDef | undefined {
  return ESRS_SET2.datapoints.find((d) => d.id === id);
}

export function listByStandard(standard: Standard): EsrsDatapointDef[] {
  return ESRS_SET2.datapoints.filter((d) => d.standard === standard);
}

export const SourceCitationSchema = z.object({
  blobUrl: z.string(),
  filename: z.string(),
  page: z.number().int().positive().optional(),
  sheet: z.string().optional(),
  snippet: z.string(),
});
export type SourceCitation = z.infer<typeof SourceCitationSchema>;

export const ExtractedDatapointSchema = z.object({
  datapointId: z.string(),
  value: z.union([z.number(), z.string(), z.boolean(), z.null()]),
  unit: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
  sources: z.array(SourceCitationSchema),
  status: z.enum(["empty", "extracted", "validated", "rejected"]),
  extractedAt: z.string(),
  validatedBy: z.string().optional(),
});
export type ExtractedDatapoint = z.infer<typeof ExtractedDatapointSchema>;

export const DatapointStateSchema = z.object({
  cid: z.string(),
  updatedAt: z.string(),
  datapoints: z.record(z.string(), ExtractedDatapointSchema),
});
export type DatapointState = z.infer<typeof DatapointStateSchema>;
