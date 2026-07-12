// Parse token delta từ dòng stream của từng provider (039). THUẦN — unit-test kỹ (crux). Đọc body stream
// (I/O) ở online-http.streamLines; ở đây chỉ bóc delta từ 1 dòng đã tách. Rác/không có delta → null.

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Bóc payload sau "data:" của 1 dòng SSE. Dòng khác (event:/comment/rỗng) → null. */
export function sseData(line: string): string | null {
  const t = line.trimStart();
  if (!t.startsWith("data:")) return null;
  return t.slice(5).trim();
}

/** Ollama /api/chat stream:true → mỗi dòng là 1 JSON `{message:{content},done}`. Trả delta hoặc null. */
export function parseOllamaLine(line: string): string | null {
  const t = line.trim();
  if (!t) return null;
  const j = safeJson(t) as { message?: { content?: unknown }; done?: unknown };
  const c = j?.message?.content;
  return typeof c === "string" && c.length > 0 ? c : null;
}

/** OpenAI chat/completions stream → payload sau "data: ". `[DONE]` → null. delta.content. */
export function sseDeltaOpenAI(data: string): string | null {
  const t = data.trim();
  if (t === "" || t === "[DONE]") return null;
  const j = safeJson(t) as { choices?: { delta?: { content?: unknown } }[] };
  const c = j?.choices?.[0]?.delta?.content;
  return typeof c === "string" && c.length > 0 ? c : null;
}

/** Anthropic Messages stream → chỉ event `content_block_delta` (delta.text) mới có chữ. */
export function sseDeltaAnthropic(data: string): string | null {
  const t = data.trim();
  if (t === "") return null;
  const j = safeJson(t) as {
    type?: unknown;
    delta?: { type?: unknown; text?: unknown };
  };
  if (j?.type !== "content_block_delta") return null;
  const c = j?.delta?.text;
  return typeof c === "string" && c.length > 0 ? c : null;
}

/** Gemini streamGenerateContent?alt=sse → candidates[0].content.parts[].text (nối). */
export function sseDeltaGemini(data: string): string | null {
  const t = data.trim();
  if (t === "") return null;
  const j = safeJson(t) as {
    candidates?: { content?: { parts?: { text?: unknown }[] } }[];
  };
  const parts = j?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .join("");
  return text.length > 0 ? text : null;
}
