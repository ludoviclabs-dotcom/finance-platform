"""
services/water_intelligence/observation_identity.py — identité temporelle sûre
d'une observation Water Intelligence (P10, Wave C).

## Pourquoi ce module existe

`ObservationDraft.dedup_key()` (`services/intelligence/adapters/base.py`,
contrat PR-04) retourne `(subject_type, subject_key, metric_code)` — **sans
période**. Cette hypothèse est vraie pour l'import `/materials` (un point de
prix courant par matière) et fausse pour toute chronique.

Depuis la Wave B, le chantier produit de vraies séries temporelles :
trimestres EEA, mesures hydrométriques journalières, volumes annuels BNPE,
analyses de qualité datées. Un graveur qui réutiliserait `dedup_key()` telle
quelle **écraserait silencieusement toutes les périodes sauf la première**.

Ce module fournit donc une identité PROPRE à Water Intelligence. Il ne
modifie PAS `dedup_key()` : ce contrat est partagé avec `/materials`
(`snapshot_migration.py`, ses deux seuls points d'appel) et le toucher sans
démonstration de non-régression engagerait un système hors périmètre. Les
deux identités coexistent, chacune dans son domaine.

## Ce qui compose l'identité, et pourquoi

| Champ | Raison |
|---|---|
| `schema_version` | Une évolution de la règle d'identité doit être visible, jamais silencieuse |
| `source_code` | Deux sources peuvent décrire la même géographie et la même période |
| `release_key` | Une release est immuable ; deux releases sont deux faits distincts |
| `subject_type`, `subject_key` | Sujet observé |
| `metric_code` | Métrique — stable et sans date depuis la Wave A |
| `geography_scope`, `geography_code` | Même métrique, même période, deux territoires = deux faits |
| `period_start`, `period_end` | **Le manque de PR-04.** Deux périodes = deux identités |
| `scenario_code`, `horizon_year` | Une projection n'est pas une observation, et deux horizons sont deux projections |

## Ce qui N'EN FAIT PAS partie : méthode et version

Décision explicite, demandée par le prompt Wave C.

`method.code`/`method.version` sont **exclus** de l'identité. Raisonnement :

- une release est immuable (`source_releases`, migration 028) ; à l'intérieur
  d'une même `release_key`, le même fait recalculé avec une méthode
  différente n'est pas un fait nouveau, c'est une **incohérence** ;
- les inclure ferait taire cette incohérence : deux identités différentes
  cohabiteraient sans que rien ne le signale ;
- les exclure la fait au contraire remonter comme une collision explicite
  (§ ledger ci-dessous), ce qui est exactement l'invariant « aucune collision
  silencieuse » ;
- entre releases, `release_key` diffère déjà : une montée de méthode
  accompagnée d'une nouvelle release produit naturellement une identité
  distincte, sans avoir besoin de la méthode dans la clé.

La méthode reste bien sûr portée par l'observation et par le digest de
contenu — elle est simplement *vérifiée*, pas *identifiante*.

## Invariants

- deux périodes différentes ⇒ deux identités différentes ;
- le même enregistrement rejoué ⇒ la même empreinte (déterminisme total) ;
- l'ordre des champs n'influence pas l'empreinte (JSON canonique trié) ;
- aucune date implicite : aucune horloge n'est lue ici ;
- aucune valeur absente remplacée : `None` reste `None` et se distingue de `0` ;
- aucune collision silencieuse : même identité + contenu différent ⇒ erreur.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import date
from typing import Any, Iterable, Mapping

from models.water_intelligence import WaterMetricObservation

#: Version de la RÈGLE d'identité. Toute modification de la composition de
#: l'identité doit l'incrémenter : une empreinte n'est comparable qu'à une
#: empreinte de même version.
IDENTITY_SCHEMA_VERSION = "1.0.0"


class WaterIdentityError(Exception):
    """Base des erreurs d'identité — jamais un échec silencieux."""


class WaterIdentityIncompleteError(WaterIdentityError):
    """Un composant obligatoire de l'identité manque. Refus explicite plutôt
    qu'une identité partielle qui collisionnerait avec d'autres."""


class WaterIdentityCollisionError(WaterIdentityError):
    """Même identité, contenu différent.

    C'est le cas que tout ce module existe pour rendre bruyant : sans lui, la
    première valeur écrite gagnerait en silence et les suivantes
    disparaîtraient. Ne JAMAIS le rattraper pour continuer — il signale soit
    une identité sous-spécifiée, soit une donnée réellement contradictoire.
    """


# ---------------------------------------------------------------------------
# Identité
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class WaterObservationIdentity:
    """Identité d'une observation publiable. Immuable et hachable."""

    schema_version: str
    source_code: str
    release_key: str
    subject_type: str
    subject_key: str
    metric_code: str
    geography_scope: str
    geography_code: str | None
    period_start: date
    period_end: date
    scenario_code: str | None
    horizon_year: int | None

    def as_canonical_mapping(self) -> dict[str, Any]:
        """Forme canonique sérialisable. Les clés sont triées à l'écriture du
        JSON, donc l'ordre de déclaration n'a aucun effet sur l'empreinte."""
        return {
            "schema_version": self.schema_version,
            "source_code": self.source_code,
            "release_key": self.release_key,
            "subject_type": self.subject_type,
            "subject_key": self.subject_key,
            "metric_code": self.metric_code,
            "geography_scope": self.geography_scope,
            "geography_code": self.geography_code,
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "scenario_code": self.scenario_code,
            "horizon_year": self.horizon_year,
        }

    def fingerprint(self) -> str:
        """Empreinte SHA-256 déterministe de l'identité."""
        return _sha256_of(self.as_canonical_mapping())


def build_water_observation_identity(
    observation: WaterMetricObservation,
    *,
    subject_type: str,
    subject_key: str,
) -> WaterObservationIdentity:
    """Construit l'identité d'une observation P02.

    `subject_type`/`subject_key` ne figurent pas dans `WaterMetricObservation`
    (le read model public est indexé par géographie, pas par sujet interne) :
    ils sont donc fournis par l'appelant, qui les tient du connecteur. Un
    composant vide est refusé plutôt que remplacé par une valeur par défaut,
    qui ferait collisionner des faits distincts.
    """
    source = observation.source
    geography = observation.geography

    _require(subject_type, "subject_type")
    _require(subject_key, "subject_key")
    _require(source.source_code, "source.source_code")
    _require(source.release_key, "source.release_key")
    _require(observation.metric_code, "metric_code")

    if geography.scope != "world" and not geography.code:
        raise WaterIdentityIncompleteError(
            f"geography.code obligatoire pour scope={geography.scope!r} — "
            "sans code, deux territoires distincts partageraient une identité."
        )
    if observation.period_start > observation.period_end:
        raise WaterIdentityIncompleteError(
            f"période invalide : {observation.period_start} > {observation.period_end}."
        )

    scenario = observation.scenario
    return WaterObservationIdentity(
        schema_version=IDENTITY_SCHEMA_VERSION,
        source_code=source.source_code,
        release_key=source.release_key,
        subject_type=subject_type,
        subject_key=subject_key,
        metric_code=observation.metric_code,
        geography_scope=geography.scope,
        geography_code=geography.code,
        period_start=observation.period_start,
        period_end=observation.period_end,
        scenario_code=scenario.scenario_code if scenario is not None else None,
        horizon_year=scenario.horizon_year if scenario is not None else None,
    )


# ---------------------------------------------------------------------------
# Digest de contenu — ce qui doit rester identique à identité constante
# ---------------------------------------------------------------------------


def content_digest(observation: WaterMetricObservation) -> str:
    """Empreinte du CONTENU d'une observation, hors identité.

    `None` et `0` produisent des empreintes différentes : l'absence n'est
    jamais confondue avec une valeur nulle. La méthode y figure — elle est
    vérifiée à identité constante, sans être identifiante (cf. docstring).
    """
    quality = observation.quality
    payload = {
        "value": _canonical_value(observation.value),
        "unit": observation.unit,
        "value_withheld": observation.value_withheld,
        "method_code": observation.method.code,
        "method_version": observation.method.version,
        "data_status": quality.data_status,
        "confidence": quality.confidence,
        "coverage_pct": quality.coverage_pct,
        "quality_warnings": list(quality.warnings),
        "checksum_sha256": observation.source.checksum_sha256,
    }
    return _sha256_of(payload)


def _canonical_value(value: Any) -> dict[str, Any]:
    """Encode la valeur AVEC son type, pour que `None`, `0`, `"0"` et `False`
    ne puissent jamais produire la même empreinte."""
    if value is None:
        return {"kind": "absent"}
    if isinstance(value, bool):
        return {"kind": "boolean", "value": value}
    if isinstance(value, (int, float)):
        return {"kind": "numeric", "value": repr(float(value))}
    return {"kind": "text", "value": str(value)}


# ---------------------------------------------------------------------------
# Ledger — idempotence et détection de collision
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class LedgerEntry:
    identity: WaterObservationIdentity
    identity_fingerprint: str
    content_fingerprint: str


class WaterObservationLedger:
    """Registre en mémoire d'identités observées, avec détection de collision.

    Comportement, volontairement sans « première valeur gagnante » :

    - identité inconnue → enregistrée, `add()` renvoie `True` ;
    - identité connue **et contenu identique** → rejeu idempotent, `add()`
      renvoie `False` et rien n'est modifié ;
    - identité connue **et contenu différent** → `WaterIdentityCollisionError`.

    Pur : aucune base, aucune horloge, aucun réseau. Un graveur réel (hors
    Wave C) réutilisera cette logique en la branchant sur sa persistance.
    """

    def __init__(self) -> None:
        self._entries: dict[str, LedgerEntry] = {}

    def __len__(self) -> int:
        return len(self._entries)

    @property
    def entries(self) -> tuple[LedgerEntry, ...]:
        """Entrées dans un ordre déterministe (empreinte croissante)."""
        return tuple(self._entries[k] for k in sorted(self._entries))

    def add(
        self, identity: WaterObservationIdentity, *, content_fingerprint: str
    ) -> bool:
        fingerprint = identity.fingerprint()
        existing = self._entries.get(fingerprint)

        if existing is None:
            self._entries[fingerprint] = LedgerEntry(
                identity=identity,
                identity_fingerprint=fingerprint,
                content_fingerprint=content_fingerprint,
            )
            return True

        if existing.content_fingerprint == content_fingerprint:
            return False

        raise WaterIdentityCollisionError(
            "collision d'identité : deux contenus différents partagent la même "
            f"identité {fingerprint[:12]}… "
            f"({identity.source_code}/{identity.release_key}/{identity.metric_code} "
            f"@ {identity.geography_code or identity.geography_scope} "
            f"[{identity.period_start} → {identity.period_end}]). "
            "Aucune valeur n'est retenue par défaut : soit l'identité est "
            "sous-spécifiée, soit les données sont contradictoires."
        )

    def add_observation(
        self,
        observation: WaterMetricObservation,
        *,
        subject_type: str,
        subject_key: str,
    ) -> bool:
        identity = build_water_observation_identity(
            observation, subject_type=subject_type, subject_key=subject_key
        )
        return self.add(identity, content_fingerprint=content_digest(observation))

    def extend(
        self,
        observations: Iterable[WaterMetricObservation],
        *,
        subject_type: str,
        subject_key_of,
    ) -> int:
        """Ajoute un lot. Retourne le nombre d'entrées RÉELLEMENT nouvelles.

        Une collision interrompt le lot par une exception : poursuivre
        reviendrait à choisir silencieusement un gagnant.
        """
        added = 0
        for observation in observations:
            if self.add_observation(
                observation,
                subject_type=subject_type,
                subject_key=subject_key_of(observation),
            ):
                added += 1
        return added


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _require(value: str | None, field_name: str) -> None:
    if not value or not str(value).strip():
        raise WaterIdentityIncompleteError(
            f"{field_name} obligatoire dans l'identité — aucune valeur par défaut "
            "n'est substituée, elle ferait collisionner des faits distincts."
        )


def _sha256_of(payload: Mapping[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
