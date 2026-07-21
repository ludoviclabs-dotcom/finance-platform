"""
citation_service.py — résolution et validation des citations (PR-11).

Sécurité par construction : le modèle ne peut citer QUE des `ref_id` présents
dans le Reference Pack (l'ensemble AUTORISÉ, déjà filtré sous RLS + licence +
sensibilité au grounding). Toute citation vers un `ref_id` inconnu (inventé) ou
vers une preuve non affichable/sensible est REJETÉE → le claim n'a alors aucune
citation valide et sera marqué `unsupported`. Aucune citation cross-tenant,
aucune citation inventée ne peut donc survivre (AI_GOVERNANCE §5/§7).
"""

from __future__ import annotations

from models.ai_review import CitationResponse, ModelClaim, ReferenceItem, ReferencePack


def build_index(pack: ReferencePack) -> dict[str, ReferenceItem]:
    return {ref.ref_id: ref for ref in pack.references}


def resolve_claim(
    index: dict[str, ReferenceItem], claim: ModelClaim
) -> tuple[list[CitationResponse], int]:
    """Renvoie (citations résolues et valides, nb de citations rejetées).

    Rejet = `ref_id` absent du pack (inventé/inconnu), ou preuve non affichable,
    ou sensibilité confidential/restricted (défense en profondeur : déjà exclue
    au grounding)."""
    resolved: list[CitationResponse] = []
    seen: set[str] = set()
    rejected = 0
    for cit in claim.citations:
        ref = index.get(cit.ref_id)
        if ref is None:
            rejected += 1
            continue
        if not ref.license_ok or ref.sensitivity in ("confidential", "restricted"):
            rejected += 1
            continue
        if ref.ref_id in seen:
            continue
        seen.add(ref.ref_id)
        resolved.append(
            CitationResponse(
                resource_type=ref.resource_type,
                internal_id=ref.internal_id,
                source_id=ref.source_id,
                release_id=ref.release_id,
                artifact_id=ref.artifact_id,
                observation_id=ref.observation_id,
                locator=ref.locator,
                data_status=ref.data_status,
                sensitivity=ref.sensitivity,
                license_ok=ref.license_ok,
                stale=ref.stale,
            )
        )
    return resolved, rejected
