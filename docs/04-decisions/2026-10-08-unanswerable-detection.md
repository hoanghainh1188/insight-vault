# Tách câu hỏi không có đáp án ở tầng truy xuất — bộ chấm độ liên quan cục bộ (109)

- Ngày: 2026-10-08 · Feature: `109-unanswerable-detection` (issue #109) · spec `specs/20261008-194015-unanswerable-detection/` · Trạng thái: Đã chấp nhận
- Quyết định clarify: `2026-10-08-unanswerable-detection-clarify.md` (12 mục + cổng #13–#15). Người quyết định: Hải.
- Số liệu chi tiết: `specs/20261008-194015-unanswerable-detection/eval-baseline-v3.md`, `eval-rerank.md`, `research.md` (R1–R12).
- **Thay thế một phần** `2026-07-13-rag-enhance-clarify.md` (055) dòng "KHÔNG LLM-rerank, KHÔNG cross-encoder (giữ nhanh)": nay DÙNG một
  cross-encoder nhỏ cục bộ chỉ để **lọc** (không xếp lại), có giới hạn ứng viên/token để giữ độ trễ. LLM-rerank vẫn không dùng.
- Kế thừa: 108 (bộ đánh giá + công cụ đo + "không `[n]` hợp lệ ⇒ không tìm thấy"), 123 (câu hỏi English, i18n), 059 (model in-process tải
  lần đầu vào data dir), 103 (chỉ báo riêng tư `egressKind: "model"`).

## Bối cảnh

108 cho thấy ngưỡng khoảng cách e5-small không tách được câu không có đáp án (khoảng cách chồng vùng đoạn đúng; 392 cấu hình, không cấu hình nào
đạt). Tầng truy xuất hầu như không bao giờ rỗng ⇒ "không bịa" dựa hết vào tầng trả lời, vốn không tất định (123: từ chối đúng vi dao động 5/6–6/6).

## Quyết định

1. **Bộ chấm độ liên quan cục bộ** (`cross-encoder/mmarco-mMiniLMv2-L12-H384-v1`, ONNX int8 ~119 MB, Apache-2.0) chạy in-process ở main
   (`src/main/services/rerank/`), chấm cặp (câu truy vấn, đoạn) ⇒ điểm 0..1 (sigmoid).
2. **Vị trí:** trong `retrieve()` sau RRF, trước MMR; chỉ chấm **12 ứng viên đầu** (thứ tự RRF), cắt **256 token**/cặp; giữ đoạn có điểm
   **≥ 0,6**, không ngưỡng tương đối, **không xếp lại** (xếp lại không đổi số liệu). Không đoạn nào đạt ⇒ `[]` ⇒ "Không tìm thấy trong nguồn"
   (Theo nguồn, không gọi model) / ngữ cảnh rỗng (Mở rộng) — như 108. `ScoredChunk.rerankScore` là trường mới; `score` giữ cosine distance;
   `chunk`/`locator` không đổi (Constitution II).
3. **Fail-open:** model chưa tải / đang tải / lỗi / quá **1500 ms** (ngưỡng an toàn, không phải mục tiêu) ⇒ bỏ qua bước chấm (hành vi 108),
   `logEvent("rerank.skip", { reason: notReady|busy|timeout|error })`, không nội dung.
4. **Tải model:** một lần vào `<data dir>/models` theo khuôn e5/Whisper, **nền** khi nguồn đầu tiên sẵn sàng trong phiên (hoặc khi hỏi mà chưa có),
   chỉ báo riêng tư `sending / model` trong lúc tải; không đóng gói trong bộ cài v1. Lõi hỏi đáp vẫn chạy offline khi chưa có model (Constitution I).
   Tệp ONNX theo CPU: `model_qint8_arm64` (Apple Silicon) / `model_quint8_avx2` (x64).
5. **Trạng thái:** kênh IPC chỉ đọc `ai:getRerankerStatus` (`unavailable|idle|downloading|ready|error`) + một dòng ở Cài đặt › AI (vi/en).
6. **Hiệu chuẩn:** `RELEVANCE_CALIBRATION.rerank` (model, `RERANK_MODEL_VERSION`, `maxTokens`, cấu hình, số liệu dev/hold-out/en, độ trễ) +
   `datasetVersion "3"`; test canh giữ: đổi model bộ chấm hoặc bộ đo mà không đo lại ⇒ fail. `EVAL_MODE=current` đo lại và so cả bộ chấm.
7. **Ngưỡng chung** vi/en (FR-011, cổng #15).

## Bổ sung sau review (code / bảo mật, 2026-10-08)

- **Ghim phiên bản model:** tải đúng commit Hugging Face `RERANK_MODEL_REVISION` (`1427fd65…`, Apache-2.0) thay vì `main`; `RERANK_MODEL_VERSION`
  gồm commit ⇒ đổi commit phải đo lại. `cache_dir`/`revision` truyền theo từng lần nạp (không đổi `env.cacheDir` dùng chung).
- **Không dồn hàng đợi:** tối đa một lượt chấm đang chạy + một lượt chờ; nhiều hơn ⇒ bỏ qua bước chấm với lý do `busy` (lượt quá giờ không làm các
  câu sau chờ theo).
- **Thử tải lại sau lỗi:** chờ ít nhất 10 phút (offline không thử tải và nhấp nháy chỉ báo ở mỗi câu hỏi). Cài đặt vẫn đọc lại trạng thái mỗi 30 s.
- **Người dùng đã có nguồn từ trước:** tải nền 5 s sau khi mở app (không phải đợi thêm nguồn mới).
- Không còn đoạn nào để chấm (bị xoá giữa chừng) ⇒ bỏ qua bước chấm, không trả "không tìm thấy".

## Số đo (bộ đo v3: vi 82 có đáp án + 32 không có, en 22 + 12; máy tham chiếu macOS arm64)

|                                                                 | Từ chối đúng (vi dev / **vi hold-out** / en) | Recall@6 (vi dev / **vi hold-out** / en) | Trễ thêm/câu                     |
| --------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------- | -------------------------------- |
| Mốc (108, không chấm)                                           | 0% / 0% / 0%                                 | 96,6% / 95,8% / 68,2%                    | —                                |
| **Chọn: a1, top-12, 256 token, ≥ 0,6**                          | 95,5% / **100% (10/10)** / 75,0%             | 87,9% / **95,8%** / 68,2%                | p50 230–367 ms · p95 308–612 ms  |
| a1, 20 ứng viên, 512 token                                      | 95,5% / 100% / 66,7%                         | 89,7% / 95,8% / 72,7%                    | p50 419–504 ms · p95 720–1146 ms |
| a2 `onnx-community/gte-multilingual-reranker-base` (q8, 341 MB) | 95,5% / 100% / 100%                          | 94,8% / 95,8% / **31,8%**                | p50 1167 ms · p95 13,9 s         |

- Cổng (R6): vi hold-out từ chối đúng ≥ 90% ✓, Recall@6 ≥ 85% ✓, cận dưới Wilson từ chối đúng vi gộp **84,3%** (31/32) ≥ 0,75 ✓, English không tụt ✓
  (Recall@6 bằng mốc, từ chối đúng 0% → 75%) ⇒ **ĐẠT**.
- a2 loại: English Recall@6 sụp (31,8%) và quá chậm. Hướng b (LLM chấm) và c (đổi embedding) không cần đo.
- Đo lặp có kiểm soát (cùng 12 đoạn ~290 token): p50 286 ms. Suy luận ONNX bất đồng bộ; event loop main chỉ bị chặn bởi bước tách từ (≤ ~70 ms,
  đo được 120 ms trong một lượt máy bận). RSS +~200 MB khi nạp. Nạp model (đã có cache) 0,8–2,1 s.
- Kiểm thử app thật (Electron, model thật): `idle → downloading → ready` ~7 s (lần tải đầu), chỉ báo `sending/model` trong lúc tải, câu không có
  đáp án ⇒ notFound không gọi model, câu có đáp án đi tiếp.

## End-to-end qua LLM (tham khảo — `EVAL_MODE=current EVAL_WITH_LLM=1`, qwen2.5:7b, chế độ Theo nguồn, có bộ chấm)

| Nhóm        | Có đáp án có `[n]` hợp lệ        | Trả nhầm "không tìm thấy" | Đúng ngôn ngữ | Từ chối đúng câu không có đáp án                                |
| ----------- | -------------------------------- | ------------------------- | ------------- | --------------------------------------------------------------- |
| vi hold-out | 100% (24)                        | 0%                        | 100%          | **100% (10/10)** — trước (123, không bộ chấm): dao động 5/6–6/6 |
| en          | 72,7% (22) — 123: 77,3% (−1 câu) | 27,3%                     | 90,9%         | 100% (12/12)                                                    |

Hồi quy: "✓ Khớp số liệu ghi trong RELEVANCE_CALIBRATION" và "✓ Bộ chấm khớp số liệu ghi trong RELEVANCE_CALIBRATION.rerank".

## Hệ quả & giới hạn đã biết

- **Từ chối nhầm câu có đáp án:** dev 10,3% (6/58) câu có đáp án bị chặn ⇒ người dùng nhận "Không tìm thấy" + gợi ý (hỏi cụ thể hơn / chế độ Mở
  rộng); hold-out 0%; English 13,6%. Đánh đổi có chủ đích lấy từ chối đúng 0% → ~95–100%.
- **English** từ chối đúng 75% (vi 100%) — ngưỡng chung, chấp nhận (cổng #15); model huấn luyện trên mMARCO dịch máy.
- **Độ trễ** thêm ~0,2–0,4 s mỗi câu (câu không có đáp án lại nhanh hơn vì không gọi model chat). Ngân sách chốt: p50 ≤ 400 ms, p95 ≤ 800 ms trên máy
  tham chiếu; Windows x64 (`model_quint8_avx2`) chưa đo trên máy thật — đo ở CI ubuntu x64 khi chạy workflow `eval-retrieval`.
- **Lần đầu / offline:** chưa có model ⇒ hành vi như 108 (fail-open) cho tới khi tải xong.
- **Giấy phép:** trọng số Apache-2.0; dữ liệu huấn luyện một phần dẫn xuất MS MARCO (điều khoản gốc phi thương mại) — vùng xám phổ biến, rủi ro đã
  biết trước khi làm bản trả phí.
- Cỡ mẫu: hold-out 10 câu không có đáp án ⇒ khoảng tin cậy rộng [72–100]; đo lại khi đổi model/bộ đo (test canh giữ nhắc).

## Phương án đã cân nhắc

- Ngưỡng khoảng cách / cổng BM25 (108) — không tách được.
- a2 gte-multilingual-reranker-base — tốt cho vi nhưng English sụp, chậm.
- bge-reranker-v2-m3 (571 MB int8), ViRanker / Vietnamese_Reranker (~570 MB, không ONNX) — quá lớn; jina-reranker-v2 — giấy phép không thương mại;
  PhoRanker — cần tách từ VnCoreNLP (Java/Python); model chỉ English — loại (research R1).
- LLM cục bộ chấm (hướng b) — không tất định, cần Ollama, chậm; không cần vì a1 đạt.
- Xếp lại theo điểm bộ chấm trước MMR — không đổi số liệu ⇒ không bật (đơn giản hơn).
