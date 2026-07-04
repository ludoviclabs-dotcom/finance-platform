"""Tests T2.3 — vérification publique /verify (recompute trois états).

Sans DB :
  - inspect_zip : recompute package/manifest hash + cohérence interne (pur)
  - verify_zip : authentic / altered / unknown / invalid (lookup mocké)
  - POST /verify/recompute : invalid / unknown / 400 vide (lookup réel = None en /tmp)
"""

from __future__ import annotations

import io
import zipfile
from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app
from services import export_package

client = TestClient(app)


def _build_pack(company_name: str = "Test SA"):
    with patch.object(export_package, "_fetch_audit_trail", return_value={"facts_events": [{"id": 1}], "datapoint_reviews": []}), \
         patch.object(export_package, "_fetch_snapshot", return_value={"x": 1}), \
         patch.object(export_package, "db_available", return_value=False):
        return export_package.build_package(company_id=1, company_name=company_name)


def _tamper_keep_manifest(pkg) -> bytes:
    """Re-zippe avec le MÊME manifest mais un audit_trail.json modifié."""
    with zipfile.ZipFile(io.BytesIO(pkg.zip_bytes)) as zf:
        manifest_bytes = zf.read("manifest.json")
        readme = zf.read("README.txt")
        snapshot = zf.read("snapshot.json")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", manifest_bytes)
        zf.writestr("audit_trail.json", b'{"tampered": true}')  # diffère du sha annoncé
        zf.writestr("snapshot.json", snapshot)
        zf.writestr("README.txt", readme)
    return buf.getvalue()


class TestInspectZip:
    def test_valid_pack_is_self_consistent(self) -> None:
        pkg = _build_pack()
        insp = export_package.inspect_zip(pkg.zip_bytes)
        assert insp["valid"] is True
        assert insp["self_consistent"] is True
        assert insp["package_hash"] == pkg.package_hash
        assert insp["manifest_hash"] == pkg.manifest_hash

    def test_not_a_zip_is_invalid(self) -> None:
        assert export_package.inspect_zip(b"not a zip at all")["valid"] is False

    def test_tampered_file_breaks_self_consistency(self) -> None:
        pkg = _build_pack()
        insp = export_package.inspect_zip(_tamper_keep_manifest(pkg))
        assert insp["valid"] is True
        assert insp["self_consistent"] is False  # audit_trail.json ≠ sha du manifest


class TestVerifyZip:
    def test_authentic_when_registered_and_intact(self) -> None:
        pkg = _build_pack()
        reg = {"package_hash": pkg.package_hash, "manifest_hash": pkg.manifest_hash, "company_name": "Test SA"}
        with patch.object(export_package, "lookup_by_hash", return_value=reg):
            res = export_package.verify_zip(pkg.zip_bytes)
        assert res["status"] == "authentic"

    def test_altered_when_bytes_differ_from_registration(self) -> None:
        pkg = _build_pack()
        tampered = _tamper_keep_manifest(pkg)
        # Le manifest est inchangé → lookup(manifest_hash) renvoie l'enregistrement
        # d'origine (package_hash original), mais les octets diffèrent → altered.
        reg = {"package_hash": pkg.package_hash, "manifest_hash": pkg.manifest_hash, "company_name": "Test SA"}

        def _lookup(h):
            return reg if h == pkg.manifest_hash else None

        with patch.object(export_package, "lookup_by_hash", side_effect=_lookup):
            res = export_package.verify_zip(tampered)
        assert res["status"] == "altered"

    def test_unknown_when_not_registered(self) -> None:
        pkg = _build_pack()
        with patch.object(export_package, "lookup_by_hash", return_value=None):
            res = export_package.verify_zip(pkg.zip_bytes)
        assert res["status"] == "unknown"

    def test_invalid_when_not_a_pack(self) -> None:
        assert export_package.verify_zip(b"garbage")["status"] == "invalid"


class TestRecomputeEndpoint:
    def test_empty_file_400(self) -> None:
        r = client.post("/verify/recompute", files={"file": ("x.zip", b"", "application/zip")})
        assert r.status_code == 400

    def test_garbage_is_invalid(self) -> None:
        r = client.post("/verify/recompute", files={"file": ("x.zip", b"not a zip", "application/zip")})
        assert r.status_code == 200
        assert r.json()["status"] == "invalid"

    def test_real_pack_unknown_without_db(self) -> None:
        # En mode /tmp (pas de DB), lookup_by_hash renvoie None → unknown.
        pkg = _build_pack()
        r = client.post("/verify/recompute", files={"file": ("pack.zip", pkg.zip_bytes, "application/zip")})
        assert r.status_code == 200
        assert r.json()["status"] == "unknown"
        assert r.json()["package_hash"] == pkg.package_hash
