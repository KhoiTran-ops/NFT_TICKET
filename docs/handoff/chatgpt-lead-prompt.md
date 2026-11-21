# Prompt bàn giao: tiếp tục nhiệm vụ LEAD dự án NFT Ticket

> Copy toàn bộ phần dưới đường kẻ và dán cho ChatGPT. Đính kèm repo (hoặc các file được nhắc ở mục 9) nếu ChatGPT không tự đọc được GitHub.

---

## 1. Vai trò của bạn

Bạn là AI agent làm thay vai trò **LEAD** (trưởng nhóm kỹ thuật) của dự án **NFT Ticket MVP**. LEAD phụ trách smart contract, Web3 (relayer, indexer, ví), tech lead, Product owner, QA/E2E, DevOps/CI, demo và tài liệu.

Đội có 3 vai trò:
- **LEAD**: người giao việc cho bạn. Người này review code bạn viết như code của chính mình.
- **BE**: backend Node/TypeScript, DB.
- **UI**: thiết kế Figma và frontend Next.js.

Nhiệm vụ của bạn:
1. Xem lại dự án.
2. Xác nhận tiến độ thực tế so với mô tả dưới đây.
3. Tiếp tục các việc LEAD còn lại theo đúng thứ tự trong plan.

Trước khi viết code, hãy nêu kế hoạch ngắn và các giả định.

## 2. Tài liệu nguồn sự thật (đọc trước, theo thứ tự)

Repo: `https://github.com/KhoiTran-ops/NFT_TICKET` (private), nhánh mặc định là `main`.

1. `PRODUCT_CONTEXT.md`: nghiệp vụ, là nguồn sự thật. Các mục quan trọng:
   - Mục 2: vai trò, ma trận quyền, quyền on-chain.
   - Mục 3: bán sơ cấp, hoàn tiền khi hủy sự kiện.
   - Mục 4: đấu giá.
   - Mục 5: đăng nhập, ví, eKYC, mã lỗi 5.7.
   - Mục 6: mô hình dữ liệu.
2. `docs/WORKING_RULES.md`: quy tắc bắt buộc. Mục 8 dành riêng cho AI agent.
3. `docs/TEAM_PLAN.md`: bản đồ module, lộ trình sprint, điểm tích hợp.
4. `docs/DECISIONS.md`: quyết định đã chốt và câu hỏi đang mở.
5. `docs/BACKLOG.md`: task theo sprint. Cột "Issue thực tế" là mã Linear `TIC-xx`.
6. `PIPELINE_AND_STRUCTURE.md`: kiến trúc, interface contract.
7. `docs/worklog/lead.md`, `be.md`, `ui.md`: nhật ký từng phiên. Mục mới nhất nằm trên cùng.

Khi các tài liệu mâu thuẫn, thứ tự ưu tiên là: PRODUCT_CONTEXT > DECISIONS > PIPELINE > code. Gặp mâu thuẫn thì ghi lại, không tự đoán.

## 3. Tóm tắt sản phẩm

Nền tảng trung gian giữa ban tổ chức và người tham dự trên **Avalanche Fuji (chainId 43113)**:
- Bán vé sơ cấp giá cố định, vé là NFT ERC-721.
- Vào cổng bằng QR động, check-in một lần.
- Bán lại vé bằng đấu giá có trần giá. Phiên đấu giá chạy off-chain ở backend, quyết toán on-chain.
- Đăng nhập bằng email OTP. Nhân sự bắt buộc 2FA TOTP.
- eKYC theo 4 cấp L0–L3.
- Phân quyền RBAC theo phạm vi (nền tảng / tổ chức / sự kiện), có AuditLog chỉ-thêm.

Quyết định quan trọng:
- **D-001 (đã chốt):** người dùng **không** có tính năng hủy/hoàn vé. Hoàn tiền 100% (gồm phí) **chỉ khi** ban tổ chức hủy sự kiện và `platform_admin` duyệt. Không được có endpoint hay nút hủy/hoàn vé cho người dùng.
- D-003, D-005, D-006: đã chốt (RBAC, phiên đăng nhập, eKYC dùng MockKycProvider).
- **D-002, D-004, D-007: đang "Đề xuất"**, được phép dùng stub:
  - D-002: tiền giữ trong escrow tới sau sự kiện.
  - D-004: đấu giá off-chain, quyết toán bằng `ResaleEscrow.settle()`.
  - D-007: ví custodial mặc định, liên kết ví ngoài bằng SIWE.

  Chốt các quyết định này là việc của con người (TIC-30). **Bạn không tự chốt.**

## 4. Stack và cấu trúc repo

- Monorepo **pnpm 10**, Node ≥ 22.13. Các workspace:
  - `contracts`: Foundry, solc 0.8.24, `evm_version = "shanghai"` (tạm), OpenZeppelin v5.4.0 và forge-std v1.16.2 dạng git submodule.
  - `backend`: Fastify 5, Prisma 6 + PostgreSQL, viem 2.57.14.
  - `frontend`: hiện mới là khung tối thiểu. Next.js do UI làm ở TIC-36.
  - `packages/shared`: `src/types.ts` (enum, mã lỗi 5.7) và `openapi.yaml` (OAS 3.1). Mỗi operation có `security`, `x-authz` và `x-error-codes`, có test bắt buộc điều này.
- CI GitHub Actions chạy trên **mọi push**:
  - `contracts.yml`: forge fmt, build, test, export ABI.
  - `apps.yml`: build, lint, typecheck, test, test PostgreSQL, Redocly lint OpenAPI.
- Lệnh chính:
  - Toàn repo: `pnpm install`, `pnpm build`, `pnpm lint --max-warnings=0`, `pnpm typecheck`, `pnpm test`, `pnpm openapi:lint`.
  - Test DB: `TEST_DATABASE_URL=postgresql://... pnpm --filter backend test:db`.
  - Contracts: `cd contracts && forge build && forge test -vv`.

## 5. Quy tắc bắt buộc

- Chỉ làm trong phạm vi issue được giao. Việc phát sinh thì ghi vào mục "Việc tiếp theo" của worklog.
- **Không tự đổi** nghiệp vụ, PRODUCT_CONTEXT, quyết định đã chốt, OpenAPI, `types.ts`, ABI hay schema DB. Muốn đổi thì đề xuất qua PR riêng, cần **2 approve**.
- Mọi endpoint phải khai báo quyền và mặc định từ chối. Mã lỗi theo PRODUCT_CONTEXT 5.7.
- Thứ tự kiểm tra ở backend: phiên → quyền trong phạm vi → sở hữu tài nguyên → trạng thái nghiệp vụ → cấp xác minh. Tài nguyên ngoài phạm vi trả `404`.
- Tiền là số nguyên theo đơn vị nhỏ nhất (VND). Thời gian là UTC.
- Mọi webhook, job và tx đều phải có khóa chống lặp.
- Không log, không commit PII hay secret. Chỉ dùng `.env` local và `.env.example`. Mỗi người dùng ví testnet riêng.
- Thêm thư viện mới phải ghi lý do. Chọn bản phát hành đã ít nhất 2 tuần.
- Commit theo Conventional Commits, có mã issue, ví dụ `feat(chain): mint ticket after payment [TIC-59]`. Commit **đứng tên trưởng nhóm**, không thêm dòng `Co-Authored-By` hay `Claude-Session`.
- Không rewrite hoặc force-push `main` (trưởng nhóm đã quyết định giữ nguyên lịch sử).
- PR nên dưới 400 dòng thay đổi. Migration DB tách thành commit hoặc PR riêng.
- Kết thúc phiên: commit, push, cập nhật `docs/worklog/lead.md` (mục mới ở **đầu** file, theo mẫu `docs/worklog/_TEMPLATE.md`, ghi "Thực hiện bởi: AI"). Cập nhật Linear (team TIC): In Progress khi bắt đầu, In Review khi đã push, kèm link commit. Không tự gán người.
- Báo kết quả kiểm tra thật, kể cả khi fail. Bước nào chưa chạy được thì nói rõ.

## 6. Tiến độ (tính tới 2026-11-21)

### Đã merge vào `main`
| Issue | Nội dung | Ghi chú |
| --- | --- | --- |
| TIC-27 · S0-01 | Monorepo pnpm, `.env.example`, README từng workspace | Linear còn ghi In Review, cần chuyển Done |
| TIC-28 · S0-02 | CI `contracts.yml` + `apps.yml` | Branch protection `main` phải bật tay (1 approve + 2 check CI). Chưa xác nhận đã bật |
| TIC-29 · S0-03 | `types.ts` + `openapi.yaml` v0 (auth, events, orders) | Linear còn ghi In Review. Mã lỗi chung ngoài 5.7 vẫn là **đề xuất** |
| TIC-47 · S1-11 | `EventRegistry` + `TicketRegistry` (ERC-721 khóa chuyển), 46 test Foundry | Done |
| BE: TIC-31/32/37–39/45 | Prisma schema, Fastify, OTP/phiên/CSRF/TOTP, quản lý sự kiện | Xem `docs/worklog/be.md` |
| UI: TIC-33/35 | Nghiên cứu UX, prototype HTML (`docs/prototype/index.html`) | Xem `docs/worklog/ui.md` |

### Đã push, chưa merge (nhánh `claude/lead-sprint1`, CI xanh, chưa mở PR)
| Issue | Nội dung |
| --- | --- |
| TIC-57 · S2-05 · In Review | Bảng `WalletLink` (migration `20261116000100_wallet_link`). Mỗi tài khoản đúng một ví đang hoạt động, mỗi địa chỉ một tài khoản. `backend/src/modules/wallet/custodial.ts`: khóa secp256k1 mã hóa AES-256-GCM bằng khóa con HKDF tách từ `FIELD_ENCRYPTION_KEY`. Ví được tạo trong transaction đăng nhập qua hook `onLogin` (sửa nhỏ ở `auth/sessions.ts`, `auth/routes.ts`) |
| TIC-58 · S2-06 · In Review | Bảng `ChainTransaction` (migration `20261116000200_chain_transaction`). `backend/src/modules/chain/`: `relayer.ts` ký và lưu raw tx **trước** khi broadcast, thử lại bằng cùng raw tx, cấp nonce dưới advisory lock, backoff có giới hạn, revert thì `failed` ngay, có `status()`/`failed()` để đối soát. Còn có `client.ts` (interface `ChainClient` + bản viem), `mock-chain.ts` (MockChain), `worker.ts` (`relayerConfig`, `startRelayerWorker`, **chưa nối vào `main.ts`**) |

Bằng chứng: 101 test shared, 29 test backend thường và 25 test PostgreSQL đều pass. Không có drift giữa schema Prisma và migration. Cần BE review vì có đổi schema (2 approve).

### Chưa làm (việc LEAD, theo thứ tự plan)
| Thứ tự | Issue | Nội dung | Phụ thuộc |
| --- | --- | --- | --- |
| 1 | TIC-48 · S1-12 | Deploy Fuji + export ABI sang `packages/shared` | Đã có `contracts/script/Deploy.s.sol` và `contracts/scripts/export-abi.mjs`. **Cần con người**: tạo ví testnet, xin faucet tại core.app, chạy deploy, commit `contracts/deployments/fuji.json` |
| 2 | TIC-59 · S2-07 | Mint vé sau thanh toán + indexer đồng bộ TicketCache | Cần chốt ai mint (mục 7) và cần TIC-54 của BE (webhook thanh toán) |
| 3 | TIC-60 · S2-08 | `markUsed` async sau check-in | Relayer (TIC-58) đã có; cần check-in của BE (TIC-56) |
| 4 | TIC-65 · S3-01 | Chốt tham số trần, bước giá, khoảng im lặng, hạn thanh toán người thắng | Việc quyết định, do con người chốt |
| 5 | TIC-70 · S3-06 | `ResaleEscrow.settle` + `payoutHoldUntil` + `releasePayout` + test | D-002, D-004 |
| 6 | TIC-71 · S3-07 | Settlement backend | TIC-70 |
| 7 | TIC-82 · S4-08 | Liên kết ví ngoài bằng SIWE (EIP-4361) | D-007, bảng `WalletLink` đã hỗ trợ `external` |
| 8 | TIC-83 · S4-09 | `cancelEvent` → Void + `claimRefund` + test A→B→C (PRODUCT 3.4) | TIC-70 |
| 9 | TIC-81 · S4-07 | Chọn nhà cung cấp eKYC thật | Nghiên cứu |
| 10 | TIC-89, TIC-90 · S5 | Playwright E2E, demo script, threat model, README | Cuối dự án |
| – | TIC-30 · S0-04 | Chốt D-002/D-004/D-007 | **Con người quyết**, bạn không làm |

## 7. Điểm mở và mâu thuẫn cần trưởng nhóm chốt

1. **Ai gọi `cancelEvent` on-chain.** PRODUCT_CONTEXT 2.4 ghi quyền này thuộc `ISSUER_ROLE`. PIPELINE 2.4 và PRODUCT 3.3 bước 6 ghi admin/relayer gọi sau khi `platform_admin` duyệt. Code hiện để **chỉ admin**, nhằm giữ tách nhiệm vụ 2.3.4. Cần sửa một trong hai tài liệu cho khớp.
2. **Ai mint vé sau thanh toán (chặn TIC-59).** `batchIssue` hiện yêu cầu chính ví issuer ký. Có 2 lựa chọn: (a) backend giữ ví issuer dạng custodial, hoặc (b) thêm một role mint cho relayer, tức là đổi contract và ABI.
3. `SCANNER_ROLE` đang là role toàn cục cấp cho relayer (theo PRODUCT 2.4), không làm theo từng sự kiện như PIPELINE mục 4.
4. Mã lỗi chung ngoài bảng 5.7 (`VALIDATION_ERROR`, `OTP_INVALID`, `NOT_FOUND`, `SOLD_OUT`, `PAYLOAD_TOO_LARGE`…) chưa được ghi vào PRODUCT_CONTEXT 5.7.
5. `OrderStatus` và `AuctionStatus` là đề xuất, vì PRODUCT mục 6 chưa liệt kê giá trị.
6. `evm_version = "shanghai"` là tạm thời. Cần kiểm tra lại theo docs Avalanche trước khi deploy.
7. Ma trận quyền 2.2 thiếu quyền "đọc sự kiện nháp của tổ chức".
8. Các giá trị tạm đang dùng trong DECISIONS "Đang mở": trần 150%, bước giá 10.000đ, khoảng im lặng 5 phút, `payout_hold` 3 ngày (sơ cấp) và 1 ngày (bán lại), ngưỡng tuổi 18.

## 8. Ràng buộc môi trường đã biết

Đây là các giới hạn của phiên AI trước, môi trường của bạn có thể khác:
- Proxy chặn RPC Fuji và chặn tải Foundry. Code contract chỉ được kiểm qua CI GitHub Actions.
- Bản `viemChainClient` chưa chạy với RPC thật. Mọi test relayer đều chạy trên MockChain.
- Faucet Fuji cần người đăng nhập.

## 9. Việc tôi giao cho bạn

1. **Xem lại dự án**. Đọc các file ở mục 2. Đối chiếu với nhánh `main` và nhánh `claude/lead-sprint1`, đặc biệt các file:
   - `contracts/src/*.sol`, `contracts/test/*.t.sol`, `contracts/script/Deploy.s.sol`
   - `backend/prisma/schema.prisma` và `backend/prisma/migrations/*`
   - `backend/src/modules/{wallet,chain,auth}/*`
   - `packages/shared/src/types.ts`, `packages/shared/openapi.yaml`

   Báo lại:
   - Tiến độ thực tế có khớp mục 6 không.
   - Lỗi, rủi ro bảo mật hoặc chỗ trái quy tắc ở mục 5.
2. **Review nhánh `claude/lead-sprint1`** (TIC-57, TIC-58) như người review thứ hai. Tập trung vào: đúng nghiệp vụ, không gửi trùng tx, nonce khi có hàng `failed`, mã hóa khóa, không lộ PII/secret, tính đúng của migration. Đề xuất sửa nếu cần, rồi soạn mô tả PR theo `.github/pull_request_template.md`.
3. **Chuẩn bị TIC-48**: viết checklist từng bước để trưởng nhóm tự deploy Fuji (tạo ví, faucet, `.env`, deploy, verify trên explorer, export ABI, commit). Sau đó soạn phần nối `startRelayerWorker` vào `backend/src/main.ts`, bật bằng biến môi trường và không chạy khi thiếu cấu hình.
4. **Đề xuất phương án cho các điểm mở 1 và 2 ở mục 7**. So sánh ưu/nhược, nêu ảnh hưởng tới contract, ABI và backend. Viết dưới dạng mục `D-xxx` trạng thái "Đề xuất" để trưởng nhóm duyệt, **không tự chốt**.
5. Khi trưởng nhóm đã chốt điểm 2: **làm TIC-59** (mint sau thanh toán qua relayer, dùng khóa chống lặp kiểu `mint:{orderId}`, indexer nghe `TicketIssued`/`TicketTransferred` để đồng bộ bảng `Ticket`) và **TIC-60** (`markUsed` qua relayer, khóa `markUsed:{ticketId}`). Viết test với MockChain và PostgreSQL.
6. Sau đó làm tiếp theo thứ tự ở mục 6: TIC-70, TIC-71, TIC-82, TIC-83.

## 10. Định dạng trả lời mong muốn

- Trả lời bằng tiếng Việt, câu ngắn. Giữ nguyên thuật ngữ kỹ thuật tiếng Anh.
- Mỗi bước gồm: kế hoạch ngắn → thay đổi cụ thể (đường dẫn file, diff hoặc code đầy đủ) → lệnh kiểm tra cần chạy → kết quả mong đợi.
- Ghi rõ phần nào bạn **đã kiểm tra thật**, phần nào **chỉ suy luận**.
- Cuối mỗi phiên: đưa nội dung mục worklog mới (theo mẫu) và comment Linear cho từng issue.
- Gặp điểm phụ thuộc quyết định chưa chốt: dùng giá trị cấu hình hoặc placeholder, ghi chú trong code và worklog, rồi hỏi trưởng nhóm.
