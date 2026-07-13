# Contract — OCR + image-transcript (053)

## ocr-path.ts (thuần)

```
resolveCorePath(isPackaged: boolean): string   // thư mục tesseract.js-core; dev↔app.asar.unpacked
```

- Dev → path node_modules nguyên; đóng gói → thay `app.asar`→`app.asar.unpacked`. Không nhận input renderer.

## ocr.ts (I/O)

```
createOcr({ cacheDir, setOnline }): Ocr
interface Ocr { recognize(imagePath): Promise<OcrLine[]>; }   // lazy worker (như transcribe 045)
interface OcrLine { text: string; bbox: { x0:number; y0:number; x1:number; y1:number } }  // pixel
```

- `createWorker("vie+eng", 1, { cachePath: cacheDir, corePath, logger })`; `recognize(path,{},{blocks:true})`
  → duyệt `data.blocks[].paragraphs[].lines[]` → `OcrLine[]`.
- **setOnline(true)** bọc lần tải traineddata ĐẦU (badge egress — Constitution I), tắt sau tải.
- KHÔNG log path/nội dung. Worker giữ lazy (tải model 1 lần).

## image-transcript.ts (THUẦN — crux)

```
buildImageTranscript(lines: OcrLine[], imgW: number, imgH: number): {
  text: string;
  boxMap: { charStart: number; charEnd: number; bbox: Bbox01 }[];  // bbox chuẩn hoá 0..1
}
bboxForCharRange(boxMap, charStart, charEnd): Bbox01 | null   // HỢP (union) bbox các dòng giao [start,end)
type Bbox01 = { x: number; y: number; w: number; h: number }   // 0..1
```

- Ghép `text` = các dòng nối bằng "\n" (hoặc " "), chuẩn hoá whitespace khớp `cleanText` (để char-range
  sau khi clean vẫn khớp — như audio-transcript 045).
- `bbox` chuẩn hoá: `x=x0/imgW, y=y0/imgH, w=(x1-x0)/imgW, h=(y1-y0)/imgH` (kẹp 0..1).
- `bboxForCharRange`: union các bbox dòng có `[charStart,charEnd)` giao `[start,end)` → `{x=min, y=min,
w=max x2−min x, h=max y2−min y}`; null nếu không giao.

## parsers/image.ts

```
parseImage(imagePath, ocr, readDims): Promise<ParseResult>
```

- `readDims(imagePath) → {width,height}` (image-size, đọc header).
- `lines = await ocr.recognize(imagePath)`; `lines` rỗng → `ParseResult` **rỗng** (ảnh không chữ, ready 0
  chunk — FR-010). Else `buildImageTranscript(lines, w, h)` → `{ pageCount:null, pages:[{page:null,text}],
boxMap }` (ParseResult thêm optional `boxMap`).

## Test contract

- image-transcript: chuẩn hoá 0..1 đúng; `bboxForCharRange` union nhiều dòng (1 khối), null khi ngoài range.
- ocr-path: dev giữ, packaged thay unpacked.
- parseImage: DI mock ocr (có dòng→text+boxMap; rỗng→ParseResult rỗng) + mock readDims.
