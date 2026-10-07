import { dirname, extname } from "node:path";
import type { SourceRelinkResult } from "@shared/ipc/types";
import { extensionsForKind } from "./parsers";
import type { SourceRepo } from "./source-repo";

// 101 — liên kết lại file gốc (nguồn tham chiếu file theo đường dẫn; người dùng di chuyển/đổi tên ⇒ 404). Chỉ nhận
// tệp có CÙNG nội dung (SHA-256 = content_hash lúc nạp): trích dẫn [n] lưu vị trí trong nội dung cũ, nhận tệp khác
// sẽ trỏ sai (Constitution II). Đường dẫn chỉ đến từ hộp thoại ở main. KHÔNG log đường dẫn (Constitution III).

export interface RelinkDeps {
  repo: Pick<SourceRepo, "getRelinkInfo" | "updateOrigin">;
  /** Hộp thoại chọn tệp (main) — null nếu người dùng huỷ. */
  pickFile: (opts: {
    defaultDir: string;
    extensions: string[];
  }) => Promise<string | null>;
  hashFile: (path: string) => Promise<{ hash: string; byteLength: number }>;
  /** Đường dẫn thật (giải symlink) — lưu cái này, không lưu đường dẫn liên kết có thể bị đổi đích sau. */
  realpath: (path: string) => Promise<string>;
  /** Vault đang sao lưu/khôi phục? Kiểm lại NGAY TRƯỚC khi ghi (hộp thoại có thể mở rất lâu). */
  isLocked: () => boolean;
  log: (event: string, meta: Record<string, unknown>) => void;
}

const errorTypeOf = (e: unknown): string =>
  e instanceof Error ? e.constructor.name : typeof e;

export function createRelink(
  deps: RelinkDeps,
): (sourceId: unknown) => Promise<SourceRelinkResult> {
  // Chặn 2 lần chọn lại chồng nhau trên cùng nguồn (băm tệp lớn tốn thời gian; tránh ghi đua).
  const inFlight = new Set<string>();

  async function run(
    sourceId: string,
    info: NonNullable<ReturnType<RelinkDeps["repo"]["getRelinkInfo"]>>,
  ): Promise<SourceRelinkResult> {
    const extensions = extensionsForKind(info.kind);
    const picked = await deps.pickFile({
      defaultDir: dirname(info.origin),
      extensions,
    });
    if (picked === null) return { status: "cancelled" };

    let real: string;
    let hash: string;
    try {
      real = await deps.realpath(picked);
      // Kiểm đuôi (của tệp THẬT) trước khi băm — video có thể vài GB; iv-media:// chỉ phục vụ đuôi media đã biết.
      if (!extensions.includes(extname(real).slice(1).toLowerCase())) {
        return { status: "wrongType" };
      }
      hash = (await deps.hashFile(real)).hash;
    } catch (e) {
      deps.log("source.relinkFailed", { errorType: errorTypeOf(e) });
      return { status: "error" };
    }
    if (hash !== info.contentHash) return { status: "mismatch" };
    if (deps.isLocked()) return { status: "locked" };

    deps.repo.updateOrigin(sourceId, real);
    deps.log("source.relinked", { kind: info.kind });
    return { status: "ok" };
  }

  return async (sourceId) => {
    if (typeof sourceId !== "string") return { status: "notApplicable" };
    const info = deps.repo.getRelinkInfo(sourceId);
    if (!info || info.kind === "url") return { status: "notApplicable" };
    // Đang xếp hàng/xử lý ⇒ pipeline sắp đọc tệp — không đổi đường dẫn giữa chừng.
    if (info.status === "queued" || info.status === "processing") {
      return { status: "busy" };
    }
    if (inFlight.has(sourceId)) return { status: "busy" };
    inFlight.add(sourceId);
    try {
      return await run(sourceId, info);
    } finally {
      inFlight.delete(sourceId);
    }
  };
}
