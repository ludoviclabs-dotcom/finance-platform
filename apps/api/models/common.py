from pydantic import BaseModel


class StatusResponse(BaseModel):
    """Generic status response reusable across endpoints."""
    status: str
    message: str
