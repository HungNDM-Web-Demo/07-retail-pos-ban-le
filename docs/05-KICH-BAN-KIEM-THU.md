# Kịch bản kiểm thử nghiệm thu — POS Cửa hàng Bán lẻ

> Test case theo use case trong `03-USE-CASE.md`. Phần nền (đăng nhập, phân quyền, đặt lại dữ liệu) dùng TC-SYS-01 đến TC-SYS-10 trong `ZDOCS/03-KIEN-TRUC/USE-CASE-NEN.md` §8.

---

## 1. Cách chạy

| Mục | Nội dung |
| :--- | :--- |
| Môi trường | Chạy cả hai chế độ: dữ liệu mẫu (`mock`) và BE thật (`api`) |
| Dữ liệu | Đặt lại dữ liệu demo trước mỗi test case, trừ khi cột "Các bước" ghi "Sau TC-xx" |
| Tài khoản | Theo cột "Vai trò" của từng test case, dùng "Đăng nhập nhanh" (`admin`, `quanly`, `thungan`) |
| Thiết bị | Test case vai trò Thu ngân chạy ở cửa sổ 1366×768; mã vạch gõ bằng bàn phím rồi Enter thay máy quét |
| Cài đặt | Mặc định: "Cho phép bán âm kho" bật, khổ in 80 mm, tiền đầu ca 500.000 ₫ |
| Đạt | Kết quả thực tế khớp toàn bộ cột "Kết quả mong đợi" |

**Dữ liệu mẫu dùng trong test**

| Mặt hàng | Đơn vị, mã vạch, giá bán | Giá vốn bình quân | Tồn | Ghi chú |
| :--- | :--- | :---: | :---: | :--- |
| Bia lager lon 330ml (`SP00012`) | Lon `8939010001214` 18.000 ₫; Lốc 6 `8939010001221` 105.000 ₫; Thùng 24 `8939010001238` 410.000 ₫ | 15.500 ₫/lon | 50 lon | Tồn tối thiểu 24; cho đổi trả |
| Mì gói tôm chua cay 75g (`SP00031`) | Gói `8939020003116` 4.500 ₫; Thùng 30 `8939020003123` 120.000 ₫ | 3.600 ₫/gói | 90 gói | Tồn tối thiểu 60 |
| Sữa tươi tiệt trùng có đường 180ml (`SP00045`) | Hộp `8939030004516` 8.000 ₫; Lốc 4 `8939030004523` 31.000 ₫; Thùng 48 `8939030004530` 360.000 ₫ | 6.500 ₫/hộp | 120 hộp | Quản lý hạn sử dụng; lô 1 nhập 40 ngày trước 96 hộp, còn 20 ngày hết hạn; lô 2 nhập 10 ngày trước 96 hộp, còn 150 ngày |
| Nước suối đóng chai 500ml (`SP00058`) | Chai `8939010005816` 5.000 ₫; Thùng 24 `8939010005823` 96.000 ₫ | 3.500 ₫/chai | 24 chai | Tồn tối thiểu 12 |
| Sữa bột trẻ em số 3 lon 850g (`SP00077`) | Hộp `8939030007715` 455.000 ₫ | 440.000 ₫/hộp | 6 hộp | Biên lãi 3,3%, đã tô cam |
| Trứng gà sạch hộp 10 quả (`SP00102`) | Hộp, mã nội bộ `2000000000015`, 32.000 ₫ | 27.000 ₫/hộp | 2 hộp | Tồn tối thiểu 5; không cho đổi trả |

Hóa đơn mẫu (ngày tính lùi từ hôm nay, ghi chú "HĐ mẫu A…E" để tìm nhanh):

| Hóa đơn | Ngày | Nội dung | Tổng thanh toán |
| :--- | :--- | :--- | :---: |
| HĐ A | 2 ngày trước | 1 Thùng 24 Bia lager 410.000 ₫ + 1 Thùng 30 Mì tôm chua cay 120.000 ₫; giảm hóa đơn 5% = 26.500 ₫ (phân bổ: bia 20.500 ₫, mì 6.000 ₫); giá vốn dòng bia 372.000 ₫, mì 108.000 ₫ | 503.500 ₫ |
| HĐ B | 1 ngày trước | 2 Lốc 4 sữa tươi 62.000 ₫ + 4 Hộp sữa tươi 32.000 ₫ + 1 hộp trứng 32.000 ₫; không giảm | 126.000 ₫ |
| HĐ C | 10 ngày trước | 1 Lốc 6 Bia lager | 105.000 ₫ |
| HĐ D | 35 ngày trước | 1 Thùng 30 Mì tôm chua cay | 120.000 ₫ |
| HĐ E | 3 ngày trước | 2 Thùng 24 Bia lager | 820.000 ₫ |

Ngoài ra dữ liệu mẫu có một lô sữa chua đã hết hạn để demo "Hủy lô": Sữa chua có đường hộp 100g (`SP00048`) tồn 60 hộp, lô nhập 40 ngày trước còn 12 hộp đã hết hạn 2 ngày, lô nhập 10 ngày trước 48 hộp còn 28 ngày. Mã vạch EAN-13 trong bảng là mã hư cấu (đầu `8939`), tên hàng là tên chung, không phải nhãn hiệu thật.

---

## 2. Test case

### 2.1. Hàng hóa

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-01 | UC-01 | Thêm mặt hàng có 2 đơn vị quy đổi | Chủ cửa hàng | 1. Hàng hóa → Thêm mặt hàng 2. Tên "Bia pilsner lon 330ml", nhóm Bia, nước giải khát, đơn vị Lon, mã `8939010030115`, giá 17.000 ₫, giá vốn ban đầu 14.000 ₫, tồn tối thiểu 24 3. Thêm Lốc 6, hệ số 6, mã `8939010030122`, giá 99.000 ₫; Thùng 24, hệ số 24, mã `8939010030139`, giá 390.000 ₫ 4. Lưu 5. Đổi sang Thu ngân, mở ca, quét `8939010030139` | Mã hàng tự sinh dạng `SP` + 5 số; biên lãi 17,6%; tồn 0, trạng thái Hết hàng; không có cảnh báo giá; ở màn bán hàng thêm dòng "Thùng 24" giá 390.000 ₫ |
| TC-02 | UC-01 | Mã vạch trùng | Chủ cửa hàng | 1. Thêm đơn vị Lốc 6 cho một mặt hàng mới với mã `8939010001221` 2. Lưu | Báo lỗi tại ô mã vạch "Mã đã dùng cho Bia lager lon 330ml – Lốc 6", không lưu |
| TC-03 | UC-01 | Giá đơn vị lớn đắt hơn mua lẻ, giá sai bội số | Chủ cửa hàng | 1. Sửa Bia lager, giá Thùng 24 đổi thành 450.000 ₫ 2. Lưu 3. Sửa giá Lon thành 17.200 ₫ 4. Lưu | Bước 2: cảnh báo "Mua theo đơn vị lớn đắt hơn mua lẻ" (giá tham khảo 432.000 ₫), vẫn lưu được; bước 4: báo lỗi giá phải là bội số 500 ₫ |
| TC-04 | UC-01 | Xóa mặt hàng đã bán | Chủ cửa hàng, Thu ngân | 1. Chọn Bia lager, bấm Xóa 2. Bật "Ngừng bán", lưu 3. Đổi sang Thu ngân, quét `8939010001214` | Bước 1 bị từ chối, gợi ý "Ngừng bán"; bước 3 báo "Hàng ngừng bán", không thêm dòng |

### 2.2. Ca làm

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-05 | UC-02 | Mở ca | Thu ngân | 1. Vào Bán hàng khi chưa có ca 2. Giữ tiền đầu ca 500.000 ₫ 3. Mở ca | Ca mới mã `CA{yyMMdd}{nn}` trạng thái Đang mở; con trỏ ở ô quét, quét được hàng |
| TC-06 | UC-02 | Bán và đổi trả khi chưa mở ca | Thu ngân | 1. Vào Bán hàng khi chưa có ca, đóng hộp Mở ca 2. Vào Đổi trả | Bước 1: ô quét và giỏ bị khóa, chỉ còn nút "Mở ca"; bước 2: nút "Tạo phiếu đổi trả" bị khóa, chú thích "Mở ca trước khi đổi trả" |
| TC-07 | UC-09 | Chốt ca khớp tiền | Thu ngân | 1. Mở ca 500.000 ₫ 2. Hóa đơn 1: 3 lon Bia lager, 5 gói mì, 1 hộp sữa tươi = 84.500 ₫, tiền mặt khách đưa 100.000 ₫ 3. Hóa đơn 2: 1 Thùng 24 Bia lager 410.000 ₫, chuyển khoản 4. Trả 1 Lốc 4 sữa của HĐ B, hoàn tiền mặt 31.000 ₫ 5. Chốt ca, nhập tiền đếm 553.500 ₫ | Tổng hợp: 2 hóa đơn, tiền mặt 84.500 ₫, chuyển khoản 410.000 ₫, thẻ 0 ₫, 1 phiếu đổi trả, hoàn tiền mặt 31.000 ₫, tiền mặt lý thuyết 553.500 ₫, chênh lệch 0 ₫; ca "Đã chốt"; mở bản in báo cáo ca |
| TC-08 | UC-09 | Chốt ca lệch quá 20.000 ₫ | Thu ngân | 1. Như TC-07, bước 5 nhập tiền đếm 530.000 ₫ 2. Bấm xác nhận không ghi chú 3. Nhập ghi chú, xác nhận | Chênh lệch −23.500 ₫ màu đỏ; bước 2 bị chặn, yêu cầu ghi chú; sau bước 3 ca "Cần kiểm tra" |
| TC-09 | UC-09 | Chốt ca lệch trong ngưỡng | Thu ngân | 1. Như TC-07, bước 5 nhập tiền đếm 540.000 ₫ 2. Xác nhận không ghi chú | Chênh lệch −13.500 ₫ màu xanh; chốt được không cần ghi chú; ca "Đã chốt" |
| TC-10 | UC-09 | Chốt ca còn hóa đơn chờ | Thu ngân | 1. Quét 1 lon bia ở tab 1, F6 mở tab 2, quét 1 gói mì 2. Bấm Chốt ca | Hệ thống liệt kê 2 hóa đơn chờ, yêu cầu thanh toán hoặc xóa trước khi chốt |
| TC-11 | UC-10 | Chủ cửa hàng xử lý ca lệch | Chủ cửa hàng | 1. Sau TC-08, mở Danh sách ca 2. Lọc "Cần kiểm tra" 3. Mở ca, nhập ghi chú, bấm "Đã kiểm tra" | Ca vừa chốt có nhãn đỏ, chi tiết có 2 hóa đơn và 1 phiếu đổi trả; sau bước 3 chuyển "Đã kiểm tra", ghi chú lưu lại |
| TC-12 | UC-10 | Thu ngân xem danh sách ca | Thu ngân | 1. Gõ thẳng URL `/shifts` | Chuyển tới `/forbidden` |

### 2.3. Bán hàng

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-13 | UC-03 | Mỗi mã vạch ra đúng đơn vị | Thu ngân | 1. Mở ca 2. Quét `8939010001214`, `8939010001221`, `8939010001238` | 3 dòng: Lon 18.000 ₫, Lốc 6 105.000 ₫, Thùng 24 410.000 ₫; tổng 533.000 ₫ |
| TC-14 | UC-03 | Cộng dồn khi quét lại và tiền tố `n*` | Thu ngân | 1. Quét mã lon Bia lager 2 lần 2. Gõ `12*`, quét `8939020003116` 3. Quét `8939020003116` lần nữa | Bước 1: một dòng Lon SL 2, 36.000 ₫; bước 2: dòng Gói SL 12, 54.000 ₫; bước 3: dòng Gói SL 13, 58.500 ₫ (tiền tố không áp lại); tổng 94.500 ₫ |
| TC-15 | UC-03 | Mã không tồn tại | Thu ngân | 1. Quét `8930000000000` | Âm báo lỗi, thông báo "Không tìm thấy mã vạch 8930000000000"; giỏ không đổi; ô quét trống, con trỏ vẫn ở ô quét |
| TC-16 | UC-03 | Đổi đơn vị của dòng | Thu ngân | 1. Quét mã lon Bia lager 2. Ở dòng vừa thêm, đổi đơn vị sang Thùng 24 | Dòng còn SL 1, đơn vị Thùng 24, thành tiền 410.000 ₫ |
| TC-17 | UC-03 | Tìm theo tên không dấu | Thu ngân | 1. F2, gõ "tom chua cay" 2. Chọn dòng "Thùng 30" | Gợi ý có "Mì gói tôm chua cay 75g – Gói 4.500 ₫" và "– Thùng 30 120.000 ₫"; giỏ thêm dòng Thùng 30 giá 120.000 ₫ |
| TC-18 | UC-03 | Nhiều hóa đơn chờ | Thu ngân | 1. Tab 1 quét 2 mặt hàng 2. F6, tab 2 quét 1 mặt hàng 3. Tải lại trang 4. Mở thêm tab tới khi F6 lần thứ 5 | Sau bước 3 cả 2 tab còn nguyên dòng; khi đã có 5 tab, F6 báo "Tối đa 5 hóa đơn chờ" |
| TC-19 | UC-03 | Bán vượt tồn | Thu ngân, Quản trị viên | 1. Quét trứng gà (`2000000000015`) 3 lần 2. Thanh toán tiền mặt 3. Đổi sang Quản trị viên, tắt "Cho phép bán âm kho"; đổi lại Thu ngân, quét trứng gà 1 lần | Bước 1: dòng tô cam "Vượt tồn 1 hộp"; bước 2 thanh toán được, tồn trứng −1, trạng thái Âm kho; bước 3 dòng tô cam, nút Thanh toán bị khóa |
| TC-20 | UC-04 | Kiểm tra giá | Thu ngân | 1. Quét 1 gói mì vào giỏ 2. F3, quét `8939010001238` 3. Esc | Hộp hiện Bia lager lon 330ml: Lon 18.000 ₫, Lốc 6 105.000 ₫, Thùng 24 410.000 ₫, tồn "2 thùng 2 lon"; giỏ vẫn chỉ có 1 gói mì |

### 2.4. Giảm giá

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-21 | UC-05 | Giảm phần trăm, làm tròn | Thu ngân | 1. Giỏ: 3 lon Bia lager 54.000 ₫, 5 gói mì 22.500 ₫, 1 hộp sữa tươi 8.000 ₫ (tổng 84.500 ₫) 2. F8, giảm hóa đơn 5%, lý do Khách quen | Giảm 4.000 ₫ (4.225 làm tròn xuống bội số 500); tổng 80.500 ₫; không cần xác nhận |
| TC-22 | UC-05 | Giảm vượt hạn mức 5% | Thu ngân, Chủ cửa hàng | 1. Giỏ 1 Thùng 24 Bia lager 410.000 ₫ 2. Giảm hóa đơn 30.000 ₫ 3. Hộp xác nhận hiện, nhập tài khoản `quanly` | Hộp ghi "Giảm 7,3%, vượt hạn mức 5%"; sau bước 3 tổng 380.000 ₫, hóa đơn ghi người xác nhận "quanly" |
| TC-23 | UC-05 | Giảm trong hạn mức nhưng thấp hơn giá vốn | Thu ngân, Chủ cửa hàng | 1. Giỏ 1 hộp sữa bột số 3 455.000 ₫ 2. Giảm hóa đơn 4% | Giảm 18.000 ₫ (18.200 làm tròn xuống), tổng 437.000 ₫ thấp hơn giá vốn 440.000 ₫; hộp xác nhận ghi "Thấp hơn giá vốn 3.000 ₫"; chưa xác nhận thì không áp |
| TC-24 | UC-05 | Xác nhận bằng tài khoản không đủ quyền | Thu ngân | 1. Như TC-22, bước 3 nhập tài khoản `thungan` | Từ chối, tổng giữ nguyên 410.000 ₫ |

### 2.5. Thanh toán

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-25 | UC-06 | Thanh toán tiền mặt bằng mức gợi ý | Thu ngân, Chủ cửa hàng | 1. Giỏ như TC-21 bước 1 (84.500 ₫) 2. F9 3. Bấm 100.000 ₫, Enter 4. Đổi sang Chủ cửa hàng xem Tồn kho và chi tiết hóa đơn | Gợi ý: 84.500 ₫, 90.000 ₫, 100.000 ₫, 500.000 ₫; tiền thối 15.500 ₫; thông báo "Đã mở két"; mã `HD{yyMMdd}{nnnn}`; bản in có mã vạch của mã hóa đơn; tồn Bia lager 47, mì 85, sữa tươi 119; giá vốn dòng 46.500 ₫, 18.000 ₫, 6.500 ₫, tổng giá vốn 71.000 ₫ |
| TC-26 | UC-06 | Tiền khách đưa không đủ | Thu ngân | 1. Giỏ 84.500 ₫ 2. Nhập tiền khách đưa 80.000 ₫ | Nút Hoàn tất khóa, hiện "Còn thiếu 4.500 ₫" |
| TC-27 | UC-06 | Trừ tồn theo đơn vị lớn, chuyển trạng thái sắp hết | Thu ngân, Chủ cửa hàng | 1. Bán 1 Thùng 24 Bia lager, tiền mặt 2. Bán 3 lon Bia lager 3. Đổi sang Chủ cửa hàng, mở Tồn kho, lịch sử biến động Bia lager | Sau bước 1 tồn 26 lon, đọc "1 thùng 2 lon", Còn hàng; sau bước 2 tồn 23, Sắp hết; lịch sử có 2 dòng bán: −24 (tồn sau 26), −3 (tồn sau 23) |
| TC-28 | UC-06 | Chuyển khoản và thẻ | Thu ngân | 1. Giỏ 1 Thùng 24 Bia lager, chọn Chuyển khoản, bấm "Đã nhận tiền" 2. Giỏ 1 Thùng 30 mì, chọn Thẻ, bấm "Đã quẹt thành công" | Bước 1: QR hiện số tiền 410.000 ₫, nội dung là mã hóa đơn; hóa đơn lưu phương thức Chuyển khoản; bước 2 lưu phương thức Thẻ 120.000 ₫; cả hai không có thông báo mở két |
| TC-29 | UC-06 | Bấm Hoàn tất hai lần liên tiếp (chế độ `api`) | Thu ngân | 1. Giỏ 1 lon Bia lager, thanh toán tiền mặt 2. Bấm Hoàn tất hai lần thật nhanh | Chỉ một hóa đơn được tạo; tồn Bia lager giảm đúng 1 |

### 2.6. Đổi trả

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-30 | UC-07 | Trả hàng của hóa đơn có giảm giá | Thu ngân | 1. Mở ca 2. Đổi trả → Tạo phiếu, nhập mã HĐ A 3. Trả 1 Thùng 24 Bia lager, tình trạng Bán lại được, lý do Khách đổi ý 4. Hoàn tiền mặt, Hoàn tất | Tiền hoàn 389.500 ₫ (410.000 − 20.500 phân bổ); phiếu `TH{yyMMdd}{nnnn}`; tồn Bia lager 74 lon, đọc "3 thùng 2 lon"; giá vốn bình quân giữ 15.500 ₫; HĐ A trạng thái "Đã trả một phần" |
| TC-31 | UC-07 | Đổi hàng, khách trả thêm | Thu ngân | 1. Tạo phiếu đổi trả cho HĐ B 2. Trả 1 Lốc 4 sữa tươi, Bán lại được 3. Thêm hàng đổi: quét `8939010001221` (Lốc 6 Bia lager) 4. Thanh toán tiền mặt khách đưa 100.000 ₫ | Chênh lệch 74.000 ₫ khách trả thêm, tiền thối 26.000 ₫; tạo phiếu đổi trả (hoàn 31.000 ₫, phương thức Bù trừ đổi hàng) và hóa đơn mới 105.000 ₫ (Bù trừ 31.000 ₫ + tiền mặt 74.000 ₫); tồn sữa tươi 124, Bia lager 44 |
| TC-32 | UC-07 | Trả hàng lỗi | Thu ngân, Chủ cửa hàng | 1. Tạo phiếu cho HĐ B 2. Trả 2 Hộp sữa tươi, tình trạng Hàng lỗi, lý do "Phồng hộp" 3. Hoàn tất 4. Đổi sang Chủ cửa hàng, xem báo cáo Đổi trả và hàng lỗi | Tiền hoàn 16.000 ₫; tồn sữa tươi giữ 120; sổ hàng lỗi có 2 hộp, giá trị 13.000 ₫; dòng Hộp của HĐ B còn trả được 2 |
| TC-33 | UC-07 | Hàng không cho đổi trả | Thu ngân | 1. Tạo phiếu cho HĐ B | Dòng trứng gà mờ, chú thích "Hàng không đổi trả", không chọn được |
| TC-34 | UC-07 | Hóa đơn quá 7 ngày và quá 30 ngày | Thu ngân, Chủ cửa hàng | 1. Tạo phiếu cho HĐ C, trả 1 Lốc 6 Bia lager 2. Hộp xác nhận hiện, nhập `quanly`, hoàn tất 3. Tạo phiếu cho HĐ D | Bước 1 hiện "Hóa đơn 10 ngày, cần chủ cửa hàng xác nhận"; bước 2 lưu được, hoàn 105.000 ₫, phiếu ghi người xác nhận; bước 3 báo "Hóa đơn đã quá 30 ngày, không nhận đổi trả" |
| TC-35 | UC-07 | Tiền hoàn trên 500.000 ₫ | Thu ngân | 1. Tạo phiếu cho HĐ E, trả 2 Thùng 24 Bia lager 2. Bấm Hoàn tất | Tiền hoàn 820.000 ₫; hộp "Chủ cửa hàng xác nhận" hiện, chưa xác nhận thì không lưu |
| TC-36 | UC-07 | Trả vượt số lượng đã mua | Thu ngân | 1. Tạo phiếu cho HĐ B 2. Dòng Lốc 4 sữa tươi nhập số lượng trả 3 | Ô báo đỏ "Tối đa 2", nút Hoàn tất khóa |

### 2.7. Tồn kho và nhập hàng

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-37 | UC-12 | Đọc tồn quy đổi và lô sắp hết hạn | Chủ cửa hàng | 1. Mở Tồn kho, tìm sữa tươi 2. Tab Sắp hết hạn | Sữa tươi tồn 120, đọc "2 thùng 6 lốc", giá trị tồn 780.000 ₫; tab Sắp hết hạn có lô 1 còn 20 ngày, số lượng còn lại ước tính 24 hộp; lô 2 không có trong danh sách |
| TC-38 | UC-13 | Hủy hàng hết hạn bằng phiếu điều chỉnh | Chủ cửa hàng | 1. Ở lô 1 sữa tươi bấm "Hủy lô" 2. Số lượng thực tế 96, lý do Hết hạn 3. Lưu | Chênh lệch −24 hộp, giá trị −156.000 ₫; phiếu `DC{yyMMdd}{nnn}`; tồn 96, đọc "2 thùng"; giá vốn giữ 6.500 ₫; lô 1 không còn trong tab Sắp hết hạn |
| TC-39 | UC-14 | Nhập hàng, tính giá vốn bình quân | Chủ cửa hàng | 1. Nhập hàng → Tạo phiếu, chọn nhà cung cấp 2. Quét `8939020003123`, số lượng 5 Thùng 30, đơn giá 114.000 ₫ 3. Xác nhận nhập kho | Thành tiền 570.000 ₫; tồn mì 240 gói, đọc "8 thùng"; giá vốn mới 3.725 ₫ = (90 × 3.600 + 150 × 3.800) ÷ 240; lịch sử biến động có dòng +150, giá vốn sau 3.725 ₫; mì không có trong danh sách biên lãi thấp (17,2%) |
| TC-40 | UC-14 | Cảnh báo biên lãi dưới 5% sau nhập | Chủ cửa hàng | 1. Tạo phiếu nhập 10 Thùng 24 nước suối, đơn giá 117.600 ₫ 2. Xác nhận nhập kho 3. Ở danh sách cảnh báo, sửa giá Chai thành 5.500 ₫, lưu | Giá vốn mới 4.773 ₫ = (24 × 3.500 + 240 × 4.900) ÷ 264, làm tròn; biên lãi 4,5%, nước suối có trong danh sách cảnh báo; sau bước 3 biên lãi 13,2%, hết tô cam |
| TC-41 | UC-14 | Thiếu hạn sử dụng, sửa phiếu đã nhập | Chủ cửa hàng | 1. Tạo phiếu nhập 1 Thùng 48 sữa tươi, để trống hạn sử dụng, bấm Xác nhận 2. Nhập hạn sử dụng, xác nhận 3. Mở lại phiếu | Bước 1 báo lỗi tại ô hạn sử dụng, không nhập kho; bước 2 thành công; bước 3 phiếu chỉ xem, không có nút Sửa, Xóa |

### 2.8. Tổng quan và báo cáo

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-42 | UC-11 | Tổng quan cập nhật theo hóa đơn mới | Chủ cửa hàng, Thu ngân | 1. Ghi lại các thẻ số hôm nay 2. Đổi sang Thu ngân, bán 1 Thùng 24 Bia lager, giảm 20.000 ₫, tiền mặt 3. Quay lại Tổng quan | Doanh thu thuần tăng 390.000 ₫, lợi nhuận gộp tăng 18.000 ₫, số hóa đơn tăng 1 |
| TC-43 | UC-11 | Thu ngân không thấy doanh thu | Thu ngân | 1. Đăng nhập nhanh vai trò Thu ngân | Vào thẳng màn Bán hàng; không có thẻ doanh thu, lợi nhuận; không có menu Báo cáo, Tồn kho |
| TC-44 | UC-15 | Trả hàng giảm doanh thu ngày trả, không sửa ngày bán | Chủ cửa hàng | 1. Sau TC-30, mở Báo cáo, khoảng Hôm nay 2. Xem ngày của HĐ A (2 ngày trước) | Hôm nay: tiền hoàn 389.500 ₫, doanh thu thuần giảm 389.500 ₫, giá vốn hàng bán thuần giảm 372.000 ₫, lợi nhuận gộp giảm 17.500 ₫; số liệu ngày của HĐ A không đổi |
| TC-45 | UC-15 | Lợi nhuận theo nhóm khớp tổng | Chủ cửa hàng | 1. Báo cáo, 30 ngày, tab Doanh thu, ghi tổng lợi nhuận gộp 2. Tab Lợi nhuận theo nhóm | Tổng lợi nhuận gộp các nhóm bằng số ở tab Doanh thu; biên lãi gộp mỗi nhóm = lợi nhuận gộp ÷ doanh thu thuần của nhóm |

---

## 3. Biên bản chạy thử

| Ngày | Người test | Chế độ | Số TC đạt / tổng | Lỗi ghi nhận |
| :--- | :--- | :--- | :---: | :--- |
| 16/10/2026 | Claude (kiểm thử tự động trên trình duyệt) | `api` (BE .NET 8 + Postgres, FE 3107) | 37 / 45 | Đạt: TC-01…05, 07…09, 11…14, 16, 19, 22…25, 27…45; TC-06 mới kiểm bước 1. Chưa chạy ở `api` (logic tại máy, giống `mock`): TC-06 bước 2, 10, 15, 17, 18, 20, 21, 26. Kèm: đăng nhập form `admin`/`quanly`/`thungan` vào đúng trang chủ, HĐ mẫu A–E đúng số, 89 ngày doanh thu thuần 679.117.231 ₫ / lãi gộp 111.564.831 ₫, âm kho 1, in tem, xuất Excel, bản in 58 mm. Lỗi đã sửa: (1) tắt bán âm kho mà còn dòng vượt tồn, nút Thanh toán không khóa (chỉ chặn khi bấm); (2) dòng vượt tồn đang chọn mất nền cam; (3) bản in 58 mm có dòng chữ 10,1 px (< 11 px, NFR-05); (4) lỗi theo trường không có ô trên form (phiếu nhập `lines[i].unitId`, điều chỉnh `goodsReceiptLineId`, hàng hóa `imageUrl`/`status`) bị nuốt, nay hiện toast; (5) BE bỏ qua sắp xếp nhà cung cấp theo số phiếu, tổng tiền, lần nhập cuối (thêm test BE) |
| 16/10/2026 | Claude (kiểm thử tự động trên trình duyệt) | `mock` | 3 / 3 | Kiểm lại phần đã sửa: TC-19 bước 1–2 (nền cam, thanh toán được), TC-43, TC-45 (lợi nhuận theo nhóm tháng trước khớp BE từng nhóm, sau khi mock lưu `groupId` trên dòng hóa đơn); thẻ tổng quan hôm nay khớp BE. Các TC khác không chạy lại |
