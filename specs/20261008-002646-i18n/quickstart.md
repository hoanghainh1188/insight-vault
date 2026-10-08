# Quickstart — kiểm chứng 123 i18n

## Điều kiện

- `npm install`; `npm run build` (e2e chạy trên `out/`).
- Đo lời nhắc: Ollama chạy cục bộ với một model chat **cục bộ** (vd `qwen2.5:7b` hoặc model sẵn có trên máy; không dùng
  model `:cloud`). Đặt `EVAL_LLM_MODEL=<tên>` để so trước/sau cùng model.

## 1. Test gate tự động

```bash
npm run lint
npm test                      # gồm i18n-catalog, i18n-no-hardcoded-vi, migration #10, coverage ≥ 80%
npm run build
npm run test:e2e              # helper cố định IV_UI_LANG=vi; i18n.spec.ts chạy English + đổi ngôn ngữ
EVAL_MODE=current npm run eval:retrieval   # phải in "✓ Khớp số liệu … (hồi quy OK)"
```

Kỳ vọng: xanh toàn bộ; quét chuỗi cứng báo 0 vi phạm; ca cố ý (thêm tạm một chuỗi Việt vào một tệp `.tsx`) làm test quét
đỏ (SC-002).

## 2. Lần đầu theo hệ điều hành (US1, SC-004)

```bash
IV_UI_LANG=en npm run dev     # mô phỏng máy English (chỉ bản dev)
IV_UI_LANG=vi npm run dev
```

Vault trống: `en` ⇒ màn chào, Notebooks, thêm nguồn, chat, Studio, Cài đặt, hộp thoại sao lưu bằng English; `vi` ⇒ như bản
hiện tại. Soát không còn chuỗi giao diện tiếng Việt khi `en` (SC-001).

## 3. Đổi ngôn ngữ áp dụng ngay (US2, SC-003, SC-005)

1. Dùng một vault cũ (từ v0.2.9) có: một nguồn lỗi (vd URL không tải được), lịch sử chat có câu "Không tìm thấy trong nguồn".
2. Mở app bản mới (migration #10 chạy). Cài đặt › Ngôn ngữ ⇒ English: toàn giao diện đổi ≤ 1 s, không tải lại; nhãn lỗi nguồn,
   câu "không tìm thấy" cũ, chỉ báo riêng tư đổi theo; câu hỏi đang gõ còn nguyên.
3. Đổi lại "Tiếng Việt" ⇒ đổi ngay. Chọn "English", thoát, mở lại ⇒ vẫn English. Chọn "Tự động" ⇒ theo hệ điều hành.
4. Sao lưu rồi khôi phục ⇒ lựa chọn ngôn ngữ của máy giữ nguyên.

## 4. Ngôn ngữ câu trả lời (US3, SC-006, SC-007)

- Tay: notebook có nguồn tiếng Việt; hỏi tiếng Anh ở chế độ "Sources only" ⇒ trả lời English kèm `[n]` mở đúng đoạn Việt; hỏi
  tiếng Việt khi giao diện English ⇒ trả lời tiếng Việt; câu không có trong nguồn ⇒ "not found" + gợi ý theo ngôn ngữ giao diện.
- Số đo (chạy hai lần — trước khi đổi lời nhắc và sau):

```bash
EVAL_MODE=current EVAL_WITH_LLM=1 EVAL_LLM_MODEL=<model> npm run eval:retrieval
```

Báo cáo LLM theo nhóm vi/en: tỉ lệ `[n]` hợp lệ, từ chối đúng, trả nhầm "không tìm thấy", ngôn ngữ khớp. Tiêu chí: (a),(b) không
thấp hơn trước quá 1 câu/nhóm; ngôn ngữ khớp ≥ 90% câu có đáp án. Ghi hai bảng vào ADR.

## 5. Studio & định dạng (US4, US5)

- Giao diện English ⇒ tạo Summary/Key points/FAQ/Outline trên nguồn Việt ⇒ nội dung English có `[n]`; kết quả Việt cũ giữ
  nguyên; xuất ⇒ tên tệp `Summary — 2026-10-08.md`.
- Ngày tạo notebook, thông tin bản sao lưu, dung lượng lưu trữ đổi quy ước theo ngôn ngữ.

## 6. Local-first & tràn chữ (SC-008, SC-009)

- Ngắt mạng, chạy cả hai ngôn ngữ ⇒ không yêu cầu mạng mới (chỉ báo riêng tư luôn "local" khi không bật AI online).
- Ảnh chụp e2e English ở kích thước cửa sổ mặc định và nhỏ nhất ⇒ không nút/cột/hộp thoại bị tràn che chữ.
