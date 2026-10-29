# Cơ sở thuật ngữ và chỉ số

## 1. Phạm vi diễn giải

Tài liệu *Fundamentals of Corporate Finance* của Stephen A. Ross, Randolph Westerfield và Bradford D. Jordan được dùng làm tài liệu tham khảo cho thuật ngữ tài chính doanh nghiệp khi phù hợp. Không gán công thức bán lẻ hoặc thuật toán phân tích dữ liệu cho Ross et al. nếu chưa xác minh trực tiếp nguồn, ấn bản và trang.

Dashboard hiện mô tả doanh thu bán hàng và số lượng giao dịch. Nó không có giá vốn hàng bán (COGS), chi phí hoạt động, thuế, tài sản/nợ ngắn hạn hoặc dữ liệu tồn kho theo thời điểm; vì vậy không tính lợi nhuận, biên lợi nhuận, vốn lưu động ròng (NWC), vòng quay hàng tồn kho, chu kỳ hoạt động hay chi phí thiếu hàng/tồn trữ.

## 2. Chỉ số bán hàng dùng trong dashboard

Các chỉ số sau được định nghĩa từ trường dữ liệu và phép tổng hợp của dự án; đây là các thước đo vận hành bán lẻ, không khẳng định là mô hình do giáo trình Ross xây dựng.

- **Doanh thu bán hàng (`R`)**: tổng `transaction_qty × unit_price` của các dòng đã lọc. Không gọi là lợi nhuận. Nếu nguồn không nêu rõ cách xử lý giảm giá/hoàn trả/thuế, không tự gọi là doanh thu thuần.
- **Giao dịch (`N`)**: số mã giao dịch duy nhất (`transaction_id`). Không đồng nhất một giao dịch với một khách hàng hoặc một lượt ghé.
- **Số lượng bán (`Q`)**: tổng `transaction_qty`.
- **AOV**: `R / N`.
- **UPT**: `Q / N`.
- **ASP**: `R / Q`.
- **Đồng nhất thức**: `R = N × UPT × ASP`, sai khác nhỏ có thể xuất hiện do làm tròn khi hiển thị.

Khi mẫu lọc không có giao dịch hoặc quantity bằng 0, tỷ số tương ứng trả về 0 để giữ hợp đồng API ổn định; báo cáo học thuật vẫn cần nêu số quan sát của mẫu.

## 3. Khả năng mở rộng tồn kho

Phân tích tồn kho chỉ phù hợp sau khi có dữ liệu thực về số lượng nhập/bán/tồn tại các mốc thời gian và giá vốn. Khi đó có thể nghiên cứu các khái niệm vốn lưu động và quản trị hàng tồn kho dựa trên giáo trình cùng nguồn học thuật phù hợp, trích dẫn chính xác. Không dùng doanh thu bán hàng làm đại diện cho giá trị tồn kho, và không dùng giả định tồn kho mô phỏng để đưa ra khuyến nghị nhập hàng.
