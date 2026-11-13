# Worklog · be

## 2026-11-13 · Hoàn thiện API và cấu hình triển khai sau review

- **Issue:** TIC-32, TIC-45
- **Thực hiện bởi:** AI (Codex)
- **Mục tiêu phiên:** Đồng bộ lỗi HTTP với OpenAPI, cấu hình proxy, chạy test startup từ mã nguồn và đồng bộ workflow với LEAD.
- **Hợp đồng API:** Đề xuất `PAYLOAD_TOO_LARGE` (413) và `UNSUPPORTED_MEDIA_TYPE` (415) cho các endpoint nhận body. `VALIDATION_ERROR` giữ HTTP 400. Nhánh riêng `fix/TIC-32-http-error-contract` cần hai lượt duyệt.

## 2026-11-13 · Xử lý review trước merge

- **Issue:** TIC-32, TIC-31, TIC-45
- **Thực hiện bởi:** AI (Codex)
- **Mục tiêu phiên:** Tách nhánh khỏi TIC-47, tách schema theo phần, chạy PostgreSQL trên CI và sửa lỗi HTTP, audit, startup, rate limit.
- **TIC-32:** Test parser xác nhận HTTP 413/415. Lỗi nội bộ ghi mã Fastify/Prisma đã lọc và correlation ID; test tiếp tục kiểm tra dữ liệu request và lỗi thô không lộ.
- **TIC-31 phần 1:** Migration độc lập cho tài khoản, phiên, OTP, eKYC và audit. Test PostgreSQL xác nhận trường của tác nhân người dùng/hệ thống và trigger chỉ-thêm. Workflow có bước `test:db` bắt buộc sau khi build.
- **TIC-31 phần 2:** Migration riêng cho tổ chức, sự kiện, vai trò theo phạm vi, hạng vé, đơn và vé. Kiểm tra hai migration cùng chạy được, seed hai lần, ba unique index theo phạm vi và các ràng buộc tồn kho, số tiền, ID vé.

## 2026-11-13 · Dựng API và chuẩn bị schema PostgreSQL cho Sprint 0

- **Issue:** TIC-32, TIC-31
- **Thực hiện bởi:** AI (Codex), theo yêu cầu của thành viên Backend
- **Kế hoạch phiên:** TIC-32 gồm Fastify, healthcheck và log an toàn. TIC-31 gồm schema v1, migration và seed cho DB thử nghiệm. Hai issue được review riêng.
- **Đã làm (TIC-32):** Khởi động API Fastify, `GET /health`, route mặc định yêu cầu xác thực, log có mã tương quan do máy chủ tạo và helper `maskPii()`. Fastify 5 là dependency HTTP duy nhất thêm trực tiếp.
- **Bằng chứng:** build backend và shared, typecheck, lint, 105 test workspace và OpenAPI lint. Audit dependency production không báo lỗ hổng đã biết.
- **Bị chặn:** đối chiếu Linear trực tiếp chưa khả dụng. BE xác nhận dùng backlog/worklog trong repo. LEAD cung cấp địa chỉ triển khai Fuji và ABI tại TIC-48 trước khi tích hợp giao dịch thật.
- **Việc tiếp theo:** TIC-31 tạo schema, migration và seed trong PR riêng.
