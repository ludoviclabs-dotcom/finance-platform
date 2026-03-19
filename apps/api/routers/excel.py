from fastapi import APIRouter

router = APIRouter()


@router.post("/upload")
async def upload_excel():
    """Placeholder — Excel file upload and parsing."""
    return {"message": "Excel upload not implemented yet"}
