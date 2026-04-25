"""Generate NEURAL Insurance Supply Chain master workbook."""

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
        "NEURAL Insurance Supply Chain Master",
        "Agent registry and workflow architecture",
        "Assurances - Supply Chain",
    )

    readme_sheet(
        wb,
        "MASTER",
        "Portfolio master workbook for insurance supply chain agents",
        [
            ("Scope", "Four MVP agents plus two reserved services."),
            ("Architecture", "Excel-first foundations, then future site exposure."),
            ("Safety", "No auto-denial of claims, no real personal data."),
            ("Isolation", "Does not depend on luxe-comms or aero-comms workbooks."),
        ],
    )
    param_sheet(
        wb,
        "tblParamsInsuranceSCMaster",
        [
            ("BRANCH", "Assurances - Supply Chain", ""),
            ("REF_DATE", REF_DATE, ""),
            ("AGENT_RANGE", "ISC-A001..ISC-A006", "ISC-A005 and ISC-A006 are reserved services."),
            ("MVP_GATES", ",".join(MVP_GATES), ""),
            ("OUTPUT_FOLDER", "apps/neural/data/insurance-supply-chain", ""),
        ],
    )

    ws = wb.create_sheet("2_AGENT_REGISTRY")
    title(ws, "AGENT REGISTRY", "Agents, reserved services and implementation status", 10)
    headers(ws, 4, ["AGENT_ID", "SLUG", "NAME", "TYPE", "PRIORITY", "SLA_HOURS", "OWNER", "STATUS", "PRIMARY_GATES", "MISSION"], [16, 30, 34, 14, 12, 12, 24, 14, 56, 86])
    rows = [
        ("ISC-A001", "repair-network-insur", "RepairNetworkInsur", "agent", "MVP", 24, "Claims Supply Chain", "demo", "GATE-REPAIRER-FREE-CHOICE,GATE-INVOICE-ANOMALY,GATE-SOURCE-ACTIVE", "Steer approved and independent repairer networks while preserving policyholder free choice."),
        ("ISC-A002", "expert-mgmt-insur", "ExpertMgmtInsur", "agent", "MVP", 24, "Claims Expertise", "demo", "GATE-EXPERT-MANDATE,GATE-REPORT-COMPLETE,GATE-SOURCE-ACTIVE", "Dispatch experts, check report completeness and flag contestations or mandate gaps."),
        ("ISC-A003", "fraud-detect-sc", "FraudDetectSC", "agent", "MVP", 4, "Fraud + DPO", "demo", "GATE-INVOICE-ANOMALY,GATE-COLLUSION-REVIEW,GATE-GDPR-AUTO-DECISION,GATE-HITL-FRAUD", "Detect supplier overbilling, collusion and false invoices as human-review alerts only."),
        ("ISC-A004", "sapin2-compliance", "Sapin2Compliance", "agent", "MVP", 48, "Compliance", "demo", "GATE-SAPIN2-THIRD-PARTY,GATE-COLLUSION-REVIEW,GATE-SOURCE-ACTIVE", "Verify third-party due diligence, corruption risk mapping and accounting-control evidence."),
        ("ISC-A005", "insur-reg-watch", "InsurRegWatch", "service", "MVP", "", "Compliance Ops", "planned", "GATE-SOURCE-ACTIVE", "Reserved service for ACPR, CNIL, AFA, DGCCRF and Legifrance watch."),
        ("ISC-A006", "insur-evidence-vault", "InsurEvidenceVault", "service", "MVP", "", "AI Ops", "planned", "GATE-DORA-ICT-THIRD-PARTY,GATE-SOURCE-ACTIVE", "Reserved deterministic source resolver and evidence vault."),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblInsuranceSCAgentRegistry", 4, last, 10)
    add_list_validation(ws, 5, 5, last, PRIORITY)
    add_list_validation(ws, 8, 5, last, AGENT_STATUS)
    finish_sheet(ws)

    ws = wb.create_sheet("3_WORKFLOW_MAP")
    title(ws, "WORKFLOW MAP", "From claim intake to compliant supplier action", 8)
    headers(ws, 4, ["STEP", "PHASE", "OWNER", "INPUT", "OUTPUT", "HITL", "SYSTEM_OF_RECORD", "NOTE"], [8, 24, 24, 36, 40, 12, 30, 80])
    rows = [
        (1, "INTAKE", "Claims platform", "Claim, supplier, documents", "Normalized scenario id", "NO", "Claims core", "No personal data is needed for portfolio workbooks."),
        (2, "EVIDENCE", "ISC-A006", "Source ids, supplier ids", "Evidence pack", "NO", "Evidence vault", "Resolve active source before generation."),
        (3, "REPAIR/EXPERT", "ISC-A001/ISC-A002", "Claim line and documents", "Recommendation or report check", "YES", "Claims ops", "Repairer recommendation must preserve free choice."),
        (4, "FRAUD", "ISC-A003", "Invoice and graph signals", "Alert only", "YES", "Fraud case tool", "No automatic adverse decision."),
        (5, "COMPLIANCE", "ISC-A004", "Supplier due diligence", "Pass/review/block gate", "YES", "Compliance tool", "Sapin II blocks onboarding if due diligence is missing."),
        (6, "WATCH", "ISC-A005", "Regulatory feeds", "Watch digest", "NO", "Reg watch log", "Sources stay dated and active."),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblInsuranceSCWorkflowMap", 4, last, 8)
    add_list_validation(ws, 6, 5, last, YES_NO)
    finish_sheet(ws)

    ws = wb.create_sheet("4_GATE_REGISTRY")
    title(ws, "GATE REGISTRY", "Master view of MVP deterministic gates", 7)
    headers(ws, 4, ["GATE_ID", "LABEL", "SEVERITY", "BLOCKING", "APPLIES_TO", "SOURCE_REF", "CONTROL"], [32, 46, 14, 12, 30, 26, 84])
    rows = [
        ("GATE-REPAIRER-FREE-CHOICE", "Free choice of repairer disclosed", "CRITICAL", "YES", "ISC-A001", "SRC-CODE-ASS-001", "Block forced-network wording."),
        ("GATE-EXPERT-MANDATE", "Written expert mandate present", "CRITICAL", "YES", "ISC-A002", "SRC-ROUTE-EXP-001", "Block if mandatory mandate is missing."),
        ("GATE-REPORT-COMPLETE", "Expert report completeness", "HIGH", "NO", "ISC-A002", "SRC-ROUTE-EXP-001", "Review incomplete report."),
        ("GATE-INVOICE-ANOMALY", "Invoice or estimate anomaly", "HIGH", "NO", "ISC-A001,ISC-A003", "SRC-DGCCRF-REP-001", "Review price, duplicate, parts or delay anomaly."),
        ("GATE-COLLUSION-REVIEW", "Collusion signal reviewed", "CRITICAL", "YES", "ISC-A003,ISC-A004", "SRC-ALFA-2024-001", "Block only if no HITL review path exists."),
        ("GATE-HITL-FRAUD", "Human review for fraud action", "CRITICAL", "YES", "ISC-A003", "SRC-CNIL-AI-001", "Fraud outputs are alerts, not final sanctions."),
        ("GATE-GDPR-AUTO-DECISION", "GDPR automated decision safeguards", "CRITICAL", "YES", "ISC-A003", "SRC-CNIL-AI-001", "Block personal-data automated adverse decisions."),
        ("GATE-SAPIN2-THIRD-PARTY", "Third-party due diligence", "CRITICAL", "YES", "ISC-A004", "SRC-AFA-REC-001", "Block missing third-party evaluation."),
        ("GATE-DORA-ICT-THIRD-PARTY", "ICT third-party criticality", "HIGH", "NO", "ISC-A005,ISC-A006", "SRC-ACPR-DORA-001", "Review critical ICT provider dependencies."),
        ("GATE-SOURCE-ACTIVE", "Source evidence active", "HIGH", "YES", "all", "2_SOURCEBOOK", "Block stale or missing source evidence."),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblInsuranceSCMasterGates", 4, last, 7)
    add_list_validation(ws, 4, 5, last, YES_NO)
    finish_sheet(ws)

    ws = wb.create_sheet("5_RISK_REGISTER")
    title(ws, "RISK REGISTER", "Portfolio risk register and mitigation plan", 7)
    headers(ws, 4, ["RISK_ID", "RISK", "IMPACT", "LIKELIHOOD", "SCORE", "MITIGATION", "OWNER"], [16, 54, 12, 14, 12, 74, 22])
    rows = [
        ("RISK-ISC-001", "Repairer network recommendation violates free choice", 5, 2, "=C5*D5", "GATE-REPAIRER-FREE-CHOICE and neutral recommendation wording", "Claims Legal"),
        ("RISK-ISC-002", "Expert report incomplete or mandate missing", 4, 3, "=C6*D6", "GATE-EXPERT-MANDATE and GATE-REPORT-COMPLETE", "Claims Ops"),
        ("RISK-ISC-003", "Fraud score creates automated adverse decision", 5, 3, "=C7*D7", "GATE-GDPR-AUTO-DECISION and HITL fraud workflow", "Fraud + DPO"),
        ("RISK-ISC-004", "Supplier corruption risk not assessed", 5, 2, "=C8*D8", "GATE-SAPIN2-THIRD-PARTY", "Compliance"),
        ("RISK-ISC-005", "Critical ICT dependency not inventoried", 4, 3, "=C9*D9", "DORA supplier register and exit-plan readiness", "Risk"),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblInsuranceSCRiskRegister", 4, last, 7)
    finish_sheet(ws)

    ws = wb.create_sheet("6_KPI_DASHBOARD")
    title(ws, "KPI DASHBOARD", "Roll-up formulas for recruiter demo", 4)
    headers(ws, 4, ["KPI", "VALUE", "SOURCE", "STATUS"], [34, 18, 52, 18])
    rows = [
        ("Public agents", '=COUNTIF(\'2_AGENT_REGISTRY\'!D:D,"agent")', "2_AGENT_REGISTRY", "OK"),
        ("Reserved services", '=COUNTIF(\'2_AGENT_REGISTRY\'!D:D,"service")', "2_AGENT_REGISTRY", "OK"),
        ("MVP gates", "=COUNTA('4_GATE_REGISTRY'!A5:A50)", "4_GATE_REGISTRY", "OK"),
        ("Blocking gates", '=COUNTIF(\'4_GATE_REGISTRY\'!D:D,"YES")', "4_GATE_REGISTRY", "OK"),
        ("Risk score total", "=SUM('5_RISK_REGISTER'!E5:E20)", "5_RISK_REGISTER", "OK"),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblInsuranceSCKpiDashboard", 4, last, 4)
    finish_sheet(ws)

    ws = wb.create_sheet("7_EXPORT_READINESS")
    title(ws, "EXPORT READINESS", "What later site integration must consume", 6)
    headers(ws, 4, ["OBJECT", "READY", "PATH_OR_TABLE", "OWNER", "BLOCKER", "NOTE"], [28, 12, 48, 24, 34, 78])
    rows = [
        ("Foundations sourcebook", "YES", "NEURAL_INSURANCE_SC_FOUNDATIONS.xlsx/2_SOURCEBOOK", "AI Ops", "", "Static source ids for demos."),
        ("Agent registry", "YES", "NEURAL_INSURANCE_SC_MASTER.xlsx/2_AGENT_REGISTRY", "Product", "", "Can feed future cards."),
        ("Scenario decisions", "YES", "Agent workbooks/5_SCORING_ENGINE", "AI Ops", "", "Formula-backed expected decisions."),
        ("Public site page", "NO", "apps/neural/content/insurance-supply-chain", "Product", "Not in this step", "Implement after recruiter Excel review."),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblInsuranceSCExportReadiness", 4, last, 6)
    add_list_validation(ws, 2, 5, last, YES_NO)
    finish_sheet(ws)

    return save_workbook(wb, FILES["master"])


if __name__ == "__main__":
    print(generate())
