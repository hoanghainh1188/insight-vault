// 091 — kênh thông báo cho trình đọc màn hình (pub/sub thuần, không React). Component/hook gọi `announce()`;
// <LiveRegion/> gắn 1 lần ở vỏ app hiển thị câu vào vùng aria-live ẩn. Chỉ dùng cho MỐC trạng thái — không
// đẩy từng token stream / từng % tiến độ (trình đọc màn hình sẽ đọc dồn dập).

export type Politeness = "polite" | "assertive";

export interface Announcement {
  id: number;
  message: string;
  politeness: Politeness;
}

type Listener = (a: Announcement) => void;

export interface Announcer {
  announce(message: string, politeness?: Politeness): void;
  subscribe(listener: Listener): () => void;
}

export function createAnnouncer(): Announcer {
  const listeners = new Set<Listener>();
  let nextId = 0;
  return {
    announce(message, politeness = "polite") {
      if (message.trim() === "") return;
      nextId += 1;
      const a: Announcement = { id: nextId, message, politeness };
      for (const l of listeners) l(a);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

/** Kênh dùng chung của app. */
export const announcer = createAnnouncer();

export const announce = (message: string, politeness?: Politeness): void =>
  announcer.announce(message, politeness);
