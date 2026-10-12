// 186: Vite biên dịch worker/worklet thành tệp JS riêng cùng origin và trả URL (AudioWorklet — spike S1).
// Tệp khai báo ambient riêng (không import/export) để wildcard module hợp lệ.
declare module "*?worker&url" {
  const url: string;
  export default url;
}
