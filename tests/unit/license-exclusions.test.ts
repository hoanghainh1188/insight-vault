import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Phân phối: không đóng gói mã GPL/nonfree. Test canh giữ cấu hình (xem scripts/build-ffmpeg-lgpl.sh).
const root = join(__dirname, "..", "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");

describe("license guard", () => {
  const builder = read("electron-builder.yml");

  it.each(["@audio/decode-aac", "@audio/decode-wma"])(
    "loại decoder GPL %s khỏi bản cài",
    (pkg) => {
      expect(builder).toContain(`"!node_modules/${pkg}/**"`);
    },
  );

  it("không còn phụ thuộc ffmpeg-static (binary GPL/nonfree)", () => {
    const pkg = JSON.parse(read("package.json")) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies["ffmpeg-static"]).toBeUndefined();
  });

  it("ffmpeg LGPL được kèm bản cài, script dựng cấm gpl/nonfree", () => {
    expect(builder).toMatch(/from: build\/ffmpeg\s+to: ffmpeg/);
    const sh = read("scripts/build-ffmpeg-lgpl.sh");
    expect(sh).toContain("--disable-gpl");
    expect(sh).toContain("--disable-nonfree");
    expect(sh).not.toMatch(/--enable-(gpl|nonfree|libx264|libx265)/);
  });
});
