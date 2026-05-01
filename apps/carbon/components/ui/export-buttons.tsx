"use client";

import { Download } from "lucide-react";
import { exportCsv, exportXlsx, type ExportRow } from "@/lib/export-utils";

interface ExportButtonsProps {
  rows: readonly ExportRow[];
  /** Nom de fichier sans extension (ex : "datapoints-2026"). */
  filename: string;
  /** Liste des colonnes CSV ; si non fournie, déduit depuis la première ligne. */
  columns?: readonly string[];
  /** Nom de l'onglet XLSX. */
  sheetName?: string;
  className?: string;
  size?: "sm" | "md";
}

export function ExportButtons({
  rows,
  filename,
  columns,
  sheetName = "Données",
  className = "",
  size = "md",
}: ExportButtonsProps) {
  const sizing = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  const disabled = rows.length === 0;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => exportCsv(filename, rows, columns)}
        className={`inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium ${sizing}`}
      >
        <Download className="w-4 h-4" />
        CSV
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => exportXlsx(filename, { [sheetName]: rows })}
        className={`inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium ${sizing}`}
      >
        <Download className="w-4 h-4" />
        XLSX
      </button>
    </div>
  );
}
