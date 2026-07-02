"""
materialite_service.py — Scoring + sauvegarde positions matrice double matérialité
(Phase 4, durcie en T7.4).

Fonctionnalités :
  - 5 secteurs préremplis (tech, industrie, retail, services, finance)
  - Double matérialité conforme ESRS 1 : un enjeu est matériel si sa dimension
    IMPACT (y) OU sa dimension FINANCIÈRE (x) atteint le seuil — règle « OU »,
    pas le produit des deux. Le score combiné sqrt(x×y) est conservé pour
    l'affichage/tri mais ne détermine plus la matérialité.
  - Justification par enjeu (exigée par les auditeurs pour documenter la démarche)
  - Versions archivées (materialite_assessments) : une évaluation figée par
    exercice, immuable, exportable en ZIP auditable (voir materialite_export)
  - Sauvegarde des positions personnalisées (drag & drop)
  - Génération de narratif déterministe

Mapping enjeu → standard ESRS à couvrir : utilisé pour recommander l'activation
des standards en aval (VSME C1/C2, couverture ESRS).
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Preset sectors — 5 secteurs avec positions ESRS préremplies
# ---------------------------------------------------------------------------

SECTOR_PRESETS: dict[str, dict[str, dict[str, float]]] = {
    "tech": {
        # Impact, Probabilité pour les enjeux ESRS les plus matériels en tech
        "CC-1":   {"x": 3.5, "y": 3.0},  # GES scope 1
        "CC-2":   {"x": 4.0, "y": 3.5},  # GES scope 2
        "CC-3":   {"x": 4.5, "y": 4.0},  # GES scope 3 (data centers, supply chain)
        "ER-1":   {"x": 3.0, "y": 3.5},  # Énergie (data centers énergivores)
        "WR-1":   {"x": 2.0, "y": 2.0},  # Eau
        "BD-1":   {"x": 1.5, "y": 1.5},  # Biodiversité
        "CE-1":   {"x": 3.5, "y": 3.5},  # Déchets électroniques
        "WO-1":   {"x": 4.0, "y": 4.5},  # Conditions travail
        "WO-2":   {"x": 3.5, "y": 4.0},  # Égalité H/F
        "BC-1":   {"x": 4.0, "y": 4.5},  # Gouvernance & éthique
        "DP-1":   {"x": 4.5, "y": 4.5},  # Protection données
        "SC-1":   {"x": 3.0, "y": 3.0},  # Droits chaîne valeur
    },
    "industrie": {
        "CC-1":   {"x": 4.5, "y": 4.5},  # GES scope 1 très élevé
        "CC-2":   {"x": 3.5, "y": 4.0},
        "CC-3":   {"x": 4.0, "y": 4.0},
        "ER-1":   {"x": 4.0, "y": 4.5},  # Énergie majeure
        "WR-1":   {"x": 3.5, "y": 3.5},  # Eau
        "BD-1":   {"x": 3.0, "y": 3.0},  # Biodiversité (sites industriels)
        "CE-1":   {"x": 3.5, "y": 4.0},  # Déchets industriels
        "WO-1":   {"x": 4.5, "y": 4.5},  # Santé/sécurité critique
        "WO-2":   {"x": 3.0, "y": 3.0},
        "BC-1":   {"x": 3.5, "y": 3.5},
        "DP-1":   {"x": 2.0, "y": 2.0},
        "SC-1":   {"x": 4.0, "y": 4.0},  # Droits fournisseurs
    },
    "retail": {
        "CC-1":   {"x": 2.5, "y": 2.5},
        "CC-2":   {"x": 3.0, "y": 3.0},
        "CC-3":   {"x": 4.5, "y": 4.5},  # Scope 3 dominant (produits achetés)
        "ER-1":   {"x": 3.0, "y": 3.5},
        "WR-1":   {"x": 2.0, "y": 2.5},
        "BD-1":   {"x": 2.5, "y": 2.5},
        "CE-1":   {"x": 4.0, "y": 4.0},  # Emballages/déchets
        "WO-1":   {"x": 4.0, "y": 4.5},  # Travailleurs (logistique)
        "WO-2":   {"x": 3.5, "y": 3.5},
        "BC-1":   {"x": 3.5, "y": 3.5},
        "DP-1":   {"x": 4.0, "y": 4.0},  # Données clients
        "SC-1":   {"x": 4.5, "y": 4.5},  # Droits supply chain (pays tiers)
    },
    "services": {
        "CC-1":   {"x": 2.0, "y": 2.0},
        "CC-2":   {"x": 2.5, "y": 2.5},
        "CC-3":   {"x": 3.0, "y": 3.0},  # Déplacements, cloud
        "ER-1":   {"x": 2.5, "y": 2.5},
        "WR-1":   {"x": 1.5, "y": 1.5},
        "BD-1":   {"x": 1.5, "y": 1.0},
        "CE-1":   {"x": 2.0, "y": 2.0},
        "WO-1":   {"x": 3.5, "y": 4.0},  # Bien-être salariés clé
        "WO-2":   {"x": 4.0, "y": 4.5},  # Diversité & inclusion
        "BC-1":   {"x": 4.5, "y": 4.5},  # Gouvernance critique
        "DP-1":   {"x": 4.0, "y": 4.0},
        "SC-1":   {"x": 2.5, "y": 2.5},
    },
    "finance": {
        "CC-1":   {"x": 1.5, "y": 1.5},  # Scope 1 faible
        "CC-2":   {"x": 2.0, "y": 2.0},
        "CC-3":   {"x": 4.5, "y": 4.5},  # Scope 3 via financed emissions
        "ER-1":   {"x": 2.0, "y": 2.0},
        "WR-1":   {"x": 1.0, "y": 1.0},
        "BD-1":   {"x": 2.0, "y": 2.0},  # Impact via financements
        "CE-1":   {"x": 1.5, "y": 1.5},
        "WO-1":   {"x": 3.0, "y": 3.5},
        "WO-2":   {"x": 3.5, "y": 4.0},  # Diversité financiers
        "BC-1":   {"x": 5.0, "y": 5.0},  # Gouvernance critique (systémique)
        "DP-1":   {"x": 4.5, "y": 4.5},  # Données financières
        "SC-1":   {"x": 3.5, "y": 4.0},  # Due diligence ESG investissements
    },
}

# Labels des enjeux
ISSUE_LABELS: dict[str, str] = {
    "CC-1": "Émissions GES Scope 1",
    "CC-2": "Émissions GES Scope 2",
    "CC-3": "Émissions GES Scope 3",
    "ER-1": "Consommation d'énergie",
    "WR-1": "Eau et ressources marines",
    "BD-1": "Biodiversité et écosystèmes",
    "CE-1": "Économie circulaire et déchets",
    "WO-1": "Santé et sécurité au travail",
    "WO-2": "Égalité, diversité et inclusion",
    "BC-1": "Gouvernance et éthique",
    "DP-1": "Protection des données",
    "SC-1": "Droits humains chaîne de valeur",
}

MATERIALITY_THRESHOLD = 2.5  # dimension (impact OU financière) ≥ seuil → matériel

# Enjeu → standard ESRS à couvrir si l'enjeu est matériel (recommandation aval)
ISSUE_ESRS: dict[str, str] = {
    "CC-1": "ESRS E1",
    "CC-2": "ESRS E1",
    "CC-3": "ESRS E1",
    "ER-1": "ESRS E1",
    "WR-1": "ESRS E3",
    "BD-1": "ESRS E4",
    "CE-1": "ESRS E5",
    "WO-1": "ESRS S1",
    "WO-2": "ESRS S1",
    "SC-1": "ESRS S2",
    "DP-1": "ESRS S4",
    "BC-1": "ESRS G1",
}

# In-memory stores (remplacés par DB quand disponible)
_POSITIONS_STORE: dict[tuple[int, str], dict[str, Any]] = {}
_MEM_ASSESSMENTS: list[dict[str, Any]] = []
_MEM_ASSESSMENT_ID = {"assessment": 1}


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class IssuePosition(BaseModel):
    code: str
    x: float = Field(..., ge=0.0, le=5.0, description="Matérialité financière — probabilité × ampleur (0-5)")
    y: float = Field(..., ge=0.0, le=5.0, description="Matérialité d'impact — sévérité × échelle (0-5)")
    justification: str | None = Field(
        default=None, max_length=2000,
        description="Justification du positionnement (attendue par l'auditeur pour les enjeux matériels)",
    )


class SavePositionsRequest(BaseModel):
    positions: list[IssuePosition]
    sector: str | None = None


class ScoredIssue(BaseModel):
    code: str
    label: str
    x: float
    y: float
    score: float
    materiel: bool            # règle ESRS 1 : impact OU financier ≥ seuil
    materiel_impact: bool     # dimension impact (y) ≥ seuil
    materiel_financier: bool  # dimension financière (x) ≥ seuil
    pillar: str  # E | S | G
    esrs: str | None = None   # standard ESRS à couvrir si matériel
    justification: str | None = None


class MaterialiteScoreResponse(BaseModel):
    sector: str | None
    issues: list[ScoredIssue]
    total_materiel: int
    total_materiel_impact: int
    total_materiel_financier: int
    total_issues: int
    score_moyen: float
    threshold: float
    esrs_to_activate: list[str]
    narrative: str


class SectorPresetsResponse(BaseModel):
    sectors: list[str]
    default: str
    issues: dict[str, str]  # code → label


class AssessmentCreate(BaseModel):
    label: str | None = Field(default=None, max_length=200)
    sector: str | None = None


class AssessmentSummary(BaseModel):
    id: int
    company_id: int
    label: str
    sector: str | None
    threshold: float
    total_issues: int
    total_materiel: int
    created_by: str | None
    created_at: datetime


class AssessmentOut(AssessmentSummary):
    result: MaterialiteScoreResponse


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _pillar(code: str) -> str:
    if code.startswith(("CC-", "ER-", "WR-", "BD-", "CE-")):
        return "E"
    if code.startswith(("WO-", "SC-")):
        return "S"
    return "G"


def _score(x: float, y: float) -> float:
    """Formule pondérée : score = sqrt(impact × probabilité) — entre 0 et 5."""
    import math
    return round(math.sqrt(x * y), 2)


def _generate_narrative(issues: list[ScoredIssue], sector: str | None) -> str:
    """Génère un narratif textuel depuis les enjeux scorés (déterministe)."""
    materiels = [i for i in issues if i.materiel]
    e_issues = [i for i in materiels if i.pillar == "E"]
    s_issues = [i for i in materiels if i.pillar == "S"]
    g_issues = [i for i in materiels if i.pillar == "G"]

    sector_label = {
        "tech": "technologie", "industrie": "industrie",
        "retail": "retail/distribution", "services": "services", "finance": "finance"
    }.get(sector or "", "votre secteur")

    top = sorted(materiels, key=lambda i: -i.score)[:3]
    top_labels = ", ".join(f"**{i.label}** ({i.score:.1f}/5)" for i in top)

    n_impact = sum(1 for i in issues if i.materiel_impact)
    n_fin = sum(1 for i in issues if i.materiel_financier)
    narrative_parts = [
        f"## Analyse double matérialité — {sector_label.title()}",
        "",
        f"Sur {len(issues)} enjeux ESRS évalués, **{len(materiels)} sont matériels** : "
        f"{n_impact} au titre de la matérialité d'impact et {n_fin} au titre de la "
        f"matérialité financière (règle ESRS 1 : un enjeu est matériel dès que l'une "
        f"des deux dimensions atteint le seuil de {MATERIALITY_THRESHOLD}).",
        "",
    ]

    if top:
        narrative_parts += [
            f"**Enjeux prioritaires** : {top_labels}.",
            "",
        ]

    if e_issues:
        narrative_parts += [
            f"**Pilier Environnemental ({len(e_issues)} enjeux matériels)** : "
            + ", ".join(i.label for i in e_issues[:3])
            + ("..." if len(e_issues) > 3 else ".")
            + " Ces enjeux doivent figurer dans le plan de transition climatique et le reporting ESRS E1-E5.",
            "",
        ]

    if s_issues:
        narrative_parts += [
            f"**Pilier Social ({len(s_issues)} enjeux matériels)** : "
            + ", ".join(i.label for i in s_issues[:3])
            + ("..." if len(s_issues) > 3 else ".")
            + " Les engagements doivent être couverts par ESRS S1-S4 (effectifs propres et chaîne de valeur).",
            "",
        ]

    if g_issues:
        narrative_parts += [
            f"**Pilier Gouvernance ({len(g_issues)} enjeux matériels)** : "
            + ", ".join(i.label for i in g_issues[:3])
            + ("..." if len(g_issues) > 3 else ".")
            + " La gouvernance ESG et l'éthique des affaires sont à couvrir sous ESRS G1 et ESRS 2.",
            "",
        ]

    narrative_parts += [
        "---",
        "*Narratif généré à partir de la matrice double matérialité. "
        "À valider avec les parties prenantes et intégrer au rapport CSRD.*",
    ]

    return "\n".join(narrative_parts)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_sector_presets() -> SectorPresetsResponse:
    return SectorPresetsResponse(
        sectors=list(SECTOR_PRESETS.keys()),
        default="industrie",
        issues=ISSUE_LABELS,
    )


def load_positions(company_id: int) -> list[IssuePosition]:
    """Load saved positions from DB or in-memory store."""
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT issue_code, x_proba, y_impact, justification "
                        "FROM materialite_positions WHERE company_id = %s",
                        (company_id,),
                    )
                    rows = cur.fetchall()
                    return [
                        IssuePosition(
                            code=r["issue_code"], x=float(r["x_proba"]), y=float(r["y_impact"]),
                            justification=r.get("justification"),
                        )
                        for r in rows
                    ]
        except Exception as exc:
            logger.warning("load_positions DB error: %s", exc)

    return [
        IssuePosition(code=k[1], x=v["x"], y=v["y"], justification=v.get("justification"))
        for k, v in _POSITIONS_STORE.items()
        if k[0] == company_id
    ]


def save_positions(positions: list[IssuePosition], company_id: int) -> None:
    """Persist drag & drop positions (+ justification par enjeu)."""
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    for pos in positions:
                        cur.execute(
                            """
                            INSERT INTO materialite_positions (company_id, issue_code, x_proba, y_impact, justification)
                            VALUES (%s, %s, %s, %s, %s)
                            ON CONFLICT (company_id, issue_code)
                            DO UPDATE SET x_proba = EXCLUDED.x_proba, y_impact = EXCLUDED.y_impact,
                                          justification = COALESCE(EXCLUDED.justification, materialite_positions.justification),
                                          updated_at = now()
                            """,
                            (company_id, pos.code, pos.x, pos.y, pos.justification),
                        )
            return
        except Exception as exc:
            logger.warning("save_positions DB error: %s", exc)

    for pos in positions:
        prev = _POSITIONS_STORE.get((company_id, pos.code), {})
        _POSITIONS_STORE[(company_id, pos.code)] = {
            "x": pos.x, "y": pos.y,
            "justification": pos.justification if pos.justification is not None else prev.get("justification"),
        }


def compute_score(
    positions: list[IssuePosition],
    sector: str | None = None,
) -> MaterialiteScoreResponse:
    """
    Compute materiality scores from given positions.
    Falls back to sector preset if positions list is empty.
    """
    if not positions and sector and sector in SECTOR_PRESETS:
        preset = SECTOR_PRESETS[sector]
        positions = [
            IssuePosition(code=code, x=vals["x"], y=vals["y"])
            for code, vals in preset.items()
        ]

    scored: list[ScoredIssue] = []
    for pos in positions:
        s = _score(pos.x, pos.y)
        materiel_financier = pos.x >= MATERIALITY_THRESHOLD
        materiel_impact = pos.y >= MATERIALITY_THRESHOLD
        scored.append(ScoredIssue(
            code=pos.code,
            label=ISSUE_LABELS.get(pos.code, pos.code),
            x=pos.x,
            y=pos.y,
            score=s,
            # Règle ESRS 1 §3 : matériel si l'UNE OU l'autre dimension atteint
            # le seuil — jamais le produit (un impact extrême à faible enjeu
            # financier reste matériel, et réciproquement).
            materiel=materiel_impact or materiel_financier,
            materiel_impact=materiel_impact,
            materiel_financier=materiel_financier,
            pillar=_pillar(pos.code),
            esrs=ISSUE_ESRS.get(pos.code),
            justification=pos.justification,
        ))

    materiels = [i for i in scored if i.materiel]
    score_moyen = round(sum(i.score for i in scored) / len(scored), 2) if scored else 0.0
    esrs_to_activate = sorted({i.esrs for i in materiels if i.esrs})

    return MaterialiteScoreResponse(
        sector=sector,
        issues=sorted(scored, key=lambda i: -i.score),
        total_materiel=len(materiels),
        total_materiel_impact=sum(1 for i in scored if i.materiel_impact),
        total_materiel_financier=sum(1 for i in scored if i.materiel_financier),
        total_issues=len(scored),
        score_moyen=score_moyen,
        threshold=MATERIALITY_THRESHOLD,
        esrs_to_activate=esrs_to_activate,
        narrative=_generate_narrative(scored, sector),
    )


def _db_available() -> bool:
    from db.database import db_available
    return db_available()


# ---------------------------------------------------------------------------
# Évaluations archivées (versioning annuel, T7.4)
# ---------------------------------------------------------------------------

def create_assessment(payload: AssessmentCreate, company_id: int, created_by: str | None) -> AssessmentOut:
    """Fige l'évaluation courante en version IMMUABLE (une par exercice/révision).

    Snapshot des positions du moment (ou du preset sectoriel si aucune saisie),
    scoring recalculé et stocké : l'archive reste lisible telle quelle même si
    la formule ou les presets évoluent ensuite.
    """
    positions = load_positions(company_id)
    result = compute_score(positions, sector=payload.sector)
    label = payload.label or f"Évaluation du {datetime.now(tz=timezone.utc).strftime('%d/%m/%Y')}"

    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO materialite_assessments
                            (company_id, label, sector, threshold, positions, result, created_by)
                        VALUES (%s,%s,%s,%s,%s,%s,%s)
                        RETURNING id, created_at
                        """,
                        (company_id, label, payload.sector, MATERIALITY_THRESHOLD,
                         json.dumps([p.model_dump() for p in positions]),
                         result.model_dump_json(), created_by),
                    )
                    row = cur.fetchone()
                    return AssessmentOut(
                        id=row["id"], company_id=company_id, label=label, sector=payload.sector,
                        threshold=MATERIALITY_THRESHOLD, total_issues=result.total_issues,
                        total_materiel=result.total_materiel, created_by=created_by,
                        created_at=row["created_at"], result=result,
                    )
        except Exception as exc:
            logger.warning("create_assessment DB error: %s", exc)

    rec = {
        "id": _MEM_ASSESSMENT_ID["assessment"],
        "company_id": company_id,
        "label": label,
        "sector": payload.sector,
        "threshold": MATERIALITY_THRESHOLD,
        "result": result.model_dump(),
        "created_by": created_by,
        "created_at": datetime.now(tz=timezone.utc),
    }
    _MEM_ASSESSMENT_ID["assessment"] += 1
    _MEM_ASSESSMENTS.append(rec)
    return AssessmentOut(
        **{k: rec[k] for k in ("id", "company_id", "label", "sector", "threshold", "created_by", "created_at")},
        total_issues=result.total_issues, total_materiel=result.total_materiel, result=result,
    )


def list_assessments(company_id: int) -> list[AssessmentSummary]:
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT id, company_id, label, sector, threshold, result, created_by, created_at "
                        "FROM materialite_assessments WHERE company_id = %s ORDER BY created_at DESC",
                        (company_id,),
                    )
                    out = []
                    for r in cur.fetchall():
                        result = r["result"] if isinstance(r["result"], dict) else json.loads(r["result"])
                        out.append(AssessmentSummary(
                            id=r["id"], company_id=r["company_id"], label=r["label"],
                            sector=r["sector"], threshold=float(r["threshold"]),
                            total_issues=result.get("total_issues", 0),
                            total_materiel=result.get("total_materiel", 0),
                            created_by=r["created_by"], created_at=r["created_at"],
                        ))
                    return out
        except Exception as exc:
            logger.warning("list_assessments DB error: %s", exc)

    return [
        AssessmentSummary(
            **{k: a[k] for k in ("id", "company_id", "label", "sector", "threshold", "created_by", "created_at")},
            total_issues=a["result"].get("total_issues", 0),
            total_materiel=a["result"].get("total_materiel", 0),
        )
        for a in sorted(
            (a for a in _MEM_ASSESSMENTS if a["company_id"] == company_id),
            key=lambda a: a["id"], reverse=True,
        )
    ]


def get_assessment(assessment_id: int, company_id: int) -> AssessmentOut | None:
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT id, company_id, label, sector, threshold, result, created_by, created_at "
                        "FROM materialite_assessments WHERE id = %s AND company_id = %s",
                        (assessment_id, company_id),
                    )
                    r = cur.fetchone()
                    if not r:
                        return None
                    result = r["result"] if isinstance(r["result"], dict) else json.loads(r["result"])
                    return AssessmentOut(
                        id=r["id"], company_id=r["company_id"], label=r["label"], sector=r["sector"],
                        threshold=float(r["threshold"]),
                        total_issues=result.get("total_issues", 0),
                        total_materiel=result.get("total_materiel", 0),
                        created_by=r["created_by"], created_at=r["created_at"],
                        result=MaterialiteScoreResponse(**result),
                    )
        except Exception as exc:
            logger.warning("get_assessment DB error: %s", exc)
            return None

    rec = next(
        (a for a in _MEM_ASSESSMENTS if a["id"] == assessment_id and a["company_id"] == company_id),
        None,
    )
    if not rec:
        return None
    return AssessmentOut(
        **{k: rec[k] for k in ("id", "company_id", "label", "sector", "threshold", "created_by", "created_at")},
        total_issues=rec["result"].get("total_issues", 0),
        total_materiel=rec["result"].get("total_materiel", 0),
        result=MaterialiteScoreResponse(**rec["result"]),
    )
