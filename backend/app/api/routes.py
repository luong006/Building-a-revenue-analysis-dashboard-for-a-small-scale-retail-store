from datetime import date
from typing import List, Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import CURRENCY_CODE
from app.core.db import DatasetUnavailableError, DuckDBManager
from app.core.metrics import (
    calculate_hourly_distribution,
    calculate_sales_trend,
    calculate_summary,
    calculate_top_products,
)
from app.models.schemas import (
    DatasetMetadataResponse,
    HealthResponse,
    HourlySalesItem,
    ProductSalesItem,
    SalesTrendItem,
    SummaryKPIResponse,
)

router = APIRouter(prefix="/api", tags=["Analytics"])


def validate_date_range(start_date: date | None, end_date: date | None):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=422, detail="start_date must be on or before end_date"
        )


def require_dataset():
    try:
        DuckDBManager.get_connection()
    except DatasetUnavailableError as error:
        raise HTTPException(
            status_code=503,
            detail={"dataset_status": error.status, "message": error.message},
        ) from error


@router.get("/health", response_model=HealthResponse)
def health_check():
    try:
        DuckDBManager.get_connection()
    except DatasetUnavailableError as error:
        return {
            "status": "healthy",
            "service": "Retail Pulse Analytics API",
            "dataset_status": error.status,
            "database": "DuckDB CSV analytics",
            "dataset_message": error.message,
        }
    return {
        "status": "healthy",
        "service": "Retail Pulse Analytics API",
        "dataset_status": "available",
        "database": "DuckDB CSV analytics",
    }


@router.get("/metadata", response_model=DatasetMetadataResponse)
def get_metadata(_dataset=Depends(require_dataset)):
    row = DuckDBManager.query_one(
        "SELECT COUNT(*), MIN(sale_date), MAX(sale_date) FROM sales_view"
    )
    return {
        "record_count": int(row[0]),
        "first_date": row[1].isoformat() if row[1] else None,
        "last_date": row[2].isoformat() if row[2] else None,
        "currency_code": CURRENCY_CODE,
    }


@router.get("/locations", response_model=List[str])
def get_locations(_dataset=Depends(require_dataset)):
    rows = DuckDBManager.query_all(
        "SELECT DISTINCT location FROM sales_view ORDER BY location ASC"
    )
    return [row[0] for row in rows if row[0]]


@router.get("/categories", response_model=List[str])
def get_categories(_dataset=Depends(require_dataset)):
    rows = DuckDBManager.query_all(
        "SELECT DISTINCT category FROM sales_view ORDER BY category ASC"
    )
    return [row[0] for row in rows if row[0]]


@router.get("/metrics/summary", response_model=SummaryKPIResponse)
def get_summary(
    location: str | None = Query(None, description="Chi nhánh cửa hàng"),
    category: str | None = Query(None, description="Danh mục sản phẩm"),
    start_date: date | None = Query(None, description="Ngày bắt đầu, bao gồm"),
    end_date: date | None = Query(None, description="Ngày kết thúc, bao gồm"),
    _dataset=Depends(require_dataset),
):
    validate_date_range(start_date, end_date)
    return calculate_summary(location, category, start_date, end_date)


@router.get("/metrics/hourly", response_model=List[HourlySalesItem])
def get_hourly(
    location: str | None = Query(None, description="Chi nhánh cửa hàng"),
    category: str | None = Query(None, description="Danh mục sản phẩm"),
    start_date: date | None = Query(None, description="Ngày bắt đầu, bao gồm"),
    end_date: date | None = Query(None, description="Ngày kết thúc, bao gồm"),
    _dataset=Depends(require_dataset),
):
    validate_date_range(start_date, end_date)
    return calculate_hourly_distribution(location, category, start_date, end_date)


@router.get("/metrics/top-products", response_model=List[ProductSalesItem])
def get_top_products(
    location: str | None = Query(None, description="Chi nhánh cửa hàng"),
    category: str | None = Query(None, description="Danh mục sản phẩm"),
    start_date: date | None = Query(None, description="Ngày bắt đầu, bao gồm"),
    end_date: date | None = Query(None, description="Ngày kết thúc, bao gồm"),
    limit: int = Query(10, ge=1, le=50),
    _dataset=Depends(require_dataset),
):
    validate_date_range(start_date, end_date)
    return calculate_top_products(
        location, category, limit, start_date, end_date
    )


@router.get("/metrics/trend", response_model=List[SalesTrendItem])
def get_sales_trend(
    location: str | None = Query(None, description="Chi nhánh cửa hàng"),
    category: str | None = Query(None, description="Danh mục sản phẩm"),
    start_date: date | None = Query(None, description="Ngày bắt đầu, bao gồm"),
    end_date: date | None = Query(None, description="Ngày kết thúc, bao gồm"),
    granularity: Literal["day", "month"] = Query("day"),
    _dataset=Depends(require_dataset),
):
    validate_date_range(start_date, end_date)
    return calculate_sales_trend(
        location, category, start_date, end_date, granularity
    )
