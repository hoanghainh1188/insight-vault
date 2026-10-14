# Data Model: Trích PDF giữ nguyên hộp thông tin và tiêu đề cột bảng

Không đổi DB, IPC hay kiểu chia sẻ. Chỉ thêm kiểu nội bộ trong `src/main/services/ingestion/pdf-layout/`.

| Kiểu | Trường | Ghi chú |
|---|---|---|
| `ColumnAnchors` | `lefts: number[]` (mép trái cột dữ liệu), `rights?: number[]` | rút từ hàng dữ liệu của `detectTables`; đầu vào của `table-header` |
| `HeaderBand` | `lines: Line[]`, `cells: string[]` (theo cột) | kết quả ghép; rỗng ⇒ không có tiêu đề chắc chắn ⇒ giữ cách cũ |
| `SideBoxResult` | `rows: string[][]` | hộp sau gộp dòng nối tiếp, đưa cho `renderTable` hiện có |

Hằng số mới (đặt trong `types.ts`, chốt bằng đo): `SIDE_COLUMN_MIN_LINES`, `HEADER_GAP_MAX`, `HEADER_MAX_LINES`.

Văn bản ra vẫn là chuỗi ở dạng cố định của `cleanText` + `TextBlock[]` (offset bảng). `PDF_EXTRACTION_VERSION`: 3 → 4.
