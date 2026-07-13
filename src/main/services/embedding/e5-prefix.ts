// Tiền tố e5 (059). Model e5 được huấn luyện với 2 tiền tố bắt buộc: "query: " cho câu truy vấn và
// "passage: " cho đoạn văn. Thiếu tiền tố → tụt chất lượng xếp hạng. Hàm thuần → test dễ.

export type EmbedRole = "query" | "passage";

/** Gắn tiền tố e5 theo vai trò. KHÔNG cắt/chuẩn hoá nội dung (chỉ prefix). */
export function withE5Prefix(text: string, role: EmbedRole): string {
  return `${role}: ${text}`;
}
