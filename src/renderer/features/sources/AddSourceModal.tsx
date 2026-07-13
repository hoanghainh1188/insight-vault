import { useRef, useState } from "react";
import type { AddSourceInput, SourceKind } from "@shared/ipc/types";
import { useModalA11y } from "../../shared/useModalA11y";
import { IconClose } from "../../shared/icons";

const FILE_EXT: Record<string, Exclude<SourceKind, "url">> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  md: "md",
  markdown: "md",
  // 045 (Pha 2a): audio — bóc băng cục bộ bằng Whisper. 051: thêm m4a/aac (tách qua ffmpeg).
  wav: "audio",
  mp3: "audio",
  flac: "audio",
  ogg: "audio",
  m4a: "audio",
  aac: "audio",
  // 051 (Pha 2b): video — tách audio (ffmpeg) → bóc băng; phát <video> qua iv-media://.
  mp4: "video",
  mov: "video",
  webm: "video",
  mkv: "video",
};

function kindOf(name: string): Exclude<SourceKind, "url"> | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return FILE_EXT[ext] ?? null;
}

// Modal "Thêm nguồn" (prototype S3). Tệp (PDF/.docx/.txt/.md · audio 045+m4a/aac · video 051 mp4/mov/webm/mkv)
// + URL. Audio/Video nhập qua tab Tệp (kéo-thả); tab "Video" bấm → tab Tệp. "Hình ảnh" (2c) còn VÔ HIỆU.
export function AddSourceModal({
  notebookId,
  onAdd,
  onClose,
}: {
  notebookId: string;
  onAdd: (input: AddSourceInput) => Promise<boolean>;
  onClose: () => void;
}): JSX.Element {
  const [tab, setTab] = useState<"file" | "url">("file");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y({ active: true, onClose, containerRef: modalRef });

  const addFiles = async (files: FileList | File[]): Promise<void> => {
    setError(null);
    const arr = Array.from(files);
    const rejected: string[] = [];
    let dup = false;
    for (const f of arr) {
      const kind = kindOf(f.name);
      if (!kind) {
        rejected.push(f.name);
        continue;
      }
      const filePath = window.api.getFilePath(f);
      try {
        if (await onAdd({ notebookId, kind, filePath })) dup = true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không thêm được nguồn.");
      }
    }
    if (rejected.length)
      setError(
        `Không hỗ trợ: ${rejected.join(", ")} (PDF/.docx/.txt/.md · audio .wav/.mp3/.flac/.ogg/.m4a/.aac · video .mp4/.mov/.webm/.mkv).`,
      );
    else if (dup) setNotice("Một nguồn có thể đã tồn tại trong notebook.");
    else onClose();
  };

  const addUrl = async (): Promise<void> => {
    setError(null);
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) {
      setError("Nhập URL bắt đầu bằng http:// hoặc https://");
      return;
    }
    try {
      const dup = await onAdd({ notebookId, kind: "url", url: u });
      if (dup) setNotice("Nguồn URL này có thể đã tồn tại.");
      else onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thêm được URL.");
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      data-testid="add-source-modal"
    >
      <div
        className="modal add-source"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Thêm nguồn"
      >
        <button
          type="button"
          className="modal-x"
          onClick={onClose}
          aria-label="Đóng"
          data-testid="modal-close"
        >
          <IconClose size={16} />
        </button>
        <h3>Thêm nguồn</h3>

        <div className="types" role="tablist">
          <button
            type="button"
            className={tab === "file" ? "type active" : "type"}
            onClick={() => setTab("file")}
            data-testid="tab-file"
          >
            Tệp
          </button>
          <button
            type="button"
            className={tab === "url" ? "type active" : "type"}
            onClick={() => setTab("url")}
            data-testid="tab-url"
          >
            URL
          </button>
          {/* 045/051: audio + video nhập qua tab "Tệp" (kéo-thả). Bấm "Video" → về tab Tệp. "Hình ảnh" (2c) hoãn. */}
          <button
            type="button"
            className={tab === "file" ? "type active" : "type"}
            onClick={() => setTab("file")}
            title="Kéo tệp video (mp4/mov/webm/mkv) hoặc audio vào tab Tệp"
            data-testid="tab-video"
          >
            Video
          </button>
          <button
            type="button"
            className="type"
            disabled
            title="Sắp có ở Pha 2c"
          >
            Hình ảnh
          </button>
        </div>

        {tab === "file" && (
          <div
            className={dragOver ? "drop over" : "drop"}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInput.current?.click()}
            data-testid="drop-zone"
          >
            <p>Kéo-thả tệp vào đây hoặc bấm để chọn</p>
            <p className="hint">
              Xử lý ngay trên máy · PDF/.docx/.txt/.md · audio
              .wav/.mp3/.flac/.ogg/.m4a/.aac · video .mp4/.mov/.webm/.mkv (tự
              bóc băng)
            </p>
            <p className="hint" data-testid="video-origin-note">
              Video phát từ vị trí file gốc; nếu xoá/di chuyển file, sẽ không
              phát lại được (bản bóc băng vẫn xem được).
            </p>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,.wav,.mp3,.flac,.ogg,.m4a,.aac,.mp4,.mov,.webm,.mkv"
              hidden
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
              }}
            />
          </div>
        )}

        {tab === "url" && (
          <div className="url-row">
            <input
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid="url-input"
            />
            <button
              type="button"
              onClick={() => void addUrl()}
              data-testid="url-add"
            >
              Thêm
            </button>
          </div>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && <p className="form-notice">{notice}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
