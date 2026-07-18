"""
license_policy.py — décision de licence déterministe pour une source (PR-03).

Aucun LLM, aucun jugement silencieux : chaque décision porte ses raisons
(pourquoi un droit est refusé) et ses avertissements (autorisé mais avec
réserve). Consommée par release_service.publish_release() — publication
refusée (statut blocked_license) si allow_ingest ou allow_store est False.
"""

from __future__ import annotations

from typing import Any

from models.intelligence import LicenseDecision


def evaluate(source: dict[str, Any]) -> LicenseDecision:
    """Évalue les droits d'une source à partir de ses colonnes booléennes de licence.

    `source` : mapping avec au minimum les clés active, automated_access_allowed,
    storage_allowed, commercial_use_allowed, redistribution_allowed,
    derived_use_allowed, display_allowed, attribution_text (un RealDictCursor
    row ou tout mapping compatible convient).
    """
    reasons: list[str] = []
    warnings: list[str] = []

    active = bool(source.get("active", True))
    automated_access_allowed = bool(source.get("automated_access_allowed", False))
    storage_allowed = bool(source.get("storage_allowed", False))
    display_allowed = bool(source.get("display_allowed", False))
    derived_use_allowed = bool(source.get("derived_use_allowed", False))
    commercial_use_allowed = bool(source.get("commercial_use_allowed", False))
    redistribution_allowed = bool(source.get("redistribution_allowed", False))
    attribution_text = source.get("attribution_text")

    if not active:
        reasons.append("source désactivée (active=false)")
    if not automated_access_allowed:
        reasons.append("automated_access_allowed=false — ingestion automatisée interdite")
    allow_ingest = active and automated_access_allowed

    if not storage_allowed:
        reasons.append("storage_allowed=false — conservation des artefacts/releases interdite")
    allow_store = active and storage_allowed

    if not display_allowed:
        reasons.append("display_allowed=false — affichage interdit")
    allow_display = active and display_allowed

    if not derived_use_allowed:
        warnings.append(
            "derived_use_allowed=false — usage dans un calcul dérivé non couvert par la licence"
        )
    allow_derived_use = active and derived_use_allowed

    if not commercial_use_allowed:
        warnings.append("commercial_use_allowed=false — restreindre tout usage commercial en aval")
    if not redistribution_allowed:
        warnings.append("redistribution_allowed=false — ne jamais réexposer la donnée brute hors du tenant")
    if display_allowed and not attribution_text:
        warnings.append("display_allowed=true sans attribution_text — vérifier les conditions de la licence")

    return LicenseDecision(
        allow_ingest=allow_ingest,
        allow_store=allow_store,
        allow_display=allow_display,
        allow_derived_use=allow_derived_use,
        reasons=reasons,
        warnings=warnings,
    )
