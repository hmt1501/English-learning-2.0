"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getDialogue } from "@/lib/content";
import { playAudio, stopAudio } from "@/lib/audio";
import { useCompleteActivity } from "@/lib/useDaily";
import { Button, Card, Page, PageHeader, PlayButton } from "@/components/ui";

export function ListenPlayer({ id }: { id: string }) {
  const dialogue = getDialogue(id);
  const complete = useCompleteActivity();

  /**
   * answers[i] = lựa chọn của người học cho câu hỏi thứ i.
   * Khởi tạo ngay bằng hàm khởi tạo của useState — nội dung hội thoại là dữ
   * liệu tĩnh nên không cần effect để đồng bộ.
   */
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    dialogue ? dialogue.questions.map(() => null) : [],
  );
  const [playingLine, setPlayingLine] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  // Rời trang thì tắt tiếng, tránh audio chạy nền.
  useEffect(() => () => stopAudio(), []);

  const playLine = useCallback((lineId: string, src: string, text: string) => {
    setPlayingLine(lineId);
    void playAudio({ src, text });
  }, []);

  /** Phát lần lượt cả bài. */
  const playAll = useCallback(async () => {
    if (!dialogue) return;
    for (const line of dialogue.lines) {
      setPlayingLine(line.id);
      await playAudio({ src: line.audio, text: line.en });
      // Chờ một nhịp ngắn giữa các câu cho dễ nghe.
      await new Promise((r) => setTimeout(r, 400));
    }
    setPlayingLine(null);
  }, [dialogue]);

  const answered = answers.filter((a) => a !== null).length;
  const allAnswered = dialogue ? answered === dialogue.questions.length : false;
  const correctCount = dialogue
    ? dialogue.questions.reduce(
        (sum, q, i) => sum + (answers[i] === q.answerIndex ? 1 : 0),
        0,
      )
    : 0;

  const finish = useCallback(async () => {
    if (!dialogue) return;
    setFinished(true);
    stopAudio();
    await complete({
      activityId: `listen:${dialogue.id}`,
      type: "listen",
      refId: dialogue.id,
      count: dialogue.questions.length,
    });
  }, [dialogue, complete]);

  if (!dialogue) return null;

  return (
    <>
      <PageHeader title={dialogue.titleVi} subtitle="Nghe hội thoại" back />
      <Page>
        <Card className="mb-4">
          <p className="text-sm text-muted">{dialogue.summaryVi}</p>
          <div className="mt-3">
            <PlayButton onPlay={() => void playAll()} label="Phát cả bài" emoji="▶️" />
          </div>
        </Card>

        {/* Lời thoại hiện ngay từ đầu — đây là bài luyện nghe hiểu, không phải bài thi */}
        <h2 className="mb-2 font-semibold">Lời thoại</h2>
        <div className="mb-6 flex flex-col gap-2">
          {dialogue.lines.map((line) => (
            <Card
              key={line.id}
              className={playingLine === line.id ? "border-primary" : ""}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-primary">{line.speaker}</p>
                  <p className="mt-0.5">{line.en}</p>
                  <p className="mt-1 text-sm text-muted">{line.vi}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Nghe câu của ${line.speaker}`}
                  onClick={() => playLine(line.id, line.audio, line.en)}
                  className="shrink-0 rounded-full border border-border px-2.5 py-1.5 text-sm active:scale-95"
                >
                  🔊
                </button>
              </div>
            </Card>
          ))}
        </div>

        <h2 className="mb-2 font-semibold">
          Câu hỏi ({answered}/{dialogue.questions.length})
        </h2>
        <div className="flex flex-col gap-3">
          {dialogue.questions.map((q, qi) => {
            const picked = answers[qi];
            return (
              <Card key={q.id}>
                <p className="font-medium">
                  {qi + 1}. {q.questionVi}
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {q.options.map((opt, oi) => {
                    const isPicked = picked === oi;
                    const isRight = oi === q.answerIndex;
                    const showResult = picked !== null;

                    let style = "border-border";
                    if (showResult && isRight) style = "border-success text-success";
                    else if (showResult && isPicked) style = "border-danger text-danger";

                    return (
                      <button
                        key={oi}
                        type="button"
                        disabled={showResult}
                        onClick={() =>
                          setAnswers((prev) => {
                            const next = [...prev];
                            next[qi] = oi;
                            return next;
                          })
                        }
                        className={`rounded-xl border p-3 text-left text-sm transition active:scale-[0.99] disabled:opacity-100 ${style}`}
                      >
                        {opt}
                        {showResult && isRight && " ✅"}
                        {showResult && isPicked && !isRight && " ❌"}
                      </button>
                    );
                  })}
                </div>

                {picked !== null && (
                  <p className="mt-2 rounded-xl bg-muted-bg p-3 text-sm">
                    💡 {q.explainVi}
                  </p>
                )}
              </Card>
            );
          })}
        </div>

        {allAnswered && !finished && (
          <Button className="mt-4 w-full" onClick={() => void finish()}>
            Hoàn thành ({correctCount}/{dialogue.questions.length} đúng)
          </Button>
        )}

        {finished && (
          <Card className="mt-4 text-center">
            <p className="text-4xl">🎉</p>
            <p className="mt-2 font-semibold">
              Đúng {correctCount}/{dialogue.questions.length} câu
            </p>
            <p className="mt-1 text-sm text-muted">Đã ghi công vào kế hoạch hôm nay.</p>
            <div className="mt-3 flex gap-2">
              <Link href="/listen/" className="flex-1">
                <Button variant="secondary" className="w-full">
                  Bài khác
                </Button>
              </Link>
              <Link href="/" className="flex-1">
                <Button className="w-full">Về Hôm nay</Button>
              </Link>
            </div>
          </Card>
        )}
      </Page>
    </>
  );
}
