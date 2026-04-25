"""Generate AG-BM001 BankMarketingComplianceGuard workbook."""

from __future__ import annotations

from _styles import FILES, build_agent_workbook


def generate() -> object:
    scenarios = [
        ("BM001-PASS-LIVRET", "Livret landing page with balanced return and conditions", "Livret", "LANDING_PAGE", "Retail", "FR", "YES", "YES", "YES", "YES", "NA", "NA", "NA", "NA", "NA", "YES", "PASS", "Rate, ceiling and eligibility are visible near the CTA."),
        ("BM001-REVIEW-CREDIT", "Credit email needs clearer repayment warning", "Credit conso", "EMAIL", "Retail", "FR", "YES", "REVIEW", "YES", "YES", "NA", "NA", "NA", "NA", "NA", "YES", "PASS_WITH_REVIEW", "Mandatory warning exists but is less visible than the promotional headline."),
        ("BM001-BLOCK-RATE", "Savings banner claims guaranteed best rate without proof", "Epargne", "APP_PUSH", "Retail", "FR", "NO", "NO", "YES", "NO", "NA", "NA", "NA", "NA", "NA", "NO", "BLOCK", "Absolute superiority and unsupported number block publication."),
    ]
    gates = [
        ("GATE-AMF-ACPR-CLEAR-NOT-MISLEADING", "Clear, accurate and non-misleading communication", "CRITICAL", "YES", "SRC-AMF-ACPR-PUB-001", "Marketing Compliance", "Core AMF/ACPR advertising control."),
        ("GATE-RISK-BENEFIT-BALANCE", "Risk and benefit balance", "CRITICAL", "YES", "SRC-AMF-ACPR-PUB-001", "Marketing Compliance", "Risks cannot be hidden in footnotes."),
        ("GATE-NUM-VALIDATED", "Numbers validated and dated", "HIGH", "YES", "SRC-AMF-ACPR-PUB-001", "Data Owner", "Rates, savings and rankings need source and date."),
        ("GATE-HITL-COMPLIANCE", "Human compliance approval", "CRITICAL", "YES", "internal", "Compliance", "Publication remains a human decision."),
    ]
    signals = [
        ("BM001-SIG-001", "meilleur taux", "superiority", "HIGH", "REVIEW", "Needs proof, scope and comparison date."),
        ("BM001-SIG-002", "sans aucun risque", "absolute", "CRITICAL", "BLOCK", "Misleading for investment or savings copy."),
        ("BM001-SIG-003", "economisez jusqu'a", "number", "HIGH", "REVIEW", "Needs sample, date and conditions."),
        ("BM001-SIG-004", "offre limitee", "pressure", "MEDIUM", "REVIEW", "Pressure wording can harm vulnerable clients."),
    ]
    outputs = [
        ("OUT-BM001-001", "BM001-PASS-LIVRET", "Approval brief", "Campaign can proceed with dated rate, ceiling and eligibility evidence.", "Marketing Compliance"),
        ("OUT-BM001-002", "BM001-REVIEW-CREDIT", "Redline brief", "Move repayment warning near headline and CTA; keep APR example visible.", "Marketing Compliance"),
        ("OUT-BM001-003", "BM001-BLOCK-RATE", "Block notice", "Remove guaranteed-best-rate claim and add sourced comparison or neutral wording.", "Legal"),
    ]
    learnings = [
        ("LRN-001", "AMF/ACPR", "The most recruiter-visible value is a clear/not misleading gate backed by redlines.", "Expose source ids in future UI.", "OPEN"),
        ("LRN-002", "Numbers", "Rates and savings claims are high-risk because they look factual.", "Add numeric evidence vault in Sprint 2.", "OPEN"),
        ("LRN-003", "HITL", "Excel should prove the agent does not publish automatically.", "Mirror approval log on the site page.", "OPEN"),
    ]
    return build_agent_workbook(
        filename=FILES["agbm001"],
        agent_id="AG-BM001",
        agent_name="BankMarketingComplianceGuard",
        mission="Audit bank, savings and credit marketing against AMF/ACPR advertising principles",
        owner="Marketing Compliance",
        scenarios=scenarios,
        gate_rows=gates,
        signal_rows=signals,
        output_rows=outputs,
        learning_rows=learnings,
    )


if __name__ == "__main__":
    print(generate())
