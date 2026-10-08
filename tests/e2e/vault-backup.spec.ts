import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { mkdtemp, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MAIN, dismissOnboarding, UNREACHABLE_OLLAMA } from "./helper";

// 085 vault-backup e2e (tất định, offline): sao lưu có mật khẩu qua UI → đổi vault → khôi phục (sai rồi đúng mật
// khẩu) → "khởi động lại" trên CÙNG userData → dữ liệu + trích dẫn (chunk + locator) trở lại, thông báo kết quả.
// Hộp thoại native thay bằng IV_E2E_DIALOG_PATH; IV_E2E_NO_RELAUNCH để test tự mở lại app (cả hai chỉ khi chưa
// đóng gói). Kiểm luôn không có request mạng ra ngoài (SC-006).

const FIXTURE = join(process.cwd(), "tests/fixtures/sample.txt");
const PASSWORD = "mat-khau-e2e-085";

let userData: string;
let backupFile: string;

function launch(): Promise<ElectronApplication> {
  return electron.launch({
    args: [MAIN, `--user-data-dir=${userData}`],
    env: {
      ...process.env,
      ...UNREACHABLE_OLLAMA,
      IV_EMBED_FAKE: "1",
      IV_RERANK_FAKE: "1",
      IV_UI_LANG: "vi",
      IV_E2E_DIALOG_PATH: backupFile,
      IV_E2E_NO_RELAUNCH: "1",
    } as Record<string, string>,
  });
}

async function goSettings(win: Page): Promise<void> {
  await win.evaluate(() => {
    window.location.hash = "#/settings";
  });
  await win.getByTestId("vault-backup-panel").waitFor();
}

/** Bắt mọi request mạng không phải nội bộ (file:, devtools, iv-media:) trong suốt luồng. */
function trackEgress(win: Page): string[] {
  const external: string[] = [];
  win.on("request", (r) => {
    const u = r.url();
    if (/^https?:\/\//.test(u) && !u.startsWith("http://127.0.0.1:1")) {
      external.push(u);
    }
  });
  return external;
}

test.beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), "iv-e2e-vb-"));
  userData = join(root, "userData");
  backupFile = join(root, "e2e.ivbackup");
});

test("sao lưu có mật khẩu → đổi vault → khôi phục → mở lại: dữ liệu + trích dẫn trở lại", async () => {
  test.setTimeout(120_000);
  // ── Phiên 1: tạo dữ liệu + sao lưu + khôi phục
  const app1 = await launch();
  const win = await app1.firstWindow();
  const egress = trackEgress(win);
  await dismissOnboarding(win);

  const nbA = await win.evaluate(
    async ([path]) => {
      const nb = await window.api.notebookCreate({
        name: "Sổ A",
        color: "#1E6B57",
      });
      await window.api.sourceAdd({
        notebookId: nb.id,
        kind: "txt",
        filePath: path,
      });
      return nb.id;
    },
    [FIXTURE] as const,
  );
  await expect
    .poll(
      () =>
        win.evaluate(
          async (id) => (await window.api.sourceListByNotebook(id))[0]?.status,
          nbA,
        ),
      { timeout: 30_000 },
    )
    .toBe("ready");

  await goSettings(win);
  await win.getByTestId("backup-open").click();
  await win.getByTestId("backup-protect").check();
  await win.getByTestId("backup-password").fill(PASSWORD);
  await win.getByTestId("backup-password-confirm").fill("khac");
  await expect(win.getByTestId("backup-start")).toBeDisabled();
  await win.getByTestId("backup-password-confirm").fill(PASSWORD);
  await win.getByTestId("backup-start").click();
  await expect(win.getByTestId("backup-done")).toBeVisible({ timeout: 30_000 });
  await win.getByTestId("backup-close").click();
  expect(existsSync(backupFile)).toBe(true);

  // đổi vault: xoá A, tạo B
  await win.evaluate(async (id) => {
    await window.api.notebookDelete(id);
    await window.api.notebookCreate({ name: "Sổ B", color: "#1E6B57" });
  }, nbA);

  await win.getByTestId("restore-open").click();
  await win.getByTestId("restore-password").fill("sai-mat-khau");
  await win.getByTestId("restore-unlock").click();
  await expect(win.getByTestId("restore-error")).toContainText(
    "Sai mật khẩu hoặc file sao lưu bị hỏng",
  );
  // vault chưa bị đụng
  const namesMid = await win.evaluate(async () =>
    (await window.api.notebookList()).map((n) => n.name),
  );
  expect(namesMid).toEqual(["Sổ B"]);

  await win.getByTestId("restore-password").fill(PASSWORD);
  await win.getByTestId("restore-unlock").click();
  await expect(win.getByTestId("restore-summary")).toContainText(
    "1 notebook · 1 nguồn",
  );
  await expect(win.getByTestId("restore-overwrite-warning")).toBeVisible();
  expect(egress).toEqual([]);

  const closed = new Promise<void>((r) =>
    app1.process().once("exit", () => r()),
  );
  await win.getByTestId("restore-confirm").click();
  await closed;

  // ── Phiên 2: "khởi động lại" trên cùng userData ⇒ hoán đổi trước khi mở DB
  const app2 = await launch();
  const win2 = await app2.firstWindow();
  const egress2 = trackEgress(win2);
  await expect(win2.getByTestId("restore-result")).toContainText(
    "Đã khôi phục vault",
  );
  const after = await win2.evaluate(async () => {
    const nbs = await window.api.notebookList();
    const a = nbs.find((n) => n.name === "Sổ A");
    const hits = a ? await window.api.sourceSearch(a.id, "InsightVault") : [];
    return { names: nbs.map((n) => n.name), hits };
  });
  expect(after.names).toEqual(["Sổ A"]);
  // Trích dẫn kiểm chứng được: hit tìm kiếm mang sourceId + locator gốc (FR-016)
  expect(after.hits.length).toBeGreaterThan(0);
  expect(after.hits[0].sourceId).toBeTruthy();
  expect(after.hits[0].locator).toBeTruthy();

  const backups = await readdir(join(userData, "backups"));
  expect(
    backups.some((n) => /^pre-restore-\d{8}-\d{6}\.ivbackup$/.test(n)),
  ).toBe(true);
  // one-shot: mở lại lần nữa không còn thông báo
  expect(
    await win2.evaluate(async () => window.api.getRestoreResult()),
  ).toBeNull();
  expect(egress2).toEqual([]);
  await app2.close();
});

test("whitelist: window.api có hàm sao lưu/khôi phục, không nhận path, không invoke chung", async () => {
  const app = await launch();
  const win = await app.firstWindow();
  const keys = await win.evaluate(() =>
    Object.keys((window as unknown as { api: object }).api),
  );
  for (const k of [
    "backupGetState",
    "backupCreate",
    "restorePick",
    "restorePrepare",
    "restoreConfirm",
    "restoreCancel",
    "getRestoreResult",
    "onBackupProgress",
  ]) {
    expect(keys).toContain(k);
  }
  expect(keys).not.toContain("invoke");
  // payload sai hình (cố gửi path) bị từ chối ở boundary, không ghi gì
  const r = await win.evaluate(async () =>
    (
      window.api as unknown as {
        backupCreate: (x: unknown) => Promise<unknown>;
      }
    ).backupCreate({ password: 123, path: "/tmp/x" }),
  );
  expect(r).toEqual({ status: "error", code: "ioError" });
  await app.close();
});
