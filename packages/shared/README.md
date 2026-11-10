# @nft-ticket/shared

"Hợp đồng" dùng chung giữa backend và frontend (TEAM_PLAN mục 1). Chủ module: LEAD.

| File | Nội dung |
| --- | --- |
| `src/chain.ts` | Cấu hình chain (Fuji, chainId 43113) |

```bash
pnpm --filter @nft-ticket/shared build
pnpm --filter @nft-ticket/shared test
```

Đổi file trong package này = đổi hợp đồng → PR riêng, cần 2 approve (WORKING_RULES mục 0.5).
