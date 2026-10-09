# Research — 146 tiến độ Studio

## R1 — Điểm phát sự kiện

**Decision:** callback tuỳ chọn `onProgress(p)` (p = `{phase, index?, total?}`):

- `runMapReduce`: `total = batches.length` (đã cắt ở `maxMapCalls`, khớp `parts`); trước lượt map đầu tiên (attempt 0) của mỗi phần i (1-based) ⇒
  `{phase:"reading", index:i, total}`; lần thử lại KHÔNG phát. `condense`: chỉ khi vòng đầu thực sự chạy (ghi chú vượt ngân sách) ⇒ phát MỘT lần
  `{phase:"condensing"}`. Trước bước viết cuối ⇒ `{phase:"writing"}`.
- `studio-service` một lượt ⇒ `{phase:"writing"}` trước lời gọi chat duy nhất; nhiều phần ⇒ chuyển `onProgress` cho `runMapReduce`.
- Callback ném lỗi ⇒ nuốt (không làm hỏng lượt tạo).

**Rationale:** điểm phát nằm sát nơi biết chắc số liệu; không đổi kết quả. **Alternatives:** suy tiến độ ở renderer (không biết số phần) — loại.

## R2 — Kênh và định danh

**Decision:** push `studio:progress` (như `rag:streamToken`): handler `studio:generate` đọc `generationId`; hợp lệ (`/^[A-Za-z0-9_-]{1,64}$/`) ⇒ tạo
`onProgress` gửi `{generationId, notebookId, kind, ...p}` tới mọi cửa sổ; không hợp lệ/thiếu ⇒ không phát. Kết quả/lỗi vẫn qua `invoke`. Không throttle.

## R3 — State ở renderer

**Decision:** `useStudio` sinh `generationId = crypto.randomUUID()` mỗi lần `generate` (kể cả tạo lại/AI cục bộ), lưu `activeIds[kind]` (ref); đăng ký
`onStudioProgress` một lần; reducer thuần `applyStudioProgress(progress, activeIds, notebookId, ev)` ⇒ chỉ nhận khi `ev.generationId === activeIds[ev.kind]`
và `ev.notebookId === notebookId`; bỏ sự kiện lùi (reading index nhỏ hơn hiện tại, hoặc pha lùi thứ tự reading < condensing < writing). Kết quả/lỗi/đổi
notebook ⇒ xoá `progress[kind]` và `activeIds[kind]`.

## R4 — Mốc thông báo

**Decision:** hàm thuần `progressAnnouncement(prev, next, label, tr)` ⇒ câu hoặc null: đổi pha (reading lần đầu, condensing, writing khi có pha trước); mốc giữa
pha đọc khi `total ≥ 3` và `index === ceil(total/2)`. Một lượt (writing ngay) ⇒ không thêm (đã có "Đang tạo…"). Tổng ≤ start + reading + mốc + condensing + writing + done = 6.

## R5 — Trình bày

**Decision:** `StudioProgress` gồm dòng chữ pha + `<div role="progressbar">` (xác định: `aria-valuenow/max`; bất định: không valuenow, có `aria-valuetext`),
thanh bất định dùng animation, tắt dưới `prefers-reduced-motion`. Chưa có kết quả ⇒ thay skeleton; có kết quả cũ ⇒ hiện trên card. Nút giữ "Đang tạo…".

## R6 — E2E

**Decision:** e2e dùng Ollama giả HTTP (như #135) trả `/api/tags` + `/api/chat` chậm có kiểm soát ⇒ notebook nhỏ thấy "Đang viết…"; nhiều phần kiểm bằng unit
(map-reduce với chat giả) vì e2e cần notebook rất lớn. Kiểm `window.api.onStudioProgress` tồn tại và không có `invoke` chung.
