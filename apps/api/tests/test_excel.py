"""Tests pour les endpoints Excel preview et validate.

Crée un workbook openpyxl minimal en mémoire pour éviter tout fichier sur disque.
"""

from __future__ import annotations

import io

import openpyxl
import pytest
from fastapi.testclient import TestClient


def _make_xlsx(sheet_names: list[str], with_data: bool = True) -> bytes:
    """Crée un fichier XLSX en mémoire avec les feuilles demandées."""
    wb = openpyxl.Workbook()
    # Renommer la feuille par défaut
    wb.active.title = sheet_names[0]
    if with_data:
        ws = wb.active
        ws.append(["Nom", "Valeur", "Unité"])
        ws.append(["Scope 1", 100.5, "tCO2e"])
        ws.append(["Scope 2", 50.0, "tCO2e"])

    for name in sheet_names[1:]:
        ws2 = wb.create_sheet(name)
        if with_data:
            ws2.append(["Col A", "Col B"])
            ws2.append([1, 2])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _upload_file(client: TestClient, endpoint: str, content: bytes, filename: str = "test.xlsx") -> dict:
    return client.post(
        endpoint,
        files={"file": (filename, content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )


class TestExcelUpload:
    def test_upload_valid_xlsx(self, client: TestClient) -> None:
        content = _make_xlsx(["Sheet1"])
        resp = _upload_file(client, "/excel/upload", content)
        assert resp.status_code == 200
        data = resp.json()
        assert data["sheet_count"] >= 1
        assert "sheets" in data


class TestExcelPreview:
    def test_preview_returns_sheets(self, client: TestClient) -> None:
        content = _make_xlsx(["Bilan GES", "Energie"])
        resp = _upload_file(client, "/excel/preview", content)
        assert resp.status_code == 200
        data = resp.json()
        assert data["sheet_count"] == 2
        assert len(data["sheets"]) == 2
        assert data["sheets"][0]["name"] == "Bilan GES"

    def test_preview_detects_carbon_domain(self, client: TestClient) -> None:
        content = _make_xlsx(["Bilan GES", "Energie", "Taxonomie"])
        resp = _upload_file(client, "/excel/preview", content)
        assert resp.status_code == 200
        assert resp.json()["detected_domain"] == "carbon"

    def test_preview_detects_esg_domain(self, client: TestClient) -> None:
        content = _make_xlsx(["VSME", "Scores ESG"])
        resp = _upload_file(client, "/excel/preview", content)
        assert resp.status_code == 200
        assert resp.json()["detected_domain"] == "esg"

    def test_preview_returns_headers(self, client: TestClient) -> None:
        content = _make_xlsx(["Data"])
        resp = _upload_file(client, "/excel/preview", content)
        assert resp.status_code == 200
        sheet = resp.json()["sheets"][0]
        assert "headers" in sheet
        assert len(sheet["headers"]) > 0

    def test_preview_returns_sample_rows(self, client: TestClient) -> None:
        content = _make_xlsx(["Data"])
        resp = _upload_file(client, "/excel/preview", content)
        assert resp.status_code == 200
        sheet = resp.json()["sheets"][0]
        assert "sample_rows" in sheet


class TestExcelValidate:
    def test_validate_ok_carbon(self, client: TestClient) -> None:
        content = _make_xlsx(["Bilan GES", "Energie", "Taxonomie"])
        resp = _upload_file(client, "/excel/validate", content)
        assert resp.status_code == 200
        data = resp.json()
        # Peut retourner "ok" ou "warning" (named ranges manquants), jamais "error"
        assert data["status"] in ("ok", "warning")
        assert "issues" in data

    def test_validate_missing_sheets(self, client: TestClient) -> None:
        # Workbook carbon avec une seule feuille sur 3 attendues
        content = _make_xlsx(["Bilan GES"])
        resp = client.post(
            "/excel/validate?domain=carbon",
            files={"file": ("test.xlsx", content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["sheets_missing"]) > 0
        # Au moins un warning pour les feuilles manquantes
        assert any(i["level"] == "warning" for i in data["issues"])

    def test_validate_tiny_file_error(self, client: TestClient) -> None:
        resp = client.post(
            "/excel/validate",
            files={"file": ("tiny.xlsx", b"tiny", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "error"
        assert any(i["level"] == "error" for i in data["issues"])
