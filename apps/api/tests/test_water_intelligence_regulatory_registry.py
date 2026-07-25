"""
tests/test_water_intelligence_regulatory_registry.py — registre juridique
versionné (P13, Wave D).

AUCUNE base requise, AUCUN réseau, AUCUNE horloge : le module testé est pur et
toutes les dates sont injectées.

## Matrice de couverture (exigences du MACRO-PROMPT D, commit D1)

| Exigence | Classe de test |
|---|---|
| version — plusieurs versions d'une même règle coexistent | `TestVersioning` |
| dates — ordre temporel impossible refusé | `TestDates` |
| futur — texte pas encore applicable | `TestFutureApplication` |
| matérialité — dépend d'une évaluation non tranchée | `TestMateriality` |
| transposition — directive vs règlement vs volontaire | `TestTransposition` |
| source — fait juridique non sourcé | `TestSourceGate` |
| historique — versions conservées, résolution par date | `TestHistory` |
| moteur limité à quatre verdicts | `TestOutcomeVocabulary` |
| aucun seuil réglementaire encodé | `TestNoEncodedThresholds` |
| pont vers le contrat public P02 | `TestPublicLegalStatusBridge` |
| registre courant : rien n'est vérifié | `TestCurrentRegistry` |
"""

from __future__ import annotations

import ast
from datetime import date
from pathlib import Path

import pytest

from services.water_intelligence.regulatory_registry import (
    CURRENT_RULES,
    REGISTRY_VERSION,
    ApplicabilityAssessment,
    EntityDetermination,
    EntityProfile,
    HumanReview,
    OfficialSource,
    RegulatoryRegistry,
    RegulatoryRegistryError,
    RegulatoryRule,
    ScopeCondition,
    TranspositionState,
    current_registry,
    evaluate_rule,
    to_public_legal_status,
)

MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "services"
    / "water_intelligence"
    / "regulatory_registry.py"
)

_REPO_ROOT = Path(__file__).resolve().parents[3]
DOCS_DOCUMENT = (
    _REPO_ROOT
    / "docs"
    / "carbonco"
    / "water-intelligence"
    / "contracts"
    / "REGULATORY_REGISTRY.json"
)
CARBON_MIRROR = (
    _REPO_ROOT / "apps" / "carbon" / "lib" / "water-intelligence" / "regulatory-registry.json"
)

AS_OF = date(2026, 7, 25)

SOURCE = OfficialSource(
    publisher="Éditeur officiel de test",
    reference="TEST-REF-001",
    url="https://example.invalid/texte",
    retrieved_on=date(2026, 1, 15),
    verified_by="Réviseur de test",
)
REVIEW = HumanReview(
    reviewed_by="Réviseur de test",
    reviewed_on=date(2026, 1, 20),
    scope_note="Revue de test — périmètre fictif, aucun texte réel instruit.",
)

CRITERION = ScopeCondition(
    criterion_code="test_in_scope",
    question="L'entité entre-t-elle dans le champ du texte de test ?",
)
MATERIALITY_CRITERION = ScopeCondition(
    criterion_code="test_material",
    question="L'eau est-elle matérielle pour l'entité ?",
    requires_materiality=True,
)


def _verified_rule(**overrides: object) -> RegulatoryRule:
    """Règle vérifiée de test — surchargée champ par champ par les tests."""
    base: dict[str, object] = {
        "rule_id": "TEST_RULE",
        "text_version": "v1",
        "jurisdiction": "EU",
        "instrument_kind": "directive",
        "title": "Texte de test",
        "text_reference": "TEST-REF-001",
        "legal_status": "in_force",
        "adoption": date(2024, 1, 1),
        "entry_into_force": date(2024, 6, 1),
        "application": date(2025, 1, 1),
        "conditions": (CRITERION,),
        "source": SOURCE,
        "human_review": REVIEW,
    }
    base.update(overrides)
    return RegulatoryRule(**base)  # type: ignore[arg-type]


def _profile(*determinations: EntityDetermination) -> EntityProfile:
    return EntityProfile(entity_ref="entite-de-test", determinations=determinations)


def _answer(criterion_code: str, answer: str) -> EntityDetermination:
    return EntityDetermination(
        criterion_code=criterion_code,
        answer=answer,  # type: ignore[arg-type]
        determined_by="Analyste de test",
        determined_on=date(2026, 2, 1),
        evidence="" if answer == "unknown" else "Preuve de test",
    )


class TestPurity:
    """Le module reste pur : ni base, ni réseau, ni horloge implicite."""

    def test_no_forbidden_import(self) -> None:
        tree = ast.parse(MODULE_PATH.read_text(encoding="utf-8"))
        forbidden = {
            "db",
            "db.database",
            "psycopg",
            "psycopg2",
            "requests",
            "httpx",
            "urllib",
            "urllib.request",
            "socket",
        }
        imported: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module)
        assert not (imported & forbidden), f"import interdit : {imported & forbidden}"

    def test_no_implicit_clock(self) -> None:
        """`as_of` est toujours injecté : aucun appel à l'horloge système."""
        source = MODULE_PATH.read_text(encoding="utf-8")
        assert "date.today()" not in source
        assert "datetime.now()" not in source
        assert "utcnow()" not in source


class TestSourceGate:
    """Un fait juridique non sourcé est refusé — risque nommé au registre."""

    def test_dates_without_source_are_refused_at_construction(self) -> None:
        with pytest.raises(RegulatoryRegistryError, match="non sourcé"):
            RegulatoryRule(
                rule_id="R",
                text_version="v1",
                jurisdiction="EU",
                instrument_kind="directive",
                title="Texte",
                text_reference="REF",
                application=date(2025, 1, 1),
            )

    def test_rule_without_source_is_unknown(self) -> None:
        rule = _verified_rule(source=None, adoption=None, entry_into_force=None, application=None)
        assessment = evaluate_rule(rule, _profile(_answer("test_in_scope", "yes")), as_of=AS_OF)
        assert assessment.outcome == "unknown"
        assert assessment.reasons == ("no_official_source",)
        assert "source" in assessment.missing_fields

    def test_rule_without_human_review_is_unknown(self) -> None:
        rule = _verified_rule(human_review=None)
        assessment = evaluate_rule(rule, _profile(_answer("test_in_scope", "yes")), as_of=AS_OF)
        assert assessment.outcome == "unknown"
        assert assessment.reasons == ("no_human_review",)
        assert "human_review" in assessment.missing_fields

    def test_source_requires_https_and_a_verifier(self) -> None:
        with pytest.raises(RegulatoryRegistryError, match="https"):
            OfficialSource(
                publisher="P",
                reference="R",
                url="http://example.invalid",
                retrieved_on=date(2026, 1, 1),
                verified_by="V",
            )
        with pytest.raises(RegulatoryRegistryError):
            OfficialSource(
                publisher="P",
                reference="R",
                url="https://example.invalid",
                retrieved_on=date(2026, 1, 1),
                verified_by="   ",
            )

    def test_human_review_requires_a_scope_note(self) -> None:
        with pytest.raises(RegulatoryRegistryError, match="scope_note"):
            HumanReview(reviewed_by="V", reviewed_on=date(2026, 1, 1), scope_note="  ")


class TestDates:
    """Un ordre temporel impossible est refusé, pas corrigé en silence."""

    def test_entry_into_force_before_adoption_is_refused(self) -> None:
        with pytest.raises(RegulatoryRegistryError, match="ordre temporel"):
            _verified_rule(adoption=date(2025, 1, 1), entry_into_force=date(2024, 1, 1))

    def test_application_before_entry_into_force_is_refused(self) -> None:
        with pytest.raises(RegulatoryRegistryError, match="ordre temporel"):
            _verified_rule(entry_into_force=date(2025, 6, 1), application=date(2025, 1, 1))

    def test_missing_application_yields_unknown(self) -> None:
        rule = _verified_rule(application=None)
        assessment = evaluate_rule(rule, _profile(_answer("test_in_scope", "yes")), as_of=AS_OF)
        assert assessment.outcome == "unknown"
        assert "application" in assessment.missing_fields


class TestFutureApplication:
    """Un texte pas encore applicable n'est jamais `in_scope`."""

    def test_future_application_is_out_of_scope_and_carries_the_date(self) -> None:
        rule = _verified_rule(application=date(2030, 1, 1))
        assessment = evaluate_rule(rule, _profile(_answer("test_in_scope", "yes")), as_of=AS_OF)
        assert assessment.outcome == "out_of_scope"
        assert assessment.reasons == ("not_yet_applicable",)
        assert assessment.applies_from == date(2030, 1, 1)

    def test_application_exactly_at_as_of_is_reached(self) -> None:
        rule = _verified_rule(application=AS_OF)
        assessment = evaluate_rule(rule, _profile(_answer("test_in_scope", "yes")), as_of=AS_OF)
        assert assessment.outcome == "in_scope"

    def test_repealed_text_is_out_of_scope(self) -> None:
        rule = _verified_rule(legal_status="repealed")
        assessment = evaluate_rule(rule, _profile(_answer("test_in_scope", "yes")), as_of=AS_OF)
        assert assessment.outcome == "out_of_scope"
        assert assessment.reasons == ("text_repealed",)


class TestMateriality:
    """La matérialité rend `conditional`, jamais `in_scope` par défaut."""

    def test_pending_materiality_is_conditional(self) -> None:
        rule = _verified_rule(conditions=(CRITERION, MATERIALITY_CRITERION))
        assessment = evaluate_rule(rule, _profile(_answer("test_in_scope", "yes")), as_of=AS_OF)
        assert assessment.outcome == "conditional"
        assert assessment.reasons == ("materiality_assessment_pending",)
        assert assessment.unresolved_criteria == ("test_material",)

    def test_material_yes_makes_it_in_scope(self) -> None:
        rule = _verified_rule(conditions=(CRITERION, MATERIALITY_CRITERION))
        profile = _profile(_answer("test_in_scope", "yes"), _answer("test_material", "yes"))
        assert evaluate_rule(rule, profile, as_of=AS_OF).outcome == "in_scope"

    def test_material_no_makes_it_out_of_scope(self) -> None:
        rule = _verified_rule(conditions=(CRITERION, MATERIALITY_CRITERION))
        profile = _profile(_answer("test_in_scope", "yes"), _answer("test_material", "no"))
        assessment = evaluate_rule(rule, profile, as_of=AS_OF)
        assert assessment.outcome == "out_of_scope"
        assert assessment.reasons == ("criterion_not_met",)

    def test_factual_gap_outranks_materiality(self) -> None:
        """Une matérialité « en attente » sur un périmètre inconnu n'a pas de
        sens : le critère factuel non tranché prime."""
        rule = _verified_rule(conditions=(CRITERION, MATERIALITY_CRITERION))
        assessment = evaluate_rule(rule, _profile(), as_of=AS_OF)
        assert assessment.outcome == "unknown"
        assert assessment.reasons == ("missing_entity_determination",)


class TestTransposition:
    """« Sans objet » et « non vérifié » sont deux choses différentes."""

    def test_regulation_cannot_carry_a_transposition_deadline(self) -> None:
        with pytest.raises(RegulatoryRegistryError, match="directement applicable"):
            _verified_rule(
                instrument_kind="regulation",
                transposition=TranspositionState(
                    status="pending", deadline=date(2026, 1, 1)
                ),
            )

    def test_voluntary_framework_cannot_be_transposed(self) -> None:
        with pytest.raises(RegulatoryRegistryError, match="ne se transpose pas"):
            _verified_rule(
                instrument_kind="voluntary_framework",
                transposition=TranspositionState(status="unknown"),
            )

    def test_not_applicable_cannot_carry_a_deadline(self) -> None:
        with pytest.raises(RegulatoryRegistryError, match="ne se transpose pas"):
            TranspositionState(status="not_applicable", deadline=date(2026, 1, 1))

    def test_directive_with_unknown_transposition_lists_it_as_missing(self) -> None:
        rule = _verified_rule(instrument_kind="directive")
        assert "transposition" in rule.missing_verification_fields()

    def test_regulation_does_not_list_transposition_as_missing(self) -> None:
        rule = _verified_rule(
            instrument_kind="regulation",
            transposition=TranspositionState(status="not_applicable"),
        )
        assert "transposition" not in rule.missing_verification_fields()


class TestVersioning:
    """Plusieurs versions d'une même règle coexistent sans écrasement."""

    def test_two_versions_of_the_same_rule_coexist(self) -> None:
        registry = RegulatoryRegistry(
            (
                _verified_rule(text_version="v1", application=date(2025, 1, 1)),
                _verified_rule(text_version="v2", application=date(2026, 1, 1)),
            ),
            registry_version="test",
        )
        assert len(registry) == 2
        assert registry.rule_ids == ("TEST_RULE",)
        assert len(registry.versions("TEST_RULE")) == 2

    def test_duplicate_version_is_refused(self) -> None:
        with pytest.raises(RegulatoryRegistryError, match="deux fois"):
            RegulatoryRegistry(
                (_verified_rule(text_version="v1"), _verified_rule(text_version="v1")),
                registry_version="test",
            )

    def test_registry_version_is_mandatory(self) -> None:
        with pytest.raises(RegulatoryRegistryError, match="registry_version"):
            RegulatoryRegistry((), registry_version="  ")


class TestHistory:
    """L'historique est le seul moyen de savoir ce qu'on affirmait hier."""

    def test_resolve_picks_the_version_applicable_at_the_date(self) -> None:
        registry = RegulatoryRegistry(
            (
                _verified_rule(text_version="v1", application=date(2025, 1, 1)),
                _verified_rule(text_version="v2", application=date(2026, 1, 1)),
            ),
            registry_version="test",
        )
        assert registry.resolve("TEST_RULE", as_of=date(2025, 6, 1)).text_version == "v1"
        assert registry.resolve("TEST_RULE", as_of=date(2026, 6, 1)).text_version == "v2"

    def test_older_versions_are_never_deleted(self) -> None:
        registry = RegulatoryRegistry(
            (
                _verified_rule(text_version="v1", application=date(2025, 1, 1)),
                _verified_rule(text_version="v2", application=date(2026, 1, 1)),
            ),
            registry_version="test",
        )
        registry.resolve("TEST_RULE", as_of=date(2026, 6, 1))
        assert [r.text_version for r in registry.versions("TEST_RULE")] == ["v1", "v2"]

    def test_unknown_rule_resolves_to_none(self) -> None:
        registry = RegulatoryRegistry((), registry_version="test")
        assert registry.resolve("ABSENT", as_of=AS_OF) is None

    def test_undated_version_is_returned_and_handled_as_unknown(self) -> None:
        """Une version non datée ne peut pas être écartée par la date : elle
        est rendue, et le moteur la traite en `unknown`."""
        registry = RegulatoryRegistry(
            (RegulatoryRule(
                rule_id="TEST_RULE",
                text_version="to-verify",
                jurisdiction="EU",
                instrument_kind="directive",
                title="Texte",
                text_reference="REF",
            ),),
            registry_version="test",
        )
        resolved = registry.resolve("TEST_RULE", as_of=AS_OF)
        assert resolved is not None
        assert evaluate_rule(resolved, _profile(), as_of=AS_OF).outcome == "unknown"


class TestOutcomeVocabulary:
    """Le moteur est limité à quatre verdicts, chacun motivé."""

    def test_only_four_outcomes_can_be_produced(self) -> None:
        registry = current_registry()
        outcomes = {a.outcome for a in registry.evaluate(_profile(), as_of=AS_OF)}
        assert outcomes <= {"in_scope", "out_of_scope", "conditional", "unknown"}

    def test_an_assessment_without_reason_is_refused(self) -> None:
        with pytest.raises(RegulatoryRegistryError, match="sans motif"):
            ApplicabilityAssessment(
                rule_id="R", text_version="v1", outcome="unknown", reasons=()
            )

    def test_assessment_is_serialisable_in_a_stable_shape(self) -> None:
        rule = _verified_rule(application=date(2030, 1, 1))
        payload = evaluate_rule(
            rule, _profile(_answer("test_in_scope", "yes")), as_of=AS_OF
        ).as_mapping()
        assert payload["outcome"] == "out_of_scope"
        assert payload["applies_from"] == "2030-01-01"
        assert payload["reasons"] == ["not_yet_applicable"]

    def test_missing_determination_is_unknown_not_a_guess(self) -> None:
        rule = _verified_rule()
        assessment = evaluate_rule(rule, _profile(), as_of=AS_OF)
        assert assessment.outcome == "unknown"
        assert assessment.unresolved_criteria == ("test_in_scope",)


class TestNoEncodedThresholds:
    """Aucun seuil réglementaire n'est encodé : le moteur ne calcule rien."""

    def test_profile_carries_no_size_metric(self) -> None:
        fields = set(EntityProfile.__dataclass_fields__)
        for forbidden in ("employees", "headcount", "turnover", "revenue", "balance_sheet"):
            assert forbidden not in fields

    def test_module_contains_no_numeric_threshold_comparison(self) -> None:
        """Un seuil se reconnaît à une comparaison avec un littéral numérique
        dans le moteur. Les dates en sont exclues : elles sont sourcées."""
        source = MODULE_PATH.read_text(encoding="utf-8")
        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, ast.Compare):
                for comparator in node.comparators:
                    assert not (
                        isinstance(comparator, ast.Constant)
                        and isinstance(comparator.value, (int, float))
                        and not isinstance(comparator.value, bool)
                    ), "comparaison à un seuil numérique détectée dans le registre"

    def test_a_determination_that_is_not_unknown_requires_evidence(self) -> None:
        with pytest.raises(RegulatoryRegistryError, match="preuve"):
            EntityDetermination(
                criterion_code="c",
                answer="yes",
                determined_by="A",
                determined_on=date(2026, 1, 1),
                evidence="  ",
            )

    def test_duplicate_determination_is_refused(self) -> None:
        with pytest.raises(RegulatoryRegistryError, match="ambiguïté"):
            _profile(_answer("c", "yes"), _answer("c", "no"))


class TestPublicLegalStatusBridge:
    """Conversion explicite vers le vocabulaire public P02."""

    def test_unverified_rule_is_always_unknown(self) -> None:
        rule = _verified_rule(human_review=None)
        assert to_public_legal_status(rule) == "unknown"

    def test_voluntary_framework_maps_to_voluntary(self) -> None:
        rule = _verified_rule(
            instrument_kind="voluntary_framework",
            transposition=TranspositionState(status="not_applicable"),
        )
        assert to_public_legal_status(rule) == "voluntary"

    def test_repealed_maps_to_out_of_scope_because_public_vocabulary_lacks_it(self) -> None:
        rule = _verified_rule(legal_status="repealed")
        assert to_public_legal_status(rule) == "out_of_scope"

    def test_directive_pending_transposition_is_reported_as_such(self) -> None:
        rule = _verified_rule(
            instrument_kind="directive",
            transposition=TranspositionState(status="pending", deadline=date(2027, 1, 1)),
        )
        assert to_public_legal_status(rule) == "transposition_pending"

    def test_in_force_regulation_maps_to_in_force(self) -> None:
        rule = _verified_rule(
            instrument_kind="regulation",
            transposition=TranspositionState(status="not_applicable"),
        )
        assert to_public_legal_status(rule) == "in_force"


class TestCurrentRegistry:
    """Le registre livré ne conclut rien — état correct du gate, pas un oubli."""

    def test_no_rule_is_verified(self) -> None:
        assert all(not rule.is_verified for rule in CURRENT_RULES)

    def test_every_rule_evaluates_to_unknown(self) -> None:
        registry = current_registry()
        profile = _profile(
            _answer("undertaking_in_reporting_scope", "yes"),
            _answer("water_topic_material", "yes"),
            _answer("framework_voluntarily_adopted", "yes"),
        )
        assessments = registry.evaluate(profile, as_of=AS_OF)
        assert assessments, "le registre courant ne doit pas être vide"
        assert all(a.outcome == "unknown" for a in assessments)
        assert all(a.reasons == ("no_official_source",) for a in assessments)

    def test_no_rule_carries_a_date(self) -> None:
        """Aucune date n'est reprise sans relevé officiel daté."""
        for rule in CURRENT_RULES:
            assert rule.adoption is None
            assert rule.entry_into_force is None
            assert rule.application is None

    def test_voluntary_frameworks_are_marked_non_binding(self) -> None:
        voluntary = {"GRI_303", "CDP_WATER", "TNFD_LEAP", "SBTN"}
        for rule in CURRENT_RULES:
            if rule.rule_id in voluntary:
                assert rule.instrument_kind == "voluntary_framework"
                assert not rule.is_binding
            else:
                assert rule.is_binding

    def test_binding_and_voluntary_are_both_present(self) -> None:
        kinds = {rule.is_binding for rule in CURRENT_RULES}
        assert kinds == {True, False}

    def test_verification_gaps_name_what_is_missing(self) -> None:
        gaps = current_registry().verification_gaps()
        assert len(gaps) == len(CURRENT_RULES)
        for gap in gaps:
            assert "source" in gap["missing_fields"]
            assert "human_review" in gap["missing_fields"]

    def test_canonical_document_is_deterministic_and_tenant_free(self) -> None:
        registry = current_registry()
        first = registry.canonical_json()
        assert first == registry.canonical_json()
        assert registry.canonical_document()["verified_rule_count"] == 0
        for forbidden in ("company_id", "tenant_id", "site_id", "user_id"):
            assert forbidden not in first

    def test_registry_version_is_declared(self) -> None:
        assert REGISTRY_VERSION.strip()
        assert current_registry().registry_version == REGISTRY_VERSION


class TestCanonicalDocumentParity:
    """Le document publié et le registre ne peuvent pas diverger en silence.

    Même discipline que `FIXTURE_MANIFEST.json` pour les contrats P02 : les
    mêmes octets sont validés côté Python et côté TypeScript.
    """

    def test_docs_document_matches_the_registry(self) -> None:
        expected = current_registry().canonical_json() + "\n"
        actual = DOCS_DOCUMENT.read_text(encoding="utf-8")
        assert actual == expected, (
            "REGULATORY_REGISTRY.json est désynchronisé du registre — "
            "régénérer le document plutôt que l'éditer à la main."
        )

    def test_carbon_mirror_is_byte_identical(self) -> None:
        assert CARBON_MIRROR.read_text(encoding="utf-8") == DOCS_DOCUMENT.read_text(
            encoding="utf-8"
        ), "le miroir apps/carbon a divergé du document canonique."
