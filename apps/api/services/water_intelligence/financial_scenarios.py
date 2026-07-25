"""
services/water_intelligence/financial_scenarios.py — scénarios financiers
hydriques (P15, Wave D).

## Ce que ce moteur produit, et ce qu'il refuse de produire

Il produit une **arithmétique inspectable** : à partir d'hypothèses explicites
(jours d'arrêt, part de capacité affectée, revenu, marge, OPEX, CAPEX,
probabilité, horizon, taux d'actualisation), il calcule une exposition et sa
**sensibilité**.

Il refuse trois choses, chacune verrouillée par un test :

1. **Aucune écriture comptable.** Le module ne produit ni écriture, ni compte,
   ni provision. Il émet des *signaux à examiner* — « cette situation peut
   relever d'IAS 36 » — et jamais la conclusion correspondante. Décider d'une
   dépréciation ou d'une provision est un acte comptable humain.
2. **Aucun taux inventé.** Ni taux d'actualisation par défaut, ni taux fiscal,
   ni taux d'inflation. Le taux d'actualisation est un **paramètre obligatoire**
   : un taux implicite est une hypothèse invisible, donc incontestable.
3. **Aucune probabilité produite par un modèle de langage.** Une probabilité
   est une hypothèse humaine datée et justifiée, ou elle est absente. Le champ
   `basis` est obligatoire et le moteur n'en fabrique jamais.

## Observé, hypothèse, dérivé

Chaque grandeur porte sa `provenance`. La distinction n'est pas cosmétique :
un revenu journalier **observé** (comptabilité) et un revenu journalier
**supposé** (moyenne de secteur) n'ont pas la même valeur probante, et un
résultat **dérivé** ne peut jamais être plus solide que la plus faible de ses
entrées. `derive()` recalcule donc la provenance du résultat, il ne l'affirme
pas.

## Absence n'est pas zéro

Si une entrée manque, le résultat est **absent avec son motif**, jamais `0`.
Un zéro se lit comme « pas d'exposition » ; une absence se lit comme « on ne
sait pas ». C'est la même règle que celle appliquée aux prélèvements non
déclarés en Wave B.

## Sensibilité plutôt que certitude

`build_exposure()` ne rend jamais un nombre seul : il rend une valeur centrale
**et** les bandes obtenues en faisant varier chaque inducteur, une variation à
la fois. Un point unique, même correct, se lit comme une prévision.

Arithmétique en `Decimal` avec arrondi `ROUND_HALF_EVEN` explicite : deux
exécutions sur les mêmes entrées rendent exactement le même résultat, et aucun
flottant binaire ne dérive sur des montants.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_EVEN, Decimal, InvalidOperation
from typing import Iterable, Literal, Mapping

#: D'où vient une grandeur. Un dérivé n'est jamais plus solide que ses entrées.
Provenance = Literal["observed", "assumption", "derived"]

#: Unités reconnues. Volontairement peu nombreuses et explicites : une unité
#: libre laisserait passer une multiplication qui n'a pas de sens.
UNIT_DAY = "day"
UNIT_RATIO = "ratio"
UNIT_CURRENCY = "currency"
UNIT_CURRENCY_PER_DAY = "currency/day"

_KNOWN_UNITS = frozenset(
    {UNIT_DAY, UNIT_RATIO, UNIT_CURRENCY, UNIT_CURRENCY_PER_DAY}
)

#: Précision monétaire : deux décimales, arrondi au pair le plus proche.
#: Explicite pour que deux exécutions soient bit-à-bit identiques.
_MONEY_EXPONENT = Decimal("0.01")

#: Motifs normalisés d'absence de résultat.
ABSENCE_MISSING_INPUT = "missing_input"

#: Signaux comptables à EXAMINER. Ce sont des questions, jamais des conclusions.
ACCOUNTING_SIGNALS: Mapping[str, str] = {
    "IAS 36": (
        "Une exposition hydrique durable sur un actif peut constituer un indice "
        "de perte de valeur à examiner. Le test de dépréciation reste un acte "
        "comptable humain."
    ),
    "IAS 37": (
        "Une obligation actuelle résultant d'un événement passé peut appeler une "
        "provision ou un passif éventuel à examiner."
    ),
    "IFRIC 21": (
        "Le fait générateur d'une redevance ou taxe liée au prélèvement peut être "
        "distinct de l'exercice de consommation : à examiner au regard du texte "
        "applicable."
    ),
    "going_concern": (
        "Une interruption longue peut affecter la continuité d'exploitation : "
        "hypothèse à examiner avec la direction et les commissaires aux comptes."
    ),
    "insurance": (
        "La couverture assurantielle du risque hydrique et ses exclusions sont à "
        "vérifier — aucune indemnisation n'est supposée ici."
    ),
    "levies": (
        "Les redevances et taxes applicables dépendent du bassin et de l'usage ; "
        "aucun taux n'est encodé dans ce moteur."
    ),
}


class FinancialScenarioError(Exception):
    """Scénario mal formé — refusé à la construction, jamais toléré."""


class UnitMismatchError(FinancialScenarioError):
    """Opération entre unités incompatibles.

    Ne jamais rattraper pour continuer : une multiplication d'unités
    incohérentes produirait un nombre plausible et faux.
    """


def _to_decimal(value: object, *, field: str) -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:  # pragma: no cover - garde
        raise FinancialScenarioError(f"{field} : valeur non numérique {value!r}.") from exc


@dataclass(frozen=True)
class Quantity:
    """Une grandeur, son unité, sa provenance et sa base.

    `basis` est obligatoire : une hypothèse sans base déclarée n'est pas
    contestable, donc pas auditable.
    """

    value: Decimal | None
    unit: str
    provenance: Provenance
    basis: str

    def __post_init__(self) -> None:
        if self.unit not in _KNOWN_UNITS:
            raise FinancialScenarioError(
                f"unité {self.unit!r} inconnue — les unités sont déclarées, jamais libres."
            )
        if self.provenance not in ("observed", "assumption", "derived"):
            raise FinancialScenarioError(f"provenance {self.provenance!r} inconnue.")
        if not self.basis.strip():
            raise FinancialScenarioError(
                "Quantity.basis obligatoire — une grandeur sans base déclarée n'est "
                "pas contestable."
            )
        if self.value is not None:
            if not isinstance(self.value, Decimal):
                raise FinancialScenarioError(
                    "Quantity.value doit être un Decimal — les flottants binaires "
                    "dérivent sur les montants."
                )
            if self.unit == UNIT_RATIO and not (Decimal(0) <= self.value <= Decimal(1)):
                raise FinancialScenarioError(
                    f"un ratio doit être compris entre 0 et 1 (reçu {self.value})."
                )
            if self.unit in (UNIT_DAY, UNIT_CURRENCY, UNIT_CURRENCY_PER_DAY) and self.value < 0:
                raise FinancialScenarioError(
                    f"{self.unit} : une valeur négative n'a pas de sens ici (reçu {self.value})."
                )

    @property
    def is_absent(self) -> bool:
        return self.value is None


def multiply(left: Quantity, right: Quantity, *, basis: str) -> Quantity:
    """Produit de deux grandeurs, avec contrôle d'unités.

    Combinaisons autorisées, et elles seules :
    `day × currency/day → currency`, `currency × ratio → currency`,
    `day × ratio → day`, `ratio × ratio → ratio`.

    Toute autre combinaison lève : mieux vaut un échec bruyant qu'un montant
    plausible obtenu en multipliant des jours par des euros.
    """
    pair = (left.unit, right.unit)
    if pair in ((UNIT_DAY, UNIT_CURRENCY_PER_DAY), (UNIT_CURRENCY_PER_DAY, UNIT_DAY)):
        unit = UNIT_CURRENCY
    elif pair in ((UNIT_CURRENCY, UNIT_RATIO), (UNIT_RATIO, UNIT_CURRENCY)):
        unit = UNIT_CURRENCY
    elif pair in ((UNIT_DAY, UNIT_RATIO), (UNIT_RATIO, UNIT_DAY)):
        unit = UNIT_DAY
    elif pair == (UNIT_RATIO, UNIT_RATIO):
        unit = UNIT_RATIO
    else:
        raise UnitMismatchError(
            f"produit impossible entre {left.unit!r} et {right.unit!r} — "
            "les unités ne se combinent pas silencieusement."
        )

    if left.is_absent or right.is_absent:
        return Quantity(value=None, unit=unit, provenance="derived", basis=basis)
    return Quantity(
        value=left.value * right.value,  # type: ignore[operator]
        unit=unit,
        provenance="derived",
        basis=basis,
    )


def add(left: Quantity, right: Quantity, *, basis: str) -> Quantity:
    """Somme de deux grandeurs de MÊME unité.

    Une absence rend le total absent : additionner en traitant l'inconnu comme
    zéro produirait un total qui se lit comme complet.
    """
    if left.unit != right.unit:
        raise UnitMismatchError(
            f"somme impossible entre {left.unit!r} et {right.unit!r}."
        )
    if left.is_absent or right.is_absent:
        return Quantity(value=None, unit=left.unit, provenance="derived", basis=basis)
    return Quantity(
        value=left.value + right.value,  # type: ignore[operator]
        unit=left.unit,
        provenance="derived",
        basis=basis,
    )


def discount_to_present(
    amount: Quantity, *, discount_rate: Quantity, years: int, basis: str
) -> Quantity:
    """Actualise un montant sur `years` années au taux **fourni**.

    Le taux est un paramètre obligatoire : aucun taux par défaut n'est proposé,
    parce qu'un taux implicite est une hypothèse que personne ne peut contester.
    """
    if amount.unit != UNIT_CURRENCY:
        raise UnitMismatchError(
            f"seul un montant en {UNIT_CURRENCY!r} peut être actualisé (reçu {amount.unit!r})."
        )
    if discount_rate.unit != UNIT_RATIO:
        raise UnitMismatchError("le taux d'actualisation doit être un ratio.")
    if years < 0:
        raise FinancialScenarioError("l'horizon d'actualisation ne peut pas être négatif.")
    if amount.is_absent or discount_rate.is_absent:
        return Quantity(value=None, unit=UNIT_CURRENCY, provenance="derived", basis=basis)

    divisor = (Decimal(1) + discount_rate.value) ** years  # type: ignore[operator]
    if divisor == 0:  # pragma: no cover - impossible avec un ratio >= 0
        raise FinancialScenarioError("facteur d'actualisation nul.")
    return Quantity(
        value=(amount.value / divisor).quantize(  # type: ignore[operator]
            _MONEY_EXPONENT, rounding=ROUND_HALF_EVEN
        ),
        unit=UNIT_CURRENCY,
        provenance="derived",
        basis=basis,
    )


@dataclass(frozen=True)
class WaterDisruptionScenario:
    """Un scénario d'interruption hydrique, entièrement explicite.

    Aucun champ n'a de valeur par défaut « raisonnable » : tout paramètre absent
    doit être déclaré absent, avec sa base.
    """

    scenario_code: str
    label: str
    horizon_year: int
    base_year: int
    outage_days: Quantity
    affected_capacity_share: Quantity
    revenue_per_day: Quantity
    margin_rate: Quantity
    additional_opex_per_day: Quantity
    adaptation_capex: Quantity
    discount_rate: Quantity
    probability: Quantity | None = None

    def __post_init__(self) -> None:
        if not self.scenario_code.strip():
            raise FinancialScenarioError("scenario_code obligatoire.")
        if not self.label.strip():
            raise FinancialScenarioError("label obligatoire.")
        if self.horizon_year < self.base_year:
            raise FinancialScenarioError(
                f"horizon {self.horizon_year} antérieur à l'année de base "
                f"{self.base_year} — ordre temporel impossible."
            )
        _expect(self.outage_days, UNIT_DAY, "outage_days")
        _expect(self.affected_capacity_share, UNIT_RATIO, "affected_capacity_share")
        _expect(self.revenue_per_day, UNIT_CURRENCY_PER_DAY, "revenue_per_day")
        _expect(self.margin_rate, UNIT_RATIO, "margin_rate")
        _expect(self.additional_opex_per_day, UNIT_CURRENCY_PER_DAY, "additional_opex_per_day")
        _expect(self.adaptation_capex, UNIT_CURRENCY, "adaptation_capex")
        _expect(self.discount_rate, UNIT_RATIO, "discount_rate")

        if self.discount_rate.is_absent:
            raise FinancialScenarioError(
                "le taux d'actualisation est obligatoire — un taux implicite est "
                "une hypothèse que personne ne peut contester."
            )
        if self.probability is not None:
            _expect(self.probability, UNIT_RATIO, "probability")
            if self.probability.provenance == "derived":
                raise FinancialScenarioError(
                    "une probabilité ne peut pas être « dérivée » par ce moteur : "
                    "elle est observée ou supposée par un humain, jamais calculée ici."
                )

    @property
    def years_to_horizon(self) -> int:
        return self.horizon_year - self.base_year


def _expect(quantity: Quantity, unit: str, field: str) -> None:
    if quantity.unit != unit:
        raise FinancialScenarioError(
            f"{field} doit être exprimé en {unit!r} (reçu {quantity.unit!r})."
        )


@dataclass(frozen=True)
class SensitivityBand:
    """Effet d'une variation d'UN inducteur, les autres inchangés.

    Une variation à la fois : croiser les variations produirait un intervalle
    qui ressemble à un intervalle de confiance sans en être un.
    """

    driver: str
    variation_pct: Decimal
    low: Decimal | None
    base: Decimal | None
    high: Decimal | None

    def as_mapping(self) -> Mapping[str, object]:
        return {
            "driver": self.driver,
            "variation_pct": str(self.variation_pct),
            "low": None if self.low is None else str(self.low),
            "base": None if self.base is None else str(self.base),
            "high": None if self.high is None else str(self.high),
        }


@dataclass(frozen=True)
class FinancialExposure:
    """Résultat d'un scénario : une valeur centrale, ses composantes, ses
    sensibilités, ses signaux à examiner — et jamais une conclusion."""

    scenario_code: str
    label: str
    horizon_year: int
    components: Mapping[str, Quantity]
    present_value: Quantity
    probability_weighted: Quantity | None
    sensitivities: tuple[SensitivityBand, ...]
    signals: tuple[str, ...]
    absence_reason: str | None = None

    @property
    def is_absent(self) -> bool:
        return self.present_value.is_absent

    def as_mapping(self) -> Mapping[str, object]:
        return {
            "scenario_code": self.scenario_code,
            "label": self.label,
            "horizon_year": self.horizon_year,
            "is_absent": self.is_absent,
            "absence_reason": self.absence_reason,
            "components": {
                name: {
                    "value": None if q.value is None else str(q.value),
                    "unit": q.unit,
                    "provenance": q.provenance,
                    "basis": q.basis,
                }
                for name, q in sorted(self.components.items())
            },
            "present_value": (
                None if self.present_value.value is None else str(self.present_value.value)
            ),
            "probability_weighted": (
                None
                if self.probability_weighted is None or self.probability_weighted.value is None
                else str(self.probability_weighted.value)
            ),
            "sensitivities": [band.as_mapping() for band in self.sensitivities],
            "signals": list(self.signals),
        }


#: Inducteurs soumis à l'analyse de sensibilité, dans un ordre déterministe.
_SENSITIVITY_DRIVERS = ("outage_days", "revenue_per_day", "margin_rate", "discount_rate")

#: Paramètres attendus d'un scénario : nom, unité, obligation, et ce que le
#: moteur en fait. Émis depuis le code pour que la documentation publique ne
#: puisse pas dériver de l'implémentation.
_PARAMETER_CONTRACT: tuple[tuple[str, str, bool, str], ...] = (
    ("outage_days", UNIT_DAY, True, "Durée d'interruption retenue pour le scénario."),
    (
        "affected_capacity_share",
        UNIT_RATIO,
        True,
        "Part de la capacité réellement affectée — un arrêt total n'est pas supposé.",
    ),
    ("revenue_per_day", UNIT_CURRENCY_PER_DAY, True, "Revenu journalier de l'activité exposée."),
    ("margin_rate", UNIT_RATIO, True, "Taux de marge appliqué au revenu à risque."),
    (
        "additional_opex_per_day",
        UNIT_CURRENCY_PER_DAY,
        True,
        "Surcoût opératoire journalier (approvisionnement de substitution, transport…).",
    ),
    ("adaptation_capex", UNIT_CURRENCY, True, "Investissement d'adaptation envisagé."),
    (
        "discount_rate",
        UNIT_RATIO,
        True,
        "Taux d'actualisation FOURNI — aucun taux par défaut n'existe dans le moteur.",
    ),
    (
        "probability",
        UNIT_RATIO,
        False,
        "Probabilité fournie par un humain, avec sa base. Jamais calculée ici, "
        "jamais produite par un modèle de langage.",
    ),
)


def contract_document() -> Mapping[str, object]:
    """Contrat public du moteur : ce qu'il exige, ce qu'il refuse.

    Ne contient **aucun montant** : le moteur calcule sur des données
    d'entreprise, qui n'ont pas leur place sur une surface publique. Ce
    document décrit la mécanique, pas un résultat.
    """
    return {
        "sensitivity_drivers": list(_SENSITIVITY_DRIVERS),
        "money_rounding": "ROUND_HALF_EVEN, 2 décimales",
        "parameters": [
            {
                "name": name,
                "unit": unit,
                "required": required,
                "description": description,
            }
            for name, unit, required, description in _PARAMETER_CONTRACT
        ],
        "accounting_signals": [
            {"reference": reference, "question": question}
            for reference, question in sorted(ACCOUNTING_SIGNALS.items())
        ],
        "refusals": [
            "Aucune écriture comptable : le moteur signale des questions, jamais des conclusions.",
            "Aucun taux inventé : le taux d'actualisation est obligatoire, aucun taux fiscal n'est encodé.",
            "Aucune probabilité produite par un modèle de langage.",
            "Une entrée absente rend un résultat absent et motivé, jamais zéro.",
            "Une valeur centrale n'est jamais rendue seule : ses bandes de sensibilité l'accompagnent.",
        ],
    }


def _compute_present_value(scenario: WaterDisruptionScenario) -> tuple[Quantity, dict[str, Quantity]]:
    lost_days = multiply(
        scenario.outage_days,
        scenario.affected_capacity_share,
        basis="jours d'arrêt × part de capacité affectée",
    )
    revenue_at_risk = multiply(
        lost_days, scenario.revenue_per_day, basis="jours perdus × revenu journalier"
    )
    margin_at_risk = multiply(
        revenue_at_risk, scenario.margin_rate, basis="revenu à risque × taux de marge"
    )
    extra_opex = multiply(
        lost_days,
        scenario.additional_opex_per_day,
        basis="jours perdus × surcoût opératoire journalier",
    )
    subtotal = add(margin_at_risk, extra_opex, basis="marge à risque + surcoût opératoire")
    total = add(subtotal, scenario.adaptation_capex, basis="sous-total + CAPEX d'adaptation")
    present_value = discount_to_present(
        total,
        discount_rate=scenario.discount_rate,
        years=scenario.years_to_horizon,
        basis="total actualisé au taux fourni",
    )
    components = {
        "lost_days": lost_days,
        "revenue_at_risk": revenue_at_risk,
        "margin_at_risk": margin_at_risk,
        "additional_opex": extra_opex,
        "adaptation_capex": scenario.adaptation_capex,
        "undiscounted_total": total,
    }
    return present_value, components


def _scaled(quantity: Quantity, factor: Decimal) -> Quantity:
    if quantity.is_absent:
        return quantity
    scaled_value = quantity.value * factor  # type: ignore[operator]
    if quantity.unit == UNIT_RATIO:
        scaled_value = min(max(scaled_value, Decimal(0)), Decimal(1))
    return Quantity(
        value=scaled_value,
        unit=quantity.unit,
        provenance=quantity.provenance,
        basis=f"{quantity.basis} (variation de sensibilité)",
    )


def _sensitivity(
    scenario: WaterDisruptionScenario, driver: str, variation_pct: Decimal
) -> SensitivityBand:
    base_value, _ = _compute_present_value(scenario)
    factor_low = Decimal(1) - variation_pct / Decimal(100)
    factor_high = Decimal(1) + variation_pct / Decimal(100)

    def _variant(factor: Decimal) -> Decimal | None:
        current = getattr(scenario, driver)
        replaced = _scaled(current, factor)
        variant = WaterDisruptionScenario(
            scenario_code=scenario.scenario_code,
            label=scenario.label,
            horizon_year=scenario.horizon_year,
            base_year=scenario.base_year,
            outage_days=replaced if driver == "outage_days" else scenario.outage_days,
            affected_capacity_share=scenario.affected_capacity_share,
            revenue_per_day=replaced if driver == "revenue_per_day" else scenario.revenue_per_day,
            margin_rate=replaced if driver == "margin_rate" else scenario.margin_rate,
            additional_opex_per_day=scenario.additional_opex_per_day,
            adaptation_capex=scenario.adaptation_capex,
            discount_rate=replaced if driver == "discount_rate" else scenario.discount_rate,
            probability=scenario.probability,
        )
        return _compute_present_value(variant)[0].value

    return SensitivityBand(
        driver=driver,
        variation_pct=variation_pct,
        low=_variant(factor_low),
        base=base_value.value,
        high=_variant(factor_high),
    )


def build_exposure(
    scenario: WaterDisruptionScenario,
    *,
    sensitivity_variation_pct: Decimal,
    signals: Iterable[str] = (),
) -> FinancialExposure:
    """Calcule l'exposition d'un scénario, avec ses sensibilités.

    `sensitivity_variation_pct` est un paramètre obligatoire : la largeur d'une
    bande de sensibilité est un choix d'analyse, pas une constante du moteur.

    `signals` nomme les normes à EXAMINER. Un signal inconnu est refusé — le
    moteur ne fabrique pas de référence comptable.
    """
    if sensitivity_variation_pct <= 0:
        raise FinancialScenarioError(
            "la variation de sensibilité doit être strictement positive."
        )
    unknown = [signal for signal in signals if signal not in ACCOUNTING_SIGNALS]
    if unknown:
        raise FinancialScenarioError(
            f"signaux comptables inconnus : {unknown} — aucune référence n'est inventée."
        )

    present_value, components = _compute_present_value(scenario)

    probability_weighted: Quantity | None = None
    if scenario.probability is not None:
        probability_weighted = multiply(
            present_value,
            scenario.probability,
            basis="valeur actualisée × probabilité fournie par un humain",
        )
        if probability_weighted.value is not None:
            probability_weighted = Quantity(
                value=probability_weighted.value.quantize(
                    _MONEY_EXPONENT, rounding=ROUND_HALF_EVEN
                ),
                unit=probability_weighted.unit,
                provenance=probability_weighted.provenance,
                basis=probability_weighted.basis,
            )

    absent_inputs = [
        name
        for name, quantity in (
            ("outage_days", scenario.outage_days),
            ("affected_capacity_share", scenario.affected_capacity_share),
            ("revenue_per_day", scenario.revenue_per_day),
            ("margin_rate", scenario.margin_rate),
            ("additional_opex_per_day", scenario.additional_opex_per_day),
            ("adaptation_capex", scenario.adaptation_capex),
        )
        if quantity.is_absent
    ]

    return FinancialExposure(
        scenario_code=scenario.scenario_code,
        label=scenario.label,
        horizon_year=scenario.horizon_year,
        components=components,
        present_value=present_value,
        probability_weighted=probability_weighted,
        sensitivities=tuple(
            _sensitivity(scenario, driver, sensitivity_variation_pct)
            for driver in _SENSITIVITY_DRIVERS
        ),
        signals=tuple(sorted(set(signals))),
        absence_reason=(
            f"{ABSENCE_MISSING_INPUT}: {', '.join(sorted(absent_inputs))}"
            if absent_inputs
            else None
        ),
    )
