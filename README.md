# NFT Ticket MVP

Nền tảng bán vé sơ cấp + đấu giá lại vé NFT trên Avalanche Fuji.

- Nghiệp vụ (nguồn sự thật): [`PRODUCT_CONTEXT.md`](PRODUCT_CONTEXT.md)
- Kiến trúc: [`PIPELINE_AND_STRUCTURE.md`](PIPELINE_AND_STRUCTURE.md)
- Kế hoạch, quy tắc, quyết định: [`docs/`](docs/)

## Cấu trúc

| Workspace | Nội dung | Chủ |
| --- | --- | --- |
| [`contracts/`](contracts/) | Smart contract Solidity (Foundry) | LEAD |
| [`backend/`](backend/) | API Node/TypeScript | BE |
| [`frontend/`](frontend/) | Web Next.js | UI |
| [`packages/shared/`](packages/shared/) | `types.ts`, mã lỗi, `openapi.yaml` dùng chung | LEAD |

## Yêu cầu

- Node ≥ 22.13 (xem `.nvmrc`), pnpm 10 (`corepack enable`).
- [Foundry](https://book.getfoundry.sh/getting-started/installation) cho `contracts/`.

## Chạy

```bash
pnpm install
pnpm build          # build packages/shared, backend, frontend
pnpm lint
pnpm test
pnpm openapi:lint   # validate packages/shared/openapi.yaml

# contracts (cần Foundry)
git submodule update --init --recursive
pnpm contracts:build
pnpm contracts:test
```

`pnpm build` không gọi `forge` để máy không cài Foundry vẫn build được app; contracts được build/test riêng ở CI (`.github/workflows/contracts.yml`).

Biến môi trường: sao `.env.example` thành `.env`. Không commit `.env`.

## CI

GitHub Actions chạy trên mỗi PR và mỗi push vào `main`:

- `.github/workflows/contracts.yml`: `forge fmt --check` → `forge build` → `forge test` (profile `ci`).
- `.github/workflows/apps.yml`: `pnpm install --frozen-lockfile` → build → lint → typecheck → test.

`main` cần branch protection (1 approve, 2 job trên bắt buộc xanh) — bật thủ công trong GitHub Settings, xem `docs/worklog/lead.md`.
