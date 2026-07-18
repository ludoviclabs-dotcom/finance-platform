"""
scope2_selection.py — règle UNIQUE de sélection Scope 2 location/market-based.

Le Scope 2 « dual » (GHG Protocol Scope 2 Guidance) coexiste dans deux bases :
location-based (LB, facteur moyen de réseau) et market-based (MB, instruments
contractuels / facteur fournisseur / mix résiduel). Pour les CONSOMMATEURS qui
n'affichent qu'UN total (BEGES réglementaire, trajectoire MACC…), la convention
du dépôt est : **préférer le LB ; ne se rabattre sur le MB que si le LB est
ABSENT** — sur la PRÉSENCE, jamais sur la valeur (LB = 0 est légitime, ex.
électricité 100 % renouvelable ; ce n'est pas « pas de donnée »).

Cette règle était dupliquée inline dans `beges_export._reduce_scope_rows` et
`actions_service.baseline_total`. PR-06A la consolide ici, sans changement de
comportement (couverte par les tests existants de beges + les tests dédiés de
`test_scope2_selection.py`).

Fonction PURE : aucun I/O, aucune dépendance DB, aucun LLM. Ne calcule PAS le
Scope 2 (le moteur de calcul dual LB+MB est PR-06B) — elle ne fait QUE
sélectionner, parmi deux valeurs déjà connues, laquelle un consommateur
mono-total doit retenir, en préservant l'information de base retenue.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Mapping

# Codes de fact Scope 2 dual (cf. facts_service / classeur Excel → facts_current).
CODE_SCOPE2_LB = "CC.GES.SCOPE2_LB"
CODE_SCOPE2_MB = "CC.GES.SCOPE2_MB"

Scope2Basis = Literal["location_based", "market_based"]


@dataclass(frozen=True)
class Scope2Selection:
    """Résultat de la sélection : la valeur retenue et la base d'où elle vient.

    `basis` conserve la traçabilité (LB préféré vs repli MB) pour l'affichage /
    la trace — un consommateur qui n'a besoin que du nombre lit `.value`.
    """

    value: float
    basis: Scope2Basis


def select_scope2(lb: float | None, mb: float | None) -> Scope2Selection | None:
    """Sélectionne la valeur Scope 2 à retenir selon la règle LB-préféré.

    - `lb` présent (non `None`, y compris `0.0`) → retenu, `basis="location_based"`.
    - sinon `mb` présent → retenu en repli, `basis="market_based"`.
    - les deux absents → `None` (aucune donnée Scope 2 ; l'appelant décide du défaut).

    La présence est testée sur `is not None`, JAMAIS sur la véracité (`if lb:`) :
    `lb = 0.0` est une donnée légitime et doit primer sur un MB non nul.
    """
    if lb is not None:
        return Scope2Selection(value=float(lb), basis="location_based")
    if mb is not None:
        return Scope2Selection(value=float(mb), basis="market_based")
    return None


def select_scope2_from_facts(values: Mapping[str, float]) -> Scope2Selection | None:
    """Variante pratique lisant les deux codes dans un mapping `{code: valeur}`.

    `values` ne contient que des codes réellement présents (le NULL SQL est
    filtré en amont par les appelants) : `values.get(CODE)` renvoie donc `None`
    exactement quand le code est absent, et la valeur (0.0 compris) quand il est
    présent — la sémantique de présence attendue par `select_scope2`.
    """
    return select_scope2(values.get(CODE_SCOPE2_LB), values.get(CODE_SCOPE2_MB))
