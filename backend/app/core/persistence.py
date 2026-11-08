import os
from datetime import date, datetime, time, timezone

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Time,
    Text,
    create_engine,
    inspect,
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
    currency_code: Mapped[str | None] = mapped_column(String(3), nullable=True)
    source_format: Mapped[str] = mapped_column(String(40), default="coffee_shop_sales")
    amount_source: Mapped[str] = mapped_column(String(40), default="unit_price_x_quantity")
    quality_report: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_sample: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class SaleRecord(Base):
    __tablename__ = "sales_records"
    __table_args__ = (
        Index("ix_sales_dataset_date", "dataset_id", "transaction_date"),
        Index("ix_sales_dataset_location", "dataset_id", "store_location"),
        Index("ix_sales_dataset_category", "dataset_id", "product_category"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"))
    transaction_id: Mapped[str] = mapped_column(String(120))
    transaction_date: Mapped[date] = mapped_column(Date)
    transaction_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    transaction_qty: Mapped[int] = mapped_column(Integer)
    store_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    store_location: Mapped[str | None] = mapped_column(String(160), nullable=True)
    product_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    unit_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    line_revenue: Mapped[float | None] = mapped_column(Float, nullable=True)
    product_category: Mapped[str] = mapped_column(String(160))
    product_type: Mapped[str | None] = mapped_column(String(200), nullable=True)
    product_detail: Mapped[str] = mapped_column(String(300))
    source_attributes: Mapped[dict | None] = mapped_column(JSON, nullable=True)


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
    migrate_existing_schema()
    seed_sample_dataset()
    return True


def migrate_existing_schema():
    if engine is None or engine.dialect.name != "postgresql":
        return
    inspector = inspect(engine)
    dataset_columns = {column["name"] for column in inspector.get_columns("datasets")}
    sales_columns = {
        column["name"] for column in inspector.get_columns("sales_records")
    }
    with engine.begin() as connection:
        if "source_format" not in dataset_columns:
            connection.exec_driver_sql(
                "ALTER TABLE datasets ADD COLUMN source_format VARCHAR(40) "
                "NOT NULL DEFAULT 'coffee_shop_sales'"
            )
        if "amount_source" not in dataset_columns:
            connection.exec_driver_sql(
                "ALTER TABLE datasets ADD COLUMN amount_source VARCHAR(40) "
                "NOT NULL DEFAULT 'unit_price_x_quantity'"
            )
        if "quality_report" not in dataset_columns:
            connection.exec_driver_sql(
                "ALTER TABLE datasets ADD COLUMN quality_report TEXT"
            )
        if "line_revenue" not in sales_columns:
            connection.exec_driver_sql(
                "ALTER TABLE sales_records ADD COLUMN line_revenue DOUBLE PRECISION"
            )
            connection.exec_driver_sql(
                "UPDATE sales_records SET line_revenue = transaction_qty * unit_price"
            )
        if "source_attributes" not in sales_columns:
            connection.exec_driver_sql(
                "ALTER TABLE sales_records ADD COLUMN source_attributes JSON"
            )
        connection.exec_driver_sql(
            "ALTER TABLE sales_records ALTER COLUMN transaction_id TYPE VARCHAR(120) "
            "USING transaction_id::text"
        )
        for column in ("transaction_time", "store_id", "store_location", "product_id", "unit_price"):
            connection.exec_driver_sql(
                f"ALTER TABLE sales_records ALTER COLUMN {column} DROP NOT NULL"
            )
        for column in ("store_id", "product_id"):
            connection.exec_driver_sql(
                f"ALTER TABLE sales_records ALTER COLUMN {column} TYPE VARCHAR(120) "
                f"USING {column}::text"
            )
        connection.exec_driver_sql(
            "ALTER TABLE datasets ALTER COLUMN currency_code DROP NOT NULL"
        )
        unique_constraints = connection.exec_driver_sql(
            """
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_schema = current_schema()
              AND table_name = 'sales_records'
              AND constraint_type = 'UNIQUE'
            """
        ).scalars().all()
        for constraint_name in unique_constraints:
            columns = connection.exec_driver_sql(
                """
                SELECT column_name
                FROM information_schema.key_column_usage
                WHERE table_schema = current_schema()
                  AND table_name = 'sales_records'
                  AND constraint_name = %s
                ORDER BY ordinal_position
                """,
                (constraint_name,),
            ).scalars().all()
            if set(columns) == {"dataset_id", "transaction_id"}:
                escaped_name = constraint_name.replace('"', '""')
                connection.exec_driver_sql(
                    f'ALTER TABLE sales_records DROP CONSTRAINT "{escaped_name}"'
                )


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
                        "transaction_id": row["transaction_id"].strip(),
                        "transaction_date": sale_date,
                        "transaction_time": sale_time,
                        "transaction_qty": int(row["transaction_qty"]),
                        "store_id": str(row["store_id"]),
                        "store_location": row["store_location"].strip(),
                        "product_id": str(row["product_id"]),
                        "unit_price": float(row["unit_price"]),
                        "line_revenue": int(row["transaction_qty"])
                        * float(row["unit_price"]),
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
