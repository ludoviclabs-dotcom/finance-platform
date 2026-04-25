"""Generate AG-BM002 FinLiteracyContent workbook."""

from __future__ import annotations

from _styles import FILES, build_agent_workbook


def generate() -> object:
    scenarios = [
        ("BM002-PASS-BUDGET", "Budget education article with neutral examples", "Education budget", "LINKEDIN", "Retail", "FR", "YES", "YES", "YES", "YES", "NA", "NA", "NA", "NA", "NA", "YES", "PASS", "General education, no personalized recommendation."),
        ("BM002-REVIEW-ETF", "ETF explainer needs stronger risk language", "Investment education", "EMAIL", "Young retail", "FR", "YES", "REVIEW", "YES", "YES", "NA", "NA", "NA", "NA", "NA", "YES", "PASS_WITH_REVIEW", "Educational format is acceptable but risks are too low in the hierarchy."),
        ("BM002-BLOCK-ADVICE", "Article recommends a specific product for seniors", "Investment education", "LANDING_PAGE", "Senior retail", "FR", "NO", "NO", "YES", "YES", "NO", "NA", "NA", "NA", "NA", "NO", "BLOCK", "Educational content becomes personalized advice and target-market mismatch."),
    ]
    gates = [
        ("GATE-SOURCE-ACTIVE", "Source evidence active", "HIGH", "YES", "2_SOURCEBOOK", "Education + Brand", "Use official or durable education sources."),
        ("GATE-NUM-VALIDATED", "Numbers validated and dated", "HIGH", "YES", "SRC-AMF-ACPR-PUB-001", "Data Owner", "Examples and figures need date and method."),
        ("GATE-RISK-BENEFIT-BALANCE", "Risk and benefit balance", "CRITICAL", "YES", "SRC-AMF-ACPR-PUB-001", "Education + Legal", "Education cannot become promotional optimism."),
        ("GATE-HITL-COMPLIANCE", "Human compliance approval", "CRITICAL", "YES", "internal", "Compliance", "Legal validates boundaries with advice."),
    ]
    signals = [
        ("BM002-SIG-001", "vous devriez acheter", "advice", "CRITICAL", "BLOCK", "Specific recommendation can become advice."),
        ("BM002-SIG-002", "profil prudent", "suitability", "HIGH", "REVIEW", "Suitability language needs controlled context."),
        ("BM002-SIG-003", "rendement moyen", "number", "HIGH", "REVIEW", "Needs period, sample and source."),
        ("BM002-SIG-004", "sans frais caches", "fee", "MEDIUM", "REVIEW", "Needs fee definition and perimeter."),
    ]
    outputs = [
        ("OUT-BM002-001", "BM002-PASS-BUDGET", "Content brief", "Publish as general financial education with source links and no product CTA.", "Education + Brand"),
        ("OUT-BM002-002", "BM002-REVIEW-ETF", "Rewrite brief", "Raise risk disclaimer and separate education from product acquisition CTA.", "Compliance"),
        ("OUT-BM002-003", "BM002-BLOCK-ADVICE", "Block notice", "Remove product-specific recommendation and route to regulated advisory workflow.", "Legal"),
    ]
    learnings = [
        ("LRN-001", "Education", "A strong education agent is valuable only if it knows where advice starts.", "Add advice boundary taxonomy.", "OPEN"),
        ("LRN-002", "Readability", "Recruiters can inspect concrete readability and risk-language checks in Excel.", "Add readability score in V1.", "OPEN"),
        ("LRN-003", "Trust", "Source-backed education is stronger than generic content generation.", "Expose source cards on site.", "OPEN"),
    ]
    return build_agent_workbook(
        filename=FILES["agbm002"],
        agent_id="AG-BM002",
        agent_name="FinLiteracyContent",
        mission="Produce financial education content with source, risk and advice-boundary controls",
        owner="Education + Brand",
        scenarios=scenarios,
        gate_rows=gates,
        signal_rows=signals,
        output_rows=outputs,
        learning_rows=learnings,
    )


if __name__ == "__main__":
    print(generate())
