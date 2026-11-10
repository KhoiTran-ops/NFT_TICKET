# contracts

Smart contract Solidity cho NFT Ticket, dùng [Foundry](https://book.getfoundry.sh/). Chủ module: LEAD.

| Contract | Vai trò |
| --- | --- |
| `src/EventRegistry.sol` | Issuer (ban tổ chức) và sự kiện + chính sách bán lại. Admin hủy sự kiện. |
| `src/TicketRegistry.sol` | Vé ERC-721 khóa chuyển tự do. Chỉ mint và `ESCROW_ROLE` đổi chủ được. |
| `ResaleEscrow`, `MockStable` | Chưa làm (Sprint 3, TIC-xx). |

Quyền on-chain (PRODUCT_CONTEXT 2.4):

| Role | Người giữ | Hàm |
| --- | --- | --- |
| `DEFAULT_ADMIN_ROLE` | Ví nền tảng | `addIssuer`, `removeIssuer`, `cancelEvent`, cấp role |
| `ISSUER_ROLE` (EventRegistry) | Ví ban tổ chức | `createEvent`; `batchIssue`, `revoke` cho sự kiện của mình |
| `SCANNER_ROLE` (TicketRegistry) | Ví relayer backend | `markUsed` |
| `ESCROW_ROLE` (TicketRegistry) | Contract ResaleEscrow | `setListed`, `escrowTransfer` |

## Chạy

```bash
git submodule update --init --recursive   # lib/forge-std v1.16.2, lib/openzeppelin-contracts v5.4.0
forge build
forge test -vv
forge fmt --check
```

## Deploy Fuji (testnet)

1. Tạo ví testnet riêng (không dùng ví có tiền thật): `cast wallet new`.
2. Lấy AVAX Fuji từ faucet: <https://core.app/tools/testnet-faucet/> (chọn C-Chain, dán địa chỉ ví).
3. Điền `.env` ở root (sao từ `.env.example`): `FUJI_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, tùy chọn `RELAYER_ADDRESS`.
4. Deploy:
   ```bash
   cd contracts
   set -a; source ../.env; set +a
   forge script script/Deploy.s.sol --rpc-url fuji --broadcast
   ```
   Script ghi `deployments/fuji.json`. Commit file này (chỉ chứa địa chỉ, không có khóa).
5. Cập nhật ABI + địa chỉ sang `packages/shared`: `pnpm --filter contracts abi:export`, commit `packages/shared/src/abi` và `addresses.ts`.

Thử local trước bằng anvil: chạy `anvil`, đặt `DEPLOYER_PRIVATE_KEY` bằng một khóa mặc định của anvil, rồi `forge script script/Deploy.s.sol --rpc-url anvil --broadcast`.

## Ghi chú

- `solc 0.8.24`, `evm_version = "shanghai"` (tạm; kiểm tra lại docs Avalanche trước khi deploy mainnet).
- Giá trị chính sách (tỷ lệ trần, số lần chuyển, hạn chót) do issuer truyền khi tạo sự kiện; con số chính thức chưa chốt (DECISIONS "Đang mở").
- `cancelEvent` chỉ admin gọi được (giữ tách nhiệm vụ 2.3.4). PRODUCT_CONTEXT 2.4 ghi cho ISSUER_ROLE — đang chờ chốt, xem `docs/worklog/lead.md`.
- Ràng buộc "issuer không giao dịch vé sự kiện của mình" chỉ chặn đúng ví issuer; issuer dùng ví khác thì backend phải chặn theo tài khoản.
- Không commit khóa ví.
