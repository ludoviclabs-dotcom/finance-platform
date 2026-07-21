"""
demo_scenarios.py — provider demo *scenario-aware* et déterministe (démo produit).

Étend le provider `demo` de PR-11 (jamais le live) pour produire, sur le scénario
fictif « Asterion Motion », un jeu de claims précis dont le **statut de support
reste calculé par `entailment_service`** — jamais déclaré ici. On ne fabrique donc
aucun statut : on émet des claims + citations, l'entailment tranche.

Garanties :
  - ZÉRO appel réseau, ZÉRO coût (comme tout le mode demo).
  - Les citations sont **dérivées du reference pack réel** (matching sur le nom de
    fichier / l'extrait), jamais un ID codé en dur.
  - Ne s'active QUE pour le sujet Asterion (titre d'IRO reconnu) — les autres
    tenants gardent le comportement générique de `demo_generate`.
  - Source de vérité unique : ``demo/scenarios/asterion-motion-v1/ai-review.json``.

Cas couverts (UC-1, revue d'IRO) :
  - dépendance terres rares >90%  -> citation résolue, sans contradiction -> partially_supported
  - contenu recyclé 80% déclaré   -> citation résolue + flag contradiction  -> contradicted
  - fournisseur alternatif <90j    -> aucune citation                        -> unsupported

Le cas `supported` (part aimants / Scope 2) relève de l'UC-2 (`calc_explanation`)
et émerge déjà du chemin générique (corroboration déterministe d'un `calc_result`).
"""

from __future__ import annotations

from functools import lru_cache

from models.ai_review import ModelCitation, ModelClaim, ModelRequest

# Import paresseux/tolérant : le module demo vit dans apps/api/demo.
try:  # pragma: no cover - dépend du sys.path d'exécution
    from demo.loader import AiSubjectSpec, load_scenario
    _LOADER_OK = True
except Exception:  # pragma: no cover
    _LOADER_OK = False


DEMO_SCENARIO = "asterion-motion-v1"


@lru_cache(maxsize=4)
def _iro_subject(scenario: str) -> "AiSubjectSpec | None":
    """Spécification des claims UC-1 du scénario (chargée une fois, mise en cache)."""
    if not _LOADER_OK:
        return None
    try:
        spec = load_scenario(scenario)
    except Exception:
        return None
    return spec.ai_review.subjects.get("iro_review")


def _title_matches(request: ModelRequest, needle: str) -> bool:
    title = str(request.pack.subject_summary.get("title") or "")
    return needle.lower() in title.lower()


def _find_ref_id(request: ModelRequest, marker: str) -> str | None:
    """Retrouve, dans le pack réel, l'id de la référence dont le libellé/extrait
    contient le marqueur. Aucun ID n'est codé en dur : on lit le pack construit
    sous RLS + licence par le grounding_service."""
    marker_low = marker.lower()
    for ref in request.pack.references:
        excerpt = ""
        if isinstance(ref.locator, dict):
            excerpt = str(ref.locator.get("excerpt") or "")
        haystack = f"{ref.label or ''} {excerpt}".lower()
        if marker_low in haystack:
            return ref.ref_id
    return None


def scenario_claims(request: ModelRequest) -> list[ModelClaim] | None:
    """Retourne les claims scriptés du scénario Asterion, ou None si non concerné.

    None => le provider retombe sur `demo_generate` générique (autres sujets/tenants).
    """
    if request.use_case != "iro_review":
        return None

    subject = _iro_subject(DEMO_SCENARIO)
    if subject is None:
        return None

    needle = subject.match.get("title_contains")
    if not needle or not _title_matches(request, needle):
        return None

    claims: list[ModelClaim] = []
    primary_ref: str | None = None

    for spec in subject.claims:
        citations: list[ModelCitation] = []
        ref_id: str | None = None
        if spec.cite_marker:
            ref_id = _find_ref_id(request, spec.cite_marker)
            if ref_id:
                citations.append(ModelCitation(ref_id=ref_id))
                primary_ref = primary_ref or ref_id
        payload: dict = {}
        if spec.contradiction:
            # Flag lu par entailment_service (résolu + contradiction => contradicted).
            payload["contradiction"] = True
        if ref_id:
            payload["ref_id"] = ref_id
        claims.append(
            ModelClaim(
                claim_text=spec.claim_text,
                structured_payload=payload,
                output_label=spec.output_label,
                citations=citations,
            )
        )

    # Questions de revue + suggestions d'action (advisory, citent la preuve
    # principale si disponible pour rester traçables).
    extras: list[str] = []
    if subject.review_questions:
        extras.append("Questions de revue : " + " | ".join(subject.review_questions))
    if subject.action_suggestions:
        extras.append("Suggestions d'action : " + " | ".join(subject.action_suggestions))
    if extras:
        claims.append(
            ModelClaim(
                claim_text=" ".join(extras),
                structured_payload={
                    "review_questions": subject.review_questions,
                    "action_suggestions": subject.action_suggestions,
                },
                output_label="SUGGESTION",
                citations=[ModelCitation(ref_id=primary_ref)] if primary_ref else [],
            )
        )

    return claims or None
