"""Generate NEURAL Banque Marketing foundations workbook."""

from __future__ import annotations

from _styles import (
    FILES,
    MVP_GATES,
    REF_DATE,
    SOURCE_STATUS,
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
        "NEURAL Banque Marketing Foundations",
        "Regulatory and evidence sourcebook for bank marketing agents",
    )

    readme_sheet(
        wb,
        "FOUNDATIONS",
        "Shared sourcebook, gates and scenario taxonomy",
        [
            ("Scope", "Marketing for banking, savings, credit, investments, private banking and crypto campaigns."),
            ("Status", "Portfolio workbook with synthetic data as of 2026-04-25."),
            ("Guardrail", "No real client, campaign or CRM data."),
            ("Next", "Site integration only after Excel foundations are stable."),
        ],
    )
    param_sheet(
        wb,
        "tblParamsBankMarketingFoundations",
        [
            ("BRANCH", "Banque - Marketing", ""),
            ("REF_DATE", REF_DATE, "Information watch reference date."),
            ("AGENTS", "AG-BM001..AG-BM004", "AG-BM005 and AG-BM006 reserved services."),
            ("DATA_MODE", "synthetic", "Recruiter/portfolio only."),
            ("MVP_GATES", ",".join(MVP_GATES), ""),
        ],
    )

    ws = wb.create_sheet("2_SOURCEBOOK")
    title(ws, "SOURCEBOOK", "Public legal, regulatory and market watch sources", 9)
    headers(ws, 4, ["SOURCE_ID", "DOMAIN", "TITLE", "AUTHORITY", "DATE", "STATUS", "URL", "USED_BY", "DESIGN_IMPACT"], [24, 18, 52, 22, 14, 12, 74, 30, 86])
    rows = [
        ("SRC-AMF-ACPR-PUB-001", "ADVERTISING", "Common AMF/ACPR criteria for clear, accurate and non-misleading advertising", "AMF/ACPR", "2014-06-12", "ACTIVE", "https://www.amf-france.org/fr/actualites-publications/communiques/communiques-de-lamf/lautorite-des-marches-financiers-amf-et-lautorite-de-controle-prudentiel-et-de-resolution-acpr-se", "AG-BM001, AG-BM004", "Core marketing gate: identifiable, intelligible, balanced and not misleading."),
        ("SRC-AMF-COMPLEX-001", "MIFID", "AMF DOC-2010-05 complex financial instruments", "AMF", "2025-12-08", "ACTIVE", "https://www.amf-france.org/fr/reglementation/doctrine/doc-2010-05", "AG-BM004", "Complexity and dissuasive warnings for non-professional clients."),
        ("SRC-AMF-CRYPTO-2025", "CRYPTO", "AMF adapts doctrine for debt securities indexed to crypto-assets", "AMF", "2025-12-08", "ACTIVE", "https://www.amf-france.org/fr/actualites-publications/actualites/commercialisation-des-instruments-financiers-complexes-aupres-dune-clientele-non-professionnelle-0", "AG-BM004", "Crypto-linked marketing needs MiFID and MiCA cross-checks."),
        ("SRC-EU-MICA-001", "MICA", "Regulation (EU) 2023/1114 on markets in crypto-assets", "EUR-Lex", "2024-12-30", "ACTIVE", "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R1114", "AG-BM004", "Crypto marketing must be clearly identifiable, fair, clear, not misleading and consistent with white paper."),
        ("SRC-EU-DORA-001", "DORA", "Digital operational resilience for financial entities", "EUR-Lex", "2025-01-17", "ACTIVE", "https://eur-lex.europa.eu/legal-content/EN/LSU/?uri=CELEX:32022R2554", "AG-BM006", "Marketing stack dependencies need ICT third-party traceability when integrated."),
        ("SRC-EU-AIACT-001", "AI_ACT", "Regulation (EU) 2024/1689 AI Act transparency obligations", "EUR-Lex", "2026-08-02", "ACTIVE", "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689", "AG-BM003, AG-BM006", "AI-generated or AI-assisted marketing needs transparent disclosure where applicable."),
        ("SRC-CNIL-PROF-001", "GDPR", "CNIL guidance on AI, profiling and automated decisions", "CNIL", "2026-04-25", "ACTIVE", "https://www.cnil.fr/fr/intelligence-artificielle/ia-comment-etre-en-conformite-avec-le-rgpd", "AG-BM003, AG-BM006", "Segmentation and profiling need consent/legal basis, minimization and human oversight."),
        ("SRC-ESMA-MIFID-001", "MIFID", "MiFID II product governance and target market expectations", "ESMA", "2024-01-01", "ACTIVE", "https://www.esma.europa.eu/", "AG-BM004", "Marketing must remain consistent with target market and distribution strategy."),
        ("SRC-EU-PRIIPS-001", "PRIIPS", "PRIIPs KID consistency for packaged retail investment products", "EUR-Lex", "2026-04-25", "ACTIVE", "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32014R1286", "AG-BM004", "Marketing claims cannot contradict KID risks, costs or performance scenarios."),
        ("SRC-ACPR-2026-IA", "SUPERVISION", "ACPR 2026 customer protection event includes AI in product sales", "ACPR", "2026-03-31", "ACTIVE", "https://acpr.banque-france.fr/fr/evenements/matinee-de-la-protection-de-la-clientele-des-banques-et-des-assurances-3-edition", "all", "Signals current supervisory attention to AI in commercialization."),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblBankMarketingSourcebook", 4, last, 9)
    add_list_validation(ws, 6, 5, last, SOURCE_STATUS)
    finish_sheet(ws)

    ws = wb.create_sheet("3_REGULATORY_RULES")
    title(ws, "REGULATORY RULES", "Shared rule library used by bank marketing agents", 8)
    headers(ws, 4, ["RULE_ID", "GATE_ID", "DOMAIN", "RULE", "SEVERITY", "BLOCKING", "SOURCE_REF", "APPLIES_TO", "CONTROL_LOGIC"], [18, 40, 18, 54, 14, 12, 26, 30, 86])
    rows = [
        ("BM-R001", "GATE-AMF-ACPR-CLEAR-NOT-MISLEADING", "ADVERTISING", "Communication is clear, accurate and not misleading", "CRITICAL", "YES", "SRC-AMF-ACPR-PUB-001", "AG-BM001,AG-BM004", "Block if headline, footnote or visual balance hides a material risk."),
        ("BM-R002", "GATE-RISK-BENEFIT-BALANCE", "BALANCE", "Benefits and risks are equally visible", "CRITICAL", "YES", "SRC-AMF-ACPR-PUB-001", "AG-BM001,AG-BM004", "Block one-sided return or savings claims."),
        ("BM-R003", "GATE-SOURCE-ACTIVE", "EVIDENCE", "Evidence source is active and current", "HIGH", "YES", "2_SOURCEBOOK", "all", "Block stale or missing regulatory evidence."),
        ("BM-R004", "GATE-NUM-VALIDATED", "NUMBERS", "Rates, savings and performance figures are sourced and dated", "HIGH", "YES", "SRC-AMF-ACPR-PUB-001", "all", "Block unvalidated numbers."),
        ("BM-R005", "GATE-MIFID-TARGET-MARKET", "MIFID", "Target market and product governance are consistent", "CRITICAL", "YES", "SRC-ESMA-MIFID-001", "AG-BM004", "Block retail targeting of incompatible complex product."),
        ("BM-R006", "GATE-PRIIPS-KID-CONSISTENCY", "PRIIPS", "KID risks, costs and scenarios are not contradicted", "CRITICAL", "YES", "SRC-EU-PRIIPS-001", "AG-BM004", "Block marketing if KID inconsistency exists."),
        ("BM-R007", "GATE-MICA-CRYPTO-MARKETING", "MICA", "Crypto marketing follows MiCA article 7-style requirements", "CRITICAL", "YES", "SRC-EU-MICA-001", "AG-BM004", "Block missing white paper or mandatory statement."),
        ("BM-R008", "GATE-GDPR-CONSENT-PROFILING", "GDPR", "Profiling and segmentation have legal basis", "CRITICAL", "YES", "SRC-CNIL-PROF-001", "AG-BM003", "Block consentless profiling for marketing personalization."),
        ("BM-R009", "GATE-AI-ACT-DISCLOSURE", "AI_ACT", "AI assistance is disclosed where required", "HIGH", "YES", "SRC-EU-AIACT-001", "AG-BM003,AG-BM006", "Block public AI-generated campaign after applicability date without disclosure."),
        ("BM-R010", "GATE-HITL-COMPLIANCE", "HITL", "Compliance human approval is logged before diffusion", "CRITICAL", "YES", "internal", "all", "Block final publication without named approver."),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblBankMarketingRules", 4, last, 9)
    finish_sheet(ws)

    ws = wb.create_sheet("4_DISCLOSURE_LIBRARY")
    title(ws, "DISCLOSURE LIBRARY", "Reusable disclaimers and disclosure snippets", 7)
    headers(ws, 4, ["DISCLOSURE_ID", "DOMAIN", "CHANNEL", "LANG", "TEXT", "REQUIRED_WHEN", "SOURCE_REF"], [20, 18, 16, 8, 88, 44, 24])
    rows = [
        ("DISC-RISK-001", "INVESTMENT", "ALL", "FR", "Les performances passees ne prejugent pas des performances futures. Risque de perte en capital.", "Investment performance or unit-linked claim.", "SRC-AMF-ACPR-PUB-001"),
        ("DISC-CREDIT-001", "CREDIT", "ALL", "FR", "Un credit vous engage et doit etre rembourse. Verifiez vos capacites de remboursement avant de vous engager.", "Credit campaign.", "internal"),
        ("DISC-MICA-001", "CRYPTO", "WEB", "FR", "Cette communication marketing relative a des crypto-actifs n'a pas ete examinee ou approuvee par une autorite competente.", "MiCA crypto campaign.", "SRC-EU-MICA-001"),
        ("DISC-AI-001", "AI_ACT", "ALL", "FR", "Ce contenu a ete prepare avec assistance IA et valide par une equipe humaine.", "AI-generated public marketing content.", "SRC-EU-AIACT-001"),
        ("DISC-EDU-001", "FIN_LITERACY", "ALL", "FR", "Contenu pedagogique general, ne constituant pas un conseil en investissement personnalise.", "Educational content.", "SRC-AMF-ACPR-PUB-001"),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblBankMarketingDisclosureLibrary", 4, last, 7)
    finish_sheet(ws)

    ws = wb.create_sheet("5_CHANNEL_MATRIX")
    title(ws, "CHANNEL MATRIX", "Channel constraints for bank marketing campaigns", 8)
    headers(ws, 4, ["CHANNEL", "FORMAT", "MAX_LENGTH", "SUPPORTS_RISK_BOX", "SUPPORTS_LINKS", "APPROVAL_REQUIRED", "PRIMARY_AGENT", "NOTE"], [18, 20, 14, 18, 14, 18, 24, 72])
    rows = [
        ("EMAIL", "B2C", 1200, "YES", "YES", "YES", "AG-BM001", "Acquisition and retention campaigns."),
        ("SMS", "B2C", 160, "NO", "YES", "YES", "AG-BM003", "Only short notices and consented campaigns."),
        ("APP_PUSH", "B2C", 120, "NO", "YES", "YES", "AG-BM003", "Must link to full risk disclosures."),
        ("LANDING_PAGE", "WEB", 5000, "YES", "YES", "YES", "AG-BM001", "Best channel for balanced risk/benefit copy."),
        ("LINKEDIN", "SOCIAL", 1300, "YES", "YES", "YES", "AG-BM002", "Educational content and corporate campaigns."),
        ("BROCHURE", "PRINT", 8000, "YES", "NO", "YES", "AG-BM004", "Investment and private banking materials."),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblBankMarketingChannelMatrix", 4, last, 8)
    finish_sheet(ws)

    ws = wb.create_sheet("6_CONSENT_SEGMENTS")
    title(ws, "CONSENT SEGMENTS", "Synthetic segment and consent rules for personalization", 8)
    headers(ws, 4, ["SEGMENT_ID", "LABEL", "PERSONA", "VULNERABLE_FLAG", "CONSENT_REQUIRED", "AI_PROFILING", "ALLOWED_CHANNELS", "CONTROL"], [18, 28, 34, 18, 18, 16, 36, 76])
    rows = [
        ("SEG-RETAIL-YOUNG", "Jeunes actifs", "First salary, first savings", "NO", "YES", "YES", "EMAIL,APP_PUSH", "Education first, no complex products by default."),
        ("SEG-RETAIL-SENIOR", "Clients seniors", "Savings and protection", "YES", "YES", "YES", "EMAIL,MAIL", "Avoid pressure tactics and check readability."),
        ("SEG-AFFLUENT", "Banque privee entree", "Diversified savings", "NO", "YES", "YES", "EMAIL,LANDING_PAGE", "Suitability and target-market checks for investment products."),
        ("SEG-SME", "Dirigeants PME", "Cash and financing", "NO", "YES", "NO", "EMAIL,LINKEDIN", "Separate retail and professional claims."),
        ("SEG-CRYPTO-INTEREST", "Interet crypto", "Self-directed investor", "NO", "YES", "YES", "LANDING_PAGE", "MiCA and risk warnings mandatory."),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblBankMarketingConsentSegments", 4, last, 8)
    finish_sheet(ws)

    ws = wb.create_sheet("7_RESTRICTED_WORDING")
    title(ws, "RESTRICTED WORDING", "Forbidden and review wording for marketing copy", 6)
    headers(ws, 4, ["TERM_ID", "TERM", "DOMAIN", "SEVERITY", "ACTION", "RATIONALE"], [16, 28, 20, 14, 18, 92])
    rows = [
        ("TERM-001", "garanti sans risque", "INVESTMENT", "CRITICAL", "BLOCK", "Absolute safety claim incompatible with market risk."),
        ("TERM-002", "meilleur placement", "INVESTMENT", "HIGH", "REVIEW", "Comparative superiority needs source and perimeter."),
        ("TERM-003", "rendement assure", "SAVINGS", "CRITICAL", "BLOCK", "Return promise must match contractual guarantee and risk profile."),
        ("TERM-004", "credit accepte en 2 minutes", "CREDIT", "HIGH", "REVIEW", "May mislead on solvency checks."),
        ("TERM-005", "crypto approuvee par les autorites", "CRYPTO", "CRITICAL", "BLOCK", "MiCA marketing cannot imply authority approval when not true."),
        ("TERM-006", "selection IA objective", "AI_ACT", "HIGH", "REVIEW", "AI profiling needs explanation and bias controls."),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblBankMarketingRestrictedWording", 4, last, 6)
    finish_sheet(ws)

    ws = wb.create_sheet("8_EVIDENCE_POLICY")
    title(ws, "EVIDENCE POLICY", "Source freshness and evidence expectations", 7)
    headers(ws, 4, ["POLICY_ID", "DOMAIN", "MAX_AGE_DAYS", "STALE_WARNING_DAYS", "SOURCE_LEVEL", "BLOCK_IF_MISSING", "NOTE"], [18, 18, 18, 20, 18, 18, 82])
    rows = [
        ("EV-POL-001", "ADVERTISING", 365, 60, "PRIMARY", "YES", "AMF/ACPR or official doctrine expected."),
        ("EV-POL-002", "MIFID", 180, 45, "PRIMARY", "YES", "Doctrine and product governance references must be current."),
        ("EV-POL-003", "MICA", 180, 45, "PRIMARY", "YES", "Crypto assets need current regulatory and white-paper evidence."),
        ("EV-POL-004", "GDPR_AI", 180, 45, "PRIMARY", "YES", "CNIL or EU sources expected for profiling and AI disclosures."),
        ("EV-POL-005", "EDUCATION", 730, 90, "SECONDARY", "NO", "Educational claims can use public financial education sources."),
    ]
    last = write_rows(ws, 5, rows)
    make_table(ws, "tblBankMarketingEvidencePolicy", 4, last, 7)
    finish_sheet(ws)

    return save_workbook(wb, FILES["foundations"])


if __name__ == "__main__":
    print(generate())
