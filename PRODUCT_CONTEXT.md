# NFT Ticket MVP

Tài liệu bàn giao cho Product, Design, Engineering và QA. Mỗi luồng mô tả hành vi cần triển khai, các quyết định còn mở và điều kiện nghiệm thu. Mã `NFT-xx` tham chiếu đến backlog trong bảng đối chiếu ở mục 8.

> **Đây là nguồn sự thật về nghiệp vụ.** Mọi thay đổi hành vi sản phẩm phải sửa file này qua PR và ghi vào [`docs/DECISIONS.md`](docs/DECISIONS.md). Kế hoạch chia việc nằm ở [`docs/TEAM_PLAN.md`](docs/TEAM_PLAN.md), quy tắc làm việc ở [`docs/WORKING_RULES.md`](docs/WORKING_RULES.md).

**Thay đổi so với bản trước (2026-11-10):**

1. Bỏ luồng người dùng yêu cầu hủy vé. Vé **không hoàn tiền theo yêu cầu**; người dùng muốn rút lui thì bán lại qua đấu giá. Hoàn tiền **chỉ xảy ra khi ban tổ chức hủy sự kiện** (mục 3.2–3.5).
2. Hoàn thiện xác thực đăng nhập, ví và eKYC (mục 5).
3. Hoàn thiện mô hình phân quyền RBAC theo phạm vi (mục 2).

## 1. Sản phẩm và phạm vi

Nền tảng đóng vai trò trung gian giữa ban tổ chức và người tham dự. Ban tổ chức cung cấp sự kiện, hạng vé và số lượng phát hành. Nền tảng bán vé sơ cấp, hoàn tiền khi sự kiện bị hủy, đồng thời vận hành thị trường đấu giá lại vé đã phát hành.

| Trạng thái | Nội dung |
| --- | --- |
| Yêu cầu | Bán sơ cấp theo giá cố định. Vé không hủy/hoàn theo yêu cầu người dùng. Chỉ khi ban tổ chức hủy sự kiện (được nền tảng phê duyệt) thì mọi người đang giữ quyền lợi trên vé được hoàn tiền. |
| Yêu cầu | Chủ vé mở phiên đấu giá và đặt thời hạn. Phiên có trần theo phần trăm giá vé cơ bản và kết thúc khi hết hạn, có giá hợp lệ chạm trần hoặc không có ai trả giá tiếp trong khoảng đã cấu hình. |
| Yêu cầu | Xác thực tài khoản (OTP, phiên đăng nhập, 2FA cho nhân sự), liên kết ví và eKYC theo cấp độ. |
| Yêu cầu | Phân quyền theo vai trò và phạm vi (nền tảng / ban tổ chức / sự kiện), có nhật ký kiểm toán cho thao tác đặc quyền. |
| Đề xuất MVP | Thử nghiệm một sự kiện, một loại tiền tệ (VND), một vé trên mỗi phiên. Có màn hình vận hành tối thiểu và xác thực quyền vào cửa một lần. Thanh toán và eKYC dùng tích hợp giả lập. |
| Chờ quyết định | Giữ chỗ và thanh toán, nguồn cấu hình trần, nhà cung cấp eKYC, phát hành và chuyển NFT, xử lý dời lịch sự kiện (xem mục 7). |

**Nguồn phạm vi** là yêu cầu của chủ dự án trong cuộc trò chuyện. Bản nháp PDF trang 1 được dùng để đối chiếu các nhánh bán, hoàn và đấu giá. Các ghi chú rời trong sơ đồ được xem là ý tưởng tham khảo.

## 2. Vai trò và phân quyền

### 2.1 Vai trò

Một tài khoản có thể có nhiều vai trò. Vai trò gắn với **phạm vi**: toàn nền tảng, một ban tổ chức (organization) hoặc một sự kiện.

| Vai trò | Phạm vi | Ai cấp | Mô tả |
| --- | --- | --- | --- |
| `guest` | – | – | Chưa đăng nhập. Chỉ xem sự kiện công khai và trang xác minh vé. |
| `user` | Nền tảng | Tự động khi đăng ký | Người mua, chủ vé, người bán lại, người trả giá. Quyền giao dịch phụ thuộc **cấp xác minh** (mục 5.6), không tách thành vai trò riêng. |
| `org_owner` | Organization | `platform_admin` khi duyệt KYB | Chủ tài khoản ban tổ chức. Quản lý nhân sự, xuất bản sự kiện, gửi yêu cầu hủy sự kiện. |
| `org_manager` | Organization | `org_owner` | Tạo/sửa sự kiện nháp, hạng vé, xem báo cáo bán hàng của tổ chức. |
| `gate_staff` | Sự kiện | `org_owner` hoặc `org_manager` | Quét và xác nhận check-in cho đúng sự kiện được giao. Tự hết hạn sau khi sự kiện kết thúc 24 giờ. |
| `platform_operator` | Nền tảng | `platform_admin` | Tra cứu đơn, vé, phiên, hoàn tiền; xử lý ngoại lệ và thử lại hoàn tiền. Không thay đổi cấu hình, không cấp quyền. |
| `kyc_reviewer` | Nền tảng | `platform_admin` | Duyệt thủ công hồ sơ eKYC/KYB ở trạng thái chờ duyệt. Là vai trò duy nhất xem được dữ liệu định danh (đã che một phần). |
| `platform_admin` | Nền tảng | `platform_admin` khác (khởi tạo bằng seed) | Duyệt ban tổ chức, phê duyệt hủy sự kiện, cấu hình nền tảng (phí, khoảng trần), cấp/thu hồi vai trò nền tảng, thu hồi eKYC. |

### 2.2 Ma trận quyền

Ký hiệu: ✅ được phép · 🔸 được phép trong phạm vi của mình (tổ chức/sự kiện được giao/tài nguyên mình sở hữu) · ❌ không được phép. Cột `user` áp dụng thêm điều kiện cấp xác minh ở mục 5.6.

| Quyền (`resource:action`) | guest | user | gate_staff | org_manager | org_owner | operator | kyc_reviewer | admin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `event:read_public` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `event:create`, `event:update_draft`, `tier:manage` | ❌ | ❌ | ❌ | 🔸 | 🔸 | ❌ | ❌ | ❌ |
| `event:publish` | ❌ | ❌ | ❌ | ❌ | 🔸 | ❌ | ❌ | ❌ |
| `event:cancel_request` | ❌ | ❌ | ❌ | ❌ | 🔸 | ❌ | ❌ | ❌ |
| `event:cancel_approve` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `org:staff_assign` (org_manager, gate_staff) | ❌ | ❌ | ❌ | 🔸 chỉ gate_staff | 🔸 | ❌ | ❌ | ❌ |
| `order:create` (mua sơ cấp) | ❌ | 🔸 | 🔸 | 🔸 | 🔸 | ❌ | ❌ | ❌ |
| `order:read` | ❌ | 🔸 của mình | ❌ | 🔸 tổng hợp tổ chức | 🔸 tổng hợp tổ chức | ✅ | ❌ | ✅ |
| `ticket:read`, `ticket:gate_qr` | ❌ | 🔸 vé mình đang giữ | ❌ | ❌ | ❌ | ✅ chỉ đọc | ❌ | ✅ chỉ đọc |
| `checkin:scan` | ❌ | ❌ | 🔸 sự kiện được giao | ❌ | ❌ | ❌ | ❌ | ❌ |
| `auction:create` | ❌ | 🔸 vé mình đang giữ | ❌ | ❌ ở tổ chức mình | ❌ ở tổ chức mình | ❌ | ❌ | ❌ |
| `auction:bid` | ❌ | 🔸 không phải phiên của mình | ❌ ở sự kiện được giao | ❌ ở tổ chức mình | ❌ ở tổ chức mình | ❌ | ❌ | ❌ |
| `refund:read` | ❌ | 🔸 của mình | ❌ | 🔸 tổng hợp tổ chức | 🔸 tổng hợp tổ chức | ✅ | ❌ | ✅ |
| `refund:retry`, `exception:resolve` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `kyc:submit`, `kyc:read_own` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `kyc:review` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ trừ hồ sơ của mình | ❌ |
| `kyc:revoke` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `organizer:approve` (KYB) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🔸 đề xuất | ✅ phê duyệt |
| `role:grant_platform`, `config:update`, `audit:read` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

`user` không còn quyền `order:cancel`/`refund:request`: tính năng này **không tồn tại** trong sản phẩm.

### 2.3 Quy tắc kiểm tra quyền

1. **Từ chối mặc định.** Mỗi endpoint khai báo quyền cần có. Endpoint không khai báo thì không được merge (kiểm tra bằng test).
2. **Thứ tự kiểm tra** ở backend: xác thực phiên → quyền trong phạm vi → quyền sở hữu tài nguyên → trạng thái nghiệp vụ → điều kiện giao dịch (cấp xác minh). Mỗi bước trả mã lỗi riêng (mục 5.7). Chưa đăng nhập trả `401`, thiếu quyền trả `403`, tài nguyên ngoài phạm vi trả `404` để không lộ sự tồn tại.
3. **Phạm vi:** gán quyền lưu dạng `(user_id, role, scope_type, scope_id, granted_by, expires_at)`. `gate_staff` bắt buộc có `expires_at`.
4. **Tách nhiệm vụ:**
   - Ban tổ chức không mở phiên, không trả giá trên sự kiện của tổ chức mình (chặn ở backend và on-chain bằng `isIssuer`). Họ vẫn được mua sơ cấp như khách.
   - `org_owner` gửi yêu cầu hủy sự kiện, `platform_admin` phê duyệt. Một người không vừa gửi vừa duyệt.
   - `kyc_reviewer` không duyệt hồ sơ của chính mình. `platform_operator` không cấp quyền.
5. **Hiệu lực ngay:** access token chỉ chứa `user_id` và `session_version`. Quyền được nạp mỗi request (cache tối đa 60 giây). Thu hồi vai trò hoặc khóa tài khoản tăng `session_version` để vô hiệu phiên cũ.
6. **Nhân sự bắt buộc 2FA:** mọi vai trò khác `user` phải bật TOTP trước khi dùng quyền đó (mục 5.1).
7. **Nhật ký kiểm toán:** mọi thao tác đặc quyền (cấp/thu hồi quyền, xuất bản, yêu cầu/duyệt hủy sự kiện, duyệt/thu hồi eKYC, thử lại hoàn tiền, đổi cấu hình) bắt buộc nhập lý do và ghi `AuditLog` chỉ-thêm: người thực hiện, vai trò dùng, hành động, đối tượng, giá trị trước/sau, lý do, IP, `correlation_id`, thời điểm UTC.

### 2.4 Ánh xạ quyền on-chain

Backend là nguồn sự thật cho phân quyền ứng dụng. Contract chỉ bảo vệ những gì liên quan tài sản:

| Quyền on-chain | Người giữ | Ghi chú |
| --- | --- | --- |
| `DEFAULT_ADMIN_ROLE` | Ví nền tảng (multisig sau pilot) | Thêm/bớt issuer, đặt địa chỉ escrow. |
| `ISSUER_ROLE` | Ví của từng ban tổ chức, cấp khi KYB được duyệt | `createEvent`, `batchIssue`, `cancelEvent`. |
| `SCANNER_ROLE` | Ví relayer của backend | Backend kiểm tra `gate_staff`, relayer gọi `markUsed`. Không phát khóa ví cho nhân sự cổng. |
| `ESCROW_ROLE` | Contract `ResaleEscrow` | Duy nhất được chuyển vé giữa người dùng. |

Các thao tác có thể cạnh tranh trên cùng vé, như check-in, mở phiên, quyết toán và vô hiệu hóa khi hủy sự kiện, phải kiểm tra và cập nhật trạng thái theo cùng một cơ chế khóa hoặc kiểm soát phiên bản.

**Nghiệm thu:** mỗi ô ❌ trong ma trận có ít nhất một test API trả đúng mã lỗi; `gate_staff` sự kiện A không quét được vé sự kiện B; quyền hết hạn bị từ chối; thu hồi vai trò có hiệu lực trong ≤ 60 giây; ban tổ chức không trả giá được bằng tài khoản có vai trò tổ chức; mọi thao tác đặc quyền có bản ghi kiểm toán.

## 3. Bán sơ cấp và hoàn tiền khi hủy sự kiện

### 3.1 Phát hành và mua vé

1. Ban tổ chức tạo sự kiện và hạng vé với giá cơ bản, tiền tệ, số lượng, cửa sổ bán, hạn mức vé/tài khoản và cờ `kyc_required`. Trước khi thanh toán, khách thấy giá và cam kết: **"Vé không hoàn tiền, trừ khi sự kiện bị hủy. Bạn có thể bán lại vé qua sàn đấu giá."** Khách phải tích xác nhận đã đọc.
2. Người mua chọn hạng vé. Hệ thống kiểm tra điều kiện giao dịch (mục 5.6), giữ tồn kho có hạn và chụp lại giá, phí nếu có, tổng tiền và phiên bản chính sách vào đơn. Hết hạn hoặc thanh toán thất bại thì giải phóng giữ chỗ đúng một lần.
3. Sau khi xác thực thông báo thanh toán và đối chiếu mã đơn, số tiền, tiền tệ, hệ thống ghi nhận thanh toán. Quyền sử dụng vé chỉ có hiệu lực khi quy trình phát hành thành công. Nếu thanh toán đến sau khi giữ chỗ hết hạn hoặc phát hành gặp lỗi, đưa vào xử lý ngoại lệ với trạng thái hiển thị rõ. Đây là **hoàn tiền kỹ thuật** do vận hành xử lý, không phải tính năng hủy vé của người dùng.
4. Người mua xem vé trong tài khoản. Tại cổng, `gate_staff` của sự kiện xác thực vé còn hiệu lực và ghi nhận check-in một lần. Vé đang trong phiên đấu giá hoặc đang quyết toán không xuất được QR vào cổng.

### 3.2 Chính sách hoàn tiền

| Tình huống | Kết quả |
| --- | --- |
| Người dùng muốn hủy vé, đổi ý, không đi được | **Không hỗ trợ hủy/hoàn.** Giao diện không có nút hủy. Người dùng có thể mở phiên đấu giá để bán lại. |
| Ban tổ chức hủy sự kiện (đã được `platform_admin` phê duyệt) | **Hoàn 100%** số tiền mỗi người đã trả, gồm cả phí nền tảng. |
| Thanh toán đến muộn, thanh toán lặp, phát hành lỗi sau khi thu tiền | Hoàn tiền kỹ thuật theo luồng ngoại lệ ở 3.1 bước 3. |
| Dời lịch, đổi địa điểm, đổi nghệ sĩ | Chờ quyết định (NFT-05). Mặc định MVP: vé giữ hiệu lực, không hoàn; người dùng có thể bán lại. |
| Ban tổ chức thu hồi một vé do gian lận | Ngoài phạm vi MVP, vận hành xử lý thủ công và ghi kiểm toán. |

### 3.3 Luồng hủy sự kiện

1. `org_owner` gửi yêu cầu hủy kèm lý do và bằng chứng. Sự kiện chuyển sang `cancel_requested`: **dừng bán sơ cấp và không cho mở phiên mới**, vé vẫn dùng được nếu yêu cầu bị từ chối.
2. `platform_admin` xem số liệu ảnh hưởng (số vé, số đơn, số phiên đang chạy, tổng tiền hoàn dự kiến) rồi duyệt hoặc từ chối kèm lý do. Từ chối thì sự kiện trở lại `published`.
3. Khi duyệt, trong một giao dịch nghiệp vụ: sự kiện chuyển `cancelled`; mọi giữ chỗ bị giải phóng; mọi phiên đấu giá đang mở bị hủy với lý do `event_cancelled` (bid bị vô hiệu, không có người thắng); mọi gate token bị thu hồi; mọi vé chuyển trạng thái `void_pending_refund`. Không được check-in vé của sự kiện đã hủy.
4. Hệ thống tạo **một bản ghi `Refund` cho mỗi khoản thanh toán chưa quyết toán** (mục 3.4), mỗi bản ghi có khóa chống lặp `refund:{payment_id}`. Tác vụ nền xử lý hoàn tiền theo lô, có thử lại với backoff.
5. Hoàn về kênh thanh toán gốc. Bản ghi `Refund` đi qua trạng thái `pending → processing → succeeded | failed`. `failed` sau số lần thử tối đa thì chuyển hàng đối soát cho `platform_operator`. Callback hoàn tiền lặp không tạo hoàn tiền thứ hai.
6. On-chain: relayer gọi `cancelEvent`; vé bị đánh dấu `Void` (trạng thái cuối). Trạng thái vô hiệu hóa vé và trạng thái hoàn tiền tách riêng: vé `Void` ngay khi duyệt, hoàn tiền có thể mất thời gian.
7. Người bị ảnh hưởng nhận thông báo (email + trong ứng dụng) với số tiền hoàn, kênh hoàn và thời gian dự kiến. Màn "Vé của tôi" hiển thị trạng thái hoàn tiền.

### 3.4 Ai nhận bao nhiêu

Nguyên tắc: **mỗi khoản thanh toán chưa được giải ngân cho bên bán sẽ hoàn về chính người đã trả.** Để nguyên tắc này luôn thực hiện được, tiền được giữ lại đến sau sự kiện:

- Doanh thu bán sơ cấp giữ trong tài khoản đảm bảo của nền tảng, chỉ giải ngân cho ban tổ chức sau khi sự kiện kết thúc `T + payout_hold` (mặc định 3 ngày, Product chốt).
- Tiền bán lại của người bán chỉ giải ngân sau khi sự kiện kết thúc `T + 1 ngày`. Trước thời điểm đó người bán thấy trạng thái "chờ giải ngân".

Ví dụ: A mua sơ cấp 500.000đ, bán đấu giá cho B giá 700.000đ, B bán lại cho C giá 750.000đ. Sự kiện bị hủy trước ngày diễn ra:

| Khoản thanh toán | Đang giữ ở đâu | Hoàn cho |
| --- | --- | --- |
| A → ban tổ chức 500.000đ + phí | Đảm bảo sơ cấp | A |
| B → A 700.000đ + phí | Đảm bảo bán lại (chưa giải ngân cho A) | B |
| C → B 750.000đ + phí | Đảm bảo bán lại (chưa giải ngân cho B) | C |

Kết quả: không ai lời, không ai lỗ. Phiên đấu giá đang chạy tại thời điểm hủy bị hủy, không ai bị trừ tiền.

### 3.5 Trường hợp đặc biệt

- Sự kiện bị hủy khi đã có người check-in (sự kiện dừng giữa chừng): Product chốt trước pilot. Mặc định: vẫn hoàn 100%.
- Hủy khi có quyết toán đấu giá đang chạy: quyết toán dừng; tiền đã thu của người thắng được hoàn, vé không chuyển.
- Hoàn tiền thất bại kéo dài: vận hành liên hệ người dùng, cập nhật kênh nhận tiền thay thế, ghi kiểm toán.

**Nghiệm thu** gồm: hai người tranh suất cuối; thanh toán lặp hoặc đến muộn; phát hành lỗi sau khi thu tiền; API không có endpoint hủy vé cho người dùng; yêu cầu hủy sự kiện bị từ chối và được duyệt; hủy khi có phiên đang mở, đang quyết toán; hủy khi vé đã bán lại nhiều lần (đúng bảng 3.4); hoàn tiền lỗi rồi thử lại; callback hoàn tiền lặp; check-in vé của sự kiện đã hủy bị từ chối; check-in đồng thời.

## 4. Thị trường đấu giá

### Mở phiên và trả giá

1. Chủ vé chọn vé đủ điều kiện và đặt thời hạn. Hệ thống kiểm tra quyền sở hữu, cấp xác minh, cửa sổ giao dịch, trạng thái vé và trạng thái sự kiện (không mở phiên khi sự kiện `cancel_requested`/`cancelled`). Mỗi vé có tối đa một phiên hoạt động hoặc đang quyết toán.
2. Khi mở phiên, lưu thời điểm kết thúc, giá cơ bản, tỷ lệ trần, giá trần, tiền tệ, giá mở, bước giá và khoảng im lặng theo cấu hình. Đề xuất công thức `giá trần = floor(giá cơ bản × tỷ lệ trần)` theo đơn vị tiền nhỏ nhất. Tỷ lệ 150% của vé 500.000 đồng cho trần 750.000 đồng. Cần chốt ai đặt tỷ lệ, giới hạn cho phép và khoản phí nào nằm trong trần.
3. Người mua thấy giá dẫn đầu, mức đặt tối thiểu, trần, thời hạn hiệu lực và dòng **"Nếu sự kiện bị hủy, bạn được hoàn đủ số tiền đã trả."** Backend dùng thời gian máy chủ, kiểm tra điều kiện của tài khoản, loại tự trả giá và trả giá của nhân sự ban tổ chức, xử lý yêu cầu đồng thời theo thứ tự ghi nhận. Giá đầu tiên phải đạt giá mở. Các giá sau phải vượt giá hiện tại theo bước giá. Đề xuất cho phép đặt đúng giá trần khi trần cao hơn giá dẫn đầu nhưng phần chênh nhỏ hơn bước giá.
4. Đề xuất tính khoảng im lặng từ lần trả giá hợp lệ mới nhất, bắt đầu sau giá đầu tiên. Giá bị từ chối và thao tác gửi lại không làm thay đổi đồng hồ. Dùng 5 phút trong bộ test ban đầu. Giá trị dùng khi phát hành cần được Product chốt.

### Kết thúc phiên

| Điều kiện | Kết quả nghiệp vụ |
| --- | --- |
| Giá hợp lệ chạm trần trước thời hạn hiệu lực | Đóng phiên trong cùng giao dịch ghi nhận giá và chốt người dẫn đầu. |
| Tới hạn người bán đặt | Chốt người dẫn đầu nếu đã có giá hợp lệ. Nếu chưa có giá thì đóng phiên và giải phóng khóa rao. |
| Tới hạn im lặng trước hạn người bán đặt | Chốt người dẫn đầu. |
| Phiên đã tới hạn, tác vụ tự đóng chưa chạy | Backend từ chối giá mới và thực thi hoặc lên lịch đóng phiên theo cùng quy tắc. |
| Sự kiện bị hủy (mục 3.3) | Đóng phiên với lý do `event_cancelled`, không có người thắng, vé chuyển `void_pending_refund`. |

Người bán **được** hủy phiên khi chưa có giá hợp lệ nào. Khi đã có giá, chỉ vận hành hủy được (có lý do, ghi kiểm toán). Quy tắc kỹ thuật đề xuất: thời điểm có thể trả giá là trước mốc sớm hơn giữa hạn người bán đặt và hạn im lặng nếu đã có bid. Hai mốc bằng nhau ghi lý do hết hạn người bán. Mỗi phiên chỉ ghi một kết quả, kể cả khi tác vụ chạy lại. Bid và quyết định đóng phiên dùng cùng khóa hoặc phiên bản dữ liệu.

### Quyết toán và nhận vé

Kết quả đấu giá ghi người thắng, giá thắng, thời điểm, lý do đóng và mã giao dịch. Người thắng nhận thông báo và thấy trạng thái đang xử lý. Tạo bản ghi quyết toán riêng và giữ khóa vé trong lúc chờ thanh toán hoặc chuyển quyền. Chỉ hiển thị vé khả dụng cho người thắng khi thanh toán và chuyển quyền được xác nhận. **Tiền của người bán được giữ đến sau sự kiện (mục 3.4)**. Hạn thanh toán của người thắng, xử lý người thắng không thanh toán và khôi phục sau lỗi là đầu việc cần chốt (NFT-11). Các luồng demo dùng tích hợp giả lập.

**Nghiệm thu** gồm chạm trần, hết giờ, im lặng sau bid hợp lệ, phiên không có bid, bid đúng mốc đóng, hai bid cùng chạm trần, scheduler chạy trễ hoặc lặp, chuyển quyền lỗi sau khi đã thu tiền, nhân sự ban tổ chức cố trả giá, sự kiện bị hủy khi phiên đang mở. Kiểm tra cả UI của người mua, chủ vé cũ và người thắng.

## 5. Xác thực, hồ sơ, ví và eKYC

### 5.1 Đăng nhập và phiên

| Hạng mục | Quy định |
| --- | --- |
| Đăng ký/đăng nhập | Email + OTP 6 chữ số (không mật khẩu). Đăng nhập Google là tùy chọn sau MVP. |
| OTP | Hết hạn 5 phút, dùng một lần, tối đa 5 lần nhập sai thì khóa mã và khóa đăng nhập 15 phút. Gửi lại sau 60 giây, tối đa 5 mã/giờ/email và giới hạn theo IP. Lưu hash của OTP, không lưu bản rõ. |
| Xác thực SĐT | OTP qua SMS (giả lập ở MVP), cần trước giao dịch đầu tiên. Một SĐT chỉ gắn một tài khoản. |
| Phiên | Access token JWT 15 phút; refresh token 30 ngày, xoay vòng mỗi lần dùng, phát hiện dùng lại thì thu hồi cả chuỗi. Lưu trong cookie `HttpOnly; Secure; SameSite=Lax`. Có CSRF token cho request thay đổi dữ liệu. |
| Nhân sự (mọi vai trò khác `user`) | Bắt buộc TOTP 2FA, phiên tối đa 12 giờ, thao tác đặc quyền yêu cầu nhập lại TOTP nếu lần xác thực cuối quá 15 phút. |
| Đăng xuất | Thu hồi refresh token hiện tại. Có "đăng xuất mọi thiết bị" (tăng `session_version`). |
| Khóa tài khoản | `platform_admin` khóa/mở với lý do; tài khoản bị khóa không đăng nhập, không giao dịch, nhưng **vẫn nhận hoàn tiền**. |

### 5.2 Hồ sơ

Trường bắt buộc: tên hiển thị, email đã xác thực. Trước giao dịch: SĐT đã xác thực. Họ tên pháp lý và ngày sinh lấy từ eKYC, người dùng không tự sửa. Chỉ chủ tài khoản đọc/sửa hồ sơ của mình; `platform_operator` xem hồ sơ dạng che một phần (email `k***@gmail.com`, SĐT `09****123`). API hồ sơ không trả dữ liệu định danh cho tài khoản khác.

### 5.3 Ví

- Khi đăng ký, hệ thống tạo **ví custodial** cho người dùng (khóa mã hóa ở backend, chỉ cho MVP/testnet) để người không biết crypto vẫn mua được.
- Người dùng có thể **liên kết ví ngoài** bằng chữ ký theo chuẩn Sign-In with Ethereum (EIP-4361): backend phát `nonce` ngẫu nhiên, hết hạn 5 phút, dùng một lần, ràng buộc `domain`, `chainId = 43113` (Fuji) và `user_id`. Chữ ký sai, hết hạn hoặc dùng lại đều bị từ chối.
- Mỗi tài khoản có đúng một ví nhận vé đang hoạt động; một địa chỉ ví chỉ gắn một tài khoản.
- Đổi ví: không cho đổi khi đang có vé trong phiên/quyết toán; yêu cầu OTP lại; quy trình chuyển vé sang ví mới là đầu việc NFT-13.

### 5.4 Cấp xác minh

| Cấp | Điều kiện đạt | Mở khóa |
| --- | --- | --- |
| L0 | Chưa đăng nhập | Xem sự kiện. |
| L1 | Email đã xác thực | Hồ sơ, xem vé được tặng/nhận hoàn tiền. |
| L2 | L1 + SĐT đã xác thực + có ví | Mua sơ cấp ở sự kiện `kyc_required = false`, vào cổng. |
| L3 | L2 + eKYC `verified` | Mua sơ cấp ở sự kiện `kyc_required = true`, mở phiên, trả giá, nhận vé từ đấu giá. |

### 5.5 eKYC

**Luồng người dùng:**

1. Màn đồng ý xử lý dữ liệu cá nhân (theo Nghị định 13/2023/NĐ-CP): mục đích, dữ liệu thu, thời gian lưu, quyền rút lại. Không đồng ý thì không tiếp tục, các tính năng L2 vẫn dùng được.
2. Chụp mặt trước và mặt sau CCCD gắn chip → nhà cung cấp OCR → người dùng xem lại họ tên, ngày sinh, số CCCD (che giữa) và xác nhận.
3. Chụp selfie có kiểm tra người thật (liveness) → so khớp khuôn mặt với ảnh CCCD.
4. Trạng thái chuyển `pending`. Kết quả về qua webhook (có xác thực chữ ký và khóa chống lặp theo `provider_event_id`) hoặc qua `kyc_reviewer` nếu điểm tin cậy nằm trong ngưỡng xem lại.
5. Người dùng nhận thông báo kết quả. Nếu bị từ chối, thấy lý do dễ hiểu và nút thử lại.

**Trạng thái:**

```
not_started ──submit──► pending ──provider/reviewer──► verified ──admin thu hồi──► revoked
                          │                              
                          └──────────────────────────► rejected ──thử lại──► pending
```

| Trạng thái | Ý nghĩa | Giao diện |
| --- | --- | --- |
| `not_started` | Chưa nộp | Nút "Xác minh danh tính" ở chỗ bị chặn. |
| `pending` | Đang xử lý (tự động hoặc chờ duyệt tay, SLA mục tiêu 24 giờ) | Banner "Đang xác minh", không cho nộp lại. |
| `verified` | Đạt | Huy hiệu đã xác minh. Hết hiệu lực khi CCCD hết hạn → về `not_started`. |
| `rejected` | Không đạt, có `reason_code` | Lý do + thử lại. Tối đa 3 lần/24 giờ, quá 5 lần cần vận hành mở khóa. |
| `revoked` | `platform_admin` thu hồi do gian lận/trùng danh tính | Mất quyền L3, phiên đang mở bị vận hành xử lý. Không tự nộp lại. |

Mã lý do từ chối: `DOC_UNREADABLE`, `DOC_EXPIRED`, `DOC_NOT_SUPPORTED`, `FACE_MISMATCH`, `LIVENESS_FAILED`, `DUPLICATE_IDENTITY`, `UNDERAGE` (dưới 18 tuổi, Product chốt ngưỡng), `PROVIDER_ERROR` (lỗi hệ thống, không tính vào số lần thử).

**Chống nhiều tài khoản:** lưu `id_number_hash = HMAC-SHA256(số CCCD, pepper bí mật)`, ràng buộc duy nhất. Một CCCD chỉ xác minh cho một tài khoản; trùng thì `rejected` với `DUPLICATE_IDENTITY` và báo vận hành.

**Lưu trữ dữ liệu:**

- Chỉ lưu: trạng thái, cấp, `provider_ref`, họ tên, ngày sinh, `id_number_hash`, 4 số cuối CCCD, ngày hết hạn CCCD, thời điểm xác minh, `reason_code`.
- **Không lưu ảnh CCCD/selfie** trên hệ thống của mình; nhà cung cấp giữ theo hợp đồng. Môi trường thử nghiệm không dùng giấy tờ thật.
- Dữ liệu định danh mã hóa ở mức trường, chỉ `kyc_reviewer` xem (đã che), mọi lần xem ghi kiểm toán. Không bao giờ xuất hiện trong log, metadata NFT, sự kiện on-chain hoặc API công khai.
- Người dùng yêu cầu xóa tài khoản: xóa dữ liệu định danh, giữ `id_number_hash` và bản ghi giao dịch theo thời hạn pháp lý.

**Tích hợp:** định nghĩa `KycProvider` interface (`createSession`, `getResult`, `verifyWebhook`). MVP dùng `MockKycProvider` với kịch bản cố định để demo và test: số CCCD kết thúc `...0` → `verified`, `...1` → `rejected/FACE_MISMATCH`, `...2` → treo `pending` chờ duyệt tay, `...3` → `PROVIDER_ERROR`. Nhà cung cấp thật (ứng viên: VNPT eKYC, FPT.AI eKYC, Viettel AI) chọn ở NFT-14.

**KYB cho ban tổ chức:** đăng ký tổ chức gồm tên pháp lý, mã số thuế, giấy chứng nhận đăng ký kinh doanh, người đại diện (phải có eKYC `verified`), tài khoản ngân hàng nhận giải ngân. `kyc_reviewer` kiểm tra và đề xuất, `platform_admin` phê duyệt → cấp `org_owner` và `ISSUER_ROLE` on-chain cho ví tổ chức.

### 5.6 Ma trận điều kiện giao dịch

| Hành động | Cấp tối thiểu | Điều kiện khác |
| --- | --- | --- |
| Xem sự kiện, trang xác minh vé | L0 | – |
| Mua sơ cấp | L2, hoặc L3 nếu sự kiện `kyc_required` | Trong cửa sổ bán, chưa vượt hạn mức vé/tài khoản/sự kiện, sự kiện `published`. |
| Xem QR vào cổng | L2 | Là chủ vé hiện tại, vé `Active`, sự kiện chưa hủy. |
| Mở phiên đấu giá | L3 | Chủ vé, vé `Active`, trước hạn giao dịch, không có vai trò ở tổ chức của sự kiện. |
| Trả giá | L3 | Không phải người bán, không có vai trò ở tổ chức của sự kiện. |
| Nhận vé từ đấu giá | L3 | Đã thanh toán đúng hạn. |
| Nhận hoàn tiền | L1 | **Không bao giờ bị chặn** bởi eKYC, khóa tài khoản hay đổi ví. |

### 5.7 Mã lý do khi chặn

Backend trả `{ "code": "...", "message": "...", "action": "..." }`. Frontend dùng `code` để hiện hướng dẫn và nút đến bước còn thiếu.

| Mã | HTTP | Hướng dẫn |
| --- | --- | --- |
| `AUTH_REQUIRED` | 401 | Đăng nhập. |
| `MFA_REQUIRED` | 401 | Nhập mã TOTP. |
| `ACCOUNT_LOCKED` | 403 | Liên hệ hỗ trợ. |
| `PHONE_NOT_VERIFIED` | 403 | Xác thực SĐT. |
| `WALLET_NOT_LINKED` | 403 | Tạo hoặc liên kết ví. |
| `KYC_REQUIRED` / `KYC_PENDING` / `KYC_REJECTED` / `KYC_REVOKED` | 403 | Xác minh / chờ / thử lại / liên hệ hỗ trợ. |
| `ROLE_FORBIDDEN` | 403 | Không có quyền. |
| `ORGANIZER_CONFLICT` | 403 | Nhân sự ban tổ chức không giao dịch sự kiện của mình. |
| `PURCHASE_LIMIT_REACHED`, `SALE_WINDOW_CLOSED`, `EVENT_NOT_ACTIVE` | 409 | Hiển thị lý do, không có hành động. |

**Nghiệm thu** gồm: OTP sai/hết hạn/dùng lại/quá giới hạn gửi; refresh token bị dùng lại thu hồi cả chuỗi; nhân sự không có 2FA bị chặn; truy cập hồ sơ người khác; yêu cầu liên kết ví hết hạn hoặc dùng lại hoặc sai chainId; một ví gắn hai tài khoản; eKYC từng trạng thái và từng mã lỗi của mock; callback eKYC lặp và sai chữ ký; trùng CCCD; CCCD hết hạn; chính sách giao dịch chặn đúng cả UI lẫn API; dữ liệu định danh không xuất hiện trong log.

## 6. Mô hình dữ liệu và tích hợp

| Dữ liệu | Trường nghiệp vụ chính |
| --- | --- |
| Organization | Tên pháp lý, mã số thuế, trạng thái KYB, ví issuer, tài khoản giải ngân. |
| Event / TicketTier | Tổ chức, thời gian sự kiện, cửa sổ bán, giá cơ bản, hạn mức, `kyc_required`, trạng thái (`draft`, `published`, `cancel_requested`, `cancelled`, `completed`). |
| EventCancellation | Sự kiện, người yêu cầu, lý do, người duyệt, quyết định, thời điểm, số liệu ảnh hưởng. |
| Order / Reservation | Người mua, giá và phiên bản chính sách tại lúc mua, hạn giữ chỗ, trạng thái thanh toán và phát hành. |
| Ticket | Chủ hiện tại, hạng, giá cơ bản dùng cho trần, quyền sử dụng, khóa giao dịch, tham chiếu token, trạng thái (`active`, `listed`, `settling`, `used`, `void_pending_refund`, `void`). |
| Auction / Bid | Vé, người bán, tham số phiên, người trả, mức giá, thứ tự xác nhận, hạn hiệu lực, kết quả, lý do đóng. |
| Payment / Settlement / Payout | Liên kết đơn hoặc phiên, người trả, số tiền, trạng thái thu, thời điểm được giải ngân (`payout_hold_until`), mã tham chiếu. |
| Refund | Khoản thanh toán gốc, người nhận, số tiền, lý do (`event_cancelled`, `technical`), trạng thái, khóa chống lặp, số lần thử, lỗi. |
| User / Session / OtpChallenge | Email, SĐT, trạng thái khóa, `session_version`, refresh token hash, TOTP secret (mã hóa). |
| Profile / WalletLink / KycVerification | Hồ sơ tối thiểu, ví (custodial/ngoài), trạng thái và cấp xác minh, `provider_ref`, `id_number_hash`. |
| RoleAssignment / AuditLog | Gán vai trò theo phạm vi và thời hạn; nhật ký chỉ-thêm cho thao tác đặc quyền. |

- Backend quản lý tồn kho, quyền truy cập, luật đặt giá và trạng thái nghiệp vụ. Nhóm tích hợp cần xác định nguồn xác nhận quyền sở hữu NFT và quy trình đối soát khi dữ liệu token lệch với ứng dụng.
- Dùng số nguyên theo đơn vị tiền nhỏ nhất. Dùng thời gian UTC để ghi nhận và hiển thị múi giờ sự kiện cho người dùng. Tác vụ thử lại và callback cần khóa chống xử lý lặp theo mã giao dịch.
- Ghi nhật ký thay đổi trạng thái, ID tương quan và thao tác của vận hành. Loại dữ liệu định danh nhạy cảm khỏi metadata công khai của NFT và log ứng dụng.

## 7. Quyết định cần chốt

| Backlog | Chủ trì đề xuất | Đầu ra cần có |
| --- | --- | --- |
| NFT-01 | Product + Design | Luồng pilot, phạm vi check-in, giới hạn hạng vé và cửa sổ giao dịch trước sự kiện. |
| NFT-05 | Product + Vận hành + Thanh toán | **Đã chốt phần chính** (mục 3.2–3.4): không hủy theo yêu cầu, hoàn 100% khi hủy sự kiện. Còn mở: `payout_hold`, dời lịch/đổi địa điểm, sự kiện dừng giữa chừng, SLA hoàn tiền. |
| NFT-07 | Product + Engineering | Nguồn tỷ lệ trần, khoảng hợp lệ, bước giá, cách tính phí, mốc im lặng, quyền hủy phiên và điều kiện vé được rao. |
| NFT-11 | Product + Thanh toán + Vận hành | Hạn thanh toán của người thắng, giải phóng khóa, xử lý người thắng bỏ cuộc, lỗi một phần. Giải ngân người bán đã chốt: sau sự kiện. |
| NFT-13 | Product + Engineering | Đã chốt: ví custodial mặc định + liên kết ví ngoài bằng SIWE. Còn mở: chuyển vé khi đổi ví, mất quyền truy cập ví. |
| NFT-14 | Product + Định danh | Đã chốt luồng, trạng thái, cấp xác minh, lưu trữ (mục 5.4–5.6). Còn mở: chọn nhà cung cấp, ngưỡng tuổi, ngưỡng điểm duyệt tay, chi phí. |
| NFT-16 | Engineering + Product | Nơi phát hành NFT, cách chuyển và xác nhận quyền, giao dịch ngoài sàn, đánh dấu `Void` khi hủy sự kiện và đối soát. |
| NFT-21 | Engineering + Product | Đã chốt mô hình (mục 2). Còn mở: ai được cấp `platform_admin` đầu tiên, quy trình khôi phục 2FA. |

## 8. Kế hoạch bàn giao và Linear

Chia việc theo người và sprint: xem [`docs/TEAM_PLAN.md`](docs/TEAM_PLAN.md).

| Milestone đề xuất | Issues | Điều kiện qua mốc |
| --- | --- | --- |
| M0 · Phạm vi và quy tắc | NFT-01, NFT-05, NFT-07, NFT-11, NFT-14, NFT-16 | Mỗi quyết định có người phụ trách, tiêu chí chọn phương án và đầu ra. Các quyết định chặn pilot được phê duyệt trước M4. |
| M1 · Nền tảng và bán sơ cấp | NFT-12, NFT-21, NFT-22, NFT-02 đến NFT-04, NFT-17 | Đăng nhập, phân quyền, cấu hình sự kiện, bán theo giá cố định, xem vé và xác thực vào cửa với tích hợp giả lập. |
| M2 · Đấu giá và quyết toán | NFT-08 đến NFT-10, NFT-18 | Demo cả ba điều kiện đóng, một người thắng và trạng thái quyết toán khi thành công hoặc lỗi. |
| M3 · Định danh, hủy sự kiện và tích hợp | NFT-06, NFT-13, NFT-15, NFT-19 | Ví và eKYC đi qua kiểm tra điều kiện giao dịch. Hủy sự kiện hoàn đúng bảng 3.4. Tích hợp được kiểm thử theo các quyết định nghiên cứu. |
| M4 · Pilot | NFT-20 | Các luồng chính và các ca lỗi đạt kiểm thử. Vận hành có quy trình đối soát, xử lý sự cố và tiêu chí dừng pilot. |

Các nhóm có thể bắt đầu mô hình dữ liệu và hợp đồng tích hợp bằng stub. Công việc chịu ảnh hưởng của một quyết định cần được đánh dấu blocked cho phần triển khai thật. Khi bắt đầu một issue, chốt assignee và ước lượng với người thực hiện. Khi kết thúc, cập nhật bằng chứng nghiệm thu và liên kết thay đổi.

[Project NFT Ticket MVP](https://linear.app/ticket-blockchain/project/nft-ticket-mvp-7524715dbac6) thuộc team TIC. [Bản tài liệu trên Linear](https://linear.app/ticket-blockchain/document/context-san-pham-va-tieu-chi-nghiem-thu-210ce29a02af).

### Đối chiếu mã công việc

Các issue đánh dấu *(đổi tên)* cần cập nhật tiêu đề trên Linear; *(mới)* cần tạo issue.

| Mã trong tài liệu | Issue Linear | Công việc |
| --- | --- | --- |
| NFT-01 | [TIC-5](https://linear.app/ticket-blockchain/issue/TIC-5/nft-01-chot-pham-vi-va-tieu-chi-pilot) | Chốt phạm vi và tiêu chí pilot |
| NFT-02 | [TIC-7](https://linear.app/ticket-blockchain/issue/TIC-7/nft-02-tao-su-kien-va-cau-hinh-hang-ve) | Tạo sự kiện và cấu hình hạng vé |
| NFT-03 | [TIC-8](https://linear.app/ticket-blockchain/issue/TIC-8/nft-03-giu-ton-kho-va-tao-djon-gia-co-djinh) | Giữ tồn kho và tạo đơn giá cố định |
| NFT-04 | [TIC-9](https://linear.app/ticket-blockchain/issue/TIC-9/nft-04-xac-nhan-thanh-toan-va-phat-hanh-quyen-ve) | Xác nhận thanh toán và phát hành quyền vé |
| NFT-05 | [TIC-10](https://linear.app/ticket-blockchain/issue/TIC-10/nft-05-chot-chinh-sach-huy-ve-va-hoan-tien) | Chốt chính sách hoàn tiền khi hủy sự kiện *(đổi tên)* |
| NFT-06 | [TIC-13](https://linear.app/ticket-blockchain/issue/TIC-13/nft-06-trien-khai-yeu-cau-huy-va-hoan-tien) | Triển khai hủy sự kiện và hoàn tiền hàng loạt *(đổi tên)* |
| NFT-07 | [TIC-12](https://linear.app/ticket-blockchain/issue/TIC-12/nft-07-chot-quy-tac-mo-va-djong-phien-djau-gia) | Chốt quy tắc mở và đóng phiên đấu giá |
| NFT-08 | [TIC-14](https://linear.app/ticket-blockchain/issue/TIC-14/nft-08-tao-phien-va-khoa-ve-djang-rao) | Tạo phiên và khóa vé đang rao |
| NFT-09 | [TIC-16](https://linear.app/ticket-blockchain/issue/TIC-16/nft-09-ghi-nhan-bid-va-cap-nhat-nguoi-dan-djau) | Ghi nhận bid và cập nhật người dẫn đầu |
| NFT-10 | [TIC-19](https://linear.app/ticket-blockchain/issue/TIC-19/nft-10-tu-djong-phien-va-ghi-nhan-nguoi-thang) | Tự đóng phiên và ghi nhận người thắng |
| NFT-11 | [TIC-17](https://linear.app/ticket-blockchain/issue/TIC-17/nft-11-chot-thanh-toan-va-chi-tra-sau-djau-gia) | Chốt thanh toán và chi trả sau đấu giá |
| NFT-12 | [TIC-6](https://linear.app/ticket-blockchain/issue/TIC-6/nft-12-tao-tai-khoan-va-ho-so-co-ban) | Tạo tài khoản và hồ sơ cơ bản |
| NFT-13 | [TIC-15](https://linear.app/ticket-blockchain/issue/TIC-15/nft-13-chot-va-trien-khai-lien-ket-vi) | Chốt và triển khai liên kết ví |
| NFT-14 | [TIC-18](https://linear.app/ticket-blockchain/issue/TIC-18/nft-14-nghien-cuu-ekyc-va-lap-ma-tran-quyen-giao-dich) | Nghiên cứu eKYC và lập ma trận quyền giao dịch |
| NFT-15 | [TIC-21](https://linear.app/ticket-blockchain/issue/TIC-21/nft-15-hien-thi-trang-thai-ekyc-va-kiem-tra-djieu-kien-giao-dich) | Triển khai luồng eKYC, trạng thái và kiểm tra điều kiện giao dịch |
| NFT-16 | [TIC-20](https://linear.app/ticket-blockchain/issue/TIC-20/nft-16-nghien-cuu-phat-hanh-va-chuyen-quyen-nft) | Nghiên cứu phát hành và chuyển quyền NFT |
| NFT-17 | [TIC-11](https://linear.app/ticket-blockchain/issue/TIC-11/nft-17-xac-thuc-quyen-vao-cua-mot-lan) | Xác thực quyền vào cửa một lần |
| NFT-18 | [TIC-22](https://linear.app/ticket-blockchain/issue/TIC-22/nft-18-theo-doi-quyet-toan-va-thong-bao-ket-qua-phien) | Theo dõi quyết toán và thông báo kết quả phiên |
| NFT-19 | [TIC-23](https://linear.app/ticket-blockchain/issue/TIC-23/nft-19-tich-hop-phat-hanh-chuyen-nft-va-djoi-soat) | Tích hợp phát hành, chuyển NFT và đối soát |
| NFT-20 | [TIC-24](https://linear.app/ticket-blockchain/issue/TIC-24/nft-20-kiem-thu-djau-cuoi-va-chuan-bi-pilot) | Kiểm thử đầu cuối và chuẩn bị pilot |
| NFT-21 | *(mới)* | Phân quyền RBAC theo phạm vi và nhật ký kiểm toán |
| NFT-22 | *(mới)* | Xác thực đăng nhập: OTP, phiên, 2FA cho nhân sự |
