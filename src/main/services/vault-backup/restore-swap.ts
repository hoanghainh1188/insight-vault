import { existsSync } from "node:fs";
import * as fsp from "node:fs/promises";
import { join } from "node:path";
import type { RestoreResult } from "@shared/ipc/types";
import { errnoCode } from "./errors";

// Hoán đổi vault lúc khởi động (085, research R6) — chạy ngay sau ensureDataDir, TRƯỚC new Store()/openDatabase.
// State machine trên `<userData>/restore/state.json`. Mỗi pha IDEMPOTENT (crash ở bất kỳ điểm nào ⇒ boot kế chạy
// tiếp pha đang ghi) và KHÔNG BAO GIỜ xoá dữ liệu sống trước khi xong — chỉ `rename`:
//   staged ──(kiểm staged/ hợp lệ)──► movingOut: mục sống → previous/
//          ──► movingIn: staged/ → mục sống ──(kiểm DB sống)──► result ok, dọn
//   lỗi ⇒ rollingBack{from, step}:
//     step "discard" (chỉ khi from=movingIn): MỌI mục sống lúc này đều đến từ staged ⇒ chuyển sang discard/
//     step "restore": previous/ → vị trí sống (chỉ khi chỗ đó trống)
//   ⇒ result swapFailed, dọn. Tách 2 bước + ghi state giữa chừng để chạy lại không bao giờ đụng vault cũ đã trả về.
// Rollback cũng lỗi ⇒ NÉM (fatal startup dialog) và giữ state cho lần sau, thay vì để app mở DB rỗng.

export const VAULT_ITEMS = [
  "insightvault.db",
  "insightvault.db-wal",
  "insightvault.db-shm",
  "vectors",
  "config.json",
] as const;

type Phase = "staged" | "movingOut" | "movingIn" | "rollingBack";

export interface RestoreState {
  phase: Phase;
  backupCreatedAt: string;
  preRestorePath: string | null;
  /** Chỉ khi phase=rollingBack. */
  rollbackFrom?: "movingOut" | "movingIn";
  rollbackStep?: "discard" | "restore";
}

/** Chỉ `rename` được tiêm (để test lỗi/crash ở từng lần đổi tên); thao tác khác dùng fs thật. */
export interface SwapFs {
  rename: (from: string, to: string) => Promise<void>;
}

export type SwapLog = (event: string, meta?: Record<string, unknown>) => void;

const realFs: SwapFs = { rename: (a, b) => fsp.rename(a, b) };

const restoreDir = (d: string): string => join(d, "restore");
const statePath = (d: string): string => join(restoreDir(d), "state.json");
const resultPath = (d: string): string => join(restoreDir(d), "result.json");
const stagedDir = (d: string): string => join(restoreDir(d), "staged");
const previousDir = (d: string): string => join(restoreDir(d), "previous");
const discardDir = (d: string): string => join(restoreDir(d), "discard");

/** Ghi state an toàn (tmp + rename) — dùng lúc xác nhận khôi phục và giữa các pha. */
export async function writeRestoreState(
  dataDir: string,
  s: RestoreState,
): Promise<void> {
  await fsp.mkdir(restoreDir(dataDir), { recursive: true, mode: 0o700 });
  const tmp = `${statePath(dataDir)}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(s), { mode: 0o600 });
  await fsp.rename(tmp, statePath(dataDir));
}

const PHASES: readonly Phase[] = [
  "staged",
  "movingOut",
  "movingIn",
  "rollingBack",
];

async function readState(dataDir: string): Promise<RestoreState | null> {
  try {
    const raw = JSON.parse(await fsp.readFile(statePath(dataDir), "utf8"));
    if (
      raw &&
      PHASES.includes(raw.phase) &&
      typeof raw.backupCreatedAt === "string" &&
      (raw.preRestorePath === null || typeof raw.preRestorePath === "string")
    ) {
      return raw as RestoreState;
    }
  } catch {
    // thiếu/hỏng ⇒ null
  }
  return null;
}

async function moveOut(dataDir: string, fs: SwapFs): Promise<void> {
  await fsp.mkdir(previousDir(dataDir), { recursive: true });
  for (const it of VAULT_ITEMS) {
    const live = join(dataDir, it);
    if (existsSync(live)) await fs.rename(live, join(previousDir(dataDir), it));
  }
}

async function moveIn(dataDir: string, fs: SwapFs): Promise<void> {
  for (const it of VAULT_ITEMS) {
    const src = join(stagedDir(dataDir), it);
    if (existsSync(src)) await fs.rename(src, join(dataDir, it));
  }
}

/** Rollback idempotent (xem đầu file). Ghi state trước mỗi bước để lần chạy lại tiếp đúng bước. */
async function rollback(
  dataDir: string,
  state: RestoreState,
  from: "movingOut" | "movingIn",
  startStep: "discard" | "restore",
  fs: SwapFs,
): Promise<void> {
  if (from === "movingIn" && startStep === "discard") {
    await writeRestoreState(dataDir, {
      ...state,
      phase: "rollingBack",
      rollbackFrom: from,
      rollbackStep: "discard",
    });
    await fsp.mkdir(discardDir(dataDir), { recursive: true });
    for (const it of VAULT_ITEMS) {
      const live = join(dataDir, it);
      const sink = join(discardDir(dataDir), it);
      if (existsSync(live) && !existsSync(sink)) await fs.rename(live, sink);
    }
  }
  await writeRestoreState(dataDir, {
    ...state,
    phase: "rollingBack",
    rollbackFrom: from,
    rollbackStep: "restore",
  });
  for (const it of VAULT_ITEMS) {
    const live = join(dataDir, it);
    const prev = join(previousDir(dataDir), it);
    if (existsSync(prev) && !existsSync(live)) await fs.rename(prev, live);
  }
}

async function finish(dataDir: string, result: RestoreResult): Promise<void> {
  await fsp.writeFile(resultPath(dataDir), JSON.stringify(result), {
    mode: 0o600,
  });
  await fsp.rm(statePath(dataDir), { force: true });
  for (const d of [stagedDir, previousDir, discardDir]) {
    await fsp.rm(d(dataDir), { recursive: true, force: true });
  }
}

/** Xoá file payload tạm mồ côi (`restore/staged.payload-*.tgz`) từ lần giải nén bị gián đoạn. */
async function removeOrphanPayloads(dataDir: string): Promise<void> {
  const names = await fsp.readdir(restoreDir(dataDir)).catch(() => []);
  for (const n of names) {
    if (/\.payload-[0-9a-f]+\.tgz$/.test(n)) {
      await fsp.rm(join(restoreDir(dataDir), n), { force: true });
    }
  }
}

/**
 * Không có state hợp lệ. Trả các mục còn ở previous/ về chỗ trống (không đè mục sống). previous/ còn sót (vault
 * lai — rất hiếm) ⇒ GIỮ LẠI dưới tên `recovered-<ts>` để người dùng tự cứu, không xoá.
 */
async function recoverWithoutState(
  dataDir: string,
  log: SwapLog,
): Promise<"none" | "rolledBack"> {
  const prevRoot = previousDir(dataDir);
  let outcome: "none" | "rolledBack" = "none";
  if (existsSync(prevRoot)) {
    for (const it of VAULT_ITEMS) {
      const prev = join(prevRoot, it);
      const live = join(dataDir, it);
      if (existsSync(prev) && !existsSync(live)) {
        await fsp.rename(prev, live);
        outcome = "rolledBack";
      }
    }
    if ((await fsp.readdir(prevRoot)).length > 0) {
      await fsp.rename(
        prevRoot,
        join(restoreDir(dataDir), `recovered-${Date.now()}`),
      );
      log("vaultBackup.restoreRecoveredKept");
    }
  }
  await fsp.rm(statePath(dataDir), { force: true });
  await fsp.rm(stagedDir(dataDir), { recursive: true, force: true });
  await fsp.rm(discardDir(dataDir), { recursive: true, force: true });
  if (outcome === "rolledBack") {
    await fsp.writeFile(
      resultPath(dataDir),
      JSON.stringify({ ok: false, reason: "swapFailed" }),
      { mode: 0o600 },
    );
  }
  return outcome;
}

const FAILED: RestoreResult = { ok: false, reason: "swapFailed" };

export async function applyPendingRestore(
  dataDir: string,
  fs: SwapFs = realFs,
  log: SwapLog = () => undefined,
): Promise<"none" | "swapped" | "rolledBack"> {
  if (!existsSync(restoreDir(dataDir))) return "none";
  await removeOrphanPayloads(dataDir);
  const state = await readState(dataDir);
  if (!state) {
    if (!existsSync(statePath(dataDir))) {
      // chỉ còn result.json (chưa đọc) hoặc rác staging — không đụng vault/result
      await fsp.rm(stagedDir(dataDir), { recursive: true, force: true });
      await fsp.rm(discardDir(dataDir), { recursive: true, force: true });
      return "none";
    }
    return recoverWithoutState(dataDir, log);
  }

  if (state.phase === "rollingBack") {
    await rollback(
      dataDir,
      state,
      state.rollbackFrom ?? "movingIn",
      state.rollbackStep ?? "discard",
      fs,
    );
    await finish(dataDir, FAILED);
    return "rolledBack";
  }

  const stagedDb = join(stagedDir(dataDir), "insightvault.db");
  if (state.phase === "staged" && !existsSync(stagedDb)) {
    // Dữ liệu chờ khôi phục đã mất trước khi hoán đổi ⇒ không đụng vault.
    log("vaultBackup.restoreStagedMissing");
    await finish(dataDir, FAILED);
    return "rolledBack";
  }

  let phase: "movingOut" | "movingIn" =
    state.phase === "movingIn" ? "movingIn" : "movingOut";
  try {
    if (phase === "movingOut") {
      await writeRestoreState(dataDir, { ...state, phase: "movingOut" });
      if (!existsSync(stagedDb)) throw new Error("staged-missing");
      await moveOut(dataDir, fs);
      phase = "movingIn";
      await writeRestoreState(dataDir, { ...state, phase: "movingIn" });
    }
    await moveIn(dataDir, fs);
    if (!existsSync(join(dataDir, "insightvault.db"))) {
      throw new Error("live-db-missing");
    }
  } catch (e) {
    log("vaultBackup.restoreSwapError", { phase, errno: errnoCode(e) });
    await rollback(
      dataDir,
      state,
      phase,
      phase === "movingIn" ? "discard" : "restore",
      fs,
    );
    await finish(dataDir, FAILED);
    return "rolledBack";
  }
  await finish(dataDir, {
    ok: true,
    backupCreatedAt: state.backupCreatedAt,
    preRestorePath: state.preRestorePath,
  });
  return "swapped";
}

/** Đọc kết quả lần khôi phục gần nhất 1 lần (FR-016a) rồi xoá. Sai hình ⇒ null. */
export async function consumeRestoreResult(
  dataDir: string,
): Promise<RestoreResult | null> {
  const p = resultPath(dataDir);
  if (!existsSync(p)) return null;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(await fsp.readFile(p, "utf8"));
  } catch {
    parsed = null;
  }
  await fsp.rm(p, { force: true });
  const r = parsed as Record<string, unknown> | null;
  if (
    r?.ok === true &&
    typeof r.backupCreatedAt === "string" &&
    (r.preRestorePath === null || typeof r.preRestorePath === "string")
  ) {
    return {
      ok: true,
      backupCreatedAt: r.backupCreatedAt,
      preRestorePath: r.preRestorePath as string | null,
    };
  }
  if (r?.ok === false && r.reason === "swapFailed") {
    return { ok: false, reason: "swapFailed" };
  }
  return null;
}
