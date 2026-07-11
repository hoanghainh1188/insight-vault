# Design intake — 025-workspace-enhance

- Feature: `025-workspace-enhance` (issue #25) — nâng trải nghiệm Workspace
- Nguồn: yêu cầu người dùng (2026-07-11) + roadmap `post-021` + prototype S2 + kế thừa 021-studio.
- Gộp 3 nhóm cùng đụng màn Workspace 3 cột (Nguồn · Chat · Studio).
- Blocked-by: không (main đã có 021 + 023).

## Phạm vi

**A. Studio nâng cấp** (nối tiếp 021)

- A1. Map-reduce cho notebook lớn — hiện `studio-service` cắt cụt ~8000 ký tự (chỉ tổng hợp phần đầu,
  `truncated=true`). Muốn bao phủ TOÀN BỘ nguồn.
- A2. Lọc theo 1 nguồn — tổng hợp riêng 1 nguồn thay vì cả notebook.
- A3. Nút Copy (clipboard) + Export (md/txt) trên card + skeleton khi đang tạo (audit UI #4).

**B. Kéo đổi độ rộng cột**

- Splitter giữa 3 cột; kéo đổi độ rộng; lưu bền để nhớ. Grid hiện cứng
  `minmax(280,340) 1fr minmax(220,300)`.

**C. Nav Workspace nhớ notebook gần nhất**

- Nút "Workspace" trên rail → `/workspace` (không notebookId) → placeholder vô dụng. Sửa: nhớ notebook mở
  gần nhất → mở lại; chưa mở cái nào → placeholder có CTA "Chọn notebook".

## Ambiguities (cho /speckit-clarify)

**#1 (QUAN TRỌNG) Map-reduce vs Constitution II (citation).** ADR `2026-07-11-studio-context-strategy` đã
HOÃN map-reduce vì citation `[n]` khi tổng hợp nhiều lượt trỏ vào **tóm tắt trung gian**, KHÔNG phải chunk
thật → lệch "kiểm chứng được". Nếu làm map-reduce phải chọn cách xử lý citation:

- (a) **Hybrid — khuyến nghị**: notebook vừa ngân sách → giữ nguyên 1 lượt + chip `[n]` chính xác (như 021);
  notebook VƯỢT ngân sách → map-reduce, kết quả kèm citation **mức NGUỒN** (`citationsFromMap` toàn bộ nguồn
  đã dùng) thay vì `[n]` chính xác từng chunk, + ghi chú "tổng hợp từ N phần". Vẫn truy được về nguồn
  (Constitution II ở mức nguồn), đánh đổi độ chính xác vị trí khi tài liệu quá lớn.
- (b) Không map-reduce, chỉ tăng ngân sách (vd 16000) — đơn giản nhưng vẫn cắt cụt notebook rất lớn.
- (c) Map từng nguồn (không cross-source) → mỗi nguồn 1 lượt, reduce ghép — citation mức nguồn.
  → Khuyến nghị (a).

**#2 Lọc theo nguồn — kiểu chọn.** UI: dropdown "Tất cả nguồn / <tên nguồn>" ở đầu cột Studio; thêm
`sourceId?` vào `studio:generate`. Kết quả lưu vẫn theo `(notebook, kind)` — lọc nguồn có tạo bản riêng
theo nguồn không? → Khuyến nghị: MVP **không** lưu tách theo nguồn (giữ UNIQUE(notebook,kind)); lọc chỉ đổi
ngữ cảnh lần tạo, kết quả mới ghi đè như thường. (Nếu muốn lưu tách theo nguồn = mở rộng schema — hoãn.)

**#3 Export — định dạng + cơ chế.** Copy = `navigator.clipboard.writeText` (renderer, không IPC). Export
file → cần hộp thoại lưu (main + IPC `dialog.showSaveDialog` + ghi file). → Khuyến nghị: **Copy (clipboard)
làm trước** (renderer thuần); **Export .md** qua 1 kênh IPC mới `studio:export` (main ghi file qua save
dialog) — hoặc hoãn Export nếu muốn giữ feature thuần renderer. Chốt: làm cả Copy + Export .md (thêm 1 kênh).

**#4 Lưu độ rộng cột — phạm vi & khoá.** localStorage (renderer, không IPC). Khoá **toàn cục** (1 layout cho
mọi notebook) hay theo notebook? → Khuyến nghị: **toàn cục** (`workspace-col-widths`) — layout là sở thích
chung. Min/max mỗi cột (vd Nguồn 220–460, Studio 200–420, Chat co giãn phần còn lại).

**#5 Nhớ notebook gần nhất — lưu ở đâu.** localStorage (`last-notebook-id`, renderer) hay electron-store
(main, như onboarding)? → Khuyến nghị: **localStorage** (thuần renderer, không cần IPC; nav là trạng thái
UI). Notebook đã xoá → placeholder CTA (kiểm tồn tại trước khi điều hướng).

**#6 Kích thước feature.** Gộp A+B+C 1 feature (chia phase A→B→C) hay tách? → Khuyến nghị: 1 feature, chia
phase; A (Studio, đụng main/IPC) làm trước vì phức tạp nhất, B+C (renderer thuần) sau.

## Prompt for /speckit-specify (rút gọn — sẽ hoàn chỉnh sau clarify)

> Nâng cấp màn Workspace của InsightVault gồm 3 nhóm: (A) Studio — map-reduce để tổng hợp TOÀN BỘ nguồn
> notebook lớn (không cắt cụt) với citation mức-nguồn khi vượt ngân sách (giữ 1-lượt + chip [n] chính xác
> khi vừa ngân sách), lọc theo 1 nguồn, nút Copy + Export .md + skeleton; (B) kéo đổi độ rộng 3 cột (lưu bền
> localStorage, min/max); (C) nút Workspace trên rail nhớ notebook mở gần nhất (chưa có → CTA chọn notebook).
> Ràng buộc: Constitution II (citation truy được về nguồn — map-reduce dùng citation mức nguồn), III (đọc
> chunk/LLM/file CHỈ ở main, renderer qua kênh whitelisted), I (LLM local), IV (test-first). Kế thừa
> studio-service/repo (021), buildContext/citation (013). Thêm kênh `studio:export` (+ `sourceId?` cho
> `studio:generate`).
