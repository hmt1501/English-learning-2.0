"use client";

import Link from "next/link";
import { formatDateVi } from "@/lib/date";
import { useDailyPlan } from "@/lib/useDaily";
import { useAppStore } from "@/lib/store";
import { useMounted } from "@/lib/useMounted";
import { Card, LinkCard, Page, PageHeader, ProgressBar } from "@/components/ui";

const LEVEL_LABEL: Record<number, string> = {
  20: "~20 phút",
  40: "~40 phút",
  60: "~60 phút",
};

export default function TodayPage() {
  const mounted = useMounted();
  const { today, plan, doneIds, ready, complete } = useDailyPlan();

  const learnerName = useAppStore((s) => s.learnerName);
  const streak = useAppStore((s) => s.streak);
  const bestStreak = useAppStore((s) => s.bestStreak);
  const level = useAppStore((s) => s.level);

  // Trước khi mount thì chưa có dữ liệu đã lưu -> render bản trung tính để
  // HTML tĩnh và HTML ở trình duyệt khớp nhau.
  const greeting = mounted && learnerName ? `Chào ${learnerName}!` : "Chào bạn!";
  const doneCount = doneIds.filter((id) => plan.some((a) => a.id === id)).length;

  return (
    <>
      <PageHeader
        title={greeting}
        subtitle={mounted && today ? formatDateVi(today) : "Kế hoạch học hôm nay"}
      />

      <Page>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Card className="text-center">
            <p className="text-3xl font-bold text-accent">
              {mounted ? streak : "–"}
              <span className="ml-1 text-lg">🔥</span>
            </p>
            <p className="mt-1 text-xs text-muted">Chuỗi ngày liên tiếp</p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-bold">{mounted ? bestStreak : "–"}</p>
            <p className="mt-1 text-xs text-muted">Kỷ lục của bạn</p>
          </Card>
        </div>

        <Card className="mb-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-semibold">Kế hoạch hôm nay</h2>
            <span className="text-xs text-muted">
              {mounted ? LEVEL_LABEL[level] : ""}
            </span>
          </div>

          {!ready || !mounted ? (
            <p className="py-2 text-sm text-muted">Đang tải kế hoạch…</p>
          ) : (
            <ProgressBar
              ratio={plan.length === 0 ? 0 : doneCount / plan.length}
              label={`${doneCount}/${plan.length}`}
            />
          )}

          {mounted && complete && (
            <p className="mt-3 rounded-xl bg-muted-bg p-3 text-sm">
              🎉 Bạn đã hoàn thành kế hoạch hôm nay. Muốn học thêm thì cứ chọn bất
              kỳ mục nào bên dưới nhé.
            </p>
          )}
        </Card>

        <div className="flex flex-col gap-2">
          {mounted &&
            ready &&
            plan.map((activity) => (
              <LinkCard
                key={activity.id}
                href={activity.href}
                emoji={ACTIVITY_EMOJI[activity.type]}
                title={activity.titleVi}
                subtitle={activity.subtitleVi}
                done={doneIds.includes(activity.id)}
                trailing={
                  <span className="shrink-0 text-xs text-muted">
                    {activity.estMinutes}′
                  </span>
                }
              />
            ))}
        </div>

        <h2 className="mb-2 mt-6 font-semibold">Luyện thêm</h2>
        <div className="flex flex-col gap-2">
          <LinkCard
            href="/shadow/"
            emoji="🗣️"
            title="Nói theo"
            subtitle="Nghe câu mẫu, ghi âm và so lại"
          />
          <LinkCard
            href="/reply/"
            emoji="💬"
            title="Trả lời tin nhắn"
            subtitle="Tập trả lời tin nhắn công việc"
          />
          <LinkCard
            href="/chat/"
            emoji="🤖"
            title="Chat với đồng nghiệp ảo"
            subtitle="Luyện tự do — không tính vào kế hoạch"
          />
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Dữ liệu học chỉ lưu trên máy bạn.{" "}
          <Link href="/settings/" className="underline">
            Nhớ sao lưu định kỳ
          </Link>
          .
        </p>
      </Page>
    </>
  );
}

const ACTIVITY_EMOJI: Record<string, string> = {
  vocab: "📚",
  listen: "🎧",
  shadow: "🗣️",
  reply: "💬",
};
