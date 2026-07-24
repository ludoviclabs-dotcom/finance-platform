"""
models/water_intelligence.py — contrats du read model PUBLIC Water Intelligence (P02).

Ce module ne définit AUCUNE table et n'écrit rien en base : c'est la forme
que devra prendre le futur snapshot public (P10), figée avant tout connecteur
réel (P05+) pour que chaque connecteur produise directement des instances
valides plutôt que d'inventer sa propre forme. Aucune donnée réelle n'est
introduite ici — seuls des types et une fixture explicitement étiquetée
`fixture` (voir `docs/carbonco/water-intelligence/contracts/FIXTURE_MANIFEST.json`).

Réutilise le noyau existant plutôt que de le dupliquer :
- `MethodRef` (`models.analytics`) pour la méthode/version — même forme que
  Wave 2, pas un second "code+version" réinventé ici.
- `LicenseDecision` (`models.intelligence`) réexporté sous `WaterLicenseDecision` —
  même décision de licence déterministe que `license_policy.evaluate()`, pas
  un second calcul de droits.

`WaterDataStatus` est une vocabulaire DISTINCT de `models.intelligence.DataStatus`
(`verified/estimated/manual/inferred`, le statut d'INGESTION d'une observation
du noyau) : le prompt maître P02 impose explicitement
`observed/modelled/estimated/manual/fixture` pour le read model PUBLIC — une
mesure directe (Hub'Eau) n'est pas de même nature qu'une projection de
scénario (Aqueduct 2030), distinction que le noyau ne fait pas. Les deux
vocabulaires ne sont jamais mélangés ; une conversion entre les deux, si
nécessaire, sera un choix explicite d'un futur connecteur (P05+), pas une
équivalence implicite ici.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import (
    BaseModel,
    Field,
    StrictBool,
    StrictFloat,
    StrictStr,
    model_validator,
)

from models.analytics import MethodRef
from models.intelligence import LicenseDecision

# Réexport explicite : même contrat que le noyau, pas une redéfinition.
WaterLicenseDecision = LicenseDecision

WaterDataStatus = Literal["observed", "modelled", "estimated", "manual", "fixture"]

WaterGeographyScope = Literal["world", "europe", "france"]

# Vocabulaire juridique — identique à celui du prompt P13 du pack maître
# (`docs/carbonco/water-intelligence/prompts/P13_LEGAL_REGISTRY.md`), fixé
# ici pour que WaterLegalRecord soit prêt sans attendre P13.
WaterLegalStatus = Literal[
    "in_force",
    "adopted_not_applicable",
    "proposed",
    "transposition_pending",
    "materiality_dependent",
    "voluntary",
    "out_of_scope",
    "unknown",
]


# ---------------------------------------------------------------------------
# Provenance
# ---------------------------------------------------------------------------


class WaterSourceReference(BaseModel):
    """Référence de provenance minimale imposée par l'en-tête invariant du
    pack maître (règle 9) : source_code, release_key, checksum, dates,
    période, méthode, statut, licence, attribution, avertissements.
    """

    source_code: str = Field(min_length=1)
    release_key: str = Field(min_length=1)
    checksum_sha256: str = Field(min_length=64, max_length=64)
    published_at: date | None = None
    retrieved_at: date
    observed_period_start: date | None = None
    observed_period_end: date | None = None
    methodology_version: str = Field(min_length=1)
    license: WaterLicenseDecision
    attribution: str | None = None
    warnings: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Géographie
# ---------------------------------------------------------------------------


class WaterGeographyRef(BaseModel):
    """Référence géographique. Un `code` officiel est obligatoire dès que
    `scope != "world"` — aucune jointure par nom, un identifiant stable ou
    rien (cf. invariant "aucune jointure par nom si un code existe")."""

    scope: WaterGeographyScope
    code: str | None = None
    label: str = Field(min_length=1)

    @model_validator(mode="after")
    def _code_required_unless_world(self) -> "WaterGeographyRef":
        if self.scope != "world" and not self.code:
            raise ValueError(
                f"geography.code obligatoire pour scope={self.scope!r} "
                "(seul scope='world' peut omettre un identifiant)"
            )
        return self


# ---------------------------------------------------------------------------
# Qualité — confiance et statut de donnée, TOUJOURS séparés de la valeur
# ---------------------------------------------------------------------------


class WaterQualityMetadata(BaseModel):
    """Enveloppe qualité, séparée de `value` par construction (risque/valeur
    ≠ confiance : ce ne sont jamais le même champ)."""

    data_status: WaterDataStatus
    confidence: int | None = Field(default=None, ge=0, le=100)
    coverage_pct: float | None = Field(default=None, ge=0, le=100)
    warnings: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Scénario (ex. Aqueduct 2030 business-as-usual)
# ---------------------------------------------------------------------------


class WaterScenario(BaseModel):
    scenario_code: str = Field(min_length=1)
    label: str = Field(min_length=1)
    horizon_year: int | None = None
    source: WaterSourceReference


# ---------------------------------------------------------------------------
# Observation métrique — le cœur du read model
# ---------------------------------------------------------------------------


class WaterMetricObservation(BaseModel):
    """Une valeur publiée, avec toute son enveloppe de preuve.

    `value=None` signifie "valeur absente", jamais "valeur nulle" (donnée
    manquante ≠ zéro) : aucun défaut à 0 n'existe sur ce champ. Les types
    stricts (`StrictFloat`/`StrictStr`/`StrictBool`) interdisent toute
    coercition silencieuse (ex. un `"5"` qui deviendrait `5.0`).
    """

    metric_code: str = Field(min_length=1)
    value: StrictFloat | StrictStr | StrictBool | None
    unit: str | None = None
    geography: WaterGeographyRef
    period_start: date
    period_end: date
    method: MethodRef
    quality: WaterQualityMetadata
    source: WaterSourceReference
    scenario: WaterScenario | None = None
    value_withheld: bool = False

    @model_validator(mode="after")
    def _withhold_value_when_display_not_allowed(self) -> "WaterMetricObservation":
        if not self.source.license.allow_display:
            if not self.value_withheld:
                raise ValueError(
                    "source.license.allow_display=false : value_withheld doit "
                    "être true (la valeur ne peut pas être publiée, cf. "
                    "pattern value_withheld existant de models/water.py)"
                )
        if self.value_withheld and self.value is not None:
            raise ValueError(
                "value_withheld=true : value doit être None (la valeur ne "
                "quitte jamais le backend, cf. models/water.py)"
            )
        return self


# ---------------------------------------------------------------------------
# Couche géographique (carte)
# ---------------------------------------------------------------------------


class WaterGeoLayerDescriptor(BaseModel):
    """Descripteur d'une couche cartographique publiable.

    `feature_count` est borné par le budget documenté en
    `docs/carbonco/water-intelligence/contracts/P02_DATA_CONTRACTS.md`
    (1 000 entités simultanées maximum, pack maître §3).
    """

    layer_id: str = Field(min_length=1)
    zoom_level: WaterGeographyScope
    geography: WaterGeographyRef
    feature_count: int = Field(ge=0, le=1000)
    boundary_format: Literal["geojson", "topojson"] = "topojson"
    payload_bytes_gzip: int | None = Field(default=None, ge=0)
    source: WaterSourceReference


# ---------------------------------------------------------------------------
# Contenu éditorial (secteurs, acteurs, événements, innovations — P12)
# ---------------------------------------------------------------------------


class WaterEditorialRecord(BaseModel):
    record_id: str = Field(min_length=1)
    record_type: Literal["industry", "actor", "event", "innovation"]
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    jurisdiction: str | None = None
    valid_from: date | None = None
    valid_to: date | None = None
    source: WaterSourceReference
    reviewed_on: date
    reviewed_by: str = Field(min_length=1)


# ---------------------------------------------------------------------------
# Registre juridique (P13)
# ---------------------------------------------------------------------------


class WaterLegalRecord(BaseModel):
    record_id: str = Field(min_length=1)
    jurisdiction: str = Field(min_length=1)
    reference_text: str = Field(min_length=1)
    version: str = Field(min_length=1)
    legal_status: WaterLegalStatus
    source: WaterSourceReference
    reviewed_on: date
    reviewed_by: str = Field(min_length=1)


# ---------------------------------------------------------------------------
# Manifest — enveloppe publique unique (P10 en construira les instances réelles)
# ---------------------------------------------------------------------------


class WaterIntelligenceManifest(BaseModel):
    """Forme unique du snapshot public. `generated_at` est un INPUT explicite
    (jamais `datetime.now()` interne) : un manifest reproductible ne dépend
    d'aucune horloge implicite (pack maître P10, règle "aucune horloge
    implicite dans un calcul reproductible")."""

    manifest_version: str = Field(min_length=1)
    generated_at: datetime
    fixture_label: Literal["fixture", "demo"] | None = None
    sources: list[WaterSourceReference] = Field(min_length=1)
    observations: list[WaterMetricObservation] = Field(default_factory=list)
    geo_layers: list[WaterGeoLayerDescriptor] = Field(default_factory=list)
    scenarios: list[WaterScenario] = Field(default_factory=list)
    editorial_records: list[WaterEditorialRecord] = Field(default_factory=list)
    legal_records: list[WaterLegalRecord] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
