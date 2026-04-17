"""
test_export_package.py — Tests unitaires du service export_package.

Tests sans DB :
  - build_package produit un ZIP valide avec tous les fichiers attendus
  - manifest.json est deterministe (mêmes données → même manifest hash)
  - Le package_hash est un SHA-256 hex valide (64 chars)
  - Le manifest contient le hash de chaque fichier embarqué

Tests DB (skippés si DATABASE_URL absent) :
  - lookup_by_hash retrouve un package inséré
"""

from __future__ import annotations

import io
import json
import os
import zipfile
from unittest.mock import patch

import pytest

from services import export_package


# ── Tests sans DB ────────────────────────────────────────────────────────────

class TestBuildPackage:
    def test_produces_valid_zip(self):
        """build_package doit retourner un ZIP lisible avec les 4 fichiers requis."""
        with patch.object(export_package, "_fetch_audit_trail", return_value={
            "facts_events": [], "datapoint_reviews": [],
        }), patch.object(export_package, "_fetch_snapshot", return_value={}), \
             patch.object(export_package, "db_available", return_value=False):
            pkg = export_package.build_package(
                company_id=1, company_name="Test SA", domain="consolidated",
            )

        with zipfile.ZipFile(io.BytesIO(pkg.zip_bytes)) as zf:
            names = set(zf.namelist())
        assert "manifest.json" in names
        assert "audit_trail.json" in names
        assert "snapshot.json" in names
        assert "README.txt" in names

    def test_package_hash_is_64_char_hex(self):
        with patch.object(export_package, "_fetch_audit_trail", return_value={"facts_events": [], "datapoint_reviews": []}), \
             patch.object(export_package, "_fetch_snapshot", return_value={}), \
             patch.object(export_package, "db_available", return_value=False):
            pkg = export_package.build_package(company_id=1, company_name="Test SA")

        assert len(pkg.package_hash) == 64
        assert all(c in "0123456789abcdef" for c in pkg.package_hash)
        assert len(pkg.manifest_hash) == 64

    def test_manifest_contains_file_hashes(self):
        """Le manifest signe audit_trail + snapshot (+ report.pdf si présent).
        Le README est informatif et EXCLU du manifest (contient generated_at non-deterministe)."""
        with patch.object(export_package, "_fetch_audit_trail", return_value={"facts_events": [], "datapoint_reviews": []}), \
             patch.object(export_package, "_fetch_snapshot", return_value={}), \
             patch.object(export_package, "db_available", return_value=False):
            pkg = export_package.build_package(company_id=1, company_name="Test SA")

        with zipfile.ZipFile(io.BytesIO(pkg.zip_bytes)) as zf:
            manifest_raw = zf.read("manifest.json")
        manifest = json.loads(manifest_raw)

        assert "files" in manifest
        assert "audit_trail.json" in manifest["files"]
        assert "snapshot.json" in manifest["files"]
        # README explicitement EXCLU du manifest
        assert "README.txt" not in manifest["files"]
        for entry in manifest["files"].values():
            assert "sha256" in entry
            assert len(entry["sha256"]) == 64

    def test_manifest_idempotent_same_input(self):
        """Même entrée (events vides) → même manifest hash (hors timestamp)."""
        with patch.object(export_package, "_fetch_audit_trail", return_value={"facts_events": [], "datapoint_reviews": []}), \
             patch.object(export_package, "_fetch_snapshot", return_value={}), \
             patch.object(export_package, "db_available", return_value=False):
            p1 = export_package.build_package(company_id=1, company_name="Test SA")
            p2 = export_package.build_package(company_id=1, company_name="Test SA")
        # Le manifest_hash doit être identique (exclut generated_at)
        assert p1.manifest_hash == p2.manifest_hash

    def test_package_hash_changes_with_content(self):
        """Un audit trail différent → package hash différent."""
        with patch.object(export_package, "_fetch_audit_trail", return_value={"facts_events": [{"x": 1}], "datapoint_reviews": []}), \
             patch.object(export_package, "_fetch_snapshot", return_value={}), \
             patch.object(export_package, "db_available", return_value=False):
            p1 = export_package.build_package(company_id=1, company_name="Test SA")

        with patch.object(export_package, "_fetch_audit_trail", return_value={"facts_events": [{"x": 2}], "datapoint_reviews": []}), \
             patch.object(export_package, "_fetch_snapshot", return_value={}), \
             patch.object(export_package, "db_available", return_value=False):
            p2 = export_package.build_package(company_id=1, company_name="Test SA")
        assert p1.package_hash != p2.package_hash
        assert p1.manifest_hash != p2.manifest_hash

    def test_includes_pdf_if_provided(self):
        fake_pdf = b"%PDF-1.4 fake content"
        with patch.object(export_package, "_fetch_audit_trail", return_value={"facts_events": [], "datapoint_reviews": []}), \
             patch.object(export_package, "_fetch_snapshot", return_value={}), \
             patch.object(export_package, "db_available", return_value=False):
            pkg = export_package.build_package(
                company_id=1, company_name="Test SA", report_pdf_bytes=fake_pdf,
            )
        with zipfile.ZipFile(io.BytesIO(pkg.zip_bytes)) as zf:
            assert "report.pdf" in zf.namelist()
            assert zf.read("report.pdf") == fake_pdf

    def test_readme_contains_manifest_hash(self):
        """Le README doit mentionner le manifest_hash (signature canonique)."""
        with patch.object(export_package, "_fetch_audit_trail", return_value={"facts_events": [], "datapoint_reviews": []}), \
             patch.object(export_package, "_fetch_snapshot", return_value={}), \
             patch.object(export_package, "db_available", return_value=False):
            pkg = export_package.build_package(company_id=1, company_name="Acme Corp")

        with zipfile.ZipFile(io.BytesIO(pkg.zip_bytes)) as zf:
            readme = zf.read("README.txt").decode("utf-8")
        assert pkg.manifest_hash in readme
        assert "Acme Corp" in readme
        # Verify URL should reference manifest_hash for auditability
        assert f"/verify/{pkg.manifest_hash}" in readme

    def test_filename_includes_company_id_and_short_hash(self):
        with patch.object(export_package, "_fetch_audit_trail", return_value={"facts_events": [], "datapoint_reviews": []}), \
             patch.object(export_package, "_fetch_snapshot", return_value={}), \
             patch.object(export_package, "db_available", return_value=False):
            pkg = export_package.build_package(company_id=42, company_name="Test")
        assert pkg.filename.startswith("carbonco-export-42-")
        assert pkg.filename.endswith(".zip")
        assert pkg.package_hash[:12] in pkg.filename

    def test_event_count_reflects_audit_trail(self):
        events = [{"id": i} for i in range(5)]
        with patch.object(export_package, "_fetch_audit_trail", return_value={"facts_events": events, "datapoint_reviews": []}), \
             patch.object(export_package, "_fetch_snapshot", return_value={}), \
             patch.object(export_package, "db_available", return_value=False):
            pkg = export_package.build_package(company_id=1, company_name="Test")
        assert pkg.event_count == 5

    def test_frozen_count_reflects_reviews(self):
        reviews = [
            {"id": 1, "status": "frozen"},
            {"id": 2, "status": "validated"},
            {"id": 3, "status": "frozen"},
        ]
        with patch.object(export_package, "_fetch_audit_trail", return_value={"facts_events": [], "datapoint_reviews": reviews}), \
             patch.object(export_package, "_fetch_snapshot", return_value={}), \
             patch.object(export_package, "db_available", return_value=False):
            pkg = export_package.build_package(company_id=1, company_name="Test")
        assert pkg.frozen_count == 2


class TestSha256Helper:
    def test_sha256_produces_hex(self):
        h = export_package._sha256_hex(b"hello")
        assert len(h) == 64
        assert h == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"


# ── Tests avec DB ────────────────────────────────────────────────────────────

@pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL absent — tests DB skippés",
)
class TestLookupByHashDb:
    def test_lookup_unknown_hash_returns_none(self):
        assert export_package.lookup_by_hash("0" * 64) is None

    def test_lookup_after_build_returns_metadata(self):
        with patch.object(export_package, "_fetch_audit_trail", return_value={"facts_events": [], "datapoint_reviews": []}), \
             patch.object(export_package, "_fetch_snapshot", return_value={}):
            pkg = export_package.build_package(company_id=1, company_name="Test DB Lookup")
        meta = export_package.lookup_by_hash(pkg.package_hash)
        assert meta is not None
        assert meta["package_hash"] == pkg.package_hash
