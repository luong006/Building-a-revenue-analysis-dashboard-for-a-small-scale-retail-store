import csv
from threading import RLock

import duckdb

from app.core.config import DATA_PATH

class DatasetUnavailableError(Exception):
    def __init__(self, status, message):
        self.status = status
        self.message = message
        super().__init__(message)


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


class DuckDBManager:
    _instance = None
    _lock = RLock()

    @classmethod
    def get_connection(cls):
        with cls._lock:
            if cls._instance is None:
                try:
                    cls._instance = cls._create_connection()
                except FileNotFoundError as error:
                    raise DatasetUnavailableError(
                        "missing",
                        "Cleaned dataset is not installed. Add the approved CSV "
                        "to the configured DATA_PATH.",
                    ) from error
                except (ValueError, duckdb.Error) as error:
                    raise DatasetUnavailableError(
                        "invalid",
                        f"Configured dataset could not be validated: {error}",
                    ) from error
            return cls._instance

    @classmethod
    def _create_connection(cls):
        if not DATA_PATH.is_file():
            raise FileNotFoundError(f"Sales dataset not found: {DATA_PATH}")

        with DATA_PATH.open(newline="", encoding="utf-8-sig") as dataset:
            headers = set(next(csv.reader(dataset), []))
        missing_columns = REQUIRED_COLUMNS - headers
        if missing_columns:
            missing = ", ".join(sorted(missing_columns))
            raise ValueError(f"Sales dataset is missing required columns: {missing}")

        connection = duckdb.connect(database=":memory:")
        csv_path = str(DATA_PATH.resolve()).replace("\\", "/").replace("'", "''")
        connection.execute(
            f"""
            CREATE VIEW sales_view AS
            SELECT
                TRY_CAST(transaction_id AS BIGINT) AS transaction_id,
                TRY_CAST(transaction_date AS DATE) AS sale_date,
                TRY_CAST(transaction_time AS TIME) AS sale_time,
                TRY_CAST(transaction_qty AS INTEGER) AS quantity,
                TRY_CAST(store_id AS BIGINT) AS store_id,
                store_location AS location,
                TRY_CAST(product_id AS BIGINT) AS product_id,
                TRY_CAST(unit_price AS DOUBLE) AS unit_price,
                product_category AS category,
                product_type,
                product_detail,
                COALESCE(
                    NULLIF(TRIM(product_detail), ''),
                    NULLIF(TRIM(product_type), '')
                ) AS product,
                TRY_CAST(transaction_qty AS INTEGER)
                    * TRY_CAST(unit_price AS DOUBLE) AS line_total,
                EXTRACT(
                    HOUR FROM TRY_CAST(transaction_time AS TIME)
                )::INTEGER AS hour_of_day
            FROM read_csv_auto('{csv_path}')
            """
        )
        row_count, distinct_ids, invalid_rows = connection.execute(
            """
            SELECT
                COUNT(*),
                COUNT(DISTINCT transaction_id),
                COUNT(*) FILTER (
                    WHERE transaction_id IS NULL
                       OR sale_date IS NULL
                       OR sale_time IS NULL
                       OR quantity IS NULL OR quantity <= 0
                       OR store_id IS NULL
                       OR location IS NULL OR TRIM(location) = ''
                       OR product_id IS NULL
                       OR unit_price IS NULL OR unit_price < 0
                       OR category IS NULL OR TRIM(category) = ''
                       OR product_type IS NULL OR TRIM(product_type) = ''
                       OR product IS NULL OR TRIM(product) = ''
                       OR line_total IS NULL OR line_total < 0
                       OR hour_of_day IS NULL OR hour_of_day NOT BETWEEN 0 AND 23
                )
            FROM sales_view
            """
        ).fetchone()
        if row_count == 0:
            connection.close()
            raise ValueError("Sales dataset contains no records")
        if invalid_rows:
            connection.close()
            raise ValueError(
                f"Sales dataset contains {invalid_rows} invalid or incomplete rows"
            )
        if distinct_ids != row_count:
            connection.close()
            raise ValueError("Sales dataset contains duplicate transaction IDs")
        return connection

    @classmethod
    def query_all(cls, query, parameters=()):
        with cls._lock:
            return cls.get_connection().execute(query, parameters).fetchall()

    @classmethod
    def query_one(cls, query, parameters=()):
        with cls._lock:
            return cls.get_connection().execute(query, parameters).fetchone()
