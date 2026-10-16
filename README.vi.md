# Quillhold — Trợ lý tri thức cục bộ (local-first)

[English](README.md) · **Tiếng Việt**

Quillhold là **ứng dụng desktop (macOS + Windows)** để hỏi đáp tài liệu của chính bạn bằng AI — kiểu
NotebookLM nhưng **chạy hoàn toàn trên máy**. Nạp tài liệu vào notebook; Quillhold phân tích và lập chỉ mục
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
  **audio** (`.wav` `.mp3` `.flac` `.ogg` `.m4a` `.aac` — bóc băng cục bộ bằng Whisper, tự nhận tiếng Việt hoặc
  tiếng Anh),
  **video** (`.mp4` `.mov` `.webm` `.mkv`), **ảnh** (`.png` `.jpg` `.webp` `.bmp` `.tiff` — OCR cục bộ, Việt + Anh).
- **Hỏi đáp có trích dẫn** — trả lời dạng stream, truy xuất lai (vector + toàn văn), chế độ "theo nguồn" từ chối
  trả lời ngoài tài liệu, hoặc chế độ "mở rộng" có gắn nhãn rõ.
- **Bộ chấm độ liên quan** — một mô hình nhỏ chạy cục bộ kiểm tra đoạn tìm được có thật sự trả lời câu hỏi không, nên câu
  hỏi mà nguồn không có được báo "Không tìm thấy trong nguồn" ngay thay vì đoán (tải một lần ~120 MB; trong lúc chưa sẵn
  sàng hỏi đáp vẫn chạy như trước).
- **Ghi cuộc họp** _(thử nghiệm)_ — ghi âm từ micro thẳng vào notebook. Trong lúc ghi có **transcript nháp** kèm mốc
  thời gian (bấm để nghe lại), chỉ báo mức âm thanh, tự nhận ngôn ngữ và đổi được sang Tiếng Việt / English, cùng
  **đánh dấu** (Quyết định, Việc cần làm, Câu hỏi). Khi kết thúc, bản ghi được bóc băng lại trên máy và thành một nguồn để
  tìm kiếm, hỏi đáp, dùng trong Studio, với trích dẫn tua đúng thời điểm. **Trình xem cuộc họp** tô câu đang phát, bấm câu
  để tua, tìm trong transcript, xem đánh dấu, sao chép hoặc xuất Markdown. Bản ghi bị gián đoạn do sự cố có thẻ phục hồi;
  thoát app khi đang ghi sẽ được hỏi trước; phím tắt ⌘/Ctrl+Shift+P (tạm dừng), M (đánh dấu), E (kết thúc). Chưa được thử
  với micro thật trên Windows — gặp lỗi xin báo lại.
- **Trình xem nguồn** — mở đoạn được trích có tô sáng; audio/video tua tới mốc được trích; ảnh hiện vùng chữ.
- **Studio** — 8 loại tổng hợp cho cả notebook: tóm tắt, ý chính, FAQ, dàn ý, hướng dẫn học, bản tóm lược, dòng thời
  gian, bảng thuật ngữ — cùng ô **yêu cầu tuỳ chỉnh** (tự gõ yêu cầu, tối đa 500 ký tự). Chọn **một vài nguồn** làm
  phạm vi, xem chữ hiện dần khi AI đang viết (huỷ được bất cứ lúc nào), mỗi loại giữ **10 phiên bản** gần nhất để xem
  lại hoặc xoá. Notebook lớn được xử lý theo phần mà vẫn giữ trích dẫn chính xác. Sao chép hoặc xuất Markdown.
- **AI online tuỳ chọn** — dùng Claude, Gemini hoặc OpenAI bằng **API key của chính bạn** (lưu trong keychain hệ
  điều hành). Huy hiệu riêng tư hiện mỗi khi có dữ liệu gửi ra ngoài; một chạm để quay về mô hình cục bộ.
- **Sao lưu & khôi phục** — **Cài đặt → Lưu trữ cục bộ** xuất toàn bộ vault ra 1 file `.ivbackup`, tuỳ chọn mã
  hoá bằng mật khẩu (AES-256-GCM). Bản sao lưu không gồm file gốc, mô hình đã tải và khoá API.
- **Giao diện Tiếng Việt và English** — lần đầu theo ngôn ngữ hệ điều hành; đổi bất cứ lúc nào ở **Cài đặt › Ngôn ngữ**
  (áp dụng ngay). Chat trả lời theo ngôn ngữ câu hỏi; Studio viết theo ngôn ngữ giao diện.
- Tìm toàn văn trong nguồn, lịch sử chat, phím tắt, thông báo cho trình đọc màn hình.

## Cài đặt

1. Tải bản cài mới nhất ở [Releases](https://github.com/hoanghainh1188/quillhold/releases/latest):
   `Quillhold-<version>-arm64.dmg` (macOS, Apple Silicon) hoặc `Quillhold-<version>-Setup.exe` (Windows x64).
2. Cài [Ollama](https://ollama.com) và tải một mô hình chat, ví dụ `ollama pull qwen2.5:7b` (app gợi ý mô hình
   hợp với RAM). Nhúng, bộ chấm độ liên quan, bóc băng và OCR chạy ngay trong app — mô hình của chúng tải một lần khi dùng lần đầu.
3. Bản cài **chưa ký số**:
   - macOS: chuột phải vào app → **Open**, hoặc `xattr -dr com.apple.quarantine /Applications/Quillhold.app`.
   - Windows: SmartScreen → **More info → Run anyway**.

## Giới hạn đã biết

- **Câu hỏi cùng chủ đề nhưng tài liệu không trả lời** (ví dụ hỏi về thang máy trong tài liệu về một tuyến đường sắt): bộ chấm độ liên quan vẫn có thể cho qua một đoạn gần chủ đề. Bước trả lời thường vẫn đáp "Không tìm thấy trong nguồn" (216/216 lần trong phép đo với một model chat cục bộ), nhưng model nhỏ hơn có thể kém hơn. Chi tiết: [#187](https://github.com/hoanghainh1188/quillhold/issues/187).
- **Đáp án nằm trong bảng hoặc hộp thông tin phức tạp của PDF** có thể bị bỏ sót khi văn bản trích ra bị trộn (ví dụ hộp thông tin Wikipedia). Trích tốt hơn một mình chưa đủ với bộ chấm hiện tại ([#206](https://github.com/hoanghainh1188/quillhold/issues/206)).
- **Ghi cuộc họp còn thử nghiệm**: chưa thử trên nhiều micro, tai nghe Bluetooth và máy Windows ([#186](https://github.com/hoanghainh1188/quillhold/issues/186)).
- **Bản chưa ký số, không tự cập nhật**: macOS và Windows cảnh báo ở lần mở đầu (xem Cài đặt); bản mới cài thủ công từ Releases.

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

**Bên thứ ba:** danh sách đầy đủ thư viện, mô hình và giấy phép nằm ở [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)
(sinh lại bằng `npm run licenses`; cũng được đóng gói kèm app). Tách audio khỏi video dùng bản **LGPL** tối giản của
FFmpeg 7.1.1 (`--disable-gpl --disable-nonfree`), dựng từ mã nguồn bởi [`scripts/build-ffmpeg-lgpl.sh`](scripts/build-ffmpeg-lgpl.sh)
(`npm run ffmpeg:build`) — chạy một lần trước `npm run dev` / `dist` nếu cần hỗ trợ video. Không phân phối mã GPL/nonfree..
