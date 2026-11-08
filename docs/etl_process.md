# Quy trình ETL dữ liệu bán hàng

## Mục tiêu và trạng thái triển khai

Quy trình chuyển workbook giao dịch nguồn thành CSV chuẩn để nạp vào Retail Pulse. Excel/Google Sheets đã được cân nhắc nhưng khó lặp lại và kiểm tra đồng nhất trên file lớn; giai đoạn này dùng Python để làm sạch có thể chạy lại và báo lỗi theo dòng.

Script `backend/scripts/clean_sales_data.py` đọc workbook `.xlsx` và tạo CSV theo schema thống nhất. Nó không sửa file raw. API upload hiện nhận CSV chuẩn đã qua ETL, kiểm tra lại trước khi ghi PostgreSQL. Dataset Coffee trong `backend/data/CLEAN - Transactions.csv` là bản CSV sạch đang được dùng làm dataset mẫu.

## Các bước ETL thực tế

### 1. Extract — trích xuất

1. Tải workbook `.xlsx` được phép sử dụng từ nguồn Coffee Shop Sales.
2. Giữ workbook raw nguyên trạng; không ghi đè hay chỉnh trực tiếp file nguồn.
3. Chọn worksheet chứa giao dịch (mặc định script dùng sheet đang active; có thể chỉ định bằng `--sheet`).
4. Đọc các cột giao dịch bằng `openpyxl` ở chế độ chỉ đọc; script yêu cầu đủ 11 cột chuẩn, không tự đoán các cột tương tự hoặc ghép schema khác.

### 2. Transform — chuẩn hóa và kiểm tra

Script:

- Chuẩn hóa tiêu đề cột về chữ thường và bỏ khoảng trắng ở hai đầu.
- Chuẩn hóa ngày thành `YYYY-MM-DD`; chấp nhận ô ngày Excel hoặc định dạng văn bản ISO / `MM/DD/YYYY` / `MM/DD/YY`.
- Chuẩn hóa giờ thành `HH:MM:SS`; chấp nhận giá trị thời gian Excel, ISO hoặc AM/PM.
- Chuyển ID và số lượng sang số nguyên; `transaction_qty` phải lớn hơn 0, các ID phải không âm.
- Chuyển `unit_price` sang số thập phân hữu hạn không âm; dấu `$` và dấu phẩy phân tách hàng nghìn được xử lý rõ ràng.
- Bỏ khoảng trắng thừa ở văn bản; bắt buộc có địa điểm, danh mục và loại sản phẩm.
- Bỏ qua dòng hoàn toàn trống; không âm thầm bỏ qua dòng có dữ liệu sai.
- Từ chối ID giao dịch trùng, dữ liệu sai định dạng, cột thiếu hoặc vượt giới hạn chiều dài. Lỗi chỉ ra số dòng để người dùng sửa tại nguồn rồi chạy lại.

Script không tự điền giá trị tài chính bị thiếu, không suy đoán thuế, giá vốn, lợi nhuận hoặc tồn kho, và không tự loại ngoại lệ. Những trường hợp cần quy tắc nghiệp vụ phải được kiểm tra và quyết định trước khi chạy lại.

### 3. Load — nạp

1. Script ghi CSV UTF-8 theo 11 cột chuẩn, không thêm index hoặc cột dẫn xuất.
2. Người dùng kiểm tra số dòng hợp lệ, lỗi nếu có, khoảng ngày và đối chiếu tổng số lượng / doanh thu với workbook nguồn.
3. Nạp CSV qua chức năng upload của dashboard; backend xác thực schema, miền dữ liệu và ID trùng lần nữa, sau đó lưu các bản ghi và metadata trong PostgreSQL gắn với tài khoản.
4. Dataset mẫu Coffee không bị ghi đè; mỗi lần upload tạo dataset riêng.
5. Backend tính doanh thu dòng là `transaction_qty × unit_price`; thời gian và các chiều phân tích được lấy từ các cột nguồn. Redis chỉ cache kết quả phân tích, không phải nơi lưu dataset.

## Cách chạy

Từ thư mục `backend`:

```powershell
python -m pip install -r requirements.txt
python scripts/clean_sales_data.py "C:\data\Coffee-Shop-Sales.xlsx" --output "C:\data\coffee-clean.csv"
```

Chọn sheet cụ thể:

```powershell
python scripts/clean_sales_data.py "C:\data\Coffee-Shop-Sales.xlsx" --sheet "Transactions" --output "C:\data\coffee-clean.csv"
```

Sau khi lệnh thành công, kiểm tra CSV và tải `coffee-clean.csv` lên dashboard. Nếu script báo lỗi, sửa workbook raw/bản làm việc theo dòng lỗi rồi chạy lại; không sửa tay file output để tránh quy trình không tái lập được.

## Định nghĩa và giới hạn phân tích

- Doanh thu bán hàng theo dữ liệu nguồn = tổng `transaction_qty × unit_price`; không phải lợi nhuận.
- `transaction_id` trong file hiện tại có 149.116 dòng và 149.116 ID duy nhất. Nó đang được dùng như mã nguồn duy nhất trên mỗi dòng; dữ liệu không cung cấp một khóa đơn hàng đáng tin cậy để tính số đơn chứa một SKU. Vì vậy dashboard không báo số giao dịch theo SKU.
- “Số mã giao dịch nguồn” và các giá trị bình quân chia cho số ID nguồn chỉ được diễn giải theo định danh có trong file, không mặc định là số đơn hàng / AOV chuẩn.
- Không tính lợi nhuận hoặc biên lợi nhuận nếu thiếu giá vốn theo SKU và các điều chỉnh cần thiết. Không tính tồn kho nếu thiếu tồn đầu kỳ, nhập hàng, điều chỉnh và tồn cuối kỳ theo thời điểm.
- Nút 7 / 14 / 28 ngày và 1 tháng chọn cửa sổ kết thúc ở ngày mới nhất của dataset đang xem; chúng không sử dụng ngày hiện tại nếu dataset là lịch sử.

## Tình huống sử dụng dashboard

Các tình huống này giúp đặt câu hỏi vận hành có thể trả lời từ dữ liệu hiện có; kết quả là mô tả lịch sử, không chứng minh nguyên nhân:

1. **Xem khung giờ có doanh thu cao:** lọc địa điểm/khoảng ngày rồi đối chiếu tổng doanh thu và số lượng theo giờ. Quản lý có thể dùng kết quả để xem lại lịch phân ca; chỉ doanh thu theo giờ chưa đủ kết luận cần thêm nhân sự hay số khách phục vụ.
2. **Xem sản phẩm đóng góp doanh thu và sản lượng:** so sánh bảng xếp hạng theo doanh thu với bảng theo số lượng để cân nhắc danh mục cần theo dõi. Đây không phải khuyến nghị nhập hàng; file không có tồn kho, giá vốn hay dữ liệu thiếu hàng.
3. **So sánh địa điểm và danh mục:** chọn cùng một khoảng ngày, sau đó xem chênh lệch doanh thu/sản lượng giữa địa điểm hoặc nhóm sản phẩm. Cần giữ cùng thời lượng và chú ý số ngày hoạt động; không kết luận một cửa hàng “hiệu quả hơn” nếu thiếu chi phí và bối cảnh hoạt động.
4. **Theo dõi biến động gần đây:** dùng preset 7/14/28 ngày hoặc 1 tháng và so với khoảng liền trước khi có đủ lịch sử. Đây là tín hiệu để điều tra thêm, không bằng chứng rằng một chương trình hay sự kiện gây ra thay đổi.
5. **Đặt câu hỏi về lợi nhuận/tồn kho:** dashboard hiện chủ động trả về “không đủ dữ liệu để tính toán”. Để trả lời, cần bổ sung dữ liệu giá vốn theo SKU và chi phí liên quan cho lợi nhuận, hoặc sổ tồn kho gồm tồn đầu kỳ, nhập, điều chỉnh và số dư theo thời điểm cho tồn kho.

Khi viết 3–5 nhận xét cho báo cáo đồ án, ghi rõ KPI, giá trị, khoảng ngày, bộ lọc/đơn vị và mẫu số phù hợp; ví dụ: “Trong [khoảng ngày], [địa điểm] ghi nhận [giá trị] USD doanh thu bán hàng theo nguồn, cao hơn [địa điểm khác] [chênh lệch] USD.” Không đổi doanh thu thành lợi nhuận và không gán quan hệ nhân quả cho xu hướng.

## Hồ sơ cần lưu cho lần chạy ETL

Để báo cáo có thể tái lập, ghi nhận URL/phiên bản nguồn, ngày tải, tên sheet, checksum hoặc tên file raw, phiên bản script, số dòng đầu vào/đầu ra, dòng trống được bỏ qua, lỗi phải sửa, khoảng ngày và tổng số lượng / doanh thu đối chiếu. Không đưa workbook raw chứa thông tin không được phép công khai lên GitHub.
