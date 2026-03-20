from pydantic import BaseModel, Field


class MAInput(BaseModel):
    """Input payload for M&A valuation simulation."""

    targetRevenue: float = Field(..., gt=0, description="Target company revenue")
    targetEbitdaMargin: float = Field(
        ..., ge=0, le=1, description="EBITDA margin as a decimal (e.g. 0.20 for 20%)"
    )
    entryMultiple: float = Field(..., gt=0, description="EV/EBITDA entry multiple")
    netDebt: float = Field(..., description="Target net debt (positive = debt)")
    synergyAmount: float = Field(
        default=0, ge=0, description="Expected annual synergies"
    )
    purchasePremiumPct: float = Field(
        default=0, ge=0, le=1, description="Purchase premium as a decimal (e.g. 0.30 for 30%)"
    )


class MAOutput(BaseModel):
    """Output of the M&A valuation simulation."""

    ebitda: float = Field(..., description="Calculated EBITDA")
    enterpriseValue: float = Field(..., description="Enterprise Value (EV)")
    adjustedEnterpriseValue: float = Field(
        ..., description="EV adjusted for synergies"
    )
    acquisitionPrice: float = Field(
        ..., description="Acquisition price including premium"
    )
    equityValue: float = Field(..., description="Equity value (EV minus net debt)")
