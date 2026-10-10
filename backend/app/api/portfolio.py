import os
import shutil
import tempfile

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import BrokerAccount, BrokerType, Position, Transaction
from app.models.schemas import (
    BrokerAccountOut,
    LotOut,
    PortfolioSummary,
    PositionOut,
    TransactionOut,
)
from app.services.lots import LotMethod, compute_open_lots
from app.services.t212_parser import parse_t212_csv, positions_from_transactions

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("", response_model=PortfolioSummary)
def get_portfolio(db: Session = Depends(get_db)):
    """
    Returns the aggregated portfolio across all broker accounts.
    NOTE: for the MVP this ignores auth/user scoping - add a
    current_user dependency once login is wired up.
    """
    positions = db.query(Position).all()
    out = []
    for p in positions:
        out.append(
            PositionOut(
                ticker=p.ticker,
                quantity=p.quantity,
                avg_buy_price=p.avg_buy_price,
                currency=p.currency,
                broker=p.broker_account.broker_type.value,
            )
        )
    return PortfolioSummary(total_positions=len(out), positions=out)


@router.get("/transactions", response_model=list[TransactionOut])
def get_transactions(db: Session = Depends(get_db)):
    """
    Raw buy/sell history across all broker accounts, newest first.
    Used by the frontend to plot buy markers on the value chart.
    """
    txs = db.query(Transaction).order_by(Transaction.executed_at.desc()).all()
    return [
        TransactionOut(
            ticker=t.ticker,
            side=t.side,
            quantity=t.quantity,
            price=t.price,
            currency=t.currency,
            fee=t.fee,
            executed_at=t.executed_at,
            broker=t.broker_account.broker_type.value,
        )
        for t in txs
    ]


@router.get("/lots", response_model=list[LotOut])
def get_lots(
    method: LotMethod = Query(LotMethod.FIFO, description="Which shares count as sold first"),
    db: Session = Depends(get_db),
):
    """
    Still-open purchase lots, broken out by original buy date, computed by
    matching each broker account's buy/sell history with FIFO or LIFO.

    This powers the holding-period table: knowing WHEN each remaining
    share was bought (not just the weighted average) is what a time-based
    tax exemption test needs.
    """
    accounts = {a.id: a for a in db.query(BrokerAccount).all()}
    txs_by_account: dict[str, list[Transaction]] = {}
    for tx in db.query(Transaction).all():
        txs_by_account.setdefault(tx.broker_account_id, []).append(tx)

    out: list[LotOut] = []
    for account_id, txs in txs_by_account.items():
        account = accounts.get(account_id)
        broker_label = account.broker_type.value if account else "?"
        for lot in compute_open_lots(txs, method):
            out.append(
                LotOut(
                    ticker=lot.ticker,
                    broker=broker_label,
                    quantity=lot.quantity,
                    buy_price=lot.price,
                    currency=lot.currency,
                    bought_at=lot.bought_at,
                )
            )
    return out


@router.get("/accounts", response_model=list[BrokerAccountOut])
def get_accounts(db: Session = Depends(get_db)):
    """Connected broker accounts (the UI needs an id to upload a CSV to)."""
    accounts = db.query(BrokerAccount).order_by(BrokerAccount.created_at).all()
    return [
        BrokerAccountOut(id=a.id, broker=a.broker_type.value, display_name=a.display_name)
        for a in accounts
    ]


@router.post("/upload/t212")
async def upload_t212_csv(
    broker_account_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a Trading212 transaction export CSV. Replaces this account's
    stored transactions with the file's, and recomputes its positions.
    """
    account = (
        db.query(BrokerAccount).filter(BrokerAccount.id == broker_account_id).first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Broker account not found")
    if account.broker_type != BrokerType.T212:
        raise HTTPException(
            status_code=400, detail="This broker account is not a T212 account"
        )

    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        transactions = parse_t212_csv(tmp_path)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    finally:
        os.unlink(tmp_path)

    # The uploaded file is treated as this account's COMPLETE history, so it
    # replaces what was imported before. (Appending would duplicate every
    # trade when the same file is uploaded twice.) Parsing already succeeded
    # above, so a bad file never wipes existing data.
    db.query(Transaction).filter(Transaction.broker_account_id == broker_account_id).delete()

    # store raw transactions
    for tx in transactions:
        db.add(
            Transaction(
                broker_account_id=broker_account_id,
                ticker=tx.ticker,
                side=tx.side,
                quantity=tx.quantity,
                price=tx.price,
                currency=tx.currency,
                fee=tx.fee,
                executed_at=tx.executed_at,
            )
        )

    # recompute current positions from the full transaction history
    computed = positions_from_transactions(transactions)

    # wipe old positions for this account and replace with recomputed ones
    db.query(Position).filter(Position.broker_account_id == broker_account_id).delete()
    for ticker, pos in computed.items():
        db.add(
            Position(
                broker_account_id=broker_account_id,
                ticker=ticker,
                quantity=pos["quantity"],
                avg_buy_price=pos["avg_price"],
                currency=pos["currency"],
            )
        )

    db.commit()

    return {"imported_transactions": len(transactions), "positions": len(computed)}
