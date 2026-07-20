"use client";

import Link from "next/link";
import { topics, getDeck } from "@/lib/content";
import { topicProgress } from "@/lib/stats";
import { useWordStats } from "@/lib/useStats";
import { useMounted } from "@/lib/useMounted";
import { Card, Page, PageHeader, ProgressBar } from "@/components/ui";
import { MODE_LIST } from "@/lib/modes";

export default function VocabTopicsPage() {
  const mounted = useMounted();
  const { stats, ready } = useWordStats();

  return (
    <>
      <PageHeader title="Từ vựng" subtitle="8 chủ đề · 15 cụm từ mỗi chủ đề" />
      <Page>
        <div className="flex flex-col gap-3">
          {topics.map((topic) => {
            const deck = getDeck(topic.id);
            const ids = deck.map((c) => c.id);

            return (
              <Link key={topic.id} href={`/vocab/${topic.id}/`}>
                <Card className="transition active:scale-[0.99]">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-2xl leading-none">{topic.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{topic.titleVi}</p>
                      <p className="text-xs text-muted">{deck.length} cụm từ</p>
                    </div>
                    <span className="text-muted">›</span>
                  </div>

                  {/* Tiến độ hiển thị RIÊNG cho từng cách học */}
                  <div className="flex flex-col gap-1.5">
                    {MODE_LIST.map((mode) => {
                      const p =
                        mounted && ready
                          ? topicProgress(stats, mode.id, ids)
                          : { mastered: 0, total: ids.length, ratio: 0 };
                      return (
                        <div key={mode.id} className="flex items-center gap-2">
                          <span className="w-24 shrink-0 text-xs text-muted">
                            {mode.shortVi}
                          </span>
                          <div className="flex-1">
                            <ProgressBar
                              ratio={p.ratio}
                              label={`${p.mastered}/${p.total}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </Page>
    </>
  );
}
