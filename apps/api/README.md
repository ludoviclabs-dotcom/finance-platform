# Finance Platform API

FastAPI backend for the finance analysis platform.

## Setup

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.
Interactive docs at `http://localhost:8000/docs`.

## Endpoints

| Method | Path               | Description                        |
|--------|--------------------|------------------------------------|
| GET    | `/health`          | Health check                       |
| POST   | `/calculate/ma`    | M&A valuation simulation           |
| POST   | `/excel/upload`    | Excel upload (placeholder)         |
| POST   | `/report/generate` | Report generation (placeholder)    |
| GET    | `/clients/`        | Client management (placeholder)    |

## Example — POST `/calculate/ma`

```json
{
  "targetRevenue": 50000000,
  "targetEbitdaMargin": 0.20,
  "entryMultiple": 8,
  "netDebt": 5000000,
  "synergyAmount": 2000000,
  "purchasePremiumPct": 0.30
}
```

Response:

```json
{
  "ebitda": 10000000.0,
  "enterpriseValue": 80000000.0,
  "adjustedEnterpriseValue": 96000000.0,
  "acquisitionPrice": 124800000.0,
  "equityValue": 119800000.0
}
```
