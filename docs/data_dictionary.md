# Từ điển dữ liệu và quy trình làm sạch

## Dataset sẽ đưa vào hệ thống

Nguồn là dataset Coffee Shop Sales của Maven Roasters, cửa hàng giả lập ở New York. File `backend/data/CLEAN - Transactions.csv` là bản đã được chuẩn hóa để dùng làm nguồn dữ liệu cho hệ thống; tên file được giữ nguyên theo yêu cầu. File cần có đúng các tiêu đề dưới đây và được kiểm tra lại trước khi đưa vào backend.

| Cột CSV chuẩn | Cột nguồn tương ứng | Kiểu sau làm sạch | Quy tắc |
|---|---|---|---|
| `transaction_id` | `transaction_id` | Số nguyên | Không rỗng, duy nhất theo từng dòng bán hàng |
| `transaction_date` | `transaction_date` | Ngày `YYYY-MM-DD` | Không rỗng, ngày hợp lệ |
| `transaction_time` | `transaction_time` | Giờ `HH:MM:SS` | Không rỗng, giờ hợp lệ |
| `transaction_qty` | `transaction_qty` | Số nguyên | Lớn hơn 0 |
| `store_id` | `store_id` | Số nguyên | Không rỗng |
| `store_location` | `store_location` | Văn bản | Không rỗng; giữ cách viết nhất quán |
| `product_id` | `product_id` | Số nguyên | Không rỗng |
| `unit_price` | `unit_price` | Số thập phân | Không âm; giữ đơn vị gốc |
| `product_category` | `product_category` | Văn bản | Không rỗng; chuẩn hóa nhãn |
| `product_type` | `product_type` | Văn bản | Không rỗng; chuẩn hóa nhãn |
| `product_detail` | `product_detail` | Văn bản | Giữ nội dung nguồn; nếu trống, tên hiển thị fallback sang `product_type` |

Giữ bộ tiêu đề chuẩn này khi xuất CSV; không cần thêm cột `sales`, `hour`, `month`, `weekday` hay cột index. Backend tính doanh thu dòng là `transaction_qty × unit_price` và lấy giờ từ `transaction_time`, tránh phải đồng bộ các cột dẫn xuất thủ công.

## Các bước làm sạch trên Google Sheets

1. Tải workbook gốc từ repository nguồn và lưu riêng một bản raw không chỉnh sửa.
2. Tạo một bản Google Sheets làm việc; giữ 11 cột cần thiết theo đúng tiêu đề chuẩn ở trên.
3. Chuẩn hóa ngày thành `YYYY-MM-DD`, thời gian thành `HH:MM:SS`, quantity/ID thành số; chuẩn hóa khoảng trắng và cách viết của địa điểm, danh mục, tên sản phẩm.
4. Kiểm tra giá trị trống, transaction ID trùng, ID không phải số, quantity bằng 0/âm, unit price âm, ngày/giờ không hợp lệ.
5. Đối chiếu số dòng và tổng quantity; kiểm tra hợp lý doanh thu tính từ `quantity × unit_price` trước/sau chuẩn hóa.
6. Ghi rõ phép tính doanh thu dùng đơn giá và quantity của nguồn. Nếu workbook có giảm giá, hoàn tiền, thuế hoặc định nghĩa sales khác, dừng và thống nhất cách xử lý trước khi xuất dữ liệu.
7. Tải xuống CSV UTF-8, không giữ số dòng tiêu đề kép, không thêm index; lưu tại `backend/data/CLEAN - Transactions.csv`.
8. Chạy backend tests, gọi `/api/health`, `/api/metadata` và đối chiếu tổng quan trước khi push.

## Giới hạn nguồn và diễn giải

Nguồn mô tả transaction ID, ngày/giờ, lượng bán, cửa hàng, sản phẩm và đơn giá; không có COGS, lợi nhuận, tồn kho hiện tại hay lịch nhập hàng. Cần xác minh mã tiền tệ từ tài liệu nguồn/workbook trước khi gắn nhãn USD hoặc quy đổi VND. Tổng `quantity × unit_price` được gọi là doanh thu bán hàng theo dữ liệu nguồn, không gọi là lợi nhuận hoặc doanh thu thuần nếu chưa xác minh giảm giá/hoàn tiền/thuế.
