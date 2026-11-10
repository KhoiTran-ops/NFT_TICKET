# Kế hoạch đội và chia module

> Đọc cùng: [`PRODUCT_CONTEXT.md`](../PRODUCT_CONTEXT.md) (nghiệp vụ, nguồn sự thật) · [`BACKLOG.md`](BACKLOG.md) (task chi tiết) · [`PIPELINE_AND_STRUCTURE.md`](../PIPELINE_AND_STRUCTURE.md) (kỹ thuật) · [`WORKING_RULES.md`](WORKING_RULES.md) (quy tắc) · [`DECISIONS.md`](DECISIONS.md) (quyết định).

## 1. Chiến lược

1. **Hợp đồng trước, code sau (contract-first).** Tuần 0 chốt 3 "hợp đồng" để 3 người code song song mà không chờ nhau:
   - **API contract**: `packages/shared/openapi.yaml` + `packages/shared/src/types.ts` (trạng thái, mã lỗi mục 5.7).
   - **Contract ABI**: interface Solidity ở PIPELINE mục 4.
   - **Thiết kế**: user flow + wireframe cho mọi màn trong sprint kế tiếp.
   Ai muốn đổi hợp đồng phải mở PR riêng và được 2 người còn lại duyệt.
2. **Mock ở mọi ranh giới.** Frontend chạy với mock API (MSW) sinh từ OpenAPI; backend chạy với `MockChain`, `MockPayment`, `MockKycProvider`; contract có test riêng. Tích hợp thật vào cuối mỗi sprint.
3. **Lát cắt dọc (vertical slice).** Mỗi sprint ra **một luồng demo được từ màn hình đến DB/chain**, không làm "xong hết backend rồi mới làm frontend".
4. **Rủi ro cao làm sớm.** Thứ tự: nền tảng (auth, RBAC) → bán sơ cấp + NFT + check-in → đấu giá → eKYC + hủy sự kiện/hoàn tiền → cứng hóa. eKYC thật làm muộn, nhưng **trạng thái eKYC giả lập có từ Sprint 1** để module khác kiểm tra điều kiện giao dịch.
5. **Một chủ sở hữu mỗi module.** Chủ module quyết định chi tiết bên trong, chịu trách nhiệm test và tài liệu của module. Người khác sửa module đó phải để chủ module review.

## 2. Vai trò trong đội

| Mã | Người | Vai trò chính | Vai trò phụ |
| --- | --- | --- | --- |
| **UI** | Thành viên UX/UI | Thiết kế (Figma) + Frontend Next.js | Kiểm thử khả dụng, nội dung giao diện (microcopy, thông báo lỗi) |
| **BE** | Thành viên Backend | Backend Node/TS + DB + tích hợp giả lập | Bảo mật ứng dụng, hiệu năng |
| **LEAD** | Người thứ ba (trưởng nhóm) | Smart contract + Web3 (relayer, indexer, ví) + Tech lead | Product owner, QA/E2E, DevOps/CI, demo & tài liệu |

> Nếu người thứ ba không làm smart contract, đổi cột LEAD sang BE cho module `chain` và để LEAD giữ Product/QA/DevOps + frontend phụ trợ (màn admin).

Backend là phần nặng nhất, nên LEAD nhận các module "chạm chain" (relayer, indexer, ví, check-in on-chain) và màn admin đơn giản có thể do LEAD làm nếu UI quá tải.

## 3. Bản đồ module

| Module | Chủ | Hỗ trợ | Nội dung | Issue | Phụ thuộc |
| --- | --- | --- | --- | --- | --- |
| `shared` | LEAD | BE, UI | OpenAPI, types, mã lỗi, ABI export, địa chỉ contract | – | – |
| `infra` | LEAD | BE | Monorepo pnpm, CI, `.env.example`, seed, deploy preview | – | – |
| `contracts` | LEAD | – | EventRegistry, TicketRegistry, ResaleEscrow, MockStable, test Foundry | NFT-16, NFT-19 | shared |
| `auth` | BE | UI | Email/SMS OTP, JWT + refresh rotation, TOTP 2FA, khóa tài khoản | NFT-22, NFT-12 | shared |
| `rbac` + `audit` | BE | LEAD | RoleAssignment theo scope, guard, ma trận quyền, AuditLog | NFT-21 | auth |
| `organizer` | BE | UI | Đăng ký tổ chức, KYB, nhân sự, gate_staff | NFT-02 | rbac |
| `events` | BE | UI | Event, TicketTier, chính sách, xuất bản | NFT-02 | organizer |
| `orders` | BE | UI | Giữ chỗ, đơn, thanh toán giả lập, webhook thanh toán | NFT-03, NFT-04 | events |
| `chain` (relayer + indexer + wallet) | LEAD | BE | Ví custodial, SIWE, relayer gửi tx, indexer đồng bộ TicketCache | NFT-04, NFT-13, NFT-19 | contracts |
| `gate` + `checkin` | BE | LEAD | QR động HMAC, check-in nguyên tử, markUsed | NFT-17 | chain, rbac |
| `auction` | BE | LEAD | Mở phiên, bid, scheduler đóng, kết quả | NFT-08–10 | orders, kyc |
| `settlement` | LEAD | BE | Quyết toán đấu giá, `settle()` on-chain, giữ tiền tới sau sự kiện | NFT-11, NFT-18 | auction, chain |
| `kyc` + `eligibility` | BE | UI | KycProvider, Mock, webhook, cấp L0–L3, ma trận điều kiện | NFT-14, NFT-15 | auth |
| `refund` (hủy sự kiện) | BE | LEAD | Yêu cầu/duyệt hủy, tạo Refund, worker, đối soát, `cancelEvent` | NFT-05, NFT-06 | orders, settlement |
| `notify` | BE | UI | Email + in-app | NFT-18 | – |
| `web-buyer` | UI | – | Trang sự kiện, checkout, vé của tôi + QR, sàn đấu giá, tài khoản, eKYC | – | shared (mock) |
| `web-organizer` | UI | – | Dashboard tổ chức, tạo sự kiện, nhân sự, yêu cầu hủy, scanner | – | shared (mock) |
| `web-admin` | UI | LEAD | Duyệt tổ chức, duyệt hủy, vai trò, hoàn tiền lỗi, audit | – | shared (mock) |
| `e2e` + `docs` | LEAD | tất cả | Playwright E2E theo tiêu chí nghiệm thu, demo script, threat model | NFT-20 | tất cả |

## 4. Lộ trình theo sprint

Sprint 1 tuần (thứ Hai → Chủ nhật). Nếu thời gian thực tế khác, giữ nguyên thứ tự, co giãn độ dài. Mỗi sprint kết thúc bằng **buổi demo + tích hợp** (mục 5).

### Sprint 0 · Khởi động và hợp đồng (M0)

| Người | Việc | Đầu ra (ship) |
| --- | --- | --- |
| LEAD | Dựng monorepo, CI, `.env.example`; viết `types.ts`, mã lỗi, OpenAPI v0 cho auth/events/orders; chốt D-001…D-006 | PR monorepo chạy `pnpm build` xanh; `openapi.yaml` v0 |
| BE | Prisma schema v1 (User, Session, RoleAssignment, AuditLog, Organization, Event, Tier, Order, Ticket, KycVerification); khung NestJS/Fastify, healthcheck | `pnpm --filter backend test` xanh, migration chạy được |
| UI | User flow 3 vai (người mua, ban tổ chức, admin); design tokens; wireframe: login, OTP, trang sự kiện, checkout, vé của tôi | Link Figma trong `docs/design.md`; danh sách màn hình + trạng thái lỗi |

**Qua mốc:** cả 3 người code được với mock mà không cần hỏi nhau.

### Sprint 1 · Nền tảng: đăng nhập, phân quyền, sự kiện (M1)

| Người | Việc | Đầu ra |
| --- | --- | --- |
| BE | `auth` (OTP email, JWT, refresh rotation, TOTP), `rbac` guard + test ma trận quyền, `audit`, `organizer` + `events` CRUD, **stub trạng thái eKYC** (admin bật/tắt) | API qua Postman/test; mỗi ô ❌ của ma trận có test |
| LEAD | `EventRegistry`, `TicketRegistry` + test Foundry; deploy Fuji; export ABI | `forge test` xanh, `deployments/fuji.json` |
| UI | Login/OTP, hồ sơ, dashboard tổ chức, tạo sự kiện + hạng vé (mock API) | Màn chạy được trên preview |

**Demo:** ban tổ chức đăng nhập (2FA) → tạo và xuất bản sự kiện; người dùng thường bị chặn đúng mã lỗi.

### Sprint 2 · Bán sơ cấp, NFT, vào cổng (M1)

| Người | Việc | Đầu ra |
| --- | --- | --- |
| BE | `orders` (giữ chỗ, thanh toán giả lập, webhook idempotent), `gate` QR HMAC, `checkin` nguyên tử | Test tranh suất cuối, thanh toán lặp, check-in đồng thời |
| LEAD | `chain`: ví custodial, relayer, indexer, mint sau thanh toán, `markUsed` | Vé hiện ở "Vé của tôi" sau khi mua, có tx trên Fuji |
| UI | Trang sự kiện, checkout (có câu cam kết không hoàn), vé của tôi + QR động, màn scanner | Demo 2 điện thoại |

**Demo:** mua vé → nhận NFT → quét vào cổng → quét lại bị từ chối.

### Sprint 3 · Đấu giá và quyết toán (M2)

| Người | Việc | Đầu ra |
| --- | --- | --- |
| BE | `auction`: mở phiên, bid (khóa/phiên bản), 3 điều kiện đóng, scheduler idempotent, WebSocket giá dẫn đầu | Test chạm trần, hết giờ, im lặng, bid đúng mốc đóng |
| LEAD | `ResaleEscrow.settle`, giữ tiền `payoutHoldUntil`, `releasePayout`; `settlement` backend; chặn issuer giao dịch | Test Foundry + luồng quyết toán lỗi |
| UI | Sàn đấu giá, chi tiết phiên realtime, mở phiên, trạng thái người thắng/người bán | Demo 2 trình duyệt trả giá |

**Demo:** A mở phiên → B, C trả giá → chạm trần → B nhận vé, A thấy "chờ giải ngân".

### Sprint 4 · eKYC, ví ngoài, hủy sự kiện và hoàn tiền (M3)

| Người | Việc | Đầu ra |
| --- | --- | --- |
| BE | `kyc`: KycProvider + Mock (4 kịch bản), webhook ký, chống trùng CCCD, `eligibility` thay stub; `refund`: yêu cầu/duyệt hủy, tạo Refund, worker retry, đối soát | Test theo nghiệm thu mục 3 và 5 |
| LEAD | SIWE liên kết ví; `cancelEvent` + `claimRefund` on-chain; đối soát chain ↔ DB | Test hoàn đúng bảng 3.4 (A→B→C) |
| UI | Luồng eKYC (đồng ý → CCCD → selfie → trạng thái), banner hướng dẫn theo mã lỗi, màn admin duyệt hủy, trạng thái hoàn tiền ở "Vé của tôi" | Đi hết luồng eKYC với mock |

**Demo:** user chưa eKYC bị chặn trả giá → xác minh → trả giá được; admin duyệt hủy sự kiện → cả A, B, C nhận đúng số tiền.

### Sprint 5 · Cứng hóa và pilot (M4)

| Người | Việc |
| --- | --- |
| LEAD | Playwright E2E cho toàn bộ tiêu chí nghiệm thu, demo script, threat model, README |
| BE | Rate limit, quét log tìm PII, chạy lại job lặp, hiệu năng bid |
| UI | Trạng thái rỗng/lỗi/đang tải, mobile, accessibility, video demo dự phòng |

**Qua mốc:** mọi mục "Nghiệm thu" trong PRODUCT_CONTEXT có test hoặc bằng chứng chạy tay được ghi lại.

## 5. Điểm tích hợp và giao tiếp

| Nhịp | Hình thức | Nội dung |
| --- | --- | --- |
| Hằng ngày | Tin nhắn standup trong nhóm chat trước 10:00 | Hôm qua ship gì (link) · hôm nay làm gì · đang bị chặn bởi ai |
| Thứ Tư | Họp 15 phút | Gỡ chặn, xem hợp đồng API cần đổi |
| Chủ nhật | Họp 45 phút | Demo sprint (chạy thật, không slide) → retro 3 câu (giữ/bỏ/thử) → chốt sprint sau, cập nhật mục 4 file này |
| Cuối sprint | "Ngày tích hợp" | Tắt mock, nối FE ↔ BE ↔ chain thật, sửa lệch hợp đồng |

## 6. Ma trận phụ thuộc cần lưu ý

- `rbac` chặn gần như mọi module → BE ưu tiên xong guard trong 3 ngày đầu Sprint 1; trước đó dùng guard giả `allowAll` **chỉ trong môi trường dev**.
- `auction` cần `eligibility` → dùng stub eKYC từ Sprint 1, thay bằng thật ở Sprint 4 mà không đổi chữ ký hàm `checkEligibility(userId, action, context)`.
- `refund` cần tiền chưa giải ngân → `settlement` (Sprint 3) phải có `payoutHoldUntil` ngay từ đầu.
- UI luôn đi trước BE 1 sprint về thiết kế: cuối Sprint N, Figma của Sprint N+1 phải sẵn sàng.

## 7. Định nghĩa "xong" cho module

Một module được coi là xong khi: endpoint/hàm có trong OpenAPI hoặc ABI; có test cho mọi tiêu chí nghiệm thu liên quan; có kiểm tra quyền; không có PII trong log; có mục trong worklog của chủ module; demo được trên môi trường preview.
