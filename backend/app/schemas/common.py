from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    success: bool = Field(..., description="Whether the service is healthy")
    message: str = Field(..., description="Human-readable status message")
