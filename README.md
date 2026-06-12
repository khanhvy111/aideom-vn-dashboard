# AIDEOM-VN: Mô Hình Ra Quyết Định Phát Triển Kinh Tế Việt Nam Trong Kỉ Nguyên AI

Dự án xây dựng nguyên mẫu mô hình tích hợp hỗ trợ ra quyết định (AIDEOM-VN) phục vụ phân tích chính sách kinh tế số, tối ưu hóa nguồn lực vĩ mô và mô phỏng thị trường lao động Việt Nam giai đoạn 2026–2030.

Toàn bộ hệ thống tính toán toán học, giải thuật tối ưu và giả lập kịch bản đã được chuyển đổi cấu trúc và phát triển hoàn toàn trên nền tảng **ReactJS Frontend (JSX)**, cho phép xử lý và hiển thị kết quả thời gian thực ngay trên trình duyệt (In-browser Calculation Serverless).

---

## 👥 Nhóm Thực Hiện Dự Án
* **Môn học:** Các mô hình ra quyết định
* **Đơn vị:** Trường Đại học Kinh tế
* **Sinh viên:** Dương Thị Khánh Vy 

---

## 📁 Cấu Trúc Mã Nguồn Bàn Giao (Repository Structure)

```text
aideom-vn2/
├── data/               # Bộ dữ liệu kinh tế Việt Nam 2020-2025 (vietnam_macro, sectors, regions)
├── public/             # Cấu hình giao diện tĩnh và tệp index.html
├── src/                # Toàn bộ mã nguồn chương trình ứng dụng
│   ├── components/     # Các module xử lý toán học và giao diện tương tác (.jsx)
│   │   ├── Bai1.jsx    # Hàm sản xuất Cobb-Douglas mở rộng & Phân rã TFP
│   │   ├── Bai2.jsx    # Quy hoạch tuyến tính (LP) phân bổ 4 hạng mục đầu tư số
│   │   ├── Bai3.jsx    # Chỉ số ưu tiên ngành PriorityScoring & Trọng số Entropy
│   │   ├── Bai4.jsx    # LP phân bổ Vốn số ngành - vùng & Ràng buộc công bằng C5
│   │   └── Bai5.jsx    # Quy hoạch nguyên hỗn hợp (MIP) lựa chọn 15 dự án CĐS quốc gia
│   ├── App.js          # File tích hợp và điều hướng toàn bộ hệ thống Dashboard
│   └── index.js        # Điểm khởi chạy ứng dụng React
├── .gitignore          # Cấu hình loại bỏ thư mục node_modules khi đồng bộ hóa Git
├── package.json        # Danh sách thư viện và dependencies của hệ thống Frontend
├── requirements.txt    # Danh sách thư viện tham chiếu của mô hình gốc
└── README.md           # Hướng dẫn vận hành chi tiết hệ thống