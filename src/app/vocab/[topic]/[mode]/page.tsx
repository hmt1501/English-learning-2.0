import { notFound } from "next/navigation";
import { topics } from "@/lib/content";
import { MODE_IDS } from "@/lib/modes";
import { StudySession } from "./StudySession";
import type { StudyMode } from "@/lib/grade";

/** Xuất tĩnh: 8 chủ đề × 3 cách học = 24 trang được sinh sẵn. */
export function generateStaticParams() {
  return topics.flatMap((t) => MODE_IDS.map((mode) => ({ topic: t.id, mode })));
}

export default async function StudyPage({
  params,
}: {
  params: Promise<{ topic: string; mode: string }>;
}) {
  const { topic, mode } = await params;
  if (!topics.some((t) => t.id === topic)) notFound();
  if (!MODE_IDS.includes(mode as StudyMode)) notFound();

  return <StudySession topicId={topic} mode={mode as StudyMode} />;
}
