# Khung kỹ thuật

## 1. Phạm vi

Phiên bản hiện tại phân tích dữ liệu bán hàng theo địa điểm, khoảng ngày, giờ, danh mục và sản phẩm. Đây là dashboard mô tả dữ liệu lịch sử, không phải hệ thống POS hay hệ thống kế toán.

Không suy ra lợi nhuận, biên lợi nhuận, giá vốn, tồn kho hiện tại, hàng thiếu/hàng dư, vốn lưu động hay tác động nhân quả từ CSV này. Các chức năng tồn kho chỉ được xem xét lại khi có dữ liệu nhập hàng, tồn kho theo thời điểm và giá vốn phù hợp.

## 2. Nguồn dữ liệu và luồng cập nhật

1. Tải workbook công khai từ repository nguồn.
2. Làm sạch thủ công trong Google Sheets theo [data dictionary](data_dictionary.md).
3. Xuất CSV UTF-8, làm sạch và xác thực rồi lưu tại `backend/data/CLEAN - Transactions.csv`.
4. Chạy backend tests, build frontend và kiểm tra `/api/metadata`.
5. Commit/push CSV cùng thay đổi mã nguồn. Render và Vercel deploy từ GitHub.

Sau khi làm sạch, CSV trong repository là bản dữ liệu được triển khai. Backend không đọc Google Sheets trực tiếp và không cần thông tin đăng nhập Google. Trước khi CSV được thêm vào, backend vẫn deploy được nhưng API phân tích trả HTTP 503 cùng trạng thái `missing`. Không lưu workbook gốc hoặc thông tin nhạy cảm trong repository.

## 3. Thành phần

| Thành phần | Trách nhiệm | Triển khai |
|---|---|---|
| React + Vite | Hiển thị các chỉ số và gọi API | Vercel, root `frontend` |
| FastAPI | Hợp đồng REST, xác thực tham số, CORS | Render, root `backend` |
| DuckDB | Truy vấn tổng hợp trên CSV ở chế độ chỉ đọc | Cùng tiến trình backend |
| CSV sạch | Nguồn chuẩn, được kiểm tra khi khởi tạo | `backend/data/CLEAN - Transactions.csv` |

Không dùng database có trạng thái cho phiên bản này. DuckDB tạo view trên CSV khi khởi động; API không sửa file nguồn. Các truy vấn dùng tham số bind và được tuần tự hóa trên kết nối DuckDB dùng chung.

## 4. Hợp đồng chỉ số

Gọi:

- `R`: tổng `transaction_qty × unit_price` của các dòng trong phạm vi lọc.
- `N`: số `transaction_id` duy nhất.
- `Q`: tổng `transaction_qty`.

| Chỉ số | Định nghĩa |
|---|---|
| Doanh thu bán hàng | `R`; giá trị bán hàng được ghi nhận trong nguồn. Không phải lợi nhuận. |
| Số giao dịch | `N`; số mã giao dịch duy nhất, không phải số lượt khách. |
| Số sản phẩm bán ra | `Q`; tổng số lượng ghi nhận. |
| AOV | `R / N`; bằng 0 khi không có giao dịch. |
| UPT | `Q / N`; bằng 0 khi không có giao dịch. |
| ASP | `R / Q`; bằng 0 khi không có sản phẩm bán ra. |
| Tỷ trọng doanh thu sản phẩm | Doanh thu sản phẩm / `R` × 100; bằng 0 khi `R = 0`. |

Theo định nghĩa trên, `R = N × UPT × ASP` trước sai số làm tròn. `R` được dẫn xuất từ `transaction_qty × unit_price`; nếu workbook cho thấy có giảm giá, hoàn trả hoặc thuế cần xử lý, phải thống nhất lại trước khi sử dụng chỉ số.

## 5. API hiện tại

Các endpoint phân tích nhận bộ lọc tùy chọn `location`, `category`, `start_date`, `end_date`. Ngày dùng định dạng ISO `YYYY-MM-DD`; hai đầu mút được tính gồm. `start_date` sau `end_date` trả HTTP 422.

| Endpoint | Mô tả |
|---|---|
| `GET /healthz` | Liveness probe cho Render; không phụ thuộc dataset |
| `GET /api/health` | Trạng thái API và dataset (`available`, `missing` hoặc `invalid`) |
| `GET /api/metadata` | Số dòng, ngày đầu/cuối và mã tiền tệ nếu đã cấu hình |
| `GET /api/locations` | Các địa điểm có trong CSV |
| `GET /api/categories` | Các danh mục có trong CSV |
| `GET /api/metrics/summary` | Doanh thu, giao dịch, số lượng, AOV, UPT, ASP |
| `GET /api/metrics/hourly` | Tổng hợp theo giờ |
| `GET /api/metrics/trend` | Chuỗi doanh thu theo ngày hoặc tháng; `granularity=day|month` |
| `GET /api/metrics/top-products` | Xếp hạng doanh thu sản phẩm; `limit` từ 1 đến 50 |

Frontend không dùng fallback dữ liệu giả khi API lỗi; lỗi được hiển thị thay cho số liệu. Các bộ lọc ngày tùy chỉnh có sẵn ở API để giao diện tiếp theo kết nối chính xác với dữ liệu lịch sử, không dùng bộ lọc “hôm nay” theo ngày hiện tại.

## 6. Cấu hình môi trường

| Biến | Mặc định | Mục đích |
|---|---|---|
| `DATA_PATH` | `backend/data/CLEAN - Transactions.csv` | Đường dẫn CSV sạch; có thể ghi đè khi triển khai |
| `CORS_ORIGINS` | `http://localhost:5173` | Danh sách origin, phân cách bằng dấu phẩy |
| `CURRENCY_CODE` | Không cấu hình | Mã tiền tệ chỉ đặt sau khi xác minh nguồn |
| `VITE_API_BASE_URL` | `http://localhost:8000` | URL backend được nhúng lúc build frontend |

Nếu triển khai Vercel production/preview với origin giới hạn, cấu hình các origin frontend cần thiết trong `CORS_ORIGINS` trên Render. API hiện là API đọc dữ liệu công khai, không có tài khoản hoặc cookie.

## 7. Kiểm soát chất lượng

- Khi CSV chưa có, backend vẫn khởi động để triển khai; analytics trả HTTP 503 nêu rõ yêu cầu thêm dataset.
- Khi CSV đã có, ứng dụng từ chối phân tích nếu thiếu cột bắt buộc, rỗng, có mã giao dịch trùng, hoặc có dòng thiếu/sai kiểu dữ liệu, số lượng không dương hay giờ ngoài `0–23`.
- Các bộ lọc SQL dùng tham số bind; không nối dữ liệu người dùng vào SQL.
- KPI có kiểm thử cho số 0, lọc ngày/địa điểm/danh mục và tỷ trọng.
- Không commit `.env`, virtualenv, `node_modules`, build output hoặc workbook không cần thiết.
- Trước deploy: chạy backend tests, `npm run build`, xác minh `/healthz`; sau khi có dữ liệu, xác minh `/api/health` và metadata.
