# Contract — manifest tài liệu đánh giá (177)

Tệp `tests/eval/corpus/manifest.json` = mảng `EvalDocument` (xem [data-model.md](../data-model.md)). Bộ đánh giá (cả `npm test` lẫn
`npm run eval:retrieval`) từ chối dữ liệu khi vi phạm bất kỳ quy tắc nào dưới đây — thông báo nêu `id` tài liệu.

## Ví dụ mục PDF

```json
{
  "id": "eval-fixture-hop-dong",
  "title": "Bản tóm tắt hợp đồng (tự soạn)",
  "sourceUrl": "tests/eval/lib/pdf-fixture.ts",
  "license": "CC0-1.0",
  "retrievedAt": "2026-10-12",
  "noise": false,
  "format": "pdf",
  "file": "eval-fixture-hop-dong.pdf",
  "sha256": "<64 hex>",
  "generator": "tests/eval/lib/pdf-fixture.ts"
}
```

## Quy tắc

| # | Quy tắc | Lỗi |
|---|---|---|
| M1 | `format` ∈ {`md`, `pdf`} (thiếu = `md`) | `manifest: format sai ở "<id>"` |
| M2 | `file` chỉ là tên tệp trong `corpus/` (không dấu phân cách đường dẫn, không `..`) | `manifest: file không hợp lệ ở "<id>"` |
| M3 | `format = "pdf"` ⇒ có `sha256` 64 hex thường | `manifest: thiếu/sai sha256 ở "<id>"` |
| M4 | `license` ∈ {`public-domain-vn-law`, `CC BY-SA 4.0`, `CC0-1.0`} | `manifest: thiếu/sai giấy phép ở "<id>"` |
| M5 | `noise = true` ⇒ không phải PDF | `manifest: tài liệu nhiễu không được là PDF "<id>"` |
| L1 | Tệp tồn tại, không rỗng; PDF cho văn bản trích không rỗng | `thiếu tệp <file>` / `tệp <file> rỗng` |
| L2 | sha256 bytes tệp = manifest | `sha256 lệch ở <file>` |
| Q1 | Câu có đáp án: mọi `docIds` cùng định dạng | `câu <id>: docIds trộn định dạng` |
| Q2 | Trích dẫn có nguyên văn trong văn bản đã nạp (PDF = văn bản `parsePdf`) | (như cũ) `câu <id>: trích đoạn không có nguyên văn …` |
| Q3 | `topic` (tuỳ chọn) chỉ nhận `"pdf"` và chỉ ở câu không đáp án | `câu <id>: topic sai` |
