# Worklog · lead

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
  - [ ] Đổi tên TIC-10, TIC-13, TIC-21 trên Linear; tạo issue NFT-21, NFT-22
  - [ ] Chốt các mục "Đang mở" trong DECISIONS.md theo hạn
  - [ ] Bật branch protection cho `main` (1 approve, CI bắt buộc)
  - [ ] Sprint 0: dựng monorepo + CI + `packages/shared` (LEAD)
