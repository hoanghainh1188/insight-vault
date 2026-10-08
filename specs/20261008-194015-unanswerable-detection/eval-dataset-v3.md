# Bộ đánh giá v3 — đề xuất câu không có đáp án (T009, chờ duyệt T010)

Mục tiêu (clarify #2, research R6): tiếng Việt không có đáp án 20 → **32** (dev 14 → 22, hold-out 6 → 10); English 9 → **12** (dev 4 → 7).
Ưu tiên câu **sát chủ đề** ("hard negative"): hỏi một chi tiết KHÔNG có trong tài liệu về đúng chủ thể của tài liệu — loại 108 thất bại. Cột
"Bằng chứng" là số lần xuất hiện từ khoá trong tài liệu (`grep -ci`); "có mặt" = tài liệu nói về chủ thể nhưng không có chi tiết được hỏi.

## Tiếng Việt (12)

| ID | Nhóm | Câu hỏi | Tài liệu gần nhất | Bằng chứng không có đáp án | Loại |
| -- | ---- | ------- | ----------------- | -------------------------- | ---- |
| q-134 | dev | Đài thiên văn nào ở Việt Nam đã quan sát nhật thực toàn phần năm 1995? | he-mat-troi | "1995" = 0, "đài thiên văn" = 0 ("nhật thực" = 1 — chỉ giải thích hiện tượng) | sát chủ đề |
| q-135 | dev | Năm 2003, Sao Hỏa tiến gần Trái Đất nhất ở khoảng cách bao nhiêu km? | he-mat-troi | "2003" = 0 (Sao Hỏa có mặt — bán kính, quỹ đạo) | sát chủ đề |
| q-136 | dev | Một hecta lúa hấp thụ bao nhiêu kg CO₂ mỗi năm nhờ quang hợp? | quang-hop | "lúa" = 0, "hecta" = 0, "kg" = 0 (CO₂ có mặt 25 lần) | sát chủ đề |
| q-137 | dev | Sân vận động Mỹ Đình có sức chứa bao nhiêu chỗ ngồi? | bong-da | "Mỹ Đình" = 0, "sức chứa" = 0 | gần chủ đề |
| q-138 | dev | Phở Bát Đàn ở Hà Nội mở cửa bán từ mấy giờ sáng? | pho | "mở cửa" = 0 (Phở Bát Đàn có mặt trong danh sách quán nổi tiếng) | sát chủ đề |
| q-139 | dev | Hồ sơ xin nhập quốc tịch Việt Nam có được nộp trực tuyến qua Cổng dịch vụ công quốc gia không? | luat-quoc-tich-2008 | "trực tuyến" = 0, "dịch vụ công" = 0 | sát chủ đề |
| q-140 | dev | Theo Luật Bảo vệ môi trường 1993, doanh nghiệp xả thải vượt chuẩn bị phạt tối đa bao nhiêu tỷ đồng? | luat-bvmt-1993 | "tỷ" = 0 ("phạt" = 1 — chỉ nói chung "bị xử phạt", không mức tiền) | sát chủ đề |
| q-141 | dev | Mỗi năm hang Sửng Sốt đón bao nhiêu lượt khách quốc tế? | vinh-ha-long | không có số khách theo hang (chỉ có số khách toàn vịnh 1996/2003; hang Sửng Sốt có mặt 11 lần) | sát chủ đề |
| q-142 | holdout | Tháp Rùa được trùng tu lần gần nhất vào năm nào? | ho-hoan-kiem | "trùng tu" = 0, "tu bổ" = 0 (năm xây 1884–1886 có mặt) | sát chủ đề |
| q-143 | holdout | Cầu Cần Thơ bắc qua sông Hậu dài bao nhiêu mét? | song-me-kong | "Cần Thơ" = 0 (sông Hậu, cầu Mỹ Thuận có mặt) | sát chủ đề |
| q-144 | holdout | Bộ áo dài đắt nhất thế giới được bán với giá bao nhiêu? | ao-dai | "đắt" = 0 ("giá cả vừa phải" có mặt) | sát chủ đề |
| q-145 | holdout | Đội tuyển Việt Nam lần đầu vô địch AFF Cup vào năm nào? | bong-da | "AFF" = 0, "Việt Nam" = 0, "Đông Nam Á" = 0 | gần chủ đề |

## English (3, dev)

| ID | Câu hỏi | Tài liệu gần nhất | Bằng chứng | Loại |
| -- | ------- | ----------------- | ---------- | ---- |
| q-146 | How long is the Can Tho Bridge over the Hau River? | song-me-kong | "Cần Thơ" = 0 | sát chủ đề (xuyên ngôn ngữ) |
| q-147 | How many kilograms of CO₂ does one hectare of rice absorb per year through photosynthesis? | quang-hop | "lúa" = 0, "hecta" = 0 | sát chủ đề (xuyên ngôn ngữ) |
| q-148 | What time does Pho Bat Dan open in the morning? | pho | "mở cửa" = 0 | sát chủ đề (xuyên ngôn ngữ) |

## Sau khi thêm

| Nhóm | dev | hold-out | Tổng |
| ---- | --- | -------- | ---- |
| vi không có đáp án | 22 | 10 | 32 |
| en không có đáp án | 7 | 5 | 12 |

`datasetVersion` "2" → "3"; `reviewed` đặt lại sau khi duyệt. Câu có đáp án không đổi (vi 82, en 22).

Lưu ý: q-141 dựa trên ranh giới "số khách theo hang" vs "số khách toàn vịnh" — nếu thấy quá mơ hồ, có thể loại hoặc thay.
