# Hướng Dẫn Chung Dự Án (Project Context)
## Dự án: Extension Thống Kê Lazada

### 1. Mục tiêu dự án
(Antigravity sẽ cập nhật phần này sau khi người dùng mô tả cụ thể về chức năng của extension).

### 2. Quy trình làm việc giữa 2 Sub-Agents:
*   **🧠 Antigravity (Architect / Planner):** Chịu trách nhiệm thiết lập cấu trúc file, lên timeline, chạy terminal commands, thiết kế kiến trúc hệ thống, nghiên cứu mô hình thống kê tổng thể.
*   **⚡ Cursor (Speed Coder / Reviewer):** Chịu trách nhiệm hoàn thiện thuật toán chi tiết, sinh UI mượt mà, gợi ý sửa code cục bộ cực nhanh và refactor file dựa trên bản thiết kế của Antigravity.

### 3. Công nghệ sử dụng (Tech Stack)
*   **Loại dự án:** Browser Extension (Chrome / Edge / Firefox)
*   **Ngôn ngữ / Framework chính:** (Chưa xác định - Sẽ cập nhật theo yêu cầu người dùng)
*   **Styling:** (Chưa xác định - Có thể là TailwindCSS hoặc CSS thuần)

### 4. Quy tắc Code (Coding Convention)
*   Luôn comment rõ ràng đối với các logic tương tác với DOM của trang Lazada.
*   **Quy trình Git (Bắt buộc):** Sau khi code xong bất kỳ chức năng hoặc module nào, phải tự động chạy lệnh `git add .`, đóng gói bằng `git commit -m "mô tả"` và đẩy lên bằng `git push`.
