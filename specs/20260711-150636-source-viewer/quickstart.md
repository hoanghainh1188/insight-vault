# Quickstart — 019-source-viewer (kiểm chứng)

Chứng minh bấm chip [n] → mở nguồn + highlight đúng đoạn. Chi tiết type xem [data-model.md](./data-model.md),
hợp đồng IPC xem [contracts/ipc-channels.md](./contracts/ipc-channels.md).

## Prerequisites

- Đã có 011-ingestion + 013-rag-qa trong `main`.
- Một notebook có ≥1 nguồn "Sẵn sàng" + đã hỏi 1 câu có câu trả lời trong tài liệu (để có chip `[n]`).

## Gate lệnh

```bash
npm run lint
npm run test          # unit — coverage ≥80% (reconstruct + highlight)
npm run build
npm run test:e2e
```

## Kịch bản kiểm chứng (map US/SC)

### QS1 — Chip [n] → viewer highlight đúng đoạn (US1, SC-001/002)

1. `npm run dev`, mở notebook có nguồn ready, hỏi câu có câu trả lời trong tài liệu → nhận chip `[n]`.
2. Bấm `[n]` → overlay viewer mở, cuộn tới + tô nổi bật đúng đoạn, nhãn "Trích dẫn [n]", (PDF) số trang.
3. Đối chiếu: đoạn highlight khớp CHÍNH XÁC nội dung chunk (không lệch ký tự).
4. Bấm đóng → về cột Chat, hội thoại còn nguyên.

### QS2 — Non-PDF + URL offline (US2, SC-003)

1. Chip trỏ nguồn `.txt`/`.md`/`.docx` → viewer cuộn tự do, auto-scroll + highlight đúng khoảng ký tự, không pager.
2. Chip trỏ nguồn URL, ngắt mạng → viewer vẫn hiển thị bản đã lưu, highlight đúng (không lời gọi mạng nào).

### QS3 — Nhiều chip + mở từ cột Nguồn (US3, SC-004)

1. Câu trả lời có `[1]` `[2]` (2 nguồn) → bấm `[1]` rồi `[2]` → viewer đổi đúng nguồn/đoạn.
2. Bấm tên nguồn ở cột Nguồn → viewer mở nguồn từ đầu, không highlight.

### QS4 — Nguồn đã xoá (US3 edge, SC-005)

- Xoá nguồn rồi bấm chip cũ trỏ nguồn đó → "Nguồn không còn tồn tại", không crash.

### QS5 — Bảo mật (SC-006, Constitution III)

- Rà log: không có nội dung tài liệu trong log.
- Renderer render text bằng text node (không innerHTML) — không XSS từ nội dung nguồn.

## Unit test trọng tâm (tất định)

- `reconstruct.test.ts` (**CRUX**): `reconstructText` == văn bản gốc cho 1 trang / PDF nhiều trang (fill gap
  `\n\n`) / 1 chunk; `T.slice(charStart,charEnd) === chunk.text` mọi chunk; `derivePageBreaks` đúng offset
  per page; edge: chunk rỗng, gap phòng thủ.
- `highlight.test.ts`: `segmentForHighlight` chia đúng [before|highlight|after]; biên đầu/cuối; citation rỗng
  → không highlight; chèn mốc trang theo pageBreaks; offset ngoài range → phòng thủ (không crash).
- `source-getcontent-whitelist.test.ts`: kênh whitelisted, ngoài bị từ chối.

## e2e (`tests/e2e/source-viewer.e2e.ts`)

- `window.api.sourceGetContent` tồn tại + không invoke chung (whitelist).
- Tạo notebook + nạp txt → mở viewer trực tiếp từ cột Nguồn → text hiển thị.
- getContent cho sourceId không tồn tại → null.
