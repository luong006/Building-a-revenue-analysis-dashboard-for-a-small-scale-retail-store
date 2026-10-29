# Dashboard phân tích doanh thu bán lẻ

Đồ án ISV3010 xây dựng dashboard phân tích dữ liệu bán hàng lịch sử của một cửa hàng cà phê giả lập. Mục tiêu là giúp người xem nhận biết quy mô giao dịch, doanh thu theo sản phẩm và biến động theo thời gian.

Dashboard **không** tính lợi nhuận, giá vốn, tồn kho hiện tại hay nhu cầu nhập hàng. Dataset chỉ chứa dữ liệu bán hàng. Các định nghĩa chỉ số, giới hạn diễn giải và luồng làm sạch dữ liệu được ghi trong [`docs/technical_architecture.md`](docs/technical_architecture.md) và [`docs/data_dictionary.md`](docs/data_dictionary.md).

## Kiến trúc

```text
Workbook nguồn
    ↓ làm sạch thủ công trong Google Sheets
CSV chuẩn hóa được lưu trong GitHub sau khi làm sạch
    ↓
FastAPI + DuckDB (Render; truy vấn CSV ở chế độ chỉ đọc)
    ↓ HTTPS API
React + Vite (Vercel)
```

Đây là monorepo. GitHub là nguồn mã và dữ liệu sạch; Vercel và Render tự build/deploy khi có thay đổi trên nhánh đã cấu hình. Backend kiểm tra CSV khi cần truy vấn; không cần cơ sở dữ liệu ghi/đọc từ xa cho phạm vi hiện tại.

```text
backend/
  app/
    api/routes.py       # API và kiểm tra tham số
    core/config.py      # Đường dẫn dữ liệu, CORS, đơn vị tiền tệ tùy chọn
    core/db.py          # Kiểm tra CSV, DuckDB read-only view
    core/metrics.py     # Tổng hợp KPI, theo giờ, theo sản phẩm
    models/schemas.py   # Hợp đồng response
  data/                 # CLEAN - Transactions.csv đã làm sạch
  tests/                # Unit tests cho công thức và bộ lọc
  requirements.txt
frontend/
  src/
    components/
    services/api.js
    App.jsx
docs/
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

### Frontend

```powershell
cd frontend
npm ci
npm run dev
```

Mặc định frontend gọi `http://localhost:8000`. Để gọi backend khác, đặt biến môi trường `VITE_API_BASE_URL` trước khi build; ví dụ `https://<render-service>.onrender.com`.

## Dataset và chỉ số

- Dữ liệu nguồn: [Coffee Shop Sales của Ahmedabbas75](https://github.com/Ahmedabbas75/Coffee-Shop-Sales), cửa hàng giả lập Maven Roasters.
- CSV chuẩn hóa: `backend/data/CLEAN - Transactions.csv`; backend dùng file này theo mặc định. Có thể đặt `DATA_PATH` để dùng file khác khi cần.
- Quy trình cập nhật: lưu bản raw riêng → làm sạch và chuẩn hóa → xuất CSV UTF-8 đúng schema → cập nhật file trên → chạy tests và kiểm tra API.
- Chỉ số: doanh thu bán hàng (`transaction_qty × unit_price`), số mã giao dịch duy nhất, số lượng bán, AOV, UPT, ASP; cơ cấu theo danh mục/địa điểm; xu hướng ngày/tháng; phân tích giờ/thứ; xếp hạng sản phẩm theo doanh thu và số lượng; so sánh kỳ liền trước khi có đủ khoảng ngày.
- Đơn vị báo cáo hiển thị: USD theo quyết định của đồ án. Sales tax NYC 8,875% chỉ hiển thị như kịch bản ước tính riêng với giả định toàn bộ giao dịch chịu thuế và giá chưa gồm thuế; không phải tax collected thực tế. Xem [`docs/financial_model.md`](docs/financial_model.md).

Xem [hợp đồng dữ liệu và giới hạn diễn giải](docs/technical_architecture.md) trước khi thêm chỉ số hoặc mở rộng phạm vi.
GitHub Actions chạy backend tests và frontend build cho mỗi push/PR lên `main`.
