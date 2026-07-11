# Intake — 007-ai-runtime

- Feature ID: 007 (GitHub issue #7)
- Branch: `007-ai-runtime`
- Loại: hạ tầng AI (runtime + abstraction provider local) — pha `002 ai-runtime` trong lộ trình ADR D8
  (feature ID = số issue GitHub, khác số thứ tự pha; đối chiếu `docs/04-decisions/2026-07-10-tech-stack.md`
  mục D8 để tránh nhầm "002" trong ADR với ID issue "007").

## Input sources

- `docs/OVERVIEW.md` — mục 5 "Chọn mô hình" (LLM local mặc định / bật provider online + API key / kiểm
  tra kết nối), "Chỉ báo riêng tư", "Onboarding lần đầu" (đảm bảo runtime AI local sẵn sàng); mục 6 ràng
  buộc bất biến #1 (local-first), #2 (AI online opt-in + key an toàn), #5 (bảo mật desktop); mục 8 gợi ý
  kỹ thuật (Ollama cho LLM & embedding local).
- `docs/03-ui/prototype.html` — màn **S5 Cài đặt** (dòng 482–508): section "AI cục bộ (Ollama)" với tag
  trạng thái "Đã kết nối" (dòng 486), danh sách "Mô hình trả lời" dạng radio-select — Qwen 2.5 7B (4.7 GB,
  đang chọn), Llama 3.1 8B (4.9 GB), Mistral 7B (4.1 GB) (dòng 488–493), "Mô hình embedding" hiển thị
  `nomic-embed-text` / 274 MB (dòng 495), nút "Tải thêm mô hình" (dòng 496). Modelchip ở composer màn
  Workspace: "Local · qwen2.5:7b" (dòng 413). Section "AI online (tùy chọn)" (dòng 500–507) hiển thị cùng
  màn nhưng **thuộc feature 008-online-provider** — chỉ dùng để hiểu bố cục tổng thể màn Cài đặt, không
  implement ở feature này. Đây là wireframe tĩnh HTML/CSS/JS, không phải file Figma — không có node ID để
  tra; **không có Figma MCP nào khả dụng/liên quan cho feature này**, không cần gọi.
- `docs/04-decisions/2026-07-10-tech-stack.md` — D3 (AI runtime: Ollama HTTP local cho cả LLM + embedding;
  trừu tượng hoá qua `ProviderRegistry` + interface `LLMProvider { chat, embed, test }`; v1 ship Ollama
  trước, online provider hoán đổi sau cùng interface ở feature sau), D5 (bảo mật: mọi truy cập mạng ở
  main process, expose qua preload whitelisted; mặc định không network egress), D6 (cấu trúc thư mục
  `src/main/services/<slug>/`, `src/renderer/features/<slug>/`, `src/shared/`), D8 (thứ tự pha: app-shell
  → ai-runtime → notebooks → ...), "Hệ quả" (onboarding v1 phụ thuộc Ollama đã cài → feature ai-runtime
  xử lý phát hiện/hướng dẫn cài).
- `.specify/memory/constitution.md` — Principle I (Local-first & No Default Egress: Ollama là local, gọi
  Ollama HTTP **không** phải network egress vì chạy trên máy người dùng; privacy indicator phải tiếp tục
  phản ánh đúng "Chạy cục bộ"), Principle III (Desktop Security Boundary: mọi truy cập mạng/model MUST ở
  main process, expose qua preload contextBridge whitelisted; renderer không được gọi Ollama HTTP trực
  tiếp), Principle V (Phased Delivery — ai-runtime đứng trước notebooks/ingestion/rag-qa trong chuỗi
  dependency).
- `docs/00-glossary.md` — đối chiếu các thuật ngữ: provider (dòng 22), local (dòng 23), embedding (dòng
  15), privacy indicator (dòng 24), first-run onboarding (dòng 26), settings (dòng 28).
- `docs/04-decisions/INDEX.md` — đã quét cả 3 dòng (data-dir-path, app-shell-clarify, tech-stack). Không
  có quyết định nào về: nơi lưu lựa chọn model, hành vi khi Ollama chưa chạy, embedding model mặc định,
  danh sách IPC channel mới, có bắt buộc hoàn tất onboarding hay không → các điểm này hợp lệ để đưa vào
  Ambiguities bên dưới (chưa bị trùng với quyết định cũ).
- `src/shared/ipc/channels.ts` — 5 kênh whitelisted hiện tại của `001-app-shell`
  (`app:getDataDir`, `app:getPrivacyState`, `app:getOnboardingState`, `app:setOnboardingComplete`,
  `app:getAppInfo`). Feature này **thêm** kênh mới vào cùng file, không đổi nghĩa 5 kênh cũ.

## Prompt for /speckit-specify

**Xây dựng runtime AI cục bộ (local AI runtime) cho InsightVault — lớp nền cho phép ứng dụng gọi một mô
hình ngôn ngữ (LLM) và một mô hình embedding chạy hoàn toàn trên máy người dùng, thông qua Ollama, để các
feature nghiệp vụ sau (nạp nguồn, hỏi đáp có trích dẫn) có thể dùng mà không cần biết chi tiết cách gọi
model. Đây là hạ tầng AI, chưa bao gồm pipeline nạp nguồn thực (chunk/embed tài liệu) hay tính năng hỏi
đáp/RAG thực sự.**

**Khi người dùng mở ứng dụng và vào màn Cài đặt, họ thấy một khu vực "AI cục bộ (Ollama)" cho biết:**

- **Trạng thái kết nối** tới Ollama chạy trên máy (địa chỉ mặc định `http://localhost:11434`): hiển thị
  rõ đang kết nối được hay không, và người dùng có thể chủ động **kiểm tra lại kết nối** bất kỳ lúc nào
  (nút/hành động "kiểm tra kết nối" theo đúng tinh thần OVERVIEW mục 5).
- **Danh sách mô hình trả lời (LLM)** đã cài sẵn trong Ollama trên máy người dùng, lấy động từ chính
  Ollama (không phải danh sách hard-code) — người dùng chọn một mô hình làm mô hình trả lời mặc định cho
  toàn ứng dụng.
- **Mô hình embedding** — tương tự, người dùng thấy và có thể chọn mô hình embedding (mô hình dùng để
  biến văn bản thành vector nhúng) trong số các mô hình embedding đã cài trên Ollama.
- Lựa chọn mô hình trả lời + mô hình embedding phải được **lưu lại bền vững** (persist), để lần mở ứng
  dụng sau vẫn giữ nguyên lựa chọn, không phải chọn lại.

**Khi ứng dụng khởi động lần đầu (first-run onboarding), ứng dụng phải thực sự kiểm tra xem Ollama đã
được cài đặt và đang chạy trên máy hay chưa** (thay thế khung onboarding placeholder dựng ở
001-app-shell bằng nội dung thật):

- Nếu Ollama đã cài và đang chạy: cho phép người dùng tiếp tục vào ứng dụng bình thường.
- Nếu Ollama chưa cài hoặc chưa chạy: ứng dụng phải **thông báo rõ ràng** cho người dùng biết tình trạng
  này và **hướng dẫn** họ cách khắc phục (ví dụ liên kết tải Ollama, hoặc hướng dẫn khởi động Ollama nếu
  đã cài nhưng chưa chạy) — không được để ứng dụng rơi vào trạng thái lỗi im lặng hoặc màn hình trắng.

**Ứng dụng cần có một lớp trừu tượng cho "nhà cung cấp AI" (provider) sao cho:**

- Toàn bộ ứng dụng gọi AI (trả lời câu hỏi, tạo embedding) thông qua **một giao diện chung, không phụ
  thuộc trực tiếp vào Ollama** — để sau này khi thêm nhà cung cấp AI online (Anthropic/OpenAI/Gemini, ở
  feature khác) chỉ cần "cắm thêm" một nhà cung cấp mới vào cùng cơ chế, không phải viết lại phần gọi AI
  ở nơi khác trong ứng dụng.
- Ở phiên bản này, chỉ có **một** nhà cung cấp hoạt động thực sự: Ollama chạy cục bộ. Nhà cung cấp này
  phải hỗ trợ tối thiểu ba khả năng kiểm chứng được: (1) trả lời hội thoại (chat) dựa trên một mô hình đã
  chọn, (2) tạo vector embedding cho một đoạn văn bản dựa trên mô hình embedding đã chọn, (3) tự kiểm tra
  xem bản thân nó có sẵn sàng hoạt động hay không (kết nối được tới Ollama + mô hình đang dùng có tồn tại
  trên máy).

**Ràng buộc bảo mật/kiến trúc bắt buộc — hành vi phải kiểm chứng được, không chỉ chi tiết cài đặt (tham
chiếu Constitution Principle III, ADR D3/D5):**

- Mọi cuộc gọi HTTP tới Ollama **phải** thực hiện ở tiến trình chính (main process) của Electron.
  Renderer (giao diện người dùng) **không được** tự gọi trực tiếp tới Ollama qua mạng — renderer chỉ được
  yêu cầu các thao tác AI (liệt kê mô hình, kiểm tra kết nối, lấy/lưu lựa chọn mô hình, lấy trạng thái
  onboarding runtime) thông qua các kênh giao tiếp liên tiến trình (IPC) đã được liệt kê rõ ràng
  (whitelisted), giống cách 5 kênh hiện có của app-shell đã hoạt động.
- Việc gọi Ollama cục bộ **không** được coi là vi phạm nguyên tắc "không network egress mặc định" —
  Ollama chạy trên chính máy người dùng (localhost), không phải gửi dữ liệu ra bên thứ ba. Chỉ báo riêng
  tư (privacy indicator) ở titlebar **phải tiếp tục hiển thị "Chạy cục bộ"** khi dùng Ollama, vì đây vẫn
  là xử lý hoàn toàn trên máy.

**Ngoài phạm vi feature này** (thuộc feature khác, không được lấn vào):

- Nhà cung cấp AI online (Anthropic/OpenAI/Gemini) và lưu API key bằng keytar — thuộc `008-online-provider`.
- Pipeline ingestion thực (parse tài liệu → chunk → gọi embed thực tế → lưu vào LanceDB) — thuộc
  `004-ingestion`.
- Truy hồi RAG và giao diện hỏi đáp (chat UI, chèn trích dẫn `[n]`) — thuộc `005-rag-qa`.
- Tự động tải/quản lý file mô hình lớn qua ứng dụng — ở feature này chỉ **liệt kê** mô hình Ollama đã cài
  sẵn trên máy; nút "Tải thêm mô hình" trong prototype chỉ cần được ghi nhận là hành vi cần làm rõ ở
  clarify (có mở trang hướng dẫn ngoài hay thực sự kích hoạt `ollama pull` từ trong app?), không mặc định
  implement tải model qua mạng ở feature này trừ khi được làm rõ.

## Ambiguities to raise in /speckit-clarify

Đã quét `docs/04-decisions/INDEX.md` — 3 quyết định hiện có (data-dir-path, app-shell-clarify, tech-stack)
không đề cập nơi lưu lựa chọn model, hành vi khi Ollama chưa chạy, embedding model mặc định, danh sách IPC
channel mới của ai-runtime, hay việc onboarding có bắt buộc hoàn tất không — nên các điểm dưới đây **chưa**
trùng quyết định cũ:

1. **Nơi lưu lựa chọn mô hình (LLM + embedding) đã chọn** — electron-store (file JSON riêng) hay SQLite
   (bảng settings, dù D2 nói SQLite dùng cho metadata notebook/source)? Ảnh hưởng cấu trúc
   `src/main/services/ai-runtime/` và có tạo phụ thuộc sớm vào schema SQLite trước khi `004-ingestion`
   định nghĩa schema đầy đủ hay không.
2. **Hành vi khi Ollama chưa cài / chưa chạy, ngoài lúc onboarding** — ví dụ người dùng tắt Ollama giữa
   phiên làm việc (sau khi đã qua onboarding) rồi vào lại màn Cài đặt hoặc dùng workspace: ứng dụng có
   tự phát hiện lại (poll định kỳ) hay chỉ kiểm tra khi người dùng bấm "kiểm tra kết nối"/mở màn Cài đặt?
   Modelchip "Local · qwen2.5:7b" ở composer Workspace (dòng 413) có cần phản ánh trạng thái mất kết nối
   không, hay đó thuộc phạm vi UI của `005-rag-qa`?
3. **Mô hình embedding mặc định khi máy chưa cài `nomic-embed-text`** — prototype hiển thị sẵn model này
   như đã cài (274 MB), nhưng thực tế người dùng có thể chưa `ollama pull` model đó. Onboarding/Cài đặt
   có cần chủ động đề xuất/hướng dẫn cài `nomic-embed-text` làm mặc định, hay để trống cho tới khi người
   dùng tự chọn từ danh sách mô hình đã cài?
4. **Danh sách IPC channel mới cần thêm vào `src/shared/ipc/channels.ts`** — đề xuất sơ bộ cần chốt tên
   chính xác và tập response type: `ai:listModels` (liệt kê model đã cài), `ai:testConnection` (kiểm tra
   Ollama reachable + model tồn tại), `ai:getSelectedModels` / `ai:setSelectedModels` (đọc/ghi lựa chọn
   LLM + embedding), `ai:getOnboardingStatus` hoặc tái dùng `app:getOnboardingState` đã có ở app-shell
   (mở rộng field thay vì tạo kênh mới)? Cần quyết định có mở rộng `OnboardingState` sẵn có hay thêm kênh
   `ai:detectOllama` riêng.
5. **Onboarding có bắt buộc hoàn tất (blocking) trước khi vào app hay có thể bỏ qua** — nếu Ollama chưa
   cài, người dùng có bị chặn hoàn toàn không thể dùng ứng dụng, hay được phép "Bỏ qua, cài sau" và vào
   ứng dụng ở trạng thái giới hạn (không hỏi đáp được nhưng vẫn xem được UI)? `OnboardingState.completed`
   đã có ở 001-app-shell — feature này có tái dùng cờ đó, hay cần thêm sub-state riêng (ví dụ
   `ollamaReady`) để phân biệt "đã qua màn onboarding" với "Ollama thực sự sẵn sàng"?
6. **Nút "Tải thêm mô hình"** (prototype dòng 496) — ở feature này có cần hoạt động thật (mở trang tải
   Ollama models, hoặc kích hoạt `ollama pull` qua IPC) hay chỉ là link/hướng dẫn tĩnh, để không lấn vào
   phạm vi "tự động tải/quản lý model lớn" đã loại trừ trong ADR D3/OVERVIEW mục 10?
7. **Cổng/host Ollama có cấu hình được không** — OVERVIEW/ADR chỉ nêu mặc định
   `http://localhost:11434`; có cần cho phép người dùng đổi cổng/host trong Cài đặt (trường hợp Ollama
   chạy ở cổng khác) ở v1, hay để cứng giá trị mặc định và hoãn việc này sang sau?

## Traceability

| Yêu cầu trong prompt                                                              | Nguồn                                                                                                             |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Runtime AI local qua Ollama, gọi HTTP cục bộ cho chat + embedding                 | OVERVIEW.md mục 5 "Chọn mô hình" · mục 8 gợi ý Ollama · ADR D3                                                    |
| `ProviderRegistry` + interface `LLMProvider { chat, embed, test }`, v1 chỉ Ollama | ADR D3                                                                                                            |
| Kiểm tra kết nối (test)                                                           | OVERVIEW.md mục 5 "kiểm tra kết nối" · prototype.html dòng 486 (tag "Đã kết nối")                                 |
| Danh sách mô hình trả lời lấy động từ Ollama, chọn 1 làm mặc định                 | prototype.html dòng 488–493 (Qwen 2.5 7B / Llama 3.1 8B / Mistral 7B) · OVERVIEW.md mục 5                         |
| Mô hình embedding, chọn/hiển thị                                                  | prototype.html dòng 495 (`nomic-embed-text`, 274 MB)                                                              |
| Lưu lựa chọn model bền vững                                                       | ADR D3 (hệ quả suy ra) — nêu là điểm cần chốt ở Ambiguities #1                                                    |
| Modelchip "Local · qwen2.5:7b" ở composer Workspace phản ánh model đang chọn      | prototype.html dòng 413                                                                                           |
| Nút "Tải thêm mô hình"                                                            | prototype.html dòng 496 — phạm vi nêu ở Ambiguities #6                                                            |
| Onboarding lần đầu kiểm tra Ollama đã cài/đang chạy, hướng dẫn nếu thiếu          | OVERVIEW.md mục 5 "Onboarding lần đầu" · ADR D3 "Đổi lại: onboarding cần bước kiểm tra/cài Ollama" · ADR "Hệ quả" |
| Thay khung onboarding placeholder của 001-app-shell bằng nội dung thật            | docs/intake/001-app-shell.md mục "Ambiguities #2" (đã ghi nhận là việc của feature sau) · ADR D8                  |
| Gọi Ollama ở main process, renderer qua IPC whitelisted                           | Constitution Principle III · ADR D5                                                                               |
| Ollama local KHÔNG vi phạm no-egress; privacy indicator vẫn "Chạy cục bộ"         | Constitution Principle I · ADR D3 (Ollama = local)                                                                |
| IPC mới thêm vào `src/shared/ipc/channels.ts`, không đổi 5 kênh cũ                | `src/shared/ipc/channels.ts` (comment "Feature sau THÊM kênh mới ở đây") · Constitution Principle III             |
| Thứ tự pha: ai-runtime sau app-shell, trước notebooks/ingestion/rag-qa            | ADR D8 · Constitution Principle V                                                                                 |
| Ngoài phạm vi: online provider, ingestion thực, RAG/chat UI, tự tải model lớn     | ADR D8 · OVERVIEW.md mục 10                                                                                       |

## Glossary check

Thuật ngữ dùng trong feature 007-ai-runtime, đối chiếu `docs/00-glossary.md`:

| Thuật ngữ dùng trong prompt                                    | Có trong glossary?                             | Ghi chú                                                                                                                                                                |
| -------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nhà cung cấp AI / provider                                     | Có (dòng 22)                                   | Dùng đúng tên chuẩn `provider`; glossary đã ghi "local (Ollama) │ online (...)" — khớp scope feature này                                                               |
| Chạy cục bộ / local                                            | Có (dòng 23)                                   | Dùng đúng tên chuẩn `local`                                                                                                                                            |
| Vector nhúng / embedding                                       | Có (dòng 15)                                   | Dùng đúng tên chuẩn `embedding`                                                                                                                                        |
| Chỉ báo riêng tư / privacy indicator                           | Có (dòng 24)                                   | Không đổi hành vi badge, chỉ xác nhận vẫn hiển thị "local"                                                                                                             |
| Khung chào mừng lần đầu / first-run onboarding                 | Có (dòng 26)                                   | Glossary đã ghi `OnboardingState.completed`, cờ ở OS settings store, key `onboardingComplete` — feature này cần làm rõ có mở rộng state này không (xem Ambiguities #5) |
| Cài đặt / settings                                             | Có (dòng 28)                                   | Route `/settings` đã tồn tại từ 001; feature này lắp nội dung thật vào phần "AI cục bộ (Ollama)"                                                                       |
| Runtime AI local                                               | **Không có** entry riêng                       | Khái niệm mới — xem đề xuất bên dưới                                                                                                                                   |
| Mô hình embedding (model, phân biệt với khái niệm "embedding") | **Không có** entry riêng cho "model"/"mô hình" | Glossary có `embedding` (khái niệm vector) nhưng chưa có term cho "model" (Qwen/Llama/nomic-embed-text...) như một khái niệm nghiệp vụ                                 |
| Kiểm tra kết nối                                               | **Không có**                                   | Hành động cụ thể trong UI (nút/badge), chưa chuẩn hoá tên tiếng Anh                                                                                                    |

### Thuật ngữ mới (append vào glossary)

| Tiếng Việt                                                                        | Đề xuất English (code)                                                       | Ghi chú                                                                                                                            |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Runtime AI local (lớp chạy Ollama cục bộ, phục vụ chat + embedding)               | `AI runtime` hoặc `local AI runtime`                                         | Khái niệm hạ tầng mới do feature 007 định nghĩa; đề xuất dùng `ai-runtime` làm feature-slug (khớp `src/main/services/ai-runtime/`) |
| Mô hình (AI) — LLM hoặc embedding model cụ thể (Qwen 2.5 7B, nomic-embed-text...) | `model`                                                                      | Phân biệt với `embedding` (khái niệm vector) đã có; ví dụ field `selectedChatModel`, `selectedEmbeddingModel`                      |
| Mô hình trả lời (LLM dùng để chat)                                                | `chat model`                                                                 | Đối lập với `embedding model`                                                                                                      |
| Mô hình embedding                                                                 | `embedding model`                                                            | Ghép từ `model` + `embedding` đã có sẵn trong glossary, chỉ cần thêm entry ghép                                                    |
| Kiểm tra kết nối (hành động xác nhận provider sẵn sàng)                           | `connection test` / hàm `test()` trên `LLMProvider` (đã có tên trong ADR D3) | Khớp interface `LLMProvider.test()`                                                                                                |
| Nhà cung cấp đăng ký (registry quản lý các provider)                              | `ProviderRegistry`                                                           | Đã có tên chính xác trong ADR D3, đề xuất ghi nhận vào glossary để mọi feature dùng thống nhất                                     |

_(Đây là đề xuất — người phụ trách append vào `docs/00-glossary.md` trong branch `007-ai-runtime`,
không tự sửa ở đây.)_

## Suggested constitution amendments

Không đề xuất sửa constitution. Principle I (Local-first & No Default Egress) đã đủ rõ để khẳng định gọi
Ollama cục bộ không phải egress; Principle III (Desktop Security Boundary) đã đủ rõ về việc mọi truy cập
mạng/model phải ở main process qua IPC whitelisted; Principle V (Phased Delivery) đã xác định đúng vị trí
ai-runtime trong chuỗi dependency. Không phát hiện gap cần nguyên tắc mới từ tài liệu nguồn của feature
này — các điểm còn mơ hồ (lưu trữ lựa chọn, hành vi offline, onboarding blocking...) là chi tiết cấp
feature, phù hợp xử lý ở `/speckit-clarify` chứ không phải sửa constitution.
