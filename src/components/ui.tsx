"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** Header của trang: nút quay lại + tiêu đề + phụ đề. */
export function PageHeader({
  title,
  subtitle,
  back = false,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
}) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
      <div className="flex items-center gap-3">
        {back && (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Quay lại"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-card text-lg leading-none active:scale-95"
          >
            ←
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{title}</h1>
          {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-4 text-card-foreground ${className}`}
    >
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_STYLE: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground",
  secondary: "border border-border bg-card text-card-foreground",
  ghost: "text-muted",
  danger: "bg-danger text-white",
};

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-3 text-base font-semibold transition active:scale-[0.98] disabled:opacity-40 ${BUTTON_STYLE[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/** Thanh tiến độ ngang. */
export function ProgressBar({ ratio, label }: { ratio: number; label?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted-bg">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted">
        {label ?? `${pct}%`}
      </span>
    </div>
  );
}

/** Thẻ dẫn tới một mục nội dung. */
export function LinkCard({
  href,
  emoji,
  title,
  subtitle,
  trailing,
  done = false,
}: {
  href: string;
  emoji?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  done?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition active:scale-[0.99]"
    >
      {emoji && <span className="text-2xl leading-none">{emoji}</span>}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">{title}</span>
          {done && <span aria-label="đã hoàn thành">✅</span>}
        </span>
        {subtitle && <span className="mt-0.5 block truncate text-sm text-muted">{subtitle}</span>}
      </span>
      {trailing ?? <span className="shrink-0 text-muted">›</span>}
    </Link>
  );
}

/** Nút phát audio nhỏ. */
export function PlayButton({
  onPlay,
  label = "Nghe",
  emoji = "🔊",
}: {
  onPlay: () => void;
  label?: string;
  emoji?: string;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium active:scale-95"
    >
      <span aria-hidden>{emoji}</span>
      {label}
    </button>
  );
}

/** Khối nội dung chính của trang, có lề chuẩn. */
export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-xl px-4 py-4">{children}</main>;
}

export function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
      {text}
    </p>
  );
}
