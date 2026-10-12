// 186 — chính sách quyền của session (research R11, quyết định A5). THUẦN — installSecurity (index.ts) chỉ nối vào.
// Mặc định vẫn TỪ CHỐI mọi quyền (Constitution I/III). Ngoại lệ duy nhất: micro (media, audio-only) cho cửa sổ chính
// của app, chỉ trong "cổng" ngắn sau khi người dùng bấm Bắt đầu ghi / Tiếp tục.

/** URL thuộc renderer của app: bản đóng gói (file://) hoặc đúng origin của dev server (ELECTRON_RENDERER_URL). */
export function isAppOrigin(url: string, devUrl: string | undefined): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (devUrl) {
    try {
      return parsed.origin === new URL(devUrl).origin;
    } catch {
      return false;
    }
  }
  return parsed.protocol === "file:";
}

export interface MediaPermissionRequest {
  permission: string;
  mediaTypes: readonly string[] | undefined;
  requestingUrl: string;
  isMainFrame: boolean;
  isMainWindow: boolean;
  /** Epoch ms hết cổng; 0 = chưa mở. */
  armedUntil: number;
  now: number;
  devUrl: string | undefined;
}

export function decideMediaPermission(req: MediaPermissionRequest): boolean {
  const types = req.mediaTypes ?? [];
  return (
    req.permission === "media" &&
    types.length > 0 &&
    types.every((t) => t === "audio") &&
    req.isMainFrame &&
    req.isMainWindow &&
    req.now < req.armedUntil &&
    isAppOrigin(req.requestingUrl, req.devUrl)
  );
}

export interface PermissionCheck {
  permission: string;
  mediaType: string | undefined;
  requestingUrl: string;
  isMainWindow: boolean;
  devUrl: string | undefined;
}

/** setPermissionCheckHandler: chỉ trả true cho micro của cửa sổ chính (không cần cổng — kiểm không cấp quyền thu). */
export function decidePermissionCheck(check: PermissionCheck): boolean {
  return (
    check.permission === "media" &&
    check.mediaType === "audio" &&
    check.isMainWindow &&
    isAppOrigin(check.requestingUrl, check.devUrl)
  );
}

export interface MicGate {
  /** Mở cổng quyền micro `windowMs` kể từ bây giờ (gọi khi người dùng bấm Bắt đầu ghi / Tiếp tục / đổi thiết bị). */
  arm(): void;
  disarm(): void;
  /** Epoch ms hết cổng; 0 = đang đóng. */
  armedUntil(): number;
}

export function createMicGate(now: () => number, windowMs: number): MicGate {
  let until = 0;
  return {
    arm: () => {
      until = now() + windowMs;
    },
    disarm: () => {
      until = 0;
    },
    armedUntil: () => until,
  };
}
