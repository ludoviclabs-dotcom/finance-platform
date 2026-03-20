from fastapi import APIRouter

router = APIRouter()


@router.get("/health", tags=["health"])
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "ok",
        "service": "finance-platform-api",
    }
