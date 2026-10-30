import unittest
from datetime import date, time
from pathlib import Path
from tempfile import NamedTemporaryFile
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session

from app.api.user_routes import (
    DatasetRename,
    dashboard_data,
    delete_dataset,
    get_visible_dataset,
    parse_csv,
    rename_dataset,
)
from app.core.auth import hash_password, verify_password
from app.core.cache import cache_key
from app.core.persistence import Base, Dataset, SaleRecord, User
import app.core.persistence as persistence


VALID_CSV = """transaction_id,transaction_date,transaction_time,transaction_qty,store_id,store_location,product_id,unit_price,product_category,product_type,product_detail
1,2023-01-01,08:00:00,2,1,Astoria,10,3.50,Coffee,Espresso,Espresso
"""


class UserDatasetTests(unittest.TestCase):
    def test_password_hash_is_salted_and_verified(self):
        first_hash = hash_password("Correct horse battery staple")
        second_hash = hash_password("Correct horse battery staple")

        self.assertNotEqual(first_hash, second_hash)
        self.assertTrue(verify_password("Correct horse battery staple", first_hash))
        self.assertFalse(verify_password("wrong password", first_hash))

    def test_csv_parser_returns_clean_records_and_date_range(self):
        rows, first_date, last_date = parse_csv(VALID_CSV.encode("utf-8"))

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["transaction_qty"], 2)
        self.assertEqual(rows[0]["unit_price"], 3.5)
        self.assertEqual(first_date, date(2023, 1, 1))
        self.assertEqual(last_date, date(2023, 1, 1))

    def test_csv_parser_rejects_duplicate_transaction_ids(self):
        duplicate_csv = VALID_CSV + VALID_CSV.splitlines()[1] + "\n"

        with self.assertRaises(HTTPException) as raised:
            parse_csv(duplicate_csv.encode("utf-8"))

        self.assertEqual(raised.exception.status_code, 422)

    def test_csv_parser_rejects_missing_required_columns(self):
        with self.assertRaises(HTTPException) as raised:
            parse_csv(b"transaction_id,transaction_date\n1,2023-01-01\n")

        self.assertEqual(raised.exception.status_code, 422)

    def test_dataset_visibility_is_limited_to_owner_or_sample(self):
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        with Session(engine) as session:
            owner = User(email="owner@example.com", password_hash="hash")
            stranger = User(email="stranger@example.com", password_hash="hash")
            session.add_all([owner, stranger])
            session.flush()
            private_dataset = Dataset(
                owner_id=owner.id,
                name="private",
                row_count=0,
                currency_code="USD",
                is_sample=False,
            )
            sample_dataset = Dataset(
                owner_id=None,
                name="sample",
                row_count=0,
                currency_code="USD",
                is_sample=True,
            )
            session.add_all([private_dataset, sample_dataset])
            session.flush()

            self.assertEqual(
                get_visible_dataset(session, private_dataset.id, owner).name,
                "private",
            )
            self.assertEqual(
                get_visible_dataset(session, sample_dataset.id, stranger).name,
                "sample",
            )
            with self.assertRaises(HTTPException) as raised:
                get_visible_dataset(session, private_dataset.id, stranger)
            self.assertEqual(raised.exception.status_code, 404)

    def test_only_owner_can_rename_or_delete_personal_datasets(self):
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        with Session(engine) as session:
            owner = User(email="owner-actions@example.com", password_hash="hash")
            stranger = User(email="stranger-actions@example.com", password_hash="hash")
            session.add_all([owner, stranger])
            session.flush()
            personal = Dataset(
                owner_id=owner.id,
                name="old",
                row_count=0,
                currency_code="USD",
                is_sample=False,
            )
            sample = Dataset(
                owner_id=None,
                name="sample",
                row_count=0,
                currency_code="USD",
                is_sample=True,
            )
            session.add_all([personal, sample])
            session.flush()

            with self.assertRaises(HTTPException) as raised:
                rename_dataset(
                    personal.id,
                    DatasetRename(name="stolen"),
                    session,
                    stranger,
                )
            self.assertEqual(raised.exception.status_code, 404)

            with self.assertRaises(HTTPException) as raised:
                delete_dataset(sample.id, session, owner)
            self.assertEqual(raised.exception.status_code, 404)

            renamed = rename_dataset(
                personal.id,
                DatasetRename(name="new"),
                session,
                owner,
            )
            self.assertEqual(renamed["name"], "new")
            delete_dataset(personal.id, session, owner)
            self.assertIsNone(session.get(Dataset, personal.id))

        engine.dispose()

    def test_cache_identity_is_scoped_to_user_and_parameters(self):
        filters = {"category": "Coffee", "start_date": "2023-01-01"}

        self.assertNotEqual(
            cache_key("dashboard", "user-1-dataset-3", filters),
            cache_key("dashboard", "user-2-dataset-3", filters),
        )
        self.assertNotEqual(
            cache_key("dashboard", "user-1-dataset-3", filters),
            cache_key("dashboard", "user-1-dataset-3", {"category": "Tea"}),
        )

    def test_seed_import_persists_sample_rows_only_once(self):
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        with NamedTemporaryFile(
            mode="w", encoding="utf-8", newline="", suffix=".csv", delete=False
        ) as file:
            file.write(VALID_CSV)
            csv_path = Path(file.name)
        self.addCleanup(csv_path.unlink, missing_ok=True)
        self.addCleanup(engine.dispose)

        with (
            patch.object(persistence, "engine", engine),
            patch.object(persistence, "SessionLocal", lambda: Session(engine)),
            patch.object(persistence, "DATA_PATH", csv_path),
        ):
            persistence.seed_sample_dataset()
            persistence.seed_sample_dataset()
            with Session(engine) as session:
                datasets = session.scalars(select(Dataset)).all()
                records = session.scalars(select(SaleRecord)).all()

        self.assertEqual(len(datasets), 1)
        self.assertTrue(datasets[0].is_sample)
        self.assertEqual(datasets[0].row_count, 1)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].dataset_id, datasets[0].id)

    def test_dashboard_queries_follow_dataset_and_filter_dimensions(self):
        engine = create_engine("sqlite://")

        def date_trunc(granularity, value):
            current_date = date.fromisoformat(value[:10])
            if granularity == "month":
                current_date = current_date.replace(day=1)
            return current_date.isoformat()

        event.listen(
            engine,
            "connect",
            lambda connection, _: connection.create_function(
                "date_trunc", 2, date_trunc
            ),
        )
        Base.metadata.create_all(engine)
        with Session(engine) as session:
            owner = User(email="dashboard@example.com", password_hash="hash")
            session.add(owner)
            session.flush()
            dataset = Dataset(
                owner_id=owner.id,
                name="test",
                row_count=4,
                first_date=date(2023, 1, 1),
                last_date=date(2023, 1, 2),
                currency_code="USD",
                is_sample=False,
            )
            session.add(dataset)
            session.flush()
            session.add_all(
                [
                    SaleRecord(
                        dataset_id=dataset.id,
                        transaction_id=1,
                        transaction_date=date(2023, 1, 1),
                        transaction_time=time(8),
                        transaction_qty=2,
                        store_id=1,
                        store_location="Astoria",
                        product_id=10,
                        unit_price=3,
                        product_category="Coffee",
                        product_type="Espresso",
                        product_detail="Espresso",
                    ),
                    SaleRecord(
                        dataset_id=dataset.id,
                        transaction_id=2,
                        transaction_date=date(2023, 1, 2),
                        transaction_time=time(9),
                        transaction_qty=1,
                        store_id=1,
                        store_location="Astoria",
                        product_id=11,
                        unit_price=2,
                        product_category="Tea",
                        product_type="Chai",
                        product_detail="Chai",
                    ),
                    SaleRecord(
                        dataset_id=dataset.id,
                        transaction_id=3,
                        transaction_date=date(2023, 1, 2),
                        transaction_time=time(10),
                        transaction_qty=3,
                        store_id=2,
                        store_location="Chelsea",
                        product_id=12,
                        unit_price=4,
                        product_category="Coffee",
                        product_type="Latte",
                        product_detail="Latte",
                    ),
                    SaleRecord(
                        dataset_id=dataset.id,
                        transaction_id=4,
                        transaction_date=date(2023, 1, 2),
                        transaction_time=time(11),
                        transaction_qty=1,
                        store_id=1,
                        store_location="Astoria",
                        product_id=13,
                        unit_price=5,
                        product_category="Coffee",
                        product_type="Latte",
                        product_detail="Latte",
                    ),
                ]
            )
            session.flush()

            result = dashboard_data(
                session,
                dataset,
                {
                    "location": "Astoria",
                    "category": "Coffee",
                    "start_date": date(2023, 1, 2),
                    "end_date": date(2023, 1, 2),
                    "granularity": "day",
                },
            )

        engine.dispose()
        self.assertEqual(result["summary"]["total_revenue"], 5.0)
        self.assertEqual(result["summary"]["total_transactions"], 1)
        self.assertEqual(result["trend"][0]["period"], "2023-01-02")
        self.assertEqual(
            {item["name"] for item in result["category_mix"]}, {"Coffee", "Tea"}
        )
        self.assertEqual(
            {item["name"] for item in result["location_mix"]}, {"Astoria", "Chelsea"}
        )
        self.assertEqual(result["comparison"]["previous"]["total_revenue"], 6.0)


if __name__ == "__main__":
    unittest.main()
