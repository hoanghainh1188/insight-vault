# InsightVault — Trợ lý tri thức cục bộ (local-first)

[English](README.md) · **Tiếng Việt**

InsightVault là **ứng dụng desktop (macOS + Windows)** để hỏi đáp tài liệu của chính bạn bằng AI — kiểu
NotebookLM nhưng **chạy hoàn toàn trên máy**. Nạp tài liệu vào notebook; InsightVault phân tích và lập chỉ mục
ngay trên máy, rồi trả lời câu hỏi và viết tóm tắt bằng LLM cục bộ. Mọi câu trả lời kèm **trích dẫn kiểm chứng
được**: bấm chip `[n]` là nguồn mở ra đúng trang, đoạn hoặc mốc thời gian, có tô sáng.

> Dành cho người xử lý nhiều tài liệu và coi trọng quyền riêng tư — nhà nghiên cứu, luật sư, nhà báo,
> sinh viên, kỹ sư — đặc biệt với dữ liệu nhạy cảm không muốn tải lên máy chủ bên thứ ba.

## Điểm khác biệt cốt lõi (bất biến)

- **Local-first** — dữ liệu không rời máy ở chế độ mặc định.
- **Kiểm chứng được** — mọi câu trả lời trích dẫn đúng đoạn nguồn (trang / mốc thời gian / đoạn văn), và mô hình
  không được bịa trích dẫn: nguồn không có câu trả lời thì nói "Không tìm thấy trong nguồn".
- **Offline & tự chủ** — chạy không cần Internet; người dùng kiểm soát mô hình và chi phí.

## Tính năng

- **Nguồn:** PDF (giữ thứ tự đọc, bảng biểu, trang nhiều cột), `.docx`, `.txt`, `.md`, trang web (URL),
  **audio** (`.wav` `.mp3` `.flac` `.ogg` `.m4a` `.aac` — bóc băng cục bộ bằng Whisper),
  **video** (`.mp4` `.mov` `.webm` `.mkv`), **ảnh** (`.png` `.jpg` `.webp` `.bmp` `.tiff` — OCR cục bộ, Việt + Anh).
- **Hỏi đáp có trích dẫn** — trả lời dạng stream, truy xuất lai (vector + toàn văn), chế độ "theo nguồn" từ chối
  trả lời ngoài tài liệu, hoặc chế độ "mở rộng" có gắn nhãn rõ.
- **Bộ chấm độ liên quan** — một mô hình nhỏ chạy cục bộ kiểm tra đoạn tìm được có thật sự trả lời câu hỏi không, nên câu
  hỏi mà nguồn không có được báo "Không tìm thấy trong nguồn" ngay thay vì đoán (tải một lần ~120 MB; trong lúc chưa sẵn
  sàng hỏi đáp vẫn chạy như trước).
- **Trình xem nguồn** — mở đoạn được trích có tô sáng; audio/video tua tới mốc được trích; ảnh hiện vùng chữ.
- **Studio** — tóm tắt, ý chính, FAQ, dàn ý cho cả notebook (notebook lớn được xử lý theo phần mà vẫn giữ trích
  dẫn chính xác). Sao chép hoặc xuất Markdown.
- **AI online tuỳ chọn** — dùng Claude, Gemini hoặc OpenAI bằng **API key của chính bạn** (lưu trong keychain hệ
  điều hành). Huy hiệu riêng tư hiện mỗi khi có dữ liệu gửi ra ngoài; một chạm để quay về mô hình cục bộ.
- **Sao lưu & khôi phục** — **Cài đặt → Lưu trữ cục bộ** xuất toàn bộ vault ra 1 file `.ivbackup`, tuỳ chọn mã
  hoá bằng mật khẩu (AES-256-GCM). Bản sao lưu không gồm file gốc, mô hình đã tải và khoá API.
- **Giao diện Tiếng Việt và English** — lần đầu theo ngôn ngữ hệ điều hành; đổi bất cứ lúc nào ở **Cài đặt › Ngôn ngữ**
  (áp dụng ngay). Chat trả lời theo ngôn ngữ câu hỏi; Studio viết theo ngôn ngữ giao diện.
- Tìm toàn văn trong nguồn, lịch sử chat, phím tắt, thông báo cho trình đọc màn hình.

## Cài đặt

1. Tải bản cài mới nhất ở [Releases](https://github.com/hoanghainh1188/insight-vault/releases/latest):
   `InsightVault-<version>-arm64.dmg` (macOS, Apple Silicon) hoặc `InsightVault-<version>-Setup.exe` (Windows x64).
2. Cài [Ollama](https://ollama.com) và tải một mô hình chat, ví dụ `ollama pull qwen2.5:7b` (app gợi ý mô hình
   hợp với RAM). Nhúng, bộ chấm độ liên quan, bóc băng và OCR chạy ngay trong app — mô hình của chúng tải một lần khi dùng lần đầu.
3. Bản cài **chưa ký số**:
   - macOS: chuột phải vào app → **Open**, hoặc `xattr -dr com.apple.quarantine /Applications/InsightVault.app`.
   - Windows: SmartScreen → **More info → Run anyway**.

## Phát triển

```bash
npm install
npm run dev        # mở cửa sổ Electron (HMR renderer)
```

| Lệnh                     | Việc                                                    |
| ------------------------ | ------------------------------------------------------- |
| `npm run lint`           | prettier --check + eslint + tsc                         |
| `npm test`               | Vitest unit + coverage (≥ 80% business logic)           |
| `npm run build`          | lint + electron-vite build (main/preload/renderer)      |
| `npm run test:e2e`       | Playwright `_electron` (cần bản build + display)        |
| `npm run eval:retrieval` | đánh giá chất lượng truy xuất trên bộ dữ liệu công khai |
| `npm run dist`           | đóng gói bản cài bằng electron-builder                  |

Tech stack và ranh giới bảo mật: xem [README tiếng Anh](README.md#tech-stack) và
[`docs/04-decisions/2026-07-10-tech-stack.md`](docs/04-decisions/2026-07-10-tech-stack.md).
Yêu cầu sản phẩm: [`docs/OVERVIEW.md`](docs/OVERVIEW.md). Nguyên tắc bất di bất dịch:
[`.specify/memory/constitution.md`](.specify/memory/constitution.md).

## Cách làm việc (spec-driven)

Dự án dùng **[GitHub Spec Kit](https://github.com/github/spec-kit)** + runbook `/design-to-code` (Claude Code)
để đi từ tài liệu thiết kế → spec → plan → tasks → code, kèm subagent `design-intake`, `code-reviewer`,
`glossary-steward`, `security-reviewer`. Mỗi feature = 1 GitHub issue → branch `NNN-<slug>` (`NNN` = số issue).
Quy ước: [`CLAUDE.md`](CLAUDE.md). Làm việc nhóm: [`docs/TEAM-WORKFLOW.md`](docs/TEAM-WORKFLOW.md).

## Đóng góp

Hoan nghênh báo lỗi và đề xuất — issue viết bằng tiếng Việt hoặc tiếng Anh đều được.
Xem [CONTRIBUTING.md](CONTRIBUTING.md).

## Giấy phép

MIT — xem [`LICENSE`](LICENSE).

**Bên thứ ba:** ffmpeg đóng gói kèm qua `ffmpeg-static` (tách audio khỏi video), giấy phép **GPL**; giấy phép đi kèm
bản cài (`node_modules/ffmpeg-static/ffmpeg.LICENSE`). Nếu sau này làm tầng trả phí độc quyền, cân nhắc build ffmpeg
LGPL — xem [`docs/04-decisions/2026-07-13-video-clarify.md`](docs/04-decisions/2026-07-13-video-clarify.md).
