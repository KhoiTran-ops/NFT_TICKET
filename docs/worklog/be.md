# Worklog · be

## 2026-11-13 · Sửa lỗi review phần đăng nhập

- **Issue:** TIC-37, TIC-38, TIC-39, TIC-45 (cùng thay đổi local chưa commit ở mục dưới)
- **Thực hiện bởi:** AI (Claude), theo yêu cầu của BE
- **Đã làm:** Server dừng ở `AUTH_CONFIG_INVALID` khi thiếu cấu hình đăng nhập, không còn chế độ chạy không có đăng nhập. Cho thiết lập lại TOTP khi chưa kích hoạt. Refresh dùng lại token cũ trong 10 giây không thu hồi phiên. Logout nhận refresh cookie khi access token hết hạn. Xác thực phiên chạy ở `onRequest` của route, trước CSRF, parse và validate body. Thêm test liệt kê mọi route phải khai báo quyền và danh sách route công khai cố định.
- **Bằng chứng:** Typecheck không có lỗi ở mã đã sửa. Chưa chạy được vitest và `test:db` trong môi trường của AI; BE cần chạy `pnpm --filter backend test` và `test:db` trước khi commit.
- **Việc tiếp theo:** Tách commit theo migration, OTP/phiên/CSRF, TOTP và API quản lý sự kiện; mở PR riêng cho migration để hai người duyệt.

## 2026-11-13 · Đăng nhập email OTP và phiên trên máy

- **Issue:** TIC-37, TIC-38, TIC-39, một phần TIC-40/41/42/45
- **Thực hiện bởi:** AI (Codex)
- **Mục tiêu:** Nối email OTP với phiên đăng nhập và CSRF. Kiểm tra đồng thời trên PostgreSQL. Giữ thay đổi local theo yêu cầu BE.
- **Đã làm:** Email OTP với giới hạn gửi/thử, phiên JWT, refresh rotation, đăng xuất và CSRF. Thiết lập/kích hoạt/xác minh TOTP với secret mã hóa và migration chống phát lại.
- **Đã làm:** Kiểm tra quyền theo tổ chức cho API sự kiện. Tạo, đọc và sửa nháp, thêm/sửa hạng vé, xuất bản PostgreSQL với 2FA gần đây và audit trong cùng giao dịch.
- **Dependencies:** `@fastify/cookie` cho cookie ký, `jose` cho JWT, `nodemailer` cho SMTP/TLS, `otpauth` cho TOTP.
- **Bằng chứng local:** Build, typecheck, lint, OpenAPI lint, 113 test thường và 12 test PostgreSQL pass. Kiểm thử OTP đồng thời và dùng lại, refresh token dùng lại, đổi phiên bản phiên, TOTP phát lại, và quyền xuất bản theo tổ chức.
- **Bị chặn:** Cần thông số SMTP để kiểm tra giao email thật. Cần TIC-48 để tích hợp Avalanche Fuji. Luồng KYB, cấp quyền nhân sự và API đọc audit thuộc các lát cắt tiếp theo.
- **Việc tiếp theo:** Hoàn thiện RBAC và audit (TIC-40–42), SMS/KYB giả lập và kiểm tra điều kiện giao dịch (TIC-43/44/46), rồi làm giữ chỗ/thanh toán (TIC-53/54).

## 2026-11-13 · Hoàn thiện API và cấu hình triển khai sau review

- **Issue:** TIC-32, TIC-45
- **Thực hiện bởi:** AI (Codex)
- **Mục tiêu phiên:** Đồng bộ lỗi HTTP với OpenAPI, cấu hình proxy, chạy test startup từ mã nguồn và đồng bộ workflow với LEAD.
- **Hợp đồng API:** Đề xuất `PAYLOAD_TOO_LARGE` (413) và `UNSUPPORTED_MEDIA_TYPE` (415) cho các endpoint nhận body. `VALIDATION_ERROR` giữ HTTP 400. Nhánh riêng `fix/TIC-32-http-error-contract` cần hai lượt duyệt.
- **Runtime:** Đọc `TRUSTED_PROXY_CIDRS` lúc khởi động và chỉ tin các IP/CIDR đã cấu hình. Kiểm thử hai khách sau proxy và header giả từ peer trực tiếp. Tách bootstrap để test trực tiếp mã nguồn.
- **Bằng chứng local:** 113 test thường pass khi cả `backend/dist` và `packages/shared/dist` tạm thời không có. Build, typecheck, lint và OpenAPI lint pass.
- **CI:** Đồng bộ trigger và phiên bản actions với `claude/lead-sprint0`. Workflow apps bổ sung PostgreSQL service và bước test tích hợp.
- **Nhánh:** Đã xóa ba ref cũ trên origin sau khi kiểm tra không có PR mở dùng chúng. PR TIC-45 dùng `fix/TIC-32-http-error-contract` làm base để hợp đồng lỗi được review riêng.

## 2026-11-13 · Xử lý review trước merge

- **Issue:** TIC-32, TIC-31, TIC-45
- **Thực hiện bởi:** AI (Codex)
- **Mục tiêu phiên:** Tách nhánh khỏi TIC-47, tách schema theo phần, chạy PostgreSQL trên CI và sửa lỗi HTTP, audit, startup, rate limit.
- **TIC-32:** Test parser xác nhận HTTP 413/415. Lỗi nội bộ ghi mã Fastify/Prisma đã lọc và correlation ID; test tiếp tục kiểm tra dữ liệu request và lỗi thô không lộ.
- **TIC-31 phần 1:** Migration độc lập cho tài khoản, phiên, OTP, eKYC và audit. Test PostgreSQL xác nhận trường của tác nhân người dùng/hệ thống và trigger chỉ-thêm. Workflow có bước `test:db` bắt buộc sau khi build.
- **TIC-31 phần 2:** Migration riêng cho tổ chức, sự kiện, vai trò theo phạm vi, hạng vé, đơn và vé. Kiểm tra hai migration cùng chạy được, seed hai lần, ba unique index theo phạm vi và các ràng buộc tồn kho, số tiền, ID vé.
- **TIC-45:** Server kiểm tra cấu hình và kết nối PostgreSQL trước khi mở cổng HTTP. Plugin chính thức `@fastify/rate-limit` thực thi `429 RATE_LIMITED` và `Retry-After` cho `GET /events`. Mặc định 60 request/phút/IP/tiến trình.
- **Bằng chứng migration:** `migrate dev --create-only` trên PostgreSQL 18.6 với bản sao schema tạo đúng một lệnh thêm cột. Sau khi áp dụng, kiểm tra còn 3 partial unique index, 13 CHECK và trigger audit. Cột thử nghiệm nằm trong schema local riêng.
- **Đã ship:** base `chore/TIC-27-monorepo-base` lấy các commit nền tảng của LEAD trước TIC-47. Sau base là `fix/TIC-32-http-foundation`, `feat/TIC-31-identity-audit`, `feat/TIC-31-ticketing-schema`, `fix/TIC-45-public-event-runtime`. Các nhánh cũ giữ để đối chiếu.
- **Bằng chứng local:** 110 test workspace thường và 5 test PostgreSQL pass. Bước `test:db` trả lỗi khi thiếu `TEST_DATABASE_URL`. Audit dependency production không báo lỗ hổng đã biết.
- **CI:** Base cũ của LEAD chỉ chạy khi mở PR hoặc push `main`. Nhánh TIC-45 bật thêm push cho các nhánh feature/fix theo mã TIC để xác minh PostgreSQL trên GitHub trong lúc chờ mở draft.
- **Bị chặn:** GitHub trả 403 khi tạo draft PR bằng tích hợp hiện tại. Người có quyền trên repo có thể mở draft từ các nhánh đã push. Nếu đã áp dụng migration gộp cũ, dùng schema phát triển mới cho hai migration đã tách.
- **Việc tiếp theo:** review base với LEAD, sau đó review từng nhánh theo thứ tự. Hai nhánh schema cần hai lượt duyệt và chạy migration/test local trên DB riêng. TIC-45 vẫn chỉ gồm các endpoint đọc công khai.

## 2026-11-13 · Dựng API và chuẩn bị schema PostgreSQL cho Sprint 0

- **Issue:** TIC-32, TIC-31
- **Thực hiện bởi:** AI (Codex), theo yêu cầu của thành viên Backend
- **Kế hoạch phiên:** TIC-32 gồm Fastify, healthcheck và log an toàn. TIC-31 gồm schema v1, migration và seed cho DB thử nghiệm. Hai issue được review riêng.
- **Đã làm (TIC-32):** Khởi động API Fastify, `GET /health`, route mặc định yêu cầu xác thực, log có mã tương quan do máy chủ tạo và helper `maskPii()`. Fastify 5 là dependency HTTP duy nhất thêm trực tiếp.
- **Bằng chứng:** build backend và shared, typecheck, lint, 105 test workspace và OpenAPI lint. Audit dependency production không báo lỗ hổng đã biết.
- **Bị chặn:** đối chiếu Linear trực tiếp chưa khả dụng. BE xác nhận dùng backlog/worklog trong repo. LEAD cung cấp địa chỉ triển khai Fuji và ABI tại TIC-48 trước khi tích hợp giao dịch thật.
- **Việc tiếp theo:** TIC-31 tạo schema, migration và seed trong PR riêng.
