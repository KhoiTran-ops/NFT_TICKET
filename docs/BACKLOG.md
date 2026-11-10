# Backlog chia việc (nguồn để tạo issue Linear)

> Bản này dùng để tạo/cập nhật issue trên Linear (team TIC, project NFT Ticket MVP). Sau khi tạo, Linear là nơi theo dõi trạng thái; file này chỉ sửa khi đổi kế hoạch. Phân công theo [`TEAM_PLAN.md`](TEAM_PLAN.md).
>
> Cột **Linear**: `TIC-xx` = issue đã có (cập nhật), `mới` = cần tạo. Ước lượng: S ≤ ½ ngày · M ≤ 1 ngày · L ≤ 2 ngày.
> Nhãn đề xuất: `ui`, `be`, `lead`, `contract`, `decision`, `blocked-by-decision`.

## Việc quản trị Linear (làm một lần)

| Việc | Ghi chú |
| --- | --- |
| Đổi tên TIC-10 | "NFT-05 · Chốt chính sách hoàn tiền khi hủy sự kiện" |
| Đổi tên TIC-13 | "NFT-06 · Triển khai hủy sự kiện và hoàn tiền hàng loạt" |
| Đổi tên TIC-21 | "NFT-15 · Triển khai luồng eKYC, trạng thái và kiểm tra điều kiện giao dịch" |
| Tạo cycle | Sprint 0 → Sprint 5, mỗi cycle 1 tuần |
| Tạo milestone | M0 … M4 theo PRODUCT_CONTEXT mục 8 |

## Sprint 0 · Khởi động và hợp đồng (M0)

| Mã | Tiêu đề | Người | Ước lượng | Linear | Cha |
| --- | --- | --- | --- | --- | --- |
| S0-01 | Dựng monorepo pnpm (contracts, backend, frontend, packages/shared) | LEAD | M | mới | – |
| S0-02 | CI: contracts.yml + apps.yml, branch protection `main` | LEAD | S | mới | – |
| S0-03 | `packages/shared`: types.ts (trạng thái, mã lỗi 5.7), OpenAPI v0 auth/events/orders | LEAD | M | mới | – |
| S0-04 | Chốt D-002, D-004, D-007 và các mục "Đang mở" có hạn Sprint 0 | LEAD | S | TIC-5 | NFT-01 |
| S0-05 | Prisma schema v1 + migration + seed | BE | M | mới | NFT-12 |
| S0-06 | Khung backend (NestJS/Fastify), healthcheck, logger có `maskPii()` | BE | S | mới | – |
| S0-07 | User flow 3 vai: người mua, ban tổ chức, admin | UI | M | mới | NFT-01 |
| S0-08 | Design tokens + component cơ bản trên Figma | UI | M | mới | – |
| S0-09 | Wireframe: login/OTP, trang sự kiện, checkout, vé của tôi | UI | M | mới | – |
| S0-10 | Khung Next.js + Tailwind + MSW mock từ OpenAPI | UI | S | mới | – |

## Sprint 1 · Đăng nhập, phân quyền, sự kiện (M1)

| Mã | Tiêu đề | Người | Ước lượng | Linear | Cha |
| --- | --- | --- | --- | --- | --- |
| S1-01 | Email OTP: gửi, xác minh, giới hạn gửi/thử, khóa 15 phút | BE | M | mới | NFT-22 |
| S1-02 | JWT 15' + refresh rotation 30 ngày + phát hiện dùng lại + CSRF | BE | M | mới | NFT-22 |
| S1-03 | TOTP 2FA cho nhân sự + yêu cầu xác thực lại thao tác đặc quyền | BE | M | mới | NFT-22 |
| S1-04 | RoleAssignment theo scope + guard `@RequirePermission` + cache 60s | BE | L | mới | NFT-21 |
| S1-05 | Test ma trận quyền (mỗi ô ❌ một test) | BE | M | mới | NFT-21 |
| S1-06 | AuditLog chỉ-thêm + API đọc cho admin | BE | S | mới | NFT-21 |
| S1-07 | Hồ sơ cơ bản + xác thực SĐT (SMS giả lập) | BE | M | TIC-6 | NFT-12 |
| S1-08 | Organization + KYB giả lập + gán org_owner/org_manager/gate_staff | BE | M | mới | NFT-21 |
| S1-09 | Event/TicketTier CRUD, xuất bản, cờ `kyc_required` | BE | M | TIC-7 | NFT-02 |
| S1-10 | Stub trạng thái eKYC + `checkEligibility(userId, action, ctx)` | BE | S | mới | NFT-15 |
| S1-11 | EventRegistry + TicketRegistry (khóa chuyển) + test Foundry | LEAD | L | mới | NFT-16 |
| S1-12 | Deploy Fuji + export ABI sang packages/shared | LEAD | S | mới | NFT-16 |
| S1-13 | Màn login, OTP, TOTP | UI | M | mới | NFT-22 |
| S1-14 | Màn hồ sơ + xác thực SĐT | UI | S | mới | NFT-12 |
| S1-15 | Dashboard tổ chức + tạo sự kiện/hạng vé + nhân sự | UI | L | mới | NFT-02 |
| S1-16 | Figma Sprint 2: trang sự kiện, checkout, vé của tôi, scanner | UI | M | mới | – |

## Sprint 2 · Bán sơ cấp, NFT, vào cổng (M1)

| Mã | Tiêu đề | Người | Ước lượng | Linear | Cha |
| --- | --- | --- | --- | --- | --- |
| S2-01 | Giữ chỗ có hạn + giải phóng đúng một lần + hạn mức vé/tài khoản | BE | L | TIC-8 | NFT-03 |
| S2-02 | Thanh toán giả lập + webhook idempotent + xử lý thanh toán muộn/lặp | BE | M | TIC-9 | NFT-04 |
| S2-03 | Gate token QR HMAC 30s + nonce | BE | M | TIC-11 | NFT-17 |
| S2-04 | Check-in nguyên tử + chặn vé listed/void | BE | M | TIC-11 | NFT-17 |
| S2-05 | Ví custodial tạo khi đăng ký (khóa mã hóa) | LEAD | M | mới | NFT-13 |
| S2-06 | Relayer gửi tx + retry queue | LEAD | M | mới | NFT-19 |
| S2-07 | Mint vé sau thanh toán + indexer đồng bộ TicketCache | LEAD | L | TIC-9 | NFT-04 |
| S2-08 | `markUsed` async sau check-in | LEAD | S | mới | NFT-17 |
| S2-09 | Trang sự kiện + checkout có xác nhận "không hoàn tiền trừ khi hủy sự kiện" | UI | M | mới | NFT-03 |
| S2-10 | Vé của tôi + QR động | UI | M | mới | NFT-17 |
| S2-11 | Màn scanner (camera) + kết quả ✅/❌ có lý do | UI | M | mới | NFT-17 |
| S2-12 | Figma Sprint 3: sàn đấu giá, chi tiết phiên, mở phiên | UI | M | mới | – |

## Sprint 3 · Đấu giá và quyết toán (M2)

| Mã | Tiêu đề | Người | Ước lượng | Linear | Cha |
| --- | --- | --- | --- | --- | --- |
| S3-01 | Chốt tham số trần, bước giá, im lặng, hạn thanh toán người thắng | LEAD | S | TIC-12, TIC-17 | NFT-07, NFT-11 |
| S3-02 | Mở phiên + khóa vé đang rao + chặn ORGANIZER_CONFLICT | BE | M | TIC-14 | NFT-08 |
| S3-03 | Ghi nhận bid (khóa/phiên bản), bid đúng trần, WebSocket giá dẫn đầu | BE | L | TIC-16 | NFT-09 |
| S3-04 | Scheduler đóng phiên idempotent, 3 điều kiện đóng | BE | L | TIC-19 | NFT-10 |
| S3-05 | Thông báo kết quả phiên (email + in-app) | BE | S | TIC-22 | NFT-18 |
| S3-06 | `ResaleEscrow.settle` + `payoutHoldUntil` + `releasePayout` + test | LEAD | L | mới | NFT-19 |
| S3-07 | Settlement backend: trạng thái quyết toán, lỗi chuyển quyền sau thu tiền | LEAD | M | TIC-22 | NFT-18 |
| S3-08 | Sàn đấu giá + chi tiết phiên realtime | UI | L | mới | NFT-09 |
| S3-09 | Mở phiên từ vé của tôi + trạng thái người bán "chờ giải ngân" | UI | M | mới | NFT-08 |
| S3-10 | Figma Sprint 4: eKYC, banner mã lỗi, admin duyệt hủy, trạng thái hoàn tiền | UI | M | mới | – |

## Sprint 4 · eKYC, ví ngoài, hủy sự kiện và hoàn tiền (M3)

| Mã | Tiêu đề | Người | Ước lượng | Linear | Cha |
| --- | --- | --- | --- | --- | --- |
| S4-01 | KycProvider interface + MockKycProvider (4 kịch bản) | BE | M | TIC-21 | NFT-15 |
| S4-02 | Webhook eKYC có chữ ký + chống lặp; duyệt tay cho kyc_reviewer | BE | M | TIC-21 | NFT-15 |
| S4-03 | Chống trùng CCCD (HMAC), mã hóa trường, giới hạn số lần thử | BE | M | TIC-21 | NFT-15 |
| S4-04 | Eligibility thật thay stub, cấp L0–L3, mã lỗi 5.7 | BE | S | TIC-21 | NFT-15 |
| S4-05 | Yêu cầu hủy sự kiện + duyệt của admin (4 mắt) | BE | M | TIC-13 | NFT-06 |
| S4-06 | Tạo Refund cho mỗi payment chưa giải ngân + worker retry + đối soát | BE | L | TIC-13 | NFT-06 |
| S4-07 | Chọn nhà cung cấp eKYC thật (so sánh chi phí, pháp lý) | LEAD | S | TIC-18 | NFT-14 |
| S4-08 | Liên kết ví ngoài bằng SIWE (nonce, chainId, chống dùng lại) | LEAD | M | TIC-15 | NFT-13 |
| S4-09 | `cancelEvent` → Void + `claimRefund` + test A→B→C | LEAD | L | TIC-23 | NFT-19 |
| S4-10 | Luồng eKYC: đồng ý → CCCD → selfie → trạng thái | UI | L | TIC-21 | NFT-15 |
| S4-11 | Banner/nút hướng dẫn theo mã lỗi ở mọi chỗ bị chặn | UI | S | TIC-21 | NFT-15 |
| S4-12 | Màn tài khoản: ví (SIWE), phiên đăng nhập | UI | M | TIC-15 | NFT-13 |
| S4-13 | Admin: duyệt tổ chức, duyệt hủy sự kiện, hoàn tiền lỗi, audit | UI | L | mới | NFT-21 |
| S4-14 | Trạng thái hoàn tiền ở Vé của tôi + yêu cầu hủy ở dashboard tổ chức | UI | M | TIC-13 | NFT-06 |

## Sprint 5 · Cứng hóa và pilot (M4)

| Mã | Tiêu đề | Người | Ước lượng | Linear | Cha |
| --- | --- | --- | --- | --- | --- |
| S5-01 | Playwright E2E cho toàn bộ tiêu chí nghiệm thu | LEAD | L | TIC-24 | NFT-20 |
| S5-02 | Demo script, threat model, README | LEAD | M | TIC-24 | NFT-20 |
| S5-03 | Rate limit, quét log tìm PII, chạy lại job lặp | BE | M | TIC-24 | NFT-20 |
| S5-04 | Kiểm thử tải cho bid đồng thời | BE | S | TIC-24 | NFT-20 |
| S5-05 | Trạng thái rỗng/lỗi/đang tải, mobile, accessibility | UI | M | TIC-24 | NFT-20 |
| S5-06 | Video demo dự phòng | UI | S | TIC-24 | NFT-20 |
