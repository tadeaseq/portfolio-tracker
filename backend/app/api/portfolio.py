import shutil
import tempfile
import os

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import BrokerAccount, Position, Transaction, BrokerType
from app.models.schemas import PortfolioSummary, PositionOut
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


@router.post("/upload/t212")
async def upload_t212_csv(
    broker_account_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a Trading212 transaction export CSV. Parses it, stores the raw
    transactions, and recomputes current positions for this broker account.
    """
    account = db.query(BrokerAccount).filter(BrokerAccount.id == broker_account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Broker account not found")
    if account.broker_type != BrokerType.T212:
        raise HTTPException(status_code=400, detail="This broker account is not a T212 account")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        transactions = parse_t212_csv(tmp_path)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    finally:
        os.unlink(tmp_path)

    # store raw transactions
    for tx in transactions:
        db.add(Transaction(
            broker_account_id=broker_account_id,
            ticker=tx.ticker,
            side=tx.side,
            quantity=tx.quantity,
            price=tx.price,
            currency=tx.currency,
            fee=tx.fee,
            executed_at=tx.executed_at,
        ))

    # recompute current positions from the full transaction history
    computed = positions_from_transactions(transactions)

    # wipe old positions for this account and replace with recomputed ones
    db.query(Position).filter(Position.broker_account_id == broker_account_id).delete()
    for ticker, pos in computed.items():
        db.add(Position(
            broker_account_id=broker_account_id,
            ticker=ticker,
            quantity=pos["quantity"],
            avg_buy_price=pos["avg_price"],
            currency=pos["currency"],
        ))

    db.commit()

    return {"imported_transactions": len(transactions), "positions": len(computed)}
