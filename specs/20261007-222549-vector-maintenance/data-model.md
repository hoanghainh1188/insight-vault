# Data model — 116 vector-maintenance

Không đổi schema SQLite hay bảng LanceDB `chunks`. Mọi trạng thái mới chỉ nằm trong **bộ nhớ main process**.

## VectorStoreStats (đo kho, adapter → bảo trì)

| Trường             | Kiểu   | Ý nghĩa                                                                    |
| ------------------ | ------ | -------------------------------------------------------------------------- |
| `fragmentCount`    | number | `stats().fragmentStats.numFragments`                                       |
| `rowCount`         | number | `stats().numRows`                                                          |
| `prunableVersions` | number | số phiên bản có `timestamp` < `now − retentionMs` (trừ phiên bản hiện tại) |

`stats(retentionMs)` trả `null` khi bảng chưa tồn tại.

## VectorOptimizeResult (adapter → bảo trì)

| Trường             | Kiểu   | Từ `OptimizeStats`            |
| ------------------ | ------ | ----------------------------- |
| `fragmentsRemoved` | number | `compaction.fragmentsRemoved` |
| `fragmentsAdded`   | number | `compaction.fragmentsAdded`   |
| `versionsRemoved`  | number | `prune.oldVersionsRemoved`    |
| `bytesFreed`       | number | `prune.bytesRemoved`          |

`optimize(retentionMs)` trả `null` khi bảng chưa tồn tại.

## MaintenanceState (hàm thuần lên lịch, bất biến — mỗi bước trả bản mới)

| Trường                | Kiểu            | Ghi chú                                                           |
| --------------------- | --------------- | ----------------------------------------------------------------- |
| `dirtyWrites`         | number          | số thao tác ghi kể từ lần bảo trì "done" gần nhất                 |
| `lastWriteAt`         | number \| null  | epoch ms                                                          |
| `lastRunAt`           | number \| null  | thời điểm BẮT ĐẦU lần chạy gần nhất (done hoặc error)             |
| `followUpAt`          | number \| null  | hẹn kiểm lại để dọn phiên bản sau biên (khi lần trước có gộp)     |
| `pendingReason`       | Trigger \| null | lý do kích hoạt đang chờ (`write`/`startup`/`reindex`/`followUp`) |
| `pendingDueAt`        | number \| null | mốc sớm nhất được chạy lý do đang chờ (debounce / trễ khởi động / hoãn bận / backoff) |
| `runTrigger` / `runStartedAt` / `runDirtyAtStart` | — | thông tin lần đang chạy (để `applyOutcome` biết trigger, `lastRunAt`, số ghi đã bao trọn) |
| `consecutiveFailures` | number          | reset về 0 khi "done"                                             |
| `disabled`            | boolean         | true sau `MAX_CONSECUTIVE_FAILURES` lỗi — tới lần khởi động sau   |
| `running`             | boolean         | single-flight                                                     |

`Trigger = "write" | "startup" | "reindex" | "followUp"`.

## MaintenanceDecision (kết quả `nextAction(state, now)`)

- `{ kind: "idle" }` — không có gì chờ (hoặc `disabled`/`running`).
- `{ kind: "wait", delayMs, trigger }` — hẹn giờ tới thời điểm đủ điều kiện (debounce / trần tần suất / backoff / follow-up).
- `{ kind: "check", trigger }` — tới lúc: kiểm bận + đo + cổng.

## GateResult (kết quả `evaluateGate(input)`)

Input: `{ busy, stats: VectorStoreStats | null, freeBytes, storeBytes }`.

- `{ run: true }` khi không bận, bảng có, `freeBytes ≥ FREE_SPACE_FACTOR × storeBytes` và
  (`fragmentCount ≥ FRAGMENT_THRESHOLD` ∨ `prunableVersions ≥ PRUNABLE_VERSIONS_THRESHOLD`).
- `{ run: false, reason }` với `reason ∈ "busy" | "noTable" | "belowThreshold" | "lowDisk"` (thứ tự ưu tiên như liệt kê — dưới ngưỡng thì không cần đo đĩa).

## MaintenanceOutcome (vào `applyOutcome(state, outcome, now)`)

- `done` `{ fragmentsBefore, fragmentsAfter, versionsRemoved, bytesFreed, durationMs }` ⇒ `dirtyWrites=0`,
  `consecutiveFailures=0`, `followUpAt = now + FOLLOW_UP_MS` nếu `fragmentsBefore > fragmentsAfter` (đã gộp) ngược lại `null`.
- `deferred` `{ reason }` (`busy`/`noTable`/`lowDisk`/`belowThreshold`/`conflict`) ⇒ không tính lỗi; `busy`/`conflict`
  giữ `pendingReason` để thử lại sau `DEBOUNCE_MS`; các lý do khác xoá `pendingReason`.
- `error` `{ errorType }` ⇒ `consecutiveFailures += 1`; đủ `MAX_CONSECUTIVE_FAILURES` ⇒ `disabled = true`; ngược lại
  hẹn lại sau `BACKOFF_BASE_MS × 2^(n−1)`.

## Chuyển trạng thái (tóm tắt)

```
write ──► dirty+1, lastWriteAt=now, pending=write ──(yên DEBOUNCE & qua MIN_INTERVAL)──► check
startup (45 s) / reindex xong ──► pending ──(qua MIN_INTERVAL)──► check
check ──busy/conflict──► deferred ──(DEBOUNCE)──► check
check ──below/noTable/lowDisk──► deferred (hết pending; chờ kích hoạt mới)
check ──run──► running ──► done (followUp nếu đã gộp) | error (backoff / disabled)
```
