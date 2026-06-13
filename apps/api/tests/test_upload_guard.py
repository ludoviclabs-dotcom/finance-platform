"""
test_upload_guard.py — T1.5 : durcissement des uploads Excel.
"""

from __future__ import annotations

import io
import zipfile

import pytest
from fastapi import HTTPException
from openpyxl import Workbook

import utils.upload_guard as ug
from utils.upload_guard import check_upload_bytes


def _valid_xlsx_bytes() -> bytes:
    wb = Workbook()
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_valid_xlsx_passes():
    check_upload_bytes(_valid_xlsx_bytes(), "ok.xlsx")  # ne lève pas


def test_empty_rejected():
    with pytest.raises(HTTPException) as e:
        check_upload_bytes(b"", "x.xlsx")
    assert e.value.status_code == 400


def test_bad_magic_rejected():
    with pytest.raises(HTTPException) as e:
        check_upload_bytes(b"not a zip at all", "fake.xlsx")
    assert e.value.status_code == 400


def test_oversize_rejected():
    big = b"x" * (ug.MAX_UPLOAD_BYTES + 1)
    with pytest.raises(HTTPException) as e:
        check_upload_bytes(big, "big.xlsx")
    assert e.value.status_code == 413


def test_too_many_sheets_rejected():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for i in range(ug.MAX_SHEETS + 1):
            z.writestr(f"xl/worksheets/sheet{i}.xml", "<x/>")
    with pytest.raises(HTTPException) as e:
        check_upload_bytes(buf.getvalue(), "many.xlsx")
    assert e.value.status_code == 400


def test_zip_bomb_uncompressed_rejected(monkeypatch):
    monkeypatch.setattr(ug, "MAX_UNCOMPRESSED_BYTES", 1024 * 1024)  # 1 Mo
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("xl/worksheets/sheet1.xml", "0" * (3 * 1024 * 1024))  # 3 Mo décompressés
    with pytest.raises(HTTPException) as e:
        check_upload_bytes(buf.getvalue(), "bomb.xlsx")
    assert e.value.status_code == 400
