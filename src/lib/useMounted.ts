"use client";

import { useSyncExternalStore } from "react";

/** Không bao giờ báo thay đổi — giá trị chỉ khác nhau giữa server và client. */
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * true sau khi component đã mount ở trình duyệt.
 *
 * Dùng để chặn việc render dữ liệu đã persist (zustand/localStorage) trong lần
 * render đầu: HTML tĩnh sinh lúc build không có dữ liệu đó, nếu render ngay sẽ
 * lệch hydration.
 *
 * Dùng useSyncExternalStore thay cho cặp useState + useEffect: đây là cách
 * React khuyến nghị để lấy giá trị khác nhau giữa server và client, và không
 * vi phạm quy tắc "không setState đồng bộ trong effect" của React Compiler.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
