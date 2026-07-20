"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Hôm nay", emoji: "🏠" },
  { href: "/vocab/", label: "Từ vựng", emoji: "📚" },
  { href: "/listen/", label: "Nghe", emoji: "🎧" },
  { href: "/chat/", label: "Chat AI", emoji: "🤖" },
  { href: "/settings/", label: "Cài đặt", emoji: "⚙️" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href.replace(/\/$/, ""));

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[0.7rem] font-medium transition ${
                  active ? "text-primary" : "text-muted"
                }`}
              >
                <span className="text-xl leading-none" aria-hidden>
                  {tab.emoji}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
