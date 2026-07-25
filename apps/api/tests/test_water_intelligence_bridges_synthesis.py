"""
tests/test_water_intelligence_bridges_synthesis.py — ponts CarbonCo et synthèse
authentifiée (P14, Wave D, commit D2).

AUCUNE base requise, AUCUN réseau, AUCUNE horloge : les deux modules testés sont
purs. Le cloisonnement tenant est exercé ici au niveau de la COMPOSITION (une
entrée d'un autre tenant fait échouer la construction) ; la RLS PostgreSQL
reste la barrière principale et n'est pas remplacée par ce test.

## Matrice de couverture

| Exigence du MACRO-PROMPT D | Classe de test |
|---|---|
| ponts vers les modules attendus | `TestBridgeCoverage` |
| aucun tenant sur la surface publique | `TestPublicBridgesCarryNoTenant` |
| ponts unidirectionnels, sans paramètre | `TestBridgeDirection` |
| synthèse à six facettes | `TestSynthesisShape` |
| jamais de score ESG global | `TestNoGlobalScore` |
| risque et confiance jamais fusionnés | `TestRiskAndConfidenceStaySeparate` |
| tenant A / tenant B | `TestTenantIsolation` |
"""

from __future__ import annotations

import ast
import json
from pathlib import Path

import pytest

from services.water_intelligence.module_bridges import (
    CURRENT_BRIDGES,
    ModuleBridge,
    ModuleBridgeError,
    ModuleBridgeRegistry,
    current_bridges,
)
from services.water_intelligence.tenant_synthesis import (
    FACET_ORDER,
    CrossTenantEntryError,
    FacetEntry,
    TenantSynthesisError,
    build_tenant_synthesis,
)

_SERVICES = Path(__file__).resolve().parents[1] / "services" / "water_intelligence"
BRIDGES_MODULE = _SERVICES / "module_bridges.py"
SYNTHESIS_MODULE = _SERVICES / "tenant_synthesis.py"

_REPO_ROOT = Path(__file__).resolve().parents[3]
DOCS_BRIDGES = (
    _REPO_ROOT
    / "docs"
    / "carbonco"
    / "water-intelligence"
    / "contracts"
    / "MODULE_BRIDGES.json"
)
CARBON_BRIDGES = (
    _REPO_ROOT / "apps" / "carbon" / "lib" / "water-intelligence" / "module-bridges.json"
)

COMPANY_A = 101
COMPANY_B = 202


def _entry(company_id: int, facet: str = "risk", **overrides: object) -> FacetEntry:
    base: dict[str, object] = {
        "company_id": company_id,
        "facet": facet,
        "source_module": "/water",
        "label": "Screening de test",
        "vocabulary": "water_screening_v1",
        "value": "high",
        "evidence_ref": "screening:1",
    }
    base.update(overrides)
    return FacetEntry(**base)  # type: ignore[arg-type]


class TestPurity:
    """Les deux modules restent purs."""

    @pytest.mark.parametrize("module_path", [BRIDGES_MODULE, SYNTHESIS_MODULE])
    def test_no_forbidden_import(self, module_path: Path) -> None:
        tree = ast.parse(module_path.read_text(encoding="utf-8"))
        forbidden = {
            "db",
            "db.database",
            "psycopg",
            "psycopg2",
            "requests",
            "httpx",
            "urllib",
            "socket",
        }
        imported: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module)
        assert not (imported & forbidden), f"import interdit : {imported & forbidden}"


class TestBridgeCoverage:
    """Tous les modules attendus par le MACRO-PROMPT D sont pontés."""

    def test_expected_targets_are_declared(self) -> None:
        targets = {bridge.target_path for bridge in CURRENT_BRIDGES}
        for expected in (
            "/water",
            "/sites-geo",
            "/resources/exposures",
            "/materials",
            "/iro",
            "/materialite",
            "/scopes",
            "/fournisseurs/scope3",
            "/actions",
        ):
            assert expected in targets, f"pont manquant vers {expected}"

    def test_every_bridge_names_its_water_signal(self) -> None:
        for bridge in CURRENT_BRIDGES:
            assert bridge.water_signal.strip()
            assert bridge.reads.strip()

    def test_duplicate_bridge_is_refused(self) -> None:
        bridge = CURRENT_BRIDGES[0]
        with pytest.raises(ModuleBridgeError, match="deux fois"):
            ModuleBridgeRegistry((bridge, bridge))


class TestPublicBridgesCarryNoTenant:
    """Aucun identifiant d'entreprise ne voyage dans une URL de pont."""

    def test_no_target_contains_a_tenant_field(self) -> None:
        for bridge in CURRENT_BRIDGES:
            lowered = bridge.target_path.lower()
            for forbidden in ("company_id", "tenant_id", "site_id", "user_id"):
                assert forbidden not in lowered

    def test_a_tenant_field_in_the_target_is_refused(self) -> None:
        with pytest.raises(ModuleBridgeError, match="site_id"):
            ModuleBridge(
                bridge_id="bad",
                target_path="/water?site_id=42",
                label="Mauvais pont",
                water_signal="stress",
                direction="public_to_cockpit",
                reads="…",
            )

    def test_no_public_bridge_declares_tenant_context(self) -> None:
        for bridge in current_bridges().public_bridges():
            assert bridge.carries_tenant_context is False

    def test_public_bridge_claiming_tenant_context_is_refused(self) -> None:
        with pytest.raises(ModuleBridgeError, match="contexte tenant"):
            ModuleBridge(
                bridge_id="bad",
                target_path="/water",
                label="Mauvais pont",
                water_signal="stress",
                direction="public_to_cockpit",
                reads="…",
                carries_tenant_context=True,
            )


class TestBridgeDirection:
    """Un pont partant du public vise un chemin nu."""

    def test_query_string_is_refused(self) -> None:
        with pytest.raises(ModuleBridgeError, match="chemin NU"):
            ModuleBridge(
                bridge_id="bad",
                target_path="/water?scope=world",
                label="Mauvais pont",
                water_signal="stress",
                direction="public_to_cockpit",
                reads="…",
            )

    def test_external_target_is_refused(self) -> None:
        with pytest.raises(ModuleBridgeError, match="chemin interne"):
            ModuleBridge(
                bridge_id="bad",
                target_path="https://example.invalid/water",
                label="Mauvais pont",
                water_signal="stress",
                direction="public_to_cockpit",
                reads="…",
            )

    def test_materials_bridge_stays_public_to_public(self) -> None:
        bridge = current_bridges().get("materials_public")
        assert bridge is not None
        assert bridge.direction == "public_to_public"
        assert bridge.requires_authentication is False

    def test_every_other_bridge_requires_authentication(self) -> None:
        for bridge in CURRENT_BRIDGES:
            if bridge.bridge_id != "materials_public":
                assert bridge.requires_authentication is True

    def test_public_document_exposes_only_public_bridges(self) -> None:
        document = current_bridges().as_public_document()
        assert document["bridge_count"] == len(CURRENT_BRIDGES)
        for entry in document["bridges"]:  # type: ignore[union-attr]
            assert entry["carries_tenant_context"] is False


class TestSynthesisShape:
    """Six facettes, toujours présentes, même vides."""

    def test_all_six_facets_are_always_present(self) -> None:
        synthesis = build_tenant_synthesis(company_id=COMPANY_A, entries=())
        assert tuple(f.facet for f in synthesis.facets) == FACET_ORDER
        assert synthesis.is_empty is True

    def test_an_empty_facet_is_not_omitted(self) -> None:
        synthesis = build_tenant_synthesis(
            company_id=COMPANY_A, entries=(_entry(COMPANY_A),)
        )
        assert synthesis.facet("action").is_empty is True
        assert synthesis.facet("risk").is_empty is False
        assert synthesis.is_empty is False

    def test_absent_value_requires_a_reason(self) -> None:
        with pytest.raises(TenantSynthesisError, match="motif d'absence"):
            _entry(COMPANY_A, value=None)

    def test_absent_value_with_reason_is_accepted_and_marked(self) -> None:
        entry = _entry(COMPANY_A, value=None, absence_reason="aucun screening enregistré")
        assert entry.is_absent is True

    def test_unknown_facet_is_refused(self) -> None:
        with pytest.raises(TenantSynthesisError, match="inconnue"):
            _entry(COMPANY_A, facet="esg_global")

    def test_entries_are_ordered_deterministically(self) -> None:
        synthesis = build_tenant_synthesis(
            company_id=COMPANY_A,
            entries=(
                _entry(COMPANY_A, label="Zebre", source_module="/water"),
                _entry(COMPANY_A, label="Alpha", source_module="/water"),
            ),
        )
        assert [e.label for e in synthesis.facet("risk").entries] == ["Alpha", "Zebre"]


class TestNoGlobalScore:
    """Jamais de score ESG global, ni de score hydrique composite."""

    def test_synthesis_exposes_no_score_field(self) -> None:
        payload = build_tenant_synthesis(company_id=COMPANY_A, entries=()).as_mapping()
        serialised = str(payload)
        for forbidden in ("score", "index", "note_globale", "overall"):
            assert forbidden not in serialised.lower()

    def test_module_defines_no_aggregation_helper(self) -> None:
        source = SYNTHESIS_MODULE.read_text(encoding="utf-8")
        tree = ast.parse(source)
        names = {
            node.name
            for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }
        for forbidden in ("score", "aggregate", "average", "mean", "weighted"):
            assert not any(forbidden in name.lower() for name in names), (
                f"fonction d'agrégation {forbidden!r} détectée — la synthèse "
                "compose, elle n'agrège pas."
            )

    def test_no_arithmetic_on_facet_values(self) -> None:
        """Les valeurs restent textuelles : aucune n'est convertie en nombre."""
        source = SYNTHESIS_MODULE.read_text(encoding="utf-8")
        assert "float(" not in source
        assert "sum(" not in source


class TestRiskAndConfidenceStaySeparate:
    """Deux facettes distinctes, deux vocabulaires nommés."""

    def test_risk_and_confidence_are_two_facets(self) -> None:
        assert "risk" in FACET_ORDER
        assert "confidence" in FACET_ORDER

    def test_each_entry_names_its_vocabulary(self) -> None:
        with pytest.raises(TenantSynthesisError, match="vocabulary"):
            _entry(COMPANY_A, vocabulary="  ")

    def test_mixed_vocabularies_within_a_facet_are_reported_not_resolved(self) -> None:
        synthesis = build_tenant_synthesis(
            company_id=COMPANY_A,
            entries=(
                _entry(COMPANY_A, vocabulary="water_screening_v1", value="high"),
                _entry(
                    COMPANY_A,
                    source_module="/resources",
                    label="Exposition matière",
                    vocabulary="resource_severity_v1",
                    value="high",
                ),
            ),
        )
        risk = synthesis.facet("risk")
        assert risk.has_mixed_vocabularies is True
        assert risk.vocabularies == ("resource_severity_v1", "water_screening_v1")


class TestTenantIsolation:
    """Tenant A et tenant B : une entrée croisée fait échouer, jamais filtrer."""

    def test_entry_from_another_tenant_raises(self) -> None:
        with pytest.raises(CrossTenantEntryError, match="mal scopée"):
            build_tenant_synthesis(
                company_id=COMPANY_A,
                entries=(_entry(COMPANY_A), _entry(COMPANY_B)),
            )

    def test_cross_tenant_entry_is_never_silently_dropped(self) -> None:
        """Un filtrage silencieux masquerait une requête mal scopée."""
        try:
            build_tenant_synthesis(company_id=COMPANY_A, entries=(_entry(COMPANY_B),))
        except CrossTenantEntryError as exc:
            assert str(COMPANY_B) in str(exc)
            assert str(COMPANY_A) in str(exc)
        else:  # pragma: no cover - le test échoue avant d'arriver ici
            pytest.fail("une entrée d'un autre tenant a été acceptée")

    def test_two_tenants_produce_independent_syntheses(self) -> None:
        synthesis_a = build_tenant_synthesis(
            company_id=COMPANY_A, entries=(_entry(COMPANY_A, label="A"),)
        )
        synthesis_b = build_tenant_synthesis(
            company_id=COMPANY_B, entries=(_entry(COMPANY_B, label="B"),)
        )
        assert [e.label for e in synthesis_a.facet("risk").entries] == ["A"]
        assert [e.label for e in synthesis_b.facet("risk").entries] == ["B"]
        assert synthesis_a.company_id != synthesis_b.company_id

    def test_company_id_must_be_positive(self) -> None:
        with pytest.raises(TenantSynthesisError, match="identifiant positif"):
            build_tenant_synthesis(company_id=0, entries=())


class TestBridgeDocumentParity:
    """Le document publié et le registre ne peuvent pas diverger en silence."""

    def test_docs_document_matches_the_registry(self) -> None:
        expected = (
            json.dumps(
                current_bridges().as_public_document(),
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
            + "\n"
        )
        assert DOCS_BRIDGES.read_text(encoding="utf-8") == expected, (
            "MODULE_BRIDGES.json est désynchronisé du registre — régénérer le "
            "document plutôt que l'éditer à la main."
        )

    def test_carbon_mirror_is_byte_identical(self) -> None:
        assert CARBON_BRIDGES.read_text(encoding="utf-8") == DOCS_BRIDGES.read_text(
            encoding="utf-8"
        )

    def test_published_document_carries_no_tenant_field(self) -> None:
        raw = DOCS_BRIDGES.read_text(encoding="utf-8")
        for forbidden in ("company_id", "tenant_id", "site_id", "user_id"):
            assert forbidden not in raw
