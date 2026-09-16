"""Tests pour les endpoints Excel preview et validate.

Crée des workbooks openpyxl minimaux en mémoire ; le test de non-régression
M-12 valide le modèle officiel réellement servi par GET /excel/template.
"""

from __future__ import annotations

import io

import openpyxl
from fastapi.testclient import TestClient

from services.carbon_service import get_workbook_paths

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


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


def _upload_file(client: TestClient, endpoint: str, content: bytes, token: str | None,
                 filename: str = "test.xlsx"):
    return client.post(
        endpoint,
        files={"file": (filename, content, XLSX_MIME)},
        headers=auth(token) if token else {},
    )


class TestExcelAuth:
    def test_endpoints_require_token(self, client: TestClient) -> None:
        content = _make_xlsx(["Sheet1"])
        for endpoint in ("/excel/upload", "/excel/preview", "/excel/validate",
                         "/excel/read-cell", "/excel/read-range"):
            assert _upload_file(client, endpoint, content, None).status_code == 401, endpoint

    def test_viewer_cannot_upload(self, client: TestClient, viewer_token: str) -> None:
        resp = _upload_file(client, "/excel/validate", _make_xlsx(["Sheet1"]), viewer_token)
        assert resp.status_code == 403


class TestExcelUpload:
    def test_upload_valid_xlsx(self, client: TestClient, analyst_token: str) -> None:
        content = _make_xlsx(["Sheet1"])
        resp = _upload_file(client, "/excel/upload", content, analyst_token)
        assert resp.status_code == 200
        data = resp.json()
        assert data["sheet_count"] >= 1
        assert "sheets" in data


class TestExcelPreview:
    def test_preview_returns_sheets(self, client: TestClient, analyst_token: str) -> None:
        content = _make_xlsx(["Synthese_GES", "Energie"])
        resp = _upload_file(client, "/excel/preview", content, analyst_token)
        assert resp.status_code == 200
        data = resp.json()
        assert data["sheet_count"] == 2
        assert len(data["sheets"]) == 2
        assert data["sheets"][0]["name"] == "Synthese_GES"

    def test_preview_detects_carbon_domain(self, client: TestClient, analyst_token: str) -> None:
        content = _make_xlsx(["Paramètres", "Scope_1", "Synthese_GES"])
        resp = _upload_file(client, "/excel/preview", content, analyst_token)
        assert resp.status_code == 200
        assert resp.json()["detected_domain"] == "carbon"

    def test_preview_detects_esg_domain(self, client: TestClient, analyst_token: str) -> None:
        content = _make_xlsx(["VSME_Reporting", "Materialite"])
        resp = _upload_file(client, "/excel/preview", content, analyst_token)
        assert resp.status_code == 200
        assert resp.json()["detected_domain"] == "esg"

    def test_preview_returns_headers(self, client: TestClient, analyst_token: str) -> None:
        content = _make_xlsx(["Data"])
        resp = _upload_file(client, "/excel/preview", content, analyst_token)
        assert resp.status_code == 200
        sheet = resp.json()["sheets"][0]
        assert "headers" in sheet
        assert len(sheet["headers"]) > 0

    def test_preview_returns_sample_rows(self, client: TestClient, analyst_token: str) -> None:
        content = _make_xlsx(["Data"])
        resp = _upload_file(client, "/excel/preview", content, analyst_token)
        assert resp.status_code == 200
        sheet = resp.json()["sheets"][0]
        assert "sample_rows" in sheet

    def test_preview_rejects_non_xlsx(self, client: TestClient, analyst_token: str) -> None:
        resp = _upload_file(client, "/excel/preview", b"not an excel file" * 100, analyst_token)
        assert resp.status_code == 400


class TestExcelValidate:
    def test_official_template_passes_its_own_validation(
        self, client: TestClient, analyst_token: str,
    ) -> None:
        """M-12 : le modèle servi par GET /excel/template échouait à sa propre
        validation (plages `scope1_tco2e`… et feuille « Bilan GES » attendues)."""
        template = client.get("/excel/template?domain=carbon")
        assert template.status_code == 200
        resp = _upload_file(client, "/excel/validate", template.content, analyst_token,
                            filename="CarbonCo_Template_carbon.xlsx")
        assert resp.status_code == 200
        data = resp.json()
        assert data["domain"] == "carbon"
        assert data["status"] == "ok", data["issues"]
        assert data["named_ranges_missing"] == []
        assert data["sheets_missing"] == []

    def test_validate_matches_ingest_rules(self, client: TestClient, analyst_token: str) -> None:
        """Ce que /validate déclare conforme, l'import l'accepte structurellement."""
        content = get_workbook_paths()["carbon"].read_bytes()
        resp = _upload_file(client, "/excel/validate", content, analyst_token)
        assert resp.json()["status"] == "ok"

    def test_validate_missing_structure_is_error(self, client: TestClient, analyst_token: str) -> None:
        content = _make_xlsx(["Synthese_GES"])
        resp = client.post(
            "/excel/validate?domain=carbon",
            files={"file": ("test.xlsx", content, XLSX_MIME)},
            headers=auth(analyst_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "error"
        assert len(data["sheets_missing"]) > 0
        assert "CC_GES_Scope1" in data["named_ranges_missing"]
        assert any(i["level"] == "error" for i in data["issues"])

    def test_validate_unknown_workbook_is_error(self, client: TestClient, analyst_token: str) -> None:
        resp = _upload_file(client, "/excel/validate", _make_xlsx(["Data"]), analyst_token)
        assert resp.status_code == 200
        assert resp.json()["status"] == "error"

    def test_validate_rejects_non_xlsx_bytes(self, client: TestClient, analyst_token: str) -> None:
        resp = client.post(
            "/excel/validate",
            files={"file": ("tiny.xlsx", b"tiny", XLSX_MIME)},
            headers=auth(analyst_token),
        )
        assert resp.status_code == 400
