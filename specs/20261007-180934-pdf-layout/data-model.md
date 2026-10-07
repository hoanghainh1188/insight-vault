# Data model — 112 pdf-layout

## Source (SQLite `source`) — migration #9

| Trường mới           | Kiểu                       | Ý nghĩa                                                          |
| -------------------- | -------------------------- | ---------------------------------------------------------------- |
| `extraction_version` | INTEGER NOT NULL DEFAULT 1 | Cách trích đã dùng cho văn bản/chunk hiện tại. PDF bố cục = `2`. |

- Kiểu `Source` (shared) thêm `extractionVersion: number`.
- Hằng `PDF_EXTRACTION_VERSION = 2` (main + shared để renderer quyết định hiện gợi ý).
- Nguồn cũ (mọi loại) mặc định `1`. PDF thêm mới / xử lý lại ghi `2`. Loại khác không đổi (giữ `1`).
- **Gợi ý "Xử lý lại để giữ bố cục"**: `kind === "pdf" && extractionVersion < PDF_EXTRACTION_VERSION`.

## LayoutItem (hàm thuần — `src/main/services/ingestion/pdf-layout/`)

| Trường    | Kiểu    | Ghi chú                                                     |
| --------- | ------- | ----------------------------------------------------------- |
| `text`    | string  | `TextItem.str` (đã chuẩn hoá NFC ở bước clean như hiện nay) |
| `x`, `y`  | number  | góc trên-trái theo điểm PDF, gốc trên-trái trang            |
| `w`, `h`  | number  | rộng, cao (h = cỡ chữ hiệu dụng)                            |
| `rotated` | boolean | ma trận có thành phần xoay                                  |

`PageGeometry { width, height }`.

## Kết quả bố cục một trang

`layoutPage(items, geometry) → { text: string; blocks: { start: number; end: number }[]; fallback: boolean }`

- `text`: văn bản trang đã dựng (dòng/đoạn/cột/bảng Markdown), ở dạng cố định của `cleanText`.
- `blocks`: khoảng ký tự của từng bảng trong `text` (dùng cho chunker).
- `fallback`: `true` khi trang dùng cách nối cũ (lỗi / vượt `MAX_LAYOUT_ITEMS_PER_PAGE`).

## PageText (chunker) — mở rộng tương thích ngược

`{ page: number | null; text: string; blocks?: { start: number; end: number }[] }` — chỉ parser PDF bố cục điền `blocks`.

## Chunk

Không đổi schema. Khi xử lý lại: chunk mới có **id mới** (uuid sinh trước để ghi vector trước khi hoán đổi SQLite).

## SourceProgressEvent — mở rộng

Thêm `reprocess?: true` cho sự kiện của một lần xử lý lại (trạng thái nguồn vẫn `ready` trong lúc chạy); bước `parse`
kèm tiến độ theo trang.

## SourceContent (viewer) — mở rộng

Thêm `citationValid?: boolean` — chỉ có khi yêu cầu kèm `chunkId`; `false` ⇒ trích dẫn cũ (nguồn đã xử lý lại).

## Trạng thái một lần xử lý lại

```text
requested ──(vault lock / không phải PDF / đang xử lý)──▶ blocked
requested ──(tệp mất)──▶ missing (→ luồng Chọn lại tệp gốc 101)
requested ──(hash khác)──▶ mismatch (chặn)
requested ──▶ queued ──▶ running(parse→chunk→embed) ──▶ swapping ──▶ done (extraction_version=2)
                              │ huỷ/lỗi                    │ lỗi
                              ▼                            ▼
                         kept-old (ready, dữ liệu cũ, báo lỗi nếu lỗi)
```
