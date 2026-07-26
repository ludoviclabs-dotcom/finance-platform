"""scripts/water_intelligence/fetcher.py — Fetcher opérateur BORNÉ (X1.2).

Le seul module du dépôt qui ouvre une connexion vers une source hydrique
officielle. Tout ce qui l'entoure — `services/water_intelligence` — est
structurellement incapable de le faire, et le reste : ce fichier n'est jamais
importé par le paquet de services, seulement par les commandes opérateur de
`scripts/water_intelligence`.

## Pourquoi la bibliothèque standard

`services/water_intelligence/hubeau_transport.py` documente déjà le contrat :
« le mécanisme réel de transport HTTP est injecté par l'appelant […] avec la
bibliothèque HTTP de son choix ». `requests` n'est pas dans
`apps/api/requirements.txt` ; `httpx` y est, mais comme dépendance de
`fastapi[all]`/`starlette` pour le client de test, pas comme client sortant
approuvé du backend. Ajouter une dépendance réseau à l'API pour un geste
opérateur qui tourne sur un poste serait payer en surface d'attaque ce qu'on
peut obtenir de `urllib` — présent partout, et dont le comportement de
redirection est ici entièrement repris en main.

## Ce que ce Fetcher refuse, avant tout octet

- tout schéma autre que `https` ;
- tout hôte hors de l'allowlist passée à l'appel — jamais une allowlist
  globale implicite ;
- toute redirection vers un hôte hors allowlist, ou vers `http` ;
- plus de `max_redirects` redirections ;
- une réponse dont le corps dépasse `max_bytes` (lue avec UN octet de marge :
  c'est la seule façon de distinguer « exactement à la limite » de
  « tronquée ») ;
- une URL portant un fragment ou des identifiants dans l'autorité
  (`user:pass@`).

Il ne suit JAMAIS une URL fournie par une réponse (champ `next` de Hub'Eau,
lien de pagination, en-tête `Link`). La pagination est pilotée par le socle
`HubeauTransport`, qui compose lui-même chaque URL à partir d'un hôte
allowlisté et d'un endpoint déclaré.

## Ce qu'il journalise

Une identité et des compteurs : hôte, chemin, paramètres avec valeurs
masquées dès que leur nom évoque un secret, statut, octets, durée, checksum.
Jamais le corps, jamais une valeur de paramètre sensible, jamais un en-tête
de requête reçu de l'extérieur.
"""

from __future__ import annotations

import hashlib
import http.client
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Iterable, Mapping, Sequence

#: Seul schéma acceptable. Une source publique officielle qui n'offrirait que
#: HTTP ne serait pas collectée : la valeur d'un jeu de données ouvert ne
#: compense pas un transport dont on ne peut pas vérifier l'origine.
ALLOWED_SCHEME = "https"

#: User-Agent explicite. Un opérateur d'API publique doit pouvoir identifier
#: et joindre l'appelant : un UA anonyme ou usurpé transforme une collecte
#: légitime et bornée en trafic indistinguable d'un scraper.
USER_AGENT = (
    "CarbonCo-WaterIntelligence-OperatorValidation/1.0 "
    "(+https://github.com/ludoviclabs-dotcom/finance-platform)"
)

DEFAULT_TIMEOUT_SECONDS = 20.0
DEFAULT_MAX_BYTES = 5_000_000
DEFAULT_MAX_REDIRECTS = 3

#: Fragments de nom de paramètre dont la valeur n'est jamais journalisée.
#: Même liste que `services/water_intelligence/hubeau_transport.py` : les deux
#: journaux doivent masquer les mêmes choses, sinon le plus permissif décide.
_SECRET_PARAMETER_MARKERS = (
    "key", "token", "secret", "password", "passwd", "auth", "api_key",
)
REDACTED = "[redacted]"


class FetcherRefusal(Exception):
    """Une borne du Fetcher est franchie — refus AVANT ou PENDANT le transfert.

    Volontairement distincte d'une erreur réseau : un refus est une décision
    de ce module, pas un incident de la source.
    """


class FetcherNetworkError(Exception):
    """La source n'a pas répondu, ou la connexion a échoué."""


class FetcherTimeout(FetcherNetworkError):
    """Délai dépassé — distingué d'un échec de connexion pour que le rapport
    puisse dire lequel des deux s'est produit."""


def is_secret_parameter(name: str) -> bool:
    lowered = name.lower()
    return any(marker in lowered for marker in _SECRET_PARAMETER_MARKERS)


def redact_params(
    params: Sequence[tuple[str, str]] | Mapping[str, str],
) -> tuple[tuple[str, str], ...]:
    """Paramètres journalisables, triés pour être comparables d'une exécution
    à l'autre."""
    items = params.items() if isinstance(params, Mapping) else params
    return tuple(
        sorted(
            (name, REDACTED if is_secret_parameter(name) else value)
            for name, value in items
        )
    )


def public_url(url: str) -> str:
    """URL journalisable : schéma, hôte et chemin, SANS query.

    Les rapports sont commités. Une query complète y ferait entrer les codes
    géographiques et les fenêtres temporelles d'une recette — au mieux du
    bruit, au pire un identifiant qu'on ne voulait pas publier. Les
    paramètres sont journalisés à part, masqués quand il le faut.
    """
    parts = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


@dataclass(frozen=True)
class FetchOutcome:
    """Résultat d'UN transfert. `body` n'est jamais journalisé ni commité."""

    status_code: int
    body: bytes
    content_type: str | None
    final_url: str
    redirects: tuple[str, ...]
    elapsed_seconds: float

    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.body).hexdigest()

    @property
    def bytes_received(self) -> int:
        return len(self.body)


@dataclass
class FetchLogEntry:
    """Trace expurgée d'un transfert, destinée aux rapports commités."""

    url: str
    params: tuple[tuple[str, str], ...]
    status_code: int | None
    bytes_received: int
    content_type: str | None
    sha256: str | None
    elapsed_seconds: float
    redirects: tuple[str, ...] = ()
    error: str | None = None

    def as_mapping(self) -> dict[str, object]:
        return {
            "url": self.url,
            "params": [list(pair) for pair in self.params],
            "status_code": self.status_code,
            "bytes_received": self.bytes_received,
            "content_type": self.content_type,
            "sha256": self.sha256,
            "elapsed_seconds": round(self.elapsed_seconds, 3),
            "redirects": list(self.redirects),
            "error": self.error,
        }


class _BoundedRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Autorise une redirection uniquement vers l'allowlist, en HTTPS.

    `urllib` suit les redirections par défaut, sans rien vérifier : une source
    compromise ou simplement mal configurée pourrait renvoyer un `Location`
    vers n'importe quel hôte, et l'allowlist vérifiée à l'appel n'aurait servi
    à rien. Ce handler la réapplique à CHAQUE saut.
    """

    def __init__(self, allowed_hosts: frozenset[str], max_redirects: int) -> None:
        self._allowed_hosts = allowed_hosts
        self._max_redirects = max_redirects
        self.redirects: list[str] = []

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        if len(self.redirects) >= self._max_redirects:
            raise FetcherRefusal(
                f"plus de {self._max_redirects} redirection(s) — chaîne interrompue."
            )
        _assert_url_allowed(newurl, allowed_hosts=self._allowed_hosts, context="redirection")
        self.redirects.append(public_url(newurl))
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _assert_url_allowed(url: str, *, allowed_hosts: frozenset[str], context: str) -> None:
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != ALLOWED_SCHEME:
        raise FetcherRefusal(
            f"{context} : schéma {parts.scheme!r} refusé — seul {ALLOWED_SCHEME!r} est admis."
        )
    if parts.username or parts.password:
        raise FetcherRefusal(
            f"{context} : identifiants dans l'URL refusés — ils finiraient dans un journal."
        )
    if parts.fragment:
        raise FetcherRefusal(f"{context} : fragment d'URL refusé.")
    host = (parts.hostname or "").lower()
    if host not in allowed_hosts:
        raise FetcherRefusal(
            f"{context} : hôte {host!r} hors allowlist {sorted(allowed_hosts)} — "
            "aucune requête ne sera émise."
        )


@dataclass
class OperatorFetcher:
    """Fetcher borné, réutilisable pour toutes les commandes opérateur.

    `allowed_hosts` est fourni par l'appelant à la construction : chaque
    commande déclare les hôtes de SA source, et ne peut pas atteindre ceux
    d'une autre.
    """

    allowed_hosts: frozenset[str]
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS
    max_bytes: int = DEFAULT_MAX_BYTES
    max_redirects: int = DEFAULT_MAX_REDIRECTS
    log: list[FetchLogEntry] = field(default_factory=list)
    #: Injectable pour les tests : aucune socket n'est ouverte quand un
    #: transport de substitution est fourni. Les tests ne « débranchent » donc
    #: pas le réseau — ils n'en ouvrent jamais.
    opener_factory: object | None = None
    clock: object = time.monotonic

    def __post_init__(self) -> None:
        if not self.allowed_hosts:
            raise FetcherRefusal("allowlist vide : aucune cible ne serait autorisée.")
        if self.timeout_seconds <= 0:
            raise FetcherRefusal("timeout_seconds doit être strictement positif.")
        if self.max_bytes < 1:
            raise FetcherRefusal("max_bytes doit valoir au moins 1.")
        if self.max_redirects < 0:
            raise FetcherRefusal("max_redirects ne peut pas être négatif.")
        self.allowed_hosts = frozenset(h.lower() for h in self.allowed_hosts)

    # -- API ---------------------------------------------------------------

    def fetch(
        self,
        url: str,
        *,
        params: Sequence[tuple[str, str]] | Mapping[str, str] | None = None,
        accept: str | None = None,
    ) -> FetchOutcome:
        """Effectue UN transfert borné. Lève plutôt que de rendre un résultat
        partiel : une réponse tronquée ressemble trop à une réponse courte."""
        pairs = _as_pairs(params)
        started = self.clock()  # type: ignore[operator]

        # Le refus PRÉALABLE est journalisé comme les autres. Un rapport dont
        # la table des transferts est vide dirait « rien n'a été tenté », alors
        # qu'une cible a été refusée : c'est précisément ce que l'auditeur doit
        # voir.
        try:
            _assert_url_allowed(url, allowed_hosts=self.allowed_hosts, context="requête")
        except FetcherRefusal as exc:
            self._log(url, pairs, None, 0, None, None, self._elapsed(started), (), str(exc))
            raise

        full_url = url if not pairs else f"{url}?{urllib.parse.urlencode(pairs)}"

        try:
            outcome = self._transfer(full_url, accept=accept, started=started)
        except FetcherRefusal as exc:
            self._log(url, pairs, None, 0, None, None, self._elapsed(started), (), str(exc))
            raise
        except FetcherTimeout as exc:
            self._log(url, pairs, None, 0, None, None, self._elapsed(started), (), str(exc))
            raise
        except FetcherNetworkError as exc:
            self._log(url, pairs, None, 0, None, None, self._elapsed(started), (), str(exc))
            raise

        self._log(
            url,
            pairs,
            outcome.status_code,
            outcome.bytes_received,
            outcome.content_type,
            outcome.sha256,
            outcome.elapsed_seconds,
            outcome.redirects,
            None,
        )
        return outcome

    # -- interne -----------------------------------------------------------

    def _transfer(self, full_url: str, *, accept: str | None, started: float) -> FetchOutcome:
        redirect_handler = _BoundedRedirectHandler(self.allowed_hosts, self.max_redirects)
        opener = (
            self.opener_factory(redirect_handler)  # type: ignore[operator]
            if self.opener_factory is not None
            else urllib.request.build_opener(redirect_handler)
        )

        request = urllib.request.Request(full_url, method="GET")
        request.add_header("User-Agent", USER_AGENT)
        request.add_header("Accept-Encoding", "identity")
        if accept:
            request.add_header("Accept", accept)

        try:
            with opener.open(request, timeout=self.timeout_seconds) as response:
                # UN octet de marge : sans lui, un corps exactement égal à la
                # limite serait indiscernable d'un corps tronqué.
                body = response.read(self.max_bytes + 1)
                status = int(getattr(response, "status", 0) or response.getcode() or 0)
                content_type = response.headers.get("Content-Type")
                final_url = response.geturl()
        except urllib.error.HTTPError as exc:
            # Un statut non-2xx N'EST PAS une erreur de transport : c'est une
            # réponse, et le rapport doit pouvoir la citer telle quelle.
            body = exc.read(self.max_bytes + 1)
            status = int(exc.code)
            content_type = exc.headers.get("Content-Type") if exc.headers else None
            final_url = exc.geturl() if hasattr(exc, "geturl") else full_url
        except socket.timeout as exc:
            raise FetcherTimeout(f"délai de {self.timeout_seconds}s dépassé : {exc}") from exc
        except urllib.error.URLError as exc:
            reason = getattr(exc, "reason", exc)
            if isinstance(reason, socket.timeout):
                raise FetcherTimeout(
                    f"délai de {self.timeout_seconds}s dépassé : {reason}"
                ) from exc
            raise FetcherNetworkError(f"connexion impossible : {reason}") from exc
        except (http.client.HTTPException, OSError) as exc:
            raise FetcherNetworkError(f"transfert interrompu : {exc}") from exc

        if len(body) > self.max_bytes:
            raise FetcherRefusal(
                f"budget d'octets dépassé : la réponse dépasse {self.max_bytes} octets — "
                "abandon plutôt que troncature silencieuse."
            )

        return FetchOutcome(
            status_code=status,
            body=body,
            content_type=content_type,
            final_url=public_url(final_url),
            redirects=tuple(redirect_handler.redirects),
            elapsed_seconds=self._elapsed(started),
        )

    def _elapsed(self, started: float) -> float:
        return float(self.clock()) - float(started)  # type: ignore[operator]

    def _log(
        self,
        url: str,
        pairs: Sequence[tuple[str, str]],
        status: int | None,
        size: int,
        content_type: str | None,
        sha256: str | None,
        elapsed: float,
        redirects: Iterable[str],
        error: str | None,
    ) -> None:
        self.log.append(
            FetchLogEntry(
                url=public_url(url),
                params=redact_params(pairs),
                status_code=status,
                bytes_received=size,
                content_type=content_type,
                sha256=sha256,
                elapsed_seconds=elapsed,
                redirects=tuple(redirects),
                error=error,
            )
        )

    @property
    def total_bytes(self) -> int:
        return sum(entry.bytes_received for entry in self.log)


def _as_pairs(
    params: Sequence[tuple[str, str]] | Mapping[str, str] | None,
) -> tuple[tuple[str, str], ...]:
    if params is None:
        return ()
    items = params.items() if isinstance(params, Mapping) else params
    return tuple(sorted((str(name), str(value)) for name, value in items))
