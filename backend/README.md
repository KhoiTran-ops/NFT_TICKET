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
