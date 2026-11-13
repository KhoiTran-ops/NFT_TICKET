# backend

API Node + TypeScript. Chủ module: BE.

Hiện chỉ là **khung tối thiểu** để monorepo build được (TIC-27). Framework (NestJS/Fastify), healthcheck, logger `maskPii()` do BE dựng ở S0-06 (TIC-32); Prisma schema ở S0-05 (TIC-31).

```bash
pnpm --filter backend build
pnpm --filter backend test
```

- Dùng type/mã lỗi từ `@nft-ticket/shared`, không tự định nghĩa lại.
- Mọi endpoint khai báo quyền, mặc định từ chối (PRODUCT_CONTEXT 2.3). Biến môi trường: xem `.env.example` ở root.
