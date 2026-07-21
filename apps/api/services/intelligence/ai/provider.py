"""
provider.py — abstraction fournisseur IA (PR-11).

`generate(request) -> GenerateResult`. Deux modes pilotés par `AI_REVIEW_MODE` :

  - "demo" (défaut) : réponse déterministe construite à partir du reference pack,
    ZÉRO appel réseau, ZÉRO coût. C'est le mode des tests, de la CI et de
    l'endpoint tant qu'aucune décision budgétaire n'a activé le live.
  - "live" : appel réel via une abstraction compatible Vercel AI Gateway. Le
    modèle est configuré par `AI_REVIEW_MODEL` (jamais codé en dur). NON ACTIVÉ
    dans PR-11 : sans client configuré, `generate` ÉCHOUE EXPLICITEMENT
    (`ProviderUnavailable`) — jamais de substitution silencieuse, jamais d'appel
    payant. Aucun secret n'est requis pour la CI.

Le budget (tokens/coût/timeout) est un plafond DUR : un pack trop grand lève
`BudgetExceeded` avant tout appel.
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass, field
from typing import Callable

from models.ai_review import ModelCitation, ModelClaim, ModelRequest, ModelResult

# Plafond de contexte (garde-fou coût/timeout, AI_GOVERNANCE_CONTRACTS.md §11).
MAX_INPUT_TOKENS = 20_000


class ProviderError(Exception):
    """Erreur générique du fournisseur IA."""


class ProviderUnavailable(ProviderError):
    """Fournisseur indisponible / non configuré — échec explicite, jamais de
    substitution silencieuse (AI_GOVERNANCE_CONTRACTS.md §10)."""


class BudgetExceeded(ProviderError):
    """Le contexte dépasse le plafond tokens/coût autorisé pour ce use case."""


@dataclass
class GenerateResult:
    result: ModelResult
    provider: str
    model: str
    model_version: str | None = None
    tokens_input: int = 0
    tokens_output: int = 0
    cost_estimate: float = 0.0
    latency_ms: int | None = None
    warnings: list[str] = field(default_factory=list)


# Un provider = fonction (ModelRequest) -> GenerateResult. Injectable (tests).
Provider = Callable[[ModelRequest], GenerateResult]


def current_mode() -> str:
    """'demo' (défaut) ou 'live'. `AI_REVIEW_MODE` distinct de NEURAL_MODE (front)
    pour découpler l'activation backend, mais même sémantique demo/live."""
    return "live" if os.environ.get("AI_REVIEW_MODE", "demo").lower() == "live" else "demo"


def _estimate_tokens(text: str) -> int:
    # Heuristique déterministe (~4 caractères/token) — suffisant pour le garde-fou
    # budget et pour journaliser un ordre de grandeur en demo (aucun coût réel).
    return max(1, len(text) // 4)


def _check_budget(request: ModelRequest) -> int:
    payload = request.system_prompt + request.pack.model_dump_json()
    tokens_in = _estimate_tokens(payload)
    if tokens_in > MAX_INPUT_TOKENS:
        raise BudgetExceeded(
            f"contexte {tokens_in} tokens > plafond {MAX_INPUT_TOKENS} — réduire le reference pack"
        )
    return tokens_in


def demo_generate(request: ModelRequest) -> GenerateResult:
    """Réponse déterministe, grounded sur le pack, sans appel réseau ni coût.

    - Aucune référence disponible → une SUGGESTION de données manquantes (sans
      citation → l'entailment la marquera `unsupported`, correctement signalée).
    - Sinon → une REVIEW_REQUIRED par référence (citant son `ref_id`) + une
      SUGGESTION de questions de revue. Jamais de décision, jamais de calcul.
    """
    tokens_in = _check_budget(request)
    refs = request.pack.references
    claims: list[ModelClaim] = []

    if not refs:
        claims.append(
            ModelClaim(
                claim_text=(
                    "Aucune preuve autorisée n'est disponible pour ce sujet : les données "
                    "sont insuffisantes pour une revue étayée."
                ),
                output_label="SUGGESTION",
                citations=[],
            )
        )
    else:
        for ref in refs[:6]:
            label = ref.label or ref.ref_id
            claims.append(
                ModelClaim(
                    claim_text=f"Preuve disponible et pertinente pour la revue : {label}.",
                    structured_payload={"ref_id": ref.ref_id, "resource_type": ref.resource_type},
                    output_label="REVIEW_REQUIRED",
                    citations=[ModelCitation(ref_id=ref.ref_id)],
                )
            )
        first = refs[0]
        claims.append(
            ModelClaim(
                claim_text=(
                    "Questions de revue proposées : la couverture des preuves est-elle "
                    "suffisante et cohérente pour conclure ? (revue humaine requise)"
                ),
                output_label="SUGGESTION",
                citations=[ModelCitation(ref_id=first.ref_id)],
            )
        )

    result = ModelResult(claims=claims, summary=None)
    tokens_out = _estimate_tokens(result.model_dump_json())
    return GenerateResult(
        result=result,
        provider="demo",
        model="demo",
        model_version=_demo_fingerprint(request),
        tokens_input=tokens_in,
        tokens_output=tokens_out,
        cost_estimate=0.0,
        latency_ms=0,
    )


def _demo_fingerprint(request: ModelRequest) -> str:
    # Empreinte stable du prompt+pack : rend le "model_version" du demo reproductible.
    h = hashlib.sha256((request.system_prompt + request.pack.model_dump_json()).encode("utf-8"))
    return "demo-" + h.hexdigest()[:12]


def live_generate(request: ModelRequest) -> GenerateResult:
    """Chemin live — NON activé dans PR-11. Sans client gateway configuré (aucun
    secret en CI, aucune activation payante), échoue EXPLICITEMENT."""
    model = os.environ.get("AI_REVIEW_MODEL")
    if not model:
        raise ProviderUnavailable(
            "mode live demandé sans AI_REVIEW_MODEL configuré — aucun modèle codé en dur"
        )
    # Aucun client réel n'est câblé dans cette PR : on ne réalise jamais d'appel
    # payant. L'activation live relève d'AI_LIVE_ACTIVATION_RUNBOOK (hors PR-11).
    raise ProviderUnavailable(
        "fournisseur IA live non configuré dans PR-11 — voir AI_LIVE_ACTIVATION_RUNBOOK "
        "(aucun appel payant, aucune substitution silencieuse)"
    )


def default_provider(request: ModelRequest) -> GenerateResult:
    """Dispatche demo/live selon `AI_REVIEW_MODE`. Injectable/remplaçable en test."""
    if current_mode() == "live":
        return live_generate(request)
    return demo_generate(request)
