# Portfolio Tracker (MVP skeleton)

Cross-broker portfolio tracking - aggregates positions from XTB (API) and
Trading212 (CSV import) into one dashboard.

## Backend (FastAPI)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

You'll need a PostgreSQL database running. Either:
- Spin one up locally, or
- Use a free hosted one from [Supabase](https://supabase.com) or [Neon](https://neon.tech)

Set the connection string as an environment variable (or in `backend/.env`):

```
DATABASE_URL=postgresql://user:password@localhost:5432/portfolio_tracker
```

Then run the API:

```bash
uvicorn app.main:app --reload
```

API will be live at `http://localhost:8000`. Interactive docs at
`http://localhost:8000/docs` (FastAPI generates these automatically -
very useful for testing the upload endpoint without a frontend).

### Testing the T212 CSV upload without a frontend

1. Insert a `User` and a `BrokerAccount` (broker_type=T212) manually via
   the `/docs` UI or a DB client, note the broker_account_id.
2. `POST /portfolio/upload/t212?broker_account_id=<id>` with your T212
   CSV export as the `file` field.
3. `GET /portfolio` to see the aggregated positions.

## Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:3000`. Expects the backend at
`http://localhost:8000` by default (override with `NEXT_PUBLIC_API_URL`
in a `.env.local` file if needed).

## What's here vs. what's still missing

Included:
- DB models: User, BrokerAccount, Position, Transaction
- T212 CSV parser + position aggregation (weighted avg cost)
- XTB WebSocket API client stub (login + get open positions)
- `/portfolio` endpoint (aggregated view) and `/portfolio/upload/t212`
- Minimal Next.js dashboard that renders the aggregated table

Not yet built (next steps, roughly in priority order):
1. Auth (no login system yet - `/portfolio` returns everyone's positions)
2. Wiring the XTB client into an actual endpoint + storing XTB positions
   as `Position` rows (same shape as T212's)
3. A UI to create/manage BrokerAccount records and upload files
4. Alembic migrations instead of `create_all` (fine for now, not for prod)
5. IBKR integration
6. Fees, performance, and tax-reporting views
