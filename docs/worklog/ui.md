# Worklog · ui

## 2026-11-13 · Nghiên cứu giao diện NFT ticket và lỗi UI thường gặp làm đầu vào cho user flow, wireframe

- **Issue:** TIC-33 (S0-07), TIC-35 (S0-09)
- **Thực hiện bởi:** AI (Claude Code), theo yêu cầu của thành viên UX/UI.
- **Thời lượng:** ~1 giờ
- **Đã làm:**
  - Liệt kê 22 issue nhãn `ui` trên Linear theo sprint.
  - Đọc 4 trang tham khảo (SI Tickets Box Office, SeatlabNFT, Unlock Protocol, bài OpenSea về Polygon trên Seaport) và báo cáo UI/UX SUSPA.
  - Viết `docs/ux-research.md`: so sánh sản phẩm, 11 lỗi UI thường gặp, cách áp dụng vào từng màn kèm mã issue, câu hỏi mở.
- **Đã ship:** `docs/ux-research.md` (commit trên nhánh `claude/amazing-darwin-prmd3k`)
- **Bằng chứng:** không áp dụng (tài liệu).
- **Quyết định phát sinh:** không. Có 3 câu hỏi mở ở mục 4 của `docs/ux-research.md`.
- **Bị chặn:** Unlock là SPA, chỉ đọc được nút "Connect" và phần mô tả · thành viên UX/UI tự mở trang trên trình duyệt có ví nếu cần chi tiết.
- **Việc tiếp theo:**
  - [ ] TIC-33: vẽ user flow 3 vai dựa trên mục 1.5 và 3
  - [ ] TIC-34: design tokens theo L1, L7
  - [ ] TIC-35: wireframe login/OTP, trang sự kiện, checkout, vé của tôi theo mục 3
  - [ ] LEAD trả lời 3 câu hỏi mở (kiểu đấu giá, mua tặng, vé kỷ niệm)
