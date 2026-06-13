"""
test_excel_sanitize.py — T1.5 : neutralisation de l'injection de formule.
"""

from __future__ import annotations

import pytest

from utils.excel_sanitize import sanitize_cell


@pytest.mark.parametrize("dangerous", [
    "=HYPERLINK(\"http://evil\",\"x\")",
    "+1+1",
    "-2+3",
    "@SUM(A1:A9)",
    "\tTAB",
    "\rCR",
])
def test_dangerous_prefixed(dangerous):
    out = sanitize_cell(dangerous)
    assert out == "'" + dangerous


@pytest.mark.parametrize("safe", ["normal", "ESRS E1", "12,5 tCO2e", "a=b"])
def test_safe_unchanged(safe):
    assert sanitize_cell(safe) == safe


def test_non_strings_unchanged():
    assert sanitize_cell(123) == 123
    assert sanitize_cell(12.5) == 12.5
    assert sanitize_cell(None) is None
