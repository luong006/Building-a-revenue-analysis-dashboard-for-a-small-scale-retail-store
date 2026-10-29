from datetime import date

from app.core.db import DuckDBManager


def build_filter_clause(
    location: str | None = None,
    category: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    clauses = []
    parameters = []
    if location and location not in {"Tất cả chi nhánh", "All Locations"}:
        clauses.append("location = ?")
        parameters.append(location)
    if category and category not in {"Tất cả danh mục", "All Categories"}:
        clauses.append("category = ?")
        parameters.append(category)
    if start_date:
        clauses.append("sale_date >= ?")
        parameters.append(start_date)
    if end_date:
        clauses.append("sale_date <= ?")
        parameters.append(end_date)
    where_clause = "WHERE " + " AND ".join(clauses) if clauses else ""
    return where_clause, parameters


def calculate_summary(
    location: str | None = None,
    category: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    where_clause, parameters = build_filter_clause(
        location, category, start_date, end_date
    )
    row = DuckDBManager.query_one(
        f"""
        SELECT
            COALESCE(SUM(line_total), 0.0) AS total_revenue,
            COUNT(DISTINCT transaction_id) AS total_transactions,
            COALESCE(SUM(quantity), 0) AS total_items_sold
        FROM sales_view
        {where_clause}
        """,
        parameters,
    )
    total_revenue = round(float(row[0]), 2)
    total_transactions = int(row[1])
    total_items = int(row[2])

    return {
        "total_revenue": total_revenue,
        "total_transactions": total_transactions,
        "total_items_sold": total_items,
        "aov": round(total_revenue / total_transactions, 2)
        if total_transactions
        else 0.0,
        "upt": round(total_items / total_transactions, 2)
        if total_transactions
        else 0.0,
        "asp": round(total_revenue / total_items, 2) if total_items else 0.0,
        "location_filter": location or "All Locations",
        "period_filter": (
            f"{start_date or 'start'} to {end_date or 'latest'}"
            if start_date or end_date
            else "Full Historical Period"
        ),
    }


def calculate_hourly_distribution(
    location: str | None = None,
    category: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    where_clause, parameters = build_filter_clause(
        location, category, start_date, end_date
    )
    rows = DuckDBManager.query_all(
        f"""
        SELECT
            hour_of_day,
            ROUND(SUM(line_total), 2) AS hourly_revenue,
            COUNT(DISTINCT transaction_id) AS transaction_count,
            SUM(quantity) AS items_sold
        FROM sales_view
        {where_clause}
        GROUP BY hour_of_day
        ORDER BY hour_of_day ASC
        """,
        parameters,
    )
    return [
        {
            "hour": int(row[0]),
            "label": f"{int(row[0]):02d}:00",
            "revenue": float(row[1]),
            "transactions": int(row[2]),
            "items_sold": int(row[3]),
        }
        for row in rows
    ]


def calculate_top_products(
    location: str | None = None,
    category: str | None = None,
    limit: int = 10,
    start_date: date | None = None,
    end_date: date | None = None,
):
    where_clause, parameters = build_filter_clause(
        location, category, start_date, end_date
    )
    total_row = DuckDBManager.query_one(
        f"SELECT COALESCE(SUM(line_total), 0) FROM sales_view {where_clause}",
        parameters,
    )
    total_revenue = float(total_row[0])
    rows = DuckDBManager.query_all(
        f"""
        SELECT
            product,
            category,
            SUM(quantity) AS quantity_sold,
            ROUND(SUM(line_total), 2) AS product_revenue
        FROM sales_view
        {where_clause}
        GROUP BY product, category
        ORDER BY product_revenue DESC
        LIMIT ?
        """,
        [*parameters, limit],
    )
    return [
        {
            "product": str(row[0]),
            "category": str(row[1]),
            "quantity_sold": int(row[2]),
            "total_revenue": float(row[3]),
            "revenue_share_pct": round(float(row[3]) / total_revenue * 100, 2)
            if total_revenue
            else 0.0,
        }
        for row in rows
    ]


def calculate_sales_trend(
    location: str | None = None,
    category: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    granularity: str = "day",
):
    period_expression = {
        "day": "sale_date",
        "month": "CAST(date_trunc('month', sale_date) AS DATE)",
    }
    if granularity not in period_expression:
        raise ValueError("granularity must be 'day' or 'month'")
    where_clause, parameters = build_filter_clause(
        location, category, start_date, end_date
    )
    rows = DuckDBManager.query_all(
        f"""
        SELECT
            {period_expression[granularity]} AS period,
            ROUND(SUM(line_total), 2) AS revenue,
            COUNT(DISTINCT transaction_id) AS transactions,
            SUM(quantity) AS items_sold
        FROM sales_view
        {where_clause}
        GROUP BY period
        ORDER BY period ASC
        """,
        parameters,
    )
    return [
        {
            "period": row[0].isoformat(),
            "revenue": float(row[1]),
            "transactions": int(row[2]),
            "items_sold": int(row[3]),
        }
        for row in rows
    ]
