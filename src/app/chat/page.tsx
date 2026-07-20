"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AiError,
  FREE_CHAT_ID,
  ROLEPLAYS,
  sendChat,
  type ChatTurn,
  type RoleplayScenario,
} from "@/lib/groq";
import { appendActivity } from "@/lib/db";
import { toLocalDateString } from "@/lib/date";
import { playAudio } from "@/lib/audio";
import { useAppStore } from "@/lib/store";
import { useMounted } from "@/lib/useMounted";
import { Button, Card, Page, PageHeader, PlayButton } from "@/components/ui";

interface Bubble {
  who: "me" | "ai";
  en: string;
  /** Nhận xét tiếng Việt, chỉ có ở tin nhắn của AI */
  vi?: string;
}

export default function ChatPage() {
  const mounted = useMounted();
  const apiKey = useAppStore((s) => s.apiKey);
  const learnerName = useAppStore((s) => s.learnerName);

  const [scenario, setScenario] = useState<RoleplayScenario | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; detail: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles, busy]);

  const start = useCallback((s: RoleplayScenario) => {
    setScenario(s);
    setBubbles([{ who: "ai", en: s.opener }]);
    setError(null);
    setDraft("");
  }, []);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || !scenario || busy) return;

    setDraft("");
    setError(null);
    setBusy(true);

    const nextBubbles: Bubble[] = [...bubbles, { who: "me", en: text }];
    setBubbles(nextBubbles);

    // Chỉ gửi phần tiếng Anh lên API — nhận xét tiếng Việt là để người học đọc.
    const history: ChatTurn[] = nextBubbles.map((b) => ({
      role: b.who === "me" ? "user" : "assistant",
      content: b.en,
    }));

    try {
      const reply = await sendChat({ apiKey, scenario, learnerName, history });
      setBubbles((prev) => [...prev, { who: "ai", en: reply.en, vi: reply.vi }]);

      // Có ghi nhật ký để xem lại, nhưng CỐ Ý không gọi useCompleteActivity:
      // chat là luyện thêm, không nằm trong kế hoạch và không cộng streak.
      const now = new Date();
      await appendActivity({
        date: toLocalDateString(now),
        type: "chat",
        refId: scenario.id,
        count: 1,
        at: now.getTime(),
      });
    } catch (e) {
      if (e instanceof AiError) setError({ message: e.message, detail: e.detail });
      else setError({ message: "Có lỗi không xác định.", detail: String(e) });
      // Trả lại câu vừa gõ để người học không phải gõ lại.
      setDraft(text);
      setBubbles(bubbles);
    } finally {
      setBusy(false);
    }
  }, [draft, scenario, busy, bubbles, apiKey, learnerName]);

  const hasKey = mounted && apiKey.trim().length > 0;

  // ---- Màn chọn tình huống ----
  if (!scenario) {
    return (
      <>
        <PageHeader
          title="Chat với đồng nghiệp ảo"
          subtitle="Luyện thêm · không tính vào kế hoạch"
        />
        <Page>
          {mounted && !hasKey && (
            <Card className="mb-4 border-warning">
              <p className="text-sm font-medium">Cần API key miễn phí</p>
              <p className="mt-1 text-sm text-muted">
                Phần này gọi thẳng tới Groq từ máy bạn. Lấy key miễn phí ở{" "}
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  console.groq.com/keys
                </a>{" "}
                rồi dán vào Cài đặt. Key chỉ nằm trên máy bạn.
              </p>
              <Link href="/settings/">
                <Button variant="secondary" className="mt-3 w-full">
                  Mở Cài đặt
                </Button>
              </Link>
            </Card>
          )}

          {/* Chat tự do tách riêng một nhóm: không có bối cảnh, nói gì cũng được */}
          <h2 className="mb-2 font-semibold">Nói chuyện thoải mái</h2>
          <div className="mb-5 flex flex-col gap-2">
            {ROLEPLAYS.filter((r) => r.id === FREE_CHAT_ID).map((r) => (
              <button key={r.id} type="button" onClick={() => start(r)} className="text-left">
                <Card className="border-primary transition active:scale-[0.99]">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl leading-none">{r.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{r.titleVi}</p>
                      <p className="text-sm text-muted">
                        Không theo tình huống nào — bạn muốn nói chuyện gì cũng được.
                      </p>
                    </div>
                    <span className="text-muted">›</span>
                  </div>
                </Card>
              </button>
            ))}
          </div>

          <h2 className="mb-2 font-semibold">Hoặc luyện theo tình huống</h2>
          <div className="flex flex-col gap-2">
            {ROLEPLAYS.filter((r) => r.id !== FREE_CHAT_ID).map((r) => (
              <button key={r.id} type="button" onClick={() => start(r)} className="text-left">
                <Card className="transition active:scale-[0.99]">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl leading-none">{r.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{r.titleVi}</p>
                      <p className="truncate text-sm text-muted">{r.opener}</p>
                    </div>
                    <span className="text-muted">›</span>
                  </div>
                </Card>
              </button>
            ))}
          </div>

          <p className="mt-4 text-center text-xs text-muted">
            Đồng nghiệp ảo nói tiếng Anh đơn giản (A2–B1), trả lời ngắn và luôn hỏi
            lại bạn một câu.
          </p>
        </Page>
      </>
    );
  }

  // ---- Màn chat ----
  return (
    <>
      <PageHeader
        title={scenario.titleVi}
        subtitle="Chat với đồng nghiệp ảo"
        back
        right={
          <button
            type="button"
            onClick={() => setScenario(null)}
            className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs"
          >
            Đổi tình huống
          </button>
        }
      />

      <Page>
        <div className="flex flex-col gap-3">
          {bubbles.map((b, i) =>
            b.who === "me" ? (
              <div key={i} className="self-end max-w-[85%] rounded-2xl rounded-br-sm bg-primary p-3 text-primary-foreground">
                <p className="whitespace-pre-wrap">{b.en}</p>
              </div>
            ) : (
              <div key={i} className="max-w-[90%] self-start">
                <div className="rounded-2xl rounded-tl-sm bg-muted-bg p-3">
                  <p className="whitespace-pre-wrap">{b.en}</p>
                  <div className="mt-2">
                    <PlayButton onPlay={() => void playAudio({ text: b.en })} label="Nghe" />
                  </div>
                </div>
                {/* Nhận xét tiếng Việt tách hẳn khỏi lời thoại tiếng Anh */}
                {b.vi && (
                  <div className="mt-1.5 rounded-2xl border border-dashed border-border p-3">
                    <p className="text-xs font-medium text-accent">Nhận xét</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm">{b.vi}</p>
                  </div>
                )}
              </div>
            ),
          )}

          {busy && <p className="self-start text-sm text-muted">Đồng nghiệp đang gõ…</p>}
        </div>

        {error && (
          <Card className="mt-3 border-danger">
            <p className="text-sm font-medium text-danger">{error.message}</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted">
                Xem thông báo gốc (để chẩn đoán)
              </summary>
              <p className="mt-1 break-words font-mono text-xs text-muted">
                {error.detail}
              </p>
            </details>
          </Card>
        )}

        <div ref={bottomRef} />

        <div className="mt-4 flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            className="field flex-1"
            placeholder="Trả lời bằng tiếng Anh…"
            disabled={busy}
          />
          <Button onClick={() => void send()} disabled={busy || draft.trim().length === 0}>
            Gửi
          </Button>
        </div>

        {mounted && !hasKey && (
          <p className="mt-2 text-center text-xs text-danger">
            Chưa có API key —{" "}
            <Link href="/settings/" className="underline">
              thêm trong Cài đặt
            </Link>
          </p>
        )}
      </Page>
    </>
  );
}
