import csv
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.core.db import DuckDBManager


class DatasetLoaderTests(unittest.TestCase):
    def test_loads_cleaned_source_columns_and_derives_hour_and_revenue(self):
        rows = [
            {
                "transaction_id": "1",
                "transaction_date": "2023-01-01",
                "transaction_time": "08:15:00",
                "transaction_qty": "2",
                "store_id": "3",
                "store_location": "Astoria",
                "product_id": "8",
                "unit_price": "3.50",
                "product_category": "Coffee",
                "product_type": "Brewed coffee",
                "product_detail": "Large",
            },
            {
                "transaction_id": "2",
                "transaction_date": "2023-01-01",
                "transaction_time": "09:05:00",
                "transaction_qty": "1",
                "store_id": "3",
                "store_location": "Astoria",
                "product_id": "9",
                "unit_price": "2.25",
                "product_category": "Tea",
                "product_type": "Chai",
                "product_detail": "",
            },
        ]
        with tempfile.TemporaryDirectory() as temp_dir:
            data_path = Path(temp_dir) / "cleaned_sales.csv"
            with data_path.open("w", newline="", encoding="utf-8") as file:
                writer = csv.DictWriter(file, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)

            with patch("app.core.db.DATA_PATH", data_path):
                connection = DuckDBManager._create_connection()

            try:
                result = connection.execute(
                    """
                    SELECT transaction_id, sale_date, hour_of_day, location,
                           product, quantity, line_total
                    FROM sales_view
                    ORDER BY transaction_id
                    """
                ).fetchall()
            finally:
                connection.close()

        self.assertEqual(result[0][0], 1)
        self.assertEqual(result[0][2], 8)
        self.assertEqual(result[0][4], "Large")
        self.assertEqual(result[0][6], 7.0)
        self.assertEqual(result[1][2], 9)
        self.assertEqual(result[1][4], "Chai")
        self.assertEqual(result[1][6], 2.25)


if __name__ == "__main__":
    unittest.main()
