"use client";

import { useEffect } from "react";
import { withBase } from "@/lib/basePath";

/**
 * Đăng ký service worker CHỈ Ở PRODUCTION.
 *
 * Ở môi trường dev, service worker cache lại code cũ gây ra đủ loại lỗi
 * "sửa rồi mà không thấy đổi", nên cố ý bỏ qua.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register(withBase("/sw.js"), { scope: withBase("/") })
        .catch(() => {
          // Không đăng ký được thì app vẫn chạy bình thường, chỉ là không offline.
        });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
