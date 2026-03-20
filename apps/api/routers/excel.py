"""Routes for Excel file upload and parsing."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File

from utils.excel_reader import (
    CorruptFileError,
    ExcelReader,
    InvalidRangeError,
    SheetNotFoundError,
)

router = APIRouter()

# Allowed MIME types for Excel files
_EXCEL_MIMES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # .xlsx
    "application/vnd.ms-excel",  # .xls (best-effort)
}


@router.post("/upload")
async def upload_excel(
    file: UploadFile = File(..., description="Excel file (.xlsx)"),
) -> dict[str, Any]:
    """Upload an Excel file and return metadata (sheet names, dimensions).

    Returns a JSON payload like::

        {
            "filename": "report.xlsx",
            "sheets": ["Sheet1", "Summary"],
            "sheet_count": 2
        }
    """
    # --- Validate content type (lenient: some clients send generic types) ---
    if file.content_type and file.content_type not in _EXCEL_MIMES:
        if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid file type '{file.content_type}'. "
                    "Please upload an Excel file (.xlsx)."
                ),
            )

    try:
        reader = await ExcelReader.from_upload(file)
    except CorruptFileError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    sheets = reader.sheet_names
    reader.close()

    return {
        "filename": file.filename,
        "sheets": sheets,
        "sheet_count": len(sheets),
    }


@router.post("/read-cell")
async def read_cell(
    file: UploadFile = File(...),
    sheet: str = "Sheet1",
    cell: str = "A1",
) -> dict[str, Any]:
    """Read a single cell value from the uploaded Excel file.

    Query params:
        sheet: Name of the worksheet (default ``Sheet1``).
        cell:  Cell reference, e.g. ``B4``.
    """
    try:
        reader = await ExcelReader.from_upload(file)
        value = reader.get_cell(sheet, cell)
    except CorruptFileError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except SheetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidRangeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        try:
            reader.close()
        except Exception:
            pass

    return {"sheet": sheet, "cell": cell, "value": value}


@router.post("/read-range")
async def read_range(
    file: UploadFile = File(...),
    sheet: str = "Sheet1",
    range_str: str = "A1:D10",
) -> dict[str, Any]:
    """Read a rectangular range from the uploaded Excel file.

    The first row of the range is used as column headers.  Subsequent
    rows are returned as a list of ``{header: value}`` dictionaries.

    Query params:
        sheet:     Name of the worksheet (default ``Sheet1``).
        range_str: Cell range, e.g. ``A1:D10``.
    """
    try:
        reader = await ExcelReader.from_upload(file)
        data = reader.get_range_as_dicts(sheet, range_str)
    except CorruptFileError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except SheetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidRangeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        try:
            reader.close()
        except Exception:
            pass

    return {"sheet": sheet, "range": range_str, "row_count": len(data), "data": data}
