import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh, dismissOnboarding } from "./helper";

// US1/2/3: tạo → lưới → tìm kiếm → sửa → xoá (SQLite qua IPC). userData tạm → DB rỗng.
let app: ElectronApplication;
test.beforeAll(async () => {
  app = await launchFresh();
});
test.afterAll(async () => {
  await app?.close();
});

async function createNotebook(
  win: import("@playwright/test").Page,
  name: string,
) {
  await win.getByTestId("notebook-new").click();
  await expect(win.getByTestId("notebook-modal")).toBeVisible();
  await win.getByTestId("notebook-name-input").fill(name);
  await win.getByTestId("notebook-submit").click();
  await expect(win.getByTestId("notebook-modal")).toBeHidden();
}

test("tạo, tìm kiếm, sửa, xoá notebook — lưu bền qua SQLite", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);

  // Tạo 2 notebook (V2)
  await createNotebook(win, "Hồ sơ M&A");
  await createNotebook(win, "Nghiên cứu Q3");
  await expect(win.getByText("Hồ sơ M&A")).toBeVisible();
  await expect(win.getByText("Nghiên cứu Q3")).toBeVisible();
  await expect(win.getByText("0 nguồn").first()).toBeVisible(); // FR-002

  // Tìm kiếm client-side (V6)
  await win.getByTestId("notebook-search").fill("m&a");
  await expect(win.getByText("Hồ sơ M&A")).toBeVisible();
  await expect(win.getByText("Nghiên cứu Q3")).toBeHidden();
  await win.getByTestId("notebook-search").fill("");

  // Validate tên rỗng (V3)
  await win.getByTestId("notebook-new").click();
  await win.getByTestId("notebook-submit").click();
  await expect(win.getByTestId("notebook-error")).toBeVisible();
  await win.getByRole("button", { name: "Huỷ" }).click();

  // Sửa tên (V4)
  await win
    .locator(".nb-card", { hasText: "Nghiên cứu Q3" })
    .getByTestId("notebook-edit")
    .click();
  await win.getByTestId("notebook-name-input").fill("Nghiên cứu Q4");
  await win.getByTestId("notebook-submit").click();
  await expect(win.getByText("Nghiên cứu Q4")).toBeVisible();

  // Xoá có xác nhận (V5)
  await win
    .locator(".nb-card", { hasText: "Nghiên cứu Q4" })
    .getByTestId("notebook-delete")
    .click();
  await expect(win.getByTestId("delete-confirm")).toBeVisible();
  await win.getByTestId("delete-confirm-btn").click();
  await expect(win.getByTestId("delete-confirm")).toBeHidden();
  await expect(
    win.locator(".nb-card", { hasText: "Nghiên cứu Q4" }),
  ).toHaveCount(0);
  await expect(win.locator(".nb-card", { hasText: "Hồ sơ M&A" })).toHaveCount(
    1,
  );
});
