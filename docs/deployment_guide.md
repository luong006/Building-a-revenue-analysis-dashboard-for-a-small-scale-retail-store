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
- `CORS_ORIGINS`: domain Vercel production và `http://localhost:5173`, phân cách bằng dấu phẩy. Không dùng `*` cho ứng dụng có xác thực.
- `DATA_PATH`: để trống nếu dùng file mặc định `data/CLEAN - Transactions.csv` trong thư mục `backend`.
- `CURRENCY_CODE`: mặc định `USD` theo quyết định báo cáo của đồ án; có thể ghi đè nếu metadata nguồn được xác minh khác.
- `DATABASE_URL`: URL nội bộ của Render PostgreSQL. Database lưu user, dataset và từng giao dịch.
- `REDIS_URL`: URL kết nối Render Redis. Redis cache phản hồi dashboard trong 5 phút; không dùng làm nơi lưu dữ liệu duy nhất.
- `JWT_SECRET`: bí mật ký token đăng nhập. Tạo bằng giá trị ngẫu nhiên đủ mạnh, không commit vào GitHub.

`render.yaml` ở thư mục gốc khai báo các biến cần bổ sung trong Render. Trước khi frontend mới dùng được, tạo PostgreSQL và Redis trên Render rồi gắn đúng URL vào Web Service; thiết lập `JWT_SECRET`. Khi backend khởi động lần đầu có PostgreSQL, schema được tạo và CSV mẫu được nhập vào database. Dataset mẫu chỉ được seed khi chưa có, các lần restart sau không nhập trùng.

Sau deploy, kiểm tra `/healthz`, `/api/cache-status` và `/docs`; đăng ký tài khoản thử, xác nhận dataset mẫu xuất hiện rồi tải một CSV thử nghiệm lên. Không dùng dữ liệu cá nhân/nhạy cảm trong thử nghiệm. Nếu `DATABASE_URL` hoặc `JWT_SECRET` thiếu, các route tài khoản trả lỗi HTTP 503 có hướng dẫn cấu hình; API CSV cũ vẫn phục vụ tương thích.

Gói Render miễn phí có thể tạm ngừng dịch vụ khi không được sử dụng; không nên mô tả deployment miễn phí là đảm bảo uptime 24/24.

## 2. Vercel — frontend

Import cùng repository và cấu hình:

- Root Directory: `frontend`
- Framework preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variable `VITE_API_BASE_URL`: URL HTTPS của backend Render, không có dấu `/` cuối.

Biến `VITE_API_BASE_URL` được nhúng khi build; sau khi đổi biến, cần redeploy frontend. Cấu hình SPA rewrite đã có trong `frontend/vercel.json`.

## 3. Quản lý dữ liệu

1. Người dùng đăng nhập và chọn dataset mẫu hoặc một dataset đã tải lên trước đó.
2. Tải CSV UTF-8 theo schema chuẩn trong [`data_dictionary.md`](data_dictionary.md).
3. API kiểm tra cột, kiểu dữ liệu, dòng trống, miền giá trị và transaction ID trùng trước khi ghi database.
4. Dataset được tạo mới, gắn với chủ tài khoản; dashboard chỉ truy vấn dataset đang chọn.
5. Redis lưu response phân tích tối đa 5 phút theo user, dataset và bộ lọc; PostgreSQL vẫn là nguồn dữ liệu chuẩn.

Để cập nhật dataset mẫu, cập nhật CSV trong repository rồi cần có quy trình quản trị/migration riêng; không xóa dữ liệu mẫu đang có khi ứng dụng restart. Dataset người dùng tải lên không bị ghi đè bởi deploy.

### Thứ tự kết nối hai nền tảng

1. Tạo Render Web Service từ GitHub và lấy URL service, ví dụ `https://<ten-service>.onrender.com`.
2. Tạo Vercel Project từ cùng repository, đặt root `frontend`, thêm `VITE_API_BASE_URL` bằng URL Render rồi deploy.
3. Tạo Render PostgreSQL và Redis, cấu hình `DATABASE_URL` / `REDIS_URL`, đặt `JWT_SECRET` ngẫu nhiên và cập nhật `CORS_ORIGINS` với domain Vercel production.
4. Mở `https://<ten-service>.onrender.com/healthz` và `/api/cache-status`; kiểm tra đăng ký, đăng nhập và upload sau deploy.
5. Push mã nguồn lên GitHub để Render và Vercel tự deploy lại.

Không commit `.env`, token deploy, service key Google hoặc dữ liệu không được phép công khai. Workbook lớn/raw không cần đưa vào repository; giữ nguồn, ghi nhận URL, ngày tải, phiên bản và các bước làm sạch trong hồ sơ dự án.
