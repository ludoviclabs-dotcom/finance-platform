"""
services/water_intelligence/release_parity.py — contrôles de parité entre les
trois représentations d'une même release (X4B-RECONSTRUCT §5).

## Les trois représentations, et leur RÉSOLUTION respective

| Représentation | Origine | Ce qu'elle distingue |
|---|---|---|
| **préparée** | `staging_writer.prepare_release()` | tout : `WaterObservationIdentity` complète |
| **persistée** | table `observations` (migration 028) | la clé de projection, rien de plus |
| **candidate** | `manifest.observations` du snapshot reconstruit | tout sauf le sujet |

Ces trois espaces n'ont **pas** la même résolution, et c'est le fait central de
ce module. Comparer trois ensembles comme s'ils étaient de même nature
supposerait que la projection SQL conserve ce qu'elle ne conserve pas : ni
`geography_scope`, ni `scenario_code`, ni `horizon_year`, ni `schema_version`,
ni le libellé géographique, ni la couverture.

La parité se vérifie donc **à la résolution de chaque côté** : l'ensemble
préparé — seul autoritatif — est projeté vers l'espace de l'autre côté avant
comparaison. Jamais l'inverse : gonfler l'ensemble persisté pour le rendre
comparable reviendrait à reconstruire depuis SQL les champs qu'il ne porte
pas, c'est-à-dire exactement ce que cette phase interdit.

## Vérifier n'est pas reconstruire

Lire la table `observations` pour **confronter** une projection à ce qui a été
préparé n'est pas en **reconstruire** un snapshot. La première opération
détecte une perte ; la seconde la rendrait invisible en la comblant par une
supposition. Le snapshot candidat ne vient jamais d'ici.

## Ce que la parité ne peut PAS prouver

`geography.label`, `quality.coverage_pct`, `quality.confidence`,
`source_information_url` et la cadence n'existent nulle part dans la
projection. Aucun contrôle ne peut donc établir qu'ils ont survécu à
l'écriture — ils n'y survivent pas. Ce module le **nomme** au lieu de le
contourner : c'est la démonstration, exécutable, que le snapshot public ne
peut pas naître de PostgreSQL.

## Ensembles, jamais compte

Toutes les comparaisons portent sur des ENSEMBLES. Deux cardinaux égaux
laisseraient passer une substitution : autant d'observations, mais pas les
mêmes. `WaterObservationIdentity` est `frozen=True`, donc hachable ; les clés
définies ici le sont aussi.

Toute divergence LÈVE `ParityViolation`. Aucune n'est un avertissement : une
release est immuable, et un écart toléré au moment de la mesure resterait
gravé.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Iterable, Mapping, Sequence

from models.water_intelligence import WaterMetricObservation
from services.water_intelligence.observation_identity import (
    WaterObservationIdentity,
)


class ParityViolation(Exception):
    """Les représentations divergent. Arrêt — jamais un avertissement."""


# ---------------------------------------------------------------------------
# Les deux espaces de comparaison réduits
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ProjectionKey:
    """Ce que la table `observations` sait distinguer, et rien de plus.

    Exactement la clé qu'utilise `staging_writer._existing_projections()` pour
    détecter une collision — reprise ici volontairement à l'identique : une
    parité qui se comparerait sur une autre clé que celle du graveur
    vérifierait un invariant que le graveur n'applique pas.

    Absents, faute de colonne : `geography_scope`, `scenario_code`,
    `horizon_year`, `schema_version`, `release_key` (porté par la jointure).
    """

    subject_type: str
    subject_key: str
    metric_code: str
    geography_code: str | None
    period_start: date | None
    period_end: date | None


@dataclass(frozen=True)
class ObservationKey:
    """Ce qu'une `WaterMetricObservation` porte seule.

    C'est l'identité complète MOINS le sujet (`subject_type`/`subject_key`) et
    `schema_version` : le sujet vient du draft d'acquisition, pas de
    l'observation, et le manifest ne le transporte pas. Cette clé est donc la
    plus fine que le snapshot candidat permette de former sans rien supposer.
    """

    source_code: str
    release_key: str
    metric_code: str
    geography_scope: str
    geography_code: str | None
    period_start: date
    period_end: date
    scenario_code: str | None
    horizon_year: int | None


def projection_key_of_identity(identity: WaterObservationIdentity) -> ProjectionKey:
    return ProjectionKey(
        subject_type=identity.subject_type,
        subject_key=identity.subject_key,
        metric_code=identity.metric_code,
        geography_code=identity.geography_code,
        period_start=identity.period_start,
        period_end=identity.period_end,
    )


def projection_key_of_row(row: Mapping[str, Any]) -> ProjectionKey:
    """Clé de projection d'une ligne `observations` relue.

    `valid_from`/`valid_to` sont des `timestamptz` que le graveur pose à
    minuit UTC depuis une `date` (`_as_utc`). On revient à la date — ce n'est
    pas une reconstruction : c'est l'inverse exact d'une conversion sans perte
    déjà appliquée dans le même dépôt.
    """
    return ProjectionKey(
        subject_type=row["subject_type"],
        subject_key=row["subject_key"],
        metric_code=row["metric_code"],
        geography_code=row["geography_code"],
        period_start=_as_date(row.get("valid_from")),
        period_end=_as_date(row.get("valid_to")),
    )


def observation_key(observation: WaterMetricObservation) -> ObservationKey:
    scenario = observation.scenario
    return ObservationKey(
        source_code=observation.source.source_code,
        release_key=observation.source.release_key,
        metric_code=observation.metric_code,
        geography_scope=observation.geography.scope,
        geography_code=observation.geography.code,
        period_start=observation.period_start,
        period_end=observation.period_end,
        scenario_code=scenario.scenario_code if scenario else None,
        horizon_year=scenario.horizon_year if scenario else None,
    )


def _as_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


# ---------------------------------------------------------------------------
# Champs comparés entre observation préparée et observation candidate
# ---------------------------------------------------------------------------


def _comparable_fields(observation: WaterMetricObservation) -> dict[str, Any]:
    """Tout ce qu'une observation publiable porte, à plat.

    Inclut délibérément ce que la projection SQL perd — libellé géographique,
    couverture, confiance, provenance citable : c'est précisément entre le
    préparé et le candidat que ces champs DOIVENT être identiques, puisque
    aucun des deux ne transite par PostgreSQL.
    """
    source = observation.source
    scenario = observation.scenario
    return {
        "value": observation.value,
        "value_withheld": observation.value_withheld,
        "unit": observation.unit,
        "period_start": observation.period_start,
        "period_end": observation.period_end,
        "geography_scope": observation.geography.scope,
        "geography_code": observation.geography.code,
        "geography_label": observation.geography.label,
        "scenario_code": scenario.scenario_code if scenario else None,
        "horizon_year": scenario.horizon_year if scenario else None,
        "data_status": observation.quality.data_status,
        "coverage_pct": observation.quality.coverage_pct,
        "confidence": observation.quality.confidence,
        "method_code": observation.method.code,
        "method_version": observation.method.version,
        "attribution": source.attribution,
        "source_information_url": source.source_information_url,
        "source_refresh_cadence": source.source_refresh_cadence,
        "source_last_updated_on": source.source_last_updated_on,
        "checksum_sha256": source.checksum_sha256,
        "allow_display": source.license.allow_display,
    }


#: Ce que la projection SQL conserve d'une valeur, et que la parité persistée
#: peut donc confronter. Le reste n'y est pas — cf. le docstring du module.
def _persisted_value_facts(observation: WaterMetricObservation) -> dict[str, Any]:
    return {
        "unit": observation.unit,
        "methodology_version": observation.method.version,
    }


def _row_value_facts(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "unit": row.get("unit"),
        "methodology_version": row.get("methodology_version"),
    }


# ---------------------------------------------------------------------------
# Rapport
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ParityReport:
    """Preuve exécutable qu'une reconstruction est fidèle.

    Ne contient AUCUNE valeur mesurée brute : des codes, des cardinaux et des
    clés. Un rapport de parité est un artefact de run, publié comme tel.
    """

    source_code: str
    release_key: str
    prepared_count: int
    persisted_count: int
    candidate_count: int
    prepared_identity_count: int
    checked_persisted: bool
    #: Champs qu'aucun contrôle ne peut vérifier côté persisté, faute de
    #: colonne. Énumérés pour être lus, pas pour être ignorés.
    unverifiable_after_projection: tuple[str, ...]

    def as_mapping(self) -> dict[str, Any]:
        return {
            "source_code": self.source_code,
            "release_key": self.release_key,
            "prepared_count": self.prepared_count,
            "persisted_count": self.persisted_count,
            "candidate_count": self.candidate_count,
            "prepared_identity_count": self.prepared_identity_count,
            "checked_persisted": self.checked_persisted,
            "unverifiable_after_projection": list(self.unverifiable_after_projection),
        }


#: Champs présents dans une release préparée et ABSENTS de la projection SQL.
#: Cette liste n'est pas décorative : elle est le motif pour lequel le snapshot
#: public ne se reconstruit jamais depuis PostgreSQL.
UNVERIFIABLE_AFTER_PROJECTION: tuple[str, ...] = (
    "geography.scope",
    "geography.label",
    "quality.coverage_pct",
    "quality.confidence",
    "source.attribution",
    "source.source_information_url",
    "source.source_refresh_cadence",
    "source.source_last_updated_on",
    "source.observed_period_start",
    "source.observed_period_end",
    "scenario.scenario_code",
    "scenario.horizon_year",
)


def _describe(sample: Iterable[Any], limit: int = 5) -> str:
    items = sorted(str(item) for item in sample)
    head = items[:limit]
    suffix = f" … (+{len(items) - limit})" if len(items) > limit else ""
    return ", ".join(head) + suffix


# ---------------------------------------------------------------------------
# Contrôles
# ---------------------------------------------------------------------------


def assert_projection_can_distinguish(prepared) -> None:
    """Deux identités distinctes ne doivent PAS s'écraser dans la projection.

    Cas réel : deux observations de même code géographique mais de portées
    différentes (`departement` et `commune`), ou de scénarios différents. La
    table `observations` ne porte ni `geography_scope` ni `scenario_code` :
    elles y deviendraient la même ligne, et le graveur les traiterait comme
    une « réutilisation » — une perte silencieuse, jamais signalée.

    Vérifié AVANT toute écriture, parce qu'après il serait trop tard : rien ne
    peut être défait sur `observations`.
    """
    seen: dict[ProjectionKey, WaterObservationIdentity] = {}
    for identity in prepared.identities:
        key = projection_key_of_identity(identity)
        previous = seen.get(key)
        if previous is not None and previous != identity:
            raise ParityViolation(
                f"{prepared.source_code} : deux identités DISTINCTES se réduisent "
                "à la même clé de projection — la table `observations` ne pourrait "
                "pas les distinguer, et le graveur retiendrait la première en "
                "silence.\n"
                f"  clé de projection : {key}\n"
                f"  identité A        : {previous.fingerprint()}\n"
                f"  identité B        : {identity.fingerprint()}\n"
                "Refusé : l'identité est sous-spécifiée pour cette portée "
                "d'acquisition. Restreindre la portée du candidat plutôt "
                "qu'accepter la collision."
            )
        seen[key] = identity


def assert_persisted_parity(prepared, rows: Sequence[Mapping[str, Any]]) -> None:
    """`prepared` et les lignes relues portent les MÊMES clés de projection.

    Comparaison d'ensembles, dans les deux sens : une ligne persistée absente
    du préparé est aussi grave qu'une observation préparée jamais écrite.
    """
    expected = {projection_key_of_identity(i) for i in prepared.identities}
    actual = {projection_key_of_row(row) for row in rows}

    missing = expected - actual
    extra = actual - expected
    if missing or extra:
        raise ParityViolation(
            f"{prepared.source_code} : divergence entre les observations préparées "
            "et celles relues dans l'Evidence Kernel.\n"
            f"  préparées non écrites ({len(missing)}) : {_describe(missing)}\n"
            f"  écrites non préparées ({len(extra)})  : {_describe(extra)}\n"
            "Comparaison faite sur des ENSEMBLES : deux cardinaux égaux "
            "laisseraient passer une substitution."
        )

    by_key = {
        projection_key_of_identity(item.identity): item.observation
        for item in prepared.prepared
    }
    for row in rows:
        key = projection_key_of_row(row)
        observation = by_key[key]
        expected_facts = _persisted_value_facts(observation)
        actual_facts = _row_value_facts(row)
        if expected_facts != actual_facts:
            raise ParityViolation(
                f"{prepared.source_code} : une observation persistée porte des "
                f"faits différents de sa forme préparée.\n"
                f"  clé       : {key}\n"
                f"  préparée  : {expected_facts}\n"
                f"  persistée : {actual_facts}"
            )


def assert_candidate_parity(
    prepared, observations: Sequence[WaterMetricObservation]
) -> None:
    """Le snapshot candidat porte EXACTEMENT les observations préparées.

    Comparé à pleine résolution — le candidat n'a jamais transité par SQL,
    donc rien n'y est perdu et rien n'y est excusable. Y compris le libellé
    géographique, la couverture et la provenance citable, que la projection ne
    conserve pas.
    """
    prepared_by_key: dict[ObservationKey, WaterMetricObservation] = {}
    for observation in prepared.observations:
        key = observation_key(observation)
        if key in prepared_by_key:
            raise ParityViolation(
                f"{prepared.source_code} : deux observations préparées partagent "
                f"la même clé d'observation {key}. La parité candidate serait "
                "ambiguë — refusé plutôt qu'arbitré."
            )
        prepared_by_key[key] = observation

    candidate_by_key: dict[ObservationKey, WaterMetricObservation] = {}
    for observation in observations:
        if observation.source.source_code != prepared.source_code:
            continue
        candidate_by_key[observation_key(observation)] = observation

    missing = set(prepared_by_key) - set(candidate_by_key)
    extra = set(candidate_by_key) - set(prepared_by_key)
    if missing or extra:
        raise ParityViolation(
            f"{prepared.source_code} : le snapshot candidat ne porte pas les "
            "observations préparées.\n"
            f"  préparées absentes du candidat ({len(missing)}) : {_describe(missing)}\n"
            f"  présentes sans préparation ({len(extra)})       : {_describe(extra)}"
        )

    for key, expected in prepared_by_key.items():
        actual = candidate_by_key[key]
        expected_fields = _comparable_fields(expected)
        actual_fields = _comparable_fields(actual)
        if expected_fields != actual_fields:
            diverging = {
                name: (expected_fields[name], actual_fields[name])
                for name in expected_fields
                if expected_fields[name] != actual_fields[name]
            }
            raise ParityViolation(
                f"{prepared.source_code} : une observation candidate diverge de sa "
                f"forme préparée.\n"
                f"  clé       : {key}\n"
                f"  divergences (préparé → candidat) : {diverging}"
            )


def check_release_parity(
    prepared,
    *,
    candidate_observations: Sequence[WaterMetricObservation],
    persisted_rows: Sequence[Mapping[str, Any]] | None = None,
) -> ParityReport:
    """Contrôle complet d'une release. Lève à la première divergence.

    `persisted_rows=None` signifie « aucune écriture n'a eu lieu » (mesure
    éphémère, `--dry-run`) — l'absence est REPORTÉE dans `checked_persisted`,
    jamais confondue avec un contrôle réussi.
    """
    if prepared.provenance is None:
        raise ParityViolation(
            f"{prepared.source_code or '<sans code>'} : release préparée sans "
            "provenance. Aucune parité ne se vérifie sur une release dont la "
            "provenance n'a pas été résolue."
        )

    assert_projection_can_distinguish(prepared)
    if persisted_rows is not None:
        assert_persisted_parity(prepared, persisted_rows)
    assert_candidate_parity(prepared, candidate_observations)

    return ParityReport(
        source_code=prepared.source_code,
        release_key=prepared.release_key,
        prepared_count=len(prepared.observations),
        persisted_count=len(persisted_rows) if persisted_rows is not None else 0,
        candidate_count=sum(
            1
            for o in candidate_observations
            if o.source.source_code == prepared.source_code
        ),
        prepared_identity_count=len(prepared.identities),
        checked_persisted=persisted_rows is not None,
        unverifiable_after_projection=UNVERIFIABLE_AFTER_PROJECTION,
    )
