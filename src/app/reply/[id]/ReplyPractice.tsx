"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { getScenario } from "@/lib/content";
import { playAudio } from "@/lib/audio";
import { useCompleteActivity } from "@/lib/useDaily";
import { Button, Card, Page, PageHeader, PlayButton } from "@/components/ui";

export function ReplyPractice({ id }: { id: string }) {
  const scenario = getScenario(id);
  const complete = useCompleteActivity();

  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [finished, setFinished] = useState(false);

  const finish = useCallback(async () => {
    if (!scenario) return;
    setFinished(true);
    await complete({
      activityId: `reply:${scenario.id}`,
      type: "reply",
      refId: scenario.id,
      count: 1,
    });
  }, [scenario, complete]);

  if (!scenario) return null;

  const passedCount = Object.values(checked).filter(Boolean).length;

  return (
    <>
      <PageHeader title={scenario.titleVi} subtitle="Trả lời tin nhắn" back />
      <Page>
        <Card className="mb-4">
          <p className="text-sm text-muted">{scenario.situationVi}</p>
        </Card>

        {/* Luồng tin nhắn đến */}
        <div className="mb-4 flex flex-col gap-2">
          {scenario.thread.map((msg, i) => (
            <div key={i} className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted-bg p-3">
              <p className="text-xs font-medium text-muted">{msg.from}</p>
              <p className="mt-0.5">{msg.text}</p>
            </div>
          ))}
        </div>

        {!submitted ? (
          <>
            <label className="block text-sm font-medium" htmlFor="draft">
              Câu trả lời của bạn (bằng tiếng Anh)
            </label>
            <textarea
              id="draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              className="field mt-1"
              placeholder="Type your reply here…"
            />

            <div className="mt-2 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowHints((v) => !v)}
              >
                {showHints ? "Ẩn gợi ý" : "💡 Xem gợi ý"}
              </Button>
              <Button
                className="flex-1"
                disabled={draft.trim().length === 0}
                onClick={() => setSubmitted(true)}
              >
                Xem câu mẫu
              </Button>
            </div>

            {showHints && (
              <Card className="mt-3">
                <p className="text-sm font-medium">Câu trả lời nên có:</p>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm text-muted">
                  {scenario.hints.map((h, i) => (
                    <li key={i}>• {h}</li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        ) : (
          <>
            <Card>
              <p className="text-xs uppercase tracking-wide text-muted">Bạn đã viết</p>
              <p className="mt-1 whitespace-pre-wrap">{draft}</p>
            </Card>

            <h2 className="mb-2 mt-4 font-semibold">Câu mẫu tham khảo</h2>
            <div className="flex flex-col gap-2">
              {scenario.modelAnswers.map((ans, i) => (
                <Card key={i}>
                  <p className="whitespace-pre-wrap">{ans}</p>
                  <div className="mt-2">
                    <PlayButton onPlay={() => void playAudio({ text: ans })} label="Nghe" />
                  </div>
                </Card>
              ))}
            </div>

            {/* Tự chấm theo tiêu chí — không có cách chấm tự động nào đủ tốt cho câu tự do */}
            <h2 className="mb-2 mt-4 font-semibold">Tự đánh giá</h2>
            <Card>
              <ul className="flex flex-col gap-2">
                {scenario.rubricVi.map((r, i) => (
                  <li key={i}>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!checked[i]}
                        onChange={(e) =>
                          setChecked((prev) => ({ ...prev, [i]: e.target.checked }))
                        }
                        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
                      />
                      <span>{r}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">
                Đạt {passedCount}/{scenario.rubricVi.length} tiêu chí
              </p>
            </Card>

            {scenario.srsCards.length > 0 && (
              <>
                <h2 className="mb-2 mt-4 font-semibold">Cụm từ đáng nhớ</h2>
                <div className="flex flex-col gap-2">
                  {scenario.srsCards.map((c) => (
                    <Card key={c.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{c.chunk}</p>
                          <p className="text-sm text-muted">{c.meaningVi}</p>
                        </div>
                        <PlayButton
                          onPlay={() => void playAudio({ src: c.audio, text: c.chunk })}
                          label=""
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {!finished ? (
              <Button className="mt-4 w-full" onClick={() => void finish()}>
                Hoàn thành
              </Button>
            ) : (
              <Card className="mt-4 text-center">
                <p className="text-4xl">🎉</p>
                <p className="mt-2 font-semibold">Đã ghi công vào kế hoạch hôm nay</p>
                <div className="mt-3 flex gap-2">
                  <Link href="/reply/" className="flex-1">
                    <Button variant="secondary" className="w-full">
                      Tình huống khác
                    </Button>
                  </Link>
                  <Link href="/" className="flex-1">
                    <Button className="w-full">Về Hôm nay</Button>
                  </Link>
                </div>
              </Card>
            )}
          </>
        )}
      </Page>
    </>
  );
}
