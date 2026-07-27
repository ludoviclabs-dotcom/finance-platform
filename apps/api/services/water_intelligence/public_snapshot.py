"""
services/water_intelligence/public_snapshot.py — assembleur déterministe du
snapshot PUBLIC Water Intelligence (P10, Wave C).

## Ce que ce module fait, et ne fait pas

Il **assemble** : il prend des observations déjà produites par les
connecteurs (Waves A et B, tous en dry-run), applique le gate licence, écarte
ce qui n'est pas publiable, et produit une enveloppe immuable destinée à la
surface publique.

Il **n'ingère rien** : aucun appel réseau, aucune base, aucune horloge.
`generated_at` est INJECTÉ par l'appelant — un snapshot reproductible ne
dépend d'aucune horloge implicite.

Il **ne publie rien de lui-même** : produire le snapshot n'autorise pas à le
servir. La décision reste humaine (`publication_decisions.py`).

## Pourquoi une enveloppe distincte de `WaterIntelligenceManifest`

Le contrat P02 impose `sources: min_length=1` : un `WaterIntelligenceManifest`
ne peut pas être vide, par construction. Or l'état attendu du MVP est
précisément **aucune source publiable** (aucune décision humaine active).

Plutôt que d'affaiblir P02 — un manifest avec zéro source serait un manifest
qui ne décrit rien — Wave C ajoute `WaterPublicSnapshot`, qui :

- porte le `manifest` P02 **seulement s'il y a quelque chose à décrire**
  (`None` sinon), sans jamais relâcher sa validation ;
- porte **toujours** les exclusions, les décisions, les budgets et les
  avertissements — c'est-à-dire de l'information réelle et vérifiable, même
  quand zéro valeur est publiée.

Un snapshot vide est donc un objet **valide et complet**, pas un échec.

## Invariants

- déterminisme total : mêmes entrées → mêmes octets, même ETag ;
- indépendance à l'ordre des observations en entrée ;
- toute source non explicitement autorisée est **exclue avec un motif** ;
- une observation dont la licence interdit l'affichage n'est jamais publiée,
  même si sa source est autorisée (double barrière, cf. §7.4 du blueprint :
  « l'UI ne doit jamais être le dernier rempart ») ;
- aucune donnée tenant : le read model public n'a aucun champ d'entreprise,
  et un garde-fou explicite refuse tout `company_id`/`tenant_id` ;
- l'identité temporelle du commit C1 est appliquée : deux périodes sont deux
  faits, et une collision est une erreur, jamais un écrasement.
"""

from __future__ import annotations

import gzip
import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping, Sequence

from models.water_intelligence import (
    WaterIntelligenceManifest,
    WaterMetricObservation,
)
from services.water_intelligence.observation_identity import (
    WaterObservationLedger,
    build_water_observation_identity,
    content_digest,
)
from services.water_intelligence.publication_decisions import (
    EXCLUSION_NO_DECISION,
    PublicationDecisionRegistry,
)

#: Version du SCHÉMA de snapshot public. Distincte de `manifest_version`
#: (P02) : elle décrit l'enveloppe Wave C, pas le manifest qu'elle contient.
SNAPSHOT_SCHEMA_VERSION = "1.0.0"

#: Budgets repris de `contracts/P02_DATA_CONTRACTS.md` §7 — non renégociés.
#: Motif d'exclusion propre à l'assembleur : la décision humaine autorise la
#: source, mais sa référence de provenance ne porte pas l'URL officielle stable
#: exigée pour satisfaire la condition de paternité de la Licence Ouverte 2.0.
#:
#: Ce n'est pas un doublon du gate licence : celui-ci vérifie qu'un HUMAIN a
#: autorisé, celui-là qu'on sait DIRE d'où vient la donnée. Une source publiée
#: sans provenance nommable est une donnée orpheline sur une surface publique —
#: l'écarter avec motif est préférable à la publier muette.
EXCLUSION_PROVENANCE_INCOMPLETE = "provenance_information_url_missing"

MAX_MANIFEST_BYTES_UNCOMPRESSED = 100_000
MAX_LAYER_BYTES_GZIP = 400_000
MAX_FEATURES_PER_LAYER = 1_000
MAX_POINTS_PER_SERIES = 120

#: Champs dont la seule présence trahirait une fuite de donnée tenant.
_TENANT_FIELDS = ("company_id", "tenant_id", "site_id", "organisation_id", "user_id")


class PublicSnapshotError(Exception):
    """Erreur d'assemblage — jamais un snapshot partiel silencieux."""


class TenantDataLeakError(PublicSnapshotError):
    """Une donnée tenant a atteint l'assembleur public. Arrêt immédiat."""


class SnapshotBudgetExceeded(PublicSnapshotError):
    """Un budget documenté est dépassé — refus explicite, jamais troncature."""


# ---------------------------------------------------------------------------
# Exclusions
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SourceExclusion:
    """Une source écartée du snapshot, avec son motif.

    Une exclusion est une **information publiable** : une source écartée sans
    mention donnerait une fausse impression d'exhaustivité (blueprint §7.5).
    """

    source_code: str
    reason: str
    detail: str

    def as_mapping(self) -> dict[str, str]:
        return {
            "source_code": self.source_code,
            "reason": self.reason,
            "detail": self.detail,
        }


# ---------------------------------------------------------------------------
# Snapshot
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class WaterPublicSnapshot:
    """Enveloppe publique immuable. Peut être vide, et rester valide."""

    schema_version: str
    generated_at: datetime
    manifest: WaterIntelligenceManifest | None
    included_source_codes: tuple[str, ...]
    exclusions: tuple[SourceExclusion, ...]
    decisions: tuple[Mapping[str, Any], ...]
    warnings: tuple[str, ...]
    budgets: Mapping[str, int]
    observation_count: int
    layer_count: int
    periods: tuple[tuple[str, str], ...]
    methods: tuple[tuple[str, str], ...]

    @property
    def is_empty(self) -> bool:
        """Un snapshot vide est un état valide, pas un échec."""
        return self.manifest is None

    def as_public_mapping(self) -> dict[str, Any]:
        """Forme canonique servie au front. Aucun champ tenant, par
        construction : rien de ce qui est écrit ici n'en contient."""
        return {
            "schema_version": self.schema_version,
            "generated_at": self.generated_at.isoformat(),
            "is_empty": self.is_empty,
            "manifest": self.manifest.model_dump(mode="json") if self.manifest else None,
            "included_source_codes": list(self.included_source_codes),
            "exclusions": [exclusion.as_mapping() for exclusion in self.exclusions],
            "decisions": [dict(decision) for decision in self.decisions],
            "warnings": list(self.warnings),
            "budgets": dict(self.budgets),
            "coverage": {
                "observation_count": self.observation_count,
                "layer_count": self.layer_count,
                "period_count": len(self.periods),
                "source_count": len(self.included_source_codes),
                "excluded_source_count": len(self.exclusions),
            },
            "periods": [list(period) for period in self.periods],
            "methods": [list(method) for method in self.methods],
        }

    def canonical_json(self) -> str:
        """JSON canonique — clés triées, séparateurs compacts. Deux assemblages
        équivalents produisent exactement les mêmes octets."""
        return json.dumps(
            self.as_public_mapping(), sort_keys=True, separators=(",", ":"), default=str
        )

    def etag(self) -> str:
        """ETag fondé sur le hash du snapshot lui-même.

        Conséquence voulue : le cache ne peut être invalidé que par un
        changement réel de contenu — donc par une publication autorisée, jamais
        par un simple réassemblage.
        """
        digest = hashlib.sha256(self.canonical_json().encode("utf-8")).hexdigest()
        return f'W/"wi-{digest[:32]}"'

    def payload_bytes(self) -> int:
        return len(self.canonical_json().encode("utf-8"))

    def payload_bytes_gzip(self) -> int:
        return len(gzip.compress(self.canonical_json().encode("utf-8"), mtime=0))


# ---------------------------------------------------------------------------
# Assemblage
# ---------------------------------------------------------------------------


@dataclass
class _Accumulator:
    observations: list[WaterMetricObservation] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    exclusions: list[SourceExclusion] = field(default_factory=list)


def assemble_public_snapshot(
    observations: Iterable[WaterMetricObservation],
    *,
    generated_at: datetime,
    registry: PublicationDecisionRegistry,
    manifest_version: str = "1.0.0",
    subject_type: str = "water_public_entity",
    geo_layers: Sequence[Any] = (),
    scenarios: Sequence[Any] = (),
    editorial_records: Sequence[Any] = (),
    enforce_budget: bool = True,
) -> WaterPublicSnapshot:
    """Assemble le snapshot public.

    `generated_at` est injecté : aucune horloge n'est lue ici. Les
    observations dont la source n'est pas explicitement autorisée sont
    écartées **avec un motif** ; celles dont la licence interdit l'affichage
    le sont aussi, même si leur source est autorisée.

    `enforce_budget=False` désactive la levée `SnapshotBudgetExceeded` en
    sortie — **jamais** utilisé pour publier ou pour mesurer un budget
    (`candidate_budget.measure()` garde `True` : c'est elle qui doit refuser).
    Réservé à un besoin orthogonal au budget : inspecter le contenu d'un
    snapshot reconstruit — gate licence, provenance, exclusions — sans que la
    taille de publication n'interrompe l'inspection. Le budget reste calculé
    et rapporté (`payload_bytes()`) ; seule la levée est tue.
    """
    accumulator = _Accumulator()
    ledger = WaterObservationLedger()
    seen_source_codes: set[str] = set()
    excluded_source_codes: dict[str, SourceExclusion] = {}

    for observation in sorted(
        observations, key=lambda o: (o.source.source_code, o.metric_code, o.period_start)
    ):
        _reject_tenant_data(observation)
        source_code = observation.source.source_code

        if not registry.allows(source_code):
            reason = registry.exclusion_reason(source_code) or EXCLUSION_NO_DECISION
            decision = registry.get(source_code)
            excluded_source_codes.setdefault(
                source_code,
                SourceExclusion(
                    source_code=source_code,
                    reason=reason,
                    detail=decision.reason if decision else
                    "Aucune décision humaine de publication n'existe pour cette source.",
                ),
            )
            continue

        # Troisième barrière : une source autorisée dont la provenance ne porte
        # pas d'URL officielle stable est écartée AVEC MOTIF, jamais publiée.
        # La Licence Ouverte 2.0 exige de mentionner la paternité — la source
        # et la date de dernière mise à jour de l'Information, ou à défaut
        # l'URL pointant vers elle. Sans URL ni date relevée, le libellé
        # d'attribution ne satisfait pas la condition, et publier quand même
        # ferait porter au lecteur une provenance que nous ne savons pas citer.
        if not (observation.source.source_information_url or "").strip():
            excluded_source_codes.setdefault(
                source_code,
                SourceExclusion(
                    source_code=source_code,
                    reason=EXCLUSION_PROVENANCE_INCOMPLETE,
                    detail=(
                        "La décision humaine autorise cette source, mais sa référence de "
                        "provenance ne porte aucune URL officielle stable "
                        "(`source_information_url`). La condition de paternité de la "
                        "Licence Ouverte 2.0 n'est donc pas satisfaite : la source est "
                        "écartée du snapshot public plutôt que publiée sans provenance "
                        "citable."
                    ),
                ),
            )
            continue

        # Double barrière : une source autorisée ne rend pas publiable une
        # observation dont la licence interdit l'affichage.
        if observation.value_withheld or not observation.source.license.allow_display:
            accumulator.warnings.append(
                f"{source_code}/{observation.metric_code} : valeur non publiable "
                "(licence — allow_display=false), observation écartée du snapshot public."
            )
            continue

        identity = build_water_observation_identity(
            observation,
            subject_type=subject_type,
            subject_key=observation.geography.code or observation.geography.scope,
        )
        ledger.add(identity, content_fingerprint=content_digest(observation))

        accumulator.observations.append(observation)
        seen_source_codes.add(source_code)

    # Sources connues du registre mais dont aucune observation n'est arrivée.
    for source_code in _registry_source_codes(registry):
        if source_code in seen_source_codes or source_code in excluded_source_codes:
            continue
        if registry.allows(source_code):
            continue
        decision = registry.get(source_code)
        excluded_source_codes[source_code] = SourceExclusion(
            source_code=source_code,
            reason=registry.exclusion_reason(source_code) or EXCLUSION_NO_DECISION,
            detail=decision.reason if decision else "Aucune décision humaine.",
        )

    exclusions = tuple(sorted(excluded_source_codes.values(), key=lambda e: e.source_code))
    included = tuple(sorted(seen_source_codes))

    warnings = list(accumulator.warnings)
    if not accumulator.observations:
        warnings.insert(
            0,
            "Aucune source n'est autorisée à la publication : le snapshot public est "
            "vide. Ce n'est pas une panne — c'est le résultat du gate licence, qui "
            "exige une décision humaine explicite et revue par source.",
        )

    manifest = _build_manifest(
        accumulator.observations,
        generated_at=generated_at,
        manifest_version=manifest_version,
        geo_layers=geo_layers,
        scenarios=scenarios,
        editorial_records=editorial_records,
        warnings=warnings,
    )

    snapshot = WaterPublicSnapshot(
        schema_version=SNAPSHOT_SCHEMA_VERSION,
        generated_at=generated_at,
        manifest=manifest,
        included_source_codes=included,
        exclusions=exclusions,
        decisions=registry.as_manifest_entries(),
        warnings=tuple(warnings),
        budgets={
            "max_manifest_bytes_uncompressed": MAX_MANIFEST_BYTES_UNCOMPRESSED,
            "max_layer_bytes_gzip": MAX_LAYER_BYTES_GZIP,
            "max_features_per_layer": MAX_FEATURES_PER_LAYER,
            "max_points_per_series": MAX_POINTS_PER_SERIES,
        },
        observation_count=len(accumulator.observations),
        layer_count=len(geo_layers),
        periods=_distinct_periods(accumulator.observations),
        methods=_distinct_methods(accumulator.observations),
    )

    if enforce_budget:
        _enforce_budgets(snapshot)
    return snapshot


def _build_manifest(
    observations: list[WaterMetricObservation],
    *,
    generated_at: datetime,
    manifest_version: str,
    geo_layers: Sequence[Any],
    scenarios: Sequence[Any],
    editorial_records: Sequence[Any],
    warnings: list[str],
) -> WaterIntelligenceManifest | None:
    """Construit le manifest P02, ou `None` s'il n'y a rien à décrire.

    P02 impose au moins une source : un manifest vide serait un manifest qui
    ne décrit rien. On ne relâche donc pas la contrainte — on renvoie `None`,
    et l'enveloppe porte l'information à sa place.
    """
    if not observations and not editorial_records:
        return None

    sources = _distinct_sources(observations)
    if not sources:
        return None

    return WaterIntelligenceManifest(
        manifest_version=manifest_version,
        generated_at=generated_at,
        fixture_label=None,
        sources=sources,
        observations=list(observations),
        geo_layers=list(geo_layers),
        scenarios=list(scenarios),
        editorial_records=list(editorial_records),
        legal_records=[],
        warnings=list(warnings),
    )


def _registry_source_codes(registry: PublicationDecisionRegistry) -> tuple[str, ...]:
    return tuple(entry["source_code"] for entry in registry.as_manifest_entries())  # type: ignore[index]


def _distinct_sources(observations: Iterable[WaterMetricObservation]):
    seen: dict[tuple[str, str], Any] = {}
    for observation in observations:
        key = (observation.source.source_code, observation.source.release_key)
        seen.setdefault(key, observation.source)
    return [seen[key] for key in sorted(seen)]


def _distinct_periods(
    observations: Iterable[WaterMetricObservation],
) -> tuple[tuple[str, str], ...]:
    return tuple(
        sorted(
            {(o.period_start.isoformat(), o.period_end.isoformat()) for o in observations}
        )
    )


def _distinct_methods(
    observations: Iterable[WaterMetricObservation],
) -> tuple[tuple[str, str], ...]:
    return tuple(sorted({(o.method.code, o.method.version) for o in observations}))


def _reject_tenant_data(observation: WaterMetricObservation) -> None:
    """Garde-fou : aucune donnée tenant ne doit atteindre la surface publique.

    Le contrat P02 n'a aucun champ d'entreprise. Ce contrôle protège contre
    trois contournements possibles :

    1. un champ tenant AJOUTÉ au contrat plus tard (vu par `model_dump`) ;
    2. un attribut posé hors schéma, par `object.__setattr__` ou
       `model_construct` (invisible de `model_dump` — d'où l'inspection de
       `__dict__`) ;
    3. un extra pydantic (`model_extra`).

    Le point 2 est le plus sournois : il ne déclenche aucune validation et ne
    se voit dans aucune sérialisation normale.
    """
    surfaces: list[str] = list(observation.model_dump(mode="json").keys())
    surfaces.extend(getattr(observation, "__dict__", {}).keys())
    extra = getattr(observation, "model_extra", None)
    if extra:
        surfaces.extend(extra.keys())

    leaked = sorted({name for name in surfaces if name in _TENANT_FIELDS})
    if leaked:
        raise TenantDataLeakError(
            f"champ tenant {leaked} présent dans une observation destinée au "
            "snapshot public — assemblage interrompu."
        )


def _enforce_budgets(snapshot: WaterPublicSnapshot) -> None:
    size = snapshot.payload_bytes()
    if size > MAX_MANIFEST_BYTES_UNCOMPRESSED:
        raise SnapshotBudgetExceeded(
            f"snapshot public de {size} octets > budget "
            f"{MAX_MANIFEST_BYTES_UNCOMPRESSED} (P02 §7) — à restreindre, jamais tronquer."
        )


# ---------------------------------------------------------------------------
# Loader public — borné et en LECTURE SEULE
# ---------------------------------------------------------------------------


class PublicSnapshotLoader:
    """Chargeur borné, en lecture seule, sans réseau ni base.

    Aucune méthode d'écriture n'existe : la surface publique consomme un
    snapshot, elle n'en produit jamais et n'en modifie aucun.
    """

    def __init__(self, *, max_bytes: int = MAX_MANIFEST_BYTES_UNCOMPRESSED) -> None:
        if max_bytes < 1:
            raise PublicSnapshotError("max_bytes doit être strictement positif.")
        self._max_bytes = max_bytes

    def load_mapping(self, raw: bytes) -> dict[str, Any]:
        """Charge un snapshot depuis des octets déjà obtenus par l'appelant.

        Ne va chercher aucun fichier et n'ouvre aucune connexion : c'est
        l'appelant qui fournit les octets, exactement comme les connecteurs
        opérateur des Waves A et B.
        """
        if len(raw) > self._max_bytes:
            raise SnapshotBudgetExceeded(
                f"snapshot de {len(raw)} octets > budget de lecture {self._max_bytes}."
            )
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise PublicSnapshotError(f"snapshot illisible : {exc}") from exc
        if not isinstance(payload, dict):
            raise PublicSnapshotError("snapshot inattendu : objet JSON attendu.")
        if payload.get("schema_version") != SNAPSHOT_SCHEMA_VERSION:
            raise PublicSnapshotError(
                f"version de schéma inattendue : {payload.get('schema_version')!r} "
                f"(attendu {SNAPSHOT_SCHEMA_VERSION!r})."
            )
        for tenant_field in _TENANT_FIELDS:
            if tenant_field in json.dumps(payload):
                raise TenantDataLeakError(
                    f"champ tenant {tenant_field!r} détecté dans un snapshot public."
                )
        return payload


# ---------------------------------------------------------------------------
# Document canonique du snapshot vide (P16, Wave E)
# ---------------------------------------------------------------------------

#: Horodatage sentinelle du document canonique.
#:
#: `assemble_public_snapshot` exige `generated_at` en entrée — jamais
#: `datetime.now()` — précisément pour rester déterministe. Mais un document
#: canonique versionné dans le dépôt ne peut porter aucune date réelle : elle
#: serait fausse dès le lendemain, et une date plausible se lit comme une date
#: d'assemblage effective. Le document exporte donc une chaîne VIDE, que la
#: surface rend « n.c. » — même discipline que les valeurs de fixture retirées
#: en P04B.
_CANONICAL_GENERATED_AT = datetime(1970, 1, 1, tzinfo=timezone.utc)


def canonical_empty_document(
    *, registry: PublicationDecisionRegistry | None = None
) -> dict[str, Any]:
    """Snapshot public canonique, assemblé depuis le registre de décisions.

    C'est un snapshot **réel**, pas une constante écrite à la main : il est
    produit par le même assembleur que la production, avec zéro observation,
    et porte donc les vraies exclusions, les vraies décisions, les vrais
    avertissements et une couverture à zéro.

    Sert de source unique au miroir TypeScript de la page publique, qui
    n'affiche ainsi plus aucune fixture.
    """
    from services.water_intelligence.publication_decisions import (
        current_registry as _current_registry,
    )

    snapshot = assemble_public_snapshot(
        observations=(),
        generated_at=_CANONICAL_GENERATED_AT,
        registry=registry or _current_registry(),
    )
    payload = dict(snapshot.as_public_mapping())
    # Aucune date d'assemblage : voir `_CANONICAL_GENERATED_AT`.
    payload["generated_at"] = ""
    return payload
