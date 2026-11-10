# @nft-ticket/shared

"Hợp đồng" dùng chung giữa backend và frontend (TEAM_PLAN mục 1). Chủ module: LEAD.

| File | Nội dung |
| --- | --- |
| `src/types.ts` | Vai trò, phạm vi, quyền (2.1–2.2); cấp xác minh L0–L3 (5.4); enum trạng thái sự kiện, đơn, vé, phiên đấu giá, hoàn tiền, eKYC; mã lỗi 5.7 + mã chung đề xuất; kiểu `ApiError` |
| `src/chain.ts` | Cấu hình chain (Fuji, chainId 43113) |
| `openapi.yaml` | OpenAPI 3.1 v0: auth (OTP, phiên, TOTP, SĐT), events, orders |
| `test/` | Kiểm tra OpenAPI ↔ types.ts: mọi operation có `x-authz` + `security`, `x-error-codes` khớp mã + HTTP, không có endpoint hủy/hoàn vé người dùng (D-001), enum đồng bộ |

```bash
pnpm --filter @nft-ticket/shared build
pnpm --filter @nft-ticket/shared test
pnpm --filter @nft-ticket/shared openapi:lint   # Redocly
```

## Quy ước OpenAPI

Mỗi operation bắt buộc có (test fail nếu thiếu):

- `security` — `[]` chỉ cho endpoint công khai; webhook dùng `webhookSignature`.
- `x-authz: { permission, scope, minLevel, mfa, audit, roles? }` — `permission` theo ma trận PRODUCT_CONTEXT 2.2, hoặc `public` / `self` (tài nguyên của chính mình) / `system` (webhook).
- `x-error-codes` — mã trong `types.ts`; mỗi mã phải có response HTTP tương ứng.

Đổi file trong package này = đổi hợp đồng → PR riêng, cần 2 approve (WORKING_RULES mục 0.5).

## Đang là đề xuất (chờ BE + UI duyệt)

- `OrderStatus`, `AuctionStatus`, `EventCancellationStatus`: PRODUCT_CONTEXT chưa liệt kê giá trị.
- `GENERAL_ERROR_CODES` (`VALIDATION_ERROR`, `OTP_INVALID`, `NOT_FOUND`, `SOLD_OUT`, …): ngoài bảng 5.7.
- Thời hạn giữ chỗ đơn (`expiresAt`): chưa có giá trị trong PRODUCT_CONTEXT, backend cấu hình.
