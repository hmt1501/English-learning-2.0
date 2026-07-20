import { notFound } from "next/navigation";
import { scenarios } from "@/lib/content";
import { ReplyPractice } from "./ReplyPractice";

export function generateStaticParams() {
  return scenarios.map((s) => ({ id: s.id }));
}

export default async function ReplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!scenarios.some((s) => s.id === id)) notFound();
  return <ReplyPractice id={id} />;
}
