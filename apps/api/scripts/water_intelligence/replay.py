"""scripts/water_intelligence/replay.py — rejeu LOCAL d'un payload déjà acquis.

Une validation X1 fait deux choses : elle acquiert, puis elle valide. Les
faire dans le même passage obligerait à acquérir DEUX fois — une première pour
connaître les identifiants de station et construire le résolveur géographique,
une seconde pour alimenter le pipeline. Deux collectes pour une recette, c'est
du trafic gratuit sur une API publique et deux payloads potentiellement
différents sous le même rapport.

`ReplayTransport` rejoue donc les octets DÉJÀ acquis. Il implémente le contrat
`Transport` de P03 sans connaître la notion d'URL : il ne peut, par
construction, atteindre quoi que ce soit. Le checksum du rapport porte donc
sur exactement les octets que le pipeline a vus.
"""

from __future__ import annotations

from services.water_intelligence.pipeline_transport import FetchPage, TransportError


class ReplayTransport:
    """`Transport` P03 sur une séquence d'octets déjà en mémoire.

    Aucun réseau, aucune URL, aucun jeton opaque : le jeton de page est le
    numéro de la page suivante, comme dans le socle Hub'Eau.
    """

    def __init__(self, pages: list[bytes]) -> None:
        if not pages:
            raise TransportError(
                "ReplayTransport : aucune page à rejouer — un payload vide n'est pas "
                "une collecte réussie."
            )
        self._pages = list(pages)

    def fetch_page(self, *, page_token: str | None) -> FetchPage:
        index = _index_from_token(page_token)
        if index >= len(self._pages):
            raise TransportError(
                f"ReplayTransport : page {index + 1} absente du payload acquis "
                f"({len(self._pages)} page(s))."
            )
        has_next = index + 1 < len(self._pages)
        return FetchPage(
            content=self._pages[index],
            page_number=index + 1,
            has_next_page=has_next,
            next_page_token=str(index + 2) if has_next else None,
        )


def _index_from_token(page_token: str | None) -> int:
    if page_token is None:
        return 0
    try:
        page = int(page_token)
    except (TypeError, ValueError) as exc:
        raise TransportError(
            f"ReplayTransport : page_token invalide {page_token!r} — un numéro de page "
            "est attendu, jamais une URL."
        ) from exc
    if page < 1:
        raise TransportError(f"ReplayTransport : page_token invalide {page_token!r}.")
    return page - 1
