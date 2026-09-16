"""
cors.py — politique des origines autorisées à appeler l'API avec cookies.

L'API autorise les requêtes « credentialed » (cookie de rafraîchissement
SameSite=None) : toute origine acceptée peut, avec le cookie d'un utilisateur
connecté, obtenir un jeton d'accès. L'ancienne expression
`^https://(carbon|finance-platform|neural)[a-z0-9\\-]*\\.vercel\\.app$`
acceptait n'importe quel projet Vercel TIERS nommé « carbon… » (M-15).

Origines acceptées :
  * liste explicite ALLOWED_ORIGINS (virgules), ajoutée aux domaines de
    production connus du front ; localhost uniquement hors production ;
  * URL de preview du projet front `carbon` de l'équipe Vercel (domaines
    générés `<projet>-<hash>-<équipe>` et `<projet>-git-<branche>-<équipe>`),
    surchargeable par ALLOWED_ORIGIN_REGEX.
"""

from __future__ import annotations

import os
import re

from utils.env import is_production

VERCEL_TEAM_SLUG = "ludovics-projects-159c139c"

# Alias de production du projet Vercel `carbon` (vérifiés le 16/09/2026).
PRODUCTION_FRONT_ORIGINS = (
    "https://carbon-snowy-nine.vercel.app",
    f"https://carbon-{VERCEL_TEAM_SLUG}.vercel.app",
    f"https://carbon-git-master-{VERCEL_TEAM_SLUG}.vercel.app",
)

_DEV_ORIGINS = ("http://localhost:3000", "http://localhost:3001", "http://localhost:3003")

DEFAULT_PREVIEW_ORIGIN_REGEX = (
    rf"^https://carbon-(?:[a-z0-9]{{9}}|git-[a-z0-9-]{{1,63}})-{re.escape(VERCEL_TEAM_SLUG)}\.vercel\.app$"
)


def allowed_origins() -> list[str]:
    configured = [
        o.strip().rstrip("/")
        for o in os.environ.get("ALLOWED_ORIGINS", "").split(",")
        if o.strip()
    ]
    origins = list(PRODUCTION_FRONT_ORIGINS) + configured
    if not is_production():
        origins.extend(_DEV_ORIGINS)
    # Ordre stable, sans doublon.
    return list(dict.fromkeys(origins))


def allowed_origin_regex() -> str:
    return os.environ.get("ALLOWED_ORIGIN_REGEX") or DEFAULT_PREVIEW_ORIGIN_REGEX


def is_allowed_origin(origin: str | None) -> bool:
    if not origin:
        return False
    origin = origin.strip().rstrip("/")
    return origin in allowed_origins() or re.fullmatch(allowed_origin_regex(), origin) is not None
