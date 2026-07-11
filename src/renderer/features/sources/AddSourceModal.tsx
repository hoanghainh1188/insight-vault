import { useRef, useState } from "react";
import type { AddSourceInput, SourceKind } from "@shared/ipc/types";

const FILE_EXT: Record<string, Exclude<SourceKind, "url">> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  md: "md",
  markdown: "md",
};

function kindOf(name: string): Exclude<SourceKind, "url"> | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return FILE_EXT[ext] ?? null;
}

// Modal "Thêm nguồn" (prototype S3). Feature này: Tệp (PDF/.docx/.txt/.md) + URL.
// Audio/Video + Hình ảnh hiển thị nhưng VÔ HIỆU (Pha 2 — FR-003).
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
        `Không hỗ trợ: ${rejected.join(", ")} (chỉ PDF/.docx/.txt/.md).`,
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
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Thêm nguồn"
      >
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
          <button
            type="button"
            className="type"
            disabled
            title="Sắp có ở Pha 2"
          >
            Audio/Video
          </button>
          <button
            type="button"
            className="type"
            disabled
            title="Sắp có ở Pha 2"
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
              Tệp được xử lý ngay trên máy bạn · PDF/.docx/.txt/.md
            </p>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md"
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
