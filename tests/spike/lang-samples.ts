// 186 spike S2 — văn bản do dự án tự viết, đọc bằng giọng hệ thống macOS (`say`) để tạo 10 mẫu ~30 s đo phát hiện ngôn ngữ.
// Không dùng giọng người thật hay tư liệu có bản quyền.

export interface LangSample {
  id: string;
  lang: "vi" | "en";
  voice: string;
  text: string;
}

export const LANG_SAMPLES: readonly LangSample[] = [
  {
    id: "vi-1",
    lang: "vi",
    voice: "Linh",
    text: "Chào mọi người, hôm nay chúng ta họp để rà soát tiến độ dự án quý ba. Nhóm giao diện đã hoàn thành màn hình đăng nhập và đang làm phần cài đặt. Nhóm máy chủ gặp chậm trễ ở khâu kiểm thử hiệu năng, dự kiến cần thêm một tuần. Tôi đề nghị chúng ta dời buổi demo sang thứ sáu tuần sau để có thời gian sửa lỗi. Ai có ý kiến khác thì nói luôn nhé, nếu không chúng ta chốt như vậy.",
  },
  {
    id: "vi-2",
    lang: "vi",
    voice: "Linh",
    text: "Về ngân sách, phòng tài chính đã duyệt khoản chi cho máy chủ mới nhưng yêu cầu báo cáo chi tiết trước cuối tháng. Chị Hoa sẽ phụ trách tổng hợp số liệu từ các nhóm. Mỗi nhóm gửi bảng chi phí dự kiến cho chị ấy trước thứ tư. Lưu ý ghi rõ khoản nào là chi một lần và khoản nào là chi định kỳ hằng tháng, để bên tài chính dễ đối chiếu và không phải hỏi lại nhiều lần.",
  },
  {
    id: "vi-3",
    lang: "vi",
    voice: "Linh",
    text: "Khách hàng phản hồi rằng ứng dụng chạy chậm khi mở tài liệu lớn trên máy tính cũ. Chúng tôi đã đo lại và thấy thời gian tải trang đầu tiên khoảng bốn giây. Mục tiêu là giảm xuống dưới hai giây. Có hai hướng: tải dần từng trang hoặc lưu sẵn bản xem trước. Anh Minh sẽ thử hướng thứ nhất trong tuần này và báo kết quả vào buổi họp tiếp theo, kèm số đo trước và sau khi sửa.",
  },
  {
    id: "vi-4",
    lang: "vi",
    voice: "Linh",
    text: "Tuần trước có ba sự cố đăng nhập vào buổi sáng, đều do chứng chỉ hết hạn ở máy chủ phụ. Từ nay chúng ta sẽ đặt lịch nhắc gia hạn trước ba mươi ngày và kiểm tra tự động mỗi đêm. Bộ phận hỗ trợ cũng cần một trang hướng dẫn ngắn để trả lời người dùng khi có sự cố tương tự. Tôi sẽ viết bản nháp và gửi mọi người góp ý trước thứ năm, sau đó đưa lên trang nội bộ.",
  },
  {
    id: "vi-5",
    lang: "vi",
    voice: "Linh",
    text: "Cuối cùng là kế hoạch tuyển dụng. Chúng ta cần thêm hai kỹ sư kiểm thử và một người thiết kế giao diện. Bản mô tả công việc đã được cập nhật và đăng trên trang tuyển dụng của công ty. Mỗi người trong nhóm hãy giới thiệu ứng viên phù hợp nếu biết. Vòng phỏng vấn đầu tiên dự kiến bắt đầu vào giữa tháng sau, mỗi buổi kéo dài khoảng bốn mươi lăm phút, gồm phần kỹ thuật và phần trao đổi.",
  },
  {
    id: "en-1",
    lang: "en",
    voice: "Samantha",
    text: "Good morning everyone, let's go over the quarterly roadmap. The design team finished the onboarding screens last week, and the backend team is still working on the search service. We found a performance issue in the indexing job, so we will need about five more days. I suggest we move the customer demo to next Friday. If anyone has concerns about that timeline, please raise them now so we can adjust the plan before we commit.",
  },
  {
    id: "en-2",
    lang: "en",
    voice: "Samantha",
    text: "On the budget side, finance approved the new hardware request, but they want a detailed breakdown by the end of the month. Sarah will collect the numbers from every team. Please send her your estimated costs by Wednesday, and clearly separate one time purchases from recurring monthly subscriptions. That will save us a lot of back and forth with the finance department and help us close the review on time.",
  },
  {
    id: "en-3",
    lang: "en",
    voice: "Daniel",
    text: "Several customers reported that the application feels slow when opening large documents on older laptops. We measured the first page load at around four seconds, and our goal is to bring that under two seconds. There are two options on the table: load pages progressively, or cache a preview when the document is imported. Michael will prototype the first option this week and share the before and after numbers at our next meeting.",
  },
  {
    id: "en-4",
    lang: "en",
    voice: "Karen",
    text: "Last week we had three login incidents in the morning, all caused by an expired certificate on a secondary server. From now on we will schedule a renewal reminder thirty days ahead and run an automated check every night. The support team also asked for a short help article they can share with users when this happens. I will write a first draft and circulate it for comments before Thursday.",
  },
  {
    id: "en-5",
    lang: "en",
    voice: "Samantha",
    text: "Finally, hiring. We need two more test engineers and one product designer. The job descriptions have been updated and posted on the careers page. If you know someone who might be a good fit, please send them our way. The first round of interviews should start around the middle of next month, and each session will take about forty five minutes, covering a technical exercise and an open conversation.",
  },
];
