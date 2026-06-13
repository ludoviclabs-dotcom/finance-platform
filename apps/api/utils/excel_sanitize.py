"""
excel_sanitize.py — Neutralisation de l'injection de formule (T1.5).

Toute cellule de chaîne commençant par `=`, `+`, `-`, `@`, TAB ou CR peut être
interprétée comme une formule par Excel/Sheets/LibreOffice à l'ouverture d'un
export. On préfixe un apostrophe `'` pour forcer le mode texte.

À appliquer sur TOUTES les valeurs texte écrites dans un export Excel/CSV.
"""

from __future__ import annotations

from typing import Any

_DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def sanitize_cell(value: Any) -> Any:
    """Préfixe `'` si la valeur est une chaîne commençant par un caractère
    déclencheur de formule. Les non-chaînes (nombres, dates, None) sont rendues
    telles quelles."""
    if isinstance(value, str) and value and value[0] in _DANGEROUS_PREFIXES:
        return "'" + value
    return value
