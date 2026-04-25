"""Generate ISC-A002 ExpertMgmtInsur workbook."""

from __future__ import annotations

from _styles import FILES, build_agent_workbook


def generate() -> object:
    scenarios = [
        ("EXP-PASS-REPORT", "Expert dispatched with complete report", "auto", "FR", "YES", "NA", "YES", "YES", "NO", "NO", "NO", "NA", "YES", "NO", "YES", "PASS", "Report contains identity, operations, persons present, documents and conclusions."),
        ("EXP-REVIEW-INCOMPLETE", "Expert report misses persons present", "auto", "FR", "YES", "NA", "YES", "NO", "NO", "NO", "NO", "YES", "YES", "NO", "YES", "PASS_WITH_REVIEW", "Incomplete report is sent back to expert management for correction."),
        ("EXP-BLOCK-MANDATE", "Expert substitution without written mandate", "auto", "FR", "YES", "NA", "NO", "YES", "NO", "NO", "NO", "NA", "YES", "NO", "YES", "BLOCK", "Mandate gate blocks the workflow."),
    ]
    gates = [
        ("GATE-EXPERT-MANDATE", "Written mandate present when required", "CRITICAL", "YES", "SRC-ROUTE-EXP-001", "Claims Expertise", "Expert cannot substitute for owner without written mandate."),
        ("GATE-REPORT-COMPLETE", "Mandatory report fields complete", "HIGH", "NO", "SRC-ROUTE-EXP-001", "Claims Expertise", "Incomplete reports trigger review."),
        ("GATE-SOURCE-ACTIVE", "Evidence source is active", "HIGH", "YES", "2_SOURCEBOOK", "AI Ops", "Blocks stale regulatory basis."),
        ("GATE-HITL-FRAUD", "Human review for contested expert case", "HIGH", "NO", "SRC-CNIL-AI-001", "Claims Ops", "Contested cases stay human-led."),
    ]
    signals = [
        ("EXP-SIG-001", "mandate missing", "mandate", "CRITICAL", "BLOCK", "Mandate is a hard precondition when required."),
        ("EXP-SIG-002", "report field empty", "report", "HIGH", "REVIEW", "Mandatory report field missing."),
        ("EXP-SIG-003", "dangerous defect", "safety", "CRITICAL", "REVIEW", "Dangerous defects require explicit trace in report."),
        ("EXP-SIG-004", "contestation received", "dispute", "HIGH", "REVIEW", "Expert must notify interested parties in contested cases."),
    ]
    outputs = [
        ("OUT-EXP-001", "EXP-PASS-REPORT", "Dispatch summary", "Assign expert and keep report completeness checklist attached to the claim file.", "Claims Expertise"),
        ("OUT-EXP-002", "EXP-REVIEW-INCOMPLETE", "Correction request", "Return report for missing attendance/document fields before settlement use.", "Claims Expertise"),
        ("OUT-EXP-003", "EXP-BLOCK-MANDATE", "Block notice", "Block expert action until a valid written mandate is attached or requirement is marked not applicable.", "Claims Legal"),
    ]
    learnings = [
        ("LRN-001", "Mandate", "A recruiter can quickly see the legal control, not just dispatch optimization.", "Add mandate upload mapping later.", "OPEN"),
        ("LRN-002", "Reports", "Completeness is a better MVP than full NLP report critique.", "Add field-level extraction in V1.", "OPEN"),
        ("LRN-003", "Disputes", "Contestation handling deserves its own event log in production.", "Reserve a dispute timeline sheet later.", "OPEN"),
    ]
    return build_agent_workbook(
        filename=FILES["isc002"],
        agent_id="ISC-A002",
        agent_name="ExpertMgmtInsur",
        mission="Dispatch experts and validate expertise report readiness",
        owner="Claims Expertise",
        scenarios=scenarios,
        gate_rows=gates,
        signal_rows=signals,
        output_rows=outputs,
        learning_rows=learnings,
    )


if __name__ == "__main__":
    print(generate())
