# Worklog · ui

## 2026-11-14 · Prototype bấm được cho toàn bộ luồng, làm đầu vào wireframe và user flow

- **Issue:** TIC-35 (S0-09), tham chiếu TIC-33
- **Thực hiện bởi:** AI (Claude Code), theo yêu cầu của thành viên UX/UI.
- **Thời lượng:** ~2 giờ
- **Đã làm:**
  - `docs/prototype/index.html`: một file HTML tự chạy, dữ liệu giả lập trong trình duyệt, có thanh demo để đổi vai (khách, người mua L2/L3, chủ ban tổ chức, soát vé, duyệt eKYC, quản trị).
  - Người mua: danh sách sự kiện + tìm/lọc, chi tiết sự kiện, giữ chỗ 10 phút, checkout có câu cam kết không hoàn + ô tích, thanh toán giả lập (thành công/thất bại), Vé của tôi (cụm trạng thái, mục "Chi tiết blockchain", theo dõi hoàn tiền), QR động 30 giây, sàn đấu giá + chi tiết phiên (giá dẫn đầu, trần 150%, bước giá, im lặng 5 phút, người trả giá giả lập), mở/hủy phiên, thanh toán khi thắng, tiền "chờ giải ngân".
  - Tài khoản: đăng nhập email OTP (giới hạn thử/gửi, khóa 15 phút), TOTP cho nhân sự, SĐT, ví custodial + liên kết ví SIWE (chainId 43113), cấp L0–L3, luồng eKYC 4 bước với kịch bản mock theo số cuối CCCD.
  - Ban tổ chức: dashboard, tạo sự kiện 4 bước, xuất bản (nhập lại TOTP), giao/thu hồi soát vé, gửi yêu cầu hủy.
  - Soát vé: kiểm tra mã, kết quả ✅/❌ có lý do (đã check-in, hết hạn, đang rao bán, vô hiệu, sai sự kiện).
  - Quản trị: duyệt hủy sự kiện (số liệu ảnh hưởng, cascade vô hiệu vé, hủy phiên, tạo hoàn tiền theo từng khoản thanh toán như bảng 3.4), duyệt KYB, thử lại hoàn tiền lỗi, nhật ký kiểm toán. Duyệt eKYC thủ công cho `kyc_reviewer`.
  - Banner chặn dùng đúng mã 5.7, kèm nút đến bước còn thiếu. Không có nút hủy/hoàn vé (D-001).
- **Đã ship:** `docs/prototype/index.html`, bản xem trực tuyến (riêng tư, cần chia sẻ): <https://claude.ai/artifact/Sj6E2ZyRdGM1P6WsjcKXX1>
- **Bằng chứng:** `node --check` script xanh. Chưa có test tự động (prototype, không phải code sản phẩm).
- **Quyết định phát sinh:** không. Các giá trị chưa chốt chỉ là giá trị demo: giữ chỗ 10 phút, hạn thanh toán người thắng 15 phút (NFT-11), bước giá 5% giá gốc, phí nền tảng 0 đ.
- **Bị chặn:** không.
- **Việc tiếp theo:**
  - [ ] Nhóm xem prototype, ghi góp ý vào Linear TIC-35
  - [ ] Chuyển các màn đã thống nhất sang Figma (TIC-34, TIC-35)
  - [ ] TIC-36: dựng Next.js thật, tái dùng cấu trúc màn và microcopy từ prototype

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
