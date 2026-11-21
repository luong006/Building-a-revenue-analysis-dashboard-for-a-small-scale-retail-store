# Dashboard phân tích doanh thu bán lẻ

Đồ án ISV3010 xây dựng dashboard phân tích dữ liệu bán hàng lịch sử của một cửa hàng cà phê giả lập. Mục tiêu là giúp người xem nhận biết quy mô giao dịch, doanh thu theo sản phẩm và biến động theo thời gian.

Dashboard **không** tính lợi nhuận, giá vốn, tồn kho hiện tại hay nhu cầu nhập hàng. Dataset chỉ chứa dữ liệu bán hàng. Các định nghĩa chỉ số, giới hạn diễn giải và luồng làm sạch dữ liệu được ghi trong [`docs/technical_architecture.md`](docs/technical_architecture.md) và [`docs/data_dictionary.md`](docs/data_dictionary.md).

## Tiến độ dự án

**Cập nhật: 2026-11-21**

- Ứng dụng React/Vite và API FastAPI đã được triển khai trên Vercel và Render. Các health endpoint của Render phản hồi; cần tiếp tục kiểm tra luồng upload và dashboard đầu-cuối trên production.
- Đã có đăng ký/đăng nhập, dataset riêng theo tài khoản, preview CSV, lựa chọn xử lý lỗi/trùng, dashboard và bộ lọc phân tích.
- Đang hoàn thiện bước nhập liệu: thêm ánh xạ cột thủ công trong màn hình preview để xử lý tiêu đề CSV khác với các alias tự động nhận diện. Thay đổi này cần chạy CI và deploy trước khi được coi là có trên production.
- Kiểm tra cục bộ gần nhất: 7 test của bộ import CSV đạt; chưa chạy full backend suite hoặc frontend build trong môi trường này do thiếu dependencies Python và Node.js.
- Việc tiếp theo: chạy CI đầy đủ, deploy thay đổi mapping, sau đó thử upload một CSV có header không chuẩn và xác nhận dashboard trả KPI cho dataset mới.

Cập nhật mục này sau mỗi mốc kiểm thử hoặc deploy; ghi rõ ngày, kết quả và việc còn lại để README phản ánh đúng trạng thái sản phẩm.

## Kiến trúc

```text
Người dùng đăng nhập trên Vercel
    ↓ HTTPS + JWT
FastAPI (Render) ── PostgreSQL: tài khoản, metadata và giao dịch theo owner
    ├── Redis: cache kết quả phân tích có TTL
    └── dataset Coffee mẫu được nạp một lần từ CSV trong repository
```

CSV người dùng tải lên được kiểm tra và lưu như các dòng giao dịch trong PostgreSQL; từng dataset thuộc về đúng một tài khoản. Redis chỉ cache kết quả API, không phải nơi lưu dữ liệu lâu dài. Các bộ lọc và biểu đồ được tính lại theo dataset đang chọn.

```text
backend/
  app/
    api/routes.py       # API và kiểm tra tham số
    core/config.py      # Đường dẫn dữ liệu, CORS, đơn vị tiền tệ
    core/persistence.py # PostgreSQL models, schema khởi tạo và dataset mẫu
    core/auth.py        # Hash mật khẩu và JWT
    core/cache.py       # Redis cache
    api/user_routes.py  # Đăng ký, đăng nhập, upload, dashboard theo dataset
    core/metrics.py     # Tổng hợp KPI, theo giờ, theo sản phẩm
    models/schemas.py   # Hợp đồng response
  data/                 # CLEAN - Transactions.csv đã làm sạch
  scripts/              # ETL workbook XLSX sang CSV chuẩn
  tests/                # Unit tests cho công thức và bộ lọc
  requirements.txt
frontend/
  src/
    components/
    services/api.js
    AuthenticatedApp.jsx
docs/
  etl_process.md
  data_dictionary.md
  deployment_guide.md
  financial_model.md
  technical_architecture.md
research-metadata.md
render.yaml
```

## Chạy tại máy Windows

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

API: `http://localhost:8000`; tài liệu OpenAPI: `http://localhost:8000/docs`; liveness: `http://localhost:8000/healthz`; trạng thái dữ liệu: `http://localhost:8000/api/health`.

Chạy backend tests từ thư mục `backend`:

```powershell
python -m unittest discover -s tests
```

Làm sạch workbook nguồn thành CSV chuẩn trước khi upload:

```powershell
python -m pip install -r requirements.txt
python scripts/clean_sales_data.py "C:\data\Coffee-Shop-Sales.xlsx" --output "C:\data\coffee-clean.csv"
```

Quy trình, quy tắc kiểm tra và tình huống sử dụng được mô tả tại [`docs/etl_process.md`](docs/etl_process.md).

### Frontend

```powershell
cd frontend
npm ci
npm run dev
```

Mặc định frontend gọi `http://localhost:8000`. Để gọi backend khác, đặt biến môi trường `VITE_API_BASE_URL` trước khi build; ví dụ `https://<render-service>.onrender.com`.

## Dataset và chỉ số

- Dữ liệu nguồn: [Coffee Shop Sales của Ahmedabbas75](https://github.com/Ahmedabbas75/Coffee-Shop-Sales), cửa hàng giả lập Maven Roasters.
- Dataset mẫu: ưu tiên `backend/data/CLEAN - Transactions.csv`, nếu chưa có thì dùng `backend/data/Coffee Shop Sales.csv`; khi PostgreSQL đã cấu hình, backend nhập file được chọn một lần thành dataset mẫu chỉ đọc cho mọi tài khoản.
- Người dùng có thể đăng ký, đăng nhập và tải CSV theo schema giao dịch. File mới được lưu thành dataset riêng của tài khoản trong PostgreSQL, không ghi đè dataset mẫu hay dataset khác.
- Upload giới hạn 40 MiB và 250.000 dòng. CSV phải UTF-8 và cần có mã giao dịch nguồn, ngày, số lượng, danh mục, tên/loại sản phẩm cùng một nguồn doanh thu (cột tiền nguồn hoặc số lượng × đơn giá). Không bắt buộc đủ 11 cột Coffee; các cột tùy chọn có thể để trống.
- Hệ thống tự gợi ý ánh xạ tên cột phổ biến. Trong preview, người dùng có thể tự ánh xạ lại từng cột sang trường chuẩn, kiểm tra lại preview, chọn nguồn doanh thu, cách hiểu ngày mơ hồ và xác nhận riêng việc loại dòng lỗi hoặc trùng hoàn toàn. Không tự tạo mã giao dịch, sản phẩm hay giá trị tài chính bị thiếu.
- Chỉ số: doanh thu bán hàng (`transaction_qty × unit_price`), mã giao dịch nguồn duy nhất, số lượng bán, doanh thu bình quân/ID nguồn, số lượng bình quân/ID nguồn, ASP; cơ cấu theo danh mục/địa điểm; xu hướng ngày/tháng; phân tích giờ/thứ; xếp hạng sản phẩm theo doanh thu và số lượng; so sánh kỳ liền trước khi có đủ khoảng ngày. Do ID hiện tại chưa được xác minh là khóa giỏ hàng/đơn hàng, không diễn giải các trung bình này là AOV/UPT của đơn.
- Lợi nhuận, biên lợi nhuận và tồn kho hiện hiển thị chưa đủ dữ liệu; không ước tính từ doanh thu hoặc lượng bán.
- Báo cáo hiển thị dataset, kỳ và bộ lọc; chọn danh mục/địa điểm trên biểu đồ cơ cấu để lọc chéo. Nhận xét nhanh là mô tả số liệu bằng quy tắc xác định, không phải dự báo hay kết luận nguyên nhân.
- Đơn vị báo cáo hiển thị: USD theo quyết định của đồ án. Sales tax NYC 8,875% chỉ hiển thị như kịch bản ước tính riêng với giả định toàn bộ giao dịch chịu thuế và giá chưa gồm thuế; không phải tax collected thực tế. Xem [`docs/financial_model.md`](docs/financial_model.md).

Xem [hợp đồng dữ liệu và giới hạn diễn giải](docs/technical_architecture.md) trước khi thêm chỉ số hoặc mở rộng phạm vi.
GitHub Actions chạy backend tests và frontend build cho mỗi push/PR lên `main`.
