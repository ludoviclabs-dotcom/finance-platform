from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_clients():
    """Placeholder — List all clients."""
    return {"message": "Client management not implemented yet"}
