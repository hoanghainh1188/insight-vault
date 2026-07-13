# rag-enhance clarify (055)

- Ngày: 2026-07-13
- Feature: `055-rag-enhance` (issue #55)
- Nguồn: thảo luận sau khi Pha 2 hoàn tất; người dùng chốt kỹ thuật.
- Tiếp nối: 013 (rag-service), 027 (chat history), 031 (Ollama local).

## Quyết định (đã thảo luận)

**1. Query rewriting (LLM local).** Trước truy xuất, dùng LLM local (Ollama, provider active) viết lại câu
hỏi: (a) **giải tham chiếu hội thoại** (đại từ "nó/cái đó/vấn đề trên" → chủ thể thật, dùng vài lượt chat
gần nhất — chat history 027); (b) **mở rộng** câu ngắn/mơ hồ thành truy vấn đầy đủ. Kết quả: 1 câu truy
vấn viết lại (dùng cho cả embed vector và match BM25).

- _Đánh đổi:_ +1 lượt LLM (~vài giây trên model local). Đáng cho câu nối tiếp.
- _Loại bỏ:_ HyDE (thêm lượt sinh giả thuyết, chậm hơn).

**2. Hybrid search: vector + BM25 (FTS5) → RRF → MMR.** ĐÃ VERIFY `node:sqlite` hỗ trợ **FTS5** (bm25 xếp
hạng + tokenizer unicode khớp tiếng Việt).

- **BM25 keyword:** FTS5 virtual table trên `chunk.text` (migration #7), tokenizer `unicode61
remove_diacritics 2` (không phân biệt dấu — bắt "hop dong" ↔ "hợp đồng"). Đồng bộ với chunk qua
  insert/delete ở source-repo (hoặc trigger). Backfill chunk hiện có khi migrate.
- **Hợp nhất RRF** (Reciprocal Rank Fusion, k=60): gộp rank từ vector-list + BM25-list → 1 danh sách. Bắt
  cả ngữ nghĩa lẫn tên riêng/thuật ngữ chính xác (embedding hay trượt).
- **MMR** (Maximal Marginal Relevance, λ≈0.7) đa dạng hoá top-N (giảm chunk trùng lặp) — thuần thuật toán.
- KHÔNG LLM-rerank, KHÔNG cross-encoder (giữ nhanh — model local đã chậm).

## Kiểm chứng được (Constitution II) — bất biến

Rewrite/hybrid/RRF/MMR chỉ đổi **CHUNK NÀO** được chọn vào context. Mỗi chunk vẫn giữ locator gốc (013) →
chip `[n]` map chính xác về nguồn + vị trí. KHÔNG bịa. Câu trả lời "không tìm thấy" giữ nguyên khi hybrid
trả rỗng.

## Giả định / mặc định (spec Assumptions; clarify xác nhận nếu intake nêu)

- **Rewrite luôn chạy** (kể cả câu đầu — giúp cả câu mơ hồ), nhưng prompt gọn + giữ nguyên nếu câu đã rõ.
  _(clarify: luôn vs chỉ khi có history — mặc định LUÔN, prompt bảo toàn câu rõ.)_
- **Hiển thị truy vấn viết lại?** Mặc định KHÔNG hiện (giữ UI gọn); có thể log debug. _(clarify.)_
- **Migration #7:** FTS5 external-content table (`content='chunk', content_rowid`) HOẶC bảng thường +
  đồng bộ tay ở insertChunks/deleteChunks. Backfill chunk hiện có. ADD, không phá schema cũ.
- **Ngân sách/top-k:** giữ CONTEXT_CHAR_BUDGET/RELEVANCE ngưỡng (013); RRF lấy top-K mỗi nhánh (vd 10) →
  MMR chọn ~6 vào context.
- **Provider rewrite:** dùng provider active (031) — nếu online đang bật, rewrite qua online (câu hỏi rời
  máy khi online — nhất quán 031 badge). Local mặc định.
- **Fallback:** LLM rewrite lỗi/timeout → dùng câu gốc (không chặn). FTS lỗi → vector-only.

## Clarify (2026-07-13) — 5 ambiguity đã chốt

- **C1 — Rewrite khi nào:** ~~LUÔN chạy~~ → **ĐẢO (2026-07-13, sau chạy thử live): CHỈ khi CÓ hội thoại**
  (giải đại từ/tham chiếu). Câu đầu / không history → DÙNG NGUYÊN câu gốc. _Lý do: thực nghiệm với model
  local (ministral-3) cho thấy "luôn rewrite" khiến câu đã rõ bị **PHÌNH** (thêm chủ đề/từ khoá mới) → pha
  loãng vector + nhiễu BM25 → truy xuất TỆ HƠN cả trước 055 (lộ rõ ở notebook CV toàn câu hỏi cụ thể). Câu
  nối tiếp rewrite vẫn tốt (giải "nó" đúng)._ Kèm: prompt siết chặt (chỉ thay đại từ, KHÔNG mở rộng) +
  **guardrail** (rewrite dài hơn gốc > 200 ký tự → bỏ, dùng câu gốc).
- **C2 — Hiển thị câu viết lại:** **KHÔNG** hiện cho người dùng (giữ UI Chat gọn); rewrite chạy ngầm. _(Có
  thể log debug — không log nội dung ra file theo Constitution III.)_
- **C3 — Toggle Settings:** **KHÔNG** — luôn bật, không thêm cài đặt. Hybrid nhanh; rewrite có fallback nên
  latency chấp nhận được. Ít bề mặt cấu hình.
- **C4 — Đồng bộ FTS5 (plan-research chốt):** **own-storage** FTS5 (`tokenize='unicode61'`) lưu text đã
  **fold tiếng Việt** (bỏ dấu + `đ→d` ở JS). _(Đính chính so với ý ban đầu "external-content + remove_
  diacritics": verify thực tế cho thấy tokenizer `remove_diacritics` KHÔNG xử lý `đ`→`d` (đ là ký tự riêng,
  không phải d+dấu) → "dong" không khớp "đồng". Own-storage + fold JS khớp được có/không dấu KỂ CẢ đ.)_
  Backfill: migration fold toàn bộ chunk hiện có. Đồng bộ tay ở insertChunks (INSERT rowid+fold) /
  deleteChunks (DELETE) — rowid = chunk.rowid ngầm. Nhân đôi text (bản fold) — chấp nhận (đổi lấy khớp
  không-dấu chuẩn).
- **C5 — Badge egress bước rewrite (online):** **CÓ** — dùng CHUNG cơ chế 031 (`setOnline`/privacy badge).
  Rewrite qua provider active: nếu online đang bật thì câu hỏi rời máy ở bước rewrite (nhất quán badge 031);
  local mặc định không egress.

## Phạm vi

- **Trong 055:** query rewriting (LLM local, dùng chat history), FTS5 BM25 (migration #7 + backfill +
  đồng bộ), hybrid vector+BM25, RRF, MMR, tích hợp `retrieve`. Test-first hàm thuần (RRF/MMR/rewrite-prompt).
- **Ngoài 055:** LLM-rerank; cross-encoder model; HyDE; tokenizer đa ngôn ngữ nâng cao; UI hiện truy vấn
  viết lại (có thể thêm sau); tinh chỉnh tham số qua Settings.
