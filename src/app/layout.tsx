import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { withBase } from "@/lib/basePath";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tiếng Anh Công Sở",
  description: "Học tiếng Anh giao tiếp nơi công sở, mỗi ngày một chút.",
  manifest: withBase("/manifest.webmanifest"),
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tiếng Anh Công Sở",
  },
  icons: {
    icon: withBase("/icons/icon-192.png"),
    apple: withBase("/icons/icon-192.png"),
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        {children}
        <BottomNav />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
