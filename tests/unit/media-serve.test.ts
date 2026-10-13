import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createMediaHandler } from "../../src/main/services/source-viewer/media-serve";
import { buildWavHeader } from "../../src/main/services/meeting-capture/wav";
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
    errorCode: null,
    pageCount: null,
    createdAt: 0,
    updatedAt: 0,
    extractionVersion: 1,
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

  it("085 S4: origin trỏ file không phải media (vd khoá SSH) → 404, không stream", async () => {
    const secret = join(dir, "id_rsa");
    writeFileSync(secret, "PRIVATE KEY");
    const repo = {
      getById: (id: string) => (id === "evil" ? audioSource(id) : null),
      getOrigin: (id: string) => (id === "evil" ? secret : null),
    } as unknown as SourceRepo;
    const res = await createMediaHandler(repo)(req("evil"));
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

  it("051: nguồn kind=video cũng được phục vụ (200 + Range 206)", async () => {
    const repo: Partial<SourceRepo> = {
      getById: (id) =>
        id === "vid" ? { ...audioSource(id), kind: "video" } : null,
      getOrigin: (id) => (id === "vid" ? filePath : null),
    };
    const handler = createMediaHandler(repo as SourceRepo);
    const full = await handler(req("vid"));
    expect(full.status).toBe(200);
    const part = await handler(req("vid", "bytes=0-4"));
    expect(part.status).toBe(206);
    expect(part.headers.get("Content-Range")).toBe("bytes 0-4/20");
  });

  it("053: nguồn kind=image cũng được phục vụ (200)", async () => {
    const repo: Partial<SourceRepo> = {
      getById: (id) =>
        id === "img" ? { ...audioSource(id), kind: "image" } : null,
      getOrigin: (id) => (id === "img" ? filePath : null),
    };
    const res = await createMediaHandler(repo as SourceRepo)(req("img"));
    expect(res.status).toBe(200);
  });
});

describe("createMediaHandler — nguồn cuộc họp (186)", () => {
  const wavPath = (): string => join(dir, "meeting.wav");
  const calls: [string, number | undefined][] = [];
  function meetingRepo(): SourceRepo {
    return {
      getById: (id: string) =>
        id === "m1" ? { ...audioSource(id), kind: "meeting" } : null,
      getOrigin: () => "meeting:sess-1",
    } as unknown as SourceRepo;
  }
  const resolve = (id: string, seg: number | undefined): string | null => {
    calls.push([id, seg]);
    return id === "m1" && (seg === undefined || seg === 0) ? wavPath() : null;
  };

  // Phân đoạn đang ghi: header độ dài 0 + 20 byte dữ liệu đã fsync.
  beforeAll(() =>
    writeFileSync(
      join(dir, "meeting.wav"),
      Buffer.concat([Buffer.from(buildWavHeader(0)), BODY]),
    ),
  );

  it("phục vụ tệp do resolver trả (không dùng origin), MIME audio/wav, Range 206", async () => {
    const h = createMediaHandler(meetingRepo(), resolve);
    const full = await h(new Request("iv-media://source/m1"));
    expect(full.status).toBe(200);
    expect(full.headers.get("Content-Type")).toBe("audio/wav");
    expect(full.headers.get("Content-Length")).toBe("64");
    const part = await h(
      new Request("iv-media://source/m1", {
        headers: { Range: "bytes=44-48" },
      }),
    );
    expect(part.status).toBe(206);
    expect(part.headers.get("Content-Range")).toBe("bytes 44-48/64");
    expect(Buffer.from(await part.arrayBuffer()).toString()).toBe("01234");
  });

  it("PR B: header dựng theo kích thước hiện tại (phân đoạn đang ghi nghe lại được)", async () => {
    const h = createMediaHandler(meetingRepo(), resolve);
    const head = Buffer.from(
      await (
        await h(
          new Request("iv-media://source/m1", {
            headers: { Range: "bytes=0-43" },
          }),
        )
      ).arrayBuffer(),
    );
    expect(head.readUInt32LE(40)).toBe(20);
    expect(head.readUInt32LE(4)).toBe(56);
  });

  it("?seg=n chuyển cho resolver; seg lạ ⇒ 404 không gọi resolver", async () => {
    const h = createMediaHandler(meetingRepo(), resolve);
    calls.length = 0;
    expect((await h(new Request("iv-media://source/m1?seg=0"))).status).toBe(
      200,
    );
    expect((await h(new Request("iv-media://source/m1?seg=3"))).status).toBe(
      404,
    );
    expect(calls).toEqual([
      ["m1", 0],
      ["m1", 3],
    ]);
    expect((await h(new Request("iv-media://source/m1?seg=../x"))).status).toBe(
      404,
    );
    expect((await h(new Request("iv-media://source/m1?seg=-1"))).status).toBe(
      404,
    );
    expect(calls).toHaveLength(2);
  });

  it("không có resolver ⇒ 404 cho meeting", async () => {
    const h = createMediaHandler(meetingRepo());
    expect((await h(new Request("iv-media://source/m1"))).status).toBe(404);
  });
});
