# Từ điển dữ liệu và chuẩn hóa

## Dataset Coffee mẫu

Nguồn là dataset Coffee Shop Sales của Maven Roasters, cửa hàng giả lập ở New York. File `backend/data/CLEAN - Transactions.csv` là dữ liệu mẫu được dùng để seed dataset Coffee vào PostgreSQL lần đầu.

| Cột CSV chuẩn | Cột nguồn tương ứng | Kiểu sau làm sạch | Quy tắc |
|---|---|---|---|
| `transaction_id` | `transaction_id` | Văn bản | Không rỗng; giữ mã nguồn, không bắt buộc là số |
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

Giữ bộ tiêu đề chuẩn này khi xuất CSV; không cần thêm cột `sales`, `hour`, `month`, `weekday` hay cột index. Với Coffee mẫu, doanh thu dòng là `transaction_qty × unit_price`. Mã tiền tệ USD chỉ áp dụng cho dữ liệu mẫu đã cấu hình; dataset upload được lưu theo mã tiền tệ người dùng xác nhận hoặc “chưa rõ tiền tệ”. Kịch bản thuế NYC chỉ hiển thị với dataset Coffee mẫu, không áp dụng tự động cho CSV khác.

## Chuẩn hóa CSV tải lên

Mỗi dataset upload là một bảng giao dịch phẳng. Bộ nhập nhận diện tên cột phổ biến (ví dụ `date`, `quantity`, `category`, `item`, `total_spent`) và ánh xạ sang trường phân tích. Trường lõi gồm mã giao dịch nguồn, ngày, số lượng, danh mục và sản phẩm; cần thêm cột số tiền nguồn hoặc đơn giá để xác định doanh thu. Ngày, giờ, đơn giá, mã cửa hàng/sản phẩm và các chiều khác được để trống nếu nguồn không có, không tự sinh giá trị.

| Khái niệm | Xử lý |
|---|---|
| Giá trị doanh thu dòng | Cột tiền nguồn do người dùng chọn (mặc định `total_spent` nếu có), hoặc số lượng × đơn giá khi người dùng chọn phép tính |
| Mã giao dịch | Văn bản từ nguồn; ID lặp lại được cho phép vì có thể là nhiều dòng hàng của cùng giao dịch |
| Dòng trùng hoàn toàn | Được phát hiện; chỉ loại khi người dùng bật xác nhận ở bước xem trước |
| Dòng thiếu/sai định dạng | Được đếm và nêu ví dụ; không nạp nếu chưa được người dùng xác nhận loại |
| Ngày mơ hồ | Không đoán thứ tự ngày/tháng; người dùng chọn DMY hoặc MDY, nếu không thì dòng vẫn không hợp lệ |
| Cột tùy chọn thiếu | Lưu `NULL`; ví dụ không có giờ thì không thể phân tích doanh thu theo giờ |
| Cột không nhận diện | Giữ trong `source_attributes` của bản ghi, không dùng để tự tạo KPI |
| Tiền tệ | Mã ISO 4217 người dùng xác nhận hoặc `NULL`; không suy luận từ ký hiệu hay quốc gia |
| Trả hàng / số tiền âm | Giữ nguyên giá trị nguồn; không tự xác định hoàn tiền hay doanh thu thuần |

Trình xem trước cho biết ánh xạ, số dòng hợp lệ/lỗi/trùng, giá trị thiếu, cột lạ và bản ghi mẫu chuẩn hóa trước khi người dùng xác nhận.

## Quy trình ETL bằng Python

1. Tải workbook gốc từ repository nguồn và lưu riêng một bản raw không chỉnh sửa.
2. Với workbook Coffee, tạo môi trường Python theo `backend/requirements.txt`, sau đó chạy `backend/scripts/clean_sales_data.py` trên workbook `.xlsx`. Với CSV khác, tải lên để dùng trình xem trước tự động.
3. Script yêu cầu đủ 11 cột; chuẩn hóa ngày/giờ, ID, số lượng, đơn giá và khoảng trắng; bỏ qua dòng trống hoàn toàn.
4. Dòng dữ liệu không hợp lệ, ID trùng, cột thiếu hoặc giá trị vượt quy tắc sẽ dừng ETL với thông báo số dòng. Không ghi đè CSV đầu ra trước đó nếu lần chạy mới thất bại.
5. Đối chiếu số dòng, tổng quantity và doanh thu tính từ `quantity × unit_price` với workbook nguồn.
6. Ghi rõ phép tính doanh thu dùng đơn giá và quantity của nguồn. Nếu workbook có giảm giá, hoàn tiền, thuế hoặc định nghĩa sales khác, dừng và thống nhất cách xử lý trước khi xuất dữ liệu.
7. Script ghi CSV UTF-8 theo schema chuẩn, không thêm index hoặc cột dẫn xuất.
8. Dùng upload trong dashboard; API giới hạn file 40 MiB/250.000 dòng, kiểm tra schema, kiểu dữ liệu, miền giá trị; mọi lựa chọn loại dòng được ghi vào báo cáo chất lượng của dataset.
9. Chạy backend tests và đối chiếu tổng quan sau khi upload.

Chi tiết từng bước, cách chạy và hồ sơ cần lưu cho mỗi lần xử lý được ghi tại [`etl_process.md`](etl_process.md).

## Giới hạn nguồn và diễn giải

Nguồn Coffee mô tả transaction ID, ngày/giờ, lượng bán, cửa hàng, sản phẩm và đơn giá; không có COGS, lợi nhuận, tồn kho hiện tại hay lịch nhập hàng. Với những nguồn khác, ID có thể lặp lại và cần được hiểu là mã nguồn thay vì khóa đơn hàng đã xác minh. Cần xác nhận tiền tệ trước khi gắn nhãn đơn vị. Giá trị bán hàng theo nguồn không được gọi là lợi nhuận hoặc doanh thu thuần nếu chưa xác minh giảm giá/hoàn tiền/thuế.
