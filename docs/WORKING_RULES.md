# Quy tắc làm việc

Áp dụng cho **mọi thành viên và mọi AI agent** (Claude, Copilot…) làm việc trong repo. Vi phạm quy tắc thì PR không được merge.

## 0. Năm quy tắc vàng

1. **Plan trước, code sau.** Không bắt đầu việc nào chưa có issue với tiêu chí nghiệm thu. Thay đổi nghiệp vụ phải sửa `PRODUCT_CONTEXT.md` trước.
2. **Mỗi phiên làm việc phải ship.** Kết thúc phiên = có một kết quả người khác xem/chạy được (PR, draft PR, link Figma, quyết định đã ghi).
3. **Mỗi phiên phải ghi nhật ký.** Cập nhật `docs/worklog/<tên>.md`: đã làm gì, ship gì, bị chặn gì, việc tiếp theo.
4. **Quyết định phải viết ra.** Chốt bằng lời trong chat không có giá trị cho tới khi vào `docs/DECISIONS.md`.
5. **Không phá hợp đồng một mình.** Đổi OpenAPI, `types.ts`, ABI, schema DB phải có PR riêng được 2 người còn lại duyệt.

## 1. Nguồn sự thật

| Câu hỏi | Xem ở đâu |
| --- | --- |
| Sản phẩm phải làm gì? | `PRODUCT_CONTEXT.md` |
| Kiến trúc, cấu trúc thư mục? | `PIPELINE_AND_STRUCTURE.md` |
| Ai làm gì, sprint nào? | `docs/TEAM_PLAN.md` |
| Đã quyết định gì, vì sao? | `docs/DECISIONS.md` |
| Đang làm gì, bị chặn gì? | Linear (team TIC) + `docs/worklog/` |
| API trông thế nào? | `packages/shared/openapi.yaml` |

Khi mâu thuẫn: PRODUCT_CONTEXT > DECISIONS > PIPELINE > code. Phát hiện mâu thuẫn thì mở issue, không tự đoán.

## 2. Vòng đời một việc

```
Backlog → Ready → In Progress → In Review → Done
```

**Definition of Ready** (mới được kéo vào In Progress):
- Có issue Linear, có assignee, ước lượng (S ≤ ½ ngày, M ≤ 1 ngày, L ≤ 2 ngày; lớn hơn thì tách).
- Có tiêu chí nghiệm thu (trích từ PRODUCT_CONTEXT).
- Không bị chặn bởi quyết định chưa chốt, hoặc đã ghi rõ phần nào làm bằng stub.
- Có thiết kế nếu là việc UI.

**Definition of Done:**
- Code merged vào `main`, CI xanh.
- Có test cho tiêu chí nghiệm thu (unit/integration; E2E nếu là luồng chính).
- Kiểm tra quyền + mã lỗi theo PRODUCT_CONTEXT mục 2 và 5.7.
- Không có secret, không có PII trong log/test fixture.
- Tài liệu liên quan cập nhật (OpenAPI, README module, DECISIONS nếu có).
- Issue Linear chuyển Done kèm link PR và bằng chứng (ảnh/video/log test).
- Worklog đã ghi.

## 3. Quy tắc "ship mỗi phiên"

- Một phiên = một khoảng làm việc liên tục (thường 2–4 giờ). Trước khi bắt đầu, viết **mục tiêu phiên** (1 câu) vào worklog.
- Cuối phiên **bắt buộc push**, kể cả việc chưa xong: mở **draft PR** với checklist phần còn lại. Không để code chỉ nằm trên máy.
- Việc lớn hơn một phiên phải tách thành các PR nhỏ ship được độc lập (feature flag hoặc mock nếu cần).
- PR nên < 400 dòng thay đổi (không tính file sinh tự động, lockfile).
- "Ship" với UI/UX = link Figma đã chia sẻ + ghi chú trạng thái từng màn; với quyết định = PR vào `DECISIONS.md`.

## 4. Nhật ký làm việc

- Mỗi người một file `docs/worklog/<handle>.md`, **mục mới nhất ở trên cùng**. Mẫu: [`docs/worklog/_TEMPLATE.md`](worklog/_TEMPLATE.md).
- Ghi trong cùng PR của phiên đó (hoặc commit `docs(worklog): ...` riêng nếu phiên không có code).
- Mục "Việc tiếp theo" phải có trên Linear; worklog chỉ là bản tóm tắt cho người đọc nhanh.
- Mục "Bị chặn" phải ghi rõ **ai** gỡ được và tag người đó trong chat.

## 5. Git

**Nhánh:** `main` luôn chạy được và được bảo vệ (không push thẳng). Nhánh làm việc: `<loại>/<TIC-xx>-<mô-tả-ngắn>`, ví dụ `feat/TIC-16-bid-engine`, `fix/TIC-11-double-checkin`, `docs/TIC-10-refund-policy`.

**Commit** theo Conventional Commits, có mã issue:

```
feat(auction): reject bid after effective deadline [TIC-16]
fix(checkin): make used flag update atomic [TIC-11]
docs(product): refund only on event cancellation [TIC-10]
```

Loại: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`. Scope = tên module trong TEAM_PLAN mục 3.

**Pull request:**
- Dùng template `.github/pull_request_template.md`.
- Cần **1 approve** (đổi hợp đồng/schema/contract: **2 approve**). Người viết không tự merge PR chưa được duyệt.
- Review trong vòng 24 giờ làm việc. Quá hạn thì người viết được nhắc trong chat.
- Merge kiểu **squash**; xóa nhánh sau merge.
- Contract Solidity, logic tiền (refund, settlement, payout) và phân quyền: người review phải chạy test local, không chỉ đọc diff.

## 6. Quy tắc kỹ thuật bắt buộc

- Tiền: số nguyên đơn vị nhỏ nhất. Thời gian: UTC trong DB/API.
- Mọi webhook/callback/job có khóa chống lặp.
- Mọi endpoint khai báo quyền; mặc định từ chối.
- Thao tác đặc quyền ghi `AuditLog` kèm lý do.
- Không log email, SĐT, CCCD, token, OTP bản rõ. Dùng helper `maskPii()`.
- Không commit secret; dùng `.env` local và `.env.example`. Ví testnet riêng cho từng người.
- Không thêm thư viện mới mà không ghi lý do trong PR.

## 7. Giao tiếp

- Standup viết hằng ngày trước 10:00 (mẫu: Hôm qua · Hôm nay · Bị chặn).
- Câu hỏi nghiệp vụ → hỏi LEAD (Product owner); nếu chưa có câu trả lời, mở mục "Đang mở" trong `DECISIONS.md`.
- Không ai bị chặn quá nửa ngày mà không lên tiếng. Bị chặn thì chuyển sang việc khác trong sprint và ghi worklog.
- Nghỉ/vắng báo trước ít nhất 1 ngày và chuyển giao việc đang dở (draft PR + worklog).

## 8. Quy tắc cho AI agent

AI agent làm việc trong repo phải:
1. Đọc `PRODUCT_CONTEXT.md`, `docs/TEAM_PLAN.md`, file này trước khi sửa code.
2. Chỉ làm trong phạm vi issue được giao; việc phát sinh ghi vào "Việc tiếp theo".
3. Kết thúc phiên bằng commit + push + cập nhật worklog của người giao việc (ghi rõ "thực hiện bởi AI").
4. Không tự thay đổi nghiệp vụ, hợp đồng API/ABI hoặc quyết định đã chốt; đề xuất bằng PR để người duyệt.
5. Người giao việc chịu trách nhiệm review code AI viết như code của chính mình.

## 9. Sửa quy tắc

Quy tắc này được sửa qua PR, cần cả 3 người approve, thảo luận ở buổi retro Chủ nhật.
