import { describe, it, expect } from "vitest";
import {
  EMBEDDING_MODEL_VERSION,
  EMBEDDING_VERSION_REINDEXING,
  matchesVersion,
  reindexPhase,
} from "../../src/main/services/embedding/model-version";

describe("matchesVersion", () => {
  it("khớp version hiện tại", () => {
    expect(matchesVersion(EMBEDDING_MODEL_VERSION)).toBe(true);
  });

  it("không khớp version cũ (Ollama 768d) → cần reindex", () => {
    expect(matchesVersion("nomic-embed-768")).toBe(false);
  });

  it("undefined/null (chưa từng đặt) → cần reindex", () => {
    expect(matchesVersion(undefined)).toBe(false);
    expect(matchesVersion(null)).toBe(false);
  });
});

describe("reindexPhase", () => {
  it("version hiện tại → done (không reindex)", () => {
    expect(reindexPhase(EMBEDDING_MODEL_VERSION)).toBe("done");
  });

  it("marker đang dở → resume (KHÔNG drop bảng)", () => {
    expect(reindexPhase(EMBEDDING_VERSION_REINDEXING)).toBe("resume");
  });

  it("version cũ/thiếu → fresh (drop bảng cũ)", () => {
    expect(reindexPhase("nomic-embed-768")).toBe("fresh");
    expect(reindexPhase(undefined)).toBe("fresh");
    expect(reindexPhase(null)).toBe("fresh");
  });
});
