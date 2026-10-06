import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase, type Db } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import {
  createBackupService,
  type BackupServiceDeps,
} from "../../src/main/services/vault-backup/backup-service";
import { createVaultLock } from "../../src/main/services/vault-backup/vault-lock";
import { applyPendingRestore } from "../../src/main/services/vault-backup/restore-swap";
import type { VaultBackupProgress } from "../../src/shared/ipc/types";

const PASSWORD = "matkhau-bi-mat-123";
const FAST_KDF = { log2N: 10, r: 8, p: 1 };

let root: string;
let dataDir: string;
let outDir: string;
let db: Db;

interface Harness {
  deps: BackupServiceDeps;
  steps: VaultBackupProgress[];
  log: ReturnType<typeof vi.fn>;
  relaunch: ReturnType<typeof vi.fn>;
  flags: { active: boolean; reindexing: boolean };
  dialog: { save: string | null; open: string | null };
}

function harness(): Harness {
  const flags = { active: false, reindexing: false };
  const dialog: { save: string | null; open: string | null } = {
    save: join(outDir, "my.ivbackup"),
    open: null,
  };
  const steps: VaultBackupProgress[] = [];
  const log = vi.fn();
  const relaunch = vi.fn();
  const deps: BackupServiceDeps = {
    dataDir,
    db,
    appVersion: "0.2.3",
    getConfig: () => ({ embeddingModelVersion: "e5-small-384" }),
    lock: createVaultLock({
      hasActiveSources: () => flags.active,
      isReindexing: () => flags.reindexing,
    }),
    dialogs: {
      chooseSavePath: async () => dialog.save,
      chooseOpenPath: async () => dialog.open,
    },
    emit: (p) => steps.push(p),
    relaunch,
    log,
    now: () => new Date(2026, 9, 6, 10, 0, 0),
    kdf: FAST_KDF,
  };
  return { deps, steps, log, relaunch, flags, dialog };
}

function addNotebook(id: string): void {
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?, ?, 'blue', 1, 1)",
  ).run(id, id);
}

function assertNoSecretsLogged(h: Harness): void {
  const dump = JSON.stringify(h.log.mock.calls);
  expect(dump).not.toContain(PASSWORD);
  expect(dump).not.toContain(outDir);
  expect(dump).not.toContain(dataDir);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "iv-svc-"));
  dataDir = join(root, "data");
  outDir = join(root, "out");
  mkdirSync(join(dataDir, "vectors", "chunks.lance"), { recursive: true });
  writeFileSync(join(dataDir, "vectors", "chunks.lance", "v"), "vec-A");
  mkdirSync(outDir);
  db = openDatabase(join(dataDir, "insightvault.db"));
  runMigrations(db);
  addNotebook("A");
});
afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

describe("backup-service: sao lưu (US1)", () => {
  it("thành công: bước snapshot→pack, trả tên/kích thước/thư mục, dọn tmp, nhả lock", async () => {
    const h = harness();
    const svc = createBackupService(h.deps);
    const r = await svc.createBackup({});
    expect(r).toMatchObject({
      status: "ok",
      fileName: "my.ivbackup",
      dir: outDir,
    });
    expect(r.status === "ok" && r.sizeBytes > 0).toBe(true);
    expect(h.steps.map((s) => s.step)).toEqual(["snapshot", "pack"]);
    expect(readdirSync(join(dataDir, "tmp"))).toEqual([]);
    expect(svc.getState()).toEqual({ busy: false, reason: null });
    expect(h.deps.lock.isLocked()).toBe(false);
  });

  it("busy ⇒ lỗi busy, không mở hộp thoại", async () => {
    const h = harness();
    h.flags.active = true;
    const save = vi.spyOn(h.deps.dialogs, "chooseSavePath");
    const r = await createBackupService(h.deps).createBackup({});
    expect(r).toEqual({ status: "error", code: "busy" });
    expect(save).not.toHaveBeenCalled();
  });

  it("huỷ hộp thoại ⇒ cancelled, hết busy", async () => {
    const h = harness();
    h.dialog.save = null;
    const svc = createBackupService(h.deps);
    expect(await svc.createBackup({})).toEqual({ status: "cancelled" });
    expect(svc.getState().busy).toBe(false);
  });

  it("mật khẩu < 8 ký tự ⇒ passwordTooShort (validate lại ở main)", async () => {
    const h = harness();
    expect(
      await createBackupService(h.deps).createBackup({ password: "1234567" }),
    ).toEqual({
      status: "error",
      code: "passwordTooShort",
    });
  });

  it("lỗi ghi ⇒ ioError, không còn file đích/.part, không log path/mật khẩu", async () => {
    const h = harness();
    h.dialog.save = join(outDir, "no-dir", "x.ivbackup");
    const r = await createBackupService(h.deps).createBackup({
      password: PASSWORD,
    });
    expect(r).toEqual({ status: "error", code: "ioError" });
    expect(existsSync(join(outDir, "no-dir"))).toBe(false);
    assertNoSecretsLogged(h);
  });
});

describe("backup-service: khôi phục (US2/US3)", () => {
  async function makeBackup(h: Harness, password?: string): Promise<string> {
    const svc = createBackupService(h.deps);
    const r = await svc.createBackup(password ? { password } : {});
    expect(r.status).toBe("ok");
    return join(outDir, "my.ivbackup");
  }

  it("vòng đầy đủ có mật khẩu: pick → sai mật khẩu (giữ token) → đúng → confirm → relaunch; boot hoán đổi", async () => {
    const h = harness();
    const file = await makeBackup(h, PASSWORD);
    // đổi vault sau khi sao lưu
    db.prepare("DELETE FROM notebook").run();
    addNotebook("B");
    writeFileSync(join(dataDir, "vectors", "chunks.lance", "v"), "vec-B");

    const svc = createBackupService(h.deps);
    h.dialog.open = file;
    const pick = await svc.pickRestore();
    expect(pick).toMatchObject({ status: "ok", encrypted: true });
    const token = pick.status === "ok" ? pick.token : "";

    expect(await svc.prepareRestore({ token })).toEqual({
      status: "error",
      code: "passwordRequired",
    });
    expect(
      await svc.prepareRestore({ token, password: "sai-mat-khau" }),
    ).toEqual({
      status: "error",
      code: "badPasswordOrCorrupt",
    });
    const prep = await svc.prepareRestore({ token, password: PASSWORD });
    expect(prep).toEqual({
      status: "ok",
      summary: {
        createdAt: new Date(2026, 9, 6, 10, 0, 0).toISOString(),
        appVersion: "0.2.3",
        notebookCount: 1,
        sourceCount: 0,
        encrypted: true,
        needsReindex: false,
      },
    });
    expect(h.steps.map((s) => s.step)).toContain("decrypt");
    expect(h.steps.map((s) => s.step)).toContain("verify");

    expect(await svc.confirmRestore({ token })).toEqual({
      status: "relaunching",
    });
    expect(h.relaunch).toHaveBeenCalledTimes(1);
    expect(h.deps.lock.isLocked()).toBe(true);
    const pre = readdirSync(join(dataDir, "backups"));
    expect(pre).toHaveLength(1);
    expect(pre[0]).toMatch(/^pre-restore-\d{8}-\d{6}\.ivbackup$/);
    assertNoSecretsLogged(h);

    // "khởi động lại": đóng DB, hoán đổi, mở lại
    db.close();
    expect(await applyPendingRestore(dataDir)).toBe("swapped");
    db = openDatabase(join(dataDir, "insightvault.db"));
    const ids = db.prepare("SELECT id FROM notebook").all() as { id: string }[];
    expect(ids.map((r) => r.id)).toEqual(["A"]);
    expect(
      readFileSync(join(dataDir, "vectors", "chunks.lance", "v"), "utf8"),
    ).toBe("vec-A");
    expect(
      JSON.parse(readFileSync(join(dataDir, "config.json"), "utf8")),
    ).toEqual({
      embeddingModelVersion: "e5-small-384",
    });
    const result = await createBackupService(h.deps).getRestoreResult();
    expect(result).toMatchObject({
      ok: true,
      preRestorePath: join(dataDir, "backups", pre[0]),
    });
  });

  it("pick: huỷ ⇒ cancelled; không phải backup ⇒ notBackup (hết busy)", async () => {
    const h = harness();
    const svc = createBackupService(h.deps);
    expect(await svc.pickRestore()).toEqual({ status: "cancelled" });
    const junk = join(outDir, "junk.ivbackup");
    writeFileSync(junk, "rác");
    h.dialog.open = junk;
    expect(await svc.pickRestore()).toEqual({
      status: "error",
      code: "notBackup",
    });
    expect(svc.getState().busy).toBe(false);
  });

  it("token lạ ⇒ tokenInvalid; cancel idempotent dọn staging + hết busy", async () => {
    const h = harness();
    const file = await makeBackup(h);
    const svc = createBackupService(h.deps);
    h.dialog.open = file;
    const pick = await svc.pickRestore();
    const token = pick.status === "ok" ? pick.token : "";
    expect(await svc.prepareRestore({ token: "khac" })).toEqual({
      status: "error",
      code: "tokenInvalid",
    });
    expect((await svc.prepareRestore({ token })).status).toBe("ok");
    expect(
      existsSync(join(dataDir, "restore", "staged", "insightvault.db")),
    ).toBe(true);
    expect(await svc.cancelRestore({ token })).toEqual({ ok: true });
    expect(await svc.cancelRestore({ token })).toEqual({ ok: true });
    expect(existsSync(join(dataDir, "restore", "staged"))).toBe(false);
    expect(svc.getState().busy).toBe(false);
    expect(await svc.confirmRestore({ token })).toEqual({
      status: "error",
      code: "tokenInvalid",
    });
    expect(h.relaunch).not.toHaveBeenCalled();
  });

  it("file hỏng (không mã hoá) ⇒ lỗi, token huỷ, vault không đổi", async () => {
    const h = harness();
    const file = await makeBackup(h);
    const bytes = readFileSync(file);
    bytes[200] ^= 0xff;
    writeFileSync(file, bytes);
    const svc = createBackupService(h.deps);
    h.dialog.open = file;
    const pick = await svc.pickRestore();
    const token = pick.status === "ok" ? pick.token : "";
    expect(await svc.prepareRestore({ token })).toEqual({
      status: "error",
      code: "badPasswordOrCorrupt",
    });
    expect(await svc.confirmRestore({ token })).toEqual({
      status: "error",
      code: "tokenInvalid",
    });
    expect(svc.getState().busy).toBe(false);
    expect(existsSync(join(dataDir, "restore", "state.json"))).toBe(false);
  });

  it("đang có nguồn xử lý ⇒ pick trả busy", async () => {
    const h = harness();
    h.flags.active = true;
    expect(await createBackupService(h.deps).pickRestore()).toEqual({
      status: "error",
      code: "busy",
    });
  });

  it("giữ tối đa 3 bản tự sao lưu", async () => {
    const h = harness();
    mkdirSync(join(dataDir, "backups"));
    for (const d of ["01", "02", "03"]) {
      writeFileSync(
        join(dataDir, "backups", `pre-restore-202601${d}-000000.ivbackup`),
        "x",
      );
    }
    const file = await makeBackup(h);
    const svc = createBackupService(h.deps);
    h.dialog.open = file;
    const pick = await svc.pickRestore();
    const token = pick.status === "ok" ? pick.token : "";
    await svc.prepareRestore({ token });
    await svc.confirmRestore({ token });
    const left = readdirSync(join(dataDir, "backups")).sort();
    expect(left).toHaveLength(3);
    expect(left).not.toContain("pre-restore-20260101-000000.ivbackup");
    expect(basename(left[2])).toMatch(/^pre-restore-20261006/);
  });

  it("phiên cũ bị bỏ dở (renderer reload) ⇒ pick mới tự huỷ phiên cũ, không kẹt busy", async () => {
    const h = harness();
    const file = await makeBackup(h);
    const svc = createBackupService(h.deps);
    h.dialog.open = file;
    const first = await svc.pickRestore();
    expect(first.status).toBe("ok");
    const second = await svc.pickRestore();
    expect(second.status).toBe("ok");
    const oldToken = first.status === "ok" ? first.token : "";
    expect(await svc.prepareRestore({ token: oldToken })).toEqual({
      status: "error",
      code: "tokenInvalid",
    });
  });

  it("abandonRestore (renderer reload) ⇒ dọn phiên + staging, hết busy", async () => {
    const h = harness();
    const file = await makeBackup(h);
    const svc = createBackupService(h.deps);
    h.dialog.open = file;
    const pick = await svc.pickRestore();
    const token = pick.status === "ok" ? pick.token : "";
    await svc.prepareRestore({ token });
    await svc.abandonRestore();
    expect(svc.getState().busy).toBe(false);
    expect(existsSync(join(dataDir, "restore", "staged"))).toBe(false);
    await svc.abandonRestore(); // idempotent
  });

  it("prepare gọi chồng ⇒ lần 2 trả busy, lần 1 vẫn thành công", async () => {
    const h = harness();
    const file = await makeBackup(h);
    const svc = createBackupService(h.deps);
    h.dialog.open = file;
    const pick = await svc.pickRestore();
    const token = pick.status === "ok" ? pick.token : "";
    const [a, b] = await Promise.all([
      svc.prepareRestore({ token }),
      svc.prepareRestore({ token }),
    ]);
    expect(a.status).toBe("ok");
    expect(b).toEqual({ status: "error", code: "busy" });
  });

  it("confirm khi có nguồn mới đang xử lý ⇒ busy, giữ phiên, không relaunch", async () => {
    const h = harness();
    const file = await makeBackup(h);
    const svc = createBackupService(h.deps);
    h.dialog.open = file;
    const pick = await svc.pickRestore();
    const token = pick.status === "ok" ? pick.token : "";
    await svc.prepareRestore({ token });
    h.flags.active = true;
    expect(await svc.confirmRestore({ token })).toEqual({
      status: "error",
      code: "busy",
    });
    expect(h.relaunch).not.toHaveBeenCalled();
    h.flags.active = false;
    expect(await svc.confirmRestore({ token })).toEqual({
      status: "relaunching",
    });
  });

  it("lỗi khi tự sao lưu trước khôi phục ⇒ giữ phiên, không ghi state, không relaunch", async () => {
    const h = harness();
    const file = await makeBackup(h);
    const svc = createBackupService(h.deps);
    h.dialog.open = file;
    const pick = await svc.pickRestore();
    const token = pick.status === "ok" ? pick.token : "";
    await svc.prepareRestore({ token });
    // backups/ là FILE ⇒ mkdir thất bại
    writeFileSync(join(dataDir, "backups"), "chặn");
    const r = await svc.confirmRestore({ token });
    expect(r.status).toBe("error");
    expect(existsSync(join(dataDir, "restore", "state.json"))).toBe(false);
    expect(h.relaunch).not.toHaveBeenCalled();
    expect(h.deps.lock.isLocked()).toBe(false);
  });
});
