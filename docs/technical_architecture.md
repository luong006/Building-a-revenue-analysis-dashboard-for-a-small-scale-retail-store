# Khung kỹ thuật

## 1. Phạm vi

Phiên bản hiện tại phân tích dữ liệu bán hàng theo địa điểm, khoảng ngày, giờ, danh mục và sản phẩm. Đây là dashboard mô tả dữ liệu lịch sử, không phải hệ thống POS hay hệ thống kế toán.

Không suy ra lợi nhuận, biên lợi nhuận, giá vốn, tồn kho hiện tại, hàng thiếu/hàng dư, vốn lưu động hay tác động nhân quả từ CSV này. Các chức năng tồn kho chỉ được xem xét lại khi có dữ liệu nhập hàng, tồn kho theo thời điểm và giá vốn phù hợp.

## 2. Nguồn dữ liệu và luồng cập nhật

1. Khi khởi động với `DATABASE_URL`, backend tạo schema và nhập CSV Coffee mẫu vào PostgreSQL nếu dataset mẫu chưa tồn tại.
2. Người dùng đăng ký/đăng nhập; API phát JWT có thời hạn 60 phút.
3. Người dùng tải CSV UTF-8 theo schema chuẩn; backend kiểm tra rồi lưu dataset và giao dịch trong transaction PostgreSQL.
4. Mọi truy vấn xác thực chủ sở hữu; dataset mẫu là read-only dùng chung, dataset upload chỉ hiển thị với owner.
5. FastAPI tính KPI theo bộ lọc; Redis cache JSON 5 phút theo user, dataset và bộ lọc.

Workbook nguồn được làm sạch qua `backend/scripts/clean_sales_data.py` thành CSV chuẩn; đây là bước ETL ngoại tuyến trước khi upload. Hướng dẫn chi tiết ở [quy trình ETL](etl_process.md). Backend không đọc Google Sheets hoặc workbook trực tiếp. File người dùng upload không được ghi vào ổ đĩa ephemeral của Render; PostgreSQL là nguồn lưu trữ bền vững.

## 3. Thành phần

| Thành phần | Trách nhiệm | Triển khai |
|---|---|---|
| React + Vite | Đăng nhập, chọn dataset, upload CSV, dashboard | Vercel, root `frontend` |
| FastAPI | JWT auth, kiểm tra CSV, API analytics, CORS | Render, root `backend` |
| PostgreSQL | Users, datasets, transactions; owner isolation | Render PostgreSQL |
| Redis | Cache analytics responses, TTL 300s | Render Redis |
| CSV sạch | Nguồn seed dataset mẫu ban đầu | `backend/data/CLEAN - Transactions.csv` |

Redis không phải nguồn dữ liệu chính; khi cache miss hoặc Redis chưa sẵn sàng, API tính từ PostgreSQL và ghi log cảnh báo. Cache key chứa user ID, dataset ID và toàn bộ bộ lọc; dataset upload tạo ID mới nên không thể nhận nhầm dữ liệu/cache của account khác.

## 4. Hợp đồng chỉ số

Gọi:

- `R`: tổng `transaction_qty × unit_price` của các dòng trong phạm vi lọc.
- `N`: số `transaction_id` duy nhất có trong nguồn.
- `Q`: tổng `transaction_qty`.

| Chỉ số | Định nghĩa |
|---|---|
| Doanh thu bán hàng | `R`; giá trị bán hàng được ghi nhận trong nguồn. Không phải lợi nhuận. |
| Mã giao dịch nguồn | `N`; số ID duy nhất trong file. Không khẳng định là số đơn/giỏ hàng hay số lượt khách. |
| Số sản phẩm bán ra | `Q`; tổng số lượng ghi nhận. |
| Doanh thu bình quân/ID nguồn | `R / N`; bằng 0 khi không có ID. Không diễn giải là AOV đơn hàng. |
| Số lượng bình quân/ID nguồn | `Q / N`; bằng 0 khi không có ID. Không diễn giải là UPT đơn hàng. |
| ASP | `R / Q`; bằng 0 khi không có sản phẩm bán ra. |
| Tỷ trọng doanh thu sản phẩm | Doanh thu sản phẩm / `R` × 100; bằng 0 khi `R = 0`. |

Các thuộc tính API `aov` và `upt` hiện được giữ vì tương thích nội bộ, nhưng giao diện và tài liệu gọi chúng là trung bình trên ID nguồn; không phải AOV/UPT của đơn hàng. Trong workbook hiện tại, từng ID chỉ xuất hiện một lần nên cần có `order_id`/`basket_id` đã được xác minh nếu muốn đưa ra chỉ số theo đơn hoặc xếp hạng SKU theo số đơn chứa SKU đó. Dashboard còn hiển thị doanh thu và số lượng theo danh mục/địa điểm/sản phẩm, xu hướng ngày/tháng, doanh thu theo giờ và doanh thu bình quân mỗi ngày có giao dịch theo thứ.

Khi có đủ ngày bắt đầu/kết thúc, dashboard có thể so sánh với khoảng liền trước cùng độ dài. Các nút nhanh 7/14/28 ngày và 1 tháng kết thúc tại ngày mới nhất của dataset; nếu dataset ngắn hơn preset, ngày đầu được giới hạn về ngày đầu tiên có dữ liệu. Mốc 1 tháng cùng ngày của tháng trước; nếu ngày đó không tồn tại thì dùng ngày cuối tháng trước.

Doanh thu được tính từ `transaction_qty × unit_price`, không bao gồm điều chỉnh thuế/giảm giá/hoàn tiền do CSV không cung cấp. USD là đơn vị báo cáo theo quyết định của đồ án; chưa xác minh độc lập mã tiền tệ trong nguồn.

### Kịch bản sales tax riêng

Dashboard hiển thị thêm kịch bản `R × 8.875%`, tham chiếu combined NYC rate cho các địa điểm New York City trong dataset. Kịch bản giả định toàn bộ doanh thu chịu thuế và đơn giá chưa gồm thuế. Số này được gắn nhãn ước tính, tách khỏi doanh thu, không đại diện thuế thực thu/nộp và không được cộng vào doanh thu. CSV thiếu trạng thái dine-in/takeout, thông tin đóng gói/chế biến và taxability theo dòng nên không thể xác định thuế thực tế cho từng giao dịch. Nguồn và giới hạn chi tiết ở [financial model](financial_model.md).

## 5. API hiện tại

Các endpoint phân tích nhận bộ lọc tùy chọn `location`, `category`, `start_date`, `end_date`. Ngày dùng định dạng ISO `YYYY-MM-DD`; hai đầu mút được tính gồm. `start_date` sau `end_date` trả HTTP 422.

| Endpoint | Mô tả |
|---|---|
| `POST /api/auth/register` | Đăng ký email và mật khẩu (tối thiểu 12 ký tự) |
| `POST /api/auth/login` | Đăng nhập và nhận JWT |
| `GET /api/auth/me` | Tài khoản hiện tại |
| `GET /api/datasets` | Dataset mẫu và dataset thuộc tài khoản |
| `POST /api/datasets/upload` | Validate CSV và lưu dataset riêng (25 MB, tối đa 250.000 dòng) |
| `PATCH /api/datasets/{id}` | Đổi tên dataset cá nhân của chủ sở hữu |
| `DELETE /api/datasets/{id}` | Xóa dataset cá nhân và các giao dịch thuộc dataset |
| `GET /api/datasets/{id}/dashboard` | Dashboard theo dataset; cần access token trong header Authorization |
| `GET /api/cache-status` | Trạng thái kết nối Redis |
| `GET /healthz` | Liveness probe cho Render; không phụ thuộc dataset |
| `GET /api/health` | Trạng thái API và dataset (`available`, `missing` hoặc `invalid`) |
| `GET /api/metadata` | Số dòng, ngày đầu/cuối và mã tiền tệ báo cáo (`USD`) |
| `GET /api/locations` | Các địa điểm có trong CSV |
| `GET /api/categories` | Các danh mục có trong CSV |
| `GET /api/metrics/summary` | Doanh thu, mã giao dịch nguồn, số lượng, trung bình trên ID nguồn, ASP; field API `aov` / `upt` giữ vì tương thích |
| `GET /api/metrics/hourly` | Tổng hợp theo giờ |
| `GET /api/metrics/trend` | Chuỗi doanh thu theo ngày hoặc tháng; `granularity=day|month` |
| `GET /api/metrics/top-products` | Xếp hạng theo doanh thu hoặc số lượng, kèm số lượng, doanh thu và tỷ trọng; `sort_by=revenue|quantity`, `limit` từ 1 đến 50 |

Frontend không dùng fallback dữ liệu giả khi API lỗi; lỗi được hiển thị thay cho số liệu. Báo cáo nêu dataset, khoảng ngày và bộ lọc hiện hành. Chọn danh mục/địa điểm trên biểu đồ cơ cấu hoặc chú giải sẽ áp dụng bộ lọc tương ứng cho toàn bộ dashboard; chọn lại mục đang chọn sẽ bỏ riêng bộ lọc đó. Nhận xét nhanh được tạo bằng quy tắc xác định từ sản phẩm có doanh thu cao nhất, giờ/ngày/tháng nổi bật và so sánh kỳ khi đủ lịch sử; không dùng AI, không đưa ra quan hệ nhân quả hay khuyến nghị kinh doanh.

Các endpoint `/api/metrics/*`, `/api/metadata`, `/api/locations` và `/api/categories` cũ vẫn phục vụ dataset CSV mẫu để tương thích. Frontend đăng nhập sử dụng `/api/datasets/{id}/dashboard`, endpoint này luôn kiểm tra user sở hữu dataset (ngoại trừ dataset mẫu read-only).

## 6. Cấu hình môi trường

| Biến | Mặc định | Mục đích |
|---|---|---|
| `DATA_PATH` | `backend/data/CLEAN - Transactions.csv` | Đường dẫn CSV sạch; có thể ghi đè khi triển khai |
| `CORS_ORIGINS` | localhost + Vercel production | Danh sách origin, phân cách bằng dấu phẩy |
| `CURRENCY_CODE` | `USD` | Mã tiền tệ báo cáo theo quyết định của đồ án |
| `VITE_API_BASE_URL` | `http://localhost:8000` | URL backend được nhúng lúc build frontend |
| `DATABASE_URL` | Không mặc định | PostgreSQL URL; bắt buộc cho đăng ký, upload, dataset API |
| `REDIS_URL` | Không mặc định | Redis URL; bật cache 5 phút khi được cấu hình |
| `JWT_SECRET` | Không mặc định | Khóa ký JWT; bắt buộc cho auth, phải giữ bí mật |

Frontend giữ access token trong `sessionStorage`; token hết hạn sau 60 phút và người dùng cần đăng nhập lại. API dùng Authorization Bearer, không dùng cookie. Không đưa dữ liệu nhạy cảm/PII vào CSV; HTTPS được yêu cầu ngoài môi trường local.

## 7. Kiểm soát chất lượng

- Các endpoint legacy đọc CSV giữ hành vi HTTP 503 nếu file mẫu thiếu; auth/dataset API yêu cầu `DATABASE_URL` và `JWT_SECRET`.
- CSV mẫu được import theo batch khi khởi tạo database; file upload được kiểm tra và ghi thành dataset riêng trước khi dashboard phân tích.
- Upload từ chối file trên 25 MB, hơn 250.000 dòng, thiếu cột, dữ liệu sai kiểu/miền, trường bắt buộc rỗng hoặc transaction ID trùng.
- Các bộ lọc SQL dùng tham số bind; không nối dữ liệu người dùng vào SQL.
- Redis cache có TTL 300 giây; cache key phân vùng theo user, dataset và bộ lọc, không cache thông tin xác thực.
- Test bao gồm công thức cũ, hash mật khẩu, kiểm tra CSV, phân quyền sở hữu dataset, seed một lần, lọc analytics và tách cache theo user.
- Không commit `.env`, virtualenv, `node_modules`, build output hoặc workbook không cần thiết.
- Trước deploy: chạy backend tests, `npm run build`, xác minh `/healthz`; sau khi có dữ liệu, xác minh `/api/health` và metadata.
