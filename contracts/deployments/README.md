# deployments

Địa chỉ contract đã deploy, do `script/Deploy.s.sol` ghi ra.

- `fuji.json`: Avalanche Fuji (chainId 43113). Commit file này sau khi deploy.
- `local-<chainId>.json`: anvil / chain local. Không commit (đã có trong `.gitignore`).

Sau khi deploy, chạy `pnpm --filter contracts abi:export` để cập nhật `packages/shared/src/abi/` và `packages/shared/src/addresses.ts`.
