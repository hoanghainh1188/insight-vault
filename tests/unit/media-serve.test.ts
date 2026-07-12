import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createMediaHandler } from "../../src/main/services/source-viewer/media-serve";
import type { SourceRepo } from "../../src/main/services/ingestion/source-repo";
import type { Source } from "@shared/ipc/types";

// Integration test cho handler iv-media:// (049). media-serve.ts loại khỏi coverage threshold (I/O),
// nhưng vẫn cần smoke test xác nhận wiring 404 / 200 / 206 đúng end-to-end (code-reviewer #5).

const BODY = Buffer.from("0123456789ABCDEFGHIJ"); // 20 byte

function audioSource(id: string): Source {
  return {
    id,
    notebookId: "nb1",
    kind: "audio",
    title: "clip",
    status: "ready",
    errorLabel: null,
    pageCount: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

let dir: string;
let filePath: string;

// Fake repo: chỉ cần getById + getOrigin. "aud" = nguồn audio có file; "pdf" = nguồn khác kind;
// "missing" = audio nhưng file gốc không tồn tại; còn lại → không có record.
function makeRepo(): SourceRepo {
  const repo: Partial<SourceRepo> = {
    getById: (id) =>
      id === "aud" || id === "missing"
        ? audioSource(id)
        : id === "pdf"
          ? { ...audioSource(id), kind: "pdf" }
          : null,
    getOrigin: (id) =>
      id === "aud" ? filePath : id === "missing" ? "/no/such/file.mp3" : null,
  };
  return repo as SourceRepo;
}

function req(id: string, range?: string): Request {
  const headers = range ? { Range: range } : undefined;
  return new Request(`iv-media://source/${id}`, { headers });
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "iv-media-"));
  filePath = join(dir, "clip.mp3");
  writeFileSync(filePath, BODY);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("createMediaHandler (049)", () => {
  it("id không tồn tại → 404", async () => {
    const res = await createMediaHandler(makeRepo())(req("ghost"));
    expect(res.status).toBe(404);
  });

  it("nguồn không phải audio → 404", async () => {
    const res = await createMediaHandler(makeRepo())(req("pdf"));
    expect(res.status).toBe(404);
  });

  it("audio nhưng file gốc mất → 404", async () => {
    const res = await createMediaHandler(makeRepo())(req("missing"));
    expect(res.status).toBe(404);
  });

  it("không có Range → 200 full body + Content-Length + Accept-Ranges", async () => {
    const res = await createMediaHandler(makeRepo())(req("aud"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(res.headers.get("Content-Length")).toBe("20");
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.equals(BODY)).toBe(true);
  });

  it("Range hợp lệ → 206 + Content-Range + đúng lát byte", async () => {
    const res = await createMediaHandler(makeRepo())(req("aud", "bytes=5-9"));
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 5-9/20");
    expect(res.headers.get("Content-Length")).toBe("5");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.toString()).toBe("56789");
  });

  it("id có ký tự mã hoá URL → decode trước khi tra", async () => {
    // encodeURIComponent giữ nguyên id thường, nhưng handler vẫn decode an toàn.
    const res = await createMediaHandler(makeRepo())(
      req(encodeURIComponent("aud")),
    );
    expect(res.status).toBe(200);
  });
});
