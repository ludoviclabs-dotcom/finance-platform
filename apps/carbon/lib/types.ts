export type Page =
  | "dashboard"
  | "scopes"
  | "esrs"
  | "vsme"
  | "materialite"
  | "qc"
  | "revue"
  | "social"
  | "dpp"
  | "finance"
  | "copilot"
  | "reports"
  | "ingest"
  | "upload"
  | "audit"
  | "history"
  | "alerts"
  | "admin"
  | "pricing";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface KpiData {
  label: string;
  value: number;
  unit: string;
  change: number;
  icon: string;
}

export interface MonthlyEmission {
  month: string;
  scope1: number;
  scope2: number;
  scope3: number;
}

export interface ScopeCategory {
  name: string;
  value: number;
  color: string;
}

export interface ScopeDetail {
  id: number;
  name: string;
  description: string;
  total: number;
  unit: string;
  trend: number;
  categories: ScopeCategory[];
}

export interface EsrsStandard {
  id: string;
  name: string;
  fullName: string;
  progress: number;
  status: "compliant" | "in_progress" | "not_started";
  description: string;
  dataPoints: number;
  completedPoints: number;
}

export interface EsrsRadialData {
  subject: string;
  value: number;
  fullMark: number;
}

export interface Activity {
  id: number;
  type: "upload" | "validation" | "alert" | "report";
  title: string;
  description: string;
  time: string;
  icon: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted: boolean;
  badge?: string;
}

export interface AiSuggestion {
  id: number;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  category: string;
}
