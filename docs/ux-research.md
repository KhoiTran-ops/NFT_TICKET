# Nghiên cứu UX/UI: sản phẩm NFT ticket và lỗi giao diện thường gặp

Tài liệu tham khảo cho **TIC-33** (user flow 3 vai) và **TIC-35** (wireframe). Không thay đổi nghiệp vụ. Khi mâu thuẫn, `PRODUCT_CONTEXT.md` và `docs/DECISIONS.md` được ưu tiên.

- **Ngày đọc:** 2026-11-13
- **Nguồn:**
  - SeatlabNFT – <https://www.seatlabnft.com/about>
  - Unlock Protocol – <https://app.unlock-protocol.com/event>
  - SI Tickets Box Office – <https://boxoffice.sitickets.com/>
  - OpenSea – <https://opensea.io/blog/articles/polygon-on-seaport> (bài đăng 2022-08-30)
  - Báo cáo nội bộ "Báo cáo UI/UX SUSPA" (đối chiếu giao diện trước/sau khi sửa của một dự án khác)
- **Giới hạn:** chỉ đọc nội dung chữ của các trang. Unlock là ứng dụng một trang (SPA): khi chưa kết nối ví, nội dung tải về chỉ có nút "Connect" và phần mô tả meta. Chưa xem ảnh trước/sau trong báo cáo SUSPA.

## 1. Sản phẩm tham khảo

### 1.1 SI Tickets – Box Office

Hướng tới ban tổ chức. Blockchain gần như bị giấu.

- Tạo sự kiện **4 bước**: loại sự kiện → ngày giờ → hạng vé (nhóm, giá, báo cáo) → nội dung tặng kèm trước/sau sự kiện.
- Thanh toán quen thuộc: thẻ, PayPal, Venmo, Apple Pay, chỉ USD. Không có crypto.
- Gọi vé NFT là "Super Ticket™" và nói về lợi ích: vé kỷ niệm, phần thưởng, nội dung sau sự kiện. Không dùng thuật ngữ ví hay gas.
- Dashboard ban tổ chức có: doanh số vé, lượt quét cổng, doanh thu, doanh thu từ bán lại.
- Tín hiệu tin cậy ở chân trang: "Fan Guarantee", "Verified safe and secure checkout".
- Có mã giảm giá và FAQ ngay trên trang giới thiệu.

### 1.2 SeatlabNFT

Ưu tiên app di động, nặng phần kể sứ mệnh.

- Banner "Download Now" ở đầu mọi trang. Menu gọn: Marketplace · Events · Collectables.
- Thông điệp chính là chống phe vé (scalping) và gắn kết fan với nghệ sĩ.
- Lộ thuật ngữ crypto ra menu ("Tokenomics"). Với người dùng phổ thông, đây là rào cản.
- Form đăng ký nhận tin báo lỗi chung chung: *"Oops! Something went wrong while submitting the form."* Không nói lỗi gì, không nói cách sửa. **Không nên làm theo.**

### 1.3 Unlock Protocol

Web3 thuần, phải có ví mới vào được.

- Trang sự kiện chỉ hiện nút **"Connect"** khi chưa kết nối ví.
- Mỗi sự kiện triển khai một contract riêng. Vé bán dưới dạng NFT. Check-in bằng mã QR riêng.
- Người không có ví bị chặn ngay ở bước đầu.

### 1.4 OpenSea – Polygon trên Seaport

Cơ chế chợ thứ cấp, có ích cho thiết kế sàn đấu giá.

- Hai kiểu đấu giá: kiểu Anh (giá tăng dần) và kiểu Hà Lan (giá giảm dần).
- Đặt **mức offer tối thiểu $1** để chặn offer kém nghiêm túc.
- Cho mua hộ hoặc mua tặng một ví khác. Chuyển nhiều NFT trong một giao dịch.
- Người dùng **tự trả gas** bằng token gốc (MATIC). Đây là điểm gây khó cho người mới.

### 1.5 Kết luận cho NFT Ticket

| Hướng | Có trong kế hoạch của mình |
| --- | --- |
| Giấu ví, gas, thuật ngữ blockchain; nói về lợi ích (vé thật, không giả, bán lại an toàn) | Ví custodial tạo khi đăng ký (TIC-57), relayer trả gas (TIC-58) |
| Đăng nhập kiểu web2 trước, ví ngoài là tùy chọn | OTP email (TIC-37), liên kết ví bằng SIWE là tùy chọn (TIC-82, TIC-86) |
| Tạo sự kiện theo bước ngắn | Dashboard tổ chức, tạo sự kiện + hạng vé (TIC-51) |
| Dashboard có doanh số và lượt quét cổng | TIC-51, scanner (TIC-63) |
| Tín hiệu tin cậy gần nút thanh toán | Checkout (TIC-61) |
| Có ngưỡng tối thiểu cho lượt trả giá | Bước giá, giá trần (TIC-65) |

**Không làm theo:** bắt kết nối ví ngay từ đầu (Unlock), lộ thuật ngữ crypto ra menu (Seatlab), thông báo lỗi chung chung (Seatlab), bắt người dùng thấy hoặc trả gas (OpenSea).

## 2. Lỗi giao diện thường gặp (từ báo cáo SUSPA)

| # | Lỗi | Cách sửa trong báo cáo |
| --- | --- | --- |
| L1 | Chữ phụ nhỏ, tương phản thấp: nhãn, ngày, tên nguồn, avatar, bộ đếm, chân trang. Lặp lại nhiều nhất. | Tăng cỡ chữ và độ tương phản. |
| L2 | Thông tin trạng thái nằm rải rác ở nhiều chỗ. | Gom về một cụm. |
| L3 | Cấp tiêu đề bị nhảy. | Sắp theo thứ tự trang → danh sách → mục. |
| L4 | Con số dễ bị hiểu sai (điểm truy xuất bị đọc như điểm chất lượng). | Đưa vào phần mở rộng, kèm cách tính. |
| L5 | Cảnh báo quan trọng nằm cuối trang, xa nội dung liên quan. | Đặt cảnh báo ngay trên thẻ liên quan. |
| L6 | Trạng thái rỗng không có lối đi: thiếu nút hành động, vẫn hiện tìm kiếm/bộ lọc, không phân biệt "trống" với "không khớp", khung trống chiếm nhiều chỗ. | Nút hành động chính; hiện bộ lọc khi có dữ liệu; thông báo riêng khi không khớp; thu gọn khung. |
| L7 | Trang trí thừa: quầng sáng, bóng chữ, thẻ quá cao, viền nhấn dày, hình lặp. | Bỏ hoặc làm nhẹ; dùng hàng gọn có biểu tượng. |
| L8 | Dòng chữ trải quá rộng trên màn hình lớn. | Giới hạn chiều rộng đoạn văn và cột mô tả. |
| L9 | Hàng mở được nhưng không có dấu hiệu. | Thêm dấu mở rộng (chevron) cạnh trạng thái. |
| L10 | Nhãn bị cắt vì nằm trong lớp giới hạn. | Đặt nhãn ra ngoài lớp bị cắt. |
| L11 | Trên điện thoại, mở chi tiết nhưng tiêu điểm không chuyển theo. | Chuyển tiêu điểm đến phần chi tiết. |

Báo cáo kiểm tra trên **desktop, điện thoại và chế độ tối**. NFT Ticket dùng cùng chuẩn khi nghiệm thu UI.

## 3. Áp dụng cho NFT Ticket

| Lỗi | Màn hình | Yêu cầu thiết kế | Issue |
| --- | --- | --- | --- |
| L5 | Checkout | Câu cam kết *"Vé không hoàn tiền, trừ khi sự kiện bị hủy. Bạn có thể bán lại vé qua sàn đấu giá."* (PRODUCT_CONTEXT 3.1) và ô tích xác nhận đặt **ngay cạnh nút thanh toán**, không để ở điều khoản cuối trang. | TIC-61 |
| L5 | Mọi chỗ bị chặn | Banner hiện đúng tại nút hoặc bước bị chặn, theo `code` của mục 5.7: nói lý do và có nút đến bước còn thiếu (xác thực SĐT, eKYC, nhập TOTP…). Mã nhóm 409 chỉ hiện lý do, không có nút. Không dùng thông báo chung chung. | TIC-85 |
| L2 | Vé của tôi | Trạng thái vé (hợp lệ, đang rao, đã dùng, void, đang hoàn tiền) gom thành một cụm trên thẻ vé. | TIC-62, TIC-88 |
| L2 | Chi tiết phiên đấu giá | Giá dẫn đầu, thời gian còn lại, trạng thái kết nối realtime nằm cùng một cụm. | TIC-72 |
| L4 | Thẻ vé, chi tiết vé | Không đưa token ID, tx hash lên làm thông tin chính. Để trong mục mở rộng "Chi tiết blockchain". | TIC-62 |
| L6 | Vé của tôi, sàn đấu giá, dashboard tổ chức | Khi trống: nút hành động chính ("Khám phá sự kiện", "Tạo sự kiện"). Ẩn bộ lọc khi chưa có dữ liệu. Tách "chưa có phiên" với "không khớp bộ lọc". | TIC-93 |
| L1, L11 | QR động, scanner | Dùng chủ yếu trên điện thoại: đồng hồ đếm ngược QR và kết quả ✅/❌ kèm lý do phải to, tương phản cao. Mở chi tiết thì tiêu điểm chuyển theo. | TIC-62, TIC-63 |
| L3, L8 | Trang sự kiện | Cấp tiêu đề đúng thứ tự; giới hạn chiều rộng phần mô tả sự kiện. | TIC-61 |
| L9 | Danh sách đơn, hồ sơ admin | Hàng mở được có chevron. | TIC-87 |
| L7 | Design tokens | Bảng token không có quầng sáng hay bóng chữ; viền mảnh; cỡ chữ phụ tối thiểu đủ đọc. | TIC-34 |

## 4. Câu hỏi mở (cần LEAD chốt, chưa đưa vào DECISIONS)

- Sàn đấu giá chỉ có kiểu Anh (giá tăng dần) hay có thêm kiểu Hà Lan? Cần chốt cùng tham số ở TIC-65.
- Có cho "mua tặng" (vé đứng tên người khác) không? Nếu có thì ảnh hưởng hạn mức vé/tài khoản và eKYC.
- Vé sau sự kiện có thành vật kỷ niệm như Super Ticket™ không, hay giữ trạng thái "đã dùng"?
