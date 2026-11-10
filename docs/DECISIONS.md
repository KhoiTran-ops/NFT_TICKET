# Nhật ký quyết định

Mỗi quyết định có mã `D-xxx`, không xóa. Muốn đổi quyết định thì thêm quyết định mới ghi "thay thế D-xxx" và đánh dấu cái cũ `Bị thay thế`.

Trạng thái: `Đã chốt` · `Đề xuất` (chờ duyệt, được dùng stub) · `Đang mở` (chưa có phương án) · `Bị thay thế`.

## Bảng tổng hợp

| Mã | Ngày | Quyết định | Trạng thái | Người chốt | Liên quan |
| --- | --- | --- | --- | --- | --- |
| D-001 | 2026-11-10 | Người dùng không được hủy/hoàn vé. Hoàn tiền chỉ khi ban tổ chức hủy sự kiện và `platform_admin` duyệt; hoàn 100% gồm phí. | Đã chốt | Chủ dự án | NFT-05, NFT-06 · PRODUCT 3.2 |
| D-002 | 2026-11-10 | Mỗi khoản thanh toán chưa giải ngân hoàn về người đã trả; doanh thu sơ cấp và tiền bán lại giữ trong escrow tới sau sự kiện. | Đề xuất | LEAD | NFT-05, NFT-11 · PRODUCT 3.4 |
| D-003 | 2026-11-10 | Mô hình RBAC theo phạm vi (nền tảng/tổ chức/sự kiện) với 8 vai trò; nhân sự bắt buộc 2FA; AuditLog chỉ-thêm. | Đã chốt | Chủ dự án | NFT-21 · PRODUCT 2 |
| D-004 | 2026-11-10 | Bán lại bằng đấu giá chạy off-chain ở backend, quyết toán on-chain qua `ResaleEscrow.settle()`. Listing giá cố định là dự phòng demo. | Đề xuất | LEAD + BE | NFT-07, NFT-16 · PIPELINE 2.2 |
| D-005 | 2026-11-10 | Đăng nhập email OTP không mật khẩu; JWT 15 phút + refresh 30 ngày xoay vòng; SĐT xác thực trước giao dịch. | Đã chốt | Chủ dự án | NFT-22 · PRODUCT 5.1 |
| D-006 | 2026-11-10 | eKYC 4 cấp L0–L3; giao dịch bán lại cần L3; không lưu ảnh giấy tờ; chống trùng bằng HMAC số CCCD; MVP dùng MockKycProvider. | Đã chốt | Chủ dự án | NFT-14, NFT-15 · PRODUCT 5.4–5.6 |
| D-007 | 2026-11-10 | Ví custodial mặc định + liên kết ví ngoài bằng SIWE (EIP-4361) trên Fuji. | Đề xuất | LEAD | NFT-13 · PRODUCT 5.3 |

## Đang mở

| Câu hỏi | Ai trả lời | Hạn | Đang dùng tạm |
| --- | --- | --- | --- |
| `payout_hold` sau sự kiện là bao lâu? | Chủ dự án | Sprint 3 | 3 ngày (sơ cấp), 1 ngày (bán lại) |
| Dời lịch/đổi địa điểm có cho hoàn không? | Chủ dự án | Trước pilot | Không hoàn, được bán lại |
| Nhà cung cấp eKYC thật? | LEAD | Sprint 4 | MockKycProvider |
| Ngưỡng tuổi giao dịch? | Chủ dự án | Sprint 4 | 18 |
| Tỷ lệ trần, bước giá, khoảng im lặng chính thức? | Chủ dự án | Sprint 3 | 150%, 10.000đ, 5 phút |
| Hạn thanh toán của người thắng đấu giá, xử lý bỏ cuộc? | Chủ dự án + BE | Sprint 3 | Thanh toán ngay bằng tiền đã giữ khi bid |

## Mẫu thêm quyết định chi tiết

Khi quyết định cần giải thích dài, thêm mục dưới đây:

```markdown
### D-xxx · <tiêu đề>
- **Ngày / Người chốt:**
- **Bối cảnh:** vấn đề là gì, vì sao phải quyết bây giờ
- **Phương án đã xét:** A / B / C (ưu, nhược)
- **Quyết định:**
- **Hệ quả:** việc phải làm, tài liệu phải sửa
```
