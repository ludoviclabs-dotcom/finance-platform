"""
aggregation_service.py — Consolidation multi-domaine des snapshots.

Fournit :
  - ConsolidatedSnapshot : modèle Pydantic unique agrégeant Carbon, VSME, ESG, Finance
  - build_consolidated_snapshot(company_id) : lit les 4 caches et normalise
  - build_compare_snapshot(company_id) : ajoute les deltas T vs T-1 (PostgreSQL seulement)

Le ConsolidatedSnapshot est la source de vérité pour :
  - Dashboard (/dashboard/consolidated)
  - Export PDF (/report/generate)
  - Copilote IA (/copilot/chat)
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

from services.snapshot_cache import cache_status, read_snapshot

logger = logging.getLogger(__name__)

DOMAINS = ("carbon", "vsme", "esg", "finance")


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------


class DomainHealth(BaseModel):
    """Santé des données pour un domaine."""

    available: bool = False
    stale: bool = False
    cachedAt: str | None = None
    ageSeconds: int | None = None


class CarbonKpis(BaseModel):
    """KPIs carbone consolidés."""

    scope1Tco2e: float | None = None
    scope2LbTco2e: float | None = None
    scope3Tco2e: float | None = None
    totalS123Tco2e: float | None = None
    intensityRevenueTco2ePerMEur: float | None = None
    intensityFteTco2ePerFte: float | None = None
    turnoverAlignedPct: float | None = None
    capexAlignedPct: float | None = None
    renewableSharePct: float | None = None
    targetReductionS12Pct: float | None = None
    estimatedCbamCostEur: float | None = None


class VsmeKpis(BaseModel):
    """KPIs VSME consolidés."""

    scorePct: float | None = None
    indicateursCompletes: int | None = None
    totalIndicateurs: int | None = None
    statut: str | None = None
    effectifTotal: int | None = None
    ltir: float | None = None
    ecartSalaireHf: float | None = None
    pctFemmesMgmt: float | None = None


class EsgKpis(BaseModel):
    """KPIs ESG consolidés."""

    scoreGlobal: float | None = None
    scoreE: float | None = None
    scoreS: float | None = None
    scoreG: float | None = None
    enjeuxMateriels: int | None = None
    statut: str | None = None


class FinanceKpis(BaseModel):
    """KPIs Finance-Climat consolidés."""

    expositionTotaleEur: float | None = None
    greenCapexPct: float | None = None
    statutAlignementParis: str | None = None
    pai1_totalGes: float | None = None


class AlertSummary(BaseModel):
    """Résumé des alertes actives."""

    totalActive: int = 0
    firedSinceLastCheck: int = 0
    domains: list[str] = Field(default_factory=list)


class DeltaKpis(BaseModel):
    """Deltas T vs T-1 pour les KPIs clés (valeurs absolues, None si indisponible)."""

    totalS123Tco2e: float | None = None
    totalS123Tco2ePct: float | None = None
    scoreGlobal: float | None = None
    scorePct: float | None = None
    greenCapexPct: float | None = None


class CompanyInfo(BaseModel):
    """Informations entreprise extraites des snapshots."""

    name: str | None = None
    reportingYear: Any = None
    sectorActivity: str | None = None
    fte: float | None = None
    revenueNetEur: float | None = None


# ---------------------------------------------------------------------------
# Main consolidated model
# ---------------------------------------------------------------------------


class ConsolidatedSnapshot(BaseModel):
    """
    Vue consolidée multi-domaine.
    Source de vérité unique pour dashboard, PDF, copilote.
    """

    generatedAt: str
    company: CompanyInfo = Field(default_factory=CompanyInfo)

    # KPIs par domaine
    carbon: CarbonKpis = Field(default_factory=CarbonKpis)
    vsme: VsmeKpis = Field(default_factory=VsmeKpis)
    esg: EsgKpis = Field(default_factory=EsgKpis)
    finance: FinanceKpis = Field(default_factory=FinanceKpis)

    # Deltas T vs T-1 (None si non disponible)
    deltas: DeltaKpis = Field(default_factory=DeltaKpis)

    # Santé des données
    health: dict[str, DomainHealth] = Field(default_factory=dict)

    # Alertes
    alerts: AlertSummary = Field(default_factory=AlertSummary)

    # Données brutes (pour copilote et PDF)
    rawCarbon: dict[str, Any] | None = None
    rawVsme: dict[str, Any] | None = None
    rawEsg: dict[str, Any] | None = None
    rawFinance: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Helpers d'extraction
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


def _extract_carbon(raw: dict[str, Any]) -> CarbonKpis:
    c = raw.get("carbon", {}) or {}
    tax = raw.get("taxonomy", {}) or {}
    energy = raw.get("energy", {}) or {}
    sbti = raw.get("sbti", {}) or {}
    cbam = raw.get("cbam", {}) or {}
    return CarbonKpis(
        scope1Tco2e=_safe_float(c.get("scope1Tco2e")),
        scope2LbTco2e=_safe_float(c.get("scope2LbTco2e")),
        scope3Tco2e=_safe_float(c.get("scope3Tco2e")),
        totalS123Tco2e=_safe_float(c.get("totalS123Tco2e")),
        intensityRevenueTco2ePerMEur=_safe_float(c.get("intensityRevenueTco2ePerMEur")),
        intensityFteTco2ePerFte=_safe_float(c.get("intensityFteTco2ePerFte")),
        turnoverAlignedPct=_safe_float(tax.get("turnoverAlignedPct")),
        capexAlignedPct=_safe_float(tax.get("capexAlignedPct")),
        renewableSharePct=_safe_float(energy.get("renewableSharePct")),
        targetReductionS12Pct=_safe_float(sbti.get("targetReductionS12Pct")),
        estimatedCbamCostEur=_safe_float(cbam.get("estimatedCostEur")),
    )


def _extract_vsme(raw: dict[str, Any]) -> VsmeKpis:
    compl = raw.get("completude", {}) or {}
    social = raw.get("social", {}) or {}
    return VsmeKpis(
        scorePct=_safe_float(compl.get("scorePct")),
        indicateursCompletes=_safe_int(compl.get("indicateursCompletes")),
        totalIndicateurs=_safe_int(compl.get("totalIndicateurs")),
        statut=compl.get("statut"),
        effectifTotal=_safe_int(social.get("effectifTotal")),
        ltir=_safe_float(social.get("ltir")),
        ecartSalaireHf=_safe_float(social.get("ecartSalaireHf")),
        pctFemmesMgmt=_safe_float(social.get("pctFemmesMgmt")),
    )


def _extract_esg(raw: dict[str, Any]) -> EsgKpis:
    scores = raw.get("scores", {}) or {}
    mat = raw.get("materialite", {}) or {}
    return EsgKpis(
        scoreGlobal=_safe_float(scores.get("scoreGlobal")),
        scoreE=_safe_float(scores.get("scoreE")),
        scoreS=_safe_float(scores.get("scoreS")),
        scoreG=_safe_float(scores.get("scoreG")),
        enjeuxMateriels=_safe_int(mat.get("enjeuxMateriels")),
        statut=scores.get("statut"),
    )


def _extract_finance(raw: dict[str, Any]) -> FinanceKpis:
    fc = raw.get("financeClimat", {}) or {}
    sfdr = raw.get("sfdrPai", {}) or {}
    return FinanceKpis(
        expositionTotaleEur=_safe_float(fc.get("expositionTotaleEur")),
        greenCapexPct=_safe_float(fc.get("greenCapexPct")),
        statutAlignementParis=fc.get("statutAlignementParis"),
        pai1_totalGes=_safe_float(sfdr.get("pai1_totalGes")),
    )


def _extract_company(raw_carbon: dict[str, Any] | None, raw_vsme: dict[str, Any] | None) -> CompanyInfo:
    company: dict[str, Any] = {}
    if raw_carbon:
        company = raw_carbon.get("company", {}) or {}
    if not company.get("name") and raw_vsme:
        profile = raw_vsme.get("profile", {}) or {}
        return CompanyInfo(
            name=profile.get("raisonSociale"),
            reportingYear=profile.get("anneeReporting"),
            sectorActivity=profile.get("secteurNaf"),
            fte=_safe_float(profile.get("etp")),
            revenueNetEur=_safe_float(profile.get("caNet")),
        )
    return CompanyInfo(
        name=company.get("name"),
        reportingYear=company.get("reportingYear"),
        sectorActivity=company.get("sectorActivity"),
        fte=_safe_float(company.get("fte")),
        revenueNetEur=_safe_float(company.get("revenueNetEur")),
    )


def _build_health(status: dict[str, Any]) -> dict[str, DomainHealth]:
    health: dict[str, DomainHealth] = {}
    for domain in DOMAINS:
        info = status.get(domain, {}) or {}
        if not info.get("exists", False):
            health[domain] = DomainHealth(available=False)
        else:
            health[domain] = DomainHealth(
                available=True,
                stale=bool(info.get("stale", False)),
                cachedAt=info.get("cachedAt"),
                ageSeconds=_safe_int(info.get("ageSeconds")),
            )
    return health


def _compute_deltas(
    current: CarbonKpis,
    esg_current: EsgKpis,
    vsme_current: VsmeKpis,
    finance_current: FinanceKpis,
    prev_carbon: dict[str, Any] | None,
    prev_esg: dict[str, Any] | None,
    prev_vsme: dict[str, Any] | None,
    prev_finance: dict[str, Any] | None,
) -> DeltaKpis:
    """Calcule les deltas T vs T-1. Retourne DeltaKpis vide si prev non disponible."""
    deltas = DeltaKpis()

    if prev_carbon:
        prev_c = prev_carbon.get("carbon", {}) or {}
        prev_total = _safe_float(prev_c.get("totalS123Tco2e"))
        if current.totalS123Tco2e is not None and prev_total is not None and prev_total != 0:
            deltas.totalS123Tco2e = current.totalS123Tco2e - prev_total
            deltas.totalS123Tco2ePct = (deltas.totalS123Tco2e / prev_total) * 100

    if prev_esg:
        prev_scores = prev_esg.get("scores", {}) or {}
        prev_score = _safe_float(prev_scores.get("scoreGlobal"))
        if esg_current.scoreGlobal is not None and prev_score is not None:
            deltas.scoreGlobal = esg_current.scoreGlobal - prev_score

    if prev_vsme:
        prev_compl = prev_vsme.get("completude", {}) or {}
        prev_pct = _safe_float(prev_compl.get("scorePct"))
        if vsme_current.scorePct is not None and prev_pct is not None:
            deltas.scorePct = vsme_current.scorePct - prev_pct

    if prev_finance:
        prev_fc = prev_finance.get("financeClimat", {}) or {}
        prev_gcpx = _safe_float(prev_fc.get("greenCapexPct"))
        if finance_current.greenCapexPct is not None and prev_gcpx is not None:
            deltas.greenCapexPct = finance_current.greenCapexPct - prev_gcpx

    return deltas


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def build_consolidated_snapshot(company_id: int) -> ConsolidatedSnapshot:
    """
    Lit les 4 snapshots en cache et construit un ConsolidatedSnapshot typé.

    Ne relance jamais les calculs — lit uniquement le cache.
    Les domaines manquants génèrent des KPIs à None avec health.available=False.
    """
    # Statut cache pour health
    status = cache_status(company_id=company_id)
    health = _build_health(status)

    # Lecture des snapshots
    raw: dict[str, dict[str, Any] | None] = {}
    for domain in DOMAINS:
        if health[domain].available and not health[domain].stale:
            try:
                raw[domain] = read_snapshot(domain, company_id=company_id)
            except Exception as exc:
                logger.warning("Erreur lecture snapshot %s : %s", domain, exc)
                raw[domain] = None
        else:
            raw[domain] = None

    raw_carbon = raw.get("carbon")
    raw_vsme = raw.get("vsme")
    raw_esg = raw.get("esg")
    raw_finance = raw.get("finance")

    # Extraction des KPIs
    carbon_kpis = _extract_carbon(raw_carbon) if raw_carbon else CarbonKpis()
    vsme_kpis = _extract_vsme(raw_vsme) if raw_vsme else VsmeKpis()
    esg_kpis = _extract_esg(raw_esg) if raw_esg else EsgKpis()
    finance_kpis = _extract_finance(raw_finance) if raw_finance else FinanceKpis()

    # Infos entreprise
    company_info = _extract_company(raw_carbon, raw_vsme)

    # Deltas T vs T-1 (PostgreSQL seulement — sinon DeltaKpis vide)
    deltas = _try_compute_deltas(company_id, carbon_kpis, esg_kpis, vsme_kpis, finance_kpis)

    # Résumé alertes
    alert_summary = _load_alert_summary(company_id)

    return ConsolidatedSnapshot(
        generatedAt=datetime.now(timezone.utc).isoformat(),
        company=company_info,
        carbon=carbon_kpis,
        vsme=vsme_kpis,
        esg=esg_kpis,
        finance=finance_kpis,
        deltas=deltas,
        health=health,
        alerts=alert_summary,
        rawCarbon=raw_carbon,
        rawVsme=raw_vsme,
        rawEsg=raw_esg,
        rawFinance=raw_finance,
    )


def _try_compute_deltas(
    company_id: int,
    carbon_kpis: CarbonKpis,
    esg_kpis: EsgKpis,
    vsme_kpis: VsmeKpis,
    finance_kpis: FinanceKpis,
) -> DeltaKpis:
    """Tente de calculer les deltas T vs T-1 depuis l'historique PostgreSQL."""
    try:
        from db.database import db_available

        if not db_available():
            return DeltaKpis()

        from services.snapshot_cache import read_snapshot_history

        prev: dict[str, dict[str, Any] | None] = {}
        for domain in DOMAINS:
            history = read_snapshot_history(domain, company_id=company_id, limit=2)
            # history[0] = courant, history[1] = précédent
            if len(history) >= 2:
                # La summary ne contient que quelques KPIs ; on relit le second snapshot brut
                # via un accès direct en évitant le TTL (on veut l'historique même stale)
                try:
                    import json

                    from db.database import get_db

                    with get_db() as conn:
                        with conn.cursor() as cur:
                            cur.execute(
                                """
                                SELECT data FROM snapshots
                                WHERE company_id = %s AND domain = %s
                                ORDER BY generated_at DESC
                                LIMIT 1 OFFSET 1
                                """,
                                (company_id, domain),
                            )
                            row = cur.fetchone()
                    if row:
                        data = row["data"] if isinstance(row["data"], dict) else json.loads(row["data"])
                        prev[domain] = data
                    else:
                        prev[domain] = None
                except Exception:
                    prev[domain] = None
            else:
                prev[domain] = None

        return _compute_deltas(
            carbon_kpis, esg_kpis, vsme_kpis, finance_kpis,
            prev.get("carbon"), prev.get("esg"), prev.get("vsme"), prev.get("finance"),
        )
    except Exception as exc:
        logger.debug("Calcul deltas ignoré : %s", exc)
        return DeltaKpis()


def _load_alert_summary(company_id: int) -> AlertSummary:
    """Charge un résumé des règles d'alertes actives depuis la DB ou la mémoire."""
    try:
        from db.database import db_available, get_db
        from routers.alerts import _MEM_RULES  # in-memory fallback

        if db_available():
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT domain FROM alert_rules WHERE company_id = %s AND is_active = TRUE",
                        (company_id,),
                    )
                    rows = cur.fetchall()
            active_domains = list({r["domain"] for r in rows})
            return AlertSummary(totalActive=len(rows), domains=active_domains)

        rules = [r for r in _MEM_RULES if r.get("company_id") == company_id and r.get("is_active")]
        domains = list({r["domain"] for r in rules})
        return AlertSummary(totalActive=len(rules), domains=domains)
    except Exception as exc:
        logger.debug("Résumé alertes ignoré : %s", exc)
        return AlertSummary()
