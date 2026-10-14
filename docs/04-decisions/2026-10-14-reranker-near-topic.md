# Bộ chấm độ liên quan — câu sát chủ đề và đoạn bảng: giới hạn đã biết (187, PR 2)

- Ngày: 2026-10-14
- Feature: `187-reranker-near-topic` (issue #187). Spec: `specs/20261012-120856-reranker-near-topic/`. Clarify:
  `2026-10-12-reranker-near-topic-clarify.md`. Chẩn đoán + mốc v5: `2026-10-12-reranker-diagnosis.md`.
- Trạng thái: **Đã chấp nhận** (T025: không giải pháp nào đạt ⇒ giữ cấu hình hiện hành, #187 mở). Người quyết định: Hải (2026-10-14).
- Phạm vi PR 2: công cụ quét lưới + đo bước 1 (cấu hình), trình bày lại đoạn bảng (T019–T021) và bước 2 (một model khác). **Không đổi mã chạy
  app**: `src/` không đổi so với `main`; `RELEVANCE_CALIBRATION` giữ nguyên.

## Đã đo

Mọi lượt đo chạy trên ĐÚNG `retrieve()` của app, bộ câu hỏi v5 đã duyệt, so từng câu với cấu hình hiện hành (mMiniLM, 12 ứng viên, 256 token,
`minScore` 0,6) đo cùng công cụ.

| Lượt                                               | Model                                        | Lưới                                                         | Cấu hình |
| -------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------ | -------- |
| Bước 1, nguyên văn                                 | `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` | ứng viên {8,12,16} × token {256,384,512} × 13 minScore × 4 Δ | 468      |
| T019–T021, đoạn bảng trình bày lại (`rerankInput`) | như trên                                     | như trên                                                     | 468      |
| Bước 2, nguyên văn                                 | `Xenova/bge-reranker-base` @`280bcc27`, int8 | như trên, 17 minScore (thêm 0,001–0,02 và 0,99)              | 612      |
| Bước 2, đoạn bảng trình bày lại                    | như trên                                     | như trên                                                     | 612      |

`bge-reranker-base` (MIT, 279 MB) vượt trần tải 150 MB của clarify #3; chủ dự án đồng ý nới **chỉ để đo** (2026-10-14), không đổi tiêu chí
chấp nhận. Các model đa ngôn ngữ khác đều lớn hơn (bge-reranker-v2-m3 int8 571 MB, Qwen3-Reranker-0.6B ≥ 995 MB) hoặc chưa có ONNX
(mMiniLM-L6, cùng họ dữ liệu mMARCO với model hiện hành).

## Kết quả

Số cấu hình đạt TỪNG điều kiện (đếm độc lập, không nối tiếp):

| Điều kiện                                                       | mMiniLM nguyên văn | mMiniLM bảng | bge nguyên văn | bge bảng |
| --------------------------------------------------------------- | ------------------ | ------------ | -------------- | -------- |
| Từ chối đúng dev ≥ 90% và Recall@6 dev ≥ 85%                    | 56                 | 56           | 67             | 69       |
| …và q-176, q-179 bị từ chối (**FR-003 đủ**)                     | **0**              | **0**        | 3              | 6        |
| Bộ kiểm bảng (q-162 / q-170 / q-171 không bị từ chối, hạng ≤ 6) | 96                 | 96           | 51             | 51       |
| Sàn tiếng Anh (R@6 ≥ 72,7%, từ chối đúng ≥ 83,3%)               | 60                 | 60           | **0**          | **0**    |
| Ngân sách độ trễ (p50 ≤ 400, p95 ≤ 800 ms)                      | 468                | 468          | 68             | 204      |
| FR-003 đủ **và** bộ kiểm bảng                                   | 0                  | 0            | 0              | 0        |

Cấu hình tốt nhất khi BUỘC q-176 và q-179 bị từ chối (Recall@6 dev cao nhất):

| Model / trình bày  | Cấu hình          | Từ chối đúng dev / hold-out / en | R@6 dev / hold-out / en   | q-162       | Câu tụt so với hiện hành            |
| ------------------ | ----------------- | -------------------------------- | ------------------------- | ----------- | ----------------------------------- |
| mMiniLM nguyên văn | N8 · T384 · 0,85  | 95,1% / 94,7% / 100%             | **80,8%** / 82,4% / 59,1% | từ chối     | 17 câu có đáp án (hạng 1 → từ chối) |
| mMiniLM bảng       | N12 · T256 · 0,85 | 95,1% / 94,7% / 100%             | **82,1%** / 82,4% / 68,2% | từ chối     | 13 câu có đáp án                    |
| bge nguyên văn     | N8 · T256 · 0,7   | 97,6% / 89,5% / 91,7%            | 85,9% / 88,2% / **22,7%** | từ chối     | 26 (20 tiếng Anh)                   |
| bge bảng           | N12 · T256 · 0,7  | 95,1% / 89,5% / 83,3%            | 85,9% / 88,2% / **27,3%** | ngoài top 6 | 26                                  |

Điểm bộ chấm các câu then chốt (12 ứng viên, 256 token, nguyên văn; câu không đáp án = điểm cao nhất trong ứng viên, câu có đáp án = điểm
đoạn đúng):

| Câu   | Vai trò                      | mMiniLM | mMiniLM bảng | bge   |
| ----- | ---------------------------- | ------- | ------------ | ----- |
| q-162 | có đáp án, bảng PDF "bẩn"    | 0,122   | 0,153        | 0,002 |
| q-185 | có đáp án, hộp thông tin PDF | 0,229   | 0,408        | 0,316 |
| q-170 | có đáp án, bảng sạch         | 0,984   | 0,983        | 0,852 |
| q-176 | không đáp án, sát chủ đề PDF | 0,826   | 0,822        | 0,797 |
| q-179 | không đáp án, sát chủ đề PDF | 0,860   | 0,842        | 0,587 |
| q-204 | không đáp án, sát chủ đề PDF | 0,997   | 0,997        | 0,861 |
| q-206 | không đáp án, sát chủ đề     | 0,921   | 0,921        | 0,798 |

Độ trễ (p50 / p95 một lượt chấm): mMiniLM 100–277 / 105–494 ms; bge 276–737 / 443–1003 ms. Đo khi máy bận (loadavg 6–9) ⇒ số tạm; không
ảnh hưởng kết luận vì không cấu hình nào qua được các điều kiện chất lượng.

## Diễn giải

1. **Không phải vấn đề ngưỡng hay cửa sổ token, mà là loại tín hiệu.** Cross-encoder huấn luyện trên MS MARCO chấm "đoạn có liên quan tới câu
   hỏi không", không chấm "đoạn có trả lời được không". Câu không đáp án sát chủ đề nhận điểm 0,67–0,997 — chồng lên vùng điểm của
   nhiều câu có đáp án văn thường (ứng viên cao nhất chỉ 0,6–0,85) và cao hơn hẳn đoạn bảng "bẩn" (0,12–0,28). Muốn loại q-179 phải đặt `minScore` ≥ 0,85, lúc đó
   13–17 câu có đáp án đang ở hạng 1 bị từ chối và Recall@6 dev rơi xuống 80,8–82,1%.
2. **Sửa lại kết luận tạm của phiên đo:** chướng ngại không chỉ là bộ kiểm bảng (q-162). Với mMiniLM, FR-003 đúng nghĩa (gồm q-176, q-179)
   tự nó đã không đạt cùng Recall@6 dev ≥ 85%, và mọi cấu hình gần đạt đều vi phạm FR-005 (câu tụt). Phễu trong báo cáo quét đầu tiên chỉ xét
   tỉ lệ từ chối đúng nên bỏ sót q-176 / q-179; công cụ đã sửa (`mustRejectIds` trong `eligibleRerankConfigs` / `rerankFunnel`, có test).
3. **Trình bày lại đoạn bảng không cứu được câu bảng.** Đoạn của q-162 có dòng tiêu đề thật nằm trong văn bản trộn của PDF (không phải dòng
   `|`), nên `rerankInput` chỉ đưa được dòng dữ liệu lên trước: 0,122 → 0,153. q-185 lên 0,408 ở 256 token nhưng xuống 0,090 ở 384 token —
   không ổn định. Gốc của hai câu này là chất lượng trích bảng / hộp thông tin của PDF Wikipedia (chẩn đoán PR 1), nằm ở tầng parse.
4. **bge-reranker-base kém hơn model hiện hành ở mọi mặt cần thiết:** tiếng Anh sụp ở mọi cấu hình (R@6 tối đa 68,2%, thường 18–27% ở vùng
   từ chối đúng cao), q-162 tệ hơn (0,002–0,06), chậm hơn khoảng 2–3 lần. Nghi vấn lượng tử hoá int8 làm hỏng tiếng Anh **chưa kiểm chứng**, nhưng
   bản fp32 (1,1 GB) vượt trần tải gần 8 lần nên dù đúng cũng không dùng được ⇒ không đo thêm.
5. Hai họ model đã thử (mMARCO MiniLM, bge) cho cùng hình dạng lỗi ở câu sát chủ đề ⇒ thêm một cross-encoder cùng loại khó đổi kết luận.

## Quyết định

1. **T025 — giới hạn đã biết.** Giữ cấu hình hiện hành (`minScore` 0,6 · 12 ứng viên · 256 token); không đổi `RELEVANCE_CALIBRATION`, không
   đổi model. #187 giữ mở.
2. **Điều kiện của T019–T021 đổi theo clarify, không theo tasks.md.** tasks.md chỉ cho làm khi `cutOff` là nguyên nhân chính; chẩn đoán PR 1
   bác `cutOff` (= 0) nhưng xác nhận đoạn bảng bị chấm thấp trong cửa sổ (`lowScoreInWindow`, q-162 0,122, q-185 0,229) — đúng điều kiện gốc
   ở clarify (`/speckit-specify` #2: đổi cách đưa bảng "CHỈ khi bước chẩn đoán xác nhận đoạn bảng bị chấm thấp"). tasks.md đã thu hẹp hơn
   clarify; PR 2 đo theo clarify. Kết quả không đạt ⇒ **không** nối `rerankInput` vào `retrieve()` (phần còn lại của T020 không làm);
   `rerankInput` nằm trong công cụ đo `tests/eval/lib/rerank-input.ts`, không ở `src/main`.
3. **Giữ công cụ quét** (`tests/eval/rerank-sweep.eval.ts`, `lib/rerank-sweep.ts`, `lib/rerank-compare.ts`, lưới mở rộng trong
   `lib/rerank-grid.ts`) cho lần thử tín hiệu / model sau. Cách chạy: `tests/eval/README.md` mục "Quét lưới bộ chấm mở rộng".

## Giới hạn đã biết (cấu hình hiện hành trên v5)

- Từ chối đúng tiếng Việt dev 87,8% / hold-out 84,2% (cổng `gateVerdict` KHÔNG ĐẠT trên v5; ĐẠT trên v4). Câu không đáp án lọt: q-089,
  q-090, q-176, q-179, q-206 (dev); q-188, q-198, q-204 (hold-out). Tiếng Anh: q-146 (dev), q-131 (hold-out).
- Câu có đáp án bị từ chối nhầm: q-043, q-060, q-067, q-073, q-076 (dev); **q-162, q-185** (hold-out, bảng / hộp thông tin PDF). Tiếng Anh:
  q-115, q-125. Bộ kiểm bảng (FR-004) vì vậy KHÔNG đạt ngay ở cấu hình hiện hành (q-162) — không phải hồi quy của PR 2.
- Lưới an toàn khi tầng truy xuất để lọt: tầng trả lời (108 / 109 — không có `[n]` hợp lệ ⇒ "Không tìm thấy trong nguồn"). Hiệu quả của tầng
  này trên các câu sát chủ đề v5 **chưa đo** (phần LLM của công cụ đo chỉ lấy câu hold-out tiếng Việt + tiếng Anh; q-176 / q-179 ở dev).

## Hướng tiếp (chủ dự án chọn cả ba, 2026-10-14 — mỗi hướng một issue riêng)

1. **#205 — Đo tầng trả lời trên v5** (cục bộ, không tải gì): mở rộng mẫu `runWithLlm` cho mọi câu không đáp án sát chủ đề ⇒ biết câu lọt ở truy xuất
   có thành câu trả lời bịa hay không. Quyết định mức ưu tiên của các hướng dưới.
2. **#206 — Trích bảng / hộp thông tin PDF** ở tầng parse (q-162, q-185): tách hộp thông tin khỏi thân bài, giữ dòng tiêu đề cột. Lợi cả trích dẫn
   lẫn bộ chấm, độc lập với #187.
3. **#207 — Tín hiệu "trả lời được"** khác điểm liên quan (clarify B6: kết hợp tín hiệu, hoặc kiểm bằng LLM cục bộ) — thay đổi lớn hơn, chỉ nên làm
   sau (1).

## Hệ quả

- App không đổi; người dùng không thấy khác biệt. Báo cáo đo (`tests/eval/reports/187-pr2-sweep/`, gitignored) giữ cục bộ; số liệu trong ADR
  lấy từ `report.json` của các lượt quét (kết quả từng câu).
- Model `Xenova/bge-reranker-base` (~296 MB) nằm trong cache của công cụ đo (`tests/eval/.cache/models`, gitignored) — xoá được bất kỳ lúc nào.
