# frontend

Web Next.js (người mua, ban tổ chức, admin). Chủ module: UI.

Hiện chỉ là **khung tối thiểu** để monorepo build được (TIC-27). Next.js App Router + Tailwind + mock API (MSW) sinh từ `packages/shared/openapi.yaml` do UI dựng ở S0-10 (TIC-36). Khi đó thay script `build` bằng `next build`.

```bash
pnpm --filter frontend build
```

- Dùng `code` trong lỗi API (PRODUCT_CONTEXT 5.7) để hiện hướng dẫn, lấy từ `@nft-ticket/shared`.
- Không có nút hủy/hoàn vé cho người dùng (D-001).
