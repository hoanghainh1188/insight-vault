import type { ParseResult } from "./index";
import type { Ocr } from "../image/ocr";
import { buildImageTranscript } from "../image/image-transcript";

// Parser ảnh (053): OCR → transcript + boxMap (chuẩn hoá 0..1). Ảnh KHÔNG có chữ → ParseResult rỗng (vẫn
// nạp ready, 0 chunk — FR-010). DI ocr + readDims → unit-test không cần tesseract/ảnh thật.

export type ReadDims = (
  imagePath: string,
) => Promise<{ width: number; height: number }>;

export async function parseImage(
  imagePath: string,
  ocr: Ocr,
  readDims: ReadDims,
  onProgress?: (frac: number) => void,
): Promise<ParseResult> {
  const [lines, dims] = await Promise.all([
    ocr.recognize(imagePath, onProgress),
    readDims(imagePath),
  ]);
  if (lines.length === 0) {
    // Ảnh không có chữ → transcript rỗng (pages rỗng); pipeline cho phép với image.
    return { pageCount: null, pages: [], boxMap: [] };
  }
  const { text, boxMap } = buildImageTranscript(lines, dims.width, dims.height);
  return { pageCount: null, pages: [{ page: null, text }], boxMap };
}
