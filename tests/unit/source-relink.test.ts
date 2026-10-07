import { describe, it, expect, vi } from "vitest";
import { join } from "node:path";
import { openDatabase } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import { createSourceRepo } from "../../src/main/services/ingestion/source-repo";
import { createRelink } from "../../src/main/services/ingestion/relink";
import { extensionsForKind } from "../../src/main/services/ingestion/parsers";

// 101 — liên kết lại file gốc: chỉ nhận tệp có CÙNG nội dung (SHA-256 = content_hash) để trích dẫn [n] (lưu vị trí
// trong nội dung cũ) vẫn đúng (Constitution II). Đường dẫn chỉ đến từ hộp thoại ở main.

function repoWith(kind: "audio" | "url" | "pdf" = "audio") {
  const db = openDatabase(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
  ).run("nb1", "N", "#4F46E5", 1, 1);
  const repo = createSourceRepo(db, { now: () => 1, uuid: () => "s1" });
  repo.create({
    notebookId: "nb1",
    kind,
    title: "phong-van.mp3",
    origin: kind === "url" ? "https://x.vn" : "/cu/phong-van.mp3",
    contentHash: "HASH-GOC",
  });
  // Nguồn tệp gốc bị di chuyển ⇒ lần xử lý/thử lại lỗi (trạng thái thực tế khi người dùng chọn lại tệp).
  repo.updateStatus("s1", "error", "Không đọc được tệp.");
  return repo;
}

function setup(over: Partial<Parameters<typeof createRelink>[0]> = {}) {
  const repo = repoWith();
  const pickFile = vi.fn(async () => "/moi/phong-van.mp3");
  const hashFile = vi.fn(async () => ({ hash: "HASH-GOC", byteLength: 1 }));
  const log = vi.fn();
  const relink = createRelink({
    repo,
    pickFile,
    hashFile,
    log,
    realpath: async (p) => p,
    isLocked: () => false,
    ...over,
  });
  return { repo, relink, pickFile, hashFile, log };
}

describe("extensionsForKind", () => {
  it("đuôi tệp theo loại nguồn (dùng lọc hộp thoại)", () => {
    expect(extensionsForKind("audio")).toEqual(
      expect.arrayContaining(["wav", "mp3", "flac", "ogg", "m4a", "aac"]),
    );
    expect(extensionsForKind("md")).toEqual(["md", "markdown"]);
    expect(extensionsForKind("image")).toContain("png");
  });
});

describe("source-repo relink", () => {
  it("getRelinkInfo + updateOrigin", () => {
    const repo = repoWith();
    expect(repo.getRelinkInfo("s1")).toEqual({
      kind: "audio",
      origin: "/cu/phong-van.mp3",
      contentHash: "HASH-GOC",
      status: "error",
    });
    repo.updateOrigin("s1", "/moi/phong-van.mp3");
    expect(repo.getOrigin("s1")).toBe("/moi/phong-van.mp3");
    expect(repo.getRelinkInfo("khong-co")).toBeNull();
  });
});

describe("createRelink", () => {
  it("cùng nội dung ⇒ cập nhật đường dẫn; hộp thoại mở ở thư mục cũ, lọc đúng đuôi", async () => {
    const { relink, repo, pickFile, log } = setup();
    expect(await relink("s1")).toEqual({ status: "ok" });
    expect(repo.getOrigin("s1")).toBe("/moi/phong-van.mp3");
    expect(pickFile).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultDir: join("/cu"),
        extensions: extensionsForKind("audio"),
      }),
    );
    expect(log).toHaveBeenCalledWith("source.relinked", { kind: "audio" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("phong-van");
  });

  it("khác nội dung ⇒ mismatch, KHÔNG đổi đường dẫn", async () => {
    const { relink, repo } = setup({
      hashFile: async () => ({ hash: "KHAC", byteLength: 1 }),
    });
    expect(await relink("s1")).toEqual({ status: "mismatch" });
    expect(repo.getOrigin("s1")).toBe("/cu/phong-van.mp3");
  });

  it("huỷ hộp thoại ⇒ cancelled", async () => {
    const { relink, hashFile } = setup({ pickFile: async () => null });
    expect(await relink("s1")).toEqual({ status: "cancelled" });
    expect(hashFile).not.toHaveBeenCalled();
  });

  it("đuôi tệp sai loại ⇒ wrongType (không băm cả tệp)", async () => {
    const { relink, hashFile } = setup({
      pickFile: async () => "/moi/anh.png",
    });
    expect(await relink("s1")).toEqual({ status: "wrongType" });
    expect(hashFile).not.toHaveBeenCalled();
  });

  it("nguồn URL / không tồn tại / id sai ⇒ notApplicable, không mở hộp thoại", async () => {
    const url = repoWith("url");
    const pickFile = vi.fn(async () => "/x");
    const r = createRelink({
      repo: url,
      pickFile,
      hashFile: async () => ({ hash: "", byteLength: 0 }),
      log: () => undefined,
      realpath: async (p) => p,
      isLocked: () => false,
    });
    expect(await r("s1")).toEqual({ status: "notApplicable" });
    expect(await r("khong-co")).toEqual({ status: "notApplicable" });
    expect(await r(42)).toEqual({ status: "notApplicable" });
    expect(pickFile).not.toHaveBeenCalled();
  });

  it("nguồn đang xếp hàng/xử lý ⇒ busy, không mở hộp thoại", async () => {
    const { relink, repo, pickFile } = setup();
    repo.updateStatus("s1", "processing");
    expect(await relink("s1")).toEqual({ status: "busy" });
    expect(pickFile).not.toHaveBeenCalled();
  });

  it("2 lần chọn lại chồng nhau trên CÙNG nguồn ⇒ lần sau busy", async () => {
    let release: (v: string) => void = () => undefined;
    let calls = 0;
    const { relink } = setup({
      // lần đầu: hộp thoại "đang mở" tới khi release; các lần sau chọn ngay
      pickFile: () =>
        ++calls === 1
          ? new Promise<string | null>((r) => (release = r))
          : Promise.resolve("/moi/phong-van.mp3"),
    });
    const first = relink("s1");
    expect(await relink("s1")).toEqual({ status: "busy" });
    release("/moi/phong-van.mp3");
    expect(await first).toEqual({ status: "ok" });
    // xong thì chọn lại được tiếp
    expect(await relink("s1")).toEqual({ status: "ok" });
  });

  it("vault bị khoá (sao lưu/khôi phục bắt đầu khi hộp thoại đang mở) ⇒ locked, KHÔNG ghi", async () => {
    let locked = false;
    const { relink, repo } = setup({
      pickFile: async () => {
        locked = true; // sao lưu bắt đầu trong lúc người dùng đang chọn tệp
        return "/moi/phong-van.mp3";
      },
      isLocked: () => locked,
    });
    expect(await relink("s1")).toEqual({ status: "locked" });
    expect(repo.getOrigin("s1")).toBe("/cu/phong-van.mp3");
  });

  it("lưu đường dẫn THẬT (realpath) — symlink không bị lưu nguyên", async () => {
    const { relink, repo, hashFile } = setup({
      pickFile: async () => "/lien-ket/phong-van.mp3",
      realpath: async () => "/that/phong-van.mp3",
    });
    expect(await relink("s1")).toEqual({ status: "ok" });
    expect(hashFile).toHaveBeenCalledWith("/that/phong-van.mp3");
    expect(repo.getOrigin("s1")).toBe("/that/phong-van.mp3");
  });

  it("đọc tệp lỗi ⇒ error (loại lỗi được log, không kèm đường dẫn)", async () => {
    const { relink, log } = setup({
      hashFile: async () => {
        throw Object.assign(new Error("EACCES: /moi/phong-van.mp3"), {
          code: "EACCES",
        });
      },
    });
    expect(await relink("s1")).toEqual({ status: "error" });
    expect(log).toHaveBeenCalledWith("source.relinkFailed", {
      errorType: "Error",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("phong-van");
  });
});
