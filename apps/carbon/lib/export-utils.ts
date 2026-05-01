/**
 * Helpers d'export tabulaire — CSV et XLSX.
 *
 * - CSV : pure string, RFC 4180 (échappement guillemets, séparateur `;` pour
 *   compatibilité Excel FR). Génération côté client via Blob, pas de
 *   dépendance.
 * - XLSX : utilise la lib `xlsx` déjà présente dans package.json. On ne la
 *   charge dynamiquement qu'à l'export pour ne pas alourdir le bundle.
 */

export type ExportRow = Record<string, string | number | boolean | null | undefined>;

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  if (s.includes('"') || s.includes(";") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(rows: readonly ExportRow[], columns?: readonly string[]): string {
  if (rows.length === 0) return "";
  const cols = columns ?? Object.keys(rows[0]);
  const header = cols.map(escapeCsv).join(";");
  const body = rows.map((row) => cols.map((c) => escapeCsv(row[c])).join(";")).join("\n");
  return `${header}\n${body}`;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCsv(filename: string, rows: readonly ExportRow[], columns?: readonly string[]) {
  const csv = rowsToCsv(rows, columns);
  // BOM UTF-8 pour qu'Excel reconnaisse l'encodage sur Windows.
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  downloadBlob(filename.endsWith(".csv") ? filename : `${filename}.csv`, blob);
}

export async function exportXlsx(
  filename: string,
  sheets: Record<string, readonly ExportRow[]>,
) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = XLSX.utils.json_to_sheet(rows as ExportRow[]);
    XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
  }
  const buffer: ArrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`, blob);
}
