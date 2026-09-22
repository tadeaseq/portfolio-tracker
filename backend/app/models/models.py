import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Float, DateTime, ForeignKey, Enum as SqlEnum
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class BrokerType(str, enum.Enum):
    XTB = "XTB"
    T212 = "T212"
    IBKR = "IBKR"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    broker_accounts = relationship("BrokerAccount", back_populates="user")


class BrokerAccount(Base):
    """One connected broker account (e.g. this user's XTB account, or T212 account)."""
    __tablename__ = "broker_accounts"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    broker_type = Column(SqlEnum(BrokerType), nullable=False)
    display_name = Column(String, nullable=True)  # e.g. "XTB - main"
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="broker_accounts")
    positions = relationship("Position", back_populates="broker_account")
    transactions = relationship("Transaction", back_populates="broker_account")


class Position(Base):
    """Current holding snapshot for one ticker in one broker account."""
    __tablename__ = "positions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    broker_account_id = Column(UUID(as_uuid=False), ForeignKey("broker_accounts.id"), nullable=False)
    ticker = Column(String, nullable=False, index=True)
    quantity = Column(Float, nullable=False)
    avg_buy_price = Column(Float, nullable=False)
    currency = Column(String, nullable=False, default="USD")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    broker_account = relationship("BrokerAccount", back_populates="positions")


class Transaction(Base):
    """Historical buy/sell record - used for performance & tax calculations later."""
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    broker_account_id = Column(UUID(as_uuid=False), ForeignKey("broker_accounts.id"), nullable=False)
    ticker = Column(String, nullable=False, index=True)
    side = Column(String, nullable=False)  # "BUY" or "SELL"
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    currency = Column(String, nullable=False, default="USD")
    fee = Column(Float, default=0.0)
    executed_at = Column(DateTime, nullable=False)

    broker_account = relationship("BrokerAccount", back_populates="transactions")
