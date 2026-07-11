import type { LLMProvider } from "./provider";

// Quản lý các provider AI (ADR D3). v1 đăng ký 1 provider (Ollama); feature 008 thêm online provider
// qua CÙNG interface — nơi gọi AI chỉ lấy getActive(), không sửa gì (SC-006).
export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>();
  private activeId: string | null = null;

  register(provider: LLMProvider, opts: { activate?: boolean } = {}): void {
    this.providers.set(provider.id, provider);
    if (opts.activate || this.activeId === null) this.activeId = provider.id;
  }

  setActive(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Provider chưa đăng ký: ${id}`);
    }
    this.activeId = id;
  }

  getActive(): LLMProvider {
    if (!this.activeId) throw new Error("Chưa có provider nào được đăng ký.");
    return this.providers.get(this.activeId)!;
  }

  list(): string[] {
    return [...this.providers.keys()];
  }
}
