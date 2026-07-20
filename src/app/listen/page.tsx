"use client";

import { dialogues, getTopic } from "@/lib/content";
import { LinkCard, Page, PageHeader } from "@/components/ui";

export default function ListenListPage() {
  return (
    <>
      <PageHeader title="Nghe" subtitle={`${dialogues.length} hội thoại công sở`} />
      <Page>
        <div className="flex flex-col gap-2">
          {dialogues.map((d) => (
            <LinkCard
              key={d.id}
              href={`/listen/${d.id}/`}
              emoji={getTopic(d.topic)?.emoji ?? "🎧"}
              title={d.titleVi}
              subtitle={`${d.lines.length} lời thoại · ${d.questions.length} câu hỏi`}
            />
          ))}
        </div>
      </Page>
    </>
  );
}
