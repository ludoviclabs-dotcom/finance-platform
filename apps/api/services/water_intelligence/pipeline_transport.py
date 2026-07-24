"""
services/water_intelligence/pipeline_transport.py — transport paginé
INJECTABLE pour le pipeline opérateur Water Intelligence (P03).

Aucun module réseau (`requests`/`httpx`/`urllib`) n'est importé ici ni
ailleurs dans ce paquet. `Transport` est le SEUL point où un futur connecteur
réel (P05+) brancherait un client HTTP véritable — P03 ne fournit que
`FakeTransport`, piloté par un script de pages en mémoire. Il n'y a aucune
notion d'URL dans ce contrat (`fetch_page` ne prend qu'un jeton opaque) : rien
ici ne peut appeler un hôte arbitraire, par construction plutôt que par
promesse.
"""

from __future__ import annotations

from dataclasses import dataclass


class TransportError(Exception):
    """Erreur de transport — jamais silencieuse, toujours propagée à l'appelant."""


class TransportHttpError(TransportError):
    """Statut HTTP non 2xx simulé."""

    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(f"HTTP {status_code}: {message}")
        self.status_code = status_code


class TransportTimeout(TransportError):
    """Timeout simulé."""


class TransportCorrupted(TransportError):
    """Réponse reçue mais dont le contenu est illisible/corrompu."""


@dataclass(frozen=True)
class FetchPage:
    """Une page de résultats — jamais plus qu'une fenêtre bornée par l'appelant."""

    content: bytes
    page_number: int
    has_next_page: bool
    next_page_token: str | None = None


class Transport:
    """Contrat minimal d'un transport paginé (documentation du protocole).

    Une implémentation réelle (P05+) fournira `fetch_page` avec un vrai
    client HTTP. Cette classe n'est pas instanciée directement — elle documente
    la forme attendue ; `FakeTransport` ci-dessous l'implémente pour P03.
    """

    def fetch_page(self, *, page_token: str | None) -> FetchPage:  # pragma: no cover
        raise NotImplementedError


@dataclass
class ScriptedPage:
    """Une page scriptée pour `FakeTransport` : soit un contenu à renvoyer,
    soit une erreur à lever au moment de l'appel — jamais avant, jamais après.
    """

    content: bytes | None = None
    page_number: int = 1
    has_next_page: bool = False
    next_page_token: str | None = None
    raise_error: TransportError | None = None

    def __post_init__(self) -> None:
        if self.raise_error is None and self.content is None:
            raise ValueError("ScriptedPage : `content` requis quand `raise_error` est absent.")


class FakeTransport:
    """Transport 100% en mémoire, piloté par un script explicite de pages
    indexées par jeton. Jamais un appel réseau réel — seul transport livré
    par P03.

    `pages_by_token` associe un jeton (`None` = première page) à la page
    scriptée que `fetch_page` doit renvoyer pour ce jeton. Une page absente du
    script lève `TransportError` (jamais un fallback silencieux vers une page
    vide).
    """

    def __init__(self, pages_by_token: dict[str | None, ScriptedPage]) -> None:
        self._pages_by_token = dict(pages_by_token)
        self._call_count = 0
        self._calls_by_token: dict[str | None, int] = {}

    @property
    def call_count(self) -> int:
        return self._call_count

    def calls_for_token(self, token: str | None) -> int:
        return self._calls_by_token.get(token, 0)

    def fetch_page(self, *, page_token: str | None) -> FetchPage:
        self._call_count += 1
        self._calls_by_token[page_token] = self._calls_by_token.get(page_token, 0) + 1
        script = self._pages_by_token.get(page_token)
        if script is None:
            raise TransportError(
                f"FakeTransport : aucune page scriptée pour page_token={page_token!r}"
            )
        if script.raise_error is not None:
            raise script.raise_error
        assert script.content is not None
        return FetchPage(
            content=script.content,
            page_number=script.page_number,
            has_next_page=script.has_next_page,
            next_page_token=script.next_page_token,
        )
