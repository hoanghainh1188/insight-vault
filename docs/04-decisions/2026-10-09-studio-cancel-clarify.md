# Huỷ lượt tạo Studio — quyết định clarify (149)

- Ngày: 2026-10-09
- Feature: `149-studio-cancel` (issue #149) — intake `docs/intake/149-studio-cancel.md`.
- Người quyết định: Hải (2026-10-09). 4 câu hỏi trực tiếp (#6, #8, #10, #12) chọn phương án khuyên dùng; 13 mục còn lại nhận theo
  đề xuất của intake.
- **Bổ sung / thay thế một phần** các quyết định của 146 (không sửa file cũ): 146 #3 ("Huỷ tách issue") — nay làm; 146 #8
  ("rời notebook: main chạy tiếp, không phục hồi") — **thay bằng tự huỷ** (#10 dưới đây); dòng "Ngoài phạm vi: race A→B→A" của ADR
  `2026-10-08-studio-progress.md` — nay sửa (#11).

## Quyết định

1. **IPC**: invoke mới `studio:cancel(generationId: string)` → `{ cancelled: boolean }`, idempotent (id lạ / đã xong ⇒ `false`, không
   ném) — khuôn `rag:stop`. Main kiểm `isValidGenerationId`. Không thêm kênh push; kết cục về qua `invoke` của `studio:generate`.
2. **Sổ lượt đang chạy ở main**: module thuần `createGenerationRegistry()` (register / cancel / finish / abortAllFor(sender)), wiring mỏng
   ở `register.ts`. Chỉ **cùng `sender`** đã bắt đầu mới huỷ được (khác cửa sổ ⇒ `false`). `finally` luôn xoá entry; abort khi `sender`
   `destroyed` và `window-all-closed`. Lượt thiếu `generationId` vẫn chạy như 146 nhưng không huỷ được.
3. **Truyền `AbortSignal` xuống provider**: dùng sẵn `opts.signal`; nhánh **không-stream** của Ollama và 3 provider online tôn trọng
   signal (nối thủ công `addEventListener("abort", …, {once:true})` + gỡ ở `finally`, không phụ thuộc `AbortSignal.any`). Huỷ ném **lỗi
   huỷ chuyên dụng**, KHÔNG phải `OnlineProviderError(timeout)` (kiểm `signal.aborted` trước khi ánh xạ lỗi). Ghi bước thủ công "Ollama
   dừng sinh sau khi ngắt kết nối" — nếu không dừng ⇒ giới hạn đã biết (UI vẫn huỷ, không lưu).
4. **Điểm kiểm huỷ**: đầu mỗi phần map; **trong vòng thử lại** (huỷ không phải lỗi tạm — ném lại ngay, không gọi lần 2); mỗi lô / vòng
   rút gọn; trước bước viết; sau `await contextInfo()`; **ngay trước `upsert`** (đã huỷ ⇒ không lưu). Đã `upsert` thì huỷ là no-op, kết
   quả hiển thị bình thường. Không phát tiến độ sau khi huỷ. `generate(input, { onProgress, signal })` (tham số thứ 2 thành object).
5. **Kết cục huỷ**: `studio:generate` reject `UserFacingError("studioCancelled")`; renderer nhận mã ⇒ kết cục "huỷ" (không `errors`,
   không `onlineFailed`). `useStudio.generate` trả `"done" | "failed" | "cancelled" | "stale"`. Lượt xong trước khi huỷ tới ⇒ `done`.
6. **Nút Huỷ**: trong vùng kết quả của loại đang tạo, **mỗi khi `loading[kind]`** (kể cả trước sự kiện tiến độ đầu và khi Tạo lại trên
   card cũ), cùng hàng dòng pha / skeleton; nút loại giữ "Đang tạo…". Nhãn "Huỷ" (`common.cancel`), `aria-label` có tên loại; sau bấm
   "Đang huỷ…" + `disabled`. **Không hỏi xác nhận.**
7. **Huỷ lượt "Tạo bằng AI cục bộ"**: cùng đường huỷ; huỷ xong về nghỉ, không khôi phục khối lỗi online trước đó; `localKinds` của kết
   quả cũ giữ nguyên.
8. **Sau huỷ**: về trạng thái nghỉ (card cũ nếu có) + trình đọc màn hình (polite) "Đã huỷ tạo {label}." / "Cancelled creating {label}.";
   **không** hiện chữ trên màn hình.
9. **Focus sau huỷ**: về "Tạo lại" của card cũ nếu có, ngược lại nút loại; chỉ khi focus đang ở nút Huỷ vừa bấm.
10. **Rời notebook / đóng Workspace giữa lúc tạo ⇒ TỰ HUỶ** (như Chat 039): đổi `notebookId` / unmount ⇒ `studioCancel` mọi lượt đang
    chạy của notebook đó + thông báo huỷ. Không còn lượt chạy ngầm (Constitution I) ⇒ không cần khôi phục tiến độ.
11. **Race A→B→A**: thay `stale()` (so `notebookId`) bằng hàm thuần `isCurrentGeneration(activeIds, kind, generationId)`; lượt không còn
    hiện hành KHÔNG ghi `results` / `loading` / `localKinds` / lỗi. Làm cả khi đã tự huỷ (kết quả có thể về trước khi huỷ tới).
12. **Tạo trùng cùng `(notebookId, kind)` ở main ⇒ LƯỢT MỚI THẮNG**: main huỷ lượt cũ (supersede), chạy lượt mới. Không làm kênh
    `studio:status` / khôi phục tiến độ.
13. **Nhiều loại cùng lúc**: huỷ chỉ loại được bấm; không có "Huỷ tất cả"; các loại khác chạy tiếp.
14. **Log**: `logEvent("studio.cancelled", { kind, phase, reason })`, `reason ∈ user | navigate | window | superseded` — không
    `notebookId` / `generationId` / nội dung.
15. **i18n**: nhãn tái dùng `common.cancel`; thêm `studio.cancelAria` ("Huỷ tạo {kind}" / "Cancel creating {kind}"), `studio.cancelling`
    ("Đang huỷ…" / "Cancelling…"), `a11y.studioCancelled`, mã lỗi `studioCancelled` (+ thông điệp dự phòng) — vi + en.
16. **Kiểm thử**: unit TDD (map-reduce, studio-service, ollama-client, online-http / 3 provider, registry, whitelist, useStudio — kết
    cục huỷ, A→B→A, tự huỷ khi đổi notebook, card cũ giữ; UI nút Huỷ + focus + announce vi/en); e2e Ollama giả `/api/chat` chậm ⇒ Huỷ ở
    "Đang đọc phần 2/N" ⇒ server ghi nhận kết nối đóng, không request thêm, UI về nghỉ, không khối lỗi, DB không đổi, Tạo lại + Huỷ giữ
    card cũ, 900 px không tràn; thủ công: Ollama thật dừng sinh, provider online thật tắt badge.
17. **Riêng tư khi huỷ online**: không thêm câu "chưa gửi dữ liệu"; bảo đảm chỉ báo ra mạng tắt và không có request mới sau huỷ; ghi
    "Giới hạn đã biết": request đã tới nhà cung cấp có thể vẫn bị tính phí.
