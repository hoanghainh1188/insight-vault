import { readFileSync } from "node:fs";
import { join } from "node:path";

// 213: danh sách thư viện mã nguồn mở cho hộp Giới thiệu — lấy từ package.json của CHÍNH các gói đang đóng gói (không gõ tay ⇒
// không lệch). `collectLicenses` thuần (nhận hàm đọc gói); `loadLibraries` đọc đĩa một lần.

export interface LibraryEntry {
  name: string;
  version: string;
  license: string | null;
}

function licenseOf(pkg: Record<string, unknown>): string | null {
  const one = pkg["license"];
  if (typeof one === "string" && one.trim() !== "") return one;
  if (one && typeof one === "object") {
    const t = (one as Record<string, unknown>)["type"];
    if (typeof t === "string" && t !== "") return t;
  }
  const many = pkg["licenses"];
  if (Array.isArray(many)) {
    const types = many
      .map((l) =>
        l && typeof l === "object"
          ? (l as Record<string, unknown>)["type"]
          : undefined,
      )
      .filter((t): t is string => typeof t === "string" && t !== "");
    if (types.length > 0) return types.join(" OR ");
  }
  return null;
}

export function collectLicenses(
  names: readonly string[],
  readPkg: (name: string) => unknown,
): LibraryEntry[] {
  return names
    .map((name): LibraryEntry => {
      try {
        const pkg = readPkg(name) as Record<string, unknown>;
        const v = pkg["version"];
        return {
          name,
          version: typeof v === "string" ? v : "?",
          license: licenseOf(pkg),
        };
      } catch {
        return { name, version: "?", license: null };
      }
    })
    .sort((a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    );
}

/** Đọc `dependencies` của package.json tại `appPath` (cả trong asar) + package.json từng gói. Lỗi bất kỳ ⇒ null. */
export function loadLibraries(appPath: string): LibraryEntry[] | null {
  try {
    const root = JSON.parse(
      readFileSync(join(appPath, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    const names = Object.keys(root.dependencies ?? {});
    return collectLicenses(names, (n) =>
      JSON.parse(
        readFileSync(join(appPath, "node_modules", n, "package.json"), "utf8"),
      ),
    );
  } catch {
    return null;
  }
}
