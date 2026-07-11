import type { LLMProvider } from "../ai-runtime/provider";

// Sinh embedding cho các chunk qua ProviderRegistry/LLMProvider (ADR D3). `embed` nhận SINGLE text
// (xem provider.ts) → lặp tuần tự. `dim` đọc TỪ vector trả về (không hardcode — research R5).

export interface EmbedResult {
  vectors: number[][];
  dim: number;
}

/** Embed danh sách text; báo tiến độ theo từng chunk qua onProgress(0..1). */
export async function embedTexts(
  provider: Pick<LLMProvider, "embed">,
  texts: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<EmbedResult> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    const { vector } = await provider.embed({ text: texts[i] });
    vectors.push(vector);
    onProgress?.(i + 1, texts.length);
  }
  const dim = vectors[0]?.length ?? 0;
  if (dim === 0 && texts.length > 0) {
    throw new Error("Embedding rỗng — model nhúng không trả vector.");
  }
  return { vectors, dim };
}
