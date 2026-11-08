import argparse
import csv
import os
import re
import tempfile
from datetime import date, datetime, time
from decimal import Decimal, InvalidOperation
from pathlib import Path

from openpyxl import load_workbook


COLUMNS = (
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
)
MAX_INTEGER = 2_147_483_647


def parse_integer(value, column, row_number):
    if isinstance(value, bool) or value is None:
        raise ValueError(f"Dòng {row_number}: {column} bị thiếu hoặc không phải số nguyên.")
    try:
        number = Decimal(str(value).strip())
    except InvalidOperation as error:
        raise ValueError(f"Dòng {row_number}: {column} không phải số hợp lệ.") from error
    if not number.is_finite() or number != number.to_integral_value():
        raise ValueError(f"Dòng {row_number}: {column} phải là số nguyên.")
    return int(number)


def parse_date(value, row_number):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value or "").strip()
    for parser in (
        date.fromisoformat,
        lambda item: datetime.strptime(item, "%m/%d/%Y").date(),
        lambda item: datetime.strptime(item, "%m/%d/%y").date(),
    ):
        try:
            return parser(text)
        except ValueError:
            continue
    raise ValueError(f"Dòng {row_number}: transaction_date không phải ngày hợp lệ.")


def parse_time(value, row_number):
    if isinstance(value, datetime):
        return value.time().replace(microsecond=0)
    if isinstance(value, time):
        return value.replace(microsecond=0)
    text = str(value or "").strip()
    for parser in (
        time.fromisoformat,
        lambda item: datetime.strptime(item, "%I:%M %p").time(),
        lambda item: datetime.strptime(item, "%I:%M:%S %p").time(),
    ):
        try:
            return parser(text).replace(microsecond=0)
        except ValueError:
            continue
    raise ValueError(f"Dòng {row_number}: transaction_time không phải giờ hợp lệ.")


def parse_price(value, row_number):
    text = str(value or "").strip().replace("$", "").replace(" ", "")
    if re.fullmatch(r"-?\d{1,3}(,\d{3})+(\.\d+)?", text):
        text = text.replace(",", "")
    try:
        price = Decimal(text)
    except InvalidOperation as error:
        raise ValueError(f"Dòng {row_number}: unit_price không phải số hợp lệ.") from error
    if not price.is_finite() or price < 0:
        raise ValueError(f"Dòng {row_number}: unit_price phải là số hữu hạn không âm.")
    return price


def clean_row(values, row_number, seen_ids):
    try:
        transaction_id = parse_integer(values["transaction_id"], "transaction_id", row_number)
        quantity = parse_integer(values["transaction_qty"], "transaction_qty", row_number)
        store_id = parse_integer(values["store_id"], "store_id", row_number)
        product_id = parse_integer(values["product_id"], "product_id", row_number)
        sale_date = parse_date(values["transaction_date"], row_number)
        sale_time = parse_time(values["transaction_time"], row_number)
        unit_price = parse_price(values["unit_price"], row_number)
    except KeyError as error:
        raise ValueError(
            f"Dòng {row_number}: không tìm thấy cột {error.args[0]}."
        ) from error

    location = str(values.get("store_location") or "").strip()
    category = str(values.get("product_category") or "").strip()
    product_type = str(values.get("product_type") or "").strip()
    product_detail = str(values.get("product_detail") or "").strip()
    if transaction_id < 0 or store_id < 0 or product_id < 0:
        raise ValueError(f"Dòng {row_number}: các mã ID phải không âm.")
    if quantity <= 0:
        raise ValueError(f"Dòng {row_number}: transaction_qty phải lớn hơn 0.")
    if any(
        value > MAX_INTEGER
        for value in (transaction_id, quantity, store_id, product_id)
    ):
        raise ValueError(
            f"Dòng {row_number}: ID hoặc transaction_qty vượt giới hạn số nguyên 32-bit."
        )
    if not location or not category or not product_type:
        raise ValueError(
            f"Dòng {row_number}: store_location, product_category và product_type không được trống."
        )
    if len(location) > 160 or len(category) > 160 or len(product_type) > 200 or len(product_detail) > 300:
        raise ValueError(f"Dòng {row_number}: một trường văn bản vượt giới hạn schema.")
    if transaction_id in seen_ids:
        raise ValueError(
            f"Dòng {row_number}: transaction_id {transaction_id} bị lặp; "
            "cần xác minh đây là mã dòng hay mã đơn trước khi nạp."
        )
    seen_ids.add(transaction_id)

    return {
        "transaction_id": transaction_id,
        "transaction_date": sale_date.isoformat(),
        "transaction_time": sale_time.isoformat(),
        "transaction_qty": quantity,
        "store_id": store_id,
        "store_location": location,
        "product_id": product_id,
        "unit_price": format(unit_price, "f"),
        "product_category": category,
        "product_type": product_type,
        "product_detail": product_detail,
    }


def normalize_headers(header_row):
    headers = [
        str(value or "").strip().lower() if value is not None else ""
        for value in header_row
    ]
    positions = {}
    for index, name in enumerate(headers):
        if name in COLUMNS:
            if name in positions:
                raise ValueError(f"Excel có tiêu đề cột {name} bị lặp.")
            positions[name] = index
    missing = set(COLUMNS) - positions.keys()
    if missing:
        raise ValueError(f"Excel thiếu cột bắt buộc: {', '.join(sorted(missing))}.")
    return positions


def clean_workbook(input_path, output_path, sheet_name=None):
    if input_path.suffix.lower() != ".xlsx":
        raise ValueError("Chỉ hỗ trợ workbook .xlsx.")
    if output_path.suffix.lower() != ".csv":
        raise ValueError("File đầu ra phải có phần mở rộng .csv.")
    if input_path.resolve() == output_path.resolve():
        raise ValueError("File đầu vào và đầu ra không được trùng nhau.")

    workbook = load_workbook(input_path, read_only=True, data_only=True)
    try:
        if sheet_name:
            if sheet_name not in workbook.sheetnames:
                raise ValueError(f"Không tìm thấy sheet '{sheet_name}'.")
            worksheet = workbook[sheet_name]
        else:
            worksheet = workbook.active
        rows = worksheet.iter_rows(values_only=True)
        header_row = next(rows, None)
        if header_row is None:
            raise ValueError("Sheet không có dòng tiêu đề.")
        positions = normalize_headers(header_row)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        seen_ids = set()
        row_count = 0
        blank_rows = 0
        temporary_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                newline="",
                encoding="utf-8",
                suffix=".tmp",
                delete=False,
                dir=output_path.parent,
            ) as output_file:
                temporary_path = Path(output_file.name)
                writer = csv.DictWriter(output_file, fieldnames=COLUMNS)
                writer.writeheader()
                for row_number, row in enumerate(rows, start=2):
                    if not any(value is not None and str(value).strip() for value in row):
                        blank_rows += 1
                        continue
                    values = {
                        name: row[index] if index < len(row) else None
                        for name, index in positions.items()
                    }
                    writer.writerow(clean_row(values, row_number, seen_ids))
                    row_count += 1
            if not row_count:
                raise ValueError("Workbook không có dòng dữ liệu.")
            os.replace(temporary_path, output_path)
        finally:
            if temporary_path and temporary_path.exists():
                temporary_path.unlink()
    finally:
        workbook.close()

    return row_count, blank_rows


def main():
    parser = argparse.ArgumentParser(
        description="Validate and normalize Coffee Shop sales XLSX into the dashboard CSV schema."
    )
    parser.add_argument("input", type=Path, help="Raw .xlsx workbook (never modified)")
    parser.add_argument(
        "--output",
        type=Path,
        help="Output CSV path (default: <input>_clean.csv)",
    )
    parser.add_argument("--sheet", help="Worksheet name (default: active sheet)")
    arguments = parser.parse_args()
    output_path = arguments.output or arguments.input.with_name(
        f"{arguments.input.stem}_clean.csv"
    )
    rows, blank_rows = clean_workbook(
        arguments.input, output_path, arguments.sheet
    )
    print(f"Đã làm sạch: {rows:,} dòng hợp lệ")
    print(f"Dòng trống được bỏ qua: {blank_rows:,}")
    print(f"CSV đầu ra: {output_path}")


if __name__ == "__main__":
    main()
