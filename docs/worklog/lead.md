# Worklog · lead


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
