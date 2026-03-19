from models.ma import MAInput, MAOutput


def compute_ma(data: MAInput) -> MAOutput:
    """Core M&A valuation logic.

    Steps:
    1. EBITDA = revenue × margin
    2. Enterprise Value = EBITDA × entry multiple
    3. Adjusted EV = EV + capitalised synergies (same multiple)
    4. Acquisition Price = Adjusted EV × (1 + premium)
    5. Equity Value = Acquisition Price − net debt
    """
    ebitda = data.targetRevenue * data.targetEbitdaMargin
    enterprise_value = ebitda * data.entryMultiple
    adjusted_ev = enterprise_value + (data.synergyAmount * data.entryMultiple)
    acquisition_price = adjusted_ev * (1 + data.purchasePremiumPct)
    equity_value = acquisition_price - data.netDebt

    return MAOutput(
        ebitda=round(ebitda, 2),
        enterpriseValue=round(enterprise_value, 2),
        adjustedEnterpriseValue=round(adjusted_ev, 2),
        acquisitionPrice=round(acquisition_price, 2),
        equityValue=round(equity_value, 2),
    )
