import { notFound } from "next/navigation";
import { topics } from "@/lib/content";
import { TopicModePicker } from "./TopicModePicker";

/** Xuất tĩnh: liệt kê trước mọi chủ đề để Next sinh sẵn từng trang. */
export function generateStaticParams() {
  return topics.map((t) => ({ topic: t.id }));
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  if (!topics.some((t) => t.id === topic)) notFound();
  return <TopicModePicker topicId={topic} />;
}
