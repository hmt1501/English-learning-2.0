/**
 * Mọi thứ liên quan tới "ngày" trong app đều tính theo GIỜ ĐỊA PHƯƠNG của
 * thiết bị, không dùng UTC — nếu dùng UTC thì người học ở VN (UTC+7) sẽ bị
 * "sang ngày mới" lúc 7 giờ sáng, rất khó hiểu.
 *
 * Logic thuần, không gọi Date.now() bên trong (người gọi truyền Date vào),
 * để hợp với quy tắc React Compiler và để test được.
 */

/** Định dạng YYYY-MM-DD theo giờ địa phương. */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Chuỗi YYYY-MM-DD -> Date lúc 12:00 trưa địa phương (tránh lệch do DST). */
export function fromLocalDateString(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Cộng/trừ số ngày, trả về chuỗi YYYY-MM-DD. */
export function addDays(dateString: string, days: number): string {
  const d = fromLocalDateString(dateString);
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

/** Số ngày chênh lệch (b - a). */
export function daysBetween(a: string, b: string): number {
  const ms = fromLocalDateString(b).getTime() - fromLocalDateString(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** `prev` có phải là ngày liền trước `today` không. */
export function isYesterday(prev: string, today: string): boolean {
  return daysBetween(prev, today) === 1;
}

/** Hiển thị kiểu "Thứ Hai, 20/07/2026". */
const WEEKDAY_VI = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

export function formatDateVi(dateString: string): string {
  const d = fromLocalDateString(dateString);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${WEEKDAY_VI[d.getDay()]}, ${dd}/${mm}/${d.getFullYear()}`;
}
