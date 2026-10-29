from typing import Optional

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str
    dataset_status: str
    database: str
    dataset_message: Optional[str] = None


class DatasetMetadataResponse(BaseModel):
    record_count: int
    first_date: Optional[str]
    last_date: Optional[str]
    currency_code: Optional[str]


class SummaryKPIResponse(BaseModel):
    total_revenue: float
    total_transactions: int
    total_items_sold: int
    aov: float
    upt: float
    asp: float
    location_filter: Optional[str] = "All Locations"
    period_filter: Optional[str] = "Full Historical Period"


class HourlySalesItem(BaseModel):
    hour: int
    label: str
    revenue: float
    transactions: int
    items_sold: int


class ProductSalesItem(BaseModel):
    product: str
    category: str
    quantity_sold: int
    transaction_count: int
    total_revenue: float
    revenue_share_pct: float


class SalesTrendItem(BaseModel):
    period: str
    revenue: float
    transactions: int
    items_sold: int
