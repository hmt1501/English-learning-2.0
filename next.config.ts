import type { NextConfig } from "next";

/**
 * Đường dẫn con khi deploy lên GitHub Pages (ví dụ "/english-learn").
 * Workflow deploy sẽ set biến này từ tên repo, nên đổi tên repo vẫn chạy đúng.
 * Khi chạy dev ở máy thì biến rỗng => app nằm ở "/".
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Xuất tĩnh hoàn toàn: không có server code, không API route.
  output: "export",
  basePath,
  // GitHub Pages phục vụ file tĩnh nên cần thư mục + index.html cho mỗi route.
  trailingSlash: true,
  images: {
    // Không có server để tối ưu ảnh khi export tĩnh.
    unoptimized: true,
  },
  typedRoutes: false,
};

export default nextConfig;
