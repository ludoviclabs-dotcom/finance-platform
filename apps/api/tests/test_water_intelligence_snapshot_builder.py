"""tests/test_water_intelligence_snapshot_builder.py — reconstruction fidèle
d'un snapshot candidat (X4B-RECONSTRUCT).

Ces tests verrouillent ce que la PR #174 avait nommé sans pouvoir le corriger :
un snapshot ne se reconstruit **jamais** depuis la projection SQL, et une
mesure ne signe **jamais** rien.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date, datetime, timezone

import pytest

from models.water_intelligence import (
    MethodRef,
    WaterGeographyRef,
    WaterLicenseDecision,
    WaterMetricObservation,
    WaterQualityMetadata,
    WaterSourceReference,
)
from services.water_intelligence import public_snapshot_builder as builder
from services.water_intelligence.public_snapshot import (
    MAX_MANIFEST_BYTES_UNCOMPRESSED,
    SnapshotBudgetExceeded,
)
from services.water_intelligence.publication_decisions import current_registry
from services.water_intelligence.release_provenance import (
    ProvenanceMismatch,
    provenance_for,
    verify_registry_row,
)
from services.water_intelligence.source_attribution import stable_attribution

CLOCK = datetime(2026, 7, 27, 12, 0, tzinfo=timezone.utc)
ALLOWED = WaterLicenseDecision(
    allow_ingest=True, allow_store=True, allow_display=True, allow_derived_use=True
)


@dataclass
class FakePreparedRelease:
    """Double minimal d'une `PreparedRelease` — même surface consommée.

    Volontairement pas un `Mock` : le reconstructeur lit `provenance` et
    `observations`, et un double explicite rend visible ce qu'il exige
    réellement.
    """

    provenance: object
    _observations: list[WaterMetricObservation] = field(default_factory=list)

    @property
    def observations(self) -> list[WaterMetricObservation]:
        return self._observations

    @property
    def source_code(self) -> str:
        return self.provenance.source_code


def _release(source_code: str, count: int, *, with_url: bool = True):
    provenance = provenance_for(source_code, accessed_on=date(2026, 7, 26))
    source = WaterSourceReference(
        source_code=source_code,
        release_key=f"{source_code.lower()}-x4b",
        checksum_sha256="d" * 64,
        retrieved_at=date(2026, 7, 26),
        observed_period_start=date(2024, 1, 1),
        observed_period_end=date(2024, 3, 31),
        methodology_version="1.0.0",
        license=ALLOWED,
        attribution=provenance.attribution,
        source_information_url=provenance.information_url if with_url else None,
        source_refresh_cadence=provenance.refresh_cadence,
        source_last_updated_on=provenance.last_updated_on,
    )
    observations = [
        WaterMetricObservation(
            metric_code=f"{source_code.lower()}.metric",
            value=float(i),
            unit="m",
            geography=WaterGeographyRef(scope="france", code=f"G{i:05d}", label=f"G{i:05d}"),
            period_start=date(2024, 1, 1),
            period_end=date(2024, 1, 1),
            method=MethodRef(code="CC-WI-TEST", version="1.0.0"),
            quality=WaterQualityMetadata(
                data_status="observed", coverage_pct=100.0, confidence=90
            ),
            source=source,
            value_withheld=False,
        )
        for i in range(count)
    ]
    return FakePreparedRelease(provenance=provenance, _observations=observations)


class TestReconstructionUsesTheRealAssembler:
    def test_a_prepared_release_becomes_a_real_snapshot(self) -> None:
        result = builder.reconstruct_candidate(
            label="A", releases=[_release("HUBEAU_ADES", 5)], generated_at=CLOCK
        )
        assert result.snapshot.included_source_codes == ("HUBEAU_ADES",)
        assert result.observation_count == 5
        assert result.snapshot.is_empty is False

    def test_provenance_survives_reconstruction(self) -> None:
        """Le défaut que tout ceci corrige : une provenance muette."""
        result = builder.reconstruct_candidate(
            label="A", releases=[_release("HUBEAU_ADES", 3)], generated_at=CLOCK
        )
        payload = result.snapshot.canonical_json()
        assert "hubeau.eaufrance.fr/page/api-piezometrie" in payload
        assert "quotidiennement" in payload

    def test_a_release_without_provenance_is_refused_not_assembled(self) -> None:
        release = _release("HUBEAU_ADES", 2)
        release.provenance = None
        with pytest.raises(builder.SnapshotReconstructionError):
            builder.reconstruct_candidate(
                label="A", releases=[release], generated_at=CLOCK
            )

    def test_a_source_without_official_url_is_excluded_by_the_real_gate(self) -> None:
        """Le reconstructeur ne réimplémente aucune règle : l'assembleur écarte."""
        result = builder.reconstruct_candidate(
            label="A",
            releases=[_release("HUBEAU_ADES", 3, with_url=False)],
            generated_at=CLOCK,
        )
        assert result.snapshot.included_source_codes == ()
        assert any(e.source_code == "HUBEAU_ADES" for e in result.snapshot.exclusions)


class TestMeasurementNeverSigns:
    def test_the_real_registry_stays_empty_before_and_after(self) -> None:
        assert current_registry().approved_source_codes == ()
        builder.reconstruct_candidate(
            label="A", releases=[_release("HUBEAU_ADES", 3)], generated_at=CLOCK
        )
        assert current_registry().approved_source_codes == ()

    def test_the_measurement_context_names_itself_as_worthless(self) -> None:
        registry = builder.measurement_registry(["HUBEAU_ADES"])
        entry = registry.as_manifest_entries()[0]
        assert "candidate_measurement_only" in entry["reason"]
        assert "aucune approbation humaine" in entry["reason"]
        assert "non humain" in entry["reviewed_by"]

    def test_the_measurement_reviewer_is_not_plausible_as_a_person(self) -> None:
        """Un réviseur plausible rendrait un artefact de run confondable avec
        une signature six mois plus tard."""
        assert "sans valeur de signature" in builder.MEASUREMENT_REVIEWER
        assert builder.MEASUREMENT_REVIEW_DATE == date(1970, 1, 1)


class TestTwoCanonicalFormsStayDistinct:
    """Les confondre ferait mesurer le budget sur la mauvaise forme."""

    def test_payload_is_compact_and_document_is_indented(self) -> None:
        result = builder.reconstruct_candidate(
            label="A", releases=[_release("HUBEAU_ADES", 3)], generated_at=CLOCK
        )
        payload = builder.canonical_payload_bytes(result.snapshot)
        document = builder.canonical_document_bytes(result.snapshot)
        assert len(document) > len(payload)
        assert document.endswith(b"\n")

    def test_both_forms_carry_the_same_values(self) -> None:
        result = builder.reconstruct_candidate(
            label="A", releases=[_release("HUBEAU_ADES", 3)], generated_at=CLOCK
        )
        assert json.loads(builder.canonical_payload_bytes(result.snapshot)) == json.loads(
            builder.canonical_document_bytes(result.snapshot)
        )

    def test_the_budget_is_measured_on_the_served_payload(self) -> None:
        result = builder.reconstruct_candidate(
            label="A", releases=[_release("HUBEAU_ADES", 3)], generated_at=CLOCK
        )
        assert result.payload_bytes == result.snapshot.payload_bytes()
        assert result.payload_bytes <= MAX_MANIFEST_BYTES_UNCOMPRESSED


class TestDeterminism:
    def test_same_input_gives_the_same_bytes(self) -> None:
        a = builder.reconstruct_candidate(
            label="A", releases=[_release("HUBEAU_ADES", 4)], generated_at=CLOCK
        )
        b = builder.reconstruct_candidate(
            label="A", releases=[_release("HUBEAU_ADES", 4)], generated_at=CLOCK
        )
        assert builder.canonical_payload_bytes(a.snapshot) == builder.canonical_payload_bytes(
            b.snapshot
        )
        assert a.snapshot.etag() == b.snapshot.etag()

    def test_input_order_does_not_change_the_bytes(self) -> None:
        """L'assembleur trie : deux ordres d'entrée rendent les mêmes octets."""
        ades = _release("HUBEAU_ADES", 3)
        bnpe = _release("HUBEAU_BNPE_PRELEVEMENTS", 3)
        a = builder.reconstruct_candidate(
            label="AB", releases=[ades, bnpe], generated_at=CLOCK
        )
        b = builder.reconstruct_candidate(
            label="BA", releases=[bnpe, ades], generated_at=CLOCK
        )
        assert builder.canonical_payload_bytes(a.snapshot) == builder.canonical_payload_bytes(
            b.snapshot
        )


class TestBudgetIsNeverBypassed:
    def test_an_oversized_candidate_raises_and_is_not_truncated(self) -> None:
        with pytest.raises(SnapshotBudgetExceeded):
            builder.reconstruct_candidate(
                label="trop gros",
                releases=[_release("HUBEAU_ADES", 4000)],
                generated_at=CLOCK,
            )

    def test_gzip_is_reported_but_is_not_the_budget(self) -> None:
        result = builder.reconstruct_candidate(
            label="A", releases=[_release("HUBEAU_ADES", 5)], generated_at=CLOCK
        )
        assert result.payload_bytes_gzip < result.payload_bytes
        assert result.as_mapping()["payload_bytes"] == result.payload_bytes


class TestRegistryIsVerifiedNotTrusted:
    """La ligne du Source Registry est confrontée à la configuration.

    Défaut trouvé par la CI DB-gated, pas par une relecture : le libellé
    d'attribution d'une release porte sa DATE DE CONSULTATION, tandis que la
    ligne du registre est semée une fois. Exiger l'égalité entre les deux
    faisait échouer toute ingestion dont la date différait du jour du semis —
    c'est-à-dire presque toutes, en production comme en test.
    """

    def _row(self, **overrides):
        base = {
            "attribution_text": stable_attribution("HUBEAU_ADES"),
            "license_code": "etalab-2.0",
        }
        base.update(overrides)
        return base

    def test_a_matching_row_passes(self) -> None:
        p = provenance_for("HUBEAU_ADES", accessed_on=date(2026, 7, 26))
        verify_registry_row(p, self._row())

    def test_the_consultation_date_does_not_break_verification(self) -> None:
        """Deux dates de consultation, une seule ligne de registre."""
        row = self._row()
        for day in (date(2026, 7, 26), date(2027, 1, 1)):
            verify_registry_row(provenance_for("HUBEAU_ADES", accessed_on=day), row)

    def test_a_stale_attribution_is_refused(self) -> None:
        p = provenance_for("HUBEAU_ADES", accessed_on=date(2026, 7, 26))
        with pytest.raises(ProvenanceMismatch, match="diverge"):
            verify_registry_row(p, self._row(attribution_text="Source : Hub'Eau"))

    def test_a_divergent_license_code_is_refused(self) -> None:
        p = provenance_for("HUBEAU_ADES", accessed_on=date(2026, 7, 26))
        with pytest.raises(ProvenanceMismatch, match="license_code"):
            verify_registry_row(p, self._row(license_code="cc-by-4.0"))

    def test_license_code_case_is_not_a_divergence(self) -> None:
        """`ETALAB-2.0` et `etalab-2.0` sont le même fait, écrit deux fois."""
        p = provenance_for("HUBEAU_ADES", accessed_on=date(2026, 7, 26))
        verify_registry_row(p, self._row(license_code="ETALAB-2.0"))

    def test_the_stable_form_carries_no_consultation_date(self) -> None:
        assert "Consultées le" not in stable_attribution("HUBEAU_ADES")
        assert "Consultées le" in provenance_for(
            "HUBEAU_ADES", accessed_on=date(2026, 7, 26)
        ).attribution


class TestAttributionDriftIsDetectedWhereItCanBeRepaired:
    """Un refus dont la cause est ailleurs n'aide personne.

    Défaut trouvé en revue (PR #175) : sur une base de staging persistante
    semée AVANT la forme stable, `attribution_text` gardait l'ancien libellé
    daté. `verify_registry_row` rejetait alors chaque ingestion, tandis que
    `staging_rehearsal seed-sources` — le remède que le message d'erreur
    désignait — répondait `already_present` sans rien signaler : il ne
    contrôlait que les capacités de licence et le `license_code`.

    L'écart est désormais détecté à la SEMAILLE, là où un opérateur peut le
    traiter, et le message d'erreur d'ingestion ne promet plus une réparation
    automatique qui n'existe pas.
    """

    def test_seeding_compares_the_attribution_too(self) -> None:
        from pathlib import Path

        from scripts.water_intelligence import staging_rehearsal

        source = Path(staging_rehearsal.__file__).read_text(encoding="utf-8")
        assert 'drift.append("attribution_text")' in source

    def test_the_refusal_does_not_promise_an_automatic_repair(self) -> None:
        p = provenance_for("HUBEAU_ADES", accessed_on=date(2026, 7, 26))
        with pytest.raises(ProvenanceMismatch) as caught:
            verify_registry_row(
                p,
                {
                    "attribution_text": "Source : Hub'Eau (ancien libellé daté)",
                    "license_code": "etalab-2.0",
                },
            )
        message = str(caught.value)
        assert "ne le répare pas" in message
        # Le geste réel est nommé pour chacun des deux cas.
        assert "jetable" in message and "persistante" in message

    def test_the_seeded_form_is_the_one_the_writer_verifies(self) -> None:
        """Si les deux divergeaient, toute ingestion échouerait sur une base
        pourtant fraîchement semée."""
        from scripts.water_intelligence.staging_rehearsal import declared_attribution

        assert declared_attribution("HUBEAU_ADES") == stable_attribution("HUBEAU_ADES")
