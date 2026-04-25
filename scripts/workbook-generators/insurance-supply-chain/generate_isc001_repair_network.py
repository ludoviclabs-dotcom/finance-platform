"""Generate ISC-A001 RepairNetworkInsur workbook."""

from __future__ import annotations

from _styles import FILES, build_agent_workbook


def generate() -> object:
    scenarios = [
        ("REP-PASS-CHOICE", "Approved repairer recommendation with free choice disclosed", "auto", "FR", "YES", "YES", "NA", "NA", "NO", "NO", "NO", "NA", "YES", "NO", "YES", "PASS", "Recommendation compares SLA, cost and quality while preserving policyholder choice."),
        ("REP-REVIEW-INVOICE", "Repair estimate above peer benchmark", "auto", "FR", "YES", "YES", "NA", "NA", "YES", "NO", "NO", "YES", "YES", "NO", "YES", "PASS_WITH_REVIEW", "Invoice anomaly routes to claims supply chain for human review."),
        ("REP-BLOCK-NOCHOICE", "Workflow pushes network repairer without free-choice notice", "auto", "FR", "YES", "NO", "NA", "NA", "NO", "NO", "NO", "NA", "YES", "NO", "YES", "BLOCK", "Free-choice gate blocks the output until wording and notice are corrected."),
    ]
    gates = [
        ("GATE-REPAIRER-FREE-CHOICE", "Policyholder free choice of repairer is disclosed", "CRITICAL", "YES", "SRC-CODE-ASS-001", "Claims Legal", "Required for motor claim workflows."),
        ("GATE-INVOICE-ANOMALY", "Repair estimate or invoice anomaly", "HIGH", "NO", "SRC-DGCCRF-REP-001", "Claims Supply Chain", "Triggers review, not automatic refusal."),
        ("GATE-SAPIN2-THIRD-PARTY", "Repairer third-party file complete", "HIGH", "YES", "SRC-AFA-REC-001", "Compliance", "Applies to approved network onboarding and renewal."),
        ("GATE-SOURCE-ACTIVE", "Evidence source is active", "HIGH", "YES", "2_SOURCEBOOK", "AI Ops", "Portfolio outputs must cite active sources."),
    ]
    signals = [
        ("REP-SIG-001", "approved repairer only", "free-choice", "CRITICAL", "BLOCK", "Unsafe wording if it hides the policyholder choice."),
        ("REP-SIG-002", "estimate > peer p90", "invoice", "HIGH", "REVIEW", "Cost outlier needs human review."),
        ("REP-SIG-003", "delay over SLA", "quality", "MEDIUM", "REVIEW", "Operational quality signal, not a compliance block."),
        ("REP-SIG-004", "PIEC choice missing", "parts", "MEDIUM", "REVIEW", "Parts evidence is expected when relevant."),
    ]
    outputs = [
        ("OUT-REP-001", "REP-PASS-CHOICE", "Recommendation", "Rank repairers by quality/cost/SLA and state that the policyholder remains free to choose another professional.", "Claims Supply Chain"),
        ("OUT-REP-002", "REP-REVIEW-INVOICE", "Review brief", "Open a review case with estimate deltas, peer benchmark and required supporting documents.", "Claims Supply Chain"),
        ("OUT-REP-003", "REP-BLOCK-NOCHOICE", "Block notice", "Block publication and request revised wording that explicitly discloses free choice of repairer.", "Claims Legal"),
    ]
    learnings = [
        ("LRN-001", "Free choice", "The agent should recommend and compare, not steer by default.", "Add wording templates before site integration.", "OPEN"),
        ("LRN-002", "Quality", "Cost controls are credible only when paired with SLA and complaint signals.", "Add repairer scorecards in V1.", "OPEN"),
        ("LRN-003", "Evidence", "DGCCRF repair-order fields make the demo concrete for recruiters.", "Expose evidence ids in future UI.", "OPEN"),
    ]
    return build_agent_workbook(
        filename=FILES["isc001"],
        agent_id="ISC-A001",
        agent_name="RepairNetworkInsur",
        mission="Pilot repairer networks while preserving policyholder free choice",
        owner="Claims Supply Chain",
        scenarios=scenarios,
        gate_rows=gates,
        signal_rows=signals,
        output_rows=outputs,
        learning_rows=learnings,
    )


if __name__ == "__main__":
    print(generate())
