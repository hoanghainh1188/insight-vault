# Research — 055-rag-enhance (Phase 0)

0 NEEDS CLARIFICATION (2 pivotal + 5 clarify chốt ở ADR). Tập trung feasibility FTS5 tiếng Việt + MMR
vectors.

## R1. FTS5 trong node:sqlite — ĐÃ VERIFY

- **Decision**: `node:sqlite` (DatabaseSync) hỗ trợ **FTS5** đầy đủ: `CREATE VIRTUAL TABLE ... USING fts5`,
  `bm25()` ranking, `MATCH`. Không cần dependency ngoài.
- **Verify**: tạo bảng FTS5 + insert + `SELECT bm25()... WHERE MATCH` chạy đúng.

## R2. Khớp có/không dấu tiếng Việt — RỦI RO ĐÃ GỠ (đổi thiết kế)

- **Vấn đề phát hiện**: tokenizer `unicode61 remove_diacritics 2` bỏ **dấu thanh** (ợ→o, ồ→o) NHƯNG KHÔNG
  bỏ **`đ`→`d`** (đ = U+0111 là ký tự Latin riêng, không phải d + combining mark → NFD không tách). Verify:
  `MATCH 'hop'` khớp `'hợp'` ✓ nhưng `MATCH 'dong'` KHÔNG khớp `'đồng'` ✗.
- **Decision**: **FTS5 own-storage** (`tokenize='unicode61'`) lưu **text đã fold ở JS**:
  `foldVietnamese(s) = s.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d").replace(/Đ/g,
"D").toLowerCase()`. Query cũng fold. Verify: "hợp đồng" ↔ "hop dong" ↔ "Điều 47"/"dieu 47" đều khớp ✓.
- **Rationale**: fold JS xử lý cả đ + mọi dấu (NFD tách horn ơ/ư + dấu thanh; đ xử lý tay). own-storage cho
  phép lưu bản fold khác text gốc; DELETE thường (không cần lệnh 'delete' external-content) → đồng bộ đơn
  giản hơn.
- **Alternatives**: external-content + remove_diacritics (KHÔNG khớp đ — loại); custom tokenizer (node:
  sqlite không cho đăng ký — loại).
- **content_rowid**: chunk là bảng thường → có `rowid` ngầm. FTS5 own-storage dùng `rowid` = chunk.rowid.
  BM25 trả rowid → JOIN `chunk ON chunk.rowid = chunk_fts.rowid` → chunk.id + JOIN source lọc notebook.

## R3. buildFtsMatch — an toàn FTS injection

- **Decision**: `buildFtsMatch(query) = foldVietnamese(query).match(tokens).map(t => '"'+t.replace(/"/g,
'""')+'"').join(" OR ")`. Bọc mỗi token trong `"..."` (FTS5 string literal — vô hiệu toán tử `AND/OR/
NEAR/*/:/(`), escape `"`→`""`. OR để lenient (khớp bất kỳ token). Rỗng → trả "" (caller bỏ BM25).
- **Rationale**: chống người dùng gõ ký tự đặc biệt FTS phá cú pháp (Constitution III boundary). THUẦN,
  test kỹ.

## R4. Hybrid: RRF + MMR

- **Decision**: `reciprocalRankFusion(lists, k=60)`: mỗi list (vector-ids theo rank, bm25-ids theo rank)
  đóng góp `1/(k+rank)` cho mỗi id; tổng điểm → sort giảm dần → danh sách hợp nhất. `mmrSelect(cands,
qVec, λ=0.7, n)`: chọn tuần tự id tối đa `λ·sim(qVec,id) − (1−λ)·max sim(id, đã-chọn)` (cosine) → n id
  đa dạng. THUẦN — test crux.
- **Vectors cho MMR**: `VectorSearchHit` (013) KHÔNG chứa vector → thêm `vectorStore.getVectorsByIds(ids)`
  → `Map<id, number[]>` (LanceDB query `where id IN (...)`). MMR cần vector cho cả candidate BM25-only.
  Candidate không có vector (vd chunk vừa xoá khỏi LanceDB) → bỏ khỏi MMR (giữ theo RRF rank).
- **Rationale**: RRF không cần điểm cùng thang (vector distance vs BM25) — chỉ dùng rank → hợp nhất an
  toàn. MMR giảm trùng (US3).

## R5. Query rewriting

- **Decision**: `buildRewritePrompt(question, history)` (THUẦN) → messages: system yêu cầu viết lại thành
  1 truy vấn độc lập (giải đại từ theo history, mở rộng câu ngắn, GIỮ NGUYÊN nếu đã rõ, chỉ trả truy vấn
  không giải thích). `rewriteQuery(...)` gọi LLM (provider active + setOnline badge 031); kết quả rỗng/
  lỗi/timeout → trả câu gốc. history = vài lượt gần nhất (chatRepo 027).
- **Rationale**: 1 lượt LLM, fallback an toàn (FR-004). KHÔNG hiện cho user (C2). KHÔNG log nội dung.

## R6. Bất biến kiểm chứng được (Constitution II)

- rewrite/RRF/MMR chỉ đổi **tập/thứ tự chunk**; `retrieve` vẫn trả `ScoredChunk` với `chunk.locator` gốc
  (013) → chip `[n]` map chính xác. Hybrid rỗng → `[]` → grounded "không tìm thấy" (013 giữ nguyên).
