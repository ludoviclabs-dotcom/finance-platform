"""
quality_service.py — T2.6 : indicateurs de preuve & qualité + score audit.

La qualité d'un fact (1-5) est DÉDUITE de son source_path (pas de migration ni
de mutation des events append-only), avec override possible via meta.quality :
  1 mesure primaire · 2 facture/justificatif · 3 donnée d'activité estimée ·
  4 ratio monétaire · 5 extrapolation.

Le score audit (0-100) combine couverture de preuve, qualité moyenne, intégrité
de chaîne et fraîcheur des facteurs — formule documentée dans
docs/carbonco/AUDIT_SCORE.md (reproductible : compute_score est pure).
"""

from __future__ import annotations

import logging
from typing import Any

from db.database import db_available, get_db
from services import facts_service

logger = logging.getLogger(__name__)

QUALITY_LABELS = {
    1: "mesure primaire",
    2: "facture / justificatif",
    3: "donnée d'activité estimée",
    4: "ratio monétaire",
    5: "extrapolation",
}

# Poids du score audit (somme = 1.0) — cf. AUDIT_SCORE.md
W_COVERAGE = 0.30
W_QUALITY = 0.30
W_CHAIN = 0.30
W_FRESHNESS = 0.10


def derive_quality(source_path: str | None, *, has_evidence: bool = False, meta: dict | None = None) -> int:
    """Déduit la qualité 1-5 d'un fact. meta.quality (1-5) a priorité. Fonction pure."""
    if meta and isinstance(meta.get("quality"), int) and 1 <= meta["quality"] <= 5:
        return meta["quality"]
    sp = (source_path or "").lower()
    if sp.startswith("fec:"):
        return 4  # ratio monétaire (screening FEC, T4.3)
    if sp.startswith("manual:"):
        return 3  # saisie manuelle = donnée d'activité estimée
    if has_evidence:
        return 2  # justifiée par une pièce
    if sp.startswith("master"):
        return 2
    return 3  # défaut : donnée d'activité estimée


def compute_score(ind: dict[str, Any]) -> int:
    """Score audit 0-100 — fonction PURE et reproductible (cf. AUDIT_SCORE.md)."""
    coverage = float(ind.get("evidence_coverage") or 0.0)
    avg_q = ind.get("avg_quality")
    # Qualité → « bonté » 0-1 : quality 1 (primaire) = 1.0, quality 5 = 0.2.
    quality_goodness = ((6 - avg_q) / 5) if avg_q else 0.4
    chain = 1.0 if ind.get("chain_ok") else 0.0
    freshness = 1.0 if ind.get("fe_versions") else 0.5
    score = 100 * (
        W_COVERAGE * coverage
        + W_QUALITY * quality_goodness
        + W_CHAIN * chain
        + W_FRESHNESS * freshness
    )
    return round(max(0.0, min(100.0, score)))


def _empty() -> dict[str, Any]:
    ind = {
        "total_datapoints": 0,
        "with_evidence": 0,
        "evidence_coverage": 0.0,
        "quality_distribution": {str(i): 0 for i in range(1, 6)},
        "avg_quality": None,
        "fe_versions": [],
        "chain_ok": True,
        "open_anomalies": 0,
    }
    ind["audit_score"] = compute_score(ind)
    return ind


def _evidence_codes(company_id: int) -> set[str]:
    """Codes KPI ayant ≥1 pièce active (reconstruit depuis les events evidence)."""
    active: dict[str, set[str]] = {}
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT code, meta FROM facts_events
                WHERE company_id = %s
                  AND (source_path LIKE 'evidence:%%' OR source_path LIKE 'evidence-revoke:%%')
                ORDER BY computed_at ASC, id ASC
                """,
                (company_id,),
            )
            for r in cur.fetchall():
                meta = r["meta"] or {}
                code = r["code"]
                if meta.get("kind") == "evidence_attach":
                    piece = meta.get("evidence")
                    if isinstance(piece, dict) and piece.get("sha256"):
                        active.setdefault(code, set()).add(piece["sha256"])
                elif meta.get("kind") == "evidence_revoke":
                    active.get(code, set()).discard(meta.get("target_sha256"))
    return {code for code, shas in active.items() if shas}


def compute_indicators(company_id: int) -> dict[str, Any]:
    """Indicateurs de preuve & qualité pour le dashboard. No-op gracieux sans DB."""
    if not db_available():
        return _empty()

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT code, source_path, ef_id FROM facts_current WHERE company_id = %s "
                "AND code NOT LIKE 'evidence%%'",
                (company_id,),
            )
            kpis = [dict(r) for r in cur.fetchall()]

            cur.execute(
                """
                SELECT DISTINCT ef.version
                FROM facts_current fc
                JOIN emission_factors ef ON ef.id = fc.ef_id
                WHERE fc.company_id = %s AND ef.version IS NOT NULL
                """,
                (company_id,),
            )
            fe_versions = sorted(r["version"] for r in cur.fetchall())

    evidence_codes = _evidence_codes(company_id)
    qualities = [
        derive_quality(k["source_path"], has_evidence=k["code"] in evidence_codes)
        for k in kpis
    ]
    total = len(kpis)
    with_evidence = sum(1 for k in kpis if k["code"] in evidence_codes)
    distribution = {str(i): qualities.count(i) for i in range(1, 6)}
    chain = facts_service.verify_chain(company_id)

    ind: dict[str, Any] = {
        "total_datapoints": total,
        "with_evidence": with_evidence,
        "evidence_coverage": (with_evidence / total) if total else 0.0,
        "quality_distribution": distribution,
        "avg_quality": (sum(qualities) / total) if total else None,
        "fe_versions": fe_versions,
        "chain_ok": chain.ok,
        "open_anomalies": 0,  # branché au moteur d'alertes en T5.3
    }
    ind["audit_score"] = compute_score(ind)
    return ind
