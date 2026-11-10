# Hướng dẫn cho AI agent

Trước khi làm bất cứ việc gì trong repo này, đọc theo thứ tự:

1. `PRODUCT_CONTEXT.md` — nghiệp vụ, nguồn sự thật.
2. `docs/WORKING_RULES.md` — quy tắc bắt buộc (đặc biệt mục 8 cho AI agent).
3. `docs/TEAM_PLAN.md` — module, chủ module, sprint hiện tại.
4. `docs/DECISIONS.md` — quyết định đã chốt và câu hỏi đang mở.

Tóm tắt bắt buộc:

- Chỉ làm trong phạm vi issue được giao. Không tự đổi nghiệp vụ, OpenAPI, ABI, schema hoặc quyết định đã chốt.
- Người dùng **không** có tính năng hủy/hoàn vé; hoàn tiền chỉ khi sự kiện bị hủy (D-001).
- Mọi endpoint phải khai báo quyền (từ chối mặc định) và trả mã lỗi theo PRODUCT_CONTEXT 5.7.
- Không log hoặc commit PII/secret.
- Kết thúc phiên: commit theo Conventional Commits có mã `TIC-xx`, push, cập nhật `docs/worklog/<handle>.md` (ghi "thực hiện bởi AI").
