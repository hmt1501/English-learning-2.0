/**
 * Checkpoint của buổi học từ vựng đang làm dở.
 *
 * Vì sao cần: người học hay bị ngắt giữa chừng (họp, có việc, hết pin). Nếu
 * thoát ra mà mất sạch thì rất nản. Checkpoint cho phép:
 *   - quay lại đúng câu đang dở, với ĐÚNG bộ thẻ của buổi đó;
 *   - hiện số câu đã làm ở trang Hôm nay và menu Từ vựng ngay lập tức,
 *     không phải chờ học hết buổi mới thấy.
 *
 * Lưu ý: checkpoint KHÁC với "ghi công ngày". Làm dở vẫn giữ được tiến độ và
 * vẫn thấy số câu, nhưng chỉ khi hoàn tất cả buổi thì hoạt động mới được đánh
 * dấu ✅ trong kế hoạch và mới tính vào streak.
 *
 * Logic thuần, có unit test.
 */
import type { StudyMode } from "./grade";

export interface SessionCheckpoint {
  /** Bộ thẻ đã chốt của buổi này — giữ lại để lúc quay lại không bị đổi đề. */
  cardIds: string[];
  /** Số câu đã làm xong = vị trí câu kế tiếp. */
  index: number;
  correctCount: number;
  /** Ngày tạo buổi học (YYYY-MM-DD giờ địa phương). */
  date: string;
  updatedAt: number;
}

export type SessionStore = Record<string, SessionCheckpoint>;

export function sessionKey(topicId: string, mode: StudyMode): string {
  return `${topicId}:${mode}`;
}

export function createCheckpoint(
  cardIds: string[],
  date: string,
  now: number,
): SessionCheckpoint {
  return { cardIds, index: 0, correctCount: 0, date, updatedAt: now };
}

/**
 * Có nên nối tiếp buổi cũ không.
 *
 * Cố ý KHÔNG kiểm tra ngày: buổi học dở từ hôm qua vẫn nối tiếp được, vì mất
 * công đã làm mới là điều khó chịu nhất. Chỉ cần bộ thẻ vẫn còn hợp lệ.
 */
export function isResumable(
  cp: SessionCheckpoint | undefined,
  validCardIds: ReadonlySet<string>,
): cp is SessionCheckpoint {
  if (!cp) return false;
  if (cp.cardIds.length === 0) return false;
  // Đã làm hết mà chưa kịp xoá -> coi như không có gì để nối.
  if (cp.index <= 0 || cp.index >= cp.cardIds.length) return false;
  return cp.cardIds.every((id) => validCardIds.has(id));
}

/** Ghi nhận một câu đã làm xong. */
export function advanceCheckpoint(
  cp: SessionCheckpoint,
  passed: boolean,
  now: number,
): SessionCheckpoint {
  return {
    ...cp,
    index: Math.min(cp.index + 1, cp.cardIds.length),
    correctCount: cp.correctCount + (passed ? 1 : 0),
    updatedAt: now,
  };
}

/**
 * Người học tự chấm lại câu VỪA làm: chỉnh số câu đúng, không đụng vị trí.
 */
export function reviseCheckpoint(
  cp: SessionCheckpoint,
  passed: boolean,
  now: number,
): SessionCheckpoint {
  const delta = passed ? 1 : -1;
  return {
    ...cp,
    correctCount: Math.max(0, Math.min(cp.index, cp.correctCount + delta)),
    updatedAt: now,
  };
}

/** Buổi học đã làm hết chưa. */
export function isFinished(cp: SessionCheckpoint): boolean {
  return cp.index >= cp.cardIds.length;
}

/** Nhãn tiến độ dở dang, ví dụ "4/10". Trả về null nếu không có gì đang dở. */
export function progressLabel(cp: SessionCheckpoint | undefined): string | null {
  if (!cp || cp.index <= 0 || cp.index >= cp.cardIds.length) return null;
  return `${cp.index}/${cp.cardIds.length}`;
}
