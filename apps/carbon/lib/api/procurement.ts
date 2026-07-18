/**
 * lib/api/procurement.ts — client API de l'exposition achats/fournisseurs (PR-05A).
 *
 * Réutilise `API_BASE_URL` et le token en mémoire (`getAuthToken`) du client
 * principal (`@/lib/api`) — pas de second mécanisme d'auth. Aucun calcul Scope 3
 * ni score ici (PR-05B) : uniquement le socle d'exposition (imports idempotents,
 * file de résolution, déclarations/PCF sourcées).
 */

import { API_BASE_URL, getAuthToken } from "@/lib/api";

// ── Types (miroir de apps/api/models/procurement.py) ─────────────────────────

export type MappingStatus = "unmapped" | "mapped" | "needs_review" | "resolved";
export type PurchaseImportStatus = "pending" | "validated" | "emitted" | "rejected";
export type ProcurementDataStatus = "verified" | "estimated" | "manual" | "inferred";
export type ProcurementReviewStatus = "pending" | "accepted" | "flagged";

export interface PurchaseImport {
  id: number;
  company_id: number;
  filename: string;
  sha256: string;
  period_start: string | null;
  period_end: string | null;
  status: PurchaseImportStatus;
  row_count: number;
  accepted_count: number;
  rejected_count: number;
  error_summary: string | null;
  imported_by: number | null;
  imported_at: string;
  updated_at: string;
  already_imported: boolean;
}

export interface PurchaseLine {
  id: number;
  company_id: number;
  import_id: number;
  supplier_id: number | null;
  supplier_external_code: string | null;
  product_id: number | null;
  product_external_code: string | null;
  purchase_date: string | null;
  quantity: number | null;
  unit: string | null;
  spend_amount: number | null;
  currency: string | null;
  category_code: string | null;
  origin_country: string | null;
  raw_row_json: Record<string, unknown>;
  mapping_status: MappingStatus;
  created_at: string;
  updated_at: string;
}

export interface Declaration {
  id: number;
  supplier_id: number;
  supplier_product_id: number | null;
  metric_code: string;
  value: number | null;
  unit: string | null;
  reporting_year: number | null;
  data_status: ProcurementDataStatus;
  review_status: ProcurementReviewStatus;
  observation_id: number | null;
  source_release_id: number | null;
  evidence_artifact_id: number | null;
  created_at: string;
}

export interface Pcf {
  id: number;
  supplier_product_id: number;
  value_kgco2e: number | null;
  declared_unit: string | null;
  verification_status: string | null;
  data_status: ProcurementDataStatus;
  observation_id: number | null;
  source_release_id: number | null;
  evidence_artifact_id: number | null;
  created_at: string;
}

interface ListEnvelope<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface LineResolutionInput {
  line_id: number;
  supplier_id?: number | null;
  product_id?: number | null;
  mapping_status?: MappingStatus;
}

// ── Fetch helpers (auth partagée avec le client principal) ────────────────────

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json", ...authHeaders() },
    credentials: "include",
    signal,
  });
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return (await res.json()) as T;
}

async function apiSend<T>(method: "POST", path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return (await res.json()) as T;
}

// ── Imports d'achats ─────────────────────────────────────────────────────────

export interface PurchaseImportCreateInput {
  filename: string;
  csv_text: string;
  period_start?: string | null;
  period_end?: string | null;
}

export function createPurchaseImport(body: PurchaseImportCreateInput): Promise<PurchaseImport> {
  return apiSend<PurchaseImport>("POST", "/procurement/imports", body);
}

export async function fetchPurchaseImports(signal?: AbortSignal): Promise<PurchaseImport[]> {
  const env = await apiGet<ListEnvelope<PurchaseImport>>("/procurement/imports?limit=200", signal);
  return env.items;
}

export function fetchPurchaseImport(id: number, signal?: AbortSignal): Promise<PurchaseImport> {
  return apiGet<PurchaseImport>(`/procurement/imports/${id}`, signal);
}

export async function fetchImportLines(
  id: number,
  mappingStatus?: MappingStatus,
  signal?: AbortSignal,
): Promise<PurchaseLine[]> {
  const q = mappingStatus ? `?mapping_status=${mappingStatus}&limit=200` : "?limit=200";
  const env = await apiGet<ListEnvelope<PurchaseLine>>(`/procurement/imports/${id}/lines${q}`, signal);
  return env.items;
}

export async function fetchResolutionQueue(id: number, signal?: AbortSignal): Promise<PurchaseLine[]> {
  const env = await apiGet<ListEnvelope<PurchaseLine>>(
    `/procurement/imports/${id}/resolution-queue?limit=200`,
    signal,
  );
  return env.items;
}

export function resolveImportMappings(
  id: number,
  resolutions: LineResolutionInput[],
): Promise<{ resolved: number; requested: number }> {
  return apiSend("POST", `/procurement/imports/${id}/resolve-mappings`, { resolutions });
}

export function reviewImport(id: number, accept: boolean): Promise<PurchaseImport> {
  return apiSend<PurchaseImport>("POST", `/procurement/imports/${id}/review`, { accept });
}

// ── Déclarations & PCF (sourcées) ─────────────────────────────────────────────

export async function fetchDeclarations(
  supplierId?: number,
  signal?: AbortSignal,
): Promise<Declaration[]> {
  const q = supplierId ? `?supplier_id=${supplierId}&limit=200` : "?limit=200";
  const env = await apiGet<ListEnvelope<Declaration>>(`/procurement/declarations${q}`, signal);
  return env.items;
}

export async function fetchPcfs(supplierProductId?: number, signal?: AbortSignal): Promise<Pcf[]> {
  const q = supplierProductId ? `?supplier_product_id=${supplierProductId}&limit=200` : "?limit=200";
  const env = await apiGet<ListEnvelope<Pcf>>(`/procurement/pcfs${q}`, signal);
  return env.items;
}

/** Part résolue des lignes d'un import (mapped + resolved sur total). */
export function resolvedShare(imp: PurchaseImport, lines: PurchaseLine[]): number {
  if (lines.length === 0) return 0;
  const resolved = lines.filter(
    (l) => l.mapping_status === "mapped" || l.mapping_status === "resolved",
  ).length;
  return Math.round((resolved / lines.length) * 100);
}
