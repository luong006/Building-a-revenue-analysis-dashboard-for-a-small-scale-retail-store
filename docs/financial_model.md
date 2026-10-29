# Cơ sở thuật ngữ và chỉ số

## 1. Phạm vi diễn giải

Tài liệu *Fundamentals of Corporate Finance* của Stephen A. Ross, Randolph Westerfield và Bradford D. Jordan được dùng làm tài liệu tham khảo cho thuật ngữ tài chính doanh nghiệp khi phù hợp. Không gán công thức bán lẻ hoặc thuật toán phân tích dữ liệu cho Ross et al. nếu chưa xác minh trực tiếp nguồn, ấn bản và trang.

Dashboard mô tả doanh thu bán hàng và số lượng giao dịch. Dataset không có giá vốn hàng bán (COGS), chi phí hoạt động, thuế thực tế theo giao dịch, tài sản/nợ ngắn hạn hoặc dữ liệu tồn kho theo thời điểm; vì vậy không tính lợi nhuận, biên lợi nhuận, vốn lưu động ròng (NWC), vòng quay hàng tồn kho, chu kỳ hoạt động hay chi phí thiếu hàng/tồn trữ.

## 2. Chỉ số bán hàng dùng trong dashboard

Các chỉ số sau được định nghĩa từ trường dữ liệu và phép tổng hợp của dự án; đây là các thước đo vận hành bán lẻ, không khẳng định là mô hình do giáo trình Ross xây dựng.

- **Doanh thu bán hàng (`R`)**: tổng `transaction_qty × unit_price` của các dòng đã lọc. Không gọi là lợi nhuận. Nếu nguồn không nêu rõ cách xử lý giảm giá/hoàn trả/thuế, không tự gọi là doanh thu thuần.
- **Giao dịch (`N`)**: số mã giao dịch duy nhất (`transaction_id`). Không đồng nhất một giao dịch với một khách hàng hoặc một lượt ghé.
- **Số lượng bán (`Q`)**: tổng `transaction_qty`.
- **AOV**: `R / N`.
- **UPT**: `Q / N`.
- **ASP**: `R / Q`.
- **Đồng nhất thức**: `R = N × UPT × ASP`, sai khác nhỏ có thể xuất hiện do làm tròn khi hiển thị.
- **Cơ cấu nhóm/sản phẩm**: doanh thu, tỷ trọng doanh thu, số lượng, tỷ trọng số lượng và số mã giao dịch duy nhất được tổng hợp theo danh mục, địa điểm hoặc sản phẩm.
- **Xu hướng**: doanh thu, số lượng và mã giao dịch theo ngày/tháng; doanh thu theo giờ; doanh thu bình quân trên ngày có giao dịch theo thứ.
- **So sánh kỳ**: chênh lệch tuyệt đối và phần trăm giữa khoảng ngày chọn với khoảng liền trước có cùng số ngày, chỉ khi dữ liệu lịch sử bao phủ đủ cả hai kỳ. Đây là mô tả thay đổi, không khẳng định nguyên nhân hay lợi nhuận.

Khi mẫu lọc không có giao dịch hoặc quantity bằng 0, tỷ số tương ứng trả về 0 để giữ hợp đồng API ổn định; báo cáo học thuật vẫn cần nêu số quan sát của mẫu.

## 3. Kịch bản ước tính sales tax (không phải số thực thu)

Người dùng chọn hiển thị kịch bản riêng cho dữ liệu cửa hàng tại New York City:

- Thuế suất kết hợp NYC trong kỳ dữ liệu năm 2023 được tham chiếu là **8,875%** (`0.08875`).
- Công thức kịch bản: `tax_estimate = R × 0.08875`.
- Kịch bản giả định toàn bộ doanh thu trong mẫu chịu thuế và `unit_price` chưa bao gồm thuế.
- Thuế ước tính được hiển thị riêng; không cộng vào `R`, không đổi tên thành thuế đã thu/nộp, và không dùng để suy ra lợi nhuận.

Không thể phân loại thuế từng dòng một cách đáng tin chỉ từ `product_category`/`product_detail`: nguồn không nêu trạng thái dine-in/takeout, nhiệt độ, cách đóng gói, trạng thái chế biến hay địa chỉ giao dịch chính xác. New York có các ngoại lệ và quy tắc khác nhau cho đồ ăn/đồ uống và nhà hàng. Do vậy số tiền này chỉ là **kịch bản giả định**, không phải nghĩa vụ hoặc số thuế lịch sử thực tế. Muốn tính thực tế cần trường thuế POS, hoặc ít nhất dữ liệu trạng thái chịu thuế theo dòng và xác nhận giá trước/sau thuế.

Nguồn chính thức:

- [New York State — Publication 718 (combined local sales and use tax rates)](https://www.tax.ny.gov/pdf/publications/sales/pub718.pdf)
- [New York State — Sales by Restaurants, Taverns, and Similar Establishments (TB-ST-806)](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/sales_by_restaurants.htm)
- [New York State — Food and Food Products Sold by Food Stores and Similar Establishments (TB-ST-283)](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/food_sold_by_food_stores.htm)
- [New York State — Beverages Sold by Food Stores, Beverage Centers, and Similar Establishments (TB-ST-65)](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/beverages_sold_by_food_stores.htm)

## 4. Khả năng mở rộng tồn kho

Phân tích tồn kho chỉ phù hợp sau khi có dữ liệu thực về số lượng nhập/bán/tồn tại các mốc thời gian và giá vốn. Khi đó có thể nghiên cứu các khái niệm vốn lưu động và quản trị hàng tồn kho dựa trên giáo trình cùng nguồn học thuật phù hợp, trích dẫn chính xác. Không dùng doanh thu bán hàng làm đại diện cho giá trị tồn kho, và không dùng giả định tồn kho mô phỏng để đưa ra khuyến nghị nhập hàng.
