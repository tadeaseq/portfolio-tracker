"""
Parser for Trading212 transaction history CSV exports.

T212 lets users export their full transaction history as CSV from the app
(Settings -> Documents -> Export). Column names below match T212's export
format as of 2025/2026 - if T212 changes their export format, only this
file needs to change (that's the point of keeping brokers isolated in
their own service module).

Expected columns in a T212 export (may vary slightly by account type):
    Action, Time, ISIN, Ticker, Name, No. of shares, Price / share,
    Currency (Price / share), Exchange rate, Total, Currency (Total),
    Fees, Currency (Fees) ...

We only pull the columns we actually need for the MVP.
"""

import pandas as pd
from datetime import datetime
from dataclasses import dataclass


@dataclass
class ParsedTransaction:
    ticker: str
    side: str  # "BUY" or "SELL"
    quantity: float
    price: float
    currency: str
    fee: float
    executed_at: datetime


def parse_t212_csv(file_path: str) -> list[ParsedTransaction]:
    """
    Reads a T212 export CSV and returns a normalized list of transactions.
    Raises ValueError if expected columns are missing (export format changed).
    """
    df = pd.read_csv(file_path)

    required_cols = {"Action", "Time", "Ticker", "No. of shares", "Price / share"}
    missing = required_cols - set(df.columns)
    if missing:
        raise ValueError(
            f"T212 CSV is missing expected columns: {missing}. "
            "Trading212 may have changed their export format."
        )

    transactions: list[ParsedTransaction] = []

    for _, row in df.iterrows():
        action = str(row["Action"]).strip().lower()

        # T212 exports include dividends, deposits, interest etc. too -
        # for the MVP we only care about actual buy/sell trades.
        if "buy" in action:
            side = "BUY"
        elif "sell" in action:
            side = "SELL"
        else:
            continue

        fee = 0.0
        for fee_col in ("Fees", "Transaction fee", "Currency conversion fee"):
            if fee_col in df.columns and not pd.isna(row.get(fee_col)):
                fee += float(row[fee_col])

        currency = row.get("Currency (Price / share)", "USD")
        if pd.isna(currency):
            currency = "USD"

        transactions.append(
            ParsedTransaction(
                ticker=str(row["Ticker"]).strip(),
                side=side,
                quantity=float(row["No. of shares"]),
                price=float(row["Price / share"]),
                currency=str(currency),
                fee=fee,
                executed_at=pd.to_datetime(row["Time"]).to_pydatetime(),
            )
        )

    return transactions


def positions_from_transactions(transactions: list[ParsedTransaction]) -> dict:
    """
    Collapses a transaction history into current positions per ticker,
    using a simple weighted-average cost basis. Good enough for the MVP;
    swap for FIFO later if you need accurate tax reporting.
    """
    positions: dict[str, dict] = {}

    for tx in sorted(transactions, key=lambda t: t.executed_at):
        pos = positions.setdefault(
            tx.ticker, {"quantity": 0.0, "avg_price": 0.0, "currency": tx.currency}
        )

        if tx.side == "BUY":
            total_cost = pos["quantity"] * pos["avg_price"] + tx.quantity * tx.price
            pos["quantity"] += tx.quantity
            pos["avg_price"] = total_cost / pos["quantity"] if pos["quantity"] else 0.0
        else:  # SELL
            pos["quantity"] -= tx.quantity
            # average cost basis is left unchanged on a sell

    # drop tickers fully sold off
    return {k: v for k, v in positions.items() if v["quantity"] > 1e-9}
