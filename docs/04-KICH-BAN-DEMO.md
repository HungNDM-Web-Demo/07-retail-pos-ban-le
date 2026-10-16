# Kịch bản demo — POS Cửa hàng Bán lẻ

> Dùng khi trình bày cho chủ tạp hóa, mini mart, cửa hàng tiện lợi. Thời lượng 12–15 phút. Đi theo một ngày của cửa hàng: mở ca, tính tiền giờ đông khách, đổi trả, chốt ca, nhập hàng, xem lãi lỗ.

---

## 1. Chuẩn bị trước buổi demo

- [ ] Mở sẵn link demo, thử "Đăng nhập nhanh" cả 3 vai trò
- [ ] Đặt lại dữ liệu demo (thanh công cụ demo → Đặt lại dữ liệu) để có số liệu 90 ngày tính tới hôm nay
- [ ] Đổi tên cửa hàng, logo, màu theo thương hiệu khách (Cài đặt → Thương hiệu) nếu đã biết
- [ ] Để trình duyệt ở 1366×768 cho giống màn hình máy tính tiền; nếu có máy quét USB thì cắm sẵn và thử quét vào ô Ghi chú của Notepad
- [ ] Không có máy quét thì dùng bảng "Mã vạch mẫu" trên màn Bán hàng (bấm mã để giả lập quét) hoặc nút "Quét mã ngẫu nhiên" trên thanh công cụ demo; có máy quét thì in sẵn tờ mã vạch mẫu: lon, lốc, thùng Bia lager; gói, thùng Mì gói tôm chua cay; hộp, lốc Sữa tươi tiệt trùng (giá trị lấy ở `05-KICH-BAN-KIEM-THU.md` §1)
- [ ] Ghi nhớ hóa đơn mẫu B (mua hôm qua, có 2 lốc sữa) để demo đổi trả

| Link | Ghi chú |
| :--- | :--- |
| FE | Bản online (dữ liệu mẫu, không cần BE): `https://pum-pos-ban-le.vercel.app`; chạy máy: `http://localhost:3107` |
| Swagger | `https://localhost:7107/swagger` (khi khách hỏi về tích hợp) |

| Tài khoản | Vai trò | Dùng để cho xem |
| :--- | :--- | :--- |
| `admin` | Quản trị viên | Phân quyền, thương hiệu, cài đặt khổ in, bán âm kho |
| `quanly` | Chủ cửa hàng | Tổng quan, hàng hóa, nhập hàng, tồn kho, kiểm tra ca, báo cáo lợi nhuận, xác nhận giảm giá |
| `thungan` | Thu ngân | Mở ca, quét mã tính tiền, đổi trả, chốt ca |

Mật khẩu: giá trị `DEMO_PASSWORD` trong `.env`, hoặc bấm "Đăng nhập nhanh".

---

## 2. Câu chuyện demo

> Mở đầu: "Anh/chị hình dung 6 giờ sáng cửa hàng mình mở cửa. Em đi đúng một ngày của cửa hàng để anh/chị thấy phần mềm đỡ được việc gì."

| # | Vai trò | Thao tác | Điểm cần nhấn mạnh |
| :---: | :--- | :--- | :--- |
| 1 | Chủ cửa hàng | Đăng nhập, mở Tổng quan | Mở máy là thấy doanh thu và **lãi gộp** hôm nay, so với hôm qua; biết ngay mấy mặt hàng sắp hết, mấy lô sữa sắp hết hạn |
| 2 | Thu ngân | Đổi vai trò sang Thu ngân trên thanh công cụ demo; vào Bán hàng, hệ thống bắt mở ca, nhập tiền đầu ca 500.000 ₫ | Chưa mở ca thì không bán được; cuối ca mới đối soát được két |
| 3 | Thu ngân | Quét mã lon Bia lager, rồi mã lốc, rồi mã thùng: ra 3 dòng 18.000 ₫, 105.000 ₫, 410.000 ₫. Gõ `12*` rồi quét gói mì tôm chua cay | Mỗi đơn vị một mã, một giá; không phải nhớ giá hàng nghìn món; khách mua 12 gói không phải quét 12 lần |
| 4 | Thu ngân | Khách quen xin bớt 30.000 ₫ trên hóa đơn 587.000 ₫: vượt 5%, hệ thống mở hộp xác nhận; chủ cửa hàng gõ tài khoản `quanly` ngay trên máy | Thu ngân không tự bớt quá tay; mọi khoản giảm vượt mức đều có tên người duyệt |
| 5 | Thu ngân | Khách quay lại lấy thêm đồ: bấm F6 mở hóa đơn chờ, tính cho khách sau 1 hộp sữa bột; khách xin bớt 4% thì hệ thống chặn vì thấp hơn giá vốn; thu ngân gỡ giảm, thu bằng QR, quay lại tab cũ | Giờ tan tầm không bắt cả hàng người chờ một khách; không bao giờ bán lỗ mà chủ không biết |
| 6 | Thu ngân | F9 thanh toán tab cũ: tổng 557.000 ₫, hệ thống gợi ý 560.000 ₫, 600.000 ₫, 1.000.000 ₫; bấm 600.000 ₫, tiền thối 43.000 ₫; in bill có mã vạch | Tiền thối tự tính, gợi ý đúng tờ khách hay đưa; bill có mã vạch để đổi trả sau này |
| 7 | Thu ngân | Khách mang bill hôm qua đến đổi 1 lốc sữa lấy 1 lốc bia: quét mã trên bill, chọn dòng trả, quét hàng đổi, thu thêm 74.000 ₫ | Đổi trả 30 giây, hoàn đúng số khách đã trả (kể cả khi hóa đơn có giảm giá); tồn kho tự cộng lại |
| 8 | Thu ngân | Chốt ca: nhập số tờ theo mệnh giá, cố tình thiếu 23.500 ₫ | Hệ thống tự tính tiền phải có trong két, tính cả tiền thu thêm khi đổi hàng; lệch quá 20.000 ₫ tự gắn cờ đỏ |
| 9 | Chủ cửa hàng | Đổi sang Chủ cửa hàng, mở Danh sách ca, xem ca vừa chốt, ghi chú xử lý | Không cần đứng quầy vẫn biết ca nào lệch, ai giảm giá, ai đổi trả |
| 10 | Chủ cửa hàng | Mở Tồn kho: Bia lager còn 13 lon, hiện "2 lốc 1 lon", trạng thái Sắp hết; tab Sắp hết hạn có lô sữa tươi còn 20 ngày; một lô sữa chua đã hết hạn thì bấm "Hủy lô" | Đọc tồn theo thùng, lốc như ngoài kho; biết lô nào sắp hết hạn để bán đẩy, lô nào phải hủy và hủy mất bao nhiêu tiền |
| 11 | Chủ cửa hàng | Nhập hàng: quét mã thùng mì, nhập 5 thùng giá mới 114.000 ₫; quét mã thùng nước suối, nhập 10 thùng giá 117.600 ₫; xác nhận; giá vốn mì tự lên 3.732 ₫/gói (còn 78 gói sau bước 3); hệ thống báo nước suối lãi 4,5%, sửa giá chai thành 5.500 ₫ ngay | Giá vốn bình quân tự tính, nhà cung cấp tăng giá là biết ngay mặt hàng nào đang lãi mỏng |
| 12 | Chủ cửa hàng | Mở Báo cáo: lợi nhuận gộp 30 ngày, lợi nhuận theo nhóm hàng, hàng lỗi do đổi trả | Biết nhóm nào thật sự có lãi, không chỉ nhìn doanh thu; bỏ bớt hàng bán chạy mà lãi thấp |

> Nếu khách hỏi phân quyền: đổi sang Quản trị viên, bỏ quyền "Xem giá vốn" của một vai trò rồi đổi vai trò để thấy cột giá vốn biến mất.
>
> Kết: "Toàn bộ dữ liệu anh/chị vừa thấy là dữ liệu mẫu. Bản triển khai sẽ nhập danh mục hàng của cửa hàng mình từ file Excel, dùng máy quét và máy in bill cửa hàng đang có."

---

## 3. Câu hỏi khách hay hỏi

| Câu hỏi | Trả lời gợi ý |
| :--- | :--- |
| Dùng máy quét mã vạch loại nào? | Máy quét USB hoặc không dây loại thông dụng đều dùng được ngay vì chạy như bàn phím, không cần cài driver. Trong demo em gõ tay mã vạch. |
| Hàng không có mã vạch (trứng, bánh tự đóng gói) thì sao? | Tìm theo tên không dấu, hoặc cho hệ thống sinh mã nội bộ và in tem dán lên hàng (có trong kế hoạch, demo chưa bật). |
| Bán rau, thịt, trái cây theo cân được không? | Demo chưa có. Bản triển khai đọc được mã vạch từ cân điện tử in tem (mã có sẵn trọng lượng hoặc số tiền). |
| Có xuất hóa đơn điện tử từ máy tính tiền không? | Demo chưa kết nối. Bản triển khai kết nối nhà cung cấp hóa đơn điện tử cửa hàng đang dùng, đáp ứng yêu cầu hóa đơn khởi tạo từ máy tính tiền cho hộ kinh doanh. |
| Giá vốn tính thế nào? | Bình quân gia quyền: mỗi lần nhập, hệ thống lấy giá trị hàng còn tồn cộng giá trị hàng mới nhập rồi chia cho tổng số lượng. Đổi đơn vị thùng, lốc, lon đều quy về một giá vốn mỗi lon. |
| Có chương trình mua 2 tặng 1, giảm giá giờ vàng không? | Demo mới có giảm giá tay có kiểm soát. Bản triển khai thêm khuyến mãi tự động theo mặt hàng, khung giờ, combo. |
| Khách quen hay ghi sổ nợ thì sao? | Demo chưa có bán chịu. Bản triển khai thêm công nợ khách, nhắc nợ. |
| Mất mạng có bán được không? | Bản demo cần mạng. Bản triển khai có thể bán offline trên máy tính tiền rồi đồng bộ khi có mạng, cần khảo sát thêm. |
| Có nhiều cửa hàng, nhiều kho không? | Demo chạy một cửa hàng. Có demo Quản lý Kho riêng cho nhập, xuất, chuyển kho, kiểm kê; bản triển khai nối hai phần. |
| Nhân viên có thấy giá vốn, lãi lỗ không? | Không. Thu ngân chỉ thấy giá bán và hóa đơn trong ca của mình; giá vốn, lợi nhuận chỉ chủ cửa hàng thấy. |
| Chuyển khoản có tự xác nhận tiền về không? | Demo để thu ngân bấm xác nhận. Bản triển khai có thể nối thông báo biến động số dư của ngân hàng để tự xác nhận. |

---

## 4. Sau buổi demo

- [ ] Ghi lại yêu cầu khách nêu thêm vào `01-TONG-QUAN-NGHIEP-VU.md`
- [ ] Ghi lại số mặt hàng, số quầy, loại máy quét và khổ máy in (80 mm hay 58 mm) khách đang dùng
- [ ] Hỏi khách có bán hàng cân ký, bán chịu, cần hóa đơn điện tử không
- [ ] Xin file danh mục hàng hiện có (Excel hoặc xuất từ phần mềm cũ) để ước lượng công nhập liệu
- [ ] Gửi link demo và tài khoản `thungan`, `quanly` cho khách tự trải nghiệm (nếu đồng ý)
