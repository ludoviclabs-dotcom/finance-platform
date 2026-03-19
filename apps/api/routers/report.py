from fastapi import APIRouter

router = APIRouter()


@router.post("/generate")
async def generate_report():
    """Placeholder — PDF/report generation."""
    return {"message": "Report generation not implemented yet"}
