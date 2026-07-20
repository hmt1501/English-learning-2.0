"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getDialogue } from "@/lib/content";
import { playAudio, playSlow, stopAudio } from "@/lib/audio";
import { VoiceRecorder } from "@/lib/recorder";
import { useCompleteActivity } from "@/lib/useDaily";
import { useMounted } from "@/lib/useMounted";
import { Button, Card, Page, PageHeader, PlayButton, ProgressBar } from "@/components/ui";

type SelfScore = "good" | "again";

export function ShadowTrainer({ id }: { id: string }) {
  const mounted = useMounted();
  const dialogue = getDialogue(id);
  const complete = useCompleteActivity();

  const [index, setIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [myAudio, setMyAudio] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, SelfScore>>({});
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  // Khởi tạo LƯỜI trong event handler, không đụng vào ref lúc render
  // (React Compiler cấm đọc/ghi ref khi render).
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const getRecorder = useCallback(() => {
    recorderRef.current ??= new VoiceRecorder();
    return recorderRef.current;
  }, []);

  const line = dialogue?.lines[index];
  const total = dialogue?.lines.length ?? 0;

  /** Thu hồi blob URL cũ để không rò bộ nhớ. */
  const clearMyAudio = useCallback(() => {
    setMyAudio((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  useEffect(
    () => () => {
      stopAudio();
      recorderRef.current?.stop();
    },
    [],
  );

  const startRec = useCallback(async () => {
    setError(null);
    clearMyAudio();
    stopAudio();
    try {
      await getRecorder().start();
      setRecording(true);
    } catch {
      setError(
        "Không truy cập được micro. Bạn hãy cho phép quyền micro trong trình duyệt rồi thử lại nhé.",
      );
    }
  }, [clearMyAudio, getRecorder]);

  const stopRec = useCallback(async () => {
    setRecording(false);
    const rec = await getRecorder().stopAndGet();
    if (rec) setMyAudio(rec.url);
  }, [getRecorder]);

  const score = useCallback(
    (value: SelfScore) => {
      if (!line) return;
      setScores((prev) => ({ ...prev, [line.id]: value }));
    },
    [line],
  );

  const goNext = useCallback(async () => {
    clearMyAudio();
    stopAudio();

    if (index >= total - 1) {
      setFinished(true);
      if (dialogue) {
        await complete({
          activityId: `shadow:${dialogue.id}`,
          type: "shadow",
          refId: dialogue.id,
          count: total,
        });
      }
      return;
    }
    setIndex((i) => i + 1);
  }, [index, total, dialogue, complete, clearMyAudio]);

  if (!dialogue) return null;

  const supported = mounted && VoiceRecorder.isSupported();
  const goodCount = Object.values(scores).filter((s) => s === "good").length;

  if (finished) {
    return (
      <>
        <PageHeader title="Xong bài nói theo" subtitle={dialogue.titleVi} back />
        <Page>
          <Card className="text-center">
            <p className="text-5xl">🎉</p>
            <p className="mt-3 font-semibold">
              Bạn thấy ổn ở {goodCount}/{total} câu
            </p>
            <p className="mt-1 text-sm text-muted">Đã ghi công vào kế hoạch hôm nay.</p>
          </Card>
          <div className="mt-4 flex gap-2">
            <Link href="/shadow/" className="flex-1">
              <Button variant="secondary" className="w-full">
                Bài khác
              </Button>
            </Link>
            <Link href="/" className="flex-1">
              <Button className="w-full">Về Hôm nay</Button>
            </Link>
          </div>
        </Page>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Nói theo" subtitle={dialogue.titleVi} back />
      <Page>
        <div className="mb-4">
          <ProgressBar ratio={index / total} label={`${index + 1}/${total}`} />
        </div>

        {line && (
          <Card>
            <p className="text-xs font-medium text-primary">{line.speaker}</p>
            <p className="mt-1 text-xl font-semibold">{line.en}</p>
            <p className="mt-2 text-sm text-muted">{line.vi}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <PlayButton
                onPlay={() => void playAudio({ src: line.audio, text: line.en })}
                label="Nghe mẫu"
              />
              <PlayButton
                onPlay={() => void playSlow({ src: line.audio, text: line.en })}
                label="Nghe chậm"
                emoji="🐢"
              />
            </div>
          </Card>
        )}

        <Card className="mt-3">
          <p className="font-semibold">Đến lượt bạn</p>

          {!supported && (
            <p className="mt-2 text-sm text-muted">
              Trình duyệt này không hỗ trợ ghi âm. Bạn vẫn có thể nghe mẫu và nói
              theo, chỉ là không nghe lại được giọng mình.
            </p>
          )}

          {supported && (
            <>
              <div className="mt-3 flex gap-2">
                {!recording ? (
                  <Button className="flex-1" onClick={() => void startRec()}>
                    🎙️ Bắt đầu ghi âm
                  </Button>
                ) : (
                  <Button variant="danger" className="flex-1" onClick={() => void stopRec()}>
                    ⏹️ Dừng ghi âm
                  </Button>
                )}
              </div>

              {recording && (
                <p className="mt-2 text-center text-sm text-danger">
                  ● Đang ghi… hãy đọc to câu bên trên
                </p>
              )}

              {error && <p className="mt-2 text-sm text-danger">{error}</p>}

              {myAudio && (
                <div className="mt-3">
                  <p className="mb-1 text-sm font-medium">Giọng của bạn</p>
                          <audio src={myAudio} controls className="w-full" />
                  {line && (
                    <div className="mt-2">
                      <PlayButton
                        onPlay={() => void playAudio({ src: line.audio, text: line.en })}
                        label="Nghe lại mẫu để so"
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Card>

        {/* Không có cách nào chấm phát âm offline cho đúng, nên để người học tự chấm */}
        <Card className="mt-3">
          <p className="text-sm font-medium">Bạn tự thấy thế nào?</p>
          <div className="mt-2 flex gap-2">
            <Button
              variant={line && scores[line.id] === "good" ? "primary" : "secondary"}
              className="flex-1"
              onClick={() => score("good")}
            >
              👍 Ổn rồi
            </Button>
            <Button
              variant={line && scores[line.id] === "again" ? "primary" : "secondary"}
              className="flex-1"
              onClick={() => score("again")}
            >
              🔁 Cần tập thêm
            </Button>
          </div>
        </Card>

        <Button className="mt-4 w-full" onClick={() => void goNext()}>
          {index >= total - 1 ? "Kết thúc" : "Câu tiếp theo"}
        </Button>
      </Page>
    </>
  );
}
