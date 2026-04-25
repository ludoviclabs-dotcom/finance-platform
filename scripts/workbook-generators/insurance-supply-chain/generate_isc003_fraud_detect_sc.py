"""Generate ISC-A003 FraudDetectSC workbook."""

from __future__ import annotations

from _styles import FILES, build_agent_workbook


def generate() -> object:
    scenarios = [
        ("FRD-PASS-TRIAGE", "Low-risk invoice triage", "home", "FR", "YES", "NA", "NA", "NA", "NO", "NO", "NO", "NA", "YES", "NO", "YES", "PASS", "No anomaly; output remains an audit trace."),
        ("FRD-REVIEW-COLLUSION", "Repairer/expert assignment loop", "auto", "FR", "YES", "NA", "NA", "NA", "YES", "YES", "NO", "YES", "YES", "NO", "YES", "PASS_WITH_REVIEW", "Collusion and invoice signals create an explainable human investigation brief."),
        ("FRD-BLOCK-AUTODECISION", "Automated fraud denial based on score", "home", "FR", "YES", "NA", "NA", "NA", "NO", "NO", "YES", "NO", "YES", "NO", "YES", "BLOCK", "GDPR automated-decision gate blocks adverse action without HITL."),
    ]
    gates = [
        ("GATE-INVOICE-ANOMALY", "Invoice or estimate anomaly", "HIGH", "NO", "SRC-DGCCRF-REP-001", "Fraud", "Review signal only."),
        ("GATE-COLLUSION-REVIEW", "Potential supplier collusion", "CRITICAL", "YES", "SRC-ALFA-2024-001", "Fraud", "Block if no human investigation path exists."),
        ("GATE-HITL-FRAUD", "Human review for fraud action", "CRITICAL", "YES", "SRC-CNIL-AI-001", "Fraud + DPO", "Agent cannot sanction or deny claims alone."),
        ("GATE-GDPR-AUTO-DECISION", "Automated decision safeguard", "CRITICAL", "YES", "SRC-CNIL-AI-001", "DPO", "Personal-data automated adverse decisions require guarantees and human review."),
        ("GATE-SOURCE-ACTIVE", "Evidence source is active", "HIGH", "YES", "2_SOURCEBOOK", "AI Ops", "Blocks stale source basis."),
    ]
    signals = [
        ("FRD-SIG-001", "duplicate invoice", "invoice", "HIGH", "REVIEW", "Possible document reuse or duplicate billing."),
        ("FRD-SIG-002", "same expert and repairer loop", "collusion", "CRITICAL", "REVIEW", "Graph pattern needs human investigator."),
        ("FRD-SIG-003", "score-only denial", "gdpr", "CRITICAL", "BLOCK", "Design is not acceptable for this MVP."),
        ("FRD-SIG-004", "round amount cluster", "invoice", "MEDIUM", "REVIEW", "Weak signal only, never standalone evidence."),
    ]
    outputs = [
        ("OUT-FRD-001", "FRD-PASS-TRIAGE", "Audit trace", "Record low-risk triage with model version, source ids and no action against the claimant.", "Fraud"),
        ("OUT-FRD-002", "FRD-REVIEW-COLLUSION", "Investigation brief", "Create human-review brief with explainable invoice, network and assignment-loop indicators.", "Fraud Investigator"),
        ("OUT-FRD-003", "FRD-BLOCK-AUTODECISION", "Block notice", "Block any automated denial and require a human investigator plus contestability path.", "DPO"),
    ]
    learnings = [
        ("LRN-001", "Human review", "The fraud agent is more credible if it is explicitly an alerting engine.", "Keep all future UI labels as alerts, not sanctions.", "OPEN"),
        ("LRN-002", "Explainability", "Signals should be decomposed into invoice, graph and document evidence.", "Add evidence cards later.", "OPEN"),
        ("LRN-003", "Materiality", "ALFA fraud figures justify the business case without using sensitive data.", "Add market-sizing note in master later.", "OPEN"),
    ]
    return build_agent_workbook(
        filename=FILES["isc003"],
        agent_id="ISC-A003",
        agent_name="FraudDetectSC",
        mission="Detect supplier fraud patterns as explainable human-review alerts",
        owner="Fraud + DPO",
        scenarios=scenarios,
        gate_rows=gates,
        signal_rows=signals,
        output_rows=outputs,
        learning_rows=learnings,
    )


if __name__ == "__main__":
    print(generate())
