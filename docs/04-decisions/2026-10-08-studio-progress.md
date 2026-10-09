# Tiến độ khi tạo kết quả Studio (146)

- Ngày: 2026-10-08
- Feature liên quan: `146-studio-progress` (issue #146) — spec `specs/20261008-224910-studio-progress/`.
- Câu hỏi gốc: tạo Studio cho notebook lớn (map-reduce tới 12 lượt map + rút gọn + bước cuối) có thể mất vài phút; người dùng
  chỉ thấy skeleton / "Đang tạo…", không biết app còn chạy hay đã treo.
- Người quyết định: Hải (11 quyết định clarify, `2026-10-08-studio-progress-clarify.md`).

## Quyết định

1. **Kênh push mới `studio:progress`** (main → renderer, chỉ nhận — `onStudioProgress` ở preload, không `invoke` chung).
   Payload tối thiểu `{generationId, notebookId, kind, phase, index?, total?}` — **không** nội dung tài liệu / ghi chú; không log.
   Kết quả / lỗi vẫn đi qua `invoke` `studio:generate` như cũ.
2. **`generationId`** do renderer sinh mỗi lần bấm Tạo / Tạo lại / Tạo bằng AI cục bộ (`crypto.randomUUID()`), gửi trong
   `StudioGenerateInput`; main kiểm `/^[A-Za-z0-9_-]{1,64}$/` (`isValidGenerationId`) — thiếu / sai ⇒ không phát (vẫn tạo bình thường).
   Nối dây bằng hàm thuần `createStudioProgressEmitter(input, send)` (analyze M1).
3. **Điểm phát** (`runMapReduce`, `studioService.generate`): `reading i/N` trước lượt map đầu tiên của mỗi phần (N = `parts`, kể cả khi
   cắt ở `maxMapCalls`; thử lại trong cùng phần không phát thêm) · `condensing` ≤ 1 lần, chỉ khi thật sự có vòng rút gọn · `writing`
   1 lần trước bước cuối. Một lượt ⇒ chỉ `writing`. Lỗi callback bị nuốt; kết quả (`raw`, `map`, `parts`, `truncated`) không đổi.
   Không throttle ở main (≤ ~14 sự kiện / lượt).
4. **Renderer**: `applyStudioProgress` thuần bỏ sự kiện lượt khác / notebook khác / lùi; tiến độ theo từng loại, xoá khi xong / lỗi /
   đổi notebook. Thẻ hiện dòng pha + thanh (xác định ở pha đọc, bất định ở pha khác — `role="progressbar"`, `aria-valuetext`),
   thay skeleton khi chưa có kết quả, nằm trên card cũ khi Tạo lại; nút giữ "Đang tạo…". `prefers-reduced-motion` ⇒ thanh đứng yên.
   Chuyển động chỉ dùng `transform`.
5. **Câu hiển thị** (clarify #11): vi "Đang đọc phần {i}/{n}…", "Đang rút gọn ghi chú…", "Đang viết…"; en "Reading part {i} of {n}…",
   "Condensing notes…", "Writing…" (`studio.progress.*`).
6. **Trình đọc màn hình** (`progressAnnouncement` thuần, polite, có tên loại): giữ câu bắt đầu / xong; thêm khi vào pha đọc, mốc giữa
   pha đọc (`total ≥ 3`, `index = ceil(total/2)`), sang rút gọn, sang viết (chỉ khi có pha trước). Một lượt 6 phần ≤ 6 câu.

## Bổ sung sau review (code / bảo mật / glossary, 2026-10-09)

- **Chỉ gửi về cửa sổ đã gọi** (`event.sender` qua `safeHandleWithSender` ở `register.ts`) thay vì mọi cửa sổ như contract /
  research ghi — đúng nghĩa "tiến độ của lượt này", không rò sang cửa sổ khác nếu sau này có nhiều cửa sổ. Thay thế câu
  "tới mọi cửa sổ" trong `specs/…/contracts/studio-progress.md`, `research.md`, `plan.md`, `tasks.md` (T010).
- Renderer đăng ký `onStudioProgress` không còn `?.` (mock test cập nhật thay vì để nhánh chỉ phục vụ test); xoá khoá bằng
  `withoutKind` (không để khoá mang `undefined`).
- E2E thêm đường **nhiều phần** (tài liệu ~40.000 ký tự > ngân sách 16.000): "Đang đọc phần i/N…" tăng dần → "Đang viết…" → "Tổng
  hợp từ N phần", ở cửa sổ nhỏ nhất (900 px) không tràn (SC-001, SC-006).
- Glossary (append): cặp tiến độ xác định / bất định (kèm nhánh đọc thiếu số phần), `StudioProgressState` / `ActiveGenerationIds`,
  `createStudioProgressEmitter`.
- Không đổi: thanh pha đọc dùng `index/total` (phần đang đọc) — ở phần N/N thanh đầy rồi sang bất định khi viết; giữ như clarify #4.
- Ngoài phạm vi (có từ trước): đổi notebook A → B → A giữa lúc tạo, kết quả lượt A cũ về muộn vẫn được ghi (kiểm `stale()` theo
  notebookId). Tiến độ không bị ảnh hưởng (lọc theo `generationId`).

## Kiểm chứng

- Unit (TDD): `studio-progress-id`, `studio-map-reduce` (onProgress), `studio-service` (tiến độ), `studio-progress-emitter`,
  `studio-progress` (apply / text / announcement), `studio-progress-hook`, `studio-progress-ui` (+ CSS reduced-motion, announce đổi pha).
- E2E `tests/e2e/studio-progress.spec.ts`: Ollama giả HTTP (chat chậm 1,5 s) ⇒ "Đang viết…" rồi kết quả, vi + en, cột Studio
  không tràn ở cửa sổ 1024 px, `reducedMotion: "reduce"` ⇒ `animationName === "none"`.

## Giới hạn đã biết

- **Không có ETA** (clarify #2) — thời gian mỗi lượt map phụ thuộc model / máy, ước lượng dễ sai.
- **Không Huỷ** ở bản này — tách issue #149 (sự kiện đã mang `generationId` để dùng lại).
- **Chạy song song nhiều loại**: tiến độ riêng từng thẻ nhưng các lượt dùng chung Ollama ⇒ mỗi loại chậm hơn khi chạy một mình.
- **Rời notebook rồi quay lại** giữa lúc tạo: không phục hồi tiến độ (renderer bỏ trạng thái khi đổi notebook); kết quả vẫn lưu khi xong.
