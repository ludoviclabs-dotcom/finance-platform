/**
 * NEURAL — Regulatory Watch façade (Sprint 7)
 */

export { runRegulatoryWatch, listAlerts, listHighImpactAlerts, getAlert } from "./watch";
export { fetchAllSources, fetchSource } from "./sources/feeds";
export { classifyPublication, classifyBatch } from "./classifier";
export { upsertAlert, upsertAlerts } from "./store";
export type {
  RegulatorySource,
  AffectedAgent,
  RawPublication,
  ClassifiedAlert,
  WatchRunResult,
} from "./types";
