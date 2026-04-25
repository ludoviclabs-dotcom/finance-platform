"""Generate AG-BM004 MiFIDProductMarketingGuard workbook."""

from __future__ import annotations

from _styles import FILES, build_agent_workbook


def generate() -> object:
    scenarios = [
        ("BM004-PASS-FUND", "Balanced fund brochure consistent with KID", "Investment fund", "BROCHURE", "Affluent retail", "FR", "YES", "YES", "YES", "YES", "YES", "YES", "NA", "NA", "NA", "YES", "PASS", "Target market, costs, risk indicator and performance wording align."),
        ("BM004-REVIEW-PRIVATE", "Private banking note needs target-market clarification", "Structured note", "EMAIL", "Private banking", "FR", "YES", "REVIEW", "YES", "YES", "REVIEW", "YES", "NA", "NA", "NA", "YES", "PASS_WITH_REVIEW", "Potentially eligible segment but distribution wording needs tightening."),
        ("BM004-BLOCK-CRYPTO", "Crypto-linked note promoted to broad retail audience", "Crypto-linked note", "LANDING_PAGE", "Retail", "FR", "NO", "NO", "YES", "NO", "NO", "NO", "NO", "NA", "NA", "NO", "BLOCK", "MiFID, PRIIPs and MiCA gates fail for retail public marketing."),
    ]
    gates = [
        ("GATE-MIFID-TARGET-MARKET", "MiFID target market consistency", "CRITICAL", "YES", "SRC-ESMA-MIFID-001", "Investment Compliance", "Product and audience must match target market."),
        ("GATE-PRIIPS-KID-CONSISTENCY", "PRIIPs KID consistency", "CRITICAL", "YES", "SRC-EU-PRIIPS-001", "Investment Compliance", "Marketing cannot contradict KID costs, risks or scenarios."),
        ("GATE-MICA-CRYPTO-MARKETING", "MiCA crypto marketing requirements", "CRITICAL", "YES", "SRC-EU-MICA-001", "Crypto Compliance", "Crypto marketing needs white-paper consistency and notices."),
        ("GATE-RISK-BENEFIT-BALANCE", "Risk and benefit balance", "CRITICAL", "YES", "SRC-AMF-ACPR-PUB-001", "Compliance", "Risk of loss in capital must be visible."),
        ("GATE-HITL-COMPLIANCE", "Human compliance approval", "CRITICAL", "YES", "internal", "Compliance", "Investment campaigns require final human approval."),
    ]
    signals = [
        ("BM004-SIG-001", "capital protege", "risk", "HIGH", "REVIEW", "Must match contractual protection and scenarios."),
        ("BM004-SIG-002", "accessible a tous", "target-market", "CRITICAL", "BLOCK", "Complex products cannot be broadly targeted without checks."),
        ("BM004-SIG-003", "crypto performance", "mica", "CRITICAL", "BLOCK", "Needs MiCA and product-doc consistency."),
        ("BM004-SIG-004", "frais faibles", "priips", "HIGH", "REVIEW", "Needs KID cost consistency."),
    ]
    outputs = [
        ("OUT-BM004-001", "BM004-PASS-FUND", "Approval brief", "Allow publication with KID link, risk box and dated performance context.", "Investment Compliance"),
        ("OUT-BM004-002", "BM004-REVIEW-PRIVATE", "Review brief", "Restrict distribution language to eligible target market and add complexity note.", "Private Banking Compliance"),
        ("OUT-BM004-003", "BM004-BLOCK-CRYPTO", "Block notice", "Block broad retail campaign and require MiFID/MiCA remediation pack.", "Crypto Compliance"),
    ]
    learnings = [
        ("LRN-001", "MiFID", "Target-market consistency makes the agent more realistic than a generic copy checker.", "Add product-governance import in V1.", "OPEN"),
        ("LRN-002", "PRIIPs", "KID consistency is a recruiter-friendly proof of domain depth.", "Sync KID fields in future parser.", "OPEN"),
        ("LRN-003", "MiCA", "Crypto marketing is now a distinct gate, not a footnote.", "Expose MiCA card in future UI.", "OPEN"),
    ]
    return build_agent_workbook(
        filename=FILES["agbm004"],
        agent_id="AG-BM004",
        agent_name="MiFIDProductMarketingGuard",
        mission="Check investment, complex-product and crypto marketing consistency",
        owner="Investment Compliance",
        scenarios=scenarios,
        gate_rows=gates,
        signal_rows=signals,
        output_rows=outputs,
        learning_rows=learnings,
    )


if __name__ == "__main__":
    print(generate())
