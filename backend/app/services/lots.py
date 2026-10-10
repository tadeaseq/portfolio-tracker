"""
Lot matching: turns a chronological buy/sell transaction history into the
still-open "lots" (individual purchase batches) per ticker, using either
FIFO or LIFO to decide which shares a past sell consumed first.

This is needed for holding-period / tax-lot reporting, where the backend's
aggregated `Position` (just quantity + weighted avg price) isn't enough -
you need to know WHEN each remaining share was bought.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class LotMethod(str, Enum):
    FIFO = "fifo"
    LIFO = "lifo"


@dataclass
class Lot:
    ticker: str
    quantity: float
    price: float
    currency: str
    bought_at: datetime


def compute_open_lots(transactions: list, method: LotMethod) -> list[Lot]:
    """
    `transactions` must be objects/rows with: ticker, side ("BUY"/"SELL"),
    quantity, price, currency, executed_at - already scoped to ONE broker
    account (lots shouldn't be matched across different brokers).

    FIFO consumes the oldest open lot first on a sell; LIFO consumes the
    most recently opened lot first. Each lot keeps its own original
    `bought_at`, even if it's partially consumed by a later sell.
    """
    by_ticker: dict[str, list[Lot]] = {}

    for tx in sorted(transactions, key=lambda t: t.executed_at):
        lots = by_ticker.setdefault(tx.ticker, [])
        if tx.side == "BUY":
            lots.append(Lot(tx.ticker, tx.quantity, tx.price, tx.currency, tx.executed_at))
            continue

        # SELL - consume open lots per the chosen method
        remaining = tx.quantity
        while remaining > 1e-9 and lots:
            idx = 0 if method == LotMethod.FIFO else -1
            lot = lots[idx]
            if lot.quantity <= remaining + 1e-9:
                remaining -= lot.quantity
                lots.pop(idx)
            else:
                lot.quantity -= remaining
                remaining = 0.0

    open_lots: list[Lot] = []
    for lots in by_ticker.values():
        open_lots.extend(lot for lot in lots if lot.quantity > 1e-9)
    return open_lots
