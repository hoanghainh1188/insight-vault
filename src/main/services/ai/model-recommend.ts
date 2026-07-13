// Gợi ý cỡ model chat theo RAM máy (059, US3). CHỈ gợi ý — không tự tải. Máy Windows/yếu chọn model quá
// lớn sẽ chậm/treo → hướng người dùng chọn cỡ phù hợp. Hàm thuần (detectRam tách riêng ở I/O).

export type ChatTier = "small" | "medium" | "large";

export interface ModelRecommendation {
  tier: ChatTier;
  label: string;
  examples: string[];
  totalMemGb: number;
}

const GB = 1024 * 1024 * 1024;

/**
 * Ánh xạ RAM tổng → cỡ model chat khuyến nghị.
 * < 8GB → small (~3B) · 8–16GB → medium (7–8B) · > 16GB → large.
 */
export function recommendChatModel(totalMemBytes: number): ModelRecommendation {
  const totalMemGb = Math.round((totalMemBytes / GB) * 10) / 10;
  if (totalMemBytes < 8 * GB) {
    return {
      tier: "small",
      label: "Model nhỏ (~3B) — hợp máy RAM thấp",
      examples: ["qwen2.5:3b", "gemma2:2b", "llama3.2:3b"],
      totalMemGb,
    };
  }
  if (totalMemBytes <= 16 * GB) {
    return {
      tier: "medium",
      label: "Model vừa (7–8B) — cân bằng chất lượng/tốc độ",
      examples: ["qwen2.5:7b", "llama3.1:8b", "mistral:7b"],
      totalMemGb,
    };
  }
  return {
    tier: "large",
    label: "Model lớn (14B+) — chất lượng cao, cần nhiều RAM",
    examples: ["qwen2.5:14b", "gemma2:27b"],
    totalMemGb,
  };
}
