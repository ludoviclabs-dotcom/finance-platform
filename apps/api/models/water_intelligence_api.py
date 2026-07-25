"""
models/water_intelligence_api.py — contrats d'entrée/sortie des surfaces HTTP
Water Intelligence (P16, Wave E, commit E3).

Séparé de `models/water_intelligence.py` (contrats P02, partagés avec le miroir
TypeScript et la fixture gelée) : ces modèles-ci décrivent des **requêtes et
réponses HTTP**, pas la forme des données publiées. Les mélanger ferait dépendre
un contrat de données gelé du dessin d'une API.

## Ce que le contrat d'entrée du moteur financier refuse

Aucun champ obligatoire n'a de valeur par défaut. C'est le point : le moteur
interdit déjà tout taux d'actualisation implicite, et une API qui en fournirait
un « pour simplifier » réintroduirait exactement l'hypothèse invisible que le
moteur refuse. Une requête incomplète est rejetée en 422 par FastAPI, jamais
complétée en silence.

`provenance` n'accepte pas `derived` : un client déclare ce qu'il a observé ou
supposé, jamais ce que le moteur a calculé.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Surfaces publiques
# ---------------------------------------------------------------------------


class WaterPublicSnapshotResponse(BaseModel):
    """Enveloppe du snapshot public.

    Volontairement permissive sur la forme interne (`dict`) : le snapshot est
    déjà validé à l'assemblage par `assemble_public_snapshot`, et le revalider
    ici dupliquerait le contrat P02 sans rien garantir de plus.
    """

    model_config = ConfigDict(extra="forbid")

    schema_version: str
    is_empty: bool
    snapshot: dict[str, Any]


class WaterRegulatoryRegistryResponse(BaseModel):
    """Registre juridique public — les textes à instruire, sans conclusion."""

    model_config = ConfigDict(extra="forbid")

    registry_version: str
    verified_rule_count: int
    rules: list[dict[str, Any]]


# ---------------------------------------------------------------------------
# Synthèse authentifiée
# ---------------------------------------------------------------------------


class DecisionSynthesisResponse(BaseModel):
    """Synthèse hydrique d'une entreprise.

    `company_id` est rendu pour que l'appelant puisse vérifier le périmètre
    servi — il n'est jamais *accepté* en entrée.
    """

    model_config = ConfigDict(extra="forbid")

    company_id: int
    is_empty: bool
    facets: list[dict[str, Any]]


# ---------------------------------------------------------------------------
# Moteur financier
# ---------------------------------------------------------------------------

#: Un client déclare ce qu'il a observé ou supposé. `derived` est réservé au
#: moteur : l'accepter en entrée permettrait de faire passer une hypothèse pour
#: un résultat de calcul.
InputProvenance = Literal["observed", "assumption"]


class ScenarioQuantityInput(BaseModel):
    """Une grandeur fournie par l'appelant, avec sa provenance et sa base.

    `basis` est obligatoire et non vide : le moteur refuse déjà toute grandeur
    sans base déclarée, parce qu'une hypothèse qu'on ne peut pas contester n'est
    pas auditable. L'API applique la même exigence à la frontière.

    `value` peut être `null` : une entrée absente est un état légitime, et le
    moteur rendra un résultat absent AVEC son motif plutôt que zéro.
    """

    model_config = ConfigDict(extra="forbid")

    value: Decimal | None = Field(
        default=...,
        description="Valeur décimale, ou null si l'hypothèse n'est pas disponible.",
    )
    provenance: InputProvenance
    basis: str = Field(min_length=1, max_length=500)


class FinancialScenarioRequest(BaseModel):
    """Scénario d'interruption hydrique à évaluer.

    **Aucun champ obligatoire n'a de valeur par défaut.** En particulier ni
    `discount_rate`, ni `revenue_per_day`, ni `margin_rate`, ni `probability` :
    fournir un défaut reviendrait à poser une hypothèse invisible au nom de
    l'utilisateur.

    Les unités ne sont pas transmises : elles sont **imposées par le champ**
    (jours, ratio, montant, montant/jour). Laisser l'appelant choisir l'unité
    d'un champ ouvrirait la porte à une confusion que le moteur refuse déjà.
    """

    model_config = ConfigDict(extra="forbid")

    scenario_code: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=200)
    base_year: int = Field(ge=1900, le=2200)
    horizon_year: int = Field(ge=1900, le=2200)

    outage_days: ScenarioQuantityInput
    affected_capacity_share: ScenarioQuantityInput
    revenue_per_day: ScenarioQuantityInput
    margin_rate: ScenarioQuantityInput
    additional_opex_per_day: ScenarioQuantityInput
    adaptation_capex: ScenarioQuantityInput
    discount_rate: ScenarioQuantityInput

    #: Facultative, et jamais fabriquée : une probabilité est une hypothèse
    #: humaine, ou elle est absente.
    probability: ScenarioQuantityInput | None = None

    #: Largeur des bandes de sensibilité. Obligatoire : la largeur d'une bande
    #: est un choix d'analyse, pas une constante du moteur.
    sensitivity_variation_pct: Decimal = Field(gt=0, le=100)

    #: Normes comptables à signaler comme QUESTIONS. Une référence inconnue est
    #: refusée par le moteur — aucune n'est inventée.
    signals: list[str] = Field(default_factory=list, max_length=20)


class FinancialScenarioResponse(BaseModel):
    """Résultat d'un scénario : valeur centrale, sensibilités, questions.

    Ne porte aucune écriture comptable et aucune conclusion : les signaux sont
    des points à examiner.
    """

    model_config = ConfigDict(extra="forbid")

    scenario_code: str
    label: str
    horizon_year: int
    is_absent: bool
    absence_reason: str | None
    components: dict[str, Any]
    present_value: str | None
    probability_weighted: str | None
    sensitivities: list[dict[str, Any]]
    signals: list[str]
