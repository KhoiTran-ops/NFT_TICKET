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
- Healthcheck chạy độc lập với PostgreSQL và Avalanche. Các luồng ghi nhận NFT sẽ dùng Avalanche Fuji C-Chain, ID 43113, theo cấu hình trong `@nft-ticket/shared`.

Tham khảo [Fastify Logging](https://fastify.dev/docs/latest/Reference/Logging/) và [Avalanche Primary Network](https://build.avax.network/docs/primary-network#c-chain-contract-chain).

## PostgreSQL

Đặt `DATABASE_URL` trong môi trường hoặc `.env` ở root, rồi chạy `pnpm --filter backend db:migrate`.
Để review, đặt `TEST_DATABASE_URL` tới PostgreSQL local và chạy `pnpm --filter backend test:db` sau khi build. Suite tạo schema ngẫu nhiên, chạy toàn bộ migration và dọn schema sau test. Workflow GitHub dùng PostgreSQL riêng cho bước này.

Audit của nhân sự giữ ID, vai trò và IP. Job tự động ghi `actorType: "system"` và tên job, ví dụ `auction-close`. PostgreSQL kiểm tra trường theo loại tác nhân và chặn sửa, xóa hoặc truncate. Dùng tài khoản migration riêng với tài khoản chạy ứng dụng.

Các ràng buộc ngoài Prisma schema nằm trong migration SQL. Khi đổi schema, sinh migration với `prisma migrate dev --create-only` trên DB phát triển, đọc SQL trước khi áp dụng và chạy lại `test:db`. Giữ nguyên các migration đã áp dụng. [Prisma Migrate v6](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/unsupported-database-features)
