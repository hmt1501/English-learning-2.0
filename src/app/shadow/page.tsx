"use client";

import { dialogues, getTopic } from "@/lib/content";
import { LinkCard, Page, PageHeader } from "@/components/ui";

export default function ShadowListPage() {
  return (
    <>
      <PageHeader title="Nói theo" subtitle="Nghe câu mẫu, ghi âm rồi so lại" />
      <Page>
        <div className="flex flex-col gap-2">
          {dialogues.map((d) => (
            <LinkCard
              key={d.id}
              href={`/shadow/${d.id}/`}
              emoji={getTopic(d.topic)?.emoji ?? "🗣️"}
              title={d.titleVi}
              subtitle={`${d.lines.length} câu để luyện`}
            />
          ))}
        </div>
      </Page>
    </>
  );
}
