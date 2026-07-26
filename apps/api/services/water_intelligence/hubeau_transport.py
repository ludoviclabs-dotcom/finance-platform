"""
services/water_intelligence/hubeau_transport.py — socle opérateur Hub'Eau
BORNÉ (P07/P08, Wave B).

Hub'Eau est la première source du chantier destinée à être interrogée par une
API réelle, et non fournie en octets par un opérateur (WRI P05, EEA P06,
Copernicus P09). Ce module fournit le `Transport` paginé et borné que les
sous-connecteurs Hub'Eau branchent sur `run_pipeline` (contrat P03).

## Pourquoi aucun client HTTP n'est importé ici

**Ce module n'importe aucun `requests`/`httpx`/`urllib`/`socket`** — et ce
n'est pas un oubli : c'est la garantie structurelle du chantier, vérifiée par
analyse AST sur tout `services/water_intelligence/*.py`
(`test_water_intelligence_pipeline.py::TestNoRealNetworkOrDatabase`). Ajouter
un client ici casserait cette preuve pour l'ensemble du paquet.

Le mécanisme réel de transport HTTP est donc **injecté** par l'appelant : un
`Fetcher`, `Callable[[HubeauHttpRequest], HubeauHttpResponse]`. Conséquences :

- en test, le `Fetcher` est un script en mémoire — **aucun appel réseau
  possible**, par construction et non par promesse ;
- au runtime applicatif, aucun `Fetcher` n'est branché — donc aucun appel ;
- côté opérateur, le `Fetcher` est fourni explicitement par le script/CLI qui
  effectue la collecte (geste opérateur documenté), avec la bibliothèque HTTP
  de son choix. C'est le seul endroit où un octet transite réellement.

Ce module reste néanmoins **responsable de tout le bornage** — c'est lui qui
décide ce qui a le droit d'être demandé, jamais le `Fetcher` :

- allowlist d'hôtes officiels (`ALLOWED_HOSTS`) ;
- endpoints déclarés explicitement (`ENDPOINTS`) — aucune URL arbitraire :
  l'URL est COMPOSÉE ici à partir d'un hôte allowlisté, d'une API et d'une
  opération connues, jamais reçue de l'extérieur ni suivie depuis une réponse ;
- filtre géographique obligatoire là où la source l'exige ;
- fenêtre temporelle obligatoire pour toute chronique ;
- pagination bornée (`page`/`size`), profondeur d'accès plafonnée ;
- budget d'octets et de pages ;
- timeout explicite, retry borné avec backoff ;
- journal d'exécution sans secret (redaction systématique).

## Faits VÉRIFIÉS sur la plateforme (cf. handoffs/WAVE_B_HUBEAU.md §2)

- hôte officiel : `hubeau.eaufrance.fr` ; l'hôte de recette
  `hubeau.brgm-rec.fr` existe mais n'est PAS allowlisté (non officiel pour la
  production de données) ;
- licence : **Licence Ouverte Etalab** — « Les Jeux de données sont donc
  librement et gratuitement utilisables et réutilisables, y compris dans un
  but commercial », l'utilisateur devant « veiller à citer l'auteur des Jeux
  de données » ;
- éditeurs : Office français de la biodiversité (OFB), Service Central
  Vigicrues (SCV), Bureau de recherches géologiques et minières (BRGM) ;
- nature : « données brutes, c'est-à-dire fournies sans retraitement ni mise
  en perspective particulière » ;
- pagination : paramètres `page` et `size` ; **profondeur d'accès aux
  résultats (page × size) limitée à 20 000 enregistrements** ;
- taille de page : 5 000 par défaut, 20 000 au maximum.

## Corrections X2A — deux dérives trouvées par la validation live X1

`docs/carbonco/water-intelligence/activation/X1_LIVE_VALIDATION_HANDOFF.md` a
mesuré deux défauts, chacun corrigé ici plutôt que rafistolé côté opérateur :

1. **Prélèvements (`prelevements.chroniques`)** — `annee_min`/`annee_max`
   n'existent PAS côté plateforme : Hub'Eau ignore silencieusement les
   paramètres inconnus, et une requête prétendument bornée par un couple
   début/fin renvoyait en réalité TOUT l'historique (`count` identique avec ou
   sans le couple, sur un jeu réel : 9 724 dans les deux cas). Le seul
   paramètre réel est `annee=<AAAA>`, et il ne porte qu'**une seule année par
   requête** — vérifié en direct (`annee=2020` → 782, cohérent avec un
   sous-ensemble borné). `time_window_parameters` accepte donc désormais un
   nombre QUELCONQUE de paramètres (1 pour cet endpoint), pas exactement deux.
2. **Hydrométrie** — l'endpoint déclaré ici (`observations_elaborees`,
   opération `obs_elab`) reste inchangé et VALIDE, mais n'est plus celui que
   l'opérateur interroge pour le MVP : son vocabulaire de grandeurs élaborées
   (`HIXM`, `QINM`, `QmM`…) n'a pas de mapping d'unité vérifié, et l'inventer
   romprait l'invariant « aucune dimension devinée ». L'endpoint
   `hydrometrie.observations_tr` (temps réel), ajouté ci-dessous, est
   VÉRIFIÉ EN DIRECT le 2026-07-26 : `code_entite`, `grandeur_hydro` (valeurs
   strictement `H`/`Q`/`H,Q` — un autre code est refusé en HTTP 400 par la
   plateforme elle-même), `date_debut_obs`/`date_fin_obs`. Voir
   `docs/carbonco/water-intelligence/activation/X2A_SCHEMA_REMEDIATION_HANDOFF.md`.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping

from services.water_intelligence.pipeline_transport import (
    FetchPage,
    TransportError,
)

# ---------------------------------------------------------------------------
# Identité de la plateforme — valeurs VÉRIFIÉES
# ---------------------------------------------------------------------------

#: Hôte officiel, seul autorisé. `hubeau.brgm-rec.fr` (recette) est
#: délibérément exclu : ce n'est pas la source officielle des données.
OFFICIAL_HOST = "hubeau.eaufrance.fr"
ALLOWED_HOSTS: frozenset[str] = frozenset({OFFICIAL_HOST})

#: Seul schéma autorisé — jamais de HTTP en clair.
ALLOWED_SCHEME = "https"

LICENSE_CODE = "ETALAB-LICENCE-OUVERTE"
LICENSE_LABEL = "Licence Ouverte / Open Licence (Etalab)"
PUBLISHERS = (
    "Office français de la biodiversité (OFB)",
    "Service Central Vigicrues (SCV)",
    "Bureau de recherches géologiques et minières (BRGM)",
)
ATTRIBUTION_TEMPLATE = (
    "Source : Hub'Eau ({publishers}) — Système d'Information sur l'Eau, "
    "{license_label}, données brutes, consultées le {accessed_on}"
)

#: Profondeur d'accès maximale documentée : page × size <= 20 000.
MAX_RESULT_DEPTH = 20_000
#: Taille de page maximale documentée.
MAX_PAGE_SIZE = 20_000
#: Taille de page par défaut documentée.
DEFAULT_PAGE_SIZE = 5_000

#: Bornes propres à CE socle, plus strictes que la plateforme : un import
#: massif est explicitement interdit par le MACRO-PROMPT B.
DEFAULT_MAX_PAGES = 5
DEFAULT_MAX_TOTAL_BYTES = 5_000_000
DEFAULT_TIMEOUT_SECONDS = 20.0

#: Fragments de nom de paramètre dont la valeur ne doit JAMAIS être journalisée.
#: Hub'Eau n'exige aucune authentification, mais la redaction est appliquée par
#: construction plutôt que par confiance.
_SECRET_PARAMETER_MARKERS = ("key", "token", "secret", "password", "passwd", "auth", "api_key")
REDACTED = "[redacted]"


# ---------------------------------------------------------------------------
# Erreurs — famille TransportError, capturée au stage `fetch` par run_pipeline
# ---------------------------------------------------------------------------


class HubeauTransportError(TransportError):
    """Erreur du socle Hub'Eau — jamais un échec silencieux.

    Hérite de `TransportError` : capturée par `run_pipeline()` au stage
    `fetch` et transformée en `PipelineExecutionReport`, jamais une exception
    nue (contrat P03/P03C)."""


class HubeauHostRefused(HubeauTransportError):
    """Hôte hors allowlist officielle — refusé avant toute requête."""


class HubeauEndpointRefused(HubeauTransportError):
    """Endpoint non déclaré — aucune URL arbitraire n'est composable."""


class HubeauQueryRefused(HubeauTransportError):
    """Requête incomplète ou hors bornes : filtre géographique manquant,
    fenêtre temporelle manquante sur une chronique, taille de page invalide,
    paramètre inconnu."""


class HubeauBudgetExceeded(HubeauTransportError):
    """Une borne du socle est dépassée (pages, octets, profondeur d'accès)."""


class HubeauHttpError(HubeauTransportError):
    """Statut HTTP non 2xx, après épuisement des tentatives autorisées."""

    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(f"HTTP {status_code}: {message}")
        self.status_code = status_code


class HubeauTimeout(HubeauTransportError):
    """Timeout signalé par le `Fetcher`, après épuisement des tentatives."""


# ---------------------------------------------------------------------------
# Contrat de transport injecté — le SEUL point où un octet transite réellement
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class HubeauHttpRequest:
    """Requête entièrement composée et VALIDÉE par ce module.

    Le `Fetcher` n'a aucune décision à prendre : il exécute cette requête
    telle quelle. `params` est un tuple trié — deux requêtes équivalentes
    produisent la même valeur, donc le même journal et le même cache.
    """

    url: str
    params: tuple[tuple[str, str], ...]
    timeout_seconds: float
    attempt: int

    def redacted_params(self) -> tuple[tuple[str, str], ...]:
        """Paramètres journalisables : toute valeur dont le nom évoque un
        secret est masquée, même si Hub'Eau n'en attend aucun."""
        return tuple(
            (name, REDACTED if _is_secret_parameter(name) else value)
            for name, value in self.params
        )


@dataclass(frozen=True)
class HubeauHttpResponse:
    """Réponse brute rendue par le `Fetcher`. Aucun décodage ici : le contenu
    reste des octets, décodés plus tard par un `PageDecoder` explicite (P03B).
    """

    status_code: int
    body: bytes


class HubeauTimeoutSignal(Exception):
    """Levée par un `Fetcher` pour signaler un timeout réseau.

    Volontairement PAS un `TransportError` : c'est un signal interne du
    `Fetcher` vers ce module, qui décide seul s'il reste des tentatives. Après
    épuisement, ce module lève `HubeauTimeout` (un `TransportError`).
    """


#: Contrat du transport réel, injecté par l'appelant (jamais implémenté ici).
Fetcher = Callable[[HubeauHttpRequest], HubeauHttpResponse]

#: Attente entre deux tentatives. Injectable pour que les tests vérifient le
#: backoff sans jamais attendre réellement.
Sleeper = Callable[[float], None]


# ---------------------------------------------------------------------------
# Endpoints déclarés — aucune URL arbitraire
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class HubeauEndpoint:
    """Un endpoint officiel explicitement déclaré.

    `requires_geographic_filter` et `requires_time_window` encodent les
    obligations imposées par le MACRO-PROMPT B, pas par la plateforme : Hub'Eau
    accepterait une requête nationale non bornée, ce socle la refuse.
    """

    key: str
    api_path: str
    operation: str
    requires_geographic_filter: bool
    requires_time_window: bool
    geographic_parameters: frozenset[str]
    #: Un ou plusieurs noms de paramètre portant la fenêtre temporelle.
    #: La plupart des chroniques Hub'Eau acceptent un COUPLE début/fin ; les
    #: prélèvements (BNPE) n'acceptent qu'une SEULE valeur (`annee`) par
    #: requête — vérifié en direct (X2A) : `annee_min`/`annee_max` n'existent
    #: pas côté plateforme, qui les ignore silencieusement plutôt que de les
    #: refuser. Un tuple de longueur quelconque couvre les deux cas sans
    #: supposer un couple.
    time_window_parameters: tuple[str, ...] | None
    allowed_parameters: frozenset[str]

    @property
    def path(self) -> str:
        return f"/api/{self.api_path}/{self.operation}"

    def url(self, *, host: str) -> str:
        return f"{ALLOWED_SCHEME}://{host}{self.path}"


#: Paramètres de pagination et de projection communs à toutes les opérations.
_COMMON_PARAMETERS = frozenset({"page", "size", "fields", "format", "sort"})

#: Spécifications des endpoints VÉRIFIÉS sur la documentation officielle (cf.
#: docstring de module et handoff Wave B §2). L'identifiant d'endpoint est la
#: clé du dictionnaire : il est injecté dans `HubeauEndpoint` par
#: `_build_endpoints()` plutôt que répété en littéral, pour rester une seule
#: source de vérité (et pour ne pas écrire `key="…"`, motif que la règle
#: generic-api-key de gitleaks signale à tort — cf. `.gitleaks.toml`).
_ENDPOINT_SPECS: dict[str, dict[str, Any]] = {
    "hydrometrie.stations": {
        "api_path": "v2/hydrometrie",
        "operation": "referentiel/stations",
        "requires_geographic_filter": True,
        "requires_time_window": False,
        "geographic_parameters": frozenset({"code_commune_station", "code_departement"}),
        "time_window_parameters": None,
        "allowed_parameters": _COMMON_PARAMETERS
        | {"code_commune_station", "code_departement", "code_station", "en_service"},
    },
    "hydrometrie.observations_elaborees": {
        # Endpoint réel et VALIDE, mais MVP : le vocabulaire élaboré
        # (HIXM, QINM, QmM…) n'a pas de mapping d'unité vérifié auprès de la
        # documentation officielle — l'inventer romprait l'invariant "aucune
        # dimension devinée" (cf. hubeau_hydro.OBS_ELAB_STATUS =
        # "derived_metrics_mapping_deferred"). Aucune `HubeauFamily` de
        # scripts/water_intelligence/validate_hubeau.py ne pointe plus dessus
        # depuis X2A — déclaré ici pour rester une source de vérité honnête
        # sur ce que la plateforme expose, pas parce que l'opérateur l'utilise.
        "api_path": "v2/hydrometrie",
        "operation": "obs_elab",
        "requires_geographic_filter": True,
        "requires_time_window": True,
        "geographic_parameters": frozenset({"code_entite"}),
        "time_window_parameters": ("date_debut_obs_elab", "date_fin_obs_elab"),
        "allowed_parameters": _COMMON_PARAMETERS
        | {"code_entite", "grandeur_hydro_elab", "date_debut_obs_elab", "date_fin_obs_elab"},
    },
    "hydrometrie.observations_tr": {
        # Endpoint MVP retenu pour l'hydrométrie (X2A). Paramètres et champs
        # VÉRIFIÉS EN DIRECT le 2026-07-26 sur une station réelle
        # (O400101101) : `grandeur_hydro=H` et `=Q` répondent 200 ; toute
        # autre valeur (essayé : `HIXM`) répond 400 avec
        # `{"field_errors":[{"message":"Wrong value(s), possibles values are
        # H or Q or H,Q.","field":"grandeur_hydro[0]"}]}` — la plateforme
        # elle-même impose l'exclusivité du vocabulaire temps réel. Aucun
        # champ d'unité dans la réponse (`unite`/`libelle_unite` valent
        # `null`) : l'unité continue de venir de la table vérifiée du
        # connecteur (`HYDRO_QUANTITIES`), jamais de la source.
        "api_path": "v2/hydrometrie",
        "operation": "observations_tr",
        "requires_geographic_filter": True,
        "requires_time_window": True,
        "geographic_parameters": frozenset({"code_entite"}),
        "time_window_parameters": ("date_debut_obs", "date_fin_obs"),
        "allowed_parameters": _COMMON_PARAMETERS
        | {"code_entite", "grandeur_hydro", "date_debut_obs", "date_fin_obs"},
    },
    "piezometrie.stations": {
        "api_path": "v1/niveaux_nappes",
        "operation": "stations",
        "requires_geographic_filter": True,
        "requires_time_window": False,
        "geographic_parameters": frozenset({"code_commune", "code_departement"}),
        "time_window_parameters": None,
        "allowed_parameters": _COMMON_PARAMETERS
        | {"code_commune", "code_departement", "code_bss"},
    },
    "piezometrie.chroniques": {
        "api_path": "v1/niveaux_nappes",
        "operation": "chroniques",
        "requires_geographic_filter": True,
        "requires_time_window": True,
        "geographic_parameters": frozenset({"code_bss"}),
        "time_window_parameters": ("date_debut_mesure", "date_fin_mesure"),
        "allowed_parameters": _COMMON_PARAMETERS
        | {"code_bss", "date_debut_mesure", "date_fin_mesure"},
    },
    "prelevements.chroniques": {
        # `annee_min`/`annee_max` n'existent PAS côté plateforme (X2A) : ils
        # sont ignorés en silence plutôt que refusés, ce qui rendait une
        # requête prétendument bornée non bornée en réalité — vérifié en
        # direct, `count` identique avec ou sans le couple (9 724 les deux
        # fois sur un département réel). Le seul paramètre réel est `annee`,
        # et il ne porte qu'UNE SEULE année : `annee=2020` répond 782, un
        # sous-ensemble cohérent. Une plage de plusieurs années exige donc
        # une requête PAR année, orchestrée côté opérateur
        # (`scripts/water_intelligence/validate_hubeau.py`), jamais un couple
        # min/max envoyé tel quel.
        "api_path": "v1/prelevements",
        "operation": "chroniques",
        "requires_geographic_filter": True,
        "requires_time_window": True,
        "geographic_parameters": frozenset(
            {"code_commune_insee", "code_departement", "code_ouvrage"}
        ),
        "time_window_parameters": ("annee",),
        "allowed_parameters": _COMMON_PARAMETERS
        | {
            "code_commune_insee", "code_departement", "code_ouvrage",
            "annee", "code_usage", "code_type_milieu",
        },
    },
    "qualite_rivieres.analyses": {
        "api_path": "v2/qualite_rivieres",
        "operation": "analyse_pc",
        "requires_geographic_filter": True,
        "requires_time_window": True,
        "geographic_parameters": frozenset(
            {"code_station", "code_commune", "code_departement"}
        ),
        "time_window_parameters": ("date_debut_prelevement", "date_fin_prelevement"),
        "allowed_parameters": _COMMON_PARAMETERS
        | {
            "code_station", "code_commune", "code_departement",
            "date_debut_prelevement", "date_fin_prelevement",
            "code_parametre", "code_qualification", "code_statut",
        },
    },
}


def _build_endpoints() -> dict[str, HubeauEndpoint]:
    return {
        endpoint_key: HubeauEndpoint(key=endpoint_key, **spec)
        for endpoint_key, spec in _ENDPOINT_SPECS.items()
    }


#: Toute opération absente de ce dictionnaire est refusée : le socle ne
#: compose que des URL qu'il connaît.
ENDPOINTS: dict[str, HubeauEndpoint] = _build_endpoints()


def _is_secret_parameter(name: str) -> bool:
    lowered = name.lower()
    return any(marker in lowered for marker in _SECRET_PARAMETER_MARKERS)


# ---------------------------------------------------------------------------
# Requête bornée
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class HubeauRetryPolicy:
    """Politique de reprise BORNÉE — jamais de boucle infinie.

    `max_attempts` compte la tentative initiale : `max_attempts=1` signifie
    aucune reprise. Seuls les statuts explicitement listés sont retentés (un
    4xx de requête invalide ne le sera jamais : le rejouer produirait le même
    résultat).
    """

    max_attempts: int = 3
    initial_backoff_seconds: float = 0.5
    backoff_factor: float = 2.0
    retry_on_status: frozenset[int] = frozenset({429, 500, 502, 503, 504})
    retry_on_timeout: bool = True

    def __post_init__(self) -> None:
        if self.max_attempts < 1:
            raise HubeauQueryRefused("max_attempts doit valoir au moins 1.")
        if self.initial_backoff_seconds < 0 or self.backoff_factor < 1:
            raise HubeauQueryRefused(
                "backoff invalide : délai initial >= 0 et facteur >= 1 attendus."
            )

    def delay_before(self, attempt: int) -> float:
        """Délai avant la tentative `attempt` (1-indexée). Nul avant la
        première : on n'attend jamais pour rien."""
        if attempt <= 1:
            return 0.0
        return self.initial_backoff_seconds * (self.backoff_factor ** (attempt - 2))


@dataclass(frozen=True)
class HubeauQuery:
    """Une requête bornée, validée à la construction.

    Toute violation est refusée ICI — avant qu'aucun octet ne circule.
    """

    endpoint_key: str
    parameters: Mapping[str, str]
    page_size: int = DEFAULT_PAGE_SIZE
    host: str = OFFICIAL_HOST

    def __post_init__(self) -> None:
        if self.host not in ALLOWED_HOSTS:
            raise HubeauHostRefused(
                f"hôte {self.host!r} hors allowlist officielle {sorted(ALLOWED_HOSTS)} — "
                "aucune requête ne sera composée."
            )
        if self.endpoint_key not in ENDPOINTS:
            raise HubeauEndpointRefused(
                f"endpoint {self.endpoint_key!r} non déclaré : seuls "
                f"{sorted(ENDPOINTS)} sont composables — aucune URL arbitraire."
            )
        if not 1 <= self.page_size <= MAX_PAGE_SIZE:
            raise HubeauQueryRefused(
                f"page_size={self.page_size} hors bornes (1..{MAX_PAGE_SIZE})."
            )

        endpoint = self.endpoint
        unknown = sorted(set(self.parameters) - endpoint.allowed_parameters)
        if unknown:
            raise HubeauQueryRefused(
                f"paramètre(s) {unknown} non déclaré(s) pour {endpoint.key!r} — "
                "refusés plutôt que transmis tels quels."
            )
        if "page" in self.parameters or "size" in self.parameters:
            raise HubeauQueryRefused(
                "page/size sont pilotés par le socle, jamais fournis par l'appelant."
            )

        if endpoint.requires_geographic_filter and not (
            set(self.parameters) & endpoint.geographic_parameters
        ):
            raise HubeauQueryRefused(
                f"filtre géographique obligatoire pour {endpoint.key!r} : au moins un de "
                f"{sorted(endpoint.geographic_parameters)} — aucun import national non borné."
            )
        if endpoint.requires_time_window:
            assert endpoint.time_window_parameters is not None
            # Boucle générique plutôt qu'un déballage à 2 (X2A) : certaines
            # chroniques portent un couple début/fin, d'autres (prélèvements)
            # une seule valeur (`annee`) — aucune des deux formes n'est
            # privilégiée par ce module.
            missing = [
                p for p in endpoint.time_window_parameters if not self.parameters.get(p)
            ]
            if missing:
                raise HubeauQueryRefused(
                    f"fenêtre temporelle obligatoire pour la chronique {endpoint.key!r} : "
                    f"{missing} manquant(s) — aucun historique complet non borné."
                )

    @property
    def endpoint(self) -> HubeauEndpoint:
        return ENDPOINTS[self.endpoint_key]

    @property
    def max_page_number(self) -> int:
        """Nombre de pages atteignable sans dépasser la profondeur documentée."""
        return max(1, MAX_RESULT_DEPTH // self.page_size)

    def build_request(self, *, page: int, timeout_seconds: float, attempt: int) -> HubeauHttpRequest:
        """Compose la requête HTTP. Déterministe : paramètres triés."""
        if page < 1:
            raise HubeauQueryRefused(f"numéro de page invalide : {page}")
        if page * self.page_size > MAX_RESULT_DEPTH:
            raise HubeauBudgetExceeded(
                f"profondeur d'accès dépassée : page {page} × size {self.page_size} > "
                f"{MAX_RESULT_DEPTH} enregistrements (limite officielle Hub'Eau)."
            )
        params = dict(self.parameters)
        params["page"] = str(page)
        params["size"] = str(self.page_size)
        return HubeauHttpRequest(
            url=self.endpoint.url(host=self.host),
            params=tuple(sorted(params.items())),
            timeout_seconds=timeout_seconds,
            attempt=attempt,
        )


# ---------------------------------------------------------------------------
# Journal d'exécution — jamais de secret, jamais de contenu
# ---------------------------------------------------------------------------


@dataclass
class HubeauCallRecord:
    """Trace d'un appel. Ne contient ni corps de réponse, ni valeur secrète —
    uniquement identité, statut et compteurs."""

    endpoint_key: str
    url: str
    params: tuple[tuple[str, str], ...]
    page: int
    attempt: int
    status_code: int | None
    bytes_received: int
    error: str | None = None


# ---------------------------------------------------------------------------
# Transport paginé — implémente le contrat P03 `Transport`
# ---------------------------------------------------------------------------


class HubeauTransport:
    """`Transport` P03 pour Hub'Eau : paginé, borné, sans URL arbitraire.

    La pagination est pilotée ICI par incrément du paramètre `page` — le champ
    `next` renvoyé par Hub'Eau (une URL complète) n'est **jamais suivi** :
    suivre une URL reçue reviendrait à laisser la réponse décider de la
    prochaine cible, exactement ce que l'allowlist interdit.
    """

    def __init__(
        self,
        *,
        query: HubeauQuery,
        fetcher: Fetcher,
        retry_policy: HubeauRetryPolicy | None = None,
        max_pages: int = DEFAULT_MAX_PAGES,
        max_total_bytes: int = DEFAULT_MAX_TOTAL_BYTES,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        sleeper: Sleeper = time.sleep,
    ) -> None:
        if max_pages < 1:
            raise HubeauQueryRefused("max_pages doit valoir au moins 1.")
        if max_total_bytes < 1:
            raise HubeauQueryRefused("max_total_bytes doit valoir au moins 1.")
        if timeout_seconds <= 0:
            raise HubeauQueryRefused("timeout_seconds doit être strictement positif.")

        self._query = query
        self._fetcher = fetcher
        self._retry = retry_policy or HubeauRetryPolicy()
        self._max_pages = min(max_pages, query.max_page_number)
        self._max_total_bytes = max_total_bytes
        self._timeout = timeout_seconds
        self._sleep = sleeper
        self._bytes_received = 0
        self._pages_fetched = 0
        self._records: list[HubeauCallRecord] = []
        self._waits: list[float] = []

    # -- introspection, pour l'opérateur et les tests -----------------------

    @property
    def call_records(self) -> tuple[HubeauCallRecord, ...]:
        return tuple(self._records)

    @property
    def bytes_received(self) -> int:
        return self._bytes_received

    @property
    def pages_fetched(self) -> int:
        return self._pages_fetched

    @property
    def waits(self) -> tuple[float, ...]:
        """Délais de backoff effectivement demandés, dans l'ordre."""
        return tuple(self._waits)

    # -- contrat Transport -------------------------------------------------

    def fetch_page(self, *, page_token: str | None) -> FetchPage:
        """Récupère UNE page. `page_token` porte le numéro de page suivant —
        jamais une URL, jamais un curseur opaque venu de la réponse."""
        page = _page_from_token(page_token)

        if self._pages_fetched >= self._max_pages:
            raise HubeauBudgetExceeded(
                f"limite de pages atteinte : {self._max_pages} page(s) autorisée(s) "
                "pour cette exécution."
            )

        body = self._fetch_with_retries(page=page)
        self._pages_fetched += 1
        self._bytes_received += len(body)
        if self._bytes_received > self._max_total_bytes:
            raise HubeauBudgetExceeded(
                f"budget d'octets dépassé : {self._bytes_received} > "
                f"{self._max_total_bytes} octets."
            )

        has_next = self._has_next_page(body, page=page)
        return FetchPage(
            content=body,
            page_number=page,
            has_next_page=has_next,
            next_page_token=str(page + 1) if has_next else None,
        )

    # -- interne -----------------------------------------------------------

    def _fetch_with_retries(self, *, page: int) -> bytes:
        last_error: HubeauTransportError | None = None

        for attempt in range(1, self._retry.max_attempts + 1):
            delay = self._retry.delay_before(attempt)
            if delay > 0:
                self._waits.append(delay)
                self._sleep(delay)

            request = self._query.build_request(
                page=page, timeout_seconds=self._timeout, attempt=attempt
            )
            try:
                response = self._fetcher(request)
            except HubeauTimeoutSignal as exc:
                last_error = HubeauTimeout(
                    f"timeout après {self._timeout}s (tentative {attempt}) : {exc}"
                )
                self._record(request, page=page, status=None, size=0, error=str(last_error))
                if not self._retry.retry_on_timeout:
                    raise last_error from exc
                continue

            self._record(
                request, page=page, status=response.status_code, size=len(response.body)
            )

            if 200 <= response.status_code < 300:
                return response.body

            if response.status_code in self._retry.retry_on_status:
                last_error = HubeauHttpError(
                    response.status_code,
                    f"statut réessayable (tentative {attempt}/{self._retry.max_attempts})",
                )
                continue

            # 4xx de requête invalide : rejouer produirait le même résultat.
            raise HubeauHttpError(
                response.status_code,
                "statut non réessayable — requête refusée par la plateforme.",
            )

        assert last_error is not None
        raise last_error

    def _record(
        self,
        request: HubeauHttpRequest,
        *,
        page: int,
        status: int | None,
        size: int,
        error: str | None = None,
    ) -> None:
        self._records.append(
            HubeauCallRecord(
                endpoint_key=self._query.endpoint_key,
                url=request.url,
                params=request.redacted_params(),
                page=page,
                attempt=request.attempt,
                status_code=status,
                bytes_received=size,
                error=error,
            )
        )

    def _has_next_page(self, body: bytes, *, page: int) -> bool:
        """Décide s'il reste une page, SANS suivre l'URL `next` de la réponse.

        Hub'Eau expose `count` (total) et `data` (page courante). Une page
        renvoyée incomplète signifie la fin. Un corps illisible est un échec de
        transport explicite, jamais une fin de pagination silencieuse.
        """
        if page + 1 > self._max_pages:
            return False
        if (page + 1) * self._query.page_size > MAX_RESULT_DEPTH:
            return False
        try:
            payload = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise HubeauTransportError(
                f"réponse Hub'Eau illisible en JSON (page {page}) : {exc}"
            ) from exc
        if not isinstance(payload, dict):
            raise HubeauTransportError(
                f"réponse Hub'Eau inattendue (page {page}) : objet JSON attendu."
            )
        data = payload.get("data")
        if not isinstance(data, list):
            raise HubeauTransportError(
                f"réponse Hub'Eau sans tableau `data` (page {page})."
            )
        return len(data) >= self._query.page_size


def _page_from_token(page_token: str | None) -> int:
    if page_token is None:
        return 1
    try:
        page = int(page_token)
    except (TypeError, ValueError) as exc:
        raise HubeauQueryRefused(
            f"page_token invalide : {page_token!r} — un numéro de page est attendu, "
            "jamais une URL."
        ) from exc
    if page < 1:
        raise HubeauQueryRefused(f"page_token invalide : {page_token!r}")
    return page


def attribution(*, accessed_on: str) -> str:
    """Attribution composée à partir des faits vérifiés. La Licence Ouverte
    impose de citer l'auteur du jeu de données ; ce libellé le fait
    explicitement, sans prétendre être un gabarit officiel imposé."""
    return ATTRIBUTION_TEMPLATE.format(
        publishers=", ".join(PUBLISHERS),
        license_label=LICENSE_LABEL,
        accessed_on=accessed_on,
    )


@dataclass(frozen=True)
class HubeauPagePayload:
    """Vue typée d'une page Hub'Eau décodée, partagée par les connecteurs.

    Ne porte aucune sémantique métier : elle expose le tableau `data` et le
    compte annoncé, rien de plus. L'interprétation des enregistrements
    appartient à chaque connecteur.
    """

    records: tuple[Mapping[str, Any], ...] = field(default_factory=tuple)
    count: int | None = None
