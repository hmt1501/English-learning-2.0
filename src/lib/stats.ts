/**
 * Thống kê từng thẻ theo TỪNG CHẾ ĐỘ HỌC.
 *
 * Quan trọng: cùng một thẻ nhưng học ở 3 chế độ khác nhau là 3 kỹ năng khác
 * nhau (nhớ nghĩa / dịch xuôi / dịch ngược), nên tiến độ phải tách riêng.
 * Quy ước khoá:
 *   - "learn" (học từ vựng): dùng cardId trần  -> "greetings-01"
 *   - "en2vi": "en2vi:greetings-01"
 *   - "vi2en": "vi2en:greetings-01"
 * Khoá trần cho "learn" là cố ý, để tương thích với dữ liệu đã lưu từ trước.
 *
 * Logic thuần, có unit test.
 */
import type { StudyMode } from "./grade";

export interface WordStat {
  correct: number;
  wrong: number;
  /** Mốc thời gian (epoch ms) lần gần nhất gặp thẻ này. */
  lastSeen: number;
}

export type WordStats = Record<string, WordStat>;

/** Số lần trả lời đúng để coi là "đã thuộc". */
export const MASTERY_THRESHOLD = 2;

export function statKey(mode: StudyMode, cardId: string): string {
  return mode === "learn" ? cardId : `${mode}:${cardId}`;
}

export function emptyStat(): WordStat {
  return { correct: 0, wrong: 0, lastSeen: 0 };
}

export function isMastered(stat: WordStat | undefined): boolean {
  return (stat?.correct ?? 0) >= MASTERY_THRESHOLD;
}

/**
 * Trả về BẢN SAO mới của stats sau khi ghi nhận một lần trả lời.
 * Không sửa tại chỗ để dễ dùng với React state.
 */
export function recordAnswer(
  stats: WordStats,
  mode: StudyMode,
  cardId: string,
  passed: boolean,
  now: number,
): WordStats {
  const key = statKey(mode, cardId);
  const prev = stats[key] ?? emptyStat();
  return {
    ...stats,
    [key]: {
      correct: prev.correct + (passed ? 1 : 0),
      wrong: prev.wrong + (passed ? 0 : 1),
      lastSeen: now,
    },
  };
}

/**
 * Người học tự chấm lại: chuyển một câu từ sai thành đúng (hoặc ngược lại)
 * mà KHÔNG cộng thêm lượt trả lời mới.
 */
export function reviseAnswer(
  stats: WordStats,
  mode: StudyMode,
  cardId: string,
  passed: boolean,
  now: number,
): WordStats {
  const key = statKey(mode, cardId);
  const prev = stats[key] ?? emptyStat();

  // Gỡ kết quả cũ (lần gần nhất) rồi ghi lại theo lựa chọn mới.
  const correct = passed
    ? prev.correct + (prev.wrong > 0 ? 1 : 0)
    : Math.max(0, prev.correct - 1);
  const wrong = passed
    ? Math.max(0, prev.wrong - 1)
    : prev.wrong + (prev.correct > 0 ? 1 : 0);

  return { ...stats, [key]: { correct, wrong, lastSeen: now } };
}

/** Tiến độ của một chủ đề ở MỘT chế độ: số thẻ đã thuộc / tổng số thẻ. */
export function topicProgress(
  stats: WordStats,
  mode: StudyMode,
  cardIds: string[],
): { mastered: number; total: number; ratio: number } {
  const total = cardIds.length;
  let mastered = 0;
  for (const id of cardIds) {
    if (isMastered(stats[statKey(mode, id)])) mastered += 1;
  }
  return { mastered, total, ratio: total === 0 ? 0 : mastered / total };
}

/**
 * Chọn các thẻ cho một buổi học: ưu tiên thẻ CHƯA THUỘC, trong đó thẻ lâu
 * chưa gặp lên trước; nếu đã thuộc hết thì ôn lại theo thứ tự lâu nhất.
 * Thuần và tất định (deterministic) để test được và để buổi học ổn định.
 */
export function pickSessionCards<T extends { id: string }>(
  cards: T[],
  stats: WordStats,
  mode: StudyMode,
  count: number,
): T[] {
  const scored = cards.map((card, index) => {
    const stat = stats[statKey(mode, card.id)];
    return {
      card,
      index,
      mastered: isMastered(stat) ? 1 : 0,
      lastSeen: stat?.lastSeen ?? 0,
    };
  });

  scored.sort((a, b) => {
    if (a.mastered !== b.mastered) return a.mastered - b.mastered;
    if (a.lastSeen !== b.lastSeen) return a.lastSeen - b.lastSeen;
    return a.index - b.index;
  });

  return scored.slice(0, Math.max(0, count)).map((s) => s.card);
}
