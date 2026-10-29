import csv
import io
import math
import re
from datetime import date, datetime, time, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import distinct, extract, func, insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import (
    JWT_SECRET,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.core.cache import cache_key, get_cached_json, set_cached_json
from app.core.config import CURRENCY_CODE
from app.core.persistence import Dataset, SaleRecord, SessionLocal, User


router = APIRouter(prefix="/api", tags=["Accounts and datasets"])
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_UPLOAD_ROWS = 250_000
REQUIRED_COLUMNS = {
    "transaction_id",
    "transaction_date",
    "transaction_time",
    "transaction_qty",
    "store_id",
    "store_location",
    "product_id",
    "unit_price",
    "product_category",
    "product_type",
    "product_detail",
}


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=12, max_length=256)


def require_database():
    if SessionLocal is None:
        raise HTTPException(
            status_code=503,
            detail="PostgreSQL chưa được cấu hình. Hãy thêm DATABASE_URL trên Render.",
        )
    if not JWT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Xác thực chưa sẵn sàng. Hãy cấu hình JWT_SECRET trên Render.",
        )


def db_session():
    require_database()
    with SessionLocal() as session:
        yield session


def user_payload(user: User):
    return {"id": user.id, "email": user.email}


def auth_response(user: User):
    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "user": user_payload(user),
    }


@router.post("/auth/register", status_code=201)
def register(payload: Credentials, session: Session = Depends(db_session)):
    email = payload.email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=422, detail="Email không hợp lệ.")
    if len(set(payload.password)) < 4:
        raise HTTPException(
            status_code=422, detail="Mật khẩu cần đa dạng ký tự hơn."
        )
    user = User(email=email, password_hash=hash_password(payload.password))
    session.add(user)
    try:
        session.commit()
        session.refresh(user)
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(status_code=409, detail="Email này đã được đăng ký.") from error
    return auth_response(user)


@router.post("/auth/login")
def login(payload: Credentials, session: Session = Depends(db_session)):
    email = payload.email.strip().lower()
    user = session.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng.")
    return auth_response(user)


@router.get("/auth/me")
def get_me(user: User = Depends(get_current_user)):
    return user_payload(user)


def dataset_payload(dataset: Dataset):
    return {
        "id": dataset.id,
        "name": dataset.name,
        "row_count": dataset.row_count,
        "first_date": dataset.first_date.isoformat() if dataset.first_date else None,
        "last_date": dataset.last_date.isoformat() if dataset.last_date else None,
        "currency_code": dataset.currency_code,
        "is_sample": dataset.is_sample,
        "created_at": dataset.created_at.isoformat(),
    }


def get_visible_dataset(session: Session, dataset_id: int, user: User) -> Dataset:
    dataset = session.get(Dataset, dataset_id)
    if dataset is None or (
        not dataset.is_sample and dataset.owner_id != user.id
    ):
        raise HTTPException(status_code=404, detail="Không tìm thấy dataset.")
    return dataset


@router.get("/datasets")
def list_datasets(
    session: Session = Depends(db_session), user: User = Depends(get_current_user)
):
    datasets = session.scalars(
        select(Dataset)
        .where((Dataset.is_sample.is_(True)) | (Dataset.owner_id == user.id))
        .order_by(Dataset.is_sample.desc(), Dataset.created_at.desc())
    ).all()
    return [dataset_payload(dataset) for dataset in datasets]


def parse_date(value: str) -> date:
    value = (value or "").strip()
    for pattern in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(value, pattern).date()
        except ValueError:
            continue
    raise ValueError("ngày không đúng định dạng")


def parse_time(value: str) -> time:
    value = (value or "").strip()
    try:
        return time.fromisoformat(value)
    except ValueError:
        for pattern in ("%I:%M %p", "%I:%M:%S %p"):
            try:
                return datetime.strptime(value, pattern).time()
            except ValueError:
                continue
    raise ValueError("giờ không đúng định dạng")


def parse_csv(contents: bytes):
    try:
        text = contents.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise HTTPException(
            status_code=422, detail="CSV phải được mã hóa UTF-8."
        ) from error
    reader = csv.DictReader(io.StringIO(text))
    headers = set(reader.fieldnames or [])
    missing = REQUIRED_COLUMNS - headers
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"CSV thiếu cột bắt buộc: {', '.join(sorted(missing))}.",
        )

    records = []
    seen_ids = set()
    first_date = None
    last_date = None
    for line_number, row in enumerate(reader, start=2):
        if line_number > MAX_UPLOAD_ROWS + 1:
            raise HTTPException(
                status_code=413,
                detail=f"CSV vượt giới hạn {MAX_UPLOAD_ROWS:,} dòng.",
            )
        try:
            transaction_id = int(row["transaction_id"])
            sale_date = parse_date(row["transaction_date"])
            sale_time = parse_time(row["transaction_time"])
            quantity = int(row["transaction_qty"])
            store_id = int(row["store_id"])
            product_id = int(row["product_id"])
            unit_price = Decimal((row.get("unit_price") or "").strip())
            price_value = float(unit_price)
            location = (row.get("store_location") or "").strip()
            category = (row.get("product_category") or "").strip()
            product_type = (row.get("product_type") or "").strip()
            product_detail = (row["product_detail"] or "").strip()
            if (
                transaction_id in seen_ids
                or transaction_id < 0
                or quantity <= 0
                or store_id < 0
                or product_id < 0
                or not unit_price.is_finite()
                or not math.isfinite(price_value)
                or unit_price < 0
                or not location
                or not category
                or not product_type
                or not (product_detail or product_type)
                or len(location) > 160
                or len(category) > 160
                or len(product_type) > 200
                or len(product_detail) > 300
            ):
                raise ValueError("dữ liệu không hợp lệ hoặc mã giao dịch bị trùng")
        except (ValueError, TypeError, InvalidOperation, KeyError) as error:
            raise HTTPException(
                status_code=422,
                detail=f"Dòng {line_number} không hợp lệ ({error}).",
            ) from error
        seen_ids.add(transaction_id)
        first_date = min(first_date, sale_date) if first_date else sale_date
        last_date = max(last_date, sale_date) if last_date else sale_date
        records.append(
            {
                "transaction_id": transaction_id,
                "transaction_date": sale_date,
                "transaction_time": sale_time,
                "transaction_qty": quantity,
                "store_id": store_id,
                "store_location": location,
                "product_id": product_id,
                "unit_price": price_value,
                "product_category": category,
                "product_type": product_type,
                "product_detail": product_detail,
            }
        )
    if not records:
        raise HTTPException(status_code=422, detail="CSV không có dòng dữ liệu.")
    return records, first_date, last_date


@router.post("/datasets/upload", status_code=201)
async def upload_dataset(
    file: UploadFile = File(...),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    if Path(file.filename or "").suffix.lower() != ".csv":
        raise HTTPException(status_code=415, detail="Chỉ hỗ trợ file .csv.")
    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413, detail="File vượt giới hạn tải lên 25 MB."
        )
    records, first_date, last_date = parse_csv(contents)
    clean_name = Path(file.filename or "dataset.csv").stem.strip()[:120]
    dataset = Dataset(
        owner_id=user.id,
        name=clean_name or "Dataset mới",
        row_count=len(records),
        first_date=first_date,
        last_date=last_date,
        currency_code=CURRENCY_CODE or "USD",
        is_sample=False,
    )
    session.add(dataset)
    session.flush()
    for start in range(0, len(records), 2000):
        session.execute(
            insert(SaleRecord),
            [
                {"dataset_id": dataset.id, **record}
                for record in records[start : start + 2000]
            ],
        )
    session.commit()
    session.refresh(dataset)
    return dataset_payload(dataset)


def filter_conditions(dataset_id, location, category, start_date, end_date):
    conditions = [SaleRecord.dataset_id == dataset_id]
    if location:
        conditions.append(SaleRecord.store_location == location)
    if category:
        conditions.append(SaleRecord.product_category == category)
    if start_date:
        conditions.append(SaleRecord.transaction_date >= start_date)
    if end_date:
        conditions.append(SaleRecord.transaction_date <= end_date)
    return conditions


def summary_for(session, conditions):
    revenue = func.coalesce(
        func.sum(SaleRecord.transaction_qty * SaleRecord.unit_price), 0
    )
    transactions = func.count(distinct(SaleRecord.transaction_id))
    quantity = func.coalesce(func.sum(SaleRecord.transaction_qty), 0)
    row = session.execute(
        select(revenue, transactions, quantity).where(*conditions)
    ).one()
    total_revenue, total_transactions, total_items = (
        float(row[0]),
        int(row[1]),
        int(row[2]),
    )
    return {
        "total_revenue": round(total_revenue, 2),
        "total_transactions": total_transactions,
        "total_items_sold": total_items,
        "aov": round(total_revenue / total_transactions, 2) if total_transactions else 0,
        "upt": round(total_items / total_transactions, 2) if total_transactions else 0,
        "asp": round(total_revenue / total_items, 2) if total_items else 0,
    }


def dashboard_data(session, dataset, filters):
    base = filter_conditions(
        dataset.id,
        filters["location"],
        filters["category"],
        filters["start_date"],
        filters["end_date"],
    )
    total = SaleRecord.transaction_qty * SaleRecord.unit_price
    summary = summary_for(session, base)

    locations = session.scalars(
        select(SaleRecord.store_location)
        .distinct()
        .where(SaleRecord.dataset_id == dataset.id)
        .order_by(SaleRecord.store_location)
    ).all()
    categories = session.scalars(
        select(SaleRecord.product_category)
        .distinct()
        .where(SaleRecord.dataset_id == dataset.id)
        .order_by(SaleRecord.product_category)
    ).all()

    hourly_rows = session.execute(
        select(
            extract("hour", SaleRecord.transaction_time).label("hour"),
            func.sum(total),
            func.count(distinct(SaleRecord.transaction_id)),
            func.sum(SaleRecord.transaction_qty),
        )
        .where(*base)
        .group_by("hour")
        .order_by("hour")
    ).all()
    hourly = [
        {
            "hour": int(row[0]),
            "label": f"{int(row[0]):02d}:00",
            "revenue": round(float(row[1] or 0), 2),
            "transactions": int(row[2]),
            "items_sold": int(row[3]),
        }
        for row in hourly_rows
    ]

    trend_period = func.date_trunc(filters["granularity"], SaleRecord.transaction_date)
    trend_rows = session.execute(
        select(
            trend_period.label("period"),
            func.sum(total),
            func.count(distinct(SaleRecord.transaction_id)),
            func.sum(SaleRecord.transaction_qty),
        )
        .where(*base)
        .group_by("period")
        .order_by("period")
    ).all()
    trend = [
        {
            "period": (
                row[0].date().isoformat()
                if isinstance(row[0], datetime)
                else str(row[0])[:10]
            ),
            "revenue": round(float(row[1] or 0), 2),
            "transactions": int(row[2]),
            "items_sold": int(row[3]),
        }
        for row in trend_rows
    ]
    daily_rows = session.execute(
        select(
            SaleRecord.transaction_date,
            func.sum(total),
            func.count(distinct(SaleRecord.transaction_id)),
            func.sum(SaleRecord.transaction_qty),
        )
        .where(*base)
        .group_by(SaleRecord.transaction_date)
        .order_by(SaleRecord.transaction_date)
    ).all()
    daily_trend = [
        {
            "period": row[0].isoformat(),
            "revenue": round(float(row[1] or 0), 2),
            "transactions": int(row[2]),
            "items_sold": int(row[3]),
        }
        for row in daily_rows
    ]

    product_rows = session.execute(
        select(
            SaleRecord.product_detail,
            SaleRecord.product_type,
            SaleRecord.product_category,
            func.sum(SaleRecord.transaction_qty).label("quantity"),
            func.count(distinct(SaleRecord.transaction_id)),
            func.sum(total).label("revenue"),
        )
        .where(*base)
        .group_by(
            SaleRecord.product_detail,
            SaleRecord.product_type,
            SaleRecord.product_category,
        )
    ).all()
    products = []
    for row in product_rows:
        products.append(
            {
                "product": row[0].strip() or row[1],
                "category": row[2],
                "quantity_sold": int(row[3]),
                "transaction_count": int(row[4]),
                "total_revenue": round(float(row[5]), 2),
                "revenue_share_pct": round(
                    float(row[5]) / summary["total_revenue"] * 100, 2
                )
                if summary["total_revenue"]
                else 0,
            }
        )
    revenue_ranked = sorted(
        products,
        key=lambda item: (item["total_revenue"], item["quantity_sold"]),
        reverse=True,
    )[:10]
    quantity_ranked = sorted(
        products,
        key=lambda item: (item["quantity_sold"], item["total_revenue"]),
        reverse=True,
    )[:10]

    def breakdown(column, dimension):
        conditions = filter_conditions(
            dataset.id,
            None if dimension == "location" else filters["location"],
            None if dimension == "category" else filters["category"],
            filters["start_date"],
            filters["end_date"],
        )
        rows = session.execute(
            select(
                column,
                func.sum(total),
                func.sum(SaleRecord.transaction_qty),
                func.count(distinct(SaleRecord.transaction_id)),
            )
            .where(*conditions)
            .group_by(column)
            .order_by(column)
        ).all()
        return [
            {
                "name": row[0],
                "revenue": round(float(row[1] or 0), 2),
                "quantity": int(row[2] or 0),
                "transactions": int(row[3]),
            }
            for row in rows
        ]

    category_mix = breakdown(SaleRecord.product_category, "category")
    location_mix = breakdown(SaleRecord.store_location, "location")
    comparison = None
    if filters["start_date"] and filters["end_date"]:
        days = (filters["end_date"] - filters["start_date"]).days + 1
        previous_end = filters["start_date"] - timedelta(days=1)
        previous_start = previous_end - timedelta(days=days - 1)
        if not dataset.first_date or previous_start >= dataset.first_date:
            comparison = {
                "previous": summary_for(
                    session,
                    filter_conditions(
                        dataset.id,
                        filters["location"],
                        filters["category"],
                        previous_start,
                        previous_end,
                    ),
                ),
                "previousStart": previous_start.isoformat(),
                "previousEnd": previous_end.isoformat(),
                "currentStart": filters["start_date"].isoformat(),
                "currentEnd": filters["end_date"].isoformat(),
            }
        else:
            comparison = {"unavailable": True}
    return {
        "metadata": dataset_payload(dataset),
        "locations": locations,
        "categories": categories,
        "summary": summary,
        "hourly": hourly,
        "trend": trend,
        "daily_trend": daily_trend,
        "revenue_ranked": revenue_ranked,
        "quantity_ranked": quantity_ranked,
        "category_mix": category_mix,
        "location_mix": location_mix,
        "comparison": comparison,
        "cache": "miss",
    }


@router.get("/datasets/{dataset_id}/dashboard")
def get_dashboard(
    dataset_id: int,
    location: str | None = None,
    category: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    granularity: str = Query("day", pattern="^(day|month)$"),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    dataset = get_visible_dataset(session, dataset_id, user)
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="Ngày bắt đầu phải trước ngày kết thúc.")
    filters = {
        "location": location,
        "category": category,
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": end_date.isoformat() if end_date else None,
        "granularity": granularity,
    }
    key = cache_key("dashboard", f"user-{user.id}-dataset-{dataset.id}", filters)
    cached = get_cached_json(key)
    if cached is not None:
        cached["cache"] = "hit"
        return cached
    data = dashboard_data(
        session,
        dataset,
        {
            **filters,
            "start_date": start_date,
            "end_date": end_date,
        },
    )
    set_cached_json(key, data)
    return data


@router.get("/cache-status")
def get_cache_status():
    from app.core.cache import cache_status

    return {"redis_cache": cache_status()}
