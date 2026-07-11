# studio clarify — chốt 10 ambiguity (021-studio)

- Ngày: 2026-07-11
- Feature: `021-studio` (pha 7 D8, issue #21)
- Nguồn: `docs/intake/021-studio.md` (10 ambiguity) + phiên chốt với hoanghainh1188
- Người quyết định: hoanghainh1188 (2026-07-11). 3 quyết định kiến trúc do người dùng chọn (⭐); 7 mục còn
  lại ủy quyền "chốt luôn khuyến nghị".
- Chi tiết context/citation tách ADR: `2026-07-11-studio-context-strategy.md`.

## Quyết định theo từng ambiguity

**1. Phạm vi 4 loại — LÀM CẢ 4.** `StudioKind = "summary" | "keyPoints" | "faq" | "outline"`. Khác nhau chủ
yếu ở system prompt, chung kiến trúc.

**2. ⭐ Context — ALL-CHUNKS THEO NGÂN SÁCH.** Gom CHUNK của mọi nguồn trong notebook (theo thứ tự
source.created_at → chunk.ordinal), đưa vào `buildContext` (tái dùng 013 — đánh số `[1..k]`, ngân sách ký
tự, bỏ NGUYÊN chunk khi vượt). Ngân sách riêng `STUDIO_CONTEXT_BUDGET` (~8000 ký tự). 1 lượt `chat`. Notebook
rất lớn → phần vượt ngân sách bị bỏ (ghi chú UI "dựa trên phần đầu tài liệu"). → xem ADR.

**3. ⭐ Citation — CÓ chip `[n]`.** Context đánh số `[1..k]`; LLM chèn `[n]`; hậu kiểm bằng
`postprocessCitations` (013 — gỡ chip ngoài phạm vi). Nếu 0 chip hợp lệ nhưng có nội dung → gắn nguồn đã
dùng (`citationsFromMap`) làm citation (như rag-qa grounded). Bấm chip → mở Source Viewer (019,
`openCitation`). Giữ "kiểm chứng được" (Constitution II).

**4. ⭐ Persist — SQLITE.** Migration #3: bảng `studio_result(id, notebook_id FK CASCADE, kind, content,
citations_json, created_at, updated_at)`, UNIQUE `(notebook_id, kind)`. Mở lại notebook → thấy kết quả cũ.

**5. Kênh IPC `studio:*`** — 2 kênh invoke:

- `studio:generate` `{notebookId, kind}` → `StudioResult` (sinh mới + upsert vào SQLite).
- `studio:list` `{notebookId}` → `StudioResult[]` (đọc kết quả đã lưu khi mở Workspace).

**6. Regenerate.** Bấm lại nút cùng loại → sinh mới, **UPSERT ghi đè** kết quả cùng `(notebook_id, kind)`
(1 bản mới nhất mỗi loại). Không hỏi xác nhận (kết quả đã lưu, rẻ để tạo lại).

**7. Notebook rỗng / chưa có nguồn ready.** Nút "Tạo nhanh" **vô hiệu** + gợi ý "Nạp nguồn để tạo Studio"
(giống chat block). Kiểm `hasReadySources` như `useChat`.

**8. Ollama/model chưa sẵn sàng.** Tái dùng `RuntimeStatus`/`ollamaReady` (007) — banner inline cột Studio

- vô hiệu nút. `studio:generate` khi runtime lỗi → ném lỗi thân thiện (không bịa).

**9. Định dạng output — TEXT (không structured, không markdown-render).** `StudioResult.content` là **chuỗi
text** (LLM sinh dạng gạch đầu dòng "- ..." cho summary/keyPoints; "Hỏi:/Đáp:" cho FAQ; thụt cấp cho
outline). Renderer hiển thị **text + chip `[n]`** (tái dùng cách render của `MessageBubble`: split `[n]`,
React text node, `white-space: pre-wrap`) — KHÔNG dùng markdown renderer/innerHTML (chống XSS, nhất quán
chat). Không tạo type structured FAQ/Outline ở MVP (giảm phức tạp parse/render).

**10. Giới hạn kích thước/thời gian.** `STUDIO_CONTEXT_BUDGET` cắt input (không vượt context window). 1 lượt
chat (chat timeout 120s đã có). Spinner "Đang tạo…" trên nút/card. Không progress bar (1 lượt). Không cần
giới hạn thời gian cứng thêm.

## Gap code (điểm chạm — tách commit)

- `source-repo.ts` (011): THÊM `listChunksByNotebook(notebookId): Chunk[]` (JOIN chunk→source, thứ tự
  created_at→ordinal) — additive, không sửa schema cũ.
- Migration #3: bảng `studio_result` (append-only, ADR migration).
- Tái dùng `rag/context-builder.ts` (`buildContext`) + `rag/citation.ts` (`postprocessCitations`,
  `citationsFromMap`) — IMPORT trực tiếp (hàm THUẦN, ổn định). Nếu sau này có consumer thứ 3, tách sang
  `services/shared/`. (Quyết định: import-from-rag cho MVP, tránh churn 013.)
- Service mới `src/main/services/studio/` (studio-service + prompt studio + studio-repo).
- `studio:*` + `StudioKind`/`StudioResult`/`StudioGenerateInput` (shared types).
- Renderer `features/studio/` (StudioColumn thay placeholder Workspace); bấm chip → `useSourceViewer.openCitation`.

## Hệ quả

- `/speckit-plan` bám ADR `2026-07-11-studio-context-strategy.md` + clarify này.
- Migration #3 (đầu tiên sau #2 của 011). `security-reviewer` chạy (chat + DB + render nội dung LLM).
