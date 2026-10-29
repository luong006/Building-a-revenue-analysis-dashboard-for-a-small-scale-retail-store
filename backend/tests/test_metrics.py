import unittest
from datetime import date, time
from unittest.mock import patch

import duckdb

from app.core.db import DuckDBManager
from app.core.metrics import (
    calculate_sales_trend,
    calculate_summary,
    calculate_top_products,
)


class MetricsTests(unittest.TestCase):
    def setUp(self):
        self.connection = duckdb.connect(":memory:")
        self.connection.execute(
            """
            CREATE TABLE sales_view (
                transaction_id BIGINT,
                sale_date DATE,
                sale_time TIME,
                quantity INTEGER,
                location VARCHAR,
                unit_price DOUBLE,
                category VARCHAR,
                product VARCHAR,
                line_total DOUBLE,
                hour_of_day INTEGER
            )
            """
        )
        self.connection.executemany(
            "INSERT INTO sales_view VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    101,
                    date(2023, 1, 1),
                    time(8, 0),
                    2,
                    "Astoria",
                    3.0,
                    "Coffee",
                    "Espresso",
                    6.0,
                    8,
                ),
                (
                    102,
                    date(2023, 1, 1),
                    time(9, 0),
                    1,
                    "Astoria",
                    2.0,
                    "Tea",
                    "Chai",
                    2.0,
                    9,
                ),
                (
                    103,
                    date(2023, 1, 2),
                    time(8, 30),
                    3,
                    "Hell's Kitchen",
                    4.0,
                    "Coffee",
                    "Latte",
                    12.0,
                    8,
                ),
            ],
        )
        query_one = patch.object(
            DuckDBManager,
            "query_one",
            side_effect=lambda query, parameters=(): self.connection.execute(
                query, parameters
            ).fetchone(),
        )
        query_all = patch.object(
            DuckDBManager,
            "query_all",
            side_effect=lambda query, parameters=(): self.connection.execute(
                query, parameters
            ).fetchall(),
        )
        query_one.start()
        query_all.start()
        self.addCleanup(query_one.stop)
        self.addCleanup(query_all.stop)
        self.addCleanup(self.connection.close)

    def test_summary_uses_transaction_count_and_zero_safe_ratios(self):
        result = calculate_summary(location="Astoria")

        self.assertEqual(result["total_revenue"], 8.0)
        self.assertEqual(result["total_transactions"], 2)
        self.assertEqual(result["total_items_sold"], 3)
        self.assertEqual(result["aov"], 4.0)
        self.assertEqual(result["upt"], 1.5)
        self.assertEqual(result["asp"], 2.67)

        category_result = calculate_summary(category="Coffee")
        self.assertEqual(category_result["total_revenue"], 18.0)
        self.assertEqual(category_result["total_transactions"], 2)
        self.assertEqual(category_result["total_items_sold"], 5)

        empty_result = calculate_summary(location="Unknown")
        self.assertEqual(empty_result["total_transactions"], 0)
        self.assertEqual(empty_result["aov"], 0.0)
        self.assertEqual(empty_result["upt"], 0.0)
        self.assertEqual(empty_result["asp"], 0.0)

    def test_filters_are_bound_and_applied(self):
        malicious_location = "' OR 1=1 --"
        result = calculate_summary(location=malicious_location)

        self.assertEqual(result["total_revenue"], 0.0)
        self.assertEqual(result["total_transactions"], 0)

    def test_top_product_share_uses_filtered_revenue(self):
        products = calculate_top_products(location="Astoria", limit=1)

        self.assertEqual(len(products), 1)
        self.assertEqual(products[0]["product"], "Espresso")
        self.assertEqual(products[0]["quantity_sold"], 2)
        self.assertEqual(products[0]["revenue_share_pct"], 75.0)

    def test_monthly_trend_applies_inclusive_date_filters(self):
        trend = calculate_sales_trend(
            location="Astoria",
            start_date=date(2023, 1, 1),
            end_date=date(2023, 1, 1),
            granularity="month",
        )

        self.assertEqual(
            trend,
            [
                {
                    "period": "2023-01-01",
                    "revenue": 8.0,
                    "transactions": 2,
                    "items_sold": 3,
                }
            ],
        )


if __name__ == "__main__":
    unittest.main()
