# NFT Ticket MVP

Tài liệu bàn giao cho Product, Design, Engineering và QA. Mỗi luồng mô tả hành vi cần triển khai, các quyết định còn mở và điều kiện nghiệm thu. Mã `NFT-xx` tham chiếu đến backlog trong bảng đối chiếu ở mục 8.

## 1. Sản phẩm và phạm vi

Nền tảng đóng vai trò trung gian giữa ban tổ chức và người tham dự. Ban tổ chức cung cấp sự kiện, hạng vé và số lượng phát hành. Nền tảng bán vé sơ cấp, xử lý hủy và hoàn tiền theo chính sách, đồng thời vận hành thị trường đấu giá lại vé đã phát hành.

| Trạng thái | Nội dung |
| --- | --- |
| Yêu cầu | Bán sơ cấp theo giá cố định, có luồng hủy và hoàn tiền. |
| Yêu cầu | Chủ vé mở phiên đấu giá và đặt thời hạn. Phiên có trần theo phần trăm giá vé cơ bản và kết thúc khi hết hạn, có giá hợp lệ chạm trần hoặc không có ai trả giá tiếp trong khoảng đã cấu hình. |
| Yêu cầu | Định danh gồm hồ sơ cơ bản, ví và eKYC. |
| Đề xuất MVP | Thử nghiệm một sự kiện, một loại tiền tệ, một vé trên mỗi phiên. Có màn hình vận hành tối thiểu và xác thực quyền vào cửa một lần. |
| Chờ quyết định | Chính sách hoàn tiền, giữ chỗ và thanh toán, nguồn cấu hình trần, điều kiện định danh, cơ chế eKYC, phát hành và chuyển NFT. |

**Nguồn phạm vi** là yêu cầu của chủ dự án trong cuộc trò chuyện. Bản nháp PDF trang 1 được dùng để đối chiếu các nhánh bán, hủy/hoàn và đấu giá. Các ghi chú rời trong sơ đồ được xem là ý tưởng tham khảo.

## 2. Vai trò và quyền

| Vai trò | Quyền chính |
| --- | --- |
| Ban tổ chức | Quản lý sự kiện của mình, khai báo hạng vé, giá niêm yết, hạn mức và cửa sổ bán. Chỉ nhân sự được cấp quyền mới xác thực vé của sự kiện. |
| Người mua | Xem sự kiện, mua vé, xem vé của mình, yêu cầu hủy/hoàn theo chính sách và trả giá nếu đủ điều kiện. |
| Người bán lại | Là chủ vé hiện tại và đủ điều kiện giao dịch. Có thể mở phiên cho vé đủ điều kiện. |
| Vận hành nền tảng | Tra cứu đơn, vé, phiên và trạng thái xử lý. Xử lý ngoại lệ theo quyền được cấp, ghi lại người thao tác và lý do. |

Backend kiểm tra quyền theo tài khoản, sự kiện và quyền sở hữu. Các thao tác có thể cạnh tranh trên cùng vé, như check-in, mở phiên và hủy vé, phải kiểm tra và cập nhật trạng thái theo cùng một cơ chế khóa hoặc kiểm soát phiên bản.

## 3. Bán sơ cấp, hủy và hoàn tiền

### Phát hành và mua vé

1. Ban tổ chức tạo sự kiện và hạng vé với giá cơ bản, tiền tệ, số lượng, cửa sổ bán và chính sách hủy/hoàn. Khách thấy giá và chính sách trước khi thanh toán.
2. Người mua chọn hạng vé. Hệ thống giữ tồn kho có hạn và chụp lại giá, phí nếu có, tổng tiền và phiên bản chính sách vào đơn. Hết hạn hoặc thanh toán thất bại thì giải phóng giữ chỗ đúng một lần.
3. Sau khi xác thực thông báo thanh toán và đối chiếu mã đơn, số tiền, tiền tệ, hệ thống ghi nhận thanh toán. Quyền sử dụng vé chỉ có hiệu lực khi quy trình phát hành thành công. Nếu thanh toán đến sau khi giữ chỗ hết hạn hoặc phát hành gặp lỗi, đưa vào xử lý ngoại lệ với trạng thái hiển thị rõ.
4. Người mua xem vé trong tài khoản. Tại cổng, nhân sự có quyền xác thực vé còn hiệu lực và ghi nhận check-in một lần. Quyền check-in của vé đang rao hoặc chờ chuyển cần chốt trước pilot.

### Hủy và hoàn

1. Người có quyền gửi yêu cầu hủy với đơn đủ điều kiện. Trước khi xác nhận, hiển thị số tiền dự kiến, phần phí xử lý nếu có và điều kiện áp dụng.
2. Kiểm tra quyền sở hữu hiện tại, trạng thái vé, phiên đang mở, check-in và chính sách đã ghi nhận trên đơn. Khi yêu cầu được chấp nhận, khóa vé khỏi thao tác xung đột và bắt đầu hoàn tiền.
3. Tách trạng thái vô hiệu hóa vé và trạng thái hoàn tiền. Lưu mã tham chiếu hoàn tiền. Nếu kết quả chưa rõ hoặc thất bại, giữ khóa và chuyển đối soát. Việc trả vé về kho hoặc mở khóa chỉ xảy ra khi chính sách cho phép và kết quả tài chính đã được đối soát.
4. Vận hành cần kịch bản riêng cho sự kiện bị hủy, bao gồm đóng giao dịch, xử lý phiên đang chạy và xác định người nhận hoàn đối với vé đã bán lại. Các chính sách này phải được chốt trước pilot có tiền thật.

**Nghiệm thu** gồm hai người tranh suất cuối, thanh toán lặp hoặc đến muộn, phát hành lỗi sau khi thu tiền, hủy khi vé đang rao hoặc đã check-in, hoàn tiền lỗi, callback hoàn tiền lặp và check-in đồng thời.

## 4. Thị trường đấu giá

### Mở phiên và trả giá

1. Chủ vé chọn vé đủ điều kiện và đặt thời hạn. Hệ thống kiểm tra quyền sở hữu, cửa sổ giao dịch và trạng thái vé. Mỗi vé có tối đa một phiên hoạt động hoặc đang quyết toán.
2. Khi mở phiên, lưu thời điểm kết thúc, giá cơ bản, tỷ lệ trần, giá trần, tiền tệ, giá mở, bước giá và khoảng im lặng theo cấu hình. Đề xuất công thức `giá trần = floor(giá cơ bản × tỷ lệ trần)` theo đơn vị tiền nhỏ nhất. Tỷ lệ 150% của vé 500.000 đồng cho trần 750.000 đồng. Cần chốt ai đặt tỷ lệ, giới hạn cho phép và khoản phí nào nằm trong trần.
3. Người mua thấy giá dẫn đầu, mức đặt tối thiểu, trần và thời hạn hiệu lực. Backend dùng thời gian máy chủ, kiểm tra điều kiện của tài khoản, loại tự trả giá và xử lý yêu cầu đồng thời theo thứ tự ghi nhận. Giá đầu tiên phải đạt giá mở. Các giá sau phải vượt giá hiện tại theo bước giá. Đề xuất cho phép đặt đúng giá trần khi trần cao hơn giá dẫn đầu nhưng phần chênh nhỏ hơn bước giá.
4. Đề xuất tính khoảng im lặng từ lần trả giá hợp lệ mới nhất, bắt đầu sau giá đầu tiên. Giá bị từ chối và thao tác gửi lại không làm thay đổi đồng hồ. Dùng 5 phút trong bộ test ban đầu. Giá trị dùng khi phát hành cần được Product chốt.

### Kết thúc phiên

| Điều kiện | Kết quả nghiệp vụ |
| --- | --- |
| Giá hợp lệ chạm trần trước thời hạn hiệu lực | Đóng phiên trong cùng giao dịch ghi nhận giá và chốt người dẫn đầu. |
| Tới hạn người bán đặt | Chốt người dẫn đầu nếu đã có giá hợp lệ. Nếu chưa có giá thì đóng phiên và giải phóng khóa rao. |
| Tới hạn im lặng trước hạn người bán đặt | Chốt người dẫn đầu. |
| Phiên đã tới hạn, tác vụ tự đóng chưa chạy | Backend từ chối giá mới và thực thi hoặc lên lịch đóng phiên theo cùng quy tắc. |

Quy tắc kỹ thuật đề xuất: thời điểm có thể trả giá là trước mốc sớm hơn giữa hạn người bán đặt và hạn im lặng nếu đã có bid. Hai mốc bằng nhau ghi lý do hết hạn người bán. Mỗi phiên chỉ ghi một kết quả, kể cả khi tác vụ chạy lại. Bid và quyết định đóng phiên dùng cùng khóa hoặc phiên bản dữ liệu.

### Quyết toán và nhận vé

Kết quả đấu giá ghi người thắng, giá thắng, thời điểm, lý do đóng và mã giao dịch. Người thắng nhận thông báo và thấy trạng thái đang xử lý. Đề xuất tạo bản ghi quyết toán riêng và giữ khóa vé trong lúc chờ thanh toán hoặc chuyển quyền. Chỉ hiển thị vé khả dụng cho người thắng khi thanh toán và chuyển quyền được xác nhận. Chính sách thu tiền, xử lý người thắng không thanh toán, chi trả người bán và khôi phục sau lỗi là đầu việc cần chốt. Các luồng demo dùng tích hợp giả lập.

**Nghiệm thu** gồm chạm trần, hết giờ, im lặng sau bid hợp lệ, phiên không có bid, bid đúng mốc đóng, hai bid cùng chạm trần, scheduler chạy trễ hoặc lặp và chuyển quyền lỗi sau khi đã thu tiền. Kiểm tra cả UI của người mua, chủ vé cũ và người thắng.

## 5. Hồ sơ, ví và eKYC

| Phần | Phạm vi triển khai |
| --- | --- |
| Hồ sơ | Xác thực tài khoản và quản lý thông tin cơ bản. Đề xuất bắt đầu với tên hiển thị và một kênh liên hệ đã xác thực. Product chốt trường bắt buộc và quyền truy cập. |
| Ví | Liên kết địa chỉ với tài khoản qua cơ chế chứng minh quyền kiểm soát tương thích với loại ví sẽ chọn. Tài liệu kỹ thuật cần quy định hết hạn, chống dùng lại yêu cầu xác minh và chính sách đổi ví. Hệ thống chỉ yêu cầu dữ liệu cần cho việc xác minh quyền kiểm soát. |
| eKYC | Định nghĩa giao diện tích hợp và trạng thái `not_started`, `pending`, `verified`, `rejected`. Dùng dữ liệu giả lập trong môi trường thử nghiệm. Hình thức xác minh, nhà cung cấp và cách xử lý/lưu dữ liệu là đầu việc nghiên cứu. |
| Điều kiện giao dịch | Product chốt ma trận cho mua sơ cấp, rao, trả giá, nhận vé. Backend trả về mã lý do khi chặn. Frontend hướng dẫn người dùng hoàn thành bước còn thiếu. |

**Nghiệm thu** gồm truy cập hồ sơ người khác, yêu cầu xác minh ví hết hạn hoặc bị dùng lại, eKYC đang chờ/từ chối, callback lặp và chính sách giao dịch chặn đúng cả UI lẫn API.

## 6. Mô hình dữ liệu và tích hợp

| Dữ liệu | Trường nghiệp vụ chính |
| --- | --- |
| Event / TicketTier | Đơn vị tổ chức, thời gian sự kiện, cửa sổ bán, giá cơ bản, hạn mức, chính sách. |
| Order / Reservation | Người mua, giá và chính sách tại lúc mua, hạn giữ chỗ, trạng thái thanh toán và phát hành. |
| Ticket | Chủ hiện tại, hạng, giá cơ bản dùng cho trần, quyền sử dụng, khóa giao dịch, tham chiếu token nếu có. |
| Auction / Bid | Vé, người bán, tham số phiên, người trả, mức giá, thứ tự xác nhận, hạn hiệu lực, kết quả. |
| Settlement / Refund | Liên kết đơn hoặc phiên, số tiền, trạng thái thu/hoàn/chi trả/chuyển quyền, mã tham chiếu, lần thử và lý do lỗi. |
| Profile / WalletLink / Verification | Hồ sơ tối thiểu, liên kết ví, trạng thái xác minh, mã tham chiếu tích hợp giới hạn quyền truy cập. |

- Backend quản lý tồn kho, quyền truy cập, luật đặt giá và trạng thái nghiệp vụ. Nhóm tích hợp cần xác định nguồn xác nhận quyền sở hữu NFT và quy trình đối soát khi dữ liệu token lệch với ứng dụng.
- Dùng số nguyên theo đơn vị tiền nhỏ nhất. Dùng thời gian UTC để ghi nhận và hiển thị múi giờ sự kiện cho người dùng. Tác vụ thử lại và callback cần khóa chống xử lý lặp theo mã giao dịch.
- Ghi nhật ký thay đổi trạng thái, ID tương quan và thao tác của vận hành. Loại dữ liệu định danh nhạy cảm khỏi metadata công khai của NFT và log ứng dụng.

## 7. Quyết định cần chốt

| Backlog | Chủ trì đề xuất | Đầu ra cần có |
| --- | --- | --- |
| NFT-01 | Product + Design | Luồng pilot, phạm vi check-in, giới hạn hạng vé và cửa sổ giao dịch trước sự kiện. |
| NFT-05 | Product + Vận hành + Thanh toán | Ai có quyền hủy, thời hạn, phí, nhập kho lại, người nhận hoàn sau bán lại, xử lý hủy sự kiện. |
| NFT-07 | Product + Engineering | Nguồn tỷ lệ trần, khoảng hợp lệ, bước giá, cách tính phí, mốc im lặng, quyền hủy phiên và điều kiện vé được rao. |
| NFT-11 | Product + Thanh toán + Vận hành | Thời điểm thu/giữ tiền, hạn thanh toán, giải phóng khóa, xử lý người thắng bỏ cuộc, chi trả người bán và lỗi một phần. |
| NFT-13 | Product + Engineering | Loại ví, cách chứng minh quyền kiểm soát, quy tắc liên kết hoặc đổi ví. |
| NFT-14 | Product + Định danh | Các bước cần eKYC, phương án tích hợp và quản lý dữ liệu, xử lý từ chối và kiểm tra lại. |
| NFT-16 | Engineering + Product | Nơi phát hành NFT, cách chuyển và xác nhận quyền, ví mất quyền truy cập, giao dịch ngoài sàn, thu hồi hiệu lực khi hoàn và đối soát. |

## 8. Kế hoạch bàn giao và Linear

| Milestone đề xuất | Issues | Điều kiện qua mốc |
| --- | --- | --- |
| M0 · Phạm vi và quy tắc | NFT-01, NFT-05, NFT-07, NFT-11, NFT-14, NFT-16 | Mỗi quyết định có người phụ trách, tiêu chí chọn phương án và đầu ra. Các quyết định chặn pilot được phê duyệt trước M4. |
| M1 · Bán sơ cấp | NFT-02 đến NFT-04, NFT-06, NFT-17 | Demo cấu hình sự kiện, bán theo giá cố định, xem vé, hủy/hoàn và xác thực vào cửa với tích hợp giả lập. |
| M2 · Đấu giá và quyết toán | NFT-08 đến NFT-10, NFT-18 | Demo cả ba điều kiện đóng, một người thắng và trạng thái quyết toán khi thành công hoặc lỗi. |
| M3 · Định danh và tích hợp | NFT-12, NFT-13, NFT-15, NFT-19 | Hồ sơ, ví và trạng thái eKYC đi qua kiểm tra điều kiện giao dịch. Tích hợp được kiểm thử theo các quyết định nghiên cứu. |
| M4 · Pilot | NFT-20 | Các luồng chính và các ca lỗi đạt kiểm thử. Vận hành có quy trình đối soát, xử lý sự cố và tiêu chí dừng pilot. |

Các nhóm có thể bắt đầu mô hình dữ liệu và hợp đồng tích hợp bằng stub. Công việc chịu ảnh hưởng của một quyết định cần được đánh dấu blocked cho phần triển khai thật. Khi bắt đầu một issue, chốt assignee và ước lượng với người thực hiện. Khi kết thúc, cập nhật bằng chứng nghiệm thu và liên kết thay đổi.

[Project NFT Ticket MVP](https://linear.app/ticket-blockchain/project/nft-ticket-mvp-7524715dbac6) thuộc team TIC. [Bản tài liệu trên Linear](https://linear.app/ticket-blockchain/document/context-san-pham-va-tieu-chi-nghiem-thu-210ce29a02af).

### Đối chiếu mã công việc

| Mã trong tài liệu | Issue Linear | Công việc |
| --- | --- | --- |
| NFT-01 | [TIC-5](https://linear.app/ticket-blockchain/issue/TIC-5/nft-01-chot-pham-vi-va-tieu-chi-pilot) | Chốt phạm vi và tiêu chí pilot |
| NFT-02 | [TIC-7](https://linear.app/ticket-blockchain/issue/TIC-7/nft-02-tao-su-kien-va-cau-hinh-hang-ve) | Tạo sự kiện và cấu hình hạng vé |
| NFT-03 | [TIC-8](https://linear.app/ticket-blockchain/issue/TIC-8/nft-03-giu-ton-kho-va-tao-djon-gia-co-djinh) | Giữ tồn kho và tạo đơn giá cố định |
| NFT-04 | [TIC-9](https://linear.app/ticket-blockchain/issue/TIC-9/nft-04-xac-nhan-thanh-toan-va-phat-hanh-quyen-ve) | Xác nhận thanh toán và phát hành quyền vé |
| NFT-05 | [TIC-10](https://linear.app/ticket-blockchain/issue/TIC-10/nft-05-chot-chinh-sach-huy-ve-va-hoan-tien) | Chốt chính sách hủy vé và hoàn tiền |
| NFT-06 | [TIC-13](https://linear.app/ticket-blockchain/issue/TIC-13/nft-06-trien-khai-yeu-cau-huy-va-hoan-tien) | Triển khai yêu cầu hủy và hoàn tiền |
| NFT-07 | [TIC-12](https://linear.app/ticket-blockchain/issue/TIC-12/nft-07-chot-quy-tac-mo-va-djong-phien-djau-gia) | Chốt quy tắc mở và đóng phiên đấu giá |
| NFT-08 | [TIC-14](https://linear.app/ticket-blockchain/issue/TIC-14/nft-08-tao-phien-va-khoa-ve-djang-rao) | Tạo phiên và khóa vé đang rao |
| NFT-09 | [TIC-16](https://linear.app/ticket-blockchain/issue/TIC-16/nft-09-ghi-nhan-bid-va-cap-nhat-nguoi-dan-djau) | Ghi nhận bid và cập nhật người dẫn đầu |
| NFT-10 | [TIC-19](https://linear.app/ticket-blockchain/issue/TIC-19/nft-10-tu-djong-phien-va-ghi-nhan-nguoi-thang) | Tự đóng phiên và ghi nhận người thắng |
| NFT-11 | [TIC-17](https://linear.app/ticket-blockchain/issue/TIC-17/nft-11-chot-thanh-toan-va-chi-tra-sau-djau-gia) | Chốt thanh toán và chi trả sau đấu giá |
| NFT-12 | [TIC-6](https://linear.app/ticket-blockchain/issue/TIC-6/nft-12-tao-tai-khoan-va-ho-so-co-ban) | Tạo tài khoản và hồ sơ cơ bản |
| NFT-13 | [TIC-15](https://linear.app/ticket-blockchain/issue/TIC-15/nft-13-chot-va-trien-khai-lien-ket-vi) | Chốt và triển khai liên kết ví |
| NFT-14 | [TIC-18](https://linear.app/ticket-blockchain/issue/TIC-18/nft-14-nghien-cuu-ekyc-va-lap-ma-tran-quyen-giao-dich) | Nghiên cứu eKYC và lập ma trận quyền giao dịch |
| NFT-15 | [TIC-21](https://linear.app/ticket-blockchain/issue/TIC-21/nft-15-hien-thi-trang-thai-ekyc-va-kiem-tra-djieu-kien-giao-dich) | Hiển thị trạng thái eKYC và kiểm tra điều kiện giao dịch |
| NFT-16 | [TIC-20](https://linear.app/ticket-blockchain/issue/TIC-20/nft-16-nghien-cuu-phat-hanh-va-chuyen-quyen-nft) | Nghiên cứu phát hành và chuyển quyền NFT |
| NFT-17 | [TIC-11](https://linear.app/ticket-blockchain/issue/TIC-11/nft-17-xac-thuc-quyen-vao-cua-mot-lan) | Xác thực quyền vào cửa một lần |
| NFT-18 | [TIC-22](https://linear.app/ticket-blockchain/issue/TIC-22/nft-18-theo-doi-quyet-toan-va-thong-bao-ket-qua-phien) | Theo dõi quyết toán và thông báo kết quả phiên |
| NFT-19 | [TIC-23](https://linear.app/ticket-blockchain/issue/TIC-23/nft-19-tich-hop-phat-hanh-chuyen-nft-va-djoi-soat) | Tích hợp phát hành, chuyển NFT và đối soát |
| NFT-20 | [TIC-24](https://linear.app/ticket-blockchain/issue/TIC-24/nft-20-kiem-thu-djau-cuoi-va-chuan-bi-pilot) | Kiểm thử đầu cuối và chuẩn bị pilot |

