import { describe, expect, it, vi } from "vitest";
import { createReprocessRequest } from "../../src/main/services/ingestion/reprocess-request";
import { REPROCESS_ERRORS } from "../../src/main/services/ingestion/reprocess-guard";
import type { Source } from "../../src/shared/ipc/types";

// 112 (FR-014, contracts/ipc-reprocess.md): handler source:reprocess — khoá kho / guard ⇒ ném; tệp mất ⇒ missing;
// tệp bị sửa ⇒ mismatch; hợp lệ ⇒ queued.

const src = (over: Partial<Source> = {}): Source => ({
  id: "s1",
  notebookId: "nb1",
  kind: "pdf",
  title: "a.pdf",
  status: "ready",
  errorLabel: null,
  pageCount: 1,
  createdAt: 1,
  updatedAt: 1,
  extractionVersion: 1,
  ...over,
});

function make(
  over: Partial<{
    source: Source | null;
    exists: boolean;
    hash: string;
    locked: boolean;
  }> = {},
) {
  const o = { source: src(), exists: true, hash: "h", locked: false, ...over };
  const reprocess = vi.fn(async () => {});
  const hashFile = vi.fn(async () => ({ hash: o.hash, byteLength: 1 }));
  const handle = createReprocessRequest({
    repo: {
      getById: () => o.source,
      getRelinkInfo: () =>
        o.source
          ? {
              kind: o.source.kind,
              status: o.source.status,
              origin: "/docs/a.pdf",
              contentHash: "h",
            }
          : null,
    },
    pipeline: { reprocess },
    isVaultLocked: () => o.locked,
    fileExists: async () => o.exists,
    hashFile,
  });
  return { handle, reprocess, hashFile };
}

describe("createReprocessRequest", () => {
  it("hợp lệ ⇒ {queued} và gọi pipeline.reprocess", async () => {
    const m = make();
    await expect(m.handle("s1")).resolves.toEqual({ status: "queued" });
    expect(m.reprocess).toHaveBeenCalledWith("s1");
  });

  it("vault khoá ⇒ ném thông điệp khoá, không đọc tệp", async () => {
    const m = make({ locked: true });
    await expect(m.handle("s1")).rejects.toThrow(REPROCESS_ERRORS.vaultLocked);
    expect(m.hashFile).not.toHaveBeenCalled();
  });

  it("guard từ chối (không phải PDF / trạng thái) ⇒ ném", async () => {
    await expect(
      make({ source: src({ kind: "docx" }) }).handle("s1"),
    ).rejects.toThrow(REPROCESS_ERRORS.notPdf);
    await expect(
      make({ source: src({ status: "processing" }) }).handle("s1"),
    ).rejects.toThrow(REPROCESS_ERRORS.badStatus);
    await expect(make({ source: null }).handle("s1")).rejects.toThrow(
      REPROCESS_ERRORS.notFound,
    );
  });

  it("sourceId không phải chuỗi ⇒ ném notFound", async () => {
    await expect(make().handle(42)).rejects.toThrow(REPROCESS_ERRORS.notFound);
  });

  it("tệp gốc không còn ⇒ {missing}, không xếp hàng", async () => {
    const m = make({ exists: false });
    await expect(m.handle("s1")).resolves.toEqual({ status: "missing" });
    expect(m.reprocess).not.toHaveBeenCalled();
  });

  it("tệp gốc đã bị sửa (hash khác) ⇒ {mismatch}, không xếp hàng", async () => {
    const m = make({ hash: "khac" });
    await expect(m.handle("s1")).resolves.toEqual({ status: "mismatch" });
    expect(m.reprocess).not.toHaveBeenCalled();
  });

  it("đọc/băm tệp lỗi ⇒ {missing}", async () => {
    const m = make();
    m.hashFile.mockRejectedValueOnce(new Error("EACCES"));
    await expect(m.handle("s1")).resolves.toEqual({ status: "missing" });
  });
});
