"""Generate NEURAL Insurance Supply Chain foundations workbook."""

from __future__ import annotations

from _styles import (
    FILES,
    MVP_GATES,
    REF_DATE,
    SOURCE_STATUS,
    VERDICTS,
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
        "NEURAL Insurance Supply Chain Foundations",
        "Regulatory and operational sourcebook for insurance supply chain agents",
        "Assurances - Supply Chain",
    )

    readme_sheet(
        wb,
        "FOUNDATIONS",
        "Shared sourcebook, gates and scenario taxonomy",
        [
            ("Scope", "Repair networks, experts, supplier fraud and Sapin II third-party compliance."),
            ("Status", "Portfolio workbook with synthetic data as of 2026-04-25."),
            ("Guardrail", "No real policyholder, repairer, expert or supplier data."),
            ("Next", "Site integration only after Excel foundations are stable."),
        ],
    )
    param_sheet(
        wb,
        "tblParamsInsuranceSCFoundations",
        [
            ("BRANCH", "Assurances - Supply Chain", ""),
            ("REF_DATE", REF_DATE, "Information watch reference date."),
            ("AGENTS", "ISC-A001..ISC-A004", "ISC-A005 and ISC-A006 reserved services."),
            ("DATA_MODE", "synthetic", "Recruiter/portfolio only."),
            ("MVP_GATES", ",".join(MVP_GATES), ""),
        ],
    )

    ws = wb.create_sheet("2_SOURCEBOOK")
    title(ws, "SOURCEBOOK", "Public legal, regulatory and market watch sources", 9)
    headers(ws, 4, ["SOURCE_ID", "DOMAIN", "TITLE", "AUTHORITY", "DATE", "STATUS", "URL", "USED_BY", "DESIGN_IMPACT"], [24, 20, 46, 24, 14, 12, 72, 28, 80])
    rows = [
        ("SRC-ACPR-DORA-001", "DORA", "Register of information for ICT suppliers", "ACPR", "2025-04-11", "ACTIVE", "https://acpr.banque-france.fr/fr/actualites/remise-des-registres-dinformation", "ISC-A005, ISC-A006", "ICT service providers need inventory, criticality and continuity evidence."),
        ("SRC-ACPR-OUT-001", "OUTSOURCING", "Critical or important outsourcing for insurers", "ACPR", "2025-01-03", "ACTIVE", "https://acpr.banque-france.fr/fr/professionnels/lacpr-vous-accompagne/assurance/faire-evoluer-ma-societe/transmission-dinformation/externalisation-dactivite-importante", "all", "Critical externalized functions need prior notification, cost, exit and continuity analysis."),
        ("SRC-CODE-ASS-001", "REPAIR", "Free choice of repairer in motor insurance", "Legifrance", "2014-03-19", "ACTIVE", "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000028742662", "ISC-A001", "Agent must recommend, not force, an approved repairer."),
        ("SRC-DGCCRF-REP-001", "REPAIR", "Repair order, estimate, delays and PIEC choice", "DGCCRF", "2022-06-30", "ACTIVE", "https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques-et-les-faq/vehicule-automobile-lordre-de-reparation-decrit-la-nature", "ISC-A001, ISC-A003", "Repair evidence pack checks estimate, delay, parts and consumer information."),
        ("SRC-ROUTE-EXP-001", "EXPERT", "Automotive expert rules and report content", "Legifrance", "2026-04-25", "ACTIVE", "https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006074228/LEGISCTA000006159591/", "ISC-A002", "Expert report must include identity, operations, persons present, documents and conclusions."),
        ("SRC-AFA-REC-001", "SAPIN2", "AFA updated recommendations", "AFA", "2021-01-12", "ACTIVE", "https://www.agence-francaise-anticorruption.gouv.fr/fr/lafa-publie-nouvelles-recommandations", "ISC-A004", "Third-party evaluation, risk map, controls and remediation are core checks."),
        ("SRC-AFA-INDEX-001", "SAPIN2", "Country corruption exposure indices", "AFA", "2023-05-16", "ACTIVE", "https://www.agence-francaise-anticorruption.gouv.fr/fr/indices-mesure-lexposition-dun-etat-ou-dun-territoire-au-risque-corruption-comment-sy-retrouver", "ISC-A004", "Jurisdiction risk is a feature in supplier due diligence."),
        ("SRC-CNIL-AI-001", "GDPR", "AI, GDPR and automated decisions", "CNIL", "2026-04-25", "ACTIVE", "https://www.cnil.fr/fr/intelligence-artificielle/ia-comment-etre-en-conformite-avec-le-rgpd", "ISC-A003", "Fraud flags cannot become adverse automated decisions without safeguards and human review."),
        ("SRC-ALFA-2024-001", "FRAUD", "Insurance fraud key figures 2024", "ALFA", "2025-12-11", "ACTIVE", "https://www.alfa.asso.fr/", "ISC-A003", "Fraud is material: ALFA reports 902M EUR total identified fraud and 656M EUR IARD in 2024."),
        ("SRC-ACPR-AIACT-001", "AI_ACT", "AI Act preparation in financial sector", "ACPR", "2025-06-25", "ACTIVE", "https://acpr.banque-france.fr/fr/actualites/reglement-europeen-sur-lintelligence-artificielle-comment-lacpr-se-prepare-t-elle", "all", "High-risk AI governance expectations reinforce transparency, human oversight and auditability."),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblInsuranceSCSourcebook", 4, last, 9)
    add_list_validation(ws, 6, 5, last, SOURCE_STATUS)
    finish_sheet(ws)

    ws = wb.create_sheet("3_GATE_REGISTRY")
    title(ws, "GATE REGISTRY", "MVP gates shared by Insurance Supply Chain agents", 8)
    headers(ws, 4, ["GATE_ID", "LABEL", "APPLIES_TO", "SEVERITY", "BLOCKING", "SOURCE_REF", "OWNER", "CONTROL_LOGIC"], [32, 46, 28, 14, 12, 26, 24, 84])
    rows = [
        ("GATE-REPAIRER-FREE-CHOICE", "Free choice of repairer disclosed", "ISC-A001", "CRITICAL", "YES", "SRC-CODE-ASS-001", "Claims Legal", "Block if the workflow pushes an approved repairer without free-choice disclosure."),
        ("GATE-EXPERT-MANDATE", "Written mandate present when required", "ISC-A002", "CRITICAL", "YES", "SRC-ROUTE-EXP-001", "Claims Ops", "Block if expert action substitutes for owner without written mandate."),
        ("GATE-REPORT-COMPLETE", "Expert report completeness", "ISC-A002", "HIGH", "NO", "SRC-ROUTE-EXP-001", "Claims Ops", "Review if mandatory report elements are missing."),
        ("GATE-INVOICE-ANOMALY", "Invoice or estimate anomaly", "ISC-A001, ISC-A003", "HIGH", "NO", "SRC-DGCCRF-REP-001", "Fraud", "Review price, delay, parts or duplicate-line anomalies."),
        ("GATE-COLLUSION-REVIEW", "Potential supplier collusion", "ISC-A003, ISC-A004", "CRITICAL", "YES", "SRC-ALFA-2024-001", "Fraud", "Block if collusion signal exists without human investigation."),
        ("GATE-HITL-FRAUD", "Human review for fraud action", "ISC-A003", "CRITICAL", "YES", "SRC-CNIL-AI-001", "Fraud + Legal", "No automatic adverse fraud decision."),
        ("GATE-GDPR-AUTO-DECISION", "GDPR automated decision safeguard", "ISC-A003", "CRITICAL", "YES", "SRC-CNIL-AI-001", "DPO", "Block personal-data automated decision without HITL and explanation."),
        ("GATE-SAPIN2-THIRD-PARTY", "Third-party due diligence completed", "ISC-A004", "CRITICAL", "YES", "SRC-AFA-REC-001", "Compliance", "Block onboarding or renewal when third-party evaluation is missing."),
        ("GATE-DORA-ICT-THIRD-PARTY", "ICT third-party criticality checked", "ISC-A005, ISC-A006", "HIGH", "NO", "SRC-ACPR-DORA-001", "Risk", "Review if platform/provider supports important functions."),
        ("GATE-SOURCE-ACTIVE", "Source evidence active", "all", "HIGH", "YES", "2_SOURCEBOOK", "AI Ops", "Block if evidence source is stale or missing."),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblInsuranceSCGateRegistry", 4, last, 8)
    finish_sheet(ws)

    ws = wb.create_sheet("4_PROVIDER_TYPOLOGY")
    title(ws, "PROVIDER TYPOLOGY", "Supplier types and control expectations", 8)
    headers(ws, 4, ["PROVIDER_TYPE", "EXAMPLES", "CLAIM_LINES", "CRITICALITY", "DORA_SCOPE", "SAPIN2_SCOPE", "MAIN_RISK", "PRIMARY_AGENT"], [24, 44, 24, 14, 12, 12, 70, 20])
    rows = [
        ("Approved repairer", "Body shop, plumber, roofer", "auto, home", "MEDIUM", "NO", "YES", "Overbilling, delay, quality issue, network concentration.", "ISC-A001"),
        ("Independent repairer", "Repairer chosen by policyholder", "auto, home", "LOW", "NO", "YES", "Free-choice handling, documentation mismatch.", "ISC-A001"),
        ("Automotive expert", "Registered expert, remote expert", "auto", "HIGH", "NO", "YES", "Mandate, report quality, conflict of interest.", "ISC-A002"),
        ("Loss adjuster", "Home claim adjuster", "home", "HIGH", "NO", "YES", "Incomplete report or bias in settlement estimate.", "ISC-A002"),
        ("Fraud analytics vendor", "OCR, anomaly detection, graph scoring", "all", "HIGH", "YES", "YES", "Automated adverse decision, model drift, data minimization.", "ISC-A003"),
        ("Supplier platform", "Dispatching, repair marketplace", "auto, home", "HIGH", "YES", "YES", "Continuity, concentration, exit plan and audit rights.", "ISC-A005"),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblInsuranceSCProviderTypology", 4, last, 8)
    finish_sheet(ws)

    ws = wb.create_sheet("5_REPAIR_NETWORK_RULES")
    title(ws, "REPAIR NETWORK RULES", "Operational rules for repairer recommendation and quality follow-up", 7)
    headers(ws, 4, ["RULE_ID", "RULE", "SEVERITY", "EVIDENCE", "PASS_CONDITION", "FAIL_ACTION", "SOURCE_REF"], [16, 48, 14, 46, 52, 42, 24])
    rows = [
        ("REP-001", "Policyholder free choice is disclosed", "CRITICAL", "Claim notice or call script flag", "choice_disclosed=YES", "BLOCK output and request correction", "SRC-CODE-ASS-001"),
        ("REP-002", "Repair estimate has scope, cost and delay", "HIGH", "Order or estimate fields", "scope/cost/delay present", "REVIEW with repair network owner", "SRC-DGCCRF-REP-001"),
        ("REP-003", "PIEC or parts information captured when relevant", "MEDIUM", "Parts declaration", "parts_choice documented", "REVIEW evidence pack", "SRC-DGCCRF-REP-001"),
        ("REP-004", "Quality issue creates follow-up case", "HIGH", "Post-repair survey, complaint", "quality_score above threshold", "REVIEW or suspend assignment", "internal"),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblInsuranceSCRepairRules", 4, last, 7)
    finish_sheet(ws)

    ws = wb.create_sheet("6_EXPERTISE_RULES")
    title(ws, "EXPERTISE RULES", "Expert dispatching, mandate and report completeness checks", 7)
    headers(ws, 4, ["RULE_ID", "RULE", "SEVERITY", "EVIDENCE", "PASS_CONDITION", "FAIL_ACTION", "SOURCE_REF"], [16, 50, 14, 46, 52, 42, 24])
    rows = [
        ("EXP-001", "Written mandate required when expert acts for owner", "CRITICAL", "Mandate id and date", "mandate_present=YES or NA", "BLOCK workflow", "SRC-ROUTE-EXP-001"),
        ("EXP-002", "Report includes expert identity and operations", "HIGH", "Report fields", "mandatory fields present", "REVIEW report", "SRC-ROUTE-EXP-001"),
        ("EXP-003", "Dangerous defect is disclosed in report", "CRITICAL", "Defect flag", "defect notice recorded", "BLOCK closure until confirmed", "SRC-ROUTE-EXP-001"),
        ("EXP-004", "Contestations are logged", "HIGH", "Dispute id", "dispute notice exists", "REVIEW by claims ops", "SRC-ROUTE-EXP-001"),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblInsuranceSCExpertRules", 4, last, 7)
    finish_sheet(ws)

    ws = wb.create_sheet("7_FRAUD_SIGNALS")
    title(ws, "FRAUD SIGNALS", "Supplier and invoice anomaly patterns for human investigation", 7)
    headers(ws, 4, ["SIGNAL_ID", "SIGNAL", "CATEGORY", "SEVERITY", "HITL_REQUIRED", "ACTION", "EXPLANATION"], [16, 42, 20, 14, 16, 24, 78])
    rows = [
        ("FRD-001", "Duplicate invoice numbers across repairers", "invoice", "HIGH", "YES", "REVIEW", "Potential duplicate billing or document reuse."),
        ("FRD-002", "Repeated assignment loop expert-repairer", "collusion", "CRITICAL", "YES", "REVIEW", "Potential collusion signal, never auto-sanction."),
        ("FRD-003", "Estimate above peer benchmark", "pricing", "HIGH", "YES", "REVIEW", "Requires peer benchmark and human validation."),
        ("FRD-004", "Automated denial based on score only", "gdpr", "CRITICAL", "YES", "BLOCK", "Forbidden design for portfolio MVP."),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblInsuranceSCFraudSignals", 4, last, 7)
    finish_sheet(ws)

    ws = wb.create_sheet("8_SAPIN2_THIRD_PARTY")
    title(ws, "SAPIN II THIRD PARTY", "Due diligence controls for suppliers and intermediaries", 8)
    headers(ws, 4, ["CONTROL_ID", "CONTROL", "RISK_FACTOR", "SEVERITY", "EVIDENCE", "PASS_CONDITION", "FAIL_ACTION", "SOURCE_REF"], [18, 44, 28, 14, 40, 46, 42, 24])
    rows = [
        ("S2-001", "Third-party identity and beneficial owner", "opacity", "HIGH", "KYS file", "identity_complete=YES", "REVIEW or block onboarding", "SRC-AFA-REC-001"),
        ("S2-002", "Country corruption exposure", "jurisdiction", "HIGH", "country index", "country risk scored", "Enhanced due diligence", "SRC-AFA-INDEX-001"),
        ("S2-003", "Conflict of interest declaration", "relationship", "HIGH", "COI declaration", "coi_clear=YES", "Compliance review", "SRC-AFA-REC-001"),
        ("S2-004", "Accounting control on unusual payments", "payment", "CRITICAL", "invoice/payment match", "no unsupported payment", "BLOCK payment pending review", "SRC-AFA-REC-001"),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblInsuranceSCSapin2", 4, last, 8)
    finish_sheet(ws)

    ws = wb.create_sheet("9_REG_WATCH_SEEDS")
    title(ws, "REG WATCH SEEDS", "Initial watch topics for ISC-A005 InsurRegWatch", 7)
    headers(ws, 4, ["WATCH_ID", "SOURCE_ID", "TOPIC", "LAST_CHECK", "PRIORITY_SCORE", "AFFECTED_AGENTS", "STATUS"], [16, 24, 44, 14, 16, 32, 14])
    rows = [
        ("WATCH-001", "SRC-ACPR-DORA-001", "DORA supplier register and critical ICT providers", "2026-04-25", 0.90, "ISC-A005, ISC-A006", "ACTIVE"),
        ("WATCH-002", "SRC-CODE-ASS-001", "Free choice wording for motor claims", "2026-04-25", 0.85, "ISC-A001", "ACTIVE"),
        ("WATCH-003", "SRC-CNIL-AI-001", "Automated fraud decision safeguards", "2026-04-25", 0.92, "ISC-A003", "ACTIVE"),
        ("WATCH-004", "SRC-AFA-REC-001", "Third-party evaluation and accounting controls", "2026-04-25", 0.88, "ISC-A004", "ACTIVE"),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblInsuranceSCRegWatch", 4, last, 7)
    finish_sheet(ws)

    ws = wb.create_sheet("10_TESTSET_INDEX")
    title(ws, "TESTSET INDEX", "Scenario coverage expected from each agent workbook", 6)
    headers(ws, 4, ["AGENT_ID", "PASS_CASE", "REVIEW_CASE", "BLOCK_CASE", "EXPECTED_SET", "NOTE"], [16, 22, 22, 22, 34, 80])
    rows = [
        ("ISC-A001", "REP-PASS-CHOICE", "REP-REVIEW-INVOICE", "REP-BLOCK-NOCHOICE", ", ".join(VERDICTS), "Repair network covers free choice and invoice anomaly."),
        ("ISC-A002", "EXP-PASS-REPORT", "EXP-REVIEW-INCOMPLETE", "EXP-BLOCK-MANDATE", ", ".join(VERDICTS), "Expert management covers mandate and report completeness."),
        ("ISC-A003", "FRD-PASS-TRIAGE", "FRD-REVIEW-COLLUSION", "FRD-BLOCK-AUTODECISION", ", ".join(VERDICTS), "Fraud detection covers human review and GDPR automated decision risk."),
        ("ISC-A004", "S2-PASS-DUE", "S2-REVIEW-HIGHRISK", "S2-BLOCK-MISSING", ", ".join(VERDICTS), "Sapin II covers due diligence, risk mapping and enhanced review."),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblInsuranceSCTestsetIndex", 4, last, 6)
    finish_sheet(ws)

    ws = wb.create_sheet("11_CHANGELOG")
    title(ws, "CHANGELOG", "Portfolio build log", 5)
    headers(ws, 4, ["VERSION", "DATE", "CHANGE", "AUTHOR", "STATUS"], [16, 14, 92, 20, 16])
    rows = [
        ("v0.1", REF_DATE, "Initial insurance supply chain foundations: repairer choice, expert mandate, fraud HITL, Sapin II, DORA.", "NEURAL", "DRAFT"),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblInsuranceSCChangelog", 4, last, 5)
    finish_sheet(ws)

    return save_workbook(wb, FILES["foundations"])


if __name__ == "__main__":
    print(generate())
