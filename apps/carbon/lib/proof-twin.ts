import type { ConsolidatedSnapshot } from "@/lib/api";

export type ProofTwinNodeId =
  | "site"
  | "energy"
  | "suppliers"
  | "transport"
  | "digital"
  | "esrs-report";

export type ProofTwinScope = "scope1" | "scope2" | "scope3";
export type ProofTwinStandard = "E1" | "S1" | "G1";
export type ProofTwinStatus = "complete" | "review" | "missing";
export type ProofTwinConfidence = "A" | "B" | "C" | "D";
export type ProofTwinStage =
  | "sources"
  | "datapoints"
  | "controls"
  | "review"
  | "export";

export interface ProofTwinNode {
  id: ProofTwinNodeId;
  label: string;
  shortLabel: string;
  type: "site" | "activity" | "supplier" | "system" | "report";
  scopes: ProofTwinScope[];
  standards: ProofTwinStandard[];
  stage: ProofTwinStage;
  factCode?: string;
  metricKey?: keyof ConsolidatedSnapshot["carbon"];
  unit?: string;
  demoValue?: number;
  claim: string;
  why: string;
  sourceLabel: string;
  method: string;
  limitation: string;
  nextAction: string;
  route: string;
  confidence: ProofTwinConfidence;
  status: ProofTwinStatus;
}

export interface ProofTwinFilters {
  scope: ProofTwinScope | "all";
  standard: ProofTwinStandard | "all";
  status: ProofTwinStatus | "all";
}

export interface ProofTwinMetric {
  value: number | null;
  unit: string;
  source: "live" | "demo" | "none";
}

export const PROOF_TWIN_NODES: ProofTwinNode[] = [
  {
    id: "site",
    label: "Site industriel",
    shortLabel: "Site",
    type: "site",
    scopes: ["scope1"],
    standards: ["E1"],
    stage: "sources",
    factCode: "CC.GES.SCOPE1",
    metricKey: "scope1Tco2e",
    unit: "tCO2e",
    demoValue: 1336,
    claim: "Les emissions directes du site sont rattachees aux combustions, procedes et fluides refrigerants.",
    why: "C'est le point de depart de l'audit E1 : il relie l'activite physique au total Scope 1.",
    sourceLabel: "Workbook carbone, onglet Energie / Process",
    method: "Lecture du snapshot carbone puis trail facts_events lorsque disponible.",
    limitation: "Les valeurs de demonstration sont signalees tant qu'aucun ingest live n'est disponible.",
    nextAction: "Importer ou verifier les factures et registres site dans /upload.",
    route: "/upload",
    confidence: "B",
    status: "review",
  },
  {
    id: "energy",
    label: "Electricite & chaleur",
    shortLabel: "Energie",
    type: "activity",
    scopes: ["scope2"],
    standards: ["E1"],
    stage: "datapoints",
    factCode: "CC.GES.SCOPE2_LB",
    metricKey: "scope2LbTco2e",
    unit: "tCO2e",
    demoValue: 934,
    claim: "Les consommations energetiques alimentent le Scope 2 location-based et les controles de coherence.",
    why: "Les ecarts Scope 2 sont visibles rapidement par un OTI et doivent rester sourcables.",
    sourceLabel: "Factures energie, API energie ou import Excel structure",
    method: "Facteurs d'emission documentes, rattachement au datapoint E1-6.",
    limitation: "Le market-based depend encore de certificats ou garanties d'origine fournis par l'utilisateur.",
    nextAction: "Controler les sources energie et le statut de validation dans /qc.",
    route: "/qc",
    confidence: "B",
    status: "review",
  },
  {
    id: "suppliers",
    label: "Achats fournisseurs",
    shortLabel: "Fournisseurs",
    type: "supplier",
    scopes: ["scope3"],
    standards: ["E1", "S1"],
    stage: "sources",
    factCode: "CC.GES.SCOPE3",
    metricKey: "scope3Tco2e",
    unit: "tCO2e",
    demoValue: 3685,
    claim: "Les fournisseurs structurent le poste Scope 3 amont et les demandes grands comptes.",
    why: "C'est la zone ou preuve carbone, questionnaire fournisseur et appel d'offres se rejoignent.",
    sourceLabel: "Questionnaires fournisseurs et imports achats",
    method: "Aggregation par fournisseur, categorie Scope 3 et statut de reponse.",
    limitation: "La qualite depend des reponses fournisseurs et de la granularite achat.",
    nextAction: "Lancer ou relancer les questionnaires prioritaires dans /fournisseurs.",
    route: "/fournisseurs",
    confidence: "C",
    status: "missing",
  },
  {
    id: "transport",
    label: "Logistique amont/aval",
    shortLabel: "Transport",
    type: "activity",
    scopes: ["scope3"],
    standards: ["E1"],
    stage: "controls",
    claim: "Les flux transport expliquent une part importante des variations Scope 3.",
    why: "Ils transforment un poste comptable en trajet, distance, mode et facteur exploitable.",
    sourceLabel: "Exports transporteurs, kilometres, tonnes.km",
    method: "Controle par poste, periode et coherence avec volumes achats.",
    limitation: "Pas de fact_code stable tant que le detail transport n'est pas extrait comme KPI autonome.",
    nextAction: "Documenter les hypotheses transport puis les valider dans /review.",
    route: "/review",
    confidence: "C",
    status: "review",
  },
  {
    id: "digital",
    label: "Cloud & SaaS",
    shortLabel: "Numerique",
    type: "system",
    scopes: ["scope3"],
    standards: ["E1", "G1"],
    stage: "datapoints",
    claim: "Les usages numeriques doivent rester visibles comme poste Scope 3 et dependance fournisseur.",
    why: "Le numerique est souvent diffus dans les couts, mais un auditeur demandera la methode et le perimetre.",
    sourceLabel: "Factures cloud, SaaS et facteurs specialises",
    method: "Qualification du fournisseur puis rattachement au poste Scope 3 pertinent.",
    limitation: "Les facteurs cloud restent plus incertains que les donnees energie directes.",
    nextAction: "Ajouter les sources numeriques au corpus et les citer dans les datapoints.",
    route: "/datapoints",
    confidence: "D",
    status: "missing",
  },
  {
    id: "esrs-report",
    label: "Rapport ESRS & Evidence Pack",
    shortLabel: "Rapport",
    type: "report",
    scopes: ["scope1", "scope2", "scope3"],
    standards: ["E1", "S1", "G1"],
    stage: "export",
    factCode: "CC.GES.TOTAL_S123",
    metricKey: "totalS123Tco2e",
    unit: "tCO2e",
    demoValue: 5955,
    claim: "Le rapport doit relier donnees, controles, review humaine et hash public de verification.",
    why: "C'est la sortie partageable avec DAF, OTI ou client grand compte.",
    sourceLabel: "Export package, manifest.json, audit_trail.json",
    method: "ZIP signe, manifest SHA-256 et page publique /verify/{hash}.",
    limitation: "La valeur probante depend du gel des datapoints et de la verification de chaine.",
    nextAction: "Generer un Evidence Pack depuis /revue lorsque les preuves critiques sont completes.",
    route: "/revue",
    confidence: "B",
    status: "complete",
  },
];

export function filterProofTwinNodes(
  nodes: ProofTwinNode[],
  filters: ProofTwinFilters,
): ProofTwinNode[] {
  return nodes.filter((node) => {
    if (filters.scope !== "all" && !node.scopes.includes(filters.scope)) return false;
    if (filters.standard !== "all" && !node.standards.includes(filters.standard)) return false;
    if (filters.status !== "all" && node.status !== filters.status) return false;
    return true;
  });
}

export function resolveProofTwinMetric(
  node: ProofTwinNode,
  snapshot: ConsolidatedSnapshot | null,
): ProofTwinMetric {
  const unit = node.unit ?? "preuve";
  if (node.metricKey && snapshot) {
    const raw = snapshot.carbon[node.metricKey];
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      return { value: raw, unit, source: "live" };
    }
  }
  if (typeof node.demoValue === "number") {
    return { value: node.demoValue, unit, source: "demo" };
  }
  return { value: null, unit, source: "none" };
}

export function getProofTwinStatusCounts(nodes: ProofTwinNode[]) {
  return nodes.reduce(
    (acc, node) => {
      acc[node.status] += 1;
      return acc;
    },
    { complete: 0, review: 0, missing: 0 } satisfies Record<ProofTwinStatus, number>,
  );
}

export function isProofTwinLive(snapshot: ConsolidatedSnapshot | null): boolean {
  if (!snapshot) return false;
  const carbonAvailable = Object.values(snapshot.health ?? {}).some((domain) => domain.available);
  const hasCarbonValue =
    typeof snapshot.carbon.totalS123Tco2e === "number" &&
    snapshot.carbon.totalS123Tco2e > 0;
  return carbonAvailable || hasCarbonValue;
}
