# Hiệu chuẩn bộ lọc độ liên quan của truy xuất hỏi đáp (108)

- Ngày: 2026-10-07
- Feature liên quan: `108-relevance-calibration` (issue #108) — spec `specs/20261007-111628-relevance-calibration/`
- Câu hỏi gốc: ngưỡng `RELEVANCE_MAX_DISTANCE` (0.75 theo ADR 2026-07-11, thực tế 0.5 từ 059) chưa từng được đo; nhánh
  BM25 không bị lọc ⇒ `retrieve()` hầu như không rỗng ⇒ "Không tìm thấy" phụ thuộc mô hình tự giác. Cần số liệu để
  chọn ngưỡng/cách lọc.
- Người quyết định: Hải (2026-10-07) — chọn phương án "giữ ngưỡng cũ, tách việc" sau khi xem số liệu quét.
- Liên quan: `2026-10-07-relevance-calibration-clarify.md` (12 quyết định clarify), **thay thế** phát biểu
  `RELEVANCE_MAX_DISTANCE = 0.75` ở `2026-07-11-rag-retrieval-strategy.md` mục 1.

## Bộ đánh giá & cách đo

- `tests/eval/`: 8 tài liệu tiếng Việt (5 bài Wikipedia CC BY-SA 4.0 + 3 văn bản luật) + 3 tài liệu nhiễu; 112 câu
  (82 có đáp án, 20 không có đáp án, 10 tiếng Anh tham khảo), chia dev/hold-out ~70/30; Hải duyệt 2026-10-07.
- `npm run eval:retrieval` (dev-only, không đóng gói): e5-small thật + SQLite/FTS5 + LanceDB thật trên thư mục tạm,
  gọi ĐÚNG `retrieve()` của app. Kết quả tất định (hai lần chạy giống hệt). Job CI bấm tay `eval-retrieval`.
- Chỉ số đo ở tầng truy xuất (quyết định clarify #5): từ chối đúng = câu không có đáp án mà `retrieve()` rỗng;
  Recall@6 = câu có đáp án có ≥ 1 đoạn chứa trích đoạn đáp án trong 6 đoạn cuối.

## Số liệu

Mốc (cấu hình hiện hành — vector `distance ≤ 0.5`, BM25 không chặn):

| Nhóm                  | Từ chối đúng [CI95] | Recall@6 [CI95] | Recall@1 | MRR   | Từ chối nhầm |
| --------------------- | ------------------- | --------------- | -------- | ----- | ------------ |
| dev (58 + 14)         | 0% [0–22]           | 96,6% [88–99]   | 75,9%    | 0,831 | 0%           |
| hold-out (24 + 6)     | 0% [0–39]           | 95,8% [80–99]   | 87,5%    | 0,910 | 0%           |
| en (7 + 3, tham khảo) | 0%                  | 71,4%           | 57,1%    | 0,643 | 0%           |

Quét 392 cấu hình (ngưỡng tuyệt đối 0,14–0,30 × ngưỡng tương đối {tắt, 0,01–0,05} × chặn BM25 {không, cần hỗ trợ
vector, vector ≤ ngưỡng + 0,02/0,04, điểm bm25 ≤ phân vị 10/25/50}) + đo thêm ngưỡng 0,08–0,13 để thấy đường đánh đổi
(dev, chặn BM25 "cần hỗ trợ vector"):

| Ngưỡng vector          | Từ chối đúng (dev) | Recall@6 (dev) |
| ---------------------- | ------------------ | -------------- |
| 0,10                   | 100%               | 41,4%          |
| 0,11                   | 78,6%              | 44,8%          |
| 0,12                   | 78,6%              | 63,8%          |
| 0,13                   | 50,0%              | 81,0%          |
| 0,14 (+ bm25 ≤ −14,98) | 21,4%              | 91,4%          |
| 0,5 (hiện hành)        | 0%                 | 96,6%          |

Phân bố khoảng cách (hit vector tốt nhất): đoạn trúng của câu có đáp án ~0,06–0,16; câu không có đáp án ~0,10–0,14
⇒ **hai vùng chồng nhau**. Với e5-small, ngưỡng khoảng cách (tuyệt đối hay tương đối) và chặn BM25 không tách được câu
không có đáp án mà vẫn giữ đủ câu có đáp án.

## Quyết định

1. **Không cấu hình nào đạt tiêu chí** (từ chối đúng ≥ 90% với Recall@6 ≥ sàn 75%) ⇒ theo FR-011 dừng, không tự hạ mục
   tiêu. Hải chọn **giữ cấu hình hiện hành** (`maxDistance 0.5`, không ngưỡng tương đối, không chặn BM25) — ưu tiên
   không làm mất câu trả lời đúng (Recall@6 ~96%).
2. Cấu hình được ghi thành bản ghi hiệu chuẩn `src/main/services/rag/relevance-calibration.ts`
   (`RELEVANCE_CALIBRATION`) kèm số liệu đo + `embeddingModelVersion = e5-small-384`; test canh giữ
   `tests/unit/relevance-calibration.test.ts` fail khi đổi mô hình embedding mà chưa đo lại. `RELEVANCE_MAX_DISTANCE`
   bị bỏ (một nguồn sự thật). Logic lọc tách thành hàm thuần `selectRelevant` (sẵn sàng cho cấu hình khác về sau).
3. "Không bịa" vẫn được siết ở **tầng trả lời** (độc lập với ngưỡng): chế độ theo nguồn, câu trả lời không có `[n]` hợp
   lệ ⇒ "Không tìm thấy trong nguồn." + gợi ý (trước đây gắn mọi đoạn ngữ cảnh làm trích dẫn) — FR-015/016.
4. SC-001 (≥ 90% từ chối đúng ở tầng truy xuất) **không đạt** trong feature này — ghi nhận là giới hạn đã biết. Việc
   tách câu không có đáp án tốt hơn cần kỹ thuật ngoài phạm vi spec 108 (reranker cross-encoder, bước LLM chấm độ liên
   quan, hoặc mô hình embedding khác) ⇒ **tách issue riêng**, dùng chính bộ đánh giá + `npm run eval:retrieval`
   (kèm `EVAL_WITH_LLM=1` để đo end-to-end) làm thước đo.
5. SC-006 (độ trễ): cấu hình không đổi ⇒ không tăng (đo cùng lần chạy: 0%).

## Giới hạn

- ~100 câu: khoảng tin cậy rộng (20 câu không có đáp án ⇒ mỗi câu = 5 điểm %). Đủ để thấy hai vùng chồng nhau, không
  đủ để tinh chỉnh mịn.
- Văn bản luật là phiên bản lịch sử; tài liệu Wikipedia gắn `revisionId` trong `tests/eval/corpus/manifest.json`.
