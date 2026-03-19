from fastapi import APIRouter

from models.ma import MAInput, MAOutput
from services.ma_service import compute_ma

router = APIRouter()


@router.post("/ma", response_model=MAOutput)
async def calculate_ma(payload: MAInput):
    """Run an M&A valuation simulation."""
    return compute_ma(payload)
