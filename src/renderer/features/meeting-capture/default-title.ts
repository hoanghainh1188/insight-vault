// 186 — phần ngày/giờ của tên mặc định "Cuộc họp 12/10, 14:30" (FR-002, D15). THUẦN; khuôn chữ nằm ở i18n
// (meeting.start.defaultName). Ngày theo thứ tự của locale (vi dd/MM, en MM/dd) nhưng luôn dùng "/" (ICU vi-VN
// mặc định cho "12-10", khác mẫu trong thiết kế); giờ luôn 24h.

export function meetingTitleParts(
  date: Date,
  intlLocale: string,
): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat(intlLocale, {
    day: "2-digit",
    month: "2-digit",
  })
    .formatToParts(date)
    .filter((p) => p.type === "day" || p.type === "month")
    .map((p) => p.value);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return {
    date: parts.join("/"),
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}
