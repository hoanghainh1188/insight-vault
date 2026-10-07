import type { SourceReprocessResult } from "@shared/ipc/types";
import type { IngestionPipeline } from "./pipeline";
import { REPROCESS_ERRORS, checkReprocessable } from "./reprocess-guard";
import type { SourceRepo } from "./source-repo";

// 112 (FR-012, FR-014; contracts/ipc-reprocess.md): xử lý yêu cầu "Xử lý lại" từ renderer (chỉ nhận sourceId).
// Thứ tự: khoá kho → quy tắc chặn → tệp gốc còn? (không ⇒ missing — renderer dẫn sang "Chọn lại tệp gốc…", 101) →
// SHA-256 = content_hash? (khác ⇒ mismatch, chặn) → xếp hàng. KHÔNG log đường dẫn/nội dung (Constitution III).

export interface ReprocessRequestDeps {
  repo: Pick<SourceRepo, "getById" | "getRelinkInfo">;
  pipeline: Pick<IngestionPipeline, "reprocess">;
  isVaultLocked: () => boolean;
  fileExists: (path: string) => Promise<boolean>;
  hashFile: (path: string) => Promise<{ hash: string; byteLength: number }>;
}

export function createReprocessRequest(
  deps: ReprocessRequestDeps,
): (sourceId: unknown) => Promise<SourceReprocessResult> {
  return async (sourceId) => {
    const vaultLocked = deps.isVaultLocked();
    if (typeof sourceId !== "string" || sourceId === "") {
      throw new Error(
        vaultLocked ? REPROCESS_ERRORS.vaultLocked : REPROCESS_ERRORS.notFound,
      );
    }
    const blocked = checkReprocessable(deps.repo.getById(sourceId), {
      queued: false, // pipeline.reprocess tự từ chối nguồn đang trong hàng đợi (REPROCESS_ERRORS.busy)
      vaultLocked,
    });
    if (blocked) throw new Error(blocked);
    const info = deps.repo.getRelinkInfo(sourceId);
    if (!info) throw new Error(REPROCESS_ERRORS.notFound);
    try {
      if (!(await deps.fileExists(info.origin))) return { status: "missing" };
      const { hash } = await deps.hashFile(info.origin);
      if (hash !== info.contentHash) return { status: "mismatch" };
    } catch {
      return { status: "missing" };
    }
    await deps.pipeline.reprocess(sourceId);
    return { status: "queued" };
  };
}
