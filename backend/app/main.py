from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import portfolio
from app.core.database import Base, engine

# creates tables if they don't exist yet - fine for MVP,
# switch to Alembic migrations once the schema stabilizes
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Portfolio Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(portfolio.router)


@app.get("/health")
def health():
    return {"status": "ok"}
