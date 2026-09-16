"""
safe_formula.py — évaluation SÛRE des expressions issues de formules Excel.

Le moteur de formules du service carbone réduit une formule à une expression
Python (références de cellules remplacées par leurs valeurs) puis l'évaluait
avec `eval(expr, {"__builtins__": {}}, {})`. Ce « bac à sable » ne protège
pas : une formule d'un classeur importé atteignait `().__class__.__base__
.__subclasses__()`, primitive classique d'évasion vers l'exécution de code.

Ici, l'expression est analysée par `ast` et seule une liste blanche de nœuds
est évaluée : constantes (nombres, texte, booléens), + - * / ^ (puissance
bornée), signes, comparaisons, et/ou/non. Tout le reste (attributs, appels,
indices, noms, compréhensions, `%`…) est refusé.
"""

from __future__ import annotations

import ast
import math
import operator
from typing import Any, Callable


class UnsafeFormulaError(ValueError):
    """Expression refusée (construction non autorisée ou résultat invalide)."""


_MAX_EXPRESSION_LENGTH = 4000
_MAX_NODES = 400
_MAX_EXPONENT = 64
_MAX_POWER_BASE = 1e15


def _number(value: Any) -> float | int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return value
    raise UnsafeFormulaError("Opération arithmétique sur une valeur non numérique.")


def _pow(base: Any, exponent: Any) -> float | int:
    b, e = _number(base), _number(exponent)
    if abs(e) > _MAX_EXPONENT or abs(b) > _MAX_POWER_BASE:
        raise UnsafeFormulaError("Puissance hors bornes.")
    return b ** e


def _div(left: Any, right: Any) -> float:
    numerator, denominator = _number(left), _number(right)
    if denominator == 0:
        raise UnsafeFormulaError("Division par zéro (#DIV/0!).")
    return numerator / denominator


_BIN_OPS: dict[type, Callable[[Any, Any], Any]] = {
    ast.Add: lambda a, b: _number(a) + _number(b),
    ast.Sub: lambda a, b: _number(a) - _number(b),
    ast.Mult: lambda a, b: _number(a) * _number(b),
    ast.Div: _div,
    ast.Pow: _pow,
}

_CMP_OPS: dict[type, Callable[[Any, Any], bool]] = {
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
}


def _eval(node: ast.AST) -> Any:
    if isinstance(node, ast.Constant):
        if node.value is None or isinstance(node.value, (bool, int, float, str)):
            return node.value
        raise UnsafeFormulaError("Constante non autorisée.")
    if isinstance(node, ast.BinOp):
        op = _BIN_OPS.get(type(node.op))
        if op is None:
            raise UnsafeFormulaError(f"Opérateur non autorisé : {type(node.op).__name__}.")
        return op(_eval(node.left), _eval(node.right))
    if isinstance(node, ast.UnaryOp):
        operand = _eval(node.operand)
        if isinstance(node.op, ast.USub):
            return -_number(operand)
        if isinstance(node.op, ast.UAdd):
            return +_number(operand)
        if isinstance(node.op, ast.Not):
            return not operand
        raise UnsafeFormulaError(f"Opérateur non autorisé : {type(node.op).__name__}.")
    if isinstance(node, ast.Compare):
        left = _eval(node.left)
        for op_node, comparator in zip(node.ops, node.comparators):
            op = _CMP_OPS.get(type(op_node))
            if op is None:
                raise UnsafeFormulaError(f"Comparaison non autorisée : {type(op_node).__name__}.")
            right = _eval(comparator)
            try:
                if not op(left, right):
                    return False
            except TypeError as exc:
                raise UnsafeFormulaError("Comparaison entre types incompatibles.") from exc
            left = right
        return True
    if isinstance(node, ast.BoolOp):
        if isinstance(node.op, ast.And):
            result: Any = True
            for value in node.values:
                result = _eval(value)
                if not result:
                    return result
            return result
        if isinstance(node.op, ast.Or):
            result = False
            for value in node.values:
                result = _eval(value)
                if result:
                    return result
            return result
    raise UnsafeFormulaError(f"Construction non autorisée : {type(node).__name__}.")


def safe_eval(expression: str) -> Any:
    """Évalue une expression arithmétique/logique simple, sans jamais exécuter
    de code arbitraire. Lève UnsafeFormulaError sinon."""
    if not isinstance(expression, str):
        raise UnsafeFormulaError("Expression invalide.")
    if len(expression) > _MAX_EXPRESSION_LENGTH:
        raise UnsafeFormulaError("Expression trop longue.")
    try:
        tree = ast.parse(expression.strip(), mode="eval")
    except SyntaxError as exc:
        raise UnsafeFormulaError("Expression illisible.") from exc
    if sum(1 for _ in ast.walk(tree)) > _MAX_NODES:
        raise UnsafeFormulaError("Expression trop complexe.")
    try:
        result = _eval(tree.body)
    except (OverflowError, ZeroDivisionError) as exc:
        raise UnsafeFormulaError("Résultat hors bornes.") from exc
    if isinstance(result, float) and not math.isfinite(result):
        raise UnsafeFormulaError("Résultat non fini.")
    return result
