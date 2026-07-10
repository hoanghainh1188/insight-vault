import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

export const MAIN = join(process.cwd(), "out/main/index.js");

/** Launch app với userData TẠM (cô lập trạng thái, không đụng store thật của người dùng). */
export async function launchFresh(): Promise<ElectronApplication> {
  const userData = await mkdtemp(join(tmpdir(), "iv-e2e-"));
  return electron.launch({ args: [MAIN, `--user-data-dir=${userData}`] });
}

/** Đóng onboarding modal lần đầu (chờ nó xuất hiện do IPC async, rồi bấm "Bắt đầu"). */
export async function dismissOnboarding(win: Page): Promise<void> {
  const onboarding = win.getByTestId("onboarding");
  await onboarding.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await onboarding.isVisible().catch(() => false)) {
    await win.getByTestId("onboarding-start").click();
    await onboarding.waitFor({ state: "hidden", timeout: 5000 });
  }
}
