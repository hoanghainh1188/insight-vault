import { test, expect, _electron as electron } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { dismissOnboarding, launchFreshAt, MAIN } from "./helper";

// 123 (US1, US2; FR-002..FR-006, SC-001, SC-003, SC-009): giao diện English trên "máy English" (IV_UI_LANG=en chỉ có
// hiệu lực ở bản chưa đóng gói), đổi ngôn ngữ trong Cài đặt áp dụng ngay (không reload, giữ state), lựa chọn giữ qua
// lần mở sau; ảnh chụp English ở kích thước mặc định + nhỏ nhất để soát tràn chữ.

const VI_CHARS =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
/** Ngoại lệ có chủ đích: tên tự xưng "Tiếng Việt" trong Cài đặt › Ngôn ngữ (FR-003). */
const stripAllowed = (s: string): string => s.replaceAll("Tiếng Việt", "");
const SHOTS = join(process.cwd(), "test-results", "i18n");

test("máy English ⇒ giao diện English, <html lang=en>, không chữ Việt; ảnh chụp 2 kích thước", async () => {
  const { app } = await launchFreshAt({ IV_UI_LANG: "en" });
  const win = await app.firstWindow();
  await dismissOnboarding(win);
  await expect(win.locator("html")).toHaveAttribute("lang", "en");
  await expect(win.getByTestId("placeholder-notebooks")).toBeVisible();
  expect(
    VI_CHARS.test(stripAllowed(await win.locator("body").innerText())),
  ).toBe(false);

  await win.getByTestId("notebook-new").click();
  expect(
    VI_CHARS.test(stripAllowed(await win.locator("body").innerText())),
  ).toBe(false);
  await win.keyboard.press("Escape");

  await win.getByTestId("nav-settings").click();
  await expect(win.getByTestId("settings-language")).toBeVisible();
  expect(
    VI_CHARS.test(stripAllowed(await win.locator("body").innerText())),
  ).toBe(false);

  await mkdir(SHOTS, { recursive: true });
  await win.screenshot({
    path: join(SHOTS, "settings-en-default.png"),
    fullPage: true,
  });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.setSize(720, 480),
  );
  await win.waitForTimeout(300);
  await win.screenshot({
    path: join(SHOTS, "settings-en-min.png"),
    fullPage: true,
  });
  await win.getByTestId("nav-notebooks").click();
  await win.screenshot({
    path: join(SHOTS, "notebooks-en-min.png"),
    fullPage: true,
  });
  await app.close();
});

test("đổi ngôn ngữ trong Cài đặt ⇒ áp dụng ngay, giữ state, lưu qua lần mở sau; Tự động ⇒ theo OS", async () => {
  const { app, userData } = await launchFreshAt({ IV_UI_LANG: "vi" });
  const win = await app.firstWindow();
  await dismissOnboarding(win);
  await expect(win.locator("html")).toHaveAttribute("lang", "vi");

  // Không reload cửa sổ: biến đánh dấu trên window phải còn sau khi đổi ngôn ngữ; ô nhập ở trang hiện tại giữ giá trị
  // (state đang gõ được giữ — đã kiểm chi tiết ở unit i18n-provider.test.ts).
  await win.evaluate(() => {
    (window as unknown as { __ivMarker: number }).__ivMarker = 42;
  });
  await win.getByTestId("nav-settings").click();
  await win.locator('input[type=radio][value="en"]').check();
  await expect(win.locator("html")).toHaveAttribute("lang", "en", {
    timeout: 2000,
  });
  await expect(
    win.getByTestId("placeholder-settings").locator("h2"),
  ).toHaveText("Settings");
  expect(
    await win.evaluate(
      () => (window as unknown as { __ivMarker?: number }).__ivMarker,
    ),
  ).toBe(42);
  await win.getByTestId("nav-notebooks").click();
  await expect(win.getByTestId("notebook-search")).toHaveAttribute(
    "placeholder",
    /Search… \(⌘K\)/,
  );
  await app.close();

  // Mở lại cùng userData: OS vẫn "vi" nhưng lựa chọn đã lưu là English.
  const app2 = await electron.launch({
    args: [MAIN, `--user-data-dir=${userData}`],
    env: {
      ...process.env,
      IV_EMBED_FAKE: "1",
      IV_RERANK_FAKE: "1",
      IV_UI_LANG: "vi",
    } as Record<string, string>,
  });
  const win2 = await app2.firstWindow();
  await expect(win2.locator("html")).toHaveAttribute("lang", "en");
  await win2.getByTestId("nav-settings").click();
  await win2.locator('input[type=radio][value="auto"]').check();
  await expect(win2.locator("html")).toHaveAttribute("lang", "vi", {
    timeout: 2000,
  });
  await expect(
    win2.getByTestId("placeholder-settings").locator("h2"),
  ).toHaveText("Cài đặt");
  await app2.close();
});

test("145: menu ứng dụng theo ngôn ngữ giao diện, đổi ngay khi đổi ngôn ngữ", async () => {
  const { app } = await launchFreshAt({ IV_UI_LANG: "en" });
  const win = await app.firstWindow();
  await dismissOnboarding(win);
  const topLabels = () =>
    app.evaluate(({ Menu }) =>
      (Menu.getApplicationMenu()?.items ?? []).map((i) => i.label),
    );
  expect(await topLabels()).toEqual(expect.arrayContaining(["Edit", "View"]));
  await win.getByTestId("nav-settings").click();
  await win.locator('input[type=radio][value="vi"]').check();
  await expect(win.locator("html")).toHaveAttribute("lang", "vi");
  await expect.poll(topLabels).toEqual(expect.arrayContaining(["Sửa", "Xem"]));
  await app.close();
});
