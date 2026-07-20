"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getDeck, getTopic } from "@/lib/content";
import { getMode } from "@/lib/modes";
import { gradeAnswer, isPass, VERDICT_LABEL, type StudyMode, type Verdict } from "@/lib/grade";
import { pickSessionCards } from "@/lib/stats";
import { clearSession, loadSessions, loadWordStats, saveSession } from "@/lib/db";
import {
  advanceCheckpoint,
  createCheckpoint,
  isResumable,
  reviseCheckpoint,
  sessionKey,
  type SessionCheckpoint,
} from "@/lib/session";
import { toLocalDateString } from "@/lib/date";
import { playAudio } from "@/lib/audio";
import { useWordStats } from "@/lib/useStats";
import { useMounted } from "@/lib/useMounted";
import { useAppStore } from "@/lib/store";
import { useCompleteActivity } from "@/lib/useDaily";
import { Button, Card, Page, PageHeader, PlayButton, ProgressBar } from "@/components/ui";
import type { Card as CardType } from "@/lib/content-schema";

/**
 * "learn" chỉ có bước xem thẻ (không kiểm tra); hai chế độ dịch có thêm bước
 * trả lời và xem kết quả.
 */
type Phase = "preview" | "answer" | "result" | "done";

const VERDICT_STYLE: Record<Verdict, string> = {
  correct: "border-success text-success",
  close: "border-warning text-warning",
  wrong: "border-danger text-danger",
};

const VERDICT_EMOJI: Record<Verdict, string> = {
  correct: "✅",
  close: "🟡",
  wrong: "❌",
};

export function StudySession({ topicId, mode }: { topicId: string; mode: StudyMode }) {
  const mounted = useMounted();
  const { record, revise } = useWordStats();
  const wordsPerSession = useAppStore((s) => s.wordsPerSession);
  const complete = useCompleteActivity();

  const topic = getTopic(topicId);
  const modeInfo = getMode(mode);
  const deck = useMemo(() => getDeck(topicId), [topicId]);
  const key = sessionKey(topicId, mode);

  const [cards, setCards] = useState<CardType[] | null>(null);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [resumed, setResumed] = useState(false);

  const [phase, setPhase] = useState<Phase>(mode === "learn" ? "preview" : "answer");
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /** Checkpoint hiện tại, chỉ đọc/ghi trong handler nên dùng ref là hợp lệ. */
  const cpRef = useRef<SessionCheckpoint | null>(null);

  /**
   * Vào trang: nối tiếp buổi đang dở nếu có, không thì chốt bộ thẻ mới.
   * setState nằm trong callback bất đồng bộ nên hợp quy tắc React Compiler.
   */
  useEffect(() => {
    let alive = true;

    (async () => {
      const [stats, sessions] = await Promise.all([loadWordStats(), loadSessions()]);
      if (!alive) return;

      const validIds = new Set(deck.map((c) => c.id));
      const saved = sessions[key];

      if (isResumable(saved, validIds)) {
        const byId = new Map(deck.map((c) => [c.id, c]));
        const resumedCards = saved.cardIds
          .map((id) => byId.get(id))
          .filter((c): c is CardType => c !== undefined);

        cpRef.current = saved;
        setCards(resumedCards);
        setIndex(saved.index);
        setCorrectCount(saved.correctCount);
        setResumed(true);
        setPhase(mode === "learn" ? "preview" : "answer");
        return;
      }

      const picked = pickSessionCards(deck, stats, mode, wordsPerSession);
      cpRef.current = createCheckpoint(
        picked.map((c) => c.id),
        toLocalDateString(new Date()),
        Date.now(),
      );
      setCards(picked);
      setIndex(0);
      setCorrectCount(0);
    })();

    return () => {
      alive = false;
    };
  }, [deck, key, mode, wordsPerSession]);

  const card = cards?.[index];
  const total = cards?.length ?? 0;
  const prompt = card ? promptFor(card, mode) : null;

  const play = useCallback(() => {
    if (!card) return;
    void playAudio({
      src: card.audio,
      text: mode === "learn" ? card.chunk : card.example,
    });
  }, [card, mode]);

  /** Ghi checkpoint NGAY sau mỗi câu — thoát giữa chừng vẫn giữ được. */
  const commitProgress = useCallback(
    async (passed: boolean) => {
      const cp = cpRef.current;
      if (!cp) return;
      const next = advanceCheckpoint(cp, passed, Date.now());
      cpRef.current = next;
      await saveSession(key, next);
    },
    [key],
  );

  /** Chế độ "Học từ vựng": chỉ xem thẻ rồi sang từ tiếp theo, không kiểm tra. */
  const nextWord = useCallback(async () => {
    if (!card) return;

    await record(mode, card.id, true);
    await commitProgress(true);
    setCorrectCount((c) => c + 1);

    if (index >= total - 1) {
      setPhase("done");
      await clearSession(key);
      await complete({
        activityId: `vocab:${topicId}:${mode}`,
        type: "vocab",
        refId: topicId,
        count: total,
      });
      return;
    }
    setIndex((i) => i + 1);
  }, [card, mode, record, commitProgress, index, total, key, complete, topicId]);

  const submit = useCallback(async () => {
    if (!card || !prompt) return;
    const result = gradeAnswer(answer, prompt.expected, mode);
    const passed = isPass(result.verdict);

    setVerdict(result.verdict);
    setPhase("result");
    if (passed) setCorrectCount((c) => c + 1);

    await record(mode, card.id, passed);
    await commitProgress(passed);
  }, [answer, card, prompt, mode, record, commitProgress]);

  /** Người học tự chấm lại kết quả của chính mình. */
  const selfGrade = useCallback(
    async (passed: boolean) => {
      if (!card || verdict === null) return;
      if (isPass(verdict) === passed) return;

      setCorrectCount((c) => c + (passed ? 1 : -1));
      setVerdict(passed ? "correct" : "wrong");

      await revise(mode, card.id, passed);
      if (cpRef.current) {
        const next = reviseCheckpoint(cpRef.current, passed, Date.now());
        cpRef.current = next;
        await saveSession(key, next);
      }
    },
    [card, verdict, mode, revise, key],
  );

  const next = useCallback(async () => {
    setAnswer("");
    setVerdict(null);

    if (index >= total - 1) {
      setPhase("done");
      await clearSession(key);
      await complete({
        activityId: `vocab:${topicId}:${mode}`,
        type: "vocab",
        refId: topicId,
        count: total,
      });
      return;
    }

    setIndex((i) => i + 1);
    setPhase("answer");
  }, [index, total, key, complete, topicId, mode]);

  // Tự đưa con trỏ vào ô nhập khi sang câu mới.
  useEffect(() => {
    if (phase === "answer") inputRef.current?.focus();
  }, [phase, index]);

  if (!topic || !modeInfo) return null;

  if (!mounted || !cards) {
    return (
      <>
        <PageHeader title={modeInfo.titleVi} subtitle={topic.titleVi} back />
        <Page>
          <p className="text-sm text-muted">Đang chuẩn bị buổi học…</p>
        </Page>
      </>
    );
  }

  if (total === 0) {
    return (
      <>
        <PageHeader title={modeInfo.titleVi} subtitle={topic.titleVi} back />
        <Page>
          <Card>
            <p className="text-sm">Chủ đề này chưa có thẻ nào.</p>
          </Card>
        </Page>
      </>
    );
  }

  if (phase === "done") {
    return (
      <>
        <PageHeader title="Xong buổi học" subtitle={topic.titleVi} back />
        <Page>
          <Card className="text-center">
            <p className="text-5xl">🎉</p>
            <p className="mt-3 text-lg font-semibold">
              {mode === "learn"
                ? `Đã xem ${total}/${total} cụm từ`
                : `Đúng ${correctCount}/${total} câu`}
            </p>
            <p className="mt-1 text-sm text-muted">
              Tiến độ đã được lưu và ghi công vào kế hoạch hôm nay.
            </p>
          </Card>

          <div className="mt-4 flex flex-col gap-2">
            <Link href={`/vocab/${topicId}/`}>
              <Button variant="secondary" className="w-full">
                Chọn cách học khác
              </Button>
            </Link>
            <Link href="/">
              <Button className="w-full">Về trang Hôm nay</Button>
            </Link>
          </div>
        </Page>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={modeInfo.titleVi}
        subtitle={`${topic.emoji} ${topic.titleVi}`}
        back
      />
      <Page>
        <div className="mb-4">
          <ProgressBar ratio={index / total} label={`${index + 1}/${total}`} />
        </div>

        {resumed && index > 0 && (
          <p className="mb-3 rounded-xl bg-muted-bg p-3 text-sm">
            ↩️ Học tiếp buổi đang dở — bạn đã làm {index}/{total} câu.
          </p>
        )}

        {/* ---- Chế độ Học từ vựng: chỉ xem thẻ, nghe, rồi sang từ tiếp ---- */}
        {phase === "preview" && card && (
          <>
            <Card>
              <p className="text-xs uppercase tracking-wide text-muted">Cụm từ</p>
              <p className="mt-1 text-2xl font-bold">{card.chunk}</p>
              <p className="mt-2 text-lg">{card.meaningVi}</p>

              <div className="mt-4 border-t border-border pt-3">
                <p className="text-sm italic">{card.example}</p>
                <p className="mt-1 text-sm text-muted">{card.exampleVi}</p>
              </div>

              <p className="mt-3 rounded-xl bg-muted-bg p-3 text-sm">💡 {card.cue}</p>

              <div className="mt-3">
                <PlayButton onPlay={play} label="Nghe" />
              </div>
            </Card>

            <Button className="mt-4 w-full" onClick={() => void nextWord()}>
              {index >= total - 1 ? "Kết thúc buổi học" : "Từ tiếp theo"}
            </Button>
          </>
        )}

        {/* ---- Bước trả lời (chỉ có ở hai chế độ dịch câu) ---- */}
        {phase === "answer" && card && prompt && (
          <>
            <Card>
              <p className="text-xs uppercase tracking-wide text-muted">
                {prompt.labelVi}
              </p>
              <p className="mt-1 text-xl font-semibold">{prompt.text}</p>
              {prompt.playable && (
                <div className="mt-3">
                  <PlayButton onPlay={play} />
                </div>
              )}
            </Card>

            <label className="mt-4 block text-sm font-medium" htmlFor="answer">
              {prompt.inputLabelVi}
            </label>
            <textarea
              id="answer"
              ref={inputRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              rows={3}
              className="field mt-1"
              placeholder={prompt.placeholderVi}
            />

            <Button className="mt-3 w-full" onClick={() => void submit()}>
              Kiểm tra
            </Button>
            <p className="mt-2 text-center text-xs text-muted">
              Không cần gõ dấu tiếng Việt — chấm khá thoáng.
            </p>
          </>
        )}

        {/* ---- Bước xem kết quả ---- */}
        {phase === "result" && card && prompt && verdict && (
          <>
            <Card className={`border-2 ${VERDICT_STYLE[verdict]}`}>
              <p className="text-lg font-bold">
                {VERDICT_EMOJI[verdict]} {VERDICT_LABEL[verdict]}
              </p>
              {answer.trim() && (
                <p className="mt-2 text-sm text-muted">Bạn viết: {answer.trim()}</p>
              )}
            </Card>

            {/* Luôn hiện đáp án mẫu đầy đủ */}
            <Card className="mt-3">
              <p className="text-xs uppercase tracking-wide text-muted">Đáp án mẫu</p>
              <p className="mt-1 text-lg font-semibold">{prompt.expected}</p>

              <div className="mt-3 border-t border-border pt-3 text-sm">
                <p className="font-medium">{card.chunk}</p>
                <p className="text-muted">{card.meaningVi}</p>
                <p className="mt-2 italic">{card.example}</p>
                <p className="text-muted">{card.exampleVi}</p>
              </div>

              <div className="mt-3">
                <PlayButton onPlay={play} />
              </div>
            </Card>

            {/* Tự chấm lại: máy chấm offline nên đôi khi khắt khe hoặc dễ dãi */}
            <Card className="mt-3">
              <p className="text-sm font-medium">Bạn thấy máy chấm chưa đúng?</p>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={verdict === "correct"}
                  onClick={() => void selfGrade(true)}
                >
                  ✅ Tính là đúng
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={verdict === "wrong"}
                  onClick={() => void selfGrade(false)}
                >
                  ❌ Tính là sai
                </Button>
              </div>
            </Card>

            <Button className="mt-4 w-full" onClick={() => void next()}>
              {index >= total - 1 ? "Kết thúc buổi học" : "Câu tiếp theo"}
            </Button>
          </>
        )}
      </Page>
    </>
  );
}

interface Prompt {
  labelVi: string;
  text: string;
  expected: string;
  playable: boolean;
  inputLabelVi: string;
  placeholderVi: string;
}

/** Mỗi chế độ hỏi một kiểu khác nhau. */
function promptFor(card: CardType, mode: StudyMode): Prompt {
  if (mode === "learn") {
    return {
      labelVi: "Cụm từ tiếng Anh",
      text: card.chunk,
      expected: card.meaningVi,
      playable: true,
      inputLabelVi: "Nghĩa tiếng Việt là gì?",
      placeholderVi: "Gõ nghĩa tiếng Việt…",
    };
  }

  if (mode === "en2vi") {
    return {
      labelVi: "Câu tiếng Anh",
      text: card.example,
      expected: card.exampleVi,
      playable: true,
      inputLabelVi: "Dịch sang tiếng Việt",
      placeholderVi: "Gõ bản dịch tiếng Việt…",
    };
  }

  return {
    labelVi: "Câu tiếng Việt",
    text: card.exampleVi,
    expected: card.example,
    playable: false,
    inputLabelVi: "Dịch sang tiếng Anh",
    placeholderVi: "Type the English sentence…",
  };
}
