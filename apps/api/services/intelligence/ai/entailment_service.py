"""
entailment_service.py — statut de support claim ↔ preuve (PR-11), DÉTERMINISTE.

Le modèle ne peut JAMAIS transformer une absence de preuve en support : le statut
est calculé par le SYSTÈME à partir des citations RÉSOLUES, jamais déclaré par le
modèle (AI_GOVERNANCE §5). Règle :

  - 0 citation résolue                         → unsupported
  - flag de contradiction + citation résolue   → contradicted
  - citations résolues MAIS corroboration
    déterministe absente / partielle / stale   → partially_supported
  - toutes résolues, fraîches ET corroborées   → supported

`corroborated` est fourni par l'orchestrateur (review_service) et n'est vrai que
lorsqu'une vérification déterministe existe (ex. UC-2 : la valeur citée coïncide
avec le run). En UC-1 (preuves documentaires), la PERTINENCE sémantique n'est pas
vérifiable déterministiquement → jamais `supported` sans revue humaine (E11).
"""

from __future__ import annotations

from models.ai_review import CitationResponse, ModelClaim, SupportStatus


def support_status(
    claim: ModelClaim,
    resolved: list[CitationResponse],
    *,
    corroborated: bool = False,
) -> SupportStatus:
    payload = claim.structured_payload or {}
    if resolved and payload.get("contradiction") is True:
        return "contradicted"
    if not resolved:
        return "unsupported"
    all_requested_resolved = len(resolved) == len(claim.citations)
    fresh = not any(c.stale for c in resolved)
    if corroborated and all_requested_resolved and fresh:
        return "supported"
    return "partially_supported"
