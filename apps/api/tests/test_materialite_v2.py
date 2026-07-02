"""
test_materialite_v2.py — T7.4 : double matérialité conforme ESRS 1.

Couvre :
  - la règle « OU » (un enjeu est matériel si impact OU financier ≥ seuil —
    jamais le produit des deux), le détail par dimension et le mapping ESRS
  - les justifications par enjeu (persistance via positions)
  - les évaluations archivées : gel immuable, listing, détail, export ZIP
    auditable (manifest + CHECKSUMS cohérents).
"""

from __future__ import annotations

import hashlib
import io
import json
import zipfile

import pytest

from services import materialite_service as svc
from services.materialite_service import IssuePosition, compute_score

# ---------------------------------------------------------------------------
# Cœur pur — règle ESRS 1
# ---------------------------------------------------------------------------

def test_regle_ou_impact_seul():
    """Impact extrême + enjeu financier faible → matériel (l'ancien produit le ratait)."""
    result = compute_score([IssuePosition(code="BD-1", x=0.5, y=5.0)])
    issue = result.issues[0]
    assert issue.materiel is True
    assert issue.materiel_impact is True
    assert issue.materiel_financier is False
    # L'ancienne règle sqrt(0.5×5)=1.58 < 2.5 aurait classé l'enjeu non matériel
    assert issue.score < svc.MATERIALITY_THRESHOLD


def test_regle_ou_financier_seul():
    result = compute_score([IssuePosition(code="DP-1", x=4.5, y=1.0)])
    issue = result.issues[0]
    assert issue.materiel is True
    assert issue.materiel_financier is True
    assert issue.materiel_impact is False


def test_regle_ou_non_materiel():
    result = compute_score([IssuePosition(code="WR-1", x=2.0, y=2.4)])
    issue = result.issues[0]
    assert issue.materiel is False
    assert result.total_materiel == 0


def test_compteurs_et_esrs_a_activer():
    result = compute_score([
        IssuePosition(code="CC-1", x=4.0, y=4.0),   # E1, deux dimensions
        IssuePosition(code="BD-1", x=1.0, y=3.0),   # E4, impact seul
        IssuePosition(code="BC-1", x=3.0, y=1.0),   # G1, financier seul
        IssuePosition(code="WR-1", x=1.0, y=1.0),   # non matériel
    ])
    assert result.total_materiel == 3
    assert result.total_materiel_impact == 2
    assert result.total_materiel_financier == 2
    assert result.esrs_to_activate == ["ESRS E1", "ESRS E4", "ESRS G1"]
    assert result.threshold == svc.MATERIALITY_THRESHOLD
    assert "matérialité d'impact" in result.narrative


def test_justification_transportee():
    result = compute_score([
        IssuePosition(code="CC-3", x=4.0, y=4.0, justification="Fret amont dominant (80 % des achats).")
    ])
    assert result.issues[0].justification == "Fret amont dominant (80 % des achats)."


# ---------------------------------------------------------------------------
# API (mode /tmp)
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _reset_materialite_state():
    svc._POSITIONS_STORE.clear()
    svc._MEM_ASSESSMENTS.clear()
    svc._MEM_ASSESSMENT_ID["assessment"] = 1
    yield
    svc._POSITIONS_STORE.clear()
    svc._MEM_ASSESSMENTS.clear()
    svc._MEM_ASSESSMENT_ID["assessment"] = 1


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_positions_avec_justification(client, analyst_token):
    save = client.post(
        "/materialite/positions",
        json={"positions": [
            {"code": "CC-1", "x": 4.0, "y": 4.5, "justification": "Site industriel gaz-intensif."},
        ]},
        headers=_auth(analyst_token),
    )
    assert save.status_code == 204

    positions = client.get("/materialite/positions").json()
    assert positions[0]["justification"] == "Site industriel gaz-intensif."

    # Re-sauvegarde SANS justification → l'existante est conservée (COALESCE)
    client.post(
        "/materialite/positions",
        json={"positions": [{"code": "CC-1", "x": 3.0, "y": 3.0}]},
        headers=_auth(analyst_token),
    )
    positions = client.get("/materialite/positions").json()
    assert positions[0]["x"] == 3.0
    assert positions[0]["justification"] == "Site industriel gaz-intensif."


def test_assessment_gel_listing_detail_export(client, analyst_token):
    # Positions courantes
    client.post(
        "/materialite/positions",
        json={"positions": [
            {"code": "CC-1", "x": 4.0, "y": 4.5, "justification": "Énergie de procédé majoritaire."},
            {"code": "BD-1", "x": 1.0, "y": 3.5},
        ]},
        headers=_auth(analyst_token),
    )

    # Gel
    created = client.post(
        "/materialite/assessments",
        json={"label": "Évaluation 2026", "sector": "industrie"},
        headers=_auth(analyst_token),
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assessment_id = body["id"]
    assert body["total_issues"] == 2
    assert body["total_materiel"] == 2  # CC-1 (deux dims) + BD-1 (impact seul)

    # L'archive est un SNAPSHOT : modifier les positions ensuite ne la change pas
    client.post(
        "/materialite/positions",
        json={"positions": [{"code": "CC-1", "x": 0.5, "y": 0.5}]},
        headers=_auth(analyst_token),
    )
    detail = client.get(f"/materialite/assessments/{assessment_id}").json()
    frozen_cc1 = next(i for i in detail["result"]["issues"] if i["code"] == "CC-1")
    assert frozen_cc1["x"] == 4.0
    assert frozen_cc1["justification"] == "Énergie de procédé majoritaire."

    # Listing
    listing = client.get("/materialite/assessments").json()
    assert len(listing) == 1
    assert listing[0]["label"] == "Évaluation 2026"

    # Export ZIP auditable
    export = client.post(
        f"/materialite/assessments/{assessment_id}/export", headers=_auth(analyst_token)
    )
    assert export.status_code == 200, export.text
    assert export.headers["content-type"] == "application/zip"
    package_hash = export.headers["x-package-hash"]
    assert hashlib.sha256(export.content).hexdigest() == package_hash

    with zipfile.ZipFile(io.BytesIO(export.content)) as zf:
        names = set(zf.namelist())
        assert {"manifest.json", "materialite.pdf", "README.txt", "CHECKSUMS.sha256"} <= names
        manifest = json.loads(zf.read("manifest.json"))
        assert manifest["report"] == "MATERIALITE"
        assert manifest["total_materiel"] == 2
        # Le hash du PDF déclaré au manifest correspond au contenu réel
        pdf_bytes = zf.read("materialite.pdf")
        assert manifest["files"]["materialite.pdf"]["sha256"] == hashlib.sha256(pdf_bytes).hexdigest()
        assert pdf_bytes.startswith(b"%PDF")


def test_assessment_inconnu_404(client, analyst_token):
    assert client.get("/materialite/assessments/999").status_code == 404
    assert (
        client.post("/materialite/assessments/999/export", headers=_auth(analyst_token)).status_code
        == 404
    )


def test_assessment_requiert_analyst(client):
    resp = client.post("/materialite/assessments", json={"label": "x"})
    assert resp.status_code in (401, 403)
