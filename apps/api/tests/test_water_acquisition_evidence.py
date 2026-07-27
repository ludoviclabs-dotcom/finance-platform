"""tests/test_water_acquisition_evidence.py — la preuve d'acquisition vient du
RAPPORT, jamais du payload brut (X4B-PREP, run 30306257628).

## Le défaut que ces tests verrouillent

`command_diff_ades()` lisait le payload brut Hub'Eau — un glob `*.json` dans le
répertoire d'artefacts — et y cherchait `payload_sha256`, `records_received` et
`pages`. Une réponse d'API ne porte aucune de ces clés : chacune rendait
`None`, et `int(None or 0)` les transformait en `0` **sans jamais lever**.

Au run 30306257628 cela a produit `run_checksum=null`, `run_bytes=0`, donc
« checksum ET longueur diffèrent des références » — un verdict
`content_changed` prononcé sur une absence de preuve prise pour une preuve
d'absence, alors que le rapport du même run portait exactement le checksum X3.

Le test central est
`TestRawPayloadIsNeverEvidence::test_a_raw_payload_cannot_be_read_as_evidence` :
il donne au lecteur un vrai payload Hub'Eau et exige qu'il REFUSE, plutôt que
de rendre des zéros.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from services.water.staging_ingestion import (
    StagingIngestionRefused,
    load_acquisition_evidence,
)

#: Checksum réel de l'acquisition ADES X3, tel qu'il figure dans les références
#: du constructeur de candidats. Recopié ici pour que le test dise ce qu'il
#: vérifie sans dépendre de l'ordre d'import des scripts.
ADES_X3_CHECKSUM = "54ac8e5b4d895f323ee352c1c7c8ddde3c9a3c5dae469b6e351ac46fc76ee00b"


def _report(tmp_path: Path, **overrides) -> Path:
    """Écrit un rapport de validation au format RÉEL — Markdown + bloc JSON.

    Le format n'est pas inventé pour le test : c'est celui que produit
    `reporting.ValidationReport.to_markdown()` et que lit déjà
    `load_validation_report()` pour l'ingestion.
    """
    payload = {
        "source_code": "HUBEAU_ADES",
        "release_key": "hubeau_ades-x3_technical_sample-x4b-prep",
        "verdict": "ready_for_staging",
        "executed_at": "2026-07-27T21:18:58+00:00",
        "dry_run": True,
        "bytes_received": 52139,
        "pages_fetched": 1,
        "records_received": 182,
        "records_normalized": 182,
        "payload_sha256": ADES_X3_CHECKSUM,
        "periods": ["2024-01-01/2024-03-31"],
        "geographies": ["09892X0679/EXH70"],
        "units": ["m"],
    }
    payload.update(overrides)
    for key, value in list(payload.items()):
        if value is _ABSENT:
            del payload[key]

    path = tmp_path / "acq_x3_technical_sample_HUBEAU_ADES.md"
    path.write_text(
        "# Validation live — HUBEAU_ADES\n\n"
        "**Verdict :** `ready_for_staging`\n\n"
        "## Données structurées\n\n"
        "```json\n" + json.dumps(payload, ensure_ascii=False, indent=2) + "\n```\n",
        encoding="utf-8",
    )
    return path


class _Absent:
    """Marqueur : ce champ doit être ABSENT, pas vide ni nul."""


_ABSENT = _Absent()


class TestRawPayloadIsNeverEvidence:
    """Le cœur du défaut : une réponse d'API n'atteste rien d'elle-même."""

    def test_a_raw_payload_cannot_be_read_as_evidence(self, tmp_path: Path) -> None:
        """Un vrai payload Hub'Eau doit être REFUSÉ, pas lu comme un rapport.

        C'est le fichier exact que l'ancien code globbait : il porte `count`
        et `data`, aucun `payload_sha256`, aucun `bytes_received`.
        """
        payload = tmp_path / "page-0001.json"
        payload.write_text(
            json.dumps(
                {
                    "count": 182,
                    "first": "https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/chroniques?size=200",
                    "next": None,
                    "api_version": "1.4.1",
                    "data": [{"code_bss": "09892X0679/EXH70", "niveau_nappe_eau": 12.3}],
                }
            ),
            encoding="utf-8",
        )
        with pytest.raises(StagingIngestionRefused, match="bloc JSON structuré"):
            load_acquisition_evidence(payload)

    def test_a_missing_size_never_becomes_zero(self, tmp_path: Path) -> None:
        """`int(None or 0)` est l'idiome qui a produit `run_bytes=0`."""
        path = _report(tmp_path, bytes_received=_ABSENT)
        with pytest.raises(StagingIngestionRefused, match="bytes_received"):
            load_acquisition_evidence(path)

    def test_a_missing_record_count_never_becomes_zero(self, tmp_path: Path) -> None:
        path = _report(tmp_path, records_received=_ABSENT)
        with pytest.raises(StagingIngestionRefused, match="records_received"):
            load_acquisition_evidence(path)

    def test_a_missing_page_count_never_becomes_zero(self, tmp_path: Path) -> None:
        path = _report(tmp_path, pages_fetched=_ABSENT)
        with pytest.raises(StagingIngestionRefused, match="pages_fetched"):
            load_acquisition_evidence(path)


class TestStructuredReportIsEvidence:
    def test_the_report_carries_every_field_the_diff_needs(self, tmp_path: Path) -> None:
        evidence = load_acquisition_evidence(_report(tmp_path))
        assert evidence.source_code == "HUBEAU_ADES"
        assert evidence.release_key == "hubeau_ades-x3_technical_sample-x4b-prep"
        assert evidence.bytes_received == 52139
        assert evidence.pages_fetched == 1
        assert evidence.records_received == 182
        assert evidence.records_normalized == 182
        assert evidence.payload_sha256 == ADES_X3_CHECKSUM
        assert evidence.periods and evidence.geographies

    def test_the_mapping_carries_no_raw_data(self, tmp_path: Path) -> None:
        """Une preuve se publie en artefact : elle porte des faits, pas la donnée."""
        mapping = load_acquisition_evidence(_report(tmp_path)).as_mapping()
        assert "data" not in mapping
        assert set(mapping) == {
            "source_code",
            "release_key",
            "verdict",
            "bytes_received",
            "pages_fetched",
            "records_received",
            "records_normalized",
            "payload_sha256",
            "periods",
            "geographies",
            "units",
        }


class TestEvidenceRefusesWhatItCannotAttest:
    def test_a_missing_report_is_refused(self, tmp_path: Path) -> None:
        with pytest.raises(StagingIngestionRefused, match="introuvable"):
            load_acquisition_evidence(tmp_path / "jamais-ecrit.md")

    def test_a_missing_checksum_is_refused(self, tmp_path: Path) -> None:
        path = _report(tmp_path, payload_sha256=_ABSENT)
        with pytest.raises(StagingIngestionRefused, match="payload_sha256"):
            load_acquisition_evidence(path)

    def test_a_malformed_checksum_is_refused(self, tmp_path: Path) -> None:
        path = _report(tmp_path, payload_sha256="pas-un-sha256")
        with pytest.raises(StagingIngestionRefused, match="payload_sha256"):
            load_acquisition_evidence(path)

    def test_a_divergent_source_is_refused(self, tmp_path: Path) -> None:
        """Le rapport d'une autre source n'atteste rien de celle demandée."""
        path = _report(tmp_path)
        with pytest.raises(StagingIngestionRefused, match="émis pour"):
            load_acquisition_evidence(path, expect_source_code="HUBEAU_BNPE_PRELEVEMENTS")

    def test_a_divergent_release_is_refused(self, tmp_path: Path) -> None:
        """Le défaut de la PR #174 : ADES existe dans TROIS candidats."""
        path = _report(tmp_path)
        with pytest.raises(StagingIngestionRefused, match="release"):
            load_acquisition_evidence(
                path, expect_release_key="hubeau_ades-minimal_pilot-x4b-prep"
            )

    def test_a_degraded_verdict_is_refused(self, tmp_path: Path) -> None:
        path = _report(tmp_path, verdict="blocked_registration_required")
        with pytest.raises(StagingIngestionRefused, match="verdict"):
            load_acquisition_evidence(path)

    def test_a_matching_source_and_release_pass(self, tmp_path: Path) -> None:
        evidence = load_acquisition_evidence(
            _report(tmp_path),
            expect_source_code="HUBEAU_ADES",
            expect_release_key="hubeau_ades-x3_technical_sample-x4b-prep",
        )
        assert evidence.verdict == "ready_for_staging"
