/**
 * basePath khi deploy lên GitHub Pages ở đường dẫn con (ví dụ "/english-learn").
 *
 * Next tự thêm basePath cho <Link> và cho router, NHƯNG không đụng tới các URL
 * tuyệt đối do ta tự viết (file audio, manifest, icon, service worker).
 * Mọi URL loại đó BẮT BUỘC đi qua withBase().
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBase(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${clean}`;
}
