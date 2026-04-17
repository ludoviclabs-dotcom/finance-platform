"""
materialite_service.py — Scoring + sauvegarde positions matrice double matérialité Phase 4.

Fonctionnalités :
  - 5 secteurs préremplis (tech, industrie, retail, services, finance)
  - Calcul du score de matérialité (formule pondérée impact × probabilité)
  - Sauvegarde des positions personnalisées (drag & drop)
  - Génération de narratif LLM (stub déterministe en mode sans-clé, API Anthropic si dispo)
"""

from __future__ import annotations

import logging
import os
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

MATERIALITY_THRESHOLD = 2.5  # score ≥ seuil → matériel

# In-memory store (remplacé par DB quand disponible)
_POSITIONS_STORE: dict[tuple[int, str], dict[str, float]] = {}


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class IssuePosition(BaseModel):
    code: str
    x: float = Field(..., ge=0.0, le=5.0, description="Probabilité (0-5)")
    y: float = Field(..., ge=0.0, le=5.0, description="Impact (0-5)")


class SavePositionsRequest(BaseModel):
    positions: list[IssuePosition]
    sector: str | None = None


class ScoredIssue(BaseModel):
    code: str
    label: str
    x: float
    y: float
    score: float
    materiel: bool
    pillar: str  # E | S | G


class MaterialiteScoreResponse(BaseModel):
    sector: str | None
    issues: list[ScoredIssue]
    total_materiel: int
    total_issues: int
    score_moyen: float
    narrative: str


class SectorPresetsResponse(BaseModel):
    sectors: list[str]
    default: str
    issues: dict[str, str]  # code → label


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

    narrative_parts = [
        f"## Analyse double matérialité — {sector_label.title()}",
        "",
        f"Sur {len(issues)} enjeux ESRS évalués, **{len(materiels)} sont matériels** "
        f"(score ≥ {MATERIALITY_THRESHOLD}) selon la double matérialité.",
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
                        "SELECT issue_code, x_proba, y_impact FROM materialite_positions "
                        "WHERE company_id = %s",
                        (company_id,),
                    )
                    rows = cur.fetchall()
                    return [IssuePosition(code=r["issue_code"], x=float(r["x_proba"]), y=float(r["y_impact"])) for r in rows]
        except Exception as exc:
            logger.warning("load_positions DB error: %s", exc)

    return [
        IssuePosition(code=k[1], x=v["x"], y=v["y"])
        for k, v in _POSITIONS_STORE.items()
        if k[0] == company_id
    ]


def save_positions(positions: list[IssuePosition], company_id: int) -> None:
    """Persist drag & drop positions."""
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    for pos in positions:
                        cur.execute(
                            """
                            INSERT INTO materialite_positions (company_id, issue_code, x_proba, y_impact)
                            VALUES (%s, %s, %s, %s)
                            ON CONFLICT (company_id, issue_code)
                            DO UPDATE SET x_proba = EXCLUDED.x_proba, y_impact = EXCLUDED.y_impact,
                                          updated_at = now()
                            """,
                            (company_id, pos.code, pos.x, pos.y),
                        )
            return
        except Exception as exc:
            logger.warning("save_positions DB error: %s", exc)

    for pos in positions:
        _POSITIONS_STORE[(company_id, pos.code)] = {"x": pos.x, "y": pos.y}


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
        scored.append(ScoredIssue(
            code=pos.code,
            label=ISSUE_LABELS.get(pos.code, pos.code),
            x=pos.x,
            y=pos.y,
            score=s,
            materiel=s >= MATERIALITY_THRESHOLD,
            pillar=_pillar(pos.code),
        ))

    materiels = [i for i in scored if i.materiel]
    score_moyen = round(sum(i.score for i in scored) / len(scored), 2) if scored else 0.0

    return MaterialiteScoreResponse(
        sector=sector,
        issues=sorted(scored, key=lambda i: -i.score),
        total_materiel=len(materiels),
        total_issues=len(scored),
        score_moyen=score_moyen,
        narrative=_generate_narrative(scored, sector),
    )


def _db_available() -> bool:
    from db.database import db_available
    return db_available()
