# ingestion clarify — chốt 14 ambiguity (011-ingestion)

- Ngày: 2026-07-11
- Feature liên quan: `011-ingestion` (pha 004, issue #11)
- Nguồn: `docs/intake/011-ingestion.md` (14 ambiguity) + phiên chốt với hoanghainh1188
- Người quyết định: hoanghainh1188 (2026-07-11). 3 quyết định kiến trúc nặng do người dùng chọn trực
  tiếp (đánh dấu ⭐); 11 mục còn lại người dùng ủy quyền "chốt luôn khuyến nghị".
- Ghi chú: 2 quyết định kỹ thuật lớn (chunking, LanceDB) tách thành ADR riêng —
  `2026-07-11-chunking-strategy.md` và `2026-07-11-lancedb-integration.md`. File này tóm tắt + trỏ sang.

## Quyết định theo từng ambiguity

**1. Thư viện parser (theo loại nguồn).** Ưu tiên thư viện thuần JS để tránh native rebuild (chỉ LanceDB
là native):

- PDF → `pdfjs-dist` (pdf.js) chạy ở main; `getTextContent()` theo từng trang → cho phép gắn `page` +
  offset ký tự vào locator. Thống nhất với ADR D4 (pdf.js map locator), dùng lại được ở `006-source-viewer`.
- `.docx` → `mammoth` (`extractRawText`) — thuần JS, phổ biến.
- URL → `fetch` (global của Node 24/Electron main) lấy HTML → `@mozilla/readability` (+ `jsdom` dựng DOM)
  trích nội dung chính → `turndown` chuyển sang markdown sạch.
- `.txt`/`.md` → đọc trực tiếp qua `node:fs`, không cần parser ngoài.

**2. Chiến lược chunk.** → xem ADR `2026-07-11-chunking-strategy.md`. Tóm tắt: chunk theo ký tự, mục tiêu
~1000 ký tự, overlap ~150, cắt ưu tiên theo ranh giới đoạn→câu→cứng; **chunk KHÔNG vắt qua ranh giới
trang PDF** (để `locator.page` đơn trị); offset ký tự tính theo toàn văn bản đã làm sạch của nguồn.

**3. Tích hợp LanceDB.** → xem ADR `2026-07-11-lancedb-integration.md`. Tóm tắt: package `@lancedb/lancedb`
(prebuilt napi, không tự rebuild); store ở `app.getPath('userData')/vectors/`; một bảng `chunks`
(id, notebook_id, source_id, vector, dim); xoá theo `source_id`/`notebook_id` để đồng bộ cascade với SQLite;
MVP dùng brute-force search, tạo index ANN sau khi đủ lớn.

**4. ⭐ Hàng đợi xử lý — TUẦN TỰ, 1 nguồn/lần (người dùng chọn).** FIFO, xử lý xong 1 nguồn mới sang nguồn
kế. Tránh nghẽn CPU/RAM khi parse+embed nặng, tiến độ dễ hiểu, đủ cho desktop cá nhân. Cho phép **huỷ/xoá**
một nguồn đang `queued` hoặc `processing` (xoá khỏi hàng đợi + dọn dữ liệu đã ghi một phần).

**5. ⭐ Ollama chưa sẵn sàng lúc nạp — QUEUE CHỜ, TỰ EMBED SAU (người dùng chọn).** Vẫn parse + chunk + lưu
SQLite ngay; chunk chưa có vector → nguồn ở trạng thái `awaiting_embedding`. Khi runtime AI sẵn sàng
(kiểm tra check-on-demand như ADR ai-runtime), pipeline tự động embed tiếp các nguồn đang chờ và chuyển
sang `ready`. Nạp nguồn KHÔNG bị chặn bởi việc model tạm offline.

**6. Fetch URL & privacy indicator.** Fetch trang web do người dùng chủ động nhập **được coi là egress** →
privacy indicator bật trạng thái "online" trong lúc fetch, tắt lại sau khi xong (nhất quán Constitution I:
chỉ báo phản ánh đúng khi có dữ liệu ra ngoài). Chặn SSRF: chỉ cho scheme `http`/`https`; **từ chối host
phân giải về dải nội bộ/loopback** (127.0.0.0/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7,
localhost); giới hạn số redirect (≤5), kiểm lại host ở mỗi hop; giới hạn dung lượng body tải về (mục 7).
Đây là quyết định bảo mật → chuyển tiếp cho `security-reviewer`.

**7. Giới hạn kích thước.** Cấu hình hằng số: file PDF/docx tối đa **50 MB**, txt/md tối đa **25 MB**, body
URL tối đa **10 MB**. Vượt giới hạn → từ chối với lỗi thân thiện, nguồn chuyển `error` (không crash).

**8. Dedup nguồn trùng.** Tính `content_hash` (sha256) cho tệp, URL chuẩn hoá (bỏ fragment, hạ thấp host)
cho link. Nếu trùng trong **cùng notebook** → **vẫn cho thêm** nhưng trả cờ cảnh báo để renderer hiển thị
xác nhận ("Nguồn này đã có trong notebook — vẫn thêm?"). Không chặn cứng (MVP tôn trọng ý người dùng).

**9. Retry khi lỗi.** Nguồn ở trạng thái `error` có action `source:retry` → chạy lại pipeline **từ đầu**
(re-parse). MVP không retry theo từng bước con; xoá dữ liệu một phần (nếu có) trước khi chạy lại để tránh
rác.

**10. Danh sách kênh IPC `source:*`.** 5 kênh invoke + 1 kênh event (theo khuôn `notebook:*`/`ai:*`):

- `source:add` — thêm tệp/URL vào notebook → trả nguồn mới ở `queued` (kèm cờ `duplicateWarning` nếu trùng).
- `source:listByNotebook` — liệt kê nguồn của notebook kèm trạng thái (snapshot lúc mount).
- `source:get` — chi tiết một nguồn.
- `source:delete` — xoá nguồn (cascade chunk SQLite + vector LanceDB).
- `source:retry` — chạy lại nguồn lỗi.
- `source:progress` — **event push** (main → renderer qua `webContents.send`), whitelist riêng cho kênh
  event (không phải invoke). Xem mục 12.

**11. Cấu trúc `Locator` (dùng chung).** Type shared: `{ page: number | null; charStart: number; charEnd:
number }`. PDF → `page` là số trang (1-based); docx/txt/md/URL → `page = null`. `charStart`/`charEnd` là
offset vào toàn văn bản đã làm sạch của nguồn. Đặt ở `src/shared/` để renderer (source-viewer 006 sau này)
và main dùng chung mà không lộ nội dung.

**12. Báo tiến độ.** Main **chủ động push event** `source:progress` (`webContents.send`) mỗi khi trạng
thái/tiến độ một nguồn đổi → thanh tiến độ realtime, không polling. Preload expose `onSourceProgress(cb)` +
hàm huỷ đăng ký. `source:listByNotebook` cấp snapshot ban đầu khi mở màn.

**13. "Đã lập chỉ mục" (header cột Nguồn).** Là trạng thái **tổng hợp** của notebook, không phải text tĩnh:
hiển thị "N nguồn · đã lập chỉ mục" khi **mọi** nguồn `ready`; "N nguồn · đang xử lý M" khi còn nguồn
`queued`/`processing`/`awaiting_embedding`; ẩn phần chỉ mục khi 0 nguồn.

**14. Nhãn trạng thái lỗi (`.stat err`).** Thân thiện, không lộ stack: theo bước lỗi — "Lỗi trích xuất"
(parse), "Lỗi tải trang" (URL fetch), "Lỗi nhúng" (embed), "Tệp quá lớn" (vượt giới hạn). Chi tiết kỹ thuật
chỉ ghi log server-side (redact, không log nội dung tài liệu — Constitution III).

## Trạng thái nguồn (enum chuẩn)

`queued` → `processing` → (`awaiting_embedding` nếu runtime offline) → `ready`; nhánh lỗi → `error`.
Ánh xạ UI prototype: `.stat ready` = `ready`; `.stat proc` = `queued`/`processing`/`awaiting_embedding`;
`.stat err` = `error`.

## Hệ quả

- `/speckit-plan` sinh 2 ADR chi tiết (đã tạo trước: chunking, LanceDB) + data-model (migration #2:
  bảng `source`, `chunk`) + contracts (6 kênh `source:*`).
- Thêm dependency: `pdfjs-dist`, `mammoth`, `@mozilla/readability`, `jsdom`, `turndown` (thuần JS) +
  `@lancedb/lancedb` (native prebuilt).
- `security-reviewer` bắt buộc chạy (feature đụng fetch mạng URL + FS + DB) — soi SSRF (mục 6), giới hạn
  kích thước (mục 7), không log nội dung (mục 14).
