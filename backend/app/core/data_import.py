import csv
import io
import re
import unicodedata
from collections import Counter
from datetime import date, datetime, time
from decimal import Decimal, InvalidOperation


ALIASES = {
    "transaction_id": {"transactionid", "txnid", "invoiceid"},
    "transaction_date": {"date", "saledate", "orderdate", "transactiondate"},
    "transaction_time": {"time", "saletime", "transactiontime"},
    "transaction_qty": {"quantity", "qty", "unitssold", "transactionqty"},
    "store_id": {"storeid", "branchid"},
    "store_location": {"location", "saleschannel", "storelocation"},
    "product_id": {"productid", "sku", "skuid"},
    "unit_price": {"price", "priceperunit", "unitprice"},
    "total_spent": {"amount", "salesamount", "totalspent", "transactionamount"},
    "product_category": {"category", "productcategory"},
    "product_type": {"item", "product", "itemname", "productname", "producttype"},
    "product_detail": {"item", "product", "itemname", "productname", "productdetail"},
    "discount": {"discount", "discountpercentage"},
    "returned": {"returned", "isreturned", "returnstatus"},
    "customer_id": {"customerid", "customer"},
    "payment_method": {"paymentmethod", "paymenttype"},
    "region": {"region"},
    "customer_segment": {"customersegment", "segment"},
    "rating": {"rating", "reviewrating"},
}
CORE_FIELDS = (
    "transaction_id",
    "transaction_date",
    "transaction_qty",
    "product_category",
    "product_detail",
)
OPTIONAL_FIELDS = (
    "transaction_time",
    "store_id",
    "store_location",
    "product_id",
    "unit_price",
    "product_type",
    "discount",
    "returned",
    "customer_id",
    "payment_method",
    "region",
    "customer_segment",
    "rating",
)


def _header_key(value):
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_text = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]", "", ascii_text.lower())


def _missing(value):
    return value is None or not str(value).strip() or str(value).strip().lower() in {
        "n/a",
        "na",
        "null",
        "none",
        "unknown",
        "error",
    }


def _parse_integer(value, field):
    text = str(value).strip()
    if field == "transaction_qty":
        match = re.fullmatch(r"([+-]?\d+)\s*(?:pcs?|units?)?", text, re.IGNORECASE)
        if match:
            return int(match.group(1))
    try:
        numeric = Decimal(text)
    except InvalidOperation as error:
        raise ValueError(f"{field} không phải số nguyên") from error
    if not numeric.is_finite() or numeric != numeric.to_integral_value():
        raise ValueError(f"{field} không phải số nguyên")
    return int(numeric)


def _parse_decimal(value, field, allow_negative=False):
    text = str(value).strip().replace("$", "").replace("€", "").replace("£", "")
    text = text.replace(" ", "")
    if "," in text:
        if re.fullmatch(r"-?\d{1,3}(,\d{3})+(\.\d+)?", text):
            text = text.replace(",", "")
        else:
            raise ValueError(f"{field} có dấu phân cách không rõ nghĩa")
    try:
        result = Decimal(text)
    except InvalidOperation as error:
        raise ValueError(f"{field} không phải số hợp lệ") from error
    if not result.is_finite() or (not allow_negative and result < 0):
        raise ValueError(f"{field} nằm ngoài miền giá trị hợp lệ")
    return result


def _parse_date(value, date_format="auto"):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for parser in (
        lambda item: datetime.fromisoformat(item).date(),
        date.fromisoformat,
        lambda item: datetime.strptime(item, "%Y/%m/%d").date(),
    ):
        try:
            return parser(text)
        except ValueError:
            continue
    match = re.fullmatch(r"(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})", text)
    if match:
        first, second, year = (int(part) for part in match.groups())
        if year < 100:
            year += 2000 if year < 70 else 1900
        if first > 12 and second <= 12:
            return date(year, second, first)
        if second > 12 and first <= 12:
            return date(year, first, second)
        if first <= 12 and second <= 12 and date_format in {"day_first", "month_first"}:
            month, day = (
                (second, first)
                if date_format == "day_first"
                else (first, second)
            )
            try:
                return date(year, month, day)
            except ValueError:
                pass
        if first <= 12 and second <= 12:
            raise ValueError(
                "transaction_date mơ hồ; cần chọn thứ tự ngày/tháng ở bước xem trước"
            )
    raise ValueError("transaction_date không phải ngày hợp lệ")


def _parse_time(value):
    text = str(value).strip()
    for parser in (
        time.fromisoformat,
        lambda item: datetime.strptime(item, "%I:%M %p").time(),
        lambda item: datetime.strptime(item, "%I:%M:%S %p").time(),
    ):
        try:
            return parser(text).replace(microsecond=0)
        except ValueError:
            continue
    raise ValueError("transaction_time không phải giờ hợp lệ")


def _map_headers(headers):
    mapped = {}
    unmapped = []
    for header in headers:
        key = _header_key(header)
        matches = [
            field
            for field, aliases in ALIASES.items()
            if key == _header_key(field) or key in aliases
        ]
        if not matches:
            unmapped.append(header)
            continue
        for field in matches:
            if field not in mapped:
                mapped[field] = header
    if "product_detail" not in mapped and "product_type" in mapped:
        mapped["product_detail"] = mapped["product_type"]
    if "product_type" not in mapped and "product_detail" in mapped:
        mapped["product_type"] = mapped["product_detail"]
    return mapped, unmapped


def _read_csv(contents):
    try:
        text = contents.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise ValueError("CSV phải được mã hóa UTF-8.") from error
    rows = list(csv.reader(io.StringIO(text)))
    header_index = None
    headers = []
    for index, row in enumerate(rows[:10]):
        candidate = [value.strip() for value in row]
        mapping, _ = _map_headers(candidate)
        if {"transaction_id", "transaction_date", "transaction_qty"} <= mapping.keys():
            header_index = index
            headers = candidate
            break
    if header_index is None:
        raise ValueError("CSV không có dòng tiêu đề.")
    data_rows = [
        {
            headers[index]: row[index] if index < len(row) else ""
            for index in range(len(headers))
        }
        for row in rows[header_index + 1 :]
    ]
    if len(data_rows) > 250_000:
        raise ValueError("CSV vượt giới hạn 250.000 dòng.")
    return headers, data_rows, header_index


def _raw_signature(row, headers):
    return tuple((row.get(header) or "").strip() for header in headers)


def _normalize_row(row, mapping, amount_source, date_format):
    def value(field):
        source = mapping.get(field)
        return row.get(source) if source else None

    required = {
        "transaction_id": value("transaction_id"),
        "transaction_date": value("transaction_date"),
        "transaction_qty": value("transaction_qty"),
        "product_category": value("product_category"),
        "product_detail": value("product_detail"),
    }
    missing = [field for field, item in required.items() if _missing(item)]
    if missing:
        raise ValueError(f"thiếu trường bắt buộc: {', '.join(missing)}")

    transaction_id = str(required["transaction_id"]).strip()
    if len(transaction_id) > 120:
        raise ValueError("transaction_id vượt quá 120 ký tự")
    quantity = _parse_integer(required["transaction_qty"], "transaction_qty")
    sale_date = _parse_date(required["transaction_date"], date_format)
    time_value = value("transaction_time")
    sale_time = None if _missing(time_value) else _parse_time(time_value)

    unit_price_value = value("unit_price")
    unit_price = (
        None
        if _missing(unit_price_value)
        else float(_parse_decimal(unit_price_value, "unit_price"))
    )
    amount_value = value(amount_source)
    if amount_source == "calculated":
        if unit_price is None:
            raise ValueError("không thể tính tiền dòng vì thiếu unit_price")
        line_revenue = quantity * unit_price
    elif _missing(amount_value):
        raise ValueError(f"thiếu trường số tiền nguồn: {amount_source}")
    else:
        line_revenue = float(
            _parse_decimal(amount_value, amount_source, allow_negative=True)
        )

    category = str(required["product_category"]).strip()
    product = str(required["product_detail"]).strip()
    location_value = value("store_location")
    product_type_value = value("product_type")
    store_id_value = value("store_id")
    product_id_value = value("product_id")
    store_id = (
        None
        if _missing(store_id_value)
        else str(store_id_value).strip()
    )
    product_id = (
        None
        if _missing(product_id_value)
        else str(product_id_value).strip()
    )
    location = None if _missing(location_value) else str(location_value).strip()
    product_type = (
        product if _missing(product_type_value) else str(product_type_value).strip()
    )
    if any(value is not None and len(value) > 120 for value in (store_id, product_id)):
        raise ValueError("store_id hoặc product_id vượt quá 120 ký tự")
    if len(category) > 160 or len(product_type) > 200 or len(product) > 300:
        raise ValueError("một trường sản phẩm vượt giới hạn độ dài")
    if location is not None and len(location) > 160:
        raise ValueError("store_location vượt giới hạn 160 ký tự")
    return {
        "transaction_id": transaction_id,
        "transaction_date": sale_date,
        "transaction_time": sale_time,
        "transaction_qty": quantity,
        "store_id": store_id,
        "store_location": location,
        "product_id": product_id,
        "unit_price": unit_price,
        "line_revenue": line_revenue,
        "product_category": category,
        "product_type": product_type,
        "product_detail": product,
        "source_attributes": {
            header: (row.get(header) or "").strip()
            for header in row
            if header
            and header
            not in {
                mapping.get(field)
                for field in (
                    "transaction_id",
                    "transaction_date",
                    "transaction_time",
                    "transaction_qty",
                    "store_id",
                    "store_location",
                    "product_id",
                    "unit_price",
                    "total_spent",
                    "product_category",
                    "product_type",
                    "product_detail",
                )
            }
        },
        "transaction_date_source": sale_date,
    }


def preview_csv(contents, amount_source=None, date_format="auto"):
    if date_format not in {"auto", "day_first", "month_first"}:
        raise ValueError("date_format phải là auto, day_first hoặc month_first.")
    headers, rows, header_index = _read_csv(contents)
    mapping, unmapped = _map_headers(headers)
    available_amount_sources = [
        key
        for key in ("total_spent", "calculated")
        if (key == "calculated" and "unit_price" in mapping)
        or key in mapping
    ]
    if amount_source is None:
        amount_source = (
            "total_spent"
            if "total_spent" in available_amount_sources
            else "calculated"
            if "calculated" in available_amount_sources
            else None
        )
    elif amount_source not in available_amount_sources:
        amount_source = None

    missing_columns = [
        field for field in CORE_FIELDS if field not in mapping
    ]
    if amount_source is None:
        missing_columns.append("total_spent hoặc unit_price")
    if amount_source == "calculated" and "unit_price" not in mapping:
        missing_columns.append("unit_price")

    nonblank_rows = [
        row for row in rows if not all(_missing(row.get(header)) for header in headers)
    ]
    signatures = Counter(_raw_signature(row, headers) for row in nonblank_rows)
    duplicate_rows = sum(count - 1 for count in signatures.values() if count > 1)
    duplicate_transaction_rows = sum(
        count - 1
        for count in Counter(
            (row.get(mapping.get("transaction_id", "")) or "").strip()
            for row in nonblank_rows
            if not _missing(row.get(mapping.get("transaction_id", "")))
        ).values()
        if count > 1
    )

    errors = []
    normalized_preview = []
    valid_count = 0
    invalid_count = 0
    valid_after_dedup_count = 0
    invalid_after_dedup_count = 0
    ambiguous_date_count = 0
    negative_amount_count = 0
    returned_flagged_count = 0
    first_date = None
    last_date = None
    missing_counts = Counter()
    seen_signatures = set()
    for row_number, row in enumerate(rows, start=header_index + 2):
        if all(_missing(row.get(header)) for header in headers):
            missing_counts["blank_rows"] += 1
            continue
        signature = _raw_signature(row, headers)
        is_duplicate = signature in seen_signatures
        seen_signatures.add(signature)
        for field in OPTIONAL_FIELDS:
            source = mapping.get(field)
            if source and _missing(row.get(source)):
                missing_counts[field] += 1
        if "returned" in mapping and str(
            row.get(mapping["returned"], "")
        ).strip().lower() in {"1", "1.0", "true"}:
            returned_flagged_count += 1
        if amount_source and amount_source != "calculated":
            amount_value = row.get(mapping.get(amount_source, ""))
            if not _missing(amount_value):
                try:
                    if _parse_decimal(
                        amount_value, amount_source, allow_negative=True
                    ) < 0:
                        negative_amount_count += 1
                except ValueError:
                    pass
        try:
            normalized = _normalize_row(
                row, mapping, amount_source, date_format
            )
            valid_count += 1
            sale_date = normalized["transaction_date_source"]
            first_date = min(first_date, sale_date) if first_date else sale_date
            last_date = max(last_date, sale_date) if last_date else sale_date
            if not is_duplicate:
                valid_after_dedup_count += 1
            if len(normalized_preview) < 5:
                normalized_preview.append(
                    {
                        key: (
                            value.isoformat()
                            if isinstance(value, (date, time))
                            else value
                        )
                        for key, value in normalized.items()
                        if key not in {"source_attributes", "transaction_date_source"}
                    }
                )
        except ValueError as error:
            invalid_count += 1
            if not is_duplicate:
                invalid_after_dedup_count += 1
            if "transaction_date mơ hồ" in str(error):
                ambiguous_date_count += 1
            if len(errors) < 30:
                errors.append({"row": row_number, "message": str(error)})

    return {
        "headers": headers,
        "preamble_rows": header_index,
        "mapping": mapping,
        "unmapped_columns": unmapped,
        "unused_columns": [
            header
            for header in headers
            if header
            not in {
                mapping.get(field)
                for field in (
                    "transaction_id",
                    "transaction_date",
                    "transaction_time",
                    "transaction_qty",
                    "store_id",
                    "store_location",
                    "product_id",
                    "unit_price",
                    "total_spent",
                    "product_category",
                    "product_type",
                    "product_detail",
                )
            }
        ],
        "missing_optional_columns": [
            field for field in OPTIONAL_FIELDS if field not in mapping
        ],
        "missing_columns": missing_columns,
        "available_amount_sources": available_amount_sources,
        "amount_source": amount_source,
        "date_format": date_format,
        "ambiguous_date_rows": ambiguous_date_count,
        "negative_amount_rows": negative_amount_count,
        "returned_flagged_rows": returned_flagged_count,
        "total_rows": len(rows),
        "first_date": first_date.isoformat() if first_date else None,
        "last_date": last_date.isoformat() if last_date else None,
        "blank_rows": missing_counts.pop("blank_rows", 0),
        "valid_rows_before_deduplication": valid_count,
        "valid_rows_after_deduplication": valid_after_dedup_count,
        "exact_duplicate_rows": duplicate_rows,
        "duplicate_transaction_rows": duplicate_transaction_rows,
        "invalid_rows": invalid_count,
        "invalid_rows_after_deduplication": invalid_after_dedup_count,
        "error_examples": errors,
        "missing_optional_values": dict(missing_counts),
        "normalized_preview": normalized_preview,
        "ready": not missing_columns and valid_count > 0,
    }


def normalize_csv(
    contents,
    amount_source,
    deduplicate_exact,
    drop_invalid_rows,
    date_format="auto",
):
    preview = preview_csv(contents, amount_source, date_format)
    if preview["missing_columns"]:
        raise ValueError(
            "Không nhận diện đủ trường cần thiết: "
            + ", ".join(preview["missing_columns"])
        )
    headers, rows, _ = _read_csv(contents)
    mapping = preview["mapping"]
    amount_source = preview["amount_source"]
    seen_signatures = set()
    records = []
    errors = []
    first_date = None
    last_date = None
    exact_duplicates_removed = 0
    invalid_rows_removed = 0
    invalid_row_count = 0
    for row_number, row in enumerate(rows, start=preview["preamble_rows"] + 2):
        signature = _raw_signature(row, headers)
        if all(_missing(value) for value in signature):
            continue
        if signature in seen_signatures:
            if deduplicate_exact:
                exact_duplicates_removed += 1
                continue
            raise ValueError(
                f"Dòng {row_number}: dòng trùng hoàn toàn; cần bật xác nhận loại bản sao."
            )
        seen_signatures.add(signature)
        try:
            record = _normalize_row(
                row, mapping, amount_source, date_format
            )
        except ValueError as error:
            if drop_invalid_rows:
                invalid_rows_removed += 1
                continue
            invalid_row_count += 1
            if len(errors) < 20:
                errors.append(f"Dòng {row_number}: {error}")
            continue
        sale_date = record.pop("transaction_date_source")
        first_date = min(first_date, sale_date) if first_date else sale_date
        last_date = max(last_date, sale_date) if last_date else sale_date
        records.append(record)
    if errors:
        raise ValueError(
            f"Có {invalid_row_count} dòng không hợp lệ chưa được xử lý "
            f"({len(errors)} lỗi đầu tiên): "
            + "; ".join(errors)
        )
    if not records:
        raise ValueError("Không còn dòng hợp lệ để nạp.")
    return records, first_date, last_date, {
        "source_format": (
            "coffee_shop_sales"
            if {"transaction_time", "store_id", "product_id"} <= mapping.keys()
            else "custom_sales"
        ),
        "amount_source": amount_source,
        "date_format": date_format,
        "exact_duplicates_removed": exact_duplicates_removed,
        "invalid_rows_removed": invalid_rows_removed,
        "blank_rows_removed": preview["blank_rows"],
        "preamble_rows_skipped": preview["preamble_rows"],
        "unmapped_columns": preview["unmapped_columns"],
        "missing_optional_values": preview["missing_optional_values"],
        "missing_optional_columns": preview["missing_optional_columns"],
        "negative_amount_rows": preview["negative_amount_rows"],
        "returned_flagged_rows": preview["returned_flagged_rows"],
        "warning_returned_rows": preview["returned_flagged_rows"],
    }
