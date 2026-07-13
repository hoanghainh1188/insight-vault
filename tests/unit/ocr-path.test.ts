import { describe, it, expect } from "vitest";
import { resolveCorePathFrom } from "../../src/main/services/ingestion/image/ocr-path";

describe("resolveCorePathFrom (053)", () => {
  it("dev (không đóng gói) → giữ nguyên", () => {
    expect(
      resolveCorePathFrom("/proj/node_modules/tesseract.js-core", false),
    ).toBe("/proj/node_modules/tesseract.js-core");
  });
  it("đóng gói → thay app.asar → app.asar.unpacked", () => {
    expect(
      resolveCorePathFrom(
        "/App/Resources/app.asar/node_modules/tesseract.js-core",
        true,
      ),
    ).toBe("/App/Resources/app.asar.unpacked/node_modules/tesseract.js-core");
  });
});
