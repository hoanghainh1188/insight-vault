// 088 — báo lỗi renderer về main để ghi nhật ký. Đầu vào từ renderer là KHÔNG tin cậy: kiểm hình, chỉ giữ loại
// lỗi + tên component (Constitution III — không message/stack thô, không URL/đường dẫn), chặn lũ báo lỗi.

export type RendererErrorSource = "boundary" | "window" | "rejection";

export interface RendererErrorReport {
  source: RendererErrorSource;
  errorType: string;
  components: string[];
}

const SOURCES: ReadonlySet<string> = new Set([
  "boundary",
  "window",
  "rejection",
]);
const ERROR_TYPE_RE = /^[A-Za-z_$][\w$.]{0,79}$/;
/** Tên component React: bắt đầu bằng chữ hoa (thẻ HTML như div/main viết thường ⇒ bị bỏ). */
const COMPONENT_LINE_RE = /^\s*(?:at|in)\s+([A-Z][\w$]{0,59})\b/;
const MAX_COMPONENTS = 8;
const MAX_STACK_CHARS = 8_000;

function parseComponents(stack: unknown): string[] {
  if (typeof stack !== "string") return [];
  const names: string[] = [];
  for (const line of stack.slice(0, MAX_STACK_CHARS).split("\n")) {
    const m = COMPONENT_LINE_RE.exec(line);
    if (m && names[names.length - 1] !== m[1]) names.push(m[1]);
    if (names.length === MAX_COMPONENTS) break;
  }
  return names;
}

export function sanitizeRendererError(
  input: unknown,
): RendererErrorReport | null {
  if (input === null || typeof input !== "object") return null;
  const { source, errorType, componentStack } = input as Record<
    string,
    unknown
  >;
  if (typeof source !== "string" || !SOURCES.has(source)) return null;
  return {
    source: source as RendererErrorSource,
    errorType:
      typeof errorType === "string" && ERROR_TYPE_RE.test(errorType)
        ? errorType
        : "Unknown",
    components: parseComponents(componentStack),
  };
}

/** Cùng 1 chữ ký lỗi (nguồn + loại + component) chỉ ghi tối đa chừng này lần — vòng lặp 1 lỗi không chiếm hạn mức. */
const MAX_PER_SIGNATURE = 3;

export interface RendererErrorReporterDeps {
  log: (event: string, meta: Record<string, unknown>) => void;
  /** Số báo lỗi tối đa mỗi phiên (chặn vòng lặp lỗi làm phình nhật ký). */
  max: number;
}

export function createRendererErrorReporter({
  log,
  max,
}: RendererErrorReporterDeps): (input: unknown) => { ok: boolean } {
  let count = 0;
  const seen = new Map<string, number>();
  return (input) => {
    const report = sanitizeRendererError(input);
    if (!report) return { ok: false };
    if (count > max) return { ok: true }; // đã chặn ⇒ không giữ thêm chữ ký (renderer spam không làm phình bộ nhớ)
    const sig = `${report.source}|${report.errorType}|${report.components.join(">")}`;
    const n = (seen.get(sig) ?? 0) + 1;
    seen.set(sig, n);
    if (n > MAX_PER_SIGNATURE) return { ok: true };
    count += 1;
    if (count <= max) log("renderer.error", { ...report });
    else if (count === max + 1) log("renderer.error.suppressed", { max });
    return { ok: true };
  };
}
