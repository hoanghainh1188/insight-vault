# Lịch sử phiên bản Studio — quyết định thực thi (178, PR 1)

- Ngày: 2026-10-10
- Feature: `178-studio-enhance-2` (issue #178) — PR 1. Clarify: `2026-10-10-studio-enhance-2-clarify.md` (#1, #7).
- **Thay một phần** ADR 021 `2026-07-11-studio-clarify.md` #4 (UNIQUE(notebook_id, kind)) và #6 ("Tạo lại" = upsert ghi đè).

## Quyết định

1. **Migration v11** dựng lại `studio_result` (tạo `studio_result_new` → `INSERT … SELECT` → `DROP` → `RENAME` → tạo lại
   `idx_studio_notebook` + mới `idx_studio_versions (notebook_id, kind, created_at)`): bỏ UNIQUE, CHECK 9 kind (mở sẵn 4 loại mới +
   `custom` cho PR 2–3), thêm `custom_prompt`, `source_ids_json`, `parts`, `truncated` (0/1), `local` (0/1) — NULL ở dòng cũ. Giữ `id`,
   `created_at`, `updated_at`. **Không** đụng `PRAGMA foreign_keys` (no-op trong giao dịch; bảng con, không bảng nào tham chiếu). Schema
   guard của sao lưu vault tự khớp (dựng từ `MIGRATIONS`); bản sao lưu v10 khôi phục được và nâng lên v11.
2. **Repo**: `insert` thay `upsert` — INSERT + `DELETE … ORDER BY created_at DESC, rowid DESC LIMIT -1 OFFSET 10` trong **một**
   giao dịch (lỗi ⇒ ROLLBACK). `listByNotebook` trả mọi phiên bản (kind, mới nhất trước); `listVersions`; `deleteVersion(notebookId,
id)` chỉ xoá khi khớp notebook. Bỏ `getByNotebookKind`.
3. **IPC** `studio:deleteVersion({notebookId, id}) → {deleted}`: service kiểm chuỗi không rỗng; sai ⇒ `{deleted:false}` (không ném,
   không log id).
4. **`local` do main ghi** (`input.target === "local"`, đúng ngữ nghĩa nhãn 098) — bỏ `localKinds` ở renderer; ghi chú "N phần" /
   "đã cắt" đọc từ phiên bản.
5. **Renderer**: `versions` (mới nhất trước) + `selected`; `results` = phiên bản đang xem (giữ API cũ cho cột / test). Tạo xong ⇒ bản mới
   được chọn. Xoá phiên bản trong lúc "Tạo lại" không ảnh hưởng lượt đang chạy.
6. **UI** `StudioVersionPicker` dưới tiêu đề thẻ: `<select>` (chỉ khi ≥ 2 bản, nhãn "Bản n/total · dd/MM HH:mm" — `formatShortDateTime`
   để vừa 262 px) + nút "Xoá phiên bản"; xác nhận **tại chỗ** (`role="alertdialog"`, khuôn `SourceItem`) thay modal. Sau xoá: announce
   `a11y.studioVersionDeleted`, focus về select (còn bản) hoặc nút loại (hết bản). Xoá lỗi ⇒ giữ hộp xác nhận + báo lỗi.
