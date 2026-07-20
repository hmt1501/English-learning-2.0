"use client";

import Link from "next/link";
import { getDeck, getTopic } from "@/lib/content";
import { MODE_LIST } from "@/lib/modes";
import { topicProgress } from "@/lib/stats";
import { progressLabel, sessionKey } from "@/lib/session";
import { useWordStats } from "@/lib/useStats";
import { useSessions } from "@/lib/useSessions";
import { useMounted } from "@/lib/useMounted";
import { useAppStore } from "@/lib/store";
import { Card, Page, PageHeader, ProgressBar } from "@/components/ui";

/** Màn chọn 1 trong 3 cách học, kèm tiến độ riêng của từng cách. */
export function TopicModePicker({ topicId }: { topicId: string }) {
  const mounted = useMounted();
  const { stats, ready } = useWordStats();
  const { sessions } = useSessions();
  const wordsPerSession = useAppStore((s) => s.wordsPerSession);

  const topic = getTopic(topicId);
  const deck = getDeck(topicId);
  const ids = deck.map((c) => c.id);

  if (!topic) return null;

  return (
    <>
      <PageHeader
        title={`${topic.emoji} ${topic.titleVi}`}
        subtitle={`${deck.length} cụm từ · chọn cách học`}
        back
      />
      <Page>
        <div className="flex flex-col gap-3">
          {MODE_LIST.map((mode) => {
            const p =
              mounted && ready
                ? topicProgress(stats, mode.id, ids)
                : { mastered: 0, total: ids.length, ratio: 0 };

            // Buổi đang làm dở của đúng cách học này
            const doing = mounted
              ? progressLabel(sessions[sessionKey(topicId, mode.id)])
              : null;

            return (
              <Link key={mode.id} href={`/vocab/${topicId}/${mode.id}/`}>
                <Card className="transition active:scale-[0.99]">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none">{mode.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{mode.titleVi}</p>
                      <p className="mt-0.5 text-sm text-muted">{mode.descVi}</p>
                    </div>
                  </div>

                  {doing && (
                    <p className="mt-3 rounded-xl bg-muted-bg px-3 py-2 text-sm">
                      ↩️ Đang học dở {doing} câu — bấm để học tiếp
                    </p>
                  )}

                  <div className="mt-3">
                    <ProgressBar ratio={p.ratio} label={`${p.mastered}/${p.total}`} />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          Mỗi buổi {mounted ? wordsPerSession : "—"} câu · đổi được trong Cài đặt.
          <br />
          Coi như &ldquo;đã thuộc&rdquo; khi bạn trả lời đúng 2 lần.
        </p>
      </Page>
    </>
  );
}
