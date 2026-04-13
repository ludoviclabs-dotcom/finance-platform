"""
copilot_tools.py — Outils de lecture typés pour le copilote IA.

Ces outils sont exposés via l'endpoint /copilot/tools pour permettre
au frontend d'enrichir le contexte du copilote avant chaque question.

Chaque outil retourne des données structurées et sources traçables :
  - get_carbon_kpis   : Scopes + Taxonomie + Intensités + SBTi
  - get_vsme_kpis     : Complétude + Social + Environnement PME
  - get_esg_kpis      : Scores E/S/G + Matérialité IRO
  - get_finance_kpis  : Finance-Climat + SFDR PAI
  - get_alert_status  : Règles actives + dernières alertes déclenchées
  - get_data_health   : Santé et fraîcheur des 4 caches
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

from services.snapshot_cache import cache_status, read_snapshot

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Models de réponse typés
# ---------------------------------------------------------------------------


class ToolSource(BaseModel):
    """Traçabilité de la source d'un outil."""

    domain: str
    cachedAt: str | None = None
    ageSeconds: int | None = None
    available: bool = True


class CarbonKpisResult(BaseModel):
    """Résultat de get_carbon_kpis."""

    source: ToolSource
    scope1Tco2e: float | None = None
    scope2LbTco2e: float | None = None
    scope2MbTco2e: float | None = None
    scope3Tco2e: float | None = None
    totalS123Tco2e: float | None = None
    intensityRevenueTco2ePerMEur: float | None = None
    intensityFteTco2ePerFte: float | None = None
    turnoverAlignedPct: float | None = None
    capexAlignedPct: float | None = None
    renewableSharePct: float | None = None
    targetReductionS12Pct: float | None = None
    targetReductionS3Pct: float | None = None
    baselineYear: int | None = None
    estimatedCbamCostEur: float | None = None
    company: str | None = None
    reportingYear: Any = None


class VsmeKpisResult(BaseModel):
    """Résultat de get_vsme_kpis."""

    source: ToolSource
    scorePct: float | None = None
    indicateursCompletes: int | None = None
    totalIndicateurs: int | None = None
    statut: str | None = None
    effectifTotal: int | None = None
    pctCdi: float | None = None
    ltir: float | None = None
    formationHEtp: float | None = None
    ecartSalaireHf: float | None = None
    pctFemmesMgmt: float | None = None
    totalGesTco2e: float | None = None
    energieMwh: float | None = None
    partEnrPct: float | None = None
    raisonSociale: str | None = None


class EsgKpisResult(BaseModel):
    """Résultat de get_esg_kpis."""

    source: ToolSource
    scoreGlobal: float | None = None
    scoreE: float | None = None
    scoreS: float | None = None
    scoreG: float | None = None
    statut: str | None = None
    enjeuxEvalues: int = 0
    enjeuxMateriels: int = 0
    enjeuxMaterielsE: int = 0
    enjeuxMaterielsS: int = 0
    enjeuxMaterielsG: int = 0
    top5Issues: list[dict[str, Any]] = Field(default_factory=list)


class FinanceKpisResult(BaseModel):
    """Résultat de get_finance_kpis."""

    source: ToolSource
    expositionTotaleEur: float | None = None
    greenCapexPct: float | None = None
    statutAlignementParis: str | None = None
    pai1_totalGes: float | None = None
    pai2_empreinteCarbone: float | None = None
    pai12_ecartSalaireHf: float | None = None
    pai13_diversiteGenreGouv: float | None = None


class AlertStatusResult(BaseModel):
    """Résultat de get_alert_status."""

    totalActive: int = 0
    recentFired: list[dict[str, Any]] = Field(default_factory=list)
    domains: list[str] = Field(default_factory=list)


class DataHealthResult(BaseModel):
    """Résultat de get_data_health."""

    checkedAt: str
    domains: dict[str, dict[str, Any]] = Field(default_factory=dict)
    allAvailable: bool = False
    anyStale: bool = False


class CopilotToolsBundle(BaseModel):
    """Bundle de tous les outils — retourné par GET /copilot/tools."""

    generatedAt: str
    carbon: CarbonKpisResult
    vsme: VsmeKpisResult
    esg: EsgKpisResult
    finance: FinanceKpisResult
    alertStatus: AlertStatusResult
    dataHealth: DataHealthResult


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _safe_float(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _safe_int(v: Any) -> int | None:
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _build_source(domain: str, company_id: int) -> ToolSource:
    status = cache_status(company_id=company_id)
    info = status.get(domain, {}) or {}
    if not info.get("exists", False):
        return ToolSource(domain=domain, available=False)
    return ToolSource(
        domain=domain,
        available=True,
        cachedAt=info.get("cachedAt"),
        ageSeconds=_safe_int(info.get("ageSeconds")),
    )


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------


def get_carbon_kpis(company_id: int) -> CarbonKpisResult:
    """Retourne les KPIs carbone depuis le cache."""
    source = _build_source("carbon", company_id)
    if not source.available:
        return CarbonKpisResult(source=source)

    raw = read_snapshot("carbon", company_id=company_id) or {}
    c = raw.get("carbon", {}) or {}
    tax = raw.get("taxonomy", {}) or {}
    energy = raw.get("energy", {}) or {}
    sbti = raw.get("sbti", {}) or {}
    cbam = raw.get("cbam", {}) or {}
    company_data = raw.get("company", {}) or {}

    return CarbonKpisResult(
        source=source,
        scope1Tco2e=_safe_float(c.get("scope1Tco2e")),
        scope2LbTco2e=_safe_float(c.get("scope2LbTco2e")),
        scope2MbTco2e=_safe_float(c.get("scope2MbTco2e")),
        scope3Tco2e=_safe_float(c.get("scope3Tco2e")),
        totalS123Tco2e=_safe_float(c.get("totalS123Tco2e")),
        intensityRevenueTco2ePerMEur=_safe_float(c.get("intensityRevenueTco2ePerMEur")),
        intensityFteTco2ePerFte=_safe_float(c.get("intensityFteTco2ePerFte")),
        turnoverAlignedPct=_safe_float(tax.get("turnoverAlignedPct")),
        capexAlignedPct=_safe_float(tax.get("capexAlignedPct")),
        renewableSharePct=_safe_float(energy.get("renewableSharePct")),
        targetReductionS12Pct=_safe_float(sbti.get("targetReductionS12Pct")),
        targetReductionS3Pct=_safe_float(sbti.get("targetReductionS3Pct")),
        baselineYear=_safe_int(sbti.get("baselineYear")),
        estimatedCbamCostEur=_safe_float(cbam.get("estimatedCostEur")),
        company=company_data.get("name"),
        reportingYear=company_data.get("reportingYear"),
    )


def get_vsme_kpis(company_id: int) -> VsmeKpisResult:
    """Retourne les KPIs VSME depuis le cache."""
    source = _build_source("vsme", company_id)
    if not source.available:
        return VsmeKpisResult(source=source)

    raw = read_snapshot("vsme", company_id=company_id) or {}
    compl = raw.get("completude", {}) or {}
    social = raw.get("social", {}) or {}
    env = raw.get("environnement", {}) or {}
    profile = raw.get("profile", {}) or {}

    return VsmeKpisResult(
        source=source,
        scorePct=_safe_float(compl.get("scorePct")),
        indicateursCompletes=_safe_int(compl.get("indicateursCompletes")),
        totalIndicateurs=_safe_int(compl.get("totalIndicateurs")),
        statut=compl.get("statut"),
        effectifTotal=_safe_int(social.get("effectifTotal")),
        pctCdi=_safe_float(social.get("pctCdi")),
        ltir=_safe_float(social.get("ltir")),
        formationHEtp=_safe_float(social.get("formationHEtp")),
        ecartSalaireHf=_safe_float(social.get("ecartSalaireHf")),
        pctFemmesMgmt=_safe_float(social.get("pctFemmesMgmt")),
        totalGesTco2e=_safe_float(env.get("totalGesTco2e")),
        energieMwh=_safe_float(env.get("energieMwh")),
        partEnrPct=_safe_float(env.get("partEnrPct")),
        raisonSociale=profile.get("raisonSociale"),
    )


def get_esg_kpis(company_id: int) -> EsgKpisResult:
    """Retourne les KPIs ESG et la matérialité depuis le cache."""
    source = _build_source("esg", company_id)
    if not source.available:
        return EsgKpisResult(source=source)

    raw = read_snapshot("esg", company_id=company_id) or {}
    scores = raw.get("scores", {}) or {}
    mat = raw.get("materialite", {}) or {}
    issues = mat.get("issues", []) or []

    top5 = sorted(
        [i for i in issues if i.get("materiel") is True],
        key=lambda x: float(x.get("scoreImpactTotal") or 0),
        reverse=True,
    )[:5]

    return EsgKpisResult(
        source=source,
        scoreGlobal=_safe_float(scores.get("scoreGlobal")),
        scoreE=_safe_float(scores.get("scoreE")),
        scoreS=_safe_float(scores.get("scoreS")),
        scoreG=_safe_float(scores.get("scoreG")),
        statut=scores.get("statut"),
        enjeuxEvalues=int(mat.get("enjeuxEvalues") or 0),
        enjeuxMateriels=int(mat.get("enjeuxMateriels") or 0),
        enjeuxMaterielsE=int(mat.get("enjeuxMaterielsE") or 0),
        enjeuxMaterielsS=int(mat.get("enjeuxMaterielsS") or 0),
        enjeuxMaterielsG=int(mat.get("enjeuxMaterielsG") or 0),
        top5Issues=[
            {
                "code": i.get("code"),
                "label": i.get("label"),
                "categorie": i.get("categorie"),
                "score": i.get("scoreImpactTotal"),
            }
            for i in top5
        ],
    )


def get_finance_kpis(company_id: int) -> FinanceKpisResult:
    """Retourne les KPIs Finance-Climat et SFDR PAI depuis le cache."""
    source = _build_source("finance", company_id)
    if not source.available:
        return FinanceKpisResult(source=source)

    raw = read_snapshot("finance", company_id=company_id) or {}
    fc = raw.get("financeClimat", {}) or {}
    sfdr = raw.get("sfdrPai", {}) or {}

    return FinanceKpisResult(
        source=source,
        expositionTotaleEur=_safe_float(fc.get("expositionTotaleEur")),
        greenCapexPct=_safe_float(fc.get("greenCapexPct")),
        statutAlignementParis=fc.get("statutAlignementParis"),
        pai1_totalGes=_safe_float(sfdr.get("pai1_totalGes")),
        pai2_empreinteCarbone=_safe_float(sfdr.get("pai2_empreinteCarbone")),
        pai12_ecartSalaireHf=_safe_float(sfdr.get("pai12_ecartSalaireHf")),
        pai13_diversiteGenreGouv=_safe_float(sfdr.get("pai13_diversiteGenreGouv")),
    )


def get_alert_status(company_id: int) -> AlertStatusResult:
    """Retourne le statut des alertes actives + dernières déclenchées."""
    try:
        from db.database import db_available, get_db
        from routers.alerts import _MEM_HISTORY, _MEM_RULES

        if db_available():
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT domain FROM alert_rules WHERE company_id = %s AND is_active = TRUE",
                        (company_id,),
                    )
                    rows = cur.fetchall()
            active_domains = list({r["domain"] for r in rows})
            recent = list(_MEM_HISTORY)[:5]
            return AlertStatusResult(
                totalActive=len(rows),
                recentFired=recent,
                domains=active_domains,
            )

        rules = [r for r in _MEM_RULES if r.get("company_id") == company_id and r.get("is_active")]
        domains = list({r["domain"] for r in rules})
        recent = list(_MEM_HISTORY)[:5]
        return AlertStatusResult(totalActive=len(rules), recentFired=recent, domains=domains)
    except Exception as exc:
        logger.debug("Statut alertes ignoré : %s", exc)
        return AlertStatusResult()


def get_data_health(company_id: int) -> DataHealthResult:
    """Retourne la santé et la fraîcheur des 4 caches de données."""
    status = cache_status(company_id=company_id)
    domains: dict[str, dict[str, Any]] = {}
    all_available = True
    any_stale = False

    for domain in ("carbon", "vsme", "esg", "finance"):
        info = status.get(domain, {}) or {}
        available = bool(info.get("exists", False))
        stale = bool(info.get("stale", False))
        if not available:
            all_available = False
        if stale:
            any_stale = True
        domains[domain] = {
            "available": available,
            "stale": stale,
            "cachedAt": info.get("cachedAt"),
            "ageSeconds": info.get("ageSeconds"),
        }

    return DataHealthResult(
        checkedAt=datetime.now(timezone.utc).isoformat(),
        domains=domains,
        allAvailable=all_available,
        anyStale=any_stale,
    )


# ---------------------------------------------------------------------------
# Public bundle function
# ---------------------------------------------------------------------------


def build_copilot_tools_bundle(company_id: int) -> CopilotToolsBundle:
    """
    Construit le bundle complet de tous les outils pour un company_id.
    Appelé par GET /copilot/tools — résultat injecté dans le contexte du copilote.
    """
    return CopilotToolsBundle(
        generatedAt=datetime.now(timezone.utc).isoformat(),
        carbon=get_carbon_kpis(company_id),
        vsme=get_vsme_kpis(company_id),
        esg=get_esg_kpis(company_id),
        finance=get_finance_kpis(company_id),
        alertStatus=get_alert_status(company_id),
        dataHealth=get_data_health(company_id),
    )
