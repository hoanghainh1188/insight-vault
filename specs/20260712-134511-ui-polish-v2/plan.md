# Implementation Plan: UI Polish v2 (037)

**Branch**: `037-ui-polish-v2` · **Spec**: [spec.md](./spec.md)

## Technical Context

Thuần renderer + 1 kênh IPC read-only. Kế thừa: `SourceProgressEvent{step,progress}` (011), `onSourceProgress`
preload, `useSources`/`SourceItem`/`SourceList`, `SourceViewer`+`buildSegments`/`.hl` (019),
`getDataDir`/`DataDirInfo` (001), `safeHandle` whitelist. KHÔNG migration.

**Constitution:** I (chỉ đọc metadata cục bộ, không egress) · III (IPC read-only whitelisted, không log
nội dung) · IV (logic thuần test được: nhãn bước, format bytes, progress state reducer).

## Cấu trúc (file < 400 dòng)

### A — Tiến độ nguồn (renderer)

- `src/renderer/features/sources/source-status.ts` (SỬA): thêm `stepLabel(step)` (parse→"Phân tích"…) +
  giữ statusLabel. THUẦN.
- `src/renderer/features/sources/useSources.ts` (SỬA): thêm `progressById: Map<id,{step,progress}>` cập
  nhật từ `onSourceProgress` (ngoài reload); xoá entry khi status ready/error. Trả `progress`.
- `src/renderer/features/sources/SourceItem.tsx` (SỬA): nhận `progress?`; khi processing → thanh
  `.src-progress` (width theo progress) + nhãn bước. `sources.css`: style thanh.

### B — Nhãn [n] highlight (renderer)

- `src/renderer/features/source-viewer/SourceViewer.tsx` (SỬA): trong đoạn `.hl` chèn `<span class="hltag">[n]</span>`
  (n từ citation đang mở). `source-viewer.css`: `.hltag` (nhãn nhỏ nổi, không che chữ).

### C — Section Lưu trữ (main + IPC + renderer)

- `src/main/services/app-shell/storage-info.ts` (MỚI): `dirSize(path)` (đệ quy, THUẦN test được với fake
  fs) + `computeStorageInfo(path, {statfs, walk})` → `StorageInfo`. Wiring fs I/O tách (exclude coverage).
- `src/shared/ipc/{types,channels}.ts`: `StorageInfo` + kênh `app:getStorageInfo`.
- `src/main/ipc/register.ts`: `safeHandle(getStorageInfo)` gọi computeStorageInfo(dataDir.path). Không log.
- `src/preload/index.ts`: `getStorageInfo()`.
- `src/renderer/shared/format-bytes.ts` (MỚI, THUẦN): `formatBytes(n)` → "1.2 GB".
- `src/renderer/features/app-shell/SettingsStorageSection.tsx` (MỚI): đọc getStorageInfo → path + used +
  free + thanh dùng/tổng. Ghép vào routes settings.

### D — Polish (renderer/CSS)

- `SourceItem`/`sources.css`: `.src-icon` badge nền màu theo kind (map màu). `SourceList`: skeleton items
  khi `loading`.

## Coverage

- Include (≥80%): `source-status.ts` (stepLabel), `format-bytes.ts`, `storage-info.ts` (dirSize/compute
  thuần với fake). Progress-state trong useSources: phủ qua component/hook test nếu khả thi, hoặc tách
  reducer thuần.
- Exclude: SettingsStorageSection (wiring), storage IPC wiring, SourceViewer (đã e2e).

## Test

- Unit: `stepLabel` (6 step), `formatBytes` (B/KB/MB/GB, 0, số lớn), `dirSize`/`computeStorageInfo` (fake
  fs walk + statfs), progress reducer (cập nhật/ xoá khi ready). IPC whitelist +`app:getStorageInfo`.
- e2e: GIỮ mọi e2e cũ xanh; THÊM: section Lưu trữ hiện path (getStorageInfo whitelisted); (tiến độ realtime
  cần ingest thật → phủ unit + thủ công).

## Phases

1. Types/channels + format-bytes + source-status stepLabel (thuần).
2. storage-info (main) + IPC + preload + SettingsStorageSection.
3. useSources progress + SourceItem thanh tiến độ.
4. SourceViewer nhãn [n] + polish icon/skeleton + CSS.
5. Test + gate.
