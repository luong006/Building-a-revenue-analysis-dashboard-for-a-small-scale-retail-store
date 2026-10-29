# Triển khai GitHub → Render + Vercel

## Mô hình deploy

Repository là monorepo. Kết nối cả Render và Vercel với repository GitHub, bật deploy tự động khi push lên nhánh chính. Hai dịch vụ dùng cùng repository nhưng root/build riêng.

Repository GitHub hiện tại: [luong006/Building-a-revenue-analysis-dashboard-for-a-small-scale-retail](https://github.com/luong006/Building-a-revenue-analysis-dashboard-for-a-small-scale-retail). GitHub Actions kiểm tra backend tests và frontend build; có thể yêu cầu CI thành công trong cài đặt bảo vệ nhánh `main`.

## 1. Render — backend

Tạo Web Service từ repository, cấu hình:

- Root Directory: `backend`
- Runtime: Python
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health Check Path: `/healthz` (không phụ thuộc CSV).
- `CORS_ORIGINS`: mặc định `*` cho API đọc dữ liệu công khai; có thể giới hạn thành origin Vercel production và preview, phân cách bằng dấu phẩy.
- `DATA_PATH`: để trống nếu dùng file mặc định `data/CLEAN - Transactions.csv` trong thư mục `backend`.
- `CURRENCY_CODE`: mặc định `USD` theo quyết định báo cáo của đồ án; có thể ghi đè nếu metadata nguồn được xác minh khác.

`render.yaml` ở thư mục gốc khai báo cấu hình Blueprint để Render tạo service. Sau deploy, kiểm tra `/healthz`, `/api/health` và `/docs`. Nếu CSV không có ở đường dẫn đã cấu hình, `/api/health` báo `dataset_status: missing` và API phân tích trả HTTP 503; điều này không làm Render đánh dấu service offline.

Gói Render miễn phí có thể tạm ngừng dịch vụ khi không được sử dụng; không nên mô tả deployment miễn phí là đảm bảo uptime 24/24.

## 2. Vercel — frontend

Import cùng repository và cấu hình:

- Root Directory: `frontend`
- Framework preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variable `VITE_API_BASE_URL`: URL HTTPS của backend Render, không có dấu `/` cuối.

Biến `VITE_API_BASE_URL` được nhúng khi build; sau khi đổi biến, cần redeploy frontend. Cấu hình SPA rewrite đã có trong `frontend/vercel.json`.

## 3. Cập nhật dữ liệu

1. Làm sạch dữ liệu trong Google Sheets theo [`data_dictionary.md`](data_dictionary.md).
2. Xuất CSV UTF-8 và cập nhật `backend/data/CLEAN - Transactions.csv`, giữ nguyên tên file.
3. Từ `backend`, chạy `python -m unittest discover -s tests`.
4. Từ `frontend`, chạy `npm ci` và `npm run build`.
5. Kiểm tra local API, sau đó commit/push CSV và mã nguồn lên GitHub.
6. Chờ Render và Vercel deploy xong; xác minh metadata và KPI trên bản production.

### Thứ tự kết nối hai nền tảng

1. Tạo Render Web Service từ GitHub và lấy URL service, ví dụ `https://<ten-service>.onrender.com`.
2. Tạo Vercel Project từ cùng repository, đặt root `frontend`, thêm `VITE_API_BASE_URL` bằng URL Render rồi deploy.
3. Nếu đã giới hạn CORS, cập nhật `CORS_ORIGINS` trong Render bằng domain Vercel production rồi redeploy backend.
4. Mở `https://<ten-service>.onrender.com/healthz` để xác nhận liveness và `/api/health` để xác nhận trạng thái dataset.
5. Commit CSV cùng mã nguồn và push lên GitHub để cả hai nền tảng tự deploy lại.

Không commit `.env`, token deploy, service key Google hoặc dữ liệu không được phép công khai. Workbook lớn/raw không cần đưa vào repository; giữ nguồn, ghi nhận URL, ngày tải, phiên bản và các bước làm sạch trong hồ sơ dự án.
