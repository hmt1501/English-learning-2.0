"use client";

import { getTopic, scenarios } from "@/lib/content";
import { LinkCard, Page, PageHeader } from "@/components/ui";

export default function ReplyListPage() {
  return (
    <>
      <PageHeader
        title="Trả lời tin nhắn"
        subtitle={`${scenarios.length} tình huống công sở`}
      />
      <Page>
        <div className="flex flex-col gap-2">
          {scenarios.map((s) => (
            <LinkCard
              key={s.id}
              href={`/reply/${s.id}/`}
              emoji={getTopic(s.topic)?.emoji ?? "💬"}
              title={s.titleVi}
              subtitle={s.situationVi}
            />
          ))}
        </div>
      </Page>
    </>
  );
}
