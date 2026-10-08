import { createTranslator } from "../../../src/shared/i18n/translate";

// 123 (research R11): test cũ assert chuỗi giao diện qua khoá dịch tiếng Việt thay vì chép chuỗi cứng.
export const trVi = createTranslator("vi");
export const trEn = createTranslator("en");
export const tVi = trVi.t;
export const tEn = trEn.t;
