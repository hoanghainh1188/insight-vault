# Tech stack & kiến trúc nền — InsightVault v1

- Ngày: 2026-07-10
- Feature liên quan: `_project` (quyết định cấp dự án, áp cho mọi feature)
- Câu hỏi gốc: `docs/OVERVIEW.md` mục 8 + 10 yêu cầu tự phân tích & đề xuất stack, kiến trúc,
  data model, RAG + map trích dẫn, cấu trúc thư mục, thứ tự build theo pha — rồi chốt để duyệt.
- Người quyết định: hoanghainh1188 (duyệt qua AskUserQuestion, 2026-07-10)

## Bối cảnh
App desktop local-first (kiểu NotebookLM offline). 3 ràng buộc bất biến: dữ liệu không rời máy ở
chế độ mặc định · mọi câu trả lời trích dẫn về đúng đoạn nguồn · chạy được offline. Nền tảng đã chốt:
Electron, macOS + Windows. Kiến trúc phải "sẵn sàng thu phí" nhưng chưa xây phần trả phí ở v1.

## Quyết định

### D1. Shell & UI
Electron + electron-vite; renderer React 18 + TypeScript + Vite. State: Zustand (client) +
TanStack Query (bọc IPC như async data source). **Lý do:** khớp gợi ý overview + rule web của dev;
prototype đã component-based; hệ sinh thái pdf.js/viewer sẵn.

### D2. Lưu trữ
- Metadata: **SQLite** (better-sqlite3, chạy ở main process) — đơn file, backup dễ.
- Vector store: **LanceDB** (embedded, thư mục riêng trong data dir). **Lý do chọn thay sqlite-vec:**
  người dùng ưu tiên khả năng scale số chunk lớn + ANN nâng cao; chấp nhận có 2 nơi lưu (SQLite metadata
  + LanceDB vectors) trong cùng data dir.

### D3. AI runtime
- Local: **Ollama** (gọi HTTP local) cho cả LLM và embedding. **Lý do:** dễ tích hợp, quản lý model tốt,
  prototype đã vẽ sẵn "AI cục bộ (Ollama)". Đổi lại: onboarding cần bước kiểm tra/cài Ollama.
- Trừu tượng hoá qua `ProviderRegistry` + interface `LLMProvider { chat, embed, test }` để online provider
  (Anthropic/OpenAI/Gemini) hoán đổi sau cùng một interface. v1 ship Ollama trước, online provider là feature sau.

### D4. Trích dẫn kiểm chứng được (crux)
Chunk phải giữ **locator** ngay lúc tạo: `{page, char_start, char_end}` (PDF/text) | `{timestamp}` (AV) |
`{bbox}` (ảnh). Câu trả lời LLM chèn `[n]`; ánh xạ `n → chunk_id → source + locator`. Viewer dùng pdf.js
text layer (PDF) / char range (markdown) để cuộn tới + highlight đúng đoạn. **Không tái tạo offset sau.**

### D5. Bảo mật desktop
Renderer `sandbox:true`, `contextIsolation:true`, `nodeIntegration:false`. Mọi truy cập FS/DB/model/mạng
ở **main process**, expose qua `preload` contextBridge whitelisted. Tài liệu & vector thô không đi qua
renderer. API key online lưu bằng **keytar** (OS keychain / Credential Manager), không plaintext.
Mặc định **không network egress**; chỉ khi bật provider online mới có call ra ngoài + luôn hiện chỉ báo riêng tư.

### D6. Cấu trúc thư mục (cô lập theo feature — khớp template)
```
src/main/services/<slug>/     · src/renderer/features/<slug>/
src/shared/  (types + IPC channel contract, dùng chung main↔renderer)
src/renderer/shared/  (UI kit trích từ prototype: tokens, Button…)
```

### D7. Packaging & deploy
electron-builder → .dmg (mac) + NSIS (win). v1 phát hành thủ công qua GitHub Releases; code-sign/notarize
+ auto-update để pha sau. "Deploy" trong `/design-to-code` v1 = tạo bản đóng gói local để kiểm thử.

### D8. Thứ tự build theo pha (ràng buộc #4 — không nhảy cóc)
Pha 1 (MVP), dependency-ordered:
`001 app-shell → 002 ai-runtime → 003 notebooks → 004 ingestion → 005 rag-qa ⭐ →
006 source-viewer → 007 studio → 008 online-provider`.
Pha 2 (sau khi Pha 1 ổn): `009 audio-video` (whisper.cpp) · `010 image` (OCR + vision).

## Ngoài phạm vi v1 (mục 7 overview)
Đồng bộ đám mây, tài khoản/thanh toán, cộng tác nhiều người, mobile/web, fine-tune, "audio overview".

## Hệ quả
- Onboarding v1 phụ thuộc Ollama đã cài (D3) → feature `002 ai-runtime` phải xử lý phát hiện/hướng dẫn cài.
- 2 store (SQLite + LanceDB) cần giữ nhất quán khi xoá source/notebook (dọn cả metadata lẫn vector).
- Các quyết định D1–D8 là "hiến pháp kỹ thuật" cấp dự án; đổi → cập nhật ADR này (không sửa lén CLAUDE.md).
