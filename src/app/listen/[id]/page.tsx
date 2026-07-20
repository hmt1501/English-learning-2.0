import { notFound } from "next/navigation";
import { dialogues } from "@/lib/content";
import { ListenPlayer } from "./ListenPlayer";

export function generateStaticParams() {
  return dialogues.map((d) => ({ id: d.id }));
}

export default async function ListenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!dialogues.some((d) => d.id === id)) notFound();
  return <ListenPlayer id={id} />;
}
