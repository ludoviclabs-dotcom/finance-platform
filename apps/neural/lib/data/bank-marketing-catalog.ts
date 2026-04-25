export type BankMktAgentSlug =
  | "bank-marketing-compliance-guard"
  | "fin-literacy-content"
  | "segmented-bank-marketing"
  | "mifid-product-marketing-guard";

export type BankMktVerdict = "PASS" | "PASS_WITH_REVIEW" | "BLOCK";
export type BankMktGateState = "pass" | "review" | "block";

export interface BankMktAgent {
  id: string;
  slug: BankMktAgentSlug;
  name: string;
  owner: string;
  mission: string;
  primaryGate: string;
  workbook: string;
  kpis: string[];
}

export interface BankMktGate {
  id: string;
  label: string;
  severity: "HIGH" | "CRITICAL";
  blocking: boolean;
  source: string;
  owner: string;
}

export interface BankMktSource {
  id: string;
  domain: string;
  authority: string;
  title: string;
  date: string;
  impact: string;
}

export interface BankMktScenario {
  id: string;
  agentSlug: BankMktAgentSlug;
  label: string;
  product: string;
  channel: string;
  segment: string;
  verdict: BankMktVerdict;
  summary: string;
  expectedOutput: string;
  workbook: string;
  gates: Array<{
    id: string;
    state: BankMktGateState;
    note: string;
  }>;
}

export const BANK_MKT_SUMMARY = {
  agents: 4,
  reservedServices: 2,
  workbooks: 6,
  gates: 10,
  scenarios: 12,
  sourceDate: "25/04/2026",
} as const;

export const BANK_MKT_WORKBOOKS = [
  "NEURAL_BANK_MARKETING_FOUNDATIONS.xlsx",
  "NEURAL_BANK_MARKETING_MASTER.xlsx",
  "NEURAL_AGBM001_BankMarketingComplianceGuard.xlsx",
  "NEURAL_AGBM002_FinLiteracyContent.xlsx",
  "NEURAL_AGBM003_SegmentedBankMarketing.xlsx",
  "NEURAL_AGBM004_MiFIDProductMarketingGuard.xlsx",
] as const;

export const BANK_MKT_AGENTS: BankMktAgent[] = [
  {
    id: "AG-BM001",
    slug: "bank-marketing-compliance-guard",
    name: "BankMarketingComplianceGuard",
    owner: "Marketing Compliance",
    mission:
      "Audit bank, savings and credit campaigns against AMF/ACPR expectations: clear, accurate, balanced, sourced and not misleading.",
    primaryGate: "GATE-AMF-ACPR-CLEAR-NOT-MISLEADING",
    workbook: "NEURAL_AGBM001_BankMarketingComplianceGuard.xlsx",
    kpis: ["Clear/not misleading", "Risk balance", "Validated numbers"],
  },
  {
    id: "AG-BM002",
    slug: "fin-literacy-content",
    name: "FinLiteracyContent",
    owner: "Education + Brand",
    mission:
      "Produce financial education content with source, readability and advice-boundary controls. No disguised personalized advice.",
    primaryGate: "GATE-SOURCE-ACTIVE",
    workbook: "NEURAL_AGBM002_FinLiteracyContent.xlsx",
    kpis: ["Source active", "Risk language", "Advice boundary"],
  },
  {
    id: "AG-BM003",
    slug: "segmented-bank-marketing",
    name: "SegmentedBankMarketing",
    owner: "CRM Marketing + DPO",
    mission:
      "Adapt bank marketing by client segment while preserving consent, profiling basis, fairness and AI transparency.",
    primaryGate: "GATE-GDPR-CONSENT-PROFILING",
    workbook: "NEURAL_AGBM003_SegmentedBankMarketing.xlsx",
    kpis: ["Consent basis", "AI disclosure", "Vulnerable clients"],
  },
  {
    id: "AG-BM004",
    slug: "mifid-product-marketing-guard",
    name: "MiFIDProductMarketingGuard",
    owner: "Investment Compliance",
    mission:
      "Check investment, complex product and crypto-asset marketing against MiFID target market, PRIIPs KID and MiCA consistency.",
    primaryGate: "GATE-MIFID-TARGET-MARKET",
    workbook: "NEURAL_AGBM004_MiFIDProductMarketingGuard.xlsx",
    kpis: ["MiFID target market", "PRIIPs KID", "MiCA crypto"],
  },
];

export const BANK_MKT_SERVICES = [
  {
    id: "AG-BM005",
    name: "RegWatchEvidenceBankMktg",
    mission:
      "Reserved service for AMF, ACPR, ESMA, EBA, EUR-Lex and CNIL watch plus source freshness scoring.",
  },
  {
    id: "AG-BM006",
    name: "ConsentAIDoraGuard",
    mission:
      "Reserved service for consent, AI disclosure, audit trail and DORA dependency checks when connected to CMS, CRM or DAM tools.",
  },
] as const;

export const BANK_MKT_GATES: BankMktGate[] = [
  {
    id: "GATE-AMF-ACPR-CLEAR-NOT-MISLEADING",
    label: "Clear, accurate and not misleading",
    severity: "CRITICAL",
    blocking: true,
    source: "AMF/ACPR advertising criteria",
    owner: "Marketing Compliance",
  },
  {
    id: "GATE-RISK-BENEFIT-BALANCE",
    label: "Risk and benefit balance",
    severity: "CRITICAL",
    blocking: true,
    source: "AMF/ACPR advertising criteria",
    owner: "Marketing Compliance",
  },
  {
    id: "GATE-SOURCE-ACTIVE",
    label: "Source evidence active",
    severity: "HIGH",
    blocking: true,
    source: "Foundations sourcebook",
    owner: "AI Ops",
  },
  {
    id: "GATE-NUM-VALIDATED",
    label: "Numbers validated and dated",
    severity: "HIGH",
    blocking: true,
    source: "AMF/ACPR advertising criteria",
    owner: "Data Owner",
  },
  {
    id: "GATE-MIFID-TARGET-MARKET",
    label: "MiFID target-market consistency",
    severity: "CRITICAL",
    blocking: true,
    source: "ESMA / MiFID II",
    owner: "Investment Compliance",
  },
  {
    id: "GATE-PRIIPS-KID-CONSISTENCY",
    label: "PRIIPs KID consistency",
    severity: "CRITICAL",
    blocking: true,
    source: "PRIIPs Regulation",
    owner: "Investment Compliance",
  },
  {
    id: "GATE-MICA-CRYPTO-MARKETING",
    label: "MiCA crypto marketing",
    severity: "CRITICAL",
    blocking: true,
    source: "MiCA Regulation",
    owner: "Crypto Compliance",
  },
  {
    id: "GATE-GDPR-CONSENT-PROFILING",
    label: "GDPR consent and profiling basis",
    severity: "CRITICAL",
    blocking: true,
    source: "CNIL / GDPR",
    owner: "DPO",
  },
  {
    id: "GATE-AI-ACT-DISCLOSURE",
    label: "AI Act transparency disclosure",
    severity: "HIGH",
    blocking: true,
    source: "EU AI Act",
    owner: "DPO + Marketing",
  },
  {
    id: "GATE-HITL-COMPLIANCE",
    label: "Human compliance approval",
    severity: "CRITICAL",
    blocking: true,
    source: "Internal approval policy",
    owner: "Compliance",
  },
];

export const BANK_MKT_SOURCES: BankMktSource[] = [
  {
    id: "SRC-AMF-ACPR-PUB-001",
    domain: "Advertising",
    authority: "AMF/ACPR",
    title: "Common criteria for clear, accurate and non-misleading advertising",
    date: "2014-06-12",
    impact: "Core marketing gate: identifiable, intelligible, balanced and not misleading.",
  },
  {
    id: "SRC-AMF-COMPLEX-001",
    domain: "MiFID",
    authority: "AMF",
    title: "DOC-2010-05 complex financial instruments",
    date: "2025-12-08",
    impact: "Complexity and dissuasive warnings for non-professional clients.",
  },
  {
    id: "SRC-AMF-CRYPTO-2025",
    domain: "Crypto",
    authority: "AMF",
    title: "Doctrine adapted for debt securities indexed to crypto-assets",
    date: "2025-12-08",
    impact: "Crypto-linked marketing needs MiFID and MiCA cross-checks.",
  },
  {
    id: "SRC-EU-MICA-001",
    domain: "MiCA",
    authority: "EUR-Lex",
    title: "Regulation (EU) 2023/1114 on markets in crypto-assets",
    date: "2024-12-30",
    impact: "Crypto marketing must be clearly identifiable, fair, clear and not misleading.",
  },
  {
    id: "SRC-EU-DORA-001",
    domain: "DORA",
    authority: "EUR-Lex",
    title: "Digital operational resilience for financial entities",
    date: "2025-01-17",
    impact: "Marketing stack dependencies need ICT third-party traceability when integrated.",
  },
  {
    id: "SRC-EU-AIACT-001",
    domain: "AI Act",
    authority: "EUR-Lex",
    title: "Regulation (EU) 2024/1689 transparency obligations",
    date: "2026-08-02",
    impact: "AI-assisted marketing needs transparent disclosure where applicable.",
  },
  {
    id: "SRC-CNIL-PROF-001",
    domain: "GDPR",
    authority: "CNIL",
    title: "AI, profiling and automated decisions",
    date: "2026-04-25",
    impact: "Segmentation and profiling need legal basis, minimization and human oversight.",
  },
  {
    id: "SRC-ESMA-MIFID-001",
    domain: "MiFID",
    authority: "ESMA",
    title: "Product governance and target-market expectations",
    date: "2024-01-01",
    impact: "Marketing must remain consistent with target market and distribution strategy.",
  },
  {
    id: "SRC-EU-PRIIPS-001",
    domain: "PRIIPs",
    authority: "EUR-Lex",
    title: "PRIIPs KID consistency for packaged retail investment products",
    date: "2026-04-25",
    impact: "Marketing claims cannot contradict KID risks, costs or performance scenarios.",
  },
  {
    id: "SRC-ACPR-2026-IA",
    domain: "Supervision",
    authority: "ACPR",
    title: "Customer protection event includes AI in product sales",
    date: "2026-03-31",
    impact: "Signals current supervisory attention to AI in commercialization.",
  },
];

export const BANK_MKT_SCENARIOS: BankMktScenario[] = [
  {
    id: "BM001-PASS-LIVRET",
    agentSlug: "bank-marketing-compliance-guard",
    label: "Livret landing page with balanced conditions",
    product: "Livret",
    channel: "Landing page",
    segment: "Retail",
    verdict: "PASS",
    summary: "Rate, ceiling and eligibility are visible near the CTA.",
    expectedOutput: "Campaign can proceed with dated rate, ceiling and eligibility evidence.",
    workbook: "NEURAL_AGBM001_BankMarketingComplianceGuard.xlsx",
    gates: [
      { id: "GATE-AMF-ACPR-CLEAR-NOT-MISLEADING", state: "pass", note: "Headline and conditions are aligned." },
      { id: "GATE-RISK-BENEFIT-BALANCE", state: "pass", note: "Benefits and limits are adjacent." },
      { id: "GATE-NUM-VALIDATED", state: "pass", note: "Rate is dated and sourced." },
      { id: "GATE-HITL-COMPLIANCE", state: "pass", note: "Compliance owner logged." },
    ],
  },
  {
    id: "BM001-REVIEW-CREDIT",
    agentSlug: "bank-marketing-compliance-guard",
    label: "Credit email needs clearer repayment warning",
    product: "Consumer credit",
    channel: "Email",
    segment: "Retail",
    verdict: "PASS_WITH_REVIEW",
    summary: "Mandatory warning exists but is less visible than the promotional headline.",
    expectedOutput: "Move repayment warning near headline and CTA; keep APR example visible.",
    workbook: "NEURAL_AGBM001_BankMarketingComplianceGuard.xlsx",
    gates: [
      { id: "GATE-AMF-ACPR-CLEAR-NOT-MISLEADING", state: "pass", note: "Core claim is understandable." },
      { id: "GATE-RISK-BENEFIT-BALANCE", state: "review", note: "Warning hierarchy is too weak." },
      { id: "GATE-NUM-VALIDATED", state: "pass", note: "APR example is present." },
      { id: "GATE-HITL-COMPLIANCE", state: "pass", note: "Reviewer required before send." },
    ],
  },
  {
    id: "BM001-BLOCK-RATE",
    agentSlug: "bank-marketing-compliance-guard",
    label: "Guaranteed best rate without proof",
    product: "Savings",
    channel: "App push",
    segment: "Retail",
    verdict: "BLOCK",
    summary: "Absolute superiority and unsupported number block publication.",
    expectedOutput: "Remove guaranteed-best-rate claim and add sourced comparison or neutral wording.",
    workbook: "NEURAL_AGBM001_BankMarketingComplianceGuard.xlsx",
    gates: [
      { id: "GATE-AMF-ACPR-CLEAR-NOT-MISLEADING", state: "block", note: "Absolute claim is unsupported." },
      { id: "GATE-RISK-BENEFIT-BALANCE", state: "block", note: "Conditions are missing." },
      { id: "GATE-NUM-VALIDATED", state: "block", note: "No evidence for ranking." },
      { id: "GATE-HITL-COMPLIANCE", state: "block", note: "No approver yet." },
    ],
  },
  {
    id: "BM002-PASS-BUDGET",
    agentSlug: "fin-literacy-content",
    label: "Budget education article",
    product: "Budget education",
    channel: "LinkedIn",
    segment: "Retail",
    verdict: "PASS",
    summary: "General education, no personalized recommendation.",
    expectedOutput: "Publish as general financial education with source links and no product CTA.",
    workbook: "NEURAL_AGBM002_FinLiteracyContent.xlsx",
    gates: [
      { id: "GATE-SOURCE-ACTIVE", state: "pass", note: "Education source active." },
      { id: "GATE-NUM-VALIDATED", state: "pass", note: "Examples are dated." },
      { id: "GATE-HITL-COMPLIANCE", state: "pass", note: "Brand and compliance review logged." },
    ],
  },
  {
    id: "BM002-REVIEW-ETF",
    agentSlug: "fin-literacy-content",
    label: "ETF explainer needs stronger risk language",
    product: "Investment education",
    channel: "Email",
    segment: "Young retail",
    verdict: "PASS_WITH_REVIEW",
    summary: "Educational format is acceptable but risks are too low in the hierarchy.",
    expectedOutput: "Raise risk disclaimer and separate education from product acquisition CTA.",
    workbook: "NEURAL_AGBM002_FinLiteracyContent.xlsx",
    gates: [
      { id: "GATE-SOURCE-ACTIVE", state: "pass", note: "Sources active." },
      { id: "GATE-RISK-BENEFIT-BALANCE", state: "review", note: "Risk language needs more prominence." },
      { id: "GATE-HITL-COMPLIANCE", state: "pass", note: "Legal review before publication." },
    ],
  },
  {
    id: "BM002-BLOCK-ADVICE",
    agentSlug: "fin-literacy-content",
    label: "Article recommends a specific product for seniors",
    product: "Investment education",
    channel: "Landing page",
    segment: "Senior retail",
    verdict: "BLOCK",
    summary: "Educational content becomes personalized advice and target-market mismatch.",
    expectedOutput: "Remove product-specific recommendation and route to regulated advisory workflow.",
    workbook: "NEURAL_AGBM002_FinLiteracyContent.xlsx",
    gates: [
      { id: "GATE-AMF-ACPR-CLEAR-NOT-MISLEADING", state: "block", note: "Advice boundary crossed." },
      { id: "GATE-MIFID-TARGET-MARKET", state: "block", note: "Target market not documented." },
      { id: "GATE-HITL-COMPLIANCE", state: "block", note: "Must be reviewed as advice." },
    ],
  },
  {
    id: "BM003-PASS-APP",
    agentSlug: "segmented-bank-marketing",
    label: "Consented app push for budgeting feature",
    product: "Budget app",
    channel: "App push",
    segment: "Young retail",
    verdict: "PASS",
    summary: "Consent and AI personalization notice are present.",
    expectedOutput: "Send concise app push with link to full disclosure and opt-out path.",
    workbook: "NEURAL_AGBM003_SegmentedBankMarketing.xlsx",
    gates: [
      { id: "GATE-GDPR-CONSENT-PROFILING", state: "pass", note: "Consent basis documented." },
      { id: "GATE-AI-ACT-DISCLOSURE", state: "pass", note: "Personalization notice present." },
      { id: "GATE-HITL-COMPLIANCE", state: "pass", note: "Campaign owner logged." },
    ],
  },
  {
    id: "BM003-REVIEW-SENIOR",
    agentSlug: "segmented-bank-marketing",
    label: "Senior email personalization needs readability review",
    product: "Savings",
    channel: "Email",
    segment: "Senior retail",
    verdict: "PASS_WITH_REVIEW",
    summary: "Vulnerable segment needs readability and pressure-wording review.",
    expectedOutput: "Simplify sentence length and remove urgency before compliance approval.",
    workbook: "NEURAL_AGBM003_SegmentedBankMarketing.xlsx",
    gates: [
      { id: "GATE-GDPR-CONSENT-PROFILING", state: "pass", note: "Consent captured." },
      { id: "GATE-AI-ACT-DISCLOSURE", state: "review", note: "AI disclosure needs clearer placement." },
      { id: "GATE-HITL-COMPLIANCE", state: "pass", note: "DPO review required." },
    ],
  },
  {
    id: "BM003-BLOCK-PROFILING",
    agentSlug: "segmented-bank-marketing",
    label: "Crypto landing page retargeted without consent",
    product: "Crypto",
    channel: "Landing page",
    segment: "Crypto interest",
    verdict: "BLOCK",
    summary: "Consentless profiling and missing AI disclosure block the campaign.",
    expectedOutput: "Stop campaign until consent basis, AI disclosure and crypto risk gates are fixed.",
    workbook: "NEURAL_AGBM003_SegmentedBankMarketing.xlsx",
    gates: [
      { id: "GATE-GDPR-CONSENT-PROFILING", state: "block", note: "No valid consent basis." },
      { id: "GATE-AI-ACT-DISCLOSURE", state: "block", note: "AI disclosure missing." },
      { id: "GATE-MICA-CRYPTO-MARKETING", state: "block", note: "Crypto risk notice missing." },
      { id: "GATE-HITL-COMPLIANCE", state: "block", note: "No approval log." },
    ],
  },
  {
    id: "BM004-PASS-FUND",
    agentSlug: "mifid-product-marketing-guard",
    label: "Balanced fund brochure consistent with KID",
    product: "Investment fund",
    channel: "Brochure",
    segment: "Affluent retail",
    verdict: "PASS",
    summary: "Target market, costs, risk indicator and performance wording align.",
    expectedOutput: "Allow publication with KID link, risk box and dated performance context.",
    workbook: "NEURAL_AGBM004_MiFIDProductMarketingGuard.xlsx",
    gates: [
      { id: "GATE-MIFID-TARGET-MARKET", state: "pass", note: "Audience is eligible." },
      { id: "GATE-PRIIPS-KID-CONSISTENCY", state: "pass", note: "Costs and risk align with KID." },
      { id: "GATE-RISK-BENEFIT-BALANCE", state: "pass", note: "Risk box visible." },
    ],
  },
  {
    id: "BM004-REVIEW-PRIVATE",
    agentSlug: "mifid-product-marketing-guard",
    label: "Private banking note needs target-market clarification",
    product: "Structured note",
    channel: "Email",
    segment: "Private banking",
    verdict: "PASS_WITH_REVIEW",
    summary: "Potentially eligible segment but distribution wording needs tightening.",
    expectedOutput: "Restrict distribution language to eligible target market and add complexity note.",
    workbook: "NEURAL_AGBM004_MiFIDProductMarketingGuard.xlsx",
    gates: [
      { id: "GATE-MIFID-TARGET-MARKET", state: "review", note: "Eligibility language too broad." },
      { id: "GATE-PRIIPS-KID-CONSISTENCY", state: "pass", note: "KID consistency OK." },
      { id: "GATE-HITL-COMPLIANCE", state: "pass", note: "Private banking compliance review logged." },
    ],
  },
  {
    id: "BM004-BLOCK-CRYPTO",
    agentSlug: "mifid-product-marketing-guard",
    label: "Crypto-linked note promoted to broad retail audience",
    product: "Crypto-linked note",
    channel: "Landing page",
    segment: "Retail",
    verdict: "BLOCK",
    summary: "MiFID, PRIIPs and MiCA gates fail for retail public marketing.",
    expectedOutput: "Block broad retail campaign and require MiFID/MiCA remediation pack.",
    workbook: "NEURAL_AGBM004_MiFIDProductMarketingGuard.xlsx",
    gates: [
      { id: "GATE-AMF-ACPR-CLEAR-NOT-MISLEADING", state: "block", note: "Retail headline hides complexity." },
      { id: "GATE-MIFID-TARGET-MARKET", state: "block", note: "Target market mismatch." },
      { id: "GATE-PRIIPS-KID-CONSISTENCY", state: "block", note: "KID consistency not proven." },
      { id: "GATE-MICA-CRYPTO-MARKETING", state: "block", note: "MiCA notice missing." },
    ],
  },
];

export const BANK_MKT_PROBLEMS = [
  {
    problem: "Conformite reglementaire des communications",
    solution:
      "BankMarketingComplianceGuard verifie automatiquement chaque campagne contre les exigences AMF/ACPR, mentions, chiffres et equilibre risques/benefices.",
    agent: "AG-BM001",
  },
  {
    problem: "Education financiere",
    solution:
      "FinLiteracyContent produit du contenu pedagogique source sans glisser vers le conseil personnalise.",
    agent: "AG-BM002",
  },
  {
    problem: "Marketing differencie par segment client",
    solution:
      "SegmentedBankMarketing adapte le discours par segment et canal avec consentement, profiling et disclosure IA visibles.",
    agent: "AG-BM003",
  },
  {
    problem: "MiFID II compliance marketing",
    solution:
      "MiFIDProductMarketingGuard controle target market, KID PRIIPs, produits complexes et communications crypto MiCA.",
    agent: "AG-BM004",
  },
] as const;

export function getBankMktScenarios(agentSlug: BankMktAgentSlug) {
  return BANK_MKT_SCENARIOS.filter((scenario) => scenario.agentSlug === agentSlug);
}
