# Intake — 053-image (issue #53)

Pha 2c — khép lại đa phương tiện: nạp ẢNH → OCR local (tesseract.js) → RAG + chip `[n]` → Source
Viewer hiện `<img>` với **highlight vùng bbox** đúng đoạn trích dẫn.

## Input sources

- `docs/OVERVIEW.md` — mục 5 "Pha 2 (sau khi Pha 1 chạy ổn)": _"Hình ảnh: OCR + mô tả nội dung; đưa
  vào cùng pipeline chỉ mục."_; mục 6 ràng buộc bất biến #1 (local-first/no egress mặc định), #3
  (trích dẫn map đúng vị trí gốc — trang/timestamp/đoạn).
- `docs/03-ui/prototype.html`:
  - Modal "Thêm nguồn" (`#addOverlay`, dòng ~442-447): 4 loại nguồn — ô **"Hình ảnh"** (`OCR + mô tả`)
    hiện chưa có class `on`/tương tác thật trong prototype tĩnh (chỉ tệp/PDF là `type on` mẫu); theo
    ADR 053, ô này cần được BẬT (hiện tại app thật đang disable — cần kiểm code `AddSourceModal.tsx`
    khi vào /speckit-plan).
  - Danh sách nguồn mẫu (dòng ~387) có card "Ảnh chụp phụ lục ký tay" — `Đang OCR… 62%` — xác nhận UI
    đã dự trù trạng thái tiến độ OCR dạng % giống pipeline nạp nguồn khác.
  - Màn S4 "Xem nguồn có highlight" (`#s4`, dòng ~462-479) hiện tại prototype CHỈ minh hoạ text
    highlight cho PDF/hợp đồng (span `.hl` + `.hltag`). **Không có** minh hoạ overlay bbox trên ảnh —
    đây là phần mới, InsightVault phải tự thiết kế thêm view ảnh (`<img>` + khung overlay) theo cùng
    văn phong header/pager của S4 (giữ `vhead`, `backlink`, tiêu đề nguồn + "Nguồn của trích dẫn [n]").
- `docs/04-decisions/2026-07-13-image-clarify.md` — **NGUỒN QUYẾT ĐỊNH CHÍNH cho scope 053** (đã
  thảo luận trước, 3 quyết định pivotal + giả định + phạm vi). Tóm tắt áp dụng nguyên vẹn:
  1. Engine = CHỈ OCR tesseract.js (WASM), chạy ở **main**; KHÔNG vision Ollama (ngoài phạm vi).
  2. Traineddata (vie+eng) TẢI LẦN ĐẦU — cache `<dataDir>/models/tesseract`, badge egress khi tải,
     sau đó offline (nhất quán pattern Whisper 045).
  3. Highlight **VÙNG BBOX** trên ảnh khi bấm chip `[n]` (map toạ độ pixel → % chuẩn hoá để co giãn).
  - Giả định: định dạng png/jpg/jpeg/webp/bmp/tiff (heic ngoài phạm vi, gif→khung đầu); size
    50MB/nguồn; `Locator.bbox` chuẩn hoá 0..1 (backward-compat như tStart/tEnd); ảnh không chữ (OCR
    rỗng) vẫn nạp thành công (ready, 0 chunk); bbox mức DÒNG; ngôn ngữ OCR cố định vie+eng.
- `docs/04-decisions/2026-07-12-audio-transcribe-clarify.md` (045) — pattern kế thừa: cache model
  lần đầu + badge egress + progress qua `SourceProgressEvent` (037); `Locator` mở rộng field mới
  backward-compat (`tStart?/tEnd?` → tương tự `bbox?`); `timeMap` (char-offset ↔ time) là tiền lệ
  trực tiếp cho `boxMap` (char-range ↔ bbox) của 053; hàm map là THUẦN (`timeForCharRange` →
  `bboxForCharRange`).
- `docs/04-decisions/2026-07-13-video-clarify.md` (051) — pattern kế thừa: `iv-media://` mở rộng
  thêm MIME theo `kind` mới mà KHÔNG cần migration (045 đã bỏ CHECK `source.kind`); CSP chỉ cần touch
  đúng 1 directive liên quan (051 không đổi `media-src`; 053 chỉ thêm `iv-media:` vào `img-src`).
- `.specify/memory/constitution.md`:
  - Principle I (Local-first & No Default Egress): traineddata OCR tải lần đầu = egress có kiểm
    soát, phải có badge; sau đó chạy hoàn toàn offline.
  - Principle II (Verifiable Citations): locator `{bbox}` phải gắn NGAY lúc tạo chunk (cấm ước lượng
    sau); chip `[n]` map xác định tới đúng vùng bbox trên ảnh.
  - Principle III (Desktop Security Boundary): OCR chạy ở main process; renderer đọc ảnh qua
    `iv-media://` (không FS trực tiếp); không log nội dung/đường dẫn ảnh.
  - Principle IV (Test-First & Coverage ≥80% business logic).
  - Principle V (Phased Delivery): 053 là bước cuối Pha 2 (2a audio → 2b video → 2c ảnh), chạy sau
    khi 2a/2b đã ổn.
- Figma: **không áp dụng** cho feature này — dự án InsightVault không dùng Figma làm nguồn thiết kế
  (nguồn UI gốc là `docs/03-ui/prototype.html`, không phải Figma MCP). Không có node ID để tra.

## Prompt for /speckit-specify

> Xây tính năng nạp **Hình ảnh (ảnh chụp/scan/screenshot)** làm nguồn (`source`) trong notebook,
> khép lại Pha 2 (đa phương tiện) sau audio (045) và video (051). Người dùng bật ô **"Hình ảnh"**
> trong modal "Thêm nguồn" (hiện đang bị disable), chọn/kéo thả ảnh định dạng **png, jpg/jpeg, webp,
> bmp, tiff** (giới hạn **50MB/nguồn**; heic ngoài phạm vi, gif chỉ lấy khung đầu). Ảnh được xử lý
> **OCR (Optical Character Recognition — nhận dạng ký tự quang học)** hoàn toàn ở **main process**
> bằng **tesseract.js (WASM)**, ngôn ngữ cố định **vie+eng** (tiếng Việt + tiếng Anh), trích ra text
> kèm **bbox (bounding box — vùng bao hình chữ nhật)** cho từng dòng chữ nhận dạng được.
>
> Lần đầu chạy OCR, app tự động **tải traineddata (bộ dữ liệu huấn luyện ngôn ngữ)** cho vie+eng về
> thư mục dữ liệu cục bộ (`<dataDir>/models/tesseract`), hiển thị **tiến độ tải** (tái dùng cơ chế
> `SourceProgressEvent` đã có) và bật **chỉ báo riêng tư (badge egress)** trong lúc tải vì đây là lần
> duy nhất cần Internet — sau đó OCR chạy **hoàn toàn offline**, đúng pattern đã áp dụng cho model
> Whisper ở tính năng bóc băng audio (045).
>
> Text OCR được đưa vào pipeline chỉ mục hoá sẵn có: chunk theo ký tự như văn bản thường, đồng thời
> gắn kèm **`boxMap`** — cơ chế ánh xạ khoảng ký tự (char-range) sang vùng bbox, tương tự `timeMap`
> của audio ánh xạ khoảng ký tự sang mốc thời gian. Mỗi `chunk` sau khi tạo phải có `Locator.bbox`
> (hợp các bbox dòng giao với khoảng ký tự của chunk đó) gắn NGAY tại thời điểm chunk hoá — không
> được ước lượng lại sau. `Locator.bbox` là 1 field mới **backward-compat**, dạng `{x,y,w,h}`
> **chuẩn hoá theo tỉ lệ 0..1** so với kích thước gốc của ảnh (để overlay co giãn đúng theo kích
> thước hiển thị thực tế trên màn hình, không phụ thuộc pixel tuyệt đối).
>
> Nguồn ảnh nhận `kind = "image"` — không cần thêm migration schema (theo tiền lệ 045 đã bỏ ràng buộc
> CHECK trên cột `source.kind`). Ảnh **không có chữ** (kết quả OCR rỗng) vẫn được coi là nạp **thành
> công** — trạng thái `ready`, 0 chunk, ảnh vẫn xem được bình thường trong Source Viewer (không có
> chip trích dẫn) — nhất quán với hành vi video không có audio track (051).
>
> Khi người dùng bấm chip trích dẫn `[n]` liên kết tới một chunk từ nguồn ảnh, **Source Viewer** phải
> mở ảnh gốc (thẻ `<img>`, phục vụ qua giao thức nội bộ `iv-media://` đã có — chỉ cần thêm MIME type
> cho ảnh) và vẽ **overlay khung (khung viền/box) đúng vùng bbox** của đoạn trích dẫn đó, map toạ độ
> chuẩn hoá 0..1 sang toạ độ pixel hiển thị thực tế của `<img>` trên màn hình. Đây là điểm khác biệt
> so với text/audio/video: thay vì highlight đoạn text hoặc tua thời gian, người dùng "nhìn thấy đúng
> vùng ảnh" mà câu trả lời trích dẫn — giữ đúng cam kết "Kiểm chứng được" (Principle II Constitution).
>
> Ảnh được tham chiếu từ **đường dẫn gốc trên đĩa** (đọc qua path lưu trong DB tại main process,
> KHÔNG copy vào data dir, KHÔNG đi qua renderer dưới dạng nội dung đầy đủ — renderer chỉ nhận
> `iv-media://source/<id>` như audio/video). CSP hiện tại (`img-src 'self' data:`) cần bổ sung thêm
> `iv-media:` vào đúng directive `img-src` (không đụng các directive khác).
>
> **Assumptions (theo ADR `docs/04-decisions/2026-07-13-image-clarify.md`, đã chốt sẵn — spec ghi
> nhận, KHÔNG hỏi lại trong clarify trừ khi intake nêu ambiguity mới bên dưới):**
>
> - Định dạng hỗ trợ: png, jpg, jpeg, webp, bmp, tiff. heic ngoài phạm vi (cần chuyển đổi trước).
>   gif → chỉ lấy khung hình đầu tiên.
> - Giới hạn kích thước: 50MB/nguồn.
> - Ngôn ngữ OCR cố định: vie+eng (không cho chọn ngôn ngữ khác ở v1).
> - bbox ở mức DÒNG (line-level) — hợp vùng chữ nhật đủ lớn để bao trọn 1 dòng chữ, không tới mức
>   từng từ.
> - Ảnh không chữ → vẫn nạp thành công (ready, 0 chunk) — không báo lỗi, không chặn người dùng.
> - OCR chạy ở main process; ảnh đọc theo path lưu ở DB; không log nội dung/đường dẫn ảnh.
> - KHÔNG có migration schema DB mới. CSP chỉ thêm `iv-media:` vào `img-src`.
>
> **Ngoài phạm vi 053 (explicit exclusions):** vision Ollama (mô tả nội dung ảnh không chữ — để pha
> sau, có gắn nhãn AI theo Constitution II "mở rộng" nếu làm); định dạng heic; layout/table/
> handwriting detection nâng cao; tiền xử lý ảnh nâng cao (deskew/threshold) ngoài mặc định
> tesseract.js.

## Ambiguities to raise in /speckit-clarify

ADR `2026-07-13-image-clarify.md` đã chốt phần lớn quyết định pivotal (engine, cache model, highlight
strategy) — các điểm đó **không liệt kê lại** ở đây (áp dụng thẳng theo rule 2/6 CLAUDE.md). Các điểm
dưới đây là **giả định (Assumptions)** trong ADR mà ADR tự ghi chú "clarify xác nhận nếu intake nêu" —
tức ADR chủ động để ngỏ cho vòng clarify xác nhận lại, không phải mâu thuẫn tài liệu, nhưng cần chốt
minh bạch trong spec trước khi implement:

1. **Định dạng ảnh hỗ trợ** — ADR liệt kê png/jpg/jpeg/webp/bmp/tiff và loại heic. Cần xác nhận danh
   sách này là đủ (không có khách hàng/basic design nào yêu cầu heic hoặc định dạng khác), và xác
   nhận hành vi khi người dùng chọn định dạng không hỗ trợ (báo lỗi rõ loại nào, chặn ở bước chọn file
   hay chặn sau khi queue).
2. **Ảnh không có chữ (OCR rỗng)** — ADR đề xuất mặc định "vẫn nạp thành công, ready, 0 chunk" (giống
   video no-audio 051). Cần xác nhận có cần hiển thị thông báo nhẹ nào cho người dùng biết "ảnh này
   không có chữ để trích dẫn" (như video no-audio có báo "không có audio để bóc băng" theo C3 của 051) hay im lặng hoàn toàn.
3. **Giới hạn kích thước 50MB/nguồn** — xác nhận con số cụ thể (so với audio 200MB, video 1GB — ảnh
   50MB có hợp lý không, hay cần điều chỉnh theo nhu cầu thực tế scan tài liệu độ phân giải cao).
4. **bbox mức DÒNG hay mức TỪ** — ADR chốt mức dòng ("hợp vùng cho chunk nhiều dòng"). Cần xác nhận
   độ chính xác này đã đủ cho mục tiêu "kiểm chứng bằng mắt" hay người dùng cần khoanh vùng chính xác
   hơn tới từng từ (ảnh hưởng độ phức tạp `bboxForCharRange`).
5. **Đóng gói tesseract.js-core (WASM/worker)** — thiên về quyết định kỹ thuật của `/speckit-plan`
   hơn là business ambiguity, nhưng nêu ở đây để clarify cân nhắc có cần chốt sớm: worker script +
   wasm binary đóng gói kèm app (ngoài asar như ffmpeg-static 051) hay tải riêng cùng lúc với
   traineddata. Ảnh hưởng kích thước cài đặt và luồng tải lần đầu.
6. **Trạng thái tiến độ OCR trong queue "Thêm nguồn"** — prototype có sẵn mẫu "Đang OCR… 62%"
   (dòng ~387 `prototype.html`) nhưng đó là card trong danh sách nguồn (cột Nguồn), không phải trong
   modal "Thêm nguồn". Cần xác nhận queue trong modal (`.qi` items) cũng hiển thị % tiến độ OCR theo
   đúng format `SourceProgressEvent` như các kind khác, hay có bước riêng ("Đang tải traineddata…" →
   "Đang OCR…") cần phân biệt rõ trong UI.

## Thuật ngữ mới (append vào glossary)

`docs/00-glossary.md` đã có sẵn field `{bbox}` được nhắc TRONG ngoặc ở dòng định nghĩa `locator`
(dòng 16) nhưng **chưa có entry riêng, đầy đủ** cho các thuật ngữ nghiệp vụ mới của 053. Đề xuất
append (theo đúng format bảng hiện có, cột 日本語 để `—`):

| Tiếng Việt (đề xuất)                                               | English (đề xuất, dùng trong code)  | Ghi chú                                                                                                      |
| ------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Nhận dạng ký tự quang học (bóc chữ từ ảnh)                         | OCR / optical character recognition | tesseract.js (WASM), chạy local ở main, ngôn ngữ `vie+eng` — 053                                             |
| Vùng bao (khung chữ nhật quanh vùng chữ trên ảnh)                  | bbox (bounding box)                 | `{x,y,w,h}` chuẩn hoá 0..1 theo kích thước ảnh; field mới `Locator.bbox?` (backward-compat) — 053            |
| Ánh xạ khoảng ký tự ↔ vùng bao                                     | boxMap                              | Tương tự `timeMap` (045); hàm THUẦN `bboxForCharRange` hợp bbox các dòng giao với char-range của chunk — 053 |
| Nguồn hình ảnh                                                     | source kind=image                   | File ảnh (png/jpg/jpeg/webp/bmp/tiff); OCR (tesseract.js) → text+bbox; xem qua `iv-media://` — 053           |
| Bộ dữ liệu huấn luyện ngôn ngữ OCR (tesseract)                     | traineddata                         | Cache `<dataDir>/models/tesseract`; tải lần đầu, badge egress, sau đó offline — 053                          |
| Lớp phủ khoanh vùng (khung highlight trên ảnh trong Source Viewer) | bbox overlay                        | Vẽ trên `<img>` tại đúng vùng `Locator.bbox` của trích dẫn đang mở — 053                                     |

Lưu ý: các dòng trên nối tiếp đúng phong cách các dòng 84-89 hiện có (audio/video terminology) —
người phụ trách append thêm 6 dòng này vào cuối bảng `docs/00-glossary.md` trong branch feature
`053-image` (rule 5 CLAUDE.md — thêm mới được làm ngay, không cần PR riêng).

## Suggested constitution amendments

Không đề xuất sửa constitution. Feature 053 tuân thủ đầy đủ các nguyên tắc hiện có (I–V) mà không
cần mở rộng nguyên tắc mới:

- Principle I: pattern "tải model lần đầu + badge egress + offline sau đó" đã được khái quát hoá đúng
  mức qua 045 (Whisper) và tái áp dụng nguyên vẹn cho 053 (traineddata tesseract) — không cần rule
  mới, chỉ là áp dụng nhất quán.
- Principle II: field `Locator.bbox` mở rộng đúng theo tinh thần "mỗi chunk giữ locator ngay lúc tạo"
  đã quy định — không cần amendment, chỉ minh hoạ thêm 1 kiểu locator cụ thể (đã liệt kê sẵn `{bbox}`
  trong nguyên tắc II từ đầu, dòng 54 constitution: _"`{bbox}` cho ảnh"_).
- Không phát sinh nguyên tắc bảo mật/kiến trúc mới ngoài III (main-process-only OCR, không log nội
  dung/path) đã đủ bao quát.

Nếu về sau có amendment thật sự cần thiết, đó sẽ là ở **Pha 3+ (vision Ollama mô tả ảnh không chữ)**
— lúc đó cần làm rõ ranh giới "mở rộng" (Principle II) cho câu trả lời KHÔNG kiểm chứng được bằng
bbox, nhưng việc đó nằm ngoài phạm vi 053 và không cần quyết ngay bây giờ.
