/**
 * Service worker viết tay cho "Tiếng Anh Công Sở".
 *
 * Chiến lược:
 *   - Trang (navigate): NETWORK-FIRST — luôn ưu tiên bản mới, mất mạng thì lấy
 *     bản đã cache, không có nữa thì trả trang chủ đã cache (SPA fallback).
 *   - Audio + static asset (_next/static, icon, font): CACHE-FIRST — các file
 *     này có hash hoặc gần như không đổi, lấy từ cache cho nhanh và tiết kiệm.
 *   - Mọi thứ khác (đặc biệt là API của Groq): KHÔNG đụng vào.
 *
 * Không hard-code basePath: sw.js luôn được phục vụ ở gốc của app, nên đường
 * dẫn gốc suy ra từ chính vị trí file này. Nhờ vậy deploy ở "/" hay
 * "/english-learn/" đều chạy.
 */

const VERSION = "v1";
const PAGE_CACHE = `tacs-pages-${VERSION}`;
const ASSET_CACHE = `tacs-assets-${VERSION}`;

/** Thư mục gốc của app, ví dụ "/" hoặc "/english-learn/". */
const BASE = new URL("./", self.location).pathname;

/** Các trang chính được tải sẵn để lần mở đầu tiên đã dùng offline được. */
const PRECACHE_PAGES = [
  "",
  "vocab/",
  "listen/",
  "shadow/",
  "reply/",
  "chat/",
  "settings/",
].map((p) => BASE + p);

const PRECACHE_ASSETS = [
  BASE + "manifest.webmanifest",
  BASE + "icons/icon-192.png",
  BASE + "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGE_CACHE);
      // Dùng addAll từng cái một: thiếu một file không nên làm hỏng cả lần cài.
      await Promise.allSettled(PRECACHE_PAGES.map((url) => pages.add(url)));

      const assets = await caches.open(ASSET_CACHE);
      await Promise.allSettled(PRECACHE_ASSETS.map((url) => assets.add(url)));

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Dọn cache của các phiên bản cũ.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("tacs-") && k !== PAGE_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

/** File tĩnh không đổi -> cache-first. */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith(BASE + "audio/") ||
    url.pathname.startsWith(BASE + "icons/") ||
    url.pathname.startsWith(BASE + "_next/static/") ||
    /\.(?:mp3|png|jpg|jpeg|svg|webp|woff2?|css|js)$/.test(url.pathname)
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  try {
    const res = await fetch(request);
    // Chỉ cache phản hồi thành công, cùng gốc.
    if (res.ok && res.type === "basic") cache.put(request, res.clone());
    return res;
  } catch (e) {
    // Audio thiếu file thì app tự chuyển sang giọng đọc máy, nên trả 404 là đủ.
    return new Response("", { status: 404, statusText: "Offline" });
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(request);
    if (hit) return hit;

    // Chưa từng mở trang này khi có mạng -> trả trang chủ đã cache.
    const home = await cache.match(BASE);
    if (home) return home;

    return new Response(
      "<!doctype html><meta charset='utf-8'><p style='font-family:system-ui;padding:2rem'>Bạn đang offline và trang này chưa được tải về máy.</p>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Khác gốc (ví dụ api.groq.com) -> để trình duyệt tự xử lý.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGE_CACHE));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});
