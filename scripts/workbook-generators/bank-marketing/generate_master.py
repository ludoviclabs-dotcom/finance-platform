"""Generate NEURAL Banque Marketing master workbook."""

from __future__ import annotations

from _styles import (
    AGENT_STATUS,
    FILES,
    MVP_GATES,
    PRIORITY,
    REF_DATE,
    YES_NO,
    add_list_validation,
    finish_sheet,
    headers,
    make_table,
    make_workbook,
    param_sheet,
    readme_sheet,
    save_workbook,
    title,
    write_rows,
)


def generate() -> object:
    wb = make_workbook(
        "NEURAL Banque Marketing Master",
        "Agent registry and workflow architecture",
    )

    readme_sheet(
        wb,
        "MASTER",
        "Portfolio master workbook for Banque Marketing agents",
        [
            ("Scope", "Four MVP agents plus two reserved services."),
            ("Architecture", "Excel-first foundations, then future site exposure."),
            ("Safety", "No personalized financial advice, no real client data."),
            ("Isolation", "Does not depend on bank-comms, luxe-comms, aero-comms or insurance-supply-chain workbooks."),
        ],
    )
    param_sheet(
        wb,
        "tblParamsBankMarketingMaster",
        [
            ("BRANCH", "Banque - Marketing", ""),
            ("REF_DATE", REF_DATE, ""),
            ("AGENT_RANGE", "AG-BM001..AG-BM006", "AG-BM005 and AG-BM006 are reserved services."),
            ("MVP_GATES", ",".join(MVP_GATES), ""),
            ("OUTPUT_FOLDER", "apps/neural/data/bank-marketing", ""),
        ],
    )

    ws = wb.create_sheet("2_AGENT_REGISTRY")
    title(ws, "AGENT REGISTRY", "Agents, reserved services and implementation status", 10)
    headers(ws, 4, ["AGENT_ID", "SLUG", "NAME", "TYPE", "PRIORITY", "SLA_HOURS", "OWNER", "STATUS", "PRIMARY_GATES", "MISSION"], [16, 34, 38, 14, 12, 12, 24, 14, 64, 92])
    rows = [
        ("AG-BM001", "bank-marketing-compliance-guard", "BankMarketingComplianceGuard", "agent", "MVP", 24, "Marketing Compliance", "demo", "GATE-AMF-ACPR-CLEAR-NOT-MISLEADING,GATE-RISK-BENEFIT-BALANCE,GATE-NUM-VALIDATED", "Audit banking, savings and credit marketing against AMF/ACPR advertising expectations."),
        ("AG-BM002", "fin-literacy-content", "FinLiteracyContent", "agent", "MVP", 24, "Education + Brand", "demo", "GATE-SOURCE-ACTIVE,GATE-NUM-VALIDATED,GATE-HITL-COMPLIANCE", "Produce educational content without hidden personalized advice."),
        ("AG-BM003", "segmented-bank-marketing", "SegmentedBankMarketing", "agent", "MVP", 12, "CRM Marketing + DPO", "demo", "GATE-GDPR-CONSENT-PROFILING,GATE-AI-ACT-DISCLOSURE,GATE-HITL-COMPLIANCE", "Adapt marketing by segment while preserving consent, fairness and explainability."),
        ("AG-BM004", "mifid-product-marketing-guard", "MiFIDProductMarketingGuard", "agent", "MVP", 24, "Investment Compliance", "demo", "GATE-MIFID-TARGET-MARKET,GATE-PRIIPS-KID-CONSISTENCY,GATE-MICA-CRYPTO-MARKETING", "Check investment, complex-product and crypto-asset marketing consistency."),
        ("AG-BM005", "reg-watch-evidence-bank-mktg", "RegWatchEvidenceBankMktg", "service", "MVP", "", "Compliance Ops", "planned", "GATE-SOURCE-ACTIVE", "Reserved service for AMF, ACPR, ESMA, EBA, EUR-Lex and CNIL watch."),
        ("AG-BM006", "consent-ai-dora-guard", "ConsentAIDoraGuard", "service", "MVP", "", "DPO + Risk", "planned", "GATE-GDPR-CONSENT-PROFILING,GATE-AI-ACT-DISCLOSURE", "Reserved service for consent, AI disclosure, audit trail and DORA dependencies."),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblBankMarketingAgentRegistry", 4, last, 10)
    add_list_validation(ws, 5, 5, last, PRIORITY)
    add_list_validation(ws, 8, 5, last, AGENT_STATUS)
    finish_sheet(ws)

    ws = wb.create_sheet("3_WORKFLOW_MAP")
    title(ws, "WORKFLOW MAP", "From campaign brief to compliant marketing output", 8)
    headers(ws, 4, ["STEP", "PHASE", "OWNER", "INPUT", "OUTPUT", "HITL", "SYSTEM_OF_RECORD", "NOTE"], [8, 24, 24, 38, 42, 12, 30, 88])
    rows = [
        (1, "BRIEF", "Marketing", "Campaign brief, product, channel", "Normalized scenario id", "NO", "Campaign planner", "Portfolio workbook uses synthetic scenarios only."),
        (2, "EVIDENCE", "AG-BM005", "Source ids and rule ids", "Evidence pack", "NO", "Evidence vault", "Resolve official sources before generation."),
        (3, "COPY AUDIT", "AG-BM001", "Copy, claims, numbers", "Pass/review/block verdict", "YES", "Compliance queue", "AMF/ACPR clear-not-misleading gate applies."),
        (4, "EDUCATION", "AG-BM002", "Topic and audience", "Pedagogical content", "YES", "CMS", "No personalized financial advice."),
        (5, "SEGMENTATION", "AG-BM003", "Segment, channel, consent", "Adapted campaign", "YES", "CRM", "Consent and profiling checks run before copy."),
        (6, "INVESTMENT", "AG-BM004", "Product doc, KID, white paper", "MiFID/PRIIPs/MiCA verdict", "YES", "Investment compliance", "Retail distribution restrictions can block."),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblBankMarketingWorkflowMap", 4, last, 8)
    add_list_validation(ws, 6, 5, last, YES_NO)
    finish_sheet(ws)

    ws = wb.create_sheet("4_REVIEW_GATES")
    title(ws, "REVIEW GATES", "Master view of MVP deterministic gates", 7)
    headers(ws, 4, ["GATE_ID", "LABEL", "SEVERITY", "BLOCKING", "APPLIES_TO", "SOURCE_REF", "CONTROL"], [40, 50, 14, 12, 34, 28, 88])
    rows = [
        ("GATE-AMF-ACPR-CLEAR-NOT-MISLEADING", "Clear, accurate and non-misleading communication", "CRITICAL", "YES", "AG-BM001,AG-BM004", "SRC-AMF-ACPR-PUB-001", "Block ambiguous, exaggerated or visually imbalanced messages."),
        ("GATE-RISK-BENEFIT-BALANCE", "Risk and benefit balance", "CRITICAL", "YES", "AG-BM001,AG-BM004", "SRC-AMF-ACPR-PUB-001", "Block one-sided benefit claims."),
        ("GATE-SOURCE-ACTIVE", "Source evidence active", "HIGH", "YES", "all", "2_SOURCEBOOK", "Block stale or missing regulatory evidence."),
        ("GATE-NUM-VALIDATED", "Numbers validated and dated", "HIGH", "YES", "all", "SRC-AMF-ACPR-PUB-001", "Block unsupported rates, performance or savings figures."),
        ("GATE-MIFID-TARGET-MARKET", "MiFID target market consistency", "CRITICAL", "YES", "AG-BM004", "SRC-ESMA-MIFID-001", "Block incompatible retail targeting."),
        ("GATE-PRIIPS-KID-CONSISTENCY", "PRIIPs KID consistency", "CRITICAL", "YES", "AG-BM004", "SRC-EU-PRIIPS-001", "Block contradictions with KID."),
        ("GATE-MICA-CRYPTO-MARKETING", "MiCA crypto marketing requirements", "CRITICAL", "YES", "AG-BM004", "SRC-EU-MICA-001", "Block missing white paper consistency or required notice."),
        ("GATE-GDPR-CONSENT-PROFILING", "GDPR consent and profiling basis", "CRITICAL", "YES", "AG-BM003,AG-BM006", "SRC-CNIL-PROF-001", "Block consentless profiling for marketing."),
        ("GATE-AI-ACT-DISCLOSURE", "AI Act transparency disclosure", "HIGH", "YES", "AG-BM003,AG-BM006", "SRC-EU-AIACT-001", "Block missing AI disclosure when applicable."),
        ("GATE-HITL-COMPLIANCE", "Human compliance approval", "CRITICAL", "YES", "all", "internal", "Block final publication without named approver."),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblBankMarketingMasterGates", 4, last, 7)
    add_list_validation(ws, 4, 5, last, YES_NO)
    finish_sheet(ws)

    ws = wb.create_sheet("5_RISK_REGISTER")
    title(ws, "RISK REGISTER", "Portfolio risk register and mitigation plan", 7)
    headers(ws, 4, ["RISK_ID", "RISK", "IMPACT", "LIKELIHOOD", "SCORE", "MITIGATION", "OWNER"], [18, 58, 12, 14, 12, 82, 24])
    rows = [
        ("RISK-BM-001", "Marketing message is misleading or unbalanced", 5, 3, "=C5*D5", "AMF/ACPR gates and redline output", "Compliance"),
        ("RISK-BM-002", "Educational content becomes personalized advice", 4, 3, "=C6*D6", "Education disclaimer and HITL compliance", "Education + Legal"),
        ("RISK-BM-003", "CRM segmentation uses profiling without valid basis", 5, 3, "=C7*D7", "Consent/profiling gate and DPO review", "DPO"),
        ("RISK-BM-004", "Investment campaign targets incompatible client group", 5, 2, "=C8*D8", "MiFID target-market gate", "Investment Compliance"),
        ("RISK-BM-005", "Crypto marketing omits MiCA notice or white paper consistency", 5, 2, "=C9*D9", "MiCA gate and source evidence", "Crypto Compliance"),
        ("RISK-BM-006", "AI-generated campaign lacks disclosure after applicability date", 4, 3, "=C10*D10", "AI Act disclosure gate", "DPO + Marketing"),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblBankMarketingRiskRegister", 4, last, 7)
    finish_sheet(ws)

    ws = wb.create_sheet("6_KPI_DASHBOARD")
    title(ws, "KPI DASHBOARD", "Roll-up formulas for recruiter demo", 4)
    headers(ws, 4, ["KPI", "VALUE", "SOURCE", "STATUS"], [36, 18, 54, 18])
    rows = [
        ("Public agents", '=COUNTIF(\'2_AGENT_REGISTRY\'!D:D,"agent")', "2_AGENT_REGISTRY", "OK"),
        ("Reserved services", '=COUNTIF(\'2_AGENT_REGISTRY\'!D:D,"service")', "2_AGENT_REGISTRY", "OK"),
        ("MVP gates", "=COUNTA('4_REVIEW_GATES'!A5:A50)", "4_REVIEW_GATES", "OK"),
        ("Blocking gates", '=COUNTIF(\'4_REVIEW_GATES\'!D:D,"YES")', "4_REVIEW_GATES", "OK"),
        ("Risk score total", "=SUM('5_RISK_REGISTER'!E5:E20)", "5_RISK_REGISTER", "OK"),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblBankMarketingKpiDashboard", 4, last, 4)
    finish_sheet(ws)

    ws = wb.create_sheet("7_ROADMAP")
    title(ws, "ROADMAP", "Excel foundations before site integration", 6)
    headers(ws, 4, ["SPRINT", "OBJECTIVE", "DELIVERABLE", "OWNER", "STATUS", "ACCEPTANCE"], [14, 32, 48, 22, 16, 78])
    rows = [
        ("Sprint 0", "Excel foundations", "6 workbooks + verifier", "Product", "DONE", "Generation and verification pass locally."),
        ("Sprint 1", "Portfolio review", "Recruiter-ready workbook pack", "Product", "NEXT", "Tables, formulas and synthetic scenarios are explainable."),
        ("Sprint 2", "Content sync", "content/bank-marketing JSON + sync script", "Engineering", "PLANNED", "Only after Excel foundations are approved."),
        ("Sprint 3", "NEURAL site page", "Banque Marketing console", "Frontend", "PLANNED", "Page mirrors Excel agents and scenarios."),
        ("Sprint 4", "Live agents", "Interactive audit/redline demos", "AI Engineering", "PLANNED", "HITL and evidence gates remain visible."),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblBankMarketingRoadmap", 4, last, 6)
    finish_sheet(ws)

    ws = wb.create_sheet("8_CHANGELOG")
    title(ws, "CHANGELOG", "Portfolio build log", 5)
    headers(ws, 4, ["VERSION", "DATE", "CHANGE", "AUTHOR", "STATUS"], [16, 14, 98, 20, 16])
    rows = [
        ("v0.1", REF_DATE, "Initial Banque Marketing foundations: AMF/ACPR advertising, financial education, segmentation, MiFID/PRIIPs/MiCA, GDPR, AI Act and DORA.", "NEURAL", "DRAFT"),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblBankMarketingChangelog", 4, last, 5)
    finish_sheet(ws)

    return save_workbook(wb, FILES["master"])


if __name__ == "__main__":
    print(generate())
