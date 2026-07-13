// Chia lô tái lập chỉ mục (059). Nhúng lại theo lô để: (a) resume được (tắt giữa chừng → mở lại tiếp phần
// dở), (b) phát tiến độ mượt, (c) không giữ toàn bộ text trong RAM. Hàm thuần → test.

/** Chia danh sách chunk id thành các lô kích thước batchSize (lô cuối có thể ngắn hơn). */
export function planReindexBatches(
  chunkIds: string[],
  batchSize: number,
): string[][] {
  if (batchSize <= 0) throw new Error("batchSize phải > 0");
  const batches: string[][] = [];
  for (let i = 0; i < chunkIds.length; i += batchSize) {
    batches.push(chunkIds.slice(i, i + batchSize));
  }
  return batches;
}
