# ai-runtime — quyết định clarify (7 điểm)

- Ngày: 2026-07-11
- Feature liên quan: `007-ai-runtime` (issue #7, pha 002 trong lộ trình ADR D8)
- Câu hỏi gốc: 7 ambiguity từ `docs/intake/007-ai-runtime.md` (mục "Ambiguities"). Chốt trực tiếp (không qua /speckit-clarify) theo khuyến nghị được người dùng duyệt.
- Người quyết định: hoanghainh1188 (2026-07-11)

## Quyết định

| #   | Câu hỏi                                                  | Quyết định                                                                                                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | Lưu lựa chọn model (chat + embedding) ở đâu              | **electron-store** (JSON, OS settings) — tránh phụ thuộc schema SQLite sớm (schema đầy đủ ở `004-ingestion`); nhất quán với cờ onboarding của app-shell.                                                                                                                                                     |
| A2  | Ollama rớt giữa phiên: poll hay check-on-demand          | **Check-on-demand** — kiểm khi mở màn Cài đặt + khi bấm "kiểm tra kết nối". Không poll định kỳ ở v1. Modelchip trạng thái mất kết nối ở composer Workspace → thuộc `005-rag-qa`, ngoài phạm vi.                                                                                                              |
| A3  | Embedding model mặc định khi chưa cài `nomic-embed-text` | **Không tự tải.** Chỉ liệt kê model đã cài trên Ollama; nếu chưa có model embedding, hiển thị gợi ý cài `nomic-embed-text` (khuyến nghị) — hướng dẫn, không auto-pull.                                                                                                                                       |
| A4  | Danh sách IPC mới + có tái dùng OnboardingState không    | Thêm 5 kênh vào `src/shared/ipc/channels.ts`: `ai:listModels`, `ai:testConnection`, `ai:getSelectedModels`, `ai:setSelectedModels`, **`ai:getRuntimeStatus`** (Ollama reachable + model readiness). **Tách** khỏi `app:getOnboardingState` (cờ "đã xem màn chào" của app-shell) — không đổi nghĩa 5 kênh cũ. |
| A5  | Onboarding blocking hay bỏ qua được                      | **Bỏ qua được** ("cài sau") → vào app ở trạng thái giới hạn (chưa hỏi đáp được nhưng xem được UI). Trạng thái Ollama-ready là **sub-state riêng** (`ollamaReady` qua `ai:getRuntimeStatus`), **tách** khỏi `OnboardingState.completed` (chỉ nghĩa "đã xem màn chào lần đầu").                                |
| A6  | Nút "Tải thêm mô hình"                                   | **Link/hướng dẫn tĩnh** (mở trang Ollama models / hiển thị lệnh `ollama pull`), KHÔNG kích hoạt `ollama pull` từ trong app ở v1 (tránh lấn "tự tải/quản lý model lớn" đã loại ở ADR D3 / OVERVIEW mục 10).                                                                                                   |
| A7  | Host/port Ollama cấu hình được không                     | **Hardcode `http://localhost:11434`** ở v1 (đọc override qua env var là escape hatch, không có UI). Tùy chỉnh host/port trong Cài đặt → hoãn sang sau.                                                                                                                                                       |

## Ghi chú

- A1/A5: state của ai-runtime (lựa chọn model, ollamaReady) tách khỏi metadata notebook (SQLite ở 004) và tách khỏi cờ onboarding app-shell → ranh giới sạch, dễ mở rộng.
- A4: privacy indicator vẫn "Chạy cục bộ" khi dùng Ollama (Constitution I — gọi localhost không phải egress).
- Sẽ tích hợp các quyết định này vào spec ở `/speckit-specify` (không cần chạy `/speckit-clarify`).
