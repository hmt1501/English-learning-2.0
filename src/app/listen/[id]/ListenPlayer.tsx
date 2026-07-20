"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getDialogue } from "@/lib/content";
import { playAudio, playAudioUntilEnd, stopAudio } from "@/lib/audio";
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
  const [playingAll, setPlayingAll] = useState(false);
  const [finished, setFinished] = useState(false);

  /**
   * Lời thoại ẩn mặc định: nghe trước đã, cần thì mới mở ra đối chiếu.
   * Nghe mà nhìn chữ ngay thì thành bài đọc mất.
   */
  const [showScript, setShowScript] = useState(false);

  /** Cờ dừng cho vòng phát cả bài — chỉ đọc trong handler, không đọc lúc render. */
  const cancelRef = useRef(false);

  // Rời trang thì tắt tiếng, tránh audio chạy nền.
  useEffect(
    () => () => {
      cancelRef.current = true;
      stopAudio();
    },
    [],
  );

  const playLine = useCallback((lineId: string, src: string, text: string) => {
    cancelRef.current = true; // dừng vòng phát cả bài nếu đang chạy
    setPlayingAll(false);
    setPlayingLine(lineId);
    void playAudio({ src, text });
  }, []);

  const stopAll = useCallback(() => {
    cancelRef.current = true;
    stopAudio();
    setPlayingAll(false);
    setPlayingLine(null);
  }, []);

  /**
   * Phát lần lượt cả bài — CHỜ từng câu phát xong mới sang câu sau.
   * (playAudio() thường resolve ngay khi bắt đầu phát, không dùng được ở đây.)
   */
  const playAll = useCallback(async () => {
    if (!dialogue) return;

    cancelRef.current = false;
    setPlayingAll(true);

    for (const line of dialogue.lines) {
      if (cancelRef.current) break;
      setPlayingLine(line.id);
      await playAudioUntilEnd({ src: line.audio, text: line.en });
      if (cancelRef.current) break;
      // Nghỉ một nhịp ngắn giữa hai lượt nói cho dễ theo.
      await new Promise((r) => setTimeout(r, 350));
    }

    setPlayingAll(false);
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
    stopAll();
    setFinished(true);
    await complete({
      activityId: `listen:${dialogue.id}`,
      type: "listen",
      refId: dialogue.id,
      count: dialogue.questions.length,
    });
  }, [dialogue, complete, stopAll]);

  if (!dialogue) return null;

  return (
    <>
      <PageHeader title={dialogue.titleVi} subtitle="Nghe hội thoại" back />
      <Page>
        <Card className="mb-4">
          <p className="text-sm text-muted">{dialogue.summaryVi}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!playingAll ? (
              <PlayButton onPlay={() => void playAll()} label="Phát cả bài" emoji="▶️" />
            ) : (
              <PlayButton onPlay={stopAll} label="Dừng" emoji="⏹️" />
            )}
            <PlayButton
              onPlay={() => setShowScript((v) => !v)}
              label={showScript ? "Ẩn lời thoại" : "Hiện lời thoại"}
              emoji={showScript ? "🙈" : "👀"}
            />
          </div>
        </Card>

        <h2 className="mb-2 font-semibold">Lời thoại</h2>

        {!showScript && (
          <p className="mb-3 rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">
            Lời thoại đang ẩn. Nghe trước rồi bấm{" "}
            <span className="font-medium">Hiện lời thoại</span> để đối chiếu nhé.
          </p>
        )}

        <div className="mb-6 flex flex-col gap-2">
          {dialogue.lines.map((line, i) => (
            <Card
              key={line.id}
              className={playingLine === line.id ? "border-primary" : ""}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-primary">
                    {line.speaker}
                    {!showScript && (
                      <span className="ml-1 font-normal text-muted">· câu {i + 1}</span>
                    )}
                  </p>

                  {/* Ẩn phần chữ nhưng vẫn giữ nút nghe từng câu */}
                  {showScript ? (
                    <>
                      <p className="mt-0.5">{line.en}</p>
                      <p className="mt-1 text-sm text-muted">{line.vi}</p>
                    </>
                  ) : (
                    <p className="mt-1 select-none text-muted" aria-hidden>
                      ● ● ● ● ●
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  aria-label={`Nghe câu ${i + 1} của ${line.speaker}`}
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
