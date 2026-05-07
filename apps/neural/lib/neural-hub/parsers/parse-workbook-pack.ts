import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

import type { AgentProofStatus } from "@/lib/proof-catalog";

export type WorkbookPackId =
  | "luxeCommunication"
  | "bankMarketing"
  | "insuranceSupplyChain"
  | "aeroComms";

interface WorkbookPackConfig {
  id: WorkbookPackId;
  label: string;
  relativeDir: string;
  status: AgentProofStatus;
  limitation: string;
}

export interface ParsedWorkbook {
  file: string;
  role: "agent" | "master" | "foundation" | "config";
  sheets: number;
  sheetNames: string[];
  detectedAgents: string[];
  kpiSignals: string[];
  proofStatus: AgentProofStatus;
  limitations: string[];
}

export interface ParsedWorkbookPack {
  id: WorkbookPackId;
  label: string;
  relativeDir: string;
  available: boolean;
  proofStatus: AgentProofStatus;
  workbooks: ParsedWorkbook[];
  agentsDetected: string[];
  workbookCount: number;
  parsedAt: string;
  limitations: string[];
}

const PACKS: Record<WorkbookPackId, WorkbookPackConfig> = {
  luxeCommunication: {
    id: "luxeCommunication",
    label: "Luxe Communication",
    relativeDir: "luxe-comms",
    status: "public_demo",
    limitation: "Pack public solide, mais pas encore un runtime client multi-tenant.",
  },
  bankMarketing: {
    id: "bankMarketing",
    label: "Bank Marketing",
    relativeDir: "bank-marketing",
    status: "runtime_parsed",
    limitation: "Metadata runtime disponible; fiches agents dediees a finaliser.",
  },
  insuranceSupplyChain: {
    id: "insuranceSupplyChain",
    label: "Insurance Supply Chain",
    relativeDir: "insurance-supply-chain",
    status: "public_demo",
    limitation: "Console publique scenario-id; parsing metier complet a durcir.",
  },
  aeroComms: {
    id: "aeroComms",
    label: "Aero Comms",
    relativeDir: "aero-comms",
    status: "runtime_parsed",
    limitation: "Workbooks embarques; runtime public complet encore a construire.",
  },
};

function roleFromFilename(file: string): ParsedWorkbook["role"] {
  const upper = file.toUpperCase();
  if (upper.includes("FOUNDATIONS")) return "foundation";
  if (upper.includes("MASTER")) return "master";
  if (upper.includes("CONFIG")) return "config";
  return "agent";
}

function cleanAgentName(file: string): string {
  return path
    .basename(file, ".xlsx")
    .replace(/^NEURAL_/i, "")
    .replace(/^AG[A-Z]*\d+_/i, "")
    .replace(/^ISC\d+_/i, "")
    .replace(/^AGBM\d+_/i, "")
    .replace(/_/g, " ");
}

function kpiSignalsFromSheets(sheetNames: string[]): string[] {
  return sheetNames
    .filter((sheet) => /kpi|metric|score|gate|registry|scenario|evidence|risk/i.test(sheet))
    .slice(0, 6);
}

function parseWorkbook(filePath: string, config: WorkbookPackConfig): ParsedWorkbook {
  const file = path.basename(filePath);
  const workbook = XLSX.readFile(filePath, { bookSheets: true });
  const role = roleFromFilename(file);

  return {
    file,
    role,
    sheets: workbook.SheetNames.length,
    sheetNames: workbook.SheetNames,
    detectedAgents: role === "agent" ? [cleanAgentName(file)] : [],
    kpiSignals: kpiSignalsFromSheets(workbook.SheetNames),
    proofStatus: config.status,
    limitations: [
      config.limitation,
      "Parser de preuve: expose metadata et onglets, pas encore toute la logique metier.",
    ],
  };
}

export function parseWorkbookPack(id: WorkbookPackId): ParsedWorkbookPack {
  const config = PACKS[id];
  const absoluteDir = path.join(process.cwd(), "data", config.relativeDir);
  const parsedAt = new Date().toISOString();

  if (!fs.existsSync(absoluteDir)) {
    return {
      id,
      label: config.label,
      relativeDir: config.relativeDir,
      available: false,
      proofStatus: config.status,
      workbooks: [],
      agentsDetected: [],
      workbookCount: 0,
      parsedAt,
      limitations: [`Dossier introuvable: data/${config.relativeDir}`],
    };
  }

  const workbooks = fs
    .readdirSync(absoluteDir)
    .filter((file) => file.endsWith(".xlsx"))
    .sort()
    .map((file) => parseWorkbook(path.join(absoluteDir, file), config));

  return {
    id,
    label: config.label,
    relativeDir: config.relativeDir,
    available: true,
    proofStatus: config.status,
    workbooks,
    agentsDetected: workbooks.flatMap((workbook) => workbook.detectedAgents),
    workbookCount: workbooks.length,
    parsedAt,
    limitations: [config.limitation],
  };
}

export function parseProofWorkbookPacks() {
  return {
    luxeCommunication: parseWorkbookPack("luxeCommunication"),
    bankMarketing: parseWorkbookPack("bankMarketing"),
    insuranceSupplyChain: parseWorkbookPack("insuranceSupplyChain"),
    aeroComms: parseWorkbookPack("aeroComms"),
  };
}
