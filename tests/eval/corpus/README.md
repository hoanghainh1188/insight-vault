# Bộ tài liệu đánh giá truy xuất (108)

Bộ tài liệu tiếng Việt công khai, **được phép tái phân phối**, dùng cho công cụ đo `npm run eval:retrieval`
(xem `tests/eval/README.md`). Không đóng gói vào bản cài (chỉ `out/**` được đóng gói).

Lấy ngày 2026-10-07 qua MediaWiki API (`prop=extracts`, văn bản thuần). Siêu dữ liệu đầy đủ (URL, giấy phép,
`revisionId` để tái lập đúng phiên bản) nằm trong [`manifest.json`](manifest.json).

## Nguồn và giấy phép

| Tệp                      | Nguồn                                                                                                   | Giấy phép                                                                                    | Vai trò    |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------- |
| `vinh-ha-long.md`        | Wikipedia tiếng Việt — [Vịnh Hạ Long](https://vi.wikipedia.org/wiki/V%E1%BB%8Bnh_H%E1%BA%A1_Long)       | CC BY-SA 4.0                                                                                 | có câu hỏi |
| `pho.md`                 | Wikipedia tiếng Việt — [Phở](https://vi.wikipedia.org/wiki/Ph%E1%BB%9F)                                 | CC BY-SA 4.0                                                                                 | có câu hỏi |
| `ao-dai.md`              | Wikipedia tiếng Việt — [Áo dài](https://vi.wikipedia.org/wiki/%C3%81o_d%C3%A0i)                         | CC BY-SA 4.0                                                                                 | có câu hỏi |
| `ho-hoan-kiem.md`        | Wikipedia tiếng Việt — [Hồ Hoàn Kiếm](https://vi.wikipedia.org/wiki/H%E1%BB%93_Ho%C3%A0n_Ki%E1%BA%BFm)  | CC BY-SA 4.0                                                                                 | có câu hỏi |
| `song-me-kong.md`        | Wikipedia tiếng Việt — [Mê Kông](https://vi.wikipedia.org/wiki/M%C3%AA_K%C3%B4ng)                       | CC BY-SA 4.0                                                                                 | có câu hỏi |
| `luat-quoc-tich-2008.md` | Wikisource tiếng Việt — Luật Quốc tịch Việt Nam 2008                                                    | Văn bản quy phạm pháp luật — không thuộc đối tượng bảo hộ quyền tác giả (Luật SHTT, Điều 15) | có câu hỏi |
| `luat-pccc-2001.md`      | Wikisource tiếng Việt — Luật Phòng cháy và chữa cháy 2001                                               | như trên                                                                                     | có câu hỏi |
| `luat-bvmt-1993.md`      | Wikisource tiếng Việt — Luật Bảo vệ môi trường 1993                                                     | như trên                                                                                     | có câu hỏi |
| `quang-hop.md`           | Wikipedia tiếng Việt — [Quang hợp](https://vi.wikipedia.org/wiki/Quang_h%E1%BB%A3p)                     | CC BY-SA 4.0                                                                                 | **nhiễu**  |
| `he-mat-troi.md`         | Wikipedia tiếng Việt — [Hệ Mặt Trời](https://vi.wikipedia.org/wiki/H%E1%BB%87_M%E1%BA%B7t_Tr%E1%BB%9Di) | CC BY-SA 4.0                                                                                 | **nhiễu**  |
| `bong-da.md`             | Wikipedia tiếng Việt — [Bóng đá](https://vi.wikipedia.org/wiki/B%C3%B3ng_%C4%91%C3%A1)                  | CC BY-SA 4.0                                                                                 | **nhiễu**  |

**Ghi công (CC BY-SA 4.0):** nội dung các bài Wikipedia thuộc về các tác giả của Wikipedia tiếng Việt (xem lịch sử
sửa đổi của từng bài theo `revisionId` trong `manifest.json`). **Thay đổi đã làm:** chuyển sang văn bản thuần và bỏ các
mục cuối bài _Tham khảo, Chú thích, Liên kết ngoài, Xem thêm, Đọc thêm, Ghi chú, Nguồn, Thư mục_; phần thân bài giữ
nguyên. Các tệp này được phân phối lại theo cùng giấy phép CC BY-SA 4.0
(<https://creativecommons.org/licenses/by-sa/4.0/>).

Văn bản luật là phiên bản **lịch sử** (có thể đã được sửa đổi/thay thế) — chỉ dùng làm dữ liệu đo, không phải tư vấn
pháp lý.

## Quy tắc

- Không sửa tay nội dung tài liệu: trích đoạn đáp án trong `../questions.json` phải khớp **nguyên văn** (công cụ đo
  kiểm trước khi chạy). Muốn đổi tài liệu ⇒ tăng `datasetVersion` và duyệt lại bộ câu hỏi.
- Tài liệu **nhiễu** (`noise: true`) không câu hỏi nào trỏ tới — mô phỏng notebook nhiều chủ đề.
