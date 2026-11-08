import csv
import tempfile
import unittest
from pathlib import Path

from openpyxl import Workbook

from scripts.clean_sales_data import COLUMNS, clean_workbook


class CleanSalesDataTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.input_path = self.root / "raw.xlsx"
        self.output_path = self.root / "clean.csv"

    def tearDown(self):
        self.temporary_directory.cleanup()

    def write_workbook(self, rows):
        workbook = Workbook()
        worksheet = workbook.active
        worksheet.append(COLUMNS)
        for row in rows:
            worksheet.append(row)
        workbook.save(self.input_path)
        workbook.close()

    @staticmethod
    def valid_row(transaction_id=1):
        return (
            transaction_id,
            "03/01/2023",
            "7:05 AM",
            2,
            1,
            " Astoria ",
            10,
            "$4.50",
            " Coffee ",
            "Espresso",
            "Espresso",
        )

    def test_normalizes_values_and_skips_only_fully_blank_rows(self):
        self.write_workbook([self.valid_row(), [None] * len(COLUMNS)])

        row_count, blank_rows = clean_workbook(self.input_path, self.output_path)

        with self.output_path.open(newline="", encoding="utf-8") as file:
            rows = list(csv.DictReader(file))
        self.assertEqual((row_count, blank_rows), (1, 1))
        self.assertEqual(rows[0]["transaction_date"], "2023-03-01")
        self.assertEqual(rows[0]["transaction_time"], "07:05:00")
        self.assertEqual(rows[0]["unit_price"], "4.50")
        self.assertEqual(rows[0]["store_location"], "Astoria")

    def test_invalid_row_does_not_replace_existing_output(self):
        self.write_workbook([self.valid_row(), self.valid_row()])
        self.output_path.write_text("existing output\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "transaction_id 1 bị lặp"):
            clean_workbook(self.input_path, self.output_path)

        self.assertEqual(
            self.output_path.read_text(encoding="utf-8"), "existing output\n"
        )
        self.assertEqual(list(self.root.glob("*.tmp")), [])

    def test_rejects_missing_required_columns(self):
        workbook = Workbook()
        worksheet = workbook.active
        worksheet.append(COLUMNS[:-1])
        workbook.save(self.input_path)
        workbook.close()

        with self.assertRaisesRegex(ValueError, "Excel thiếu cột bắt buộc"):
            clean_workbook(self.input_path, self.output_path)


if __name__ == "__main__":
    unittest.main()
