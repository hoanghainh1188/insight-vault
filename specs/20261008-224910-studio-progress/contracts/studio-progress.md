# Contract — tiến độ Studio

## Main

- `runMapReduce({..., onProgress?})`: phát theo thứ tự `reading 1/N … reading N/N` (mỗi phần đúng một lần, trước attempt 0), `condensing` (≤ 1 lần, chỉ khi có
  vòng rút gọn), `writing` (1 lần, trước bước cuối). Lỗi trong `onProgress` bị nuốt.
- `studioService.generate(input, onProgress?)`: một lượt ⇒ chỉ `writing`; nhiều phần ⇒ như trên. Kết quả giống hệt khi không có `onProgress`.
- IPC `studio:generate`: `isValidGenerationId(input.generationId)` ⇒ `onProgress = p => send(studio:progress, {generationId, notebookId, kind, ...p})` tới
  mọi cửa sổ; ngược lại không phát. Không log payload.

## Preload

- `onStudioProgress(cb: (e: StudioProgressEvent) => void): () => void` — kênh chỉ nhận (whitelist). Không có `invoke` chung.

## Renderer

- `applyStudioProgress(state, activeIds, notebookId, ev)` thuần: áp khi id/notebook khớp; bỏ lùi (index nhỏ hơn hoặc pha thứ tự thấp hơn); trả state mới (không mutate).
- `progressAnnouncement(prev, next, label, tr)` thuần: câu khi đổi pha / mốc giữa (`total ≥ 3`, `index = ceil(total/2)`); null còn lại.
- `progressText(p, tr)`: vi "Đang đọc phần {i}/{n}…", "Đang rút gọn ghi chú…", "Đang viết…"; en tương ứng.
