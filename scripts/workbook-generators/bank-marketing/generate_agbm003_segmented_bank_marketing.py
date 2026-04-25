"""Generate AG-BM003 SegmentedBankMarketing workbook."""

from __future__ import annotations

from _styles import FILES, build_agent_workbook


def generate() -> object:
    scenarios = [
        ("BM003-PASS-APP", "Consented app push for budgeting feature", "Budget app", "APP_PUSH", "Young retail", "FR", "YES", "YES", "YES", "YES", "NA", "NA", "NA", "YES", "YES", "YES", "PASS", "Consent and AI personalization notice are present."),
        ("BM003-REVIEW-SENIOR", "Senior email personalization needs readability review", "Savings", "EMAIL", "Senior retail", "FR", "YES", "YES", "YES", "YES", "NA", "NA", "NA", "YES", "REVIEW", "YES", "PASS_WITH_REVIEW", "Vulnerable segment needs readability and pressure-wording review."),
        ("BM003-BLOCK-PROFILING", "Crypto landing page retargeted without consent", "Crypto", "LANDING_PAGE", "Crypto interest", "FR", "YES", "YES", "YES", "YES", "NA", "NA", "YES", "NO", "NO", "NO", "BLOCK", "Consentless profiling and missing AI disclosure block the campaign."),
    ]
    gates = [
        ("GATE-GDPR-CONSENT-PROFILING", "GDPR consent and profiling basis", "CRITICAL", "YES", "SRC-CNIL-PROF-001", "DPO", "Marketing personalization needs legal basis."),
        ("GATE-AI-ACT-DISCLOSURE", "AI Act transparency disclosure", "HIGH", "YES", "SRC-EU-AIACT-001", "DPO + Marketing", "AI-assisted public personalization needs disclosure when applicable."),
        ("GATE-AMF-ACPR-CLEAR-NOT-MISLEADING", "Clear and non-misleading segment copy", "CRITICAL", "YES", "SRC-AMF-ACPR-PUB-001", "Marketing Compliance", "Adapted wording cannot remove material risks."),
        ("GATE-HITL-COMPLIANCE", "Human compliance approval", "CRITICAL", "YES", "internal", "Compliance", "Segmented campaigns require named approval."),
    ]
    signals = [
        ("BM003-SIG-001", "lookalike crypto audience", "profiling", "CRITICAL", "BLOCK", "High-risk interest inference needs consent and review."),
        ("BM003-SIG-002", "senior urgency", "vulnerable", "HIGH", "REVIEW", "Avoid pressure tactics for vulnerable clients."),
        ("BM003-SIG-003", "AI-selected offer", "ai", "HIGH", "REVIEW", "Explain personalization and human support."),
        ("BM003-SIG-004", "SMS acquisition", "channel", "HIGH", "REVIEW", "Consent and opt-out must be explicit."),
    ]
    outputs = [
        ("OUT-BM003-001", "BM003-PASS-APP", "Adapted copy", "Send concise app push with link to full disclosure and opt-out path.", "CRM Marketing"),
        ("OUT-BM003-002", "BM003-REVIEW-SENIOR", "Review brief", "Simplify sentence length and remove urgency before compliance approval.", "DPO + Compliance"),
        ("OUT-BM003-003", "BM003-BLOCK-PROFILING", "Block notice", "Stop campaign until consent basis, AI disclosure and crypto risk gates are fixed.", "DPO"),
    ]
    learnings = [
        ("LRN-001", "Consent", "Segmentation is the place where marketing value and regulatory risk meet.", "Add consent matrix to site demo.", "OPEN"),
        ("LRN-002", "Vulnerable clients", "Senior targeting needs a softer copy and review gate.", "Add pressure-wording classifier later.", "OPEN"),
        ("LRN-003", "AI disclosure", "The August 2026 AI Act milestone should be explicit in portfolio materials.", "Add date-aware gate in V1.", "OPEN"),
    ]
    return build_agent_workbook(
        filename=FILES["agbm003"],
        agent_id="AG-BM003",
        agent_name="SegmentedBankMarketing",
        mission="Adapt bank marketing by segment while preserving consent, fairness and explainability",
        owner="CRM Marketing + DPO",
        scenarios=scenarios,
        gate_rows=gates,
        signal_rows=signals,
        output_rows=outputs,
        learning_rows=learnings,
    )


if __name__ == "__main__":
    print(generate())
