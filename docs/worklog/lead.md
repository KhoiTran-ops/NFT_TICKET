# Worklog · lead

## 2026-11-10 · S1-11 contract EventRegistry + TicketRegistry, chuẩn bị deploy Fuji

- **Issue:** TIC-47 (S1-11), chuẩn bị TIC-48 (S1-12)
- **Thực hiện bởi:** AI (Claude Code), theo yêu cầu của trưởng nhóm. Commit đứng tên trưởng nhóm, không có dòng Claude.
- **Thứ tự:** trưởng nhóm muốn "tạo chain → xin faucet → deploy testnet". Theo BACKLOG, TIC-47 (contract + test) phải xong trước TIC-48 (deploy Fuji + export ABI), nên làm TIC-47 trước. TIC-30 (chốt D-002/D-004/D-007) vẫn là việc con người, không đụng.
- **Đã làm:**
  - `EventRegistry`: admin thêm/bớt issuer, issuer tạo sự kiện kèm `Policy` (resaleAllowed, priceCapBps, maxTransfers, transferDeadline), admin hủy sự kiện.
  - `TicketRegistry` (ERC-721, OpenZeppelin v5.4.0): chặn mọi `transferFrom`/`safeTransferFrom`. Chỉ mint (issuer của sự kiện, `batchIssue`) và `escrowTransfer` (ESCROW_ROLE) đổi được chủ. `markUsed` chỉ SCANNER_ROLE. `revoke` chỉ issuer, không áp dụng cho vé Listed. Vé của sự kiện đã hủy đọc ra `Void` (trừ vé đã thu hồi). `escrowTransfer` kiểm tra resaleAllowed, hạn chót, số lần chuyển, issuer của sự kiện không mua/bán.
  - 46 test Foundry (13 EventRegistry + 33 TicketRegistry, có 2 fuzz test, mỗi cái 1000 lần chạy). Mỗi role bị từ chối có test riêng.
  - `script/Deploy.s.sol` ghi `deployments/fuji.json`. `scripts/export-abi.mjs` xuất ABI + địa chỉ sang `packages/shared/src/abi`, `addresses.ts`.
  - CI chạy trên **mọi push** (trước đây chỉ PR/`main`, nên chưa chạy lần nào). Thêm bước kiểm tra ABI trong `packages/shared` khớp contract. Nâng `actions/checkout`, `actions/setup-node` lên v5 (Node 20 deprecated).
- **Bằng chứng:** CI GitHub Actions (forge 1.9.0, solc 0.8.24): `forge fmt --check`, `forge build`, `forge test` xanh, 46/46 pass. `apps` xanh. Local không có forge (proxy chặn tải Foundry), nên kiểm tra contract hoàn toàn dựa vào CI.
- **Quyết định phát sinh:** không. Có điểm cần chốt (bên dưới).
- **Bị chặn:**
  - **Deploy Fuji từ phiên AI không làm được:** proxy chặn RPC `api.avax-test.network` (403), không có forge local, và cần ví có AVAX testnet. **Faucet** (<https://core.app/tools/testnet-faucet/>) cần người đăng nhập/qua captcha → trưởng nhóm làm. Các bước có trong `contracts/README.md` mục "Deploy Fuji".
- **Cần trưởng nhóm xem:**
  - **Mâu thuẫn tài liệu:** PRODUCT_CONTEXT 2.4 ghi `cancelEvent` thuộc `ISSUER_ROLE`; PIPELINE mục 4 và 3.3 bước 6 ghi admin/relayer gọi sau khi `platform_admin` duyệt. Code đang để **chỉ admin** để giữ tách nhiệm vụ 2.3.4 (issuer không tự hủy). Cần sửa một trong hai tài liệu.
  - `SCANNER_ROLE` là role toàn cục cấp cho relayer (theo PRODUCT_CONTEXT 2.4), không làm `setScanner(eventId, …)` theo sự kiện như PIPELINE mục 4.
  - `batchIssue` yêu cầu chính ví issuer ký. Nếu mint sau thanh toán do relayer gửi (S2-07), cần chốt: ví issuer custodial do backend giữ, hay cho relayer một role mint riêng.
  - Chưa chặn `approve`/`setApprovalForAll` (vô hại vì không chuyển được), chưa có `tokenURI` (metadata không PII làm sau).
  - 4 commit cũ của phiên trước (`947be29`…`97c7e0e`) còn dòng `Claude-Session`. Muốn bỏ phải rewrite + force-push nhánh `claude/lead-sprint0`; lệnh này bị chặn quyền trong phiên. Commit mới không có dòng đó.
- **Việc tiếp theo:**
  - [ ] Trưởng nhóm: tạo ví testnet, xin faucet, chạy deploy theo `contracts/README.md`, commit `deployments/fuji.json` (TIC-48)
  - [ ] Sau deploy: `pnpm --filter contracts abi:export` để có địa chỉ trong `packages/shared`
  - [ ] Chốt quyền `cancelEvent` và cách mint qua relayer
  - [ ] Sprint 3: `ResaleEscrow` + `MockStable`


## 2026-11-10 · Sprint 0 LEAD: monorepo, CI, packages/shared v0

- **Issue:** TIC-27 (S0-01), TIC-28 (S0-02), TIC-29 (S0-03)
- **Thực hiện bởi:** AI (Claude Code), theo yêu cầu của trưởng nhóm. Commit đứng tên trưởng nhóm theo yêu cầu.
- **Đã làm:**
  - TIC-27: monorepo pnpm 10 với 4 workspace `contracts` (Foundry, `forge-std` v1.16.2 qua git submodule), `backend`, `frontend`, `packages/shared`. Backend/frontend chỉ là khung TypeScript tối thiểu; BE dựng framework ở TIC-32, UI dựng Next.js ở TIC-36. Có `tsconfig.base.json`, ESLint 10 flat config, `.env.example` (không có secret thật), README cho root và từng workspace. `pnpm build` ở root không gọi `forge`; contracts build/test riêng (`pnpm contracts:build|test`).
  - TIC-28: `.github/workflows/contracts.yml` (`forge fmt --check` → `forge build` → `forge test`, profile `ci`) và `apps.yml` (`pnpm install --frozen-lockfile` → build → lint → typecheck → test → Redocly lint OpenAPI). Chạy trên mọi PR và push vào `main`.
  - TIC-29: `packages/shared/src/types.ts` (vai trò, phạm vi, quyền theo 2.2; cấp L0–L3; enum trạng thái sự kiện, yêu cầu hủy, đơn, vé, phiên đấu giá + lý do đóng, hoàn tiền + lý do, eKYC + mã lý do; mã lỗi đúng bảng 5.7 kèm HTTP và hành động gợi ý). `openapi.yaml` v0 (OAS 3.1): auth (CSRF, OTP email, refresh xoay vòng, logout, logout mọi thiết bị, phiên, TOTP setup/activate/verify, OTP SĐT), events (danh sách/chi tiết công khai, tạo/sửa nháp, hạng vé, xuất bản, yêu cầu hủy sự kiện, admin xem/duyệt/từ chối hủy), orders (giữ chỗ + tạo đơn với `Idempotency-Key` và tích cam kết không hoàn, đơn của tôi, chi tiết đơn, khởi tạo thanh toán giả lập, webhook thanh toán ký HMAC).
  - Mọi operation có `security`, `x-authz` (permission/scope/minLevel/mfa/audit) và `x-error-codes`. Test (`packages/shared/test/`) kiểm: từ chối mặc định, mã lỗi khớp `types.ts` + có response HTTP tương ứng, enum OpenAPI ↔ types đồng bộ, không có path/quyền hủy-hoàn vé cho người dùng (D-001).
  - Thư viện mới (lý do): `typescript` 5.9.3, `eslint` 10 + `@eslint/js` + `typescript-eslint` + `globals` (lint chung), `vitest` (test), `@types/node`, `yaml` (test đọc OpenAPI), `@redocly/cli` (validate OpenAPI). Không dùng TypeScript 7 vì `typescript-eslint` chỉ hỗ trợ `<6.1`.
- **Đã ship:** nhánh `claude/lead-sprint0` — commit `947be29` (TIC-27), `3183893` (TIC-28), `d882358` (TIC-29).
- **Bằng chứng (chạy local):**
  - `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm lint --max-warnings=0`, `pnpm typecheck`: xanh.
  - `pnpm test`: 101/101 test pass (`packages/shared`); backend/frontend chưa có test (`--passWithNoTests`).
  - `pnpm openapi:lint` (Redocly `recommended`): hợp lệ, 0 cảnh báo. Đã thử xóa `x-authz` của một endpoint → test fail đúng như mong đợi.
  - **Chưa kiểm được:** `forge build` / `forge test` / `forge fmt --check`. Môi trường phiên này không cài được Foundry (GitHub releases bị proxy chặn; cài qua npm bị từ chối). `contracts.yml` sẽ là lần chạy đầu tiên.
  - **CI chưa chạy trên GitHub:** workflow chỉ chạy khi có PR hoặc push vào `main`, mà repo chưa có `main` và chưa có PR.
- **Quyết định phát sinh:** không. Không đụng D-002/D-004/D-007 (TIC-30).
- **Bị chặn / cần trưởng nhóm làm tay:**
  - **Branch protection `main`** (không làm được bằng code). Sau khi tạo `main` từ nhánh tài liệu và merge PR này: GitHub → Settings → Branches → Add branch ruleset (hoặc "Add rule") cho `main`: bật *Require a pull request before merging* (1 approval, *Dismiss stale approvals*), *Require status checks to pass* với 2 check `forge fmt + build + test` và `lint + build + test (JS/TS workspaces)` (chỉ hiện để chọn sau khi đã chạy ít nhất một lần), *Require branches to be up to date*, *Block force pushes*, không cho xóa nhánh. Đặt `main` làm default branch. Đổi hợp đồng cần 2 approve: dùng CODEOWNERS cho `packages/shared/` nếu muốn bắt buộc bằng GitHub.
  - Linear connector bị ngắt giữa phiên: TIC-27/28/29 đã chuyển In Progress lúc bắt đầu; bước chuyển In Review + comment ghi ở cuối phiên.
- **Cần BE + UI review trong PR (đổi hợp đồng, 2 approve):**
  - `GENERAL_ERROR_CODES` là **đề xuất ngoài bảng 5.7**: `VALIDATION_ERROR`, `OTP_INVALID`, `CSRF_INVALID`, `NOT_FOUND`, `SOLD_OUT`, `RESERVATION_EXPIRED`, `INVALID_STATE`, `IDEMPOTENCY_CONFLICT`, `OTP_LOCKED`, `RATE_LIMITED`, `INTERNAL_ERROR`. Bảng 5.7 không phủ 404 ngoài phạm vi (2.3.2), lỗi OTP/giới hạn gửi (5.1), hết suất (3.1). Nếu đồng ý, cần PR sửa PRODUCT_CONTEXT 5.7. Chưa sửa PRODUCT_CONTEXT.
  - `OrderStatus`, `AuctionStatus`, `EventCancellationStatus` là đề xuất: PRODUCT_CONTEXT mục 6 chưa liệt kê giá trị. Phần quyết toán của `AuctionStatus` phụ thuộc NFT-11 và D-004 (đang Đề xuất).
  - Thời hạn giữ chỗ đơn chưa có trong PRODUCT_CONTEXT → OpenAPI chỉ trả `expiresAt`, giá trị để backend cấu hình.
  - Ma trận 2.2 không có quyền "đọc sự kiện nháp / danh sách sự kiện của tổ chức" và chưa rõ API báo cáo đơn tổng hợp tổ chức → v0 **chưa có** `GET /organizations/{orgId}/events` và báo cáo đơn tổ chức. Cần chốt quyền trước Sprint 1 (dashboard tổ chức).
  - `contracts/foundry.toml` đặt `evm_version = "shanghai"` tạm thời; LEAD kiểm tra docs Avalanche trước khi deploy Fuji.
  - Các commit tài liệu cũ trên `claude/serene-cori-nqupyy` (`abec554`…`ad9b2b4`) vẫn đứng tên Claude; không sửa vì đã push lên nhánh dùng chung, sửa thì phải force-push.
- **Việc tiếp theo:**
  - [ ] Tạo `main`, mở PR từ `claude/lead-sprint0`, xem CI chạy lần đầu (đặc biệt `forge`)
  - [ ] Bật branch protection `main` như trên
  - [ ] BE + UI review `types.ts` / `openapi.yaml`; nếu nhận mã lỗi chung thì PR sửa PRODUCT_CONTEXT 5.7
  - [ ] Bổ sung quyền đọc sự kiện nháp của tổ chức vào ma trận 2.2, rồi thêm endpoint ở OpenAPI v0.2
  - [ ] TIC-30: chốt D-002/D-004/D-007 (con người quyết)



## 2026-11-10 · Tạo backlog Sprint 0–5 trên Linear

- **Issue:** TIC-5 (NFT-01), TIC-25 (NFT-21), TIC-26 (NFT-22), TIC-27 … TIC-94
- **Thực hiện bởi:** AI (Claude Code, qua Linear connector), theo yêu cầu của trưởng nhóm
- **Đã làm:**
  - Đối chiếu TIC-5 … TIC-24 trước khi tạo. Không tạo trùng.
  - Đổi tên TIC-10, TIC-13, TIC-21 theo `docs/BACKLOG.md`.
  - Cập nhật milestone M0–M4 (đã có sẵn): tên M1 → "Nền tảng và bán sơ cấp", M3 → "Định danh, hủy sự kiện và tích hợp", mô tả = điều kiện qua mốc ở PRODUCT_CONTEXT mục 8.
  - Tạo nhãn team TIC: `ui`, `be`, `lead`, `contract`, `decision`.
  - Tạo NFT-21 → TIC-25, NFT-22 → TIC-26 (milestone M1).
  - Tạo 68 task S0-01 … S5-06 (TIC-27 … TIC-94): sub-issue theo cột Cha / Linear, nhãn theo người (+ `contract` cho việc on-chain, `decision` cho việc chốt quyết định), estimate S=1/M=2/L=3, milestone theo sprint (S0→M0, S1–S2→M1, S3→M2, S4→M3, S5→M4). Không gán người.
  - S3-01 đặt dưới TIC-12 và liên kết "related" với TIC-17.
  - Thêm cột "Issue thực tế" vào `docs/BACKLOG.md`.
- **Đã ship:** nhánh `claude/serene-cori-nqupyy`
- **Quyết định phát sinh:** không
- **Bị chặn / chưa làm được:**
  - Cycle Sprint 0–5: Linear connector không có tool tạo cycle, team TIC chưa có cycle nào. Cần bật Cycles trong Linear (1 tuần, bắt đầu thứ Hai 2026-11-16) rồi gán issue theo tiền tố S0…S5.
- **Cần trưởng nhóm xem:**
  - Mô tả của TIC-10 và TIC-13 vẫn nói về "hủy vé theo yêu cầu", trái với D-001. Mới chỉ đổi tiêu đề, chưa sửa mô tả.
  - Milestone của issue cũ chưa khớp mục 8: TIC-6 (NFT-12) đang ở M3, mục 8 xếp M1; TIC-13 (NFT-06) đang ở M1, mục 8 xếp M3. Chưa tự chuyển.
  - Bảng đối chiếu ở PRODUCT_CONTEXT mục 8 vẫn ghi NFT-21/NFT-22 là *(mới)*; mã thật là TIC-25/TIC-26.
- **Việc tiếp theo:**
  - [ ] Bật Cycles cho team TIC và gán issue theo sprint
  - [ ] Sửa mô tả TIC-10/TIC-13 và milestone TIC-6/TIC-13
  - [ ] Cập nhật bảng đối chiếu mục 8 với TIC-25/TIC-26
  - [ ] Chốt assignee khi bắt đầu từng issue

## 2026-11-10 · Lên plan đội, quy tắc làm việc và sửa plan sản phẩm

- **Issue:** TIC-10 (NFT-05), TIC-18 (NFT-14), NFT-21/NFT-22 (chưa tạo trên Linear)
- **Thực hiện bởi:** AI (Claude Code), theo yêu cầu của trưởng nhóm
- **Đã làm:**
  - Sửa `PRODUCT_CONTEXT.md`: bỏ hủy vé theo yêu cầu người dùng, chỉ hoàn tiền khi ban tổ chức hủy sự kiện (mục 3); hoàn thiện đăng nhập, ví, eKYC, cấp xác minh, mã lỗi (mục 5); hoàn thiện RBAC theo phạm vi + audit (mục 2).
  - Cập nhật `PIPELINE_AND_STRUCTURE.md` cho khớp: luồng hủy sự kiện, giữ tiền tới sau sự kiện, module backend/frontend mới.
  - Tạo `docs/TEAM_PLAN.md`, `docs/WORKING_RULES.md`, `docs/DECISIONS.md`, worklog, PR template, `CLAUDE.md`.
- **Đã ship:** nhánh `claude/serene-cori-nqupyy`
- **Quyết định phát sinh:** D-001 … D-007
- **Bị chặn:** không
- **Việc tiếp theo:**
  - [ ] Cả đội đọc và approve TEAM_PLAN + WORKING_RULES (buổi họp Sprint 0)
  - [x] Tạo issue Linear theo `docs/BACKLOG.md` (xong 2026-11-10, xem mục bên dưới)
  - [ ] Chốt các mục "Đang mở" trong DECISIONS.md theo hạn
  - [ ] Bật branch protection cho `main` (1 approve, CI bắt buộc)
  - [ ] Sprint 0: dựng monorepo + CI + `packages/shared` (LEAD)
