import { notFound } from "next/navigation";
import { dialogues } from "@/lib/content";
import { ShadowTrainer } from "./ShadowTrainer";

export function generateStaticParams() {
  return dialogues.map((d) => ({ id: d.id }));
}

export default async function ShadowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!dialogues.some((d) => d.id === id)) notFound();
  return <ShadowTrainer id={id} />;
}
