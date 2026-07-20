"""
units.py — conversion d'unités d'énergie, centralisée (PR-06B).

Le plan PR-06 §11 identifie l'absence d'utilitaire de conversion comme un risque :
« jamais de conversion inline dispersée ». Ce module est le SEUL endroit du dépôt
où un kWh devient un MWh.

Deux conversions, et seulement deux :
  * `to_mwh(quantity, unit)`            — une QUANTITÉ d'énergie → MWh ;
  * `factor_to_kgco2e_per_mwh(f, unit)` — un FACTEUR kgCO2e/<unité d'énergie>
                                          → kgCO2e/MWh.

Règles :
  * unité inconnue ou non énergétique (kg, km, t, m3, €) → **erreur explicite**.
    Jamais de conversion « au mieux », jamais un facteur 1 par défaut : une
    unité non convertible est un trou de données qui doit remonter.
  * facteurs exacts, pas d'arrondi intermédiaire — l'arrondi est réservé à
    l'affichage (plan §6).
  * fonctions PURES : aucun I/O, aucune dépendance DB.
"""

from __future__ import annotations

from services.calculations import CalculationError

# Facteurs de conversion vers le MWh (exacts, définitionnels).
#   1 MWh = 1 000 kWh = 1 000 000 Wh = 0,001 GWh = 1e-6 TWh
#   1 MWh = 3 600 MJ  = 3,6 GJ = 3 600 000 kJ = 0,0036 TJ  (1 kWh = 3,6 MJ)
_TO_MWH: dict[str, float] = {
    "wh": 1e-6,
    "kwh": 1e-3,
    "mwh": 1.0,
    "gwh": 1e3,
    "twh": 1e6,
    "kj": 1.0 / 3_600_000.0,
    "mj": 1.0 / 3_600.0,
    "gj": 1.0 / 3.6,
    "tj": 1_000.0 / 3.6,
}

# Alias d'écriture rencontrés dans les catalogues de facteurs / CSV d'import.
_ALIASES: dict[str, str] = {
    "kw.h": "kwh",
    "kw-h": "kwh",
    "kilowattheure": "kwh",
    "kilowatt-heure": "kwh",
    "mw.h": "mwh",
    "mw-h": "mwh",
    "megawattheure": "mwh",
    "mégawattheure": "mwh",
    "gw.h": "gwh",
    "joule": "j",
    "megajoule": "mj",
    "mégajoule": "mj",
    "gigajoule": "gj",
}

SUPPORTED_ENERGY_UNITS: tuple[str, ...] = tuple(sorted(_TO_MWH))


def _normalize(unit: str) -> str:
    """Normalise l'écriture d'une unité (casse, espaces, alias) — sans deviner.

    La normalisation ne fait que RECONNAÎTRE des écritures équivalentes d'une
    même unité ; elle ne convertit rien et n'invente aucune unité par défaut.
    """
    if unit is None:
        raise CalculationError("Unité d'énergie requise (aucune unité fournie).")
    key = str(unit).strip().lower().replace(" ", "")
    return _ALIASES.get(key, key)


def is_energy_unit(unit: str | None) -> bool:
    """True si l'unité est une unité d'énergie convertible en MWh."""
    if unit is None:
        return False
    try:
        return _normalize(unit) in _TO_MWH
    except CalculationError:
        return False


def to_mwh(quantity: float, unit: str) -> float:
    """Convertit une quantité d'énergie en MWh.

    Erreur EXPLICITE (`CalculationError`) si l'unité n'est pas une unité
    d'énergie connue — une consommation en « kg » ou en « € » n'est pas une
    consommation d'énergie et ne doit jamais être calculée comme telle.
    """
    key = _normalize(unit)
    factor = _TO_MWH.get(key)
    if factor is None:
        raise CalculationError(
            f"Unité d'énergie non convertible : '{unit}'. "
            f"Unités acceptées : {', '.join(SUPPORTED_ENERGY_UNITS)}."
        )
    return float(quantity) * factor


def factor_to_kgco2e_per_mwh(factor_value: float, factor_unit: str) -> float:
    """Convertit un facteur kgCO2e/<unité d'énergie> en kgCO2e/MWh.

    `factor_unit` est le DÉNOMINATEUR du facteur (la colonne `unit` de
    `emission_factors` : 'kWh', 'MJ'…). Un facteur exprimé par kWh vaut 1 000
    fois plus par MWh — d'où l'inversion : diviser par la valeur d'un MWh
    exprimée dans l'unité du facteur.
    """
    key = _normalize(factor_unit)
    mwh_per_unit = _TO_MWH.get(key)
    if mwh_per_unit is None:
        raise CalculationError(
            f"Facteur non applicable à de l'énergie : dénominateur '{factor_unit}' "
            f"non convertible. Unités acceptées : {', '.join(SUPPORTED_ENERGY_UNITS)}."
        )
    # 1 unité = `mwh_per_unit` MWh  ⇒  kgCO2e/MWh = kgCO2e/unité ÷ mwh_per_unit
    return float(factor_value) / mwh_per_unit


def kg_to_tonnes(value_kg: float) -> float:
    """kgCO2e → tCO2e. Aucune subtilité, mais centralisé pour que le facteur
    1/1000 n'apparaisse pas en dur dans le moteur."""
    return float(value_kg) / 1000.0
