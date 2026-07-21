"""
grounding_service.py — construction du Reference Pack pré-autorisé (PR-11).

Le pack est bâti CÔTÉ BACKEND, sous RLS du tenant, après filtrage licence +
sensibilité + minimisation. Le modèle ne voit QUE ce pack (AI_GOVERNANCE §4/§6) :

  - confidential / restricted : EXCLUS du pack (jamais envoyés au modèle) → E5.
  - source dont allow_display=false / release blocked_license : EXCLUS → E6.
  - extraits minimisés (tronqués), jamais de PDF entier.
  - `stale` calculé (release superseded ou valid_to dépassé).

Deux use cases (D-3) : `iro_review` (IRO + preuves) et `calc_explanation`
(résultat déterministe Scope 2 déjà calculé — jamais recalculé ici).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from db.database import get_db
from models.ai_review import ReferenceItem, ReferencePack
from services.intelligence import license_policy

_EXCERPT_MAX = 500  # minimisation : borne dure sur tout extrait envoyé au modèle.


class AiGroundingError(Exception):
    """Sujet introuvable / hors périmètre, ou use case non supporté."""


@dataclass
class GroundingResult:
    pack: ReferencePack
    # Références AUTORISÉES effectivement incluses (audit : ai_runs.allowed_reference_ids).
    allowed_reference_ids: list[dict[str, Any]] = field(default_factory=list)
    # Références écartées et pourquoi (audit ; jamais envoyées au modèle).
    excluded: list[dict[str, Any]] = field(default_factory=list)


def build_pack(*, company_id: int, use_case: str, subject_key: str) -> GroundingResult:
    if use_case == "iro_review":
        return _build_iro_pack(company_id=company_id, subject_key=subject_key)
    if use_case == "calc_explanation":
        return _build_calc_pack(company_id=company_id, subject_key=subject_key)
    raise AiGroundingError(f"use_case IA non supporté: {use_case}")


def _truncate(text: str | None) -> str | None:
    if not text:
        return None
    return text[:_EXCERPT_MAX]


def _license_allows_display(source: dict[str, Any] | None) -> tuple[bool, bool]:
    """(allow_display, allow_derived_use). Artefact sans source externe = preuve
    propre du tenant → affichable (aucune licence tierce restrictive)."""
    if source is None or source.get("source_pk") is None:
        return True, True
    decision = license_policy.evaluate(source)
    return decision.allow_display, decision.allow_derived_use


def _resolve_artifacts(company_id: int, artifact_ids: list[int]) -> dict[int, dict[str, Any]]:
    """Jointure evidence_artifacts + release + source (sous RLS + périmètre
    explicite). Renvoie par artifact_id ses métadonnées de sensibilité/licence/
    localisation/fraîcheur — jamais le contenu binaire."""
    if not artifact_ids:
        return {}
    placeholders = ",".join(["%s"] * len(artifact_ids))
    rows: dict[int, dict[str, Any]] = {}
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT ea.id, ea.filename, ea.sensitivity, ea.page_reference,
                       ea.table_reference, ea.cell_reference, ea.excerpt,
                       sr.id AS release_pk, sr.release_key, sr.status AS release_status,
                       sr.retrieved_at,
                       (sr.status = 'superseded'
                        OR (sr.valid_to IS NOT NULL AND sr.valid_to < now())) AS stale,
                       s.id AS source_pk, s.active, s.automated_access_allowed,
                       s.storage_allowed, s.commercial_use_allowed, s.redistribution_allowed,
                       s.derived_use_allowed, s.display_allowed, s.attribution_text
                FROM evidence_artifacts ea
                LEFT JOIN source_releases sr ON ea.source_release_id = sr.id
                LEFT JOIN source_registry s ON sr.source_id = s.id
                WHERE ea.id IN ({placeholders})
                  AND (ea.company_id = %s OR ea.company_id IS NULL)
                """,
                (*artifact_ids, company_id),
            )
            for r in cur.fetchall():
                rows[r["id"]] = dict(r)
    return rows


def _build_iro_pack(*, company_id: int, subject_key: str) -> GroundingResult:
    from services.iro import iro_service  # import local (évite un cycle)

    try:
        iro_id = int(subject_key)
    except (TypeError, ValueError) as exc:
        raise AiGroundingError(f"identifiant IRO invalide: {subject_key!r}") from exc

    try:
        detail = iro_service.get_iro_detail(company_id=company_id, iro_id=iro_id)
    except iro_service.IroError as exc:
        raise AiGroundingError(str(exc)) from exc

    iro = detail.iro
    subject_summary: dict[str, Any] = {
        "iro_id": iro.id,
        "title": iro.title,
        "iro_type": iro.iro_type,
        "status": iro.status,
        "origin_domain": iro.origin_domain,
        "topic_code": iro.topic_code,
        "n_impact_assessments": len(detail.impact_assessments),
        "n_financial_assessments": len(detail.financial_assessments),
        "n_decisions": len(detail.decisions),
        "n_evidence_links": len(detail.evidence_links),
    }

    artifact_ids = [link.evidence_artifact_id for link in detail.evidence_links]
    resolved = _resolve_artifacts(company_id, artifact_ids)

    references: list[ReferenceItem] = []
    excluded: list[dict[str, Any]] = []
    for link in detail.evidence_links:
        meta = resolved.get(link.evidence_artifact_id)
        if meta is None:
            excluded.append({"artifact_id": link.evidence_artifact_id, "reason": "introuvable"})
            continue
        sensitivity = meta.get("sensitivity")
        if sensitivity in ("confidential", "restricted"):
            excluded.append({"artifact_id": meta["id"], "reason": "sensitivity", "sensitivity": sensitivity})
            continue
        allow_display, allow_derived = _license_allows_display(meta)
        if not allow_display:
            excluded.append({"artifact_id": meta["id"], "reason": "license_blocked"})
            continue
        if not allow_derived:
            # Envoyer un extrait à un modèle qui en dérive du texte = usage DÉRIVÉ :
            # exiger allow_derived_use (AI_GOVERNANCE §5bis), sinon EXCLU du pack.
            excluded.append({"artifact_id": meta["id"], "reason": "derived_use_blocked"})
            continue
        locator = {
            "page_reference": meta.get("page_reference"),
            "table_reference": meta.get("table_reference"),
            "cell_reference": meta.get("cell_reference"),
            "excerpt": _truncate(meta.get("excerpt")),
        }
        references.append(
            ReferenceItem(
                ref_id=f"artifact:{meta['id']}",
                resource_type="artifact",
                internal_id=meta["id"],
                source_id=meta.get("source_pk"),
                release_id=meta.get("release_pk"),
                artifact_id=meta["id"],
                label=meta.get("filename"),
                locator={k: v for k, v in locator.items() if v is not None},
                sensitivity=sensitivity,
                license_ok=allow_display,
                stale=bool(meta.get("stale")),
            )
        )

    pack = ReferencePack(
        use_case="iro_review",
        subject_type="iro",
        subject_key=str(iro_id),
        company_id=company_id,
        instructions=(
            "Revue d'un IRO candidate : résume les preuves citées, identifie les "
            "données manquantes, signale les contradictions, propose des questions "
            "de revue. Ne décide jamais de la matérialité."
        ),
        subject_summary=subject_summary,
        references=references,
    )
    allowed = [
        {"ref_id": r.ref_id, "resource_type": r.resource_type, "internal_id": r.internal_id}
        for r in references
    ]
    return GroundingResult(pack=pack, allowed_reference_ids=allowed, excluded=excluded)


def _build_calc_pack(*, company_id: int, subject_key: str) -> GroundingResult:
    """UC-2 : explication d'un run déterministe Scope 2 déjà calculé.

    subject_key = 'scope2:{run_id}'. Le run et sa trace SONT la vérité terrain :
    l'IA les explique, elle ne recalcule jamais. Scope 3 : fast-follow documenté."""
    domain, _, raw_id = subject_key.partition(":")
    if domain != "scope2":
        raise AiGroundingError(
            f"explication de calcul non supportée pour '{domain}' au MVP (Scope 2 uniquement)"
        )
    try:
        run_id = int(raw_id)
    except (TypeError, ValueError) as exc:
        raise AiGroundingError(f"identifiant de run invalide: {subject_key!r}") from exc

    from services.calculations import scope2_runs

    run = scope2_runs.get_run(company_id=company_id, run_id=run_id)
    if run is None:
        raise AiGroundingError(f"Run Scope 2 '{run_id}' introuvable ou hors périmètre.")
    trace = scope2_runs.get_trace(company_id=company_id, run_id=run_id)

    subject_summary = {
        "run_id": run_id,
        "methodology_code": run.get("methodology_code"),
        "methodology_version": run.get("methodology_version"),
        "period_start": str(run.get("period_start")) if run.get("period_start") else None,
        "period_end": str(run.get("period_end")) if run.get("period_end") else None,
        "status": run.get("status"),
        "n_line_results": len(trace),
    }
    # Résumé minimisé de la trace (jamais recalculé, jamais complété).
    for key in ("total_location_tco2e", "total_market_tco2e", "coverage_pct", "confidence"):
        if key in run:
            subject_summary[key] = run[key]

    references = [
        ReferenceItem(
            ref_id=f"calc:{run_id}",
            resource_type="calc_result",
            internal_id=run_id,
            label=f"Run Scope 2 #{run_id} ({run.get('methodology_code')})",
            locator={
                "methodology": run.get("methodology_code"),
                "methodology_version": run.get("methodology_version"),
                "n_line_results": len(trace),
            },
            data_status="estimated",
            sensitivity="internal",
            license_ok=True,
            stale=False,
        )
    ]
    pack = ReferencePack(
        use_case="calc_explanation",
        subject_type="scope2_run",
        subject_key=str(run_id),
        company_id=company_id,
        instructions=(
            "Explique un résultat Scope 2 DÉJÀ calculé (méthode, entrées, réserves). "
            "N'effectue aucun calcul, ne complète aucune donnée manquante."
        ),
        subject_summary=subject_summary,
        references=references,
    )
    allowed = [
        {"ref_id": r.ref_id, "resource_type": r.resource_type, "internal_id": r.internal_id}
        for r in references
    ]
    return GroundingResult(pack=pack, allowed_reference_ids=allowed, excluded=[])
