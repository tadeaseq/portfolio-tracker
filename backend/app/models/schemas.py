from datetime import datetime
from pydantic import BaseModel


class PositionOut(BaseModel):
    ticker: str
    quantity: float
    avg_buy_price: float
    currency: str
    broker: str  # broker_type as string, resolved in the API layer

    class Config:
        from_attributes = True


class PortfolioSummary(BaseModel):
    """Aggregated view across all connected broker accounts for a user."""
    total_positions: int
    positions: list[PositionOut]
    # later: total_value, allocation_by_ticker, total_fees, etc.


class TransactionOut(BaseModel):
    ticker: str
    side: str
    quantity: float
    price: float
    currency: str
    fee: float
    executed_at: datetime
    broker: str

    class Config:
        from_attributes = True
