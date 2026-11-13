# contracts

Smart contract Solidity cho NFT Ticket, dùng [Foundry](https://book.getfoundry.sh/). Chủ module: LEAD.

Interface dự kiến (`EventRegistry`, `TicketRegistry`, `ResaleEscrow`, `MockStable`): xem `PIPELINE_AND_STRUCTURE.md` mục 4. Sprint 0 mới có khung; contract thật làm ở Sprint 1 (S1-xx).

```bash
git submodule update --init --recursive   # lib/forge-std (v1.16.2)
forge build
forge test -vv
forge fmt --check
```

Hoặc từ root: `pnpm contracts:build`, `pnpm contracts:test`.

- `solc 0.8.24`, `evm_version = "shanghai"` (tạm, cần kiểm tra lại theo docs Avalanche trước khi deploy Fuji).
- `test/Scaffold.t.sol` chỉ để CI có test chạy; xóa khi có test thật.
- Không commit khóa ví. Deploy dùng biến `DEPLOYER_PRIVATE_KEY` trong `.env` (xem `.env.example`).
