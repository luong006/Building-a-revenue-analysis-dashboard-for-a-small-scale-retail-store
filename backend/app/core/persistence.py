import os
from datetime import date, datetime, time, timezone

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Time,
    UniqueConstraint,
    create_engine,
    insert,
    select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.core.config import DATA_PATH


DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgresql://", "postgresql+psycopg://", 1
    )


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    row_count: Mapped[int] = mapped_column(Integer)
    first_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    currency_code: Mapped[str] = mapped_column(String(3), default="USD")
    is_sample: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class SaleRecord(Base):
    __tablename__ = "sales_records"
    __table_args__ = (
        UniqueConstraint("dataset_id", "transaction_id"),
        Index("ix_sales_dataset_date", "dataset_id", "transaction_date"),
        Index("ix_sales_dataset_location", "dataset_id", "store_location"),
        Index("ix_sales_dataset_category", "dataset_id", "product_category"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"))
    transaction_id: Mapped[int]
    transaction_date: Mapped[date] = mapped_column(Date)
    transaction_time: Mapped[time] = mapped_column(Time)
    transaction_qty: Mapped[int] = mapped_column(Integer)
    store_id: Mapped[int]
    store_location: Mapped[str] = mapped_column(String(160))
    product_id: Mapped[int]
    unit_price: Mapped[float] = mapped_column(Float)
    product_category: Mapped[str] = mapped_column(String(160))
    product_type: Mapped[str] = mapped_column(String(200))
    product_detail: Mapped[str] = mapped_column(String(300))


engine = (
    create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)
    if DATABASE_URL
    else None
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False) if engine else None


def initialize_database():
    if engine is None:
        return False
    Base.metadata.create_all(engine)
    seed_sample_dataset()
    return True


def seed_sample_dataset():
    if engine is None or not DATA_PATH.is_file():
        return
    with SessionLocal() as session:
        existing = session.scalar(select(Dataset.id).where(Dataset.is_sample.is_(True)))
        if existing:
            return

        dataset = Dataset(
            owner_id=None,
            name="Coffee Shop Sales (Mẫu)",
            row_count=0,
            first_date=None,
            last_date=None,
            currency_code="USD",
            is_sample=True,
        )
        session.add(dataset)
        session.flush()

        import csv
        records = []
        row_count = 0
        first_date = None
        last_date = None
        with DATA_PATH.open(newline="", encoding="utf-8-sig") as file:
            reader = csv.DictReader(file)
            for row in reader:
                sale_date = date.fromisoformat(row["transaction_date"])
                sale_time = time.fromisoformat(row["transaction_time"])
                first_date = min(first_date, sale_date) if first_date else sale_date
                last_date = max(last_date, sale_date) if last_date else sale_date
                records.append(
                    {
                        "transaction_id": int(row["transaction_id"]),
                        "transaction_date": sale_date,
                        "transaction_time": sale_time,
                        "transaction_qty": int(row["transaction_qty"]),
                        "store_id": int(row["store_id"]),
                        "store_location": row["store_location"].strip(),
                        "product_id": int(row["product_id"]),
                        "unit_price": float(row["unit_price"]),
                        "product_category": row["product_category"].strip(),
                        "product_type": row["product_type"].strip(),
                        "product_detail": row["product_detail"].strip(),
                    }
                )
                row_count += 1
                if len(records) == 2000:
                    session.execute(
                        insert(SaleRecord),
                        [{"dataset_id": dataset.id, **record} for record in records],
                    )
                    records.clear()
        if records:
            session.execute(
                insert(SaleRecord),
                [{"dataset_id": dataset.id, **record} for record in records],
            )
        dataset.row_count = row_count
        dataset.first_date = first_date
        dataset.last_date = last_date
        if not row_count:
            session.rollback()
            return
        session.commit()
