"""Generate ISC-A004 Sapin2Compliance workbook."""

from __future__ import annotations

from _styles import FILES, build_agent_workbook


def generate() -> object:
    scenarios = [
        ("S2-PASS-DUE", "Repairer renewal with complete due diligence", "auto", "FR", "NO", "NA", "NA", "NA", "NO", "NO", "NO", "NA", "YES", "NO", "YES", "PASS", "Identity, ownership, COI and country risk are documented."),
        ("S2-REVIEW-HIGHRISK", "High-risk intermediary with collusion concern", "home", "FR", "NO", "NA", "NA", "NA", "NO", "YES", "NO", "YES", "YES", "NO", "YES", "PASS_WITH_REVIEW", "Enhanced due diligence and compliance review required."),
        ("S2-BLOCK-MISSING", "Supplier onboarding with missing third-party evaluation", "auto", "FR", "NO", "NA", "NA", "NA", "NO", "NO", "NO", "NA", "NO", "NO", "YES", "BLOCK", "Sapin II third-party gate blocks onboarding."),
    ]
    gates = [
        ("GATE-SAPIN2-THIRD-PARTY", "Third-party due diligence completed", "CRITICAL", "YES", "SRC-AFA-REC-001", "Compliance", "Block onboarding or renewal if missing."),
        ("GATE-COLLUSION-REVIEW", "Potential collusion or conflict reviewed", "CRITICAL", "YES", "SRC-AFA-REC-001", "Compliance", "Enhanced due diligence when relationship risk is present."),
        ("GATE-SOURCE-ACTIVE", "Evidence source is active", "HIGH", "YES", "2_SOURCEBOOK", "AI Ops", "Blocks stale compliance basis."),
        ("GATE-DORA-ICT-THIRD-PARTY", "ICT third-party criticality checked", "HIGH", "NO", "SRC-ACPR-DORA-001", "Risk", "Relevant for platforms and analytics vendors."),
    ]
    signals = [
        ("S2-SIG-001", "beneficial owner missing", "identity", "CRITICAL", "BLOCK", "Identity opacity blocks onboarding."),
        ("S2-SIG-002", "country risk high", "jurisdiction", "HIGH", "REVIEW", "Country exposure triggers enhanced due diligence."),
        ("S2-SIG-003", "conflict of interest", "relationship", "HIGH", "REVIEW", "COI requires compliance review."),
        ("S2-SIG-004", "unsupported payment", "accounting", "CRITICAL", "BLOCK", "Accounting control failure blocks payment path."),
    ]
    outputs = [
        ("OUT-S2-001", "S2-PASS-DUE", "Due diligence memo", "Supplier can proceed with renewal; retain evidence ids and next review date.", "Compliance"),
        ("OUT-S2-002", "S2-REVIEW-HIGHRISK", "Enhanced review brief", "Open enhanced review with risk factors, ownership notes and compliance questions.", "Compliance"),
        ("OUT-S2-003", "S2-BLOCK-MISSING", "Block notice", "Block onboarding until third-party evaluation and accounting-control evidence are complete.", "Compliance"),
    ]
    learnings = [
        ("LRN-001", "Sapin II", "The agent should be a compliance workflow, not a legal conclusion engine.", "Keep legal sign-off as HITL.", "OPEN"),
        ("LRN-002", "Risk map", "Supplier type, jurisdiction and payment pattern are enough for a strong MVP.", "Add scoring weights in V1.", "OPEN"),
        ("LRN-003", "Evidence", "AFA sourcebook makes the workbook defensible in interviews.", "Expose source refs in future public page.", "OPEN"),
    ]
    return build_agent_workbook(
        filename=FILES["isc004"],
        agent_id="ISC-A004",
        agent_name="Sapin2Compliance",
        mission="Verify anti-corruption due diligence and third-party risk evidence",
        owner="Compliance",
        scenarios=scenarios,
        gate_rows=gates,
        signal_rows=signals,
        output_rows=outputs,
        learning_rows=learnings,
    )


if __name__ == "__main__":
    print(generate())
