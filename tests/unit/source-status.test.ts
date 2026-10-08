import { describe, it, expect } from "vitest";
import {
  statClass,
  statusLabel,
  aggregateLabel,
} from "../../src/renderer/features/sources/source-status";
import type { Source } from "@shared/ipc/types";
import { trEn } from "./helpers/t-vi";

const s = (status: Source["status"], errorLabel: string | null = null) =>
  ({ status, errorLabel }) as Pick<Source, "status" | "errorLabel">;

describe("source-status", () => {
  it("statClass: ready→ready, error→err, còn lại→proc", () => {
    expect(statClass("ready")).toBe("ready");
    expect(statClass("error")).toBe("err");
    expect(statClass("queued")).toBe("proc");
    expect(statClass("processing")).toBe("proc");
    expect(statClass("awaiting_embedding")).toBe("proc");
  });

  it("statusLabel: dùng errorLabel khi lỗi, ngược lại nhãn chuẩn", () => {
    expect(statusLabel(s("ready"))).toBe("Sẵn sàng");
    expect(statusLabel(s("awaiting_embedding"))).toBe("Chờ nhúng");
    expect(statusLabel(s("error", "Tệp quá lớn"))).toBe("Tệp quá lớn");
    expect(statusLabel(s("error", null))).toBe("Lỗi");
  });

  it("aggregateLabel: 0→'', mọi ready→đã lập chỉ mục, còn lại→đang xử lý M", () => {
    expect(aggregateLabel([])).toBe("");
    expect(aggregateLabel([s("ready"), s("ready")])).toBe(
      "2 nguồn · đã lập chỉ mục",
    );
    expect(aggregateLabel([s("ready"), s("processing"), s("queued")])).toBe(
      "3 nguồn · đang xử lý 2",
    );
    // error KHÔNG tính là pending
    expect(aggregateLabel([s("ready"), s("error", "x")])).toBe(
      "2 nguồn · đã lập chỉ mục",
    );
  });

  it("123: dịch theo Translator — mã lỗi + plural tiếng Anh", () => {
    expect(statusLabel(s("ready"), trEn)).toBe("Ready");
    expect(statusLabel(s("error", "tooLarge"), trEn)).toBe("File too large");
    expect(statusLabel(s("error", "Tệp quá lớn"), trEn)).toBe("File too large");
    expect(aggregateLabel([s("ready")], trEn)).toBe("1 source · indexed");
    expect(aggregateLabel([s("ready"), s("queued")], trEn)).toBe(
      "2 sources · 1 processing",
    );
  });
});
