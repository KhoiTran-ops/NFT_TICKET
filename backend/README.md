# backend

API Node + TypeScript. Chủ module: BE.

Fastify cung cấp HTTP server và logger JSON. `GET /health` kiểm tra tiến trình API. Route mới mặc định yêu cầu xác thực.

```bash
pnpm --filter 'backend...' build
pnpm --filter backend start
pnpm --filter backend test
```

- Mặc định lắng nghe tại `127.0.0.1:4000`. Đặt `HOST` và `PORT` trong `.env` ở root để đổi.
- Log chỉ ghi mã tương quan, route template, mã HTTP và thời lượng cho request. Dùng `maskPii()` cho dữ liệu được phép hiển thị một phần.
- Server yêu cầu `DATABASE_URL` hợp lệ và kết nối được PostgreSQL trước khi nhận request. Sau khi khởi động, `GET /health` kiểm tra tiến trình. Các luồng ghi nhận NFT sẽ dùng Avalanche Fuji C-Chain, ID 43113, theo cấu hình trong `@nft-ticket/shared`.

Tham khảo [Fastify Logging](https://fastify.dev/docs/latest/Reference/Logging/) và [Avalanche Primary Network](https://build.avax.network/docs/primary-network#c-chain-contract-chain).

## PostgreSQL

Đặt `DATABASE_URL` trong môi trường hoặc `.env` ở root, rồi chạy `pnpm --filter backend db:migrate`.
Để review, đặt `TEST_DATABASE_URL` tới PostgreSQL local và chạy `pnpm --filter backend test:db` sau khi build. Suite tạo schema ngẫu nhiên, chạy toàn bộ migration và dọn schema sau test. Workflow GitHub dùng PostgreSQL riêng cho bước này.

Audit của nhân sự giữ ID, vai trò và IP. Job tự động ghi `actorType: "system"` và tên job, ví dụ `auction-close`. PostgreSQL kiểm tra trường theo loại tác nhân và chặn sửa, xóa hoặc truncate. Dùng tài khoản migration riêng với tài khoản chạy ứng dụng.

Các ràng buộc ngoài Prisma schema nằm trong migration SQL. Khi đổi schema, sinh migration với `prisma migrate dev --create-only` trên DB phát triển, đọc SQL trước khi áp dụng và chạy lại `test:db`. Giữ nguyên các migration đã áp dụng. [Prisma Migrate v6](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/unsupported-database-features)

Nếu đã chạy migration `20261113000000_init` từ nhánh review cũ, dùng schema hoặc database phát triển mới cho nhánh này. Giữ lại dữ liệu cũ nếu cần.

## Đăng nhập bằng email

Server bắt buộc có cấu hình đăng nhập: thiếu hoặc sai thì dừng ở bước `AUTH_CONFIG_INVALID`. Điền `JWT_SECRET`, `OTP_PEPPER` và `FIELD_ENCRYPTION_KEY` bằng ba giá trị hex 32 byte khác nhau. Đặt `SMTP_HOST`, `OTP_FROM` và thông tin đăng nhập SMTP nếu cần. Cổng mặc định là 587 với STARTTLS bắt buộc, cổng 465 dùng TLS ngay khi kết nối. Test tích hợp dùng bộ gửi OTP giả lập. Trình duyệt cần HTTPS hoặc môi trường localhost hỗ trợ cookie `Secure`.

Gọi `GET /auth/csrf` rồi giữ cookie và gửi lại token nhận được trong header `X-CSRF-Token` khi gọi POST. Dùng `/auth/otp/request`, `/auth/otp/verify` rồi `/auth/session` để kiểm tra phiên. Refresh token được xoay vòng; frontend nên tuần tự hóa các yêu cầu refresh cùng phiên. Token cũ dùng lại trong 10 giây sau khi xoay trả `401` mà không thu hồi phiên (nhiều tab refresh cùng lúc); dùng lại sau 10 giây bị coi là token bị lộ và thu hồi cả chuỗi phiên. `/auth/logout` nhận access token hoặc chỉ refresh cookie, nên vẫn đăng xuất được khi access token đã hết hạn. Giới hạn gửi theo email nằm trong PostgreSQL, giới hạn theo IP áp dụng trên mỗi tiến trình. Cấu hình giới hạn chung tại ingress nếu chạy nhiều replica.

Nhân sự thiết lập và kích hoạt TOTP theo các route `/auth/mfa/totp/*`. Giữ URI thiết lập trong ứng dụng authenticator. Khi chưa kích hoạt, gọi lại `setup` sẽ tạo secret mới và vô hiệu secret cũ; sau khi kích hoạt thì `setup` trả `409`. Quy trình khôi phục 2FA chờ quyết định Product.

Đặt `ALLOW_DEMO_SEED=true` rồi chạy `pnpm --filter backend db:seed` để tạo một sự kiện nháp và hạng vé trên PostgreSQL local. Giá lưu bằng số nguyên VND. ID sự kiện và vé lưu đủ độ chính xác `uint256`, phân biệt theo chain ID và địa chỉ registry.

`GET /events` giới hạn 60 request/phút/IP trên mỗi tiến trình và trả `429 RATE_LIMITED` cùng `Retry-After`. Khi deploy sau reverse proxy, đặt `TRUSTED_PROXY_CIDRS` thành danh sách IP/CIDR thực tế của proxy trực tiếp và các hop tin cậy, ví dụ `127.0.0.1,10.20.30.8/32`. Proxy cần ghi đè hoặc nối IP nguồn đúng cách. Chỉ dùng dải IP dành riêng cho proxy. Nếu nhà cung cấp không có dải proxy đáng tin cậy, đặt giới hạn theo IP khách tại ingress và kiểm tra giới hạn theo IP kết nối của ứng dụng trước khi mở public. Với nhiều replica, dùng giới hạn chung ở ingress. [Fastify trustProxy](https://fastify.dev/docs/latest/Reference/Server/#trustproxy)
