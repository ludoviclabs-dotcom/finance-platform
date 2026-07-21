"""
test_demo_scenario_provider.py — provider demo *scenario-aware* (Asterion), DB-free.

Prouve, sans PostgreSQL (job `tests`), que le provider demo scénarisé produit les
claims attendus ET que `entailment_service` en dérive les statuts déterministes :
dépendance -> partially_supported, recyclé(contradiction) -> contradicted,
fournisseur alternatif(sans citation) -> unsupported. Le cas `supported` relève de
l'UC-2 (corroboration `calc_result`), couvert par test_ai_review_logic.

Aucun appel réseau, aucun coût (mode demo).
"""

from __future__ import annotations

from demo.loader import load_scenario
from models.ai_review import ModelRequest, ReferenceItem, ReferencePack
from services.intelligence.ai import citation_service, entailment_service, provider


def _asterion_iro_pack() -> ReferencePack:
    """Reference pack imitant le grounding UC-1 Asterion : 2 artefacts inclus dont
    les noms de fichier portent les marqueurs (dependency / recycled)."""
    refs = [
        ReferenceItem(
            ref_id="artifact:101", resource_type="artifact", internal_id=101,
            artifact_id=101, label="asterion-heavy-rare-earth-dependency.pdf",
            locator={"excerpt": "Dependance estimee a 92% aux terres rares lourdes"},
            data_status="estimated", sensitivity="internal", license_ok=True, stale=False,
        ),
        ReferenceItem(
            ref_id="artifact:102", resource_type="artifact", internal_id=102,
            artifact_id=102, label="asterion-recycled-content-audit.pdf",
            locator={"excerpt": "contenu recycle prouve 35% (declaration 80%)"},
            data_status="verified", sensitivity="internal", license_ok=True, stale=False,
        ),
    ]
    return ReferencePack(
        use_case="iro_review", subject_type="iro", subject_key="55", company_id=7,
        instructions="revue IRO",
        subject_summary={"title": "Dépendance critique aux aimants terres rares (E-Drive X4)"},
        references=refs,
    )


def _request(pack: ReferencePack) -> ModelRequest:
    return ModelRequest(
        use_case=pack.use_case, provider="demo", model="demo",
        prompt_version="p", policy_version="pol", system_prompt="sys", pack=pack,
    )


def _statuses(gen) -> dict[str, str]:
    """Rejoue citation + entailment (UC-1 => corroborated toujours False)."""
    pack_index = citation_service.build_index(_asterion_iro_pack())
    out: dict[str, str] = {}
    for claim in gen.result.claims:
        resolved, _ = citation_service.resolve_claim(pack_index, claim)
        status = entailment_service.support_status(claim, resolved, corroborated=False)
        out[claim.claim_text[:24]] = status
    return out


def test_scenario_fixture_loads_and_declares_four_cases():
    scenario = load_scenario()
    supports = scenario.manifest.ai_expected_support
    assert supports["magnets_scope3_share"] == "supported"
    assert supports["heavy_rare_earth_dependency"] == "partially_supported"
    assert supports["recycled_content_claim"] == "contradicted"
    assert supports["alternative_supplier_90d"] == "unsupported"


def test_asterion_iro_yields_deterministic_statuses():
    gen = provider.demo_generate(_request(_asterion_iro_pack()))
    # 3 claims scénarisés + 1 suggestion questions/actions
    assert len(gen.result.claims) == 4
    assert gen.provider == "demo"
    assert gen.cost_estimate == 0.0  # zéro coût

    statuses = list(_statuses(gen).values())
    assert "partially_supported" in statuses  # dépendance (estimée)
    assert "contradicted" in statuses          # recyclé 80% vs 35% prouvé
    assert "unsupported" in statuses           # fournisseur alternatif (sans preuve)


def test_contradiction_requires_resolved_citation():
    """Le flag contradiction ne produit `contradicted` que si une citation résout."""
    gen = provider.demo_generate(_request(_asterion_iro_pack()))
    recycled = next(c for c in gen.result.claims if "recycl" in c.claim_text.lower())
    assert recycled.structured_payload.get("contradiction") is True
    assert len(recycled.citations) == 1  # cite bien l'artefact d'audit résolu


def test_non_asterion_subject_falls_back_to_generic_demo():
    """Un autre sujet/tenant garde le comportement générique (aucune régression PR-11)."""
    pack = _asterion_iro_pack()
    pack.subject_summary = {"title": "IRO climat générique sans rapport"}
    gen = provider.demo_generate(_request(pack))
    # Générique : une REVIEW_REQUIRED par référence (2) + une SUGGESTION questions.
    labels = [c.output_label for c in gen.result.claims]
    assert labels.count("REVIEW_REQUIRED") == 2
    assert "SUGGESTION" in labels
    # Aucun flag contradiction en générique.
    assert all(c.structured_payload.get("contradiction") is not True for c in gen.result.claims)


def test_demo_provider_never_costs_or_calls_network():
    gen = provider.demo_generate(_request(_asterion_iro_pack()))
    assert gen.provider == "demo"
    assert gen.model == "demo"
    assert gen.cost_estimate == 0.0
    assert gen.model_version and gen.model_version.startswith("demo-")
