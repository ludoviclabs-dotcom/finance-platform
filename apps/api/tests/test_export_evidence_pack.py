"""Tests T2.4 — Evidence Pack : pièces embarquées + CHECKSUMS.sha256.

Sans DB : on mocke _fetch_evidence + get_storage pour injecter une pièce, et on
vérifie qu'elle est embarquée, listée dans le manifest, et couverte par un
CHECKSUMS.sha256 compatible `sha256sum -c`.
"""

from __future__ import annotations

import hashlib
import io
import zipfile
from unittest.mock import MagicMock, patch

from services import export_package

EVIDENCE_BYTES = b"%PDF-1.7 contenu de la piece justificative"
EVIDENCE_SHA = "a" * 64


def _build_with_evidence():
    piece = {
        "sha256": EVIDENCE_SHA,
        "storage_key": f"org/1/evidence/5/{EVIDENCE_SHA}.pdf",
        "filename": "facture.pdf",
    }
    fake_storage = MagicMock()
    fake_storage.get.return_value = EVIDENCE_BYTES
    with patch.object(export_package, "_fetch_audit_trail", return_value={"facts_events": [], "datapoint_reviews": []}), \
         patch.object(export_package, "_fetch_snapshot", return_value={}), \
         patch.object(export_package, "db_available", return_value=False), \
         patch.object(export_package, "_fetch_evidence", return_value=[piece]), \
         patch.object(export_package, "get_storage", return_value=fake_storage):
        return export_package.build_package(company_id=1, company_name="Test SA")


class TestEvidencePack:
    def test_evidence_and_checksums_embedded(self) -> None:
        pkg = _build_with_evidence()
        with zipfile.ZipFile(io.BytesIO(pkg.zip_bytes)) as zf:
            names = set(zf.namelist())
        assert any(n.startswith("evidence/") for n in names)
        assert "CHECKSUMS.sha256" in names

    def test_evidence_in_signed_manifest(self) -> None:
        pkg = _build_with_evidence()
        assert pkg.manifest["stats"]["evidence_count"] == 1
        ev_keys = [k for k in pkg.manifest["files"] if k.startswith("evidence/")]
        assert len(ev_keys) == 1
        assert pkg.manifest["files"][ev_keys[0]]["sha256"] == hashlib.sha256(EVIDENCE_BYTES).hexdigest()

    def test_checksums_match_every_file(self) -> None:
        pkg = _build_with_evidence()
        with zipfile.ZipFile(io.BytesIO(pkg.zip_bytes)) as zf:
            checksums = zf.read("CHECKSUMS.sha256").decode("utf-8")
            for line in checksums.strip().splitlines():
                sha, name = line.split("  ", 1)  # format sha256sum (deux espaces)
                assert hashlib.sha256(zf.read(name)).hexdigest() == sha
            assert "CHECKSUMS.sha256" not in checksums  # ne se référence pas lui-même

    def test_readme_documents_sha256sum_c(self) -> None:
        pkg = _build_with_evidence()
        with zipfile.ZipFile(io.BytesIO(pkg.zip_bytes)) as zf:
            readme = zf.read("README.txt").decode("utf-8")
        assert "sha256sum -c CHECKSUMS.sha256" in readme
