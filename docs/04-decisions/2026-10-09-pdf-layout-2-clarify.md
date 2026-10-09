# Bố cục PDF đợt 2 — quyết định clarify (147)

- Ngày: 2026-10-09
- Feature: `147-pdf-layout` (issue #147) — intake `docs/intake/147-pdf-layout.md`; tiếp nối 112 (`2026-10-07-pdf-layout.md`, mục "Giới hạn").
- Người quyết định: Hải (2026-10-09). 4 câu hỏi trực tiếp (#10, #18, #22, #25) chọn phương án khuyên dùng; 23 mục còn lại nhận theo đề xuất của intake.
- Kế thừa, không hỏi lại: quy ước bảng Markdown của 112 (`| a | b |` + hàng phân cách `|---|`), "thà bỏ sót còn hơn nhận nhầm", cơ chế "Xử lý lại"
  từng nguồn (112), ngân sách hiệu năng ≤ 2× (112 SC-006).

## (b) Bảng cột số căn phải

1. **Đường phụ** "căn phải / thập phân" chỉ chạy khi đường căn trái hiện có từ chối cụm dòng; tách hàm thuần `detectRightAlignedTable(region)`; giữ nguyên
   test cũ. Nhận diện theo nội dung có thể (thay thế toàn bộ) để dành nếu số đo cho thấy bỏ sót nhiều.
2. **Cột số**: ô "trông như số" (regex nhận cả `1.234,5` lẫn `1,234.5`, ngoặc âm, %, đơn vị tiền phổ biến — không đoán locale); căn **mép phải** dung sai
   0,5·h, hoặc **dấu thập phân** khi mép phải không khớp; cột số khi ≥ 80% ô là số.
3. **Ngưỡng**: ≥ 3 hàng dữ liệu, ≥ 2 cột, (≥ 2 cột số HOẶC 1 cột số ≥ 4 hàng), mép phải khớp ≥ 90%, không phải dãy số nguyên đơn điệu (chống mục lục);
   giữ các loại trừ hiện có (chấm dẫn, bullet, ô dài). Ngưỡng cuối chốt bằng số đo trên bộ mẫu dương / âm.
4. **Cột sát nhau**: best-effort (không tách lại segment) — ghi "Giới hạn"; **tiêu đề** gán cột theo chồng lấn khoảng x với cột số; tiêu đề nhiều dòng theo quy tắc
   "phần tiếp của ô" hiện có.
5. **Hàng đặc biệt**: hàng tổng / gạch là hàng thường; chú thích dưới bảng là văn bản; ô gộp vẫn "Giới hạn"; thêm fixture bảng tài chính (4 cột số, hàng tổng,
   ngoặc âm, tiêu đề 2 dòng).

## (e) Lưới bảng trong Trình xem nguồn

6. **Nguồn dữ liệu**: phân tích lại bảng Markdown từ văn bản nguồn bằng hàm thuần dùng chung (`src/shared/pdf-tables.ts`), cổng chặt: chỉ PDF, khối ≥ 3 dòng
   bắt đầu / kết thúc bằng `|`, dòng 2 là hàng phân cách, số ô mọi dòng bằng nhau, không vắt ranh giới trang. **Không đổi IPC, không migration, không đổi
   phiên bản trích xuất** — có ngay với PDF đã nạp (v2).
7. **Phạm vi**: chỉ PDF (mở rộng sang `md` để sau).
8. **Tô sáng**: theo **ký tự trong ô** (chính xác tuyệt đối), tô cả ô khi vùng phủ hết ô; ánh xạ offset → ô là hàm thuần có test thuộc tính.
9. **Trợ năng**: `<table>` + `<thead>` / `<th scope="col">` hàng đầu + `<tbody>`, tên đọc "Bảng {i} — trang {page}"; giữ `<mark>` + nhãn `[n]`; bảng tràn ngang ⇒
   vùng cuộn `tabindex=0` có nhãn (chốt ở plan).
10. **Công tắc "Dạng lưới / Dạng văn bản"** trên thanh trình xem (nhớ trong phiên), mặc định lưới — lối thoát khi bảng nhận sai và để đối chiếu đúng văn bản đã trích
    dẫn. Chọn – sao chép trong lưới theo hành vi bảng chuẩn (không xuất Markdown).
11. **Bố cục**: căn phải ô số khi hiển thị (không đổi văn bản / quy ước 112); bảng rộng ⇒ cuộn ngang, không thu nhỏ chữ; kiểu (viền mảnh, hàng đầu đậm) chốt bằng
    ảnh chụp 900 px.

## (c) Trang `/Rotate`

12. Áp xoay **tại adapter** PDF bằng biến đổi viewport của pdf.js (đã chuẩn hoá `/Rotate` thừa kế và CropBox); phần dựng bố cục giữ thuần; thí nghiệm xác nhận với
    fixture 90 / 180 / 270.
13. Sau chuẩn hoá: chữ lộn ngược 180° và góc lẻ coi là "xoay" (nối thô cuối trang như 112) ở v1; chỉ trang mà `/Rotate` làm chữ hiển thị thẳng mới được dựng bố cục.
    Test: cùng nội dung ở 0 / 90 / 180 / 270 ⇒ văn bản bằng nhau (khi hiển thị thẳng).
14. Chỉ PDF có lớp chữ (kể cả lớp chữ ẩn trên trang quét); PDF thuần ảnh / OCR cho PDF: **ngoài phạm vi**.
15. Lệch gốc CropBox được sửa theo luôn (tự đúng khi dùng viewport) + test; ghi ADR là thay đổi hành vi so với 112 (thuộc phiên bản mới).

## (a) Gạch nối cuối dòng

16. Cây quyết định chỉ **giữ gạch** khi chắc chắn (luật "chắc": từ ghép có bằng chứng trong tài liệu, tiền tố / số / chữ hoa đã có, tiếng Việt); còn lại giữ hành vi
    cũ (nối bỏ gạch). Không dùng từ điển / danh sách cố định ở v1. Đo tỉ lệ đúng / sai trên tập cặp từ gắn nhãn, ghi ADR.
17. **Bằng chứng theo tài liệu**: tiền quét tập từ (không lưu item) — chỉ khi tài liệu có ngắt dòng bằng gạch; nếu vượt ngân sách 2× ⇒ tập từ trượt (một lượt);
    cả dạng nối và dạng gạch cùng có bằng chứng ⇒ không chắc (mặc định).
18. **Tiếng Việt: GIỮ GẠCH, NỐI LIỀN** ("hợp-đồng", "Bà Rịa-Vũng Tàu") — nhận diện theo ký tự tiếng Việt trong token; sửa test cũ `hợpđồng` → `hợp-đồng` (thay đổi
    hành vi có chủ đích, ghi ADR); ngôn ngữ khác theo luật chung ("Giới hạn").
19. Nhận thêm U+2010 / U+2011, gạch treo, gạch trong ô bảng; không xử lý gạch vắt cột / trang ("Giới hạn").
20. Đo bằng tập cặp từ gắn nhãn Anh + Việt + test FTS đơn vị ("long-term" khớp "long term" và "long-term"); thêm PDF vào bộ đánh giá truy xuất ⇒ **issue riêng**.

## Xuyên suốt

21. **Tăng `PDF_EXTRACTION_VERSION` một lần** (2 → 3) cho (b) + (c) + (a); (e) không tăng. Quy tắc: chỉ tăng khi văn bản trích xuất của cùng một PDF có thể đổi; giao
    nhiều PR thì PR trích xuất đầu tiên tăng, PR sau cùng đợt phát hành dùng lại.
22. **Gợi ý "Xử lý lại" theo phiên bản**: PDF v1 ⇒ câu cũ "giữ bố cục"; PDF v2 ⇒ "cải thiện bảng, trang xoay và gạch nối". Không xử lý lại hàng loạt (giữ 112 #10) —
    "Giới hạn đã biết" + issue riêng "Xử lý lại hàng loạt". Hộp xác nhận nêu rõ trích dẫn cũ như 112.
23. **Bộ PDF mẫu**: fixture tự sinh, tất định, commit được (bảng tài chính căn phải, căn thập phân, trang 90 / 180 / 270, từ ghép có gạch, mẫu âm: mục lục không chấm dẫn,
    danh sách nhãn – giá trị, đoạn căn đều, khối chữ ký); chỉ tiêu: bảng dương đúng ô 100%, mẫu âm 0 nhận nhầm, xoay ⇒ văn bản bằng tham chiếu, gạch nối nhóm "chắc"
    ≥ 95% đúng và không kém hành vi cũ trên toàn tập. PDF thật (tuỳ chọn) ghi số vào ADR.
24. **Hiệu năng**: mở rộng mẫu đo 50 trang có đủ bảng số, trang xoay, gạch nối; giữ ≤ 2× (assert chặt local, CI chỉ ghi log như hiện nay); đo PDF thật lớn thủ công.
25. **Giao: một spec, 4 PR theo thứ tự (e) → (c) → (b) → (a)**; phiên bản tăng một lần theo #21; gợi ý "Xử lý lại" (#22) đi cùng PR trích xuất cuối trước khi phát hành.
26. **Dự phòng theo hạng mục**: `try/catch` cục bộ quanh từng hạng mục mới (lỗi ⇒ quay về kết quả cũ của trang / quy tắc mặc định / hệ chưa xoay); không cờ cấu hình,
    không UI; test chèn lỗi; nhật ký chỉ mã (không nội dung).
27. Không thêm dấu hiệu "bảng nhận ở phiên bản mới" — gợi ý "Xử lý lại" là đủ.
