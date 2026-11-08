import unittest
from datetime import date
from pathlib import Path

from app.core.data_import import normalize_csv, preview_csv


class DataImportTests(unittest.TestCase):
    def setUp(self):
        self.csv = (
            "transaction_id,transaction_date,quantity,category,item,total_spent,"
            "unit_price,store_id,product_id,source_note\n"
            "A1,2024-01-02,2,Coffee,Latte,19.00,3.00,Store-A,SKU-01,keep me\n"
        ).encode("utf-8")

    def test_preview_maps_common_names_and_preserves_source_amount(self):
        preview = preview_csv(self.csv)

        self.assertTrue(preview["ready"])
        self.assertEqual(preview["amount_source"], "total_spent")
        self.assertEqual(preview["mapping"]["transaction_qty"], "quantity")
        self.assertEqual(preview["normalized_preview"][0]["line_revenue"], 19.0)
        self.assertEqual(preview["unmapped_columns"], ["source_note"])

        records, first_date, last_date, _ = normalize_csv(
            self.csv, "total_spent", False, False
        )
        self.assertEqual(records[0]["line_revenue"], 19.0)
        self.assertEqual(records[0]["source_attributes"]["source_note"], "keep me")
        self.assertEqual(records[0]["store_id"], "Store-A")
        self.assertEqual(records[0]["product_id"], "SKU-01")
        self.assertEqual(first_date, date(2024, 1, 2))
        self.assertEqual(last_date, date(2024, 1, 2))

    def test_finds_header_after_preamble_and_parses_unambiguous_day_first_date(self):
        content = (
            "Retail sales export\n"
            "Generated for reporting\n"
            "transaction_id,date,quantity,category,item,total_spent\n"
            "A1,24/04/2024,1,Coffee,Latte,7.50\n"
        ).encode("utf-8")

        preview = preview_csv(content)
        self.assertEqual(preview["preamble_rows"], 2)
        self.assertEqual(preview["valid_rows_before_deduplication"], 1)
        records, first_date, _, _ = normalize_csv(
            content, "total_spent", False, False
        )
        self.assertEqual(first_date, date(2024, 4, 24))
        self.assertEqual(records[0]["transaction_date"], date(2024, 4, 24))

    def test_ambiguous_dates_require_explicit_interpretation(self):
        content = self.csv.replace(b"2024-01-02", b"04/05/2024")
        preview = preview_csv(content)
        self.assertEqual(preview["ambiguous_date_rows"], 1)
        self.assertEqual(preview["invalid_rows"], 1)
        self.assertEqual(preview_csv(content, date_format="day_first")["invalid_rows"], 0)
        self.assertEqual(
            preview_csv(content, date_format="month_first")["invalid_rows"], 0
        )

        day_first, first_date, _, _ = normalize_csv(
            content, "total_spent", False, False, "day_first"
        )
        month_first, month_first_date, _, _ = normalize_csv(
            content, "total_spent", False, False, "month_first"
        )
        self.assertEqual(first_date, date(2024, 5, 4))
        self.assertEqual(month_first_date, date(2024, 4, 5))
        self.assertNotEqual(
            day_first[0]["transaction_date"], month_first[0]["transaction_date"]
        )

    def test_exact_duplicates_and_invalid_rows_require_confirmation(self):
        duplicate = self.csv.splitlines()[1] + b"\n"
        invalid = b"A2,2024-01-03,N/A,Coffee,Latte,10.00,5.00,broken\n"
        content = self.csv + duplicate + invalid + invalid
        preview = preview_csv(content)
        self.assertEqual(preview["exact_duplicate_rows"], 2)
        self.assertEqual(preview["invalid_rows"], 2)
        self.assertEqual(preview["invalid_rows_after_deduplication"], 1)

        with self.assertRaisesRegex(ValueError, "xác nhận loại bản sao"):
            normalize_csv(content, "total_spent", False, True)
        with self.assertRaisesRegex(ValueError, "dòng không hợp lệ"):
            normalize_csv(content, "total_spent", True, False)

        records, _, _, report = normalize_csv(
            content,
            "total_spent",
            deduplicate_exact=True,
            drop_invalid_rows=True,
        )
        self.assertEqual(len(records), 1)
        self.assertEqual(report["exact_duplicates_removed"], 2)
        self.assertEqual(report["invalid_rows_removed"], 1)

    def test_retail_sales_file_has_confirmable_quality_counts(self):
        data_file = Path(__file__).parents[1] / "data" / "retail_store_sales.csv"
        preview = preview_csv(data_file.read_bytes())

        self.assertEqual(preview["total_rows"], 10150)
        self.assertEqual(preview["exact_duplicate_rows"], 150)
        self.assertEqual(preview["ambiguous_date_rows"], 196)
        self.assertGreater(preview["invalid_rows"], 0)
        self.assertEqual(preview["amount_source"], "total_spent")

        records, first_date, last_date, report = normalize_csv(
            data_file.read_bytes(),
            "total_spent",
            deduplicate_exact=True,
            drop_invalid_rows=True,
            date_format="day_first",
        )
        self.assertEqual(len(records), 9750)
        self.assertEqual(first_date, date(2022, 1, 1))
        self.assertEqual(last_date, date(2024, 12, 30))
        self.assertEqual(report["exact_duplicates_removed"], 150)
        self.assertEqual(report["invalid_rows_removed"], 250)
        self.assertEqual(report["warning_returned_rows"], 2014)


if __name__ == "__main__":
    unittest.main()
