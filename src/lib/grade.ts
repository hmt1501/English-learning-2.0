/**
 * Chấm bài OFFLINE và CỐ Ý THOÁNG TAY.
 *
 * Triết lý: người học ở trình độ pre-intermediate dễ nản nếu bị chấm gắt.
 * Mục tiêu của phần chấm là "bạn có nhớ ý chính không", không phải "bạn có
 * gõ đúng từng chữ không". Vì vậy:
 *   - bỏ qua hoa/thường, dấu câu, khoảng trắng thừa;
 *   - so sánh KHÔNG phân biệt dấu tiếng Việt ("cam on" = "cảm ơn");
 *   - chỉ tính tỉ lệ *từ cốt lõi* trùng khớp (đã loại từ phụ);
 *   - luôn hiện đáp án mẫu và cho người học tự chấm lại.
 *
 * Toàn bộ file này là logic thuần, có unit test ở grade.test.ts.
 */
import { coreTokens, foldForCompare } from "./text";

/** Ba chế độ học của phần Từ vựng. */
export type StudyMode = "learn" | "en2vi" | "vi2en";

export type Verdict = "correct" | "close" | "wrong";

export interface GradeResult {
  verdict: Verdict;
  /** Tỉ lệ từ cốt lõi trùng khớp, 0..1 */
  score: number;
  /** Các từ cốt lõi của đáp án mà người học đã viết đúng */
  matched: string[];
  /** Các từ cốt lõi của đáp án mà người học còn thiếu */
  missing: string[];
}

interface Thresholds {
  correct: number;
  close: number;
}

/**
 * Ngưỡng theo chế độ. Chế độ dịch SANG TIẾNG ANH (vi2en) chặt hơn hẳn:
 * người học đang phải sản sinh ngoại ngữ nên ta cần chắc chắn hơn trước khi
 * kết luận "đúng"; ngược lại hai chế độ gõ tiếng Việt thì rất thoáng.
 */
export const THRESHOLDS: Record<StudyMode, Thresholds> = {
  learn: { correct: 0.6, close: 0.34 },
  en2vi: { correct: 0.6, close: 0.34 },
  vi2en: { correct: 0.75, close: 0.5 },
};

/** Đếm số phần tử trùng nhau giữa hai mảng, có tính số lần lặp (multiset). */
function countMatches(expected: string[], got: string[]): string[] {
  const pool = new Map<string, number>();
  for (const w of got) pool.set(w, (pool.get(w) ?? 0) + 1);

  const matched: string[] = [];
  for (const w of expected) {
    const left = pool.get(w) ?? 0;
    if (left > 0) {
      pool.set(w, left - 1);
      matched.push(w);
    }
  }
  return matched;
}

/** Chấm câu trả lời với MỘT đáp án mẫu. */
function gradeAgainstOne(
  answer: string,
  expected: string,
  mode: StudyMode,
): GradeResult {
  const expectedCore = coreTokens(expected);
  const gotCore = coreTokens(answer);
  const th = THRESHOLDS[mode];

  // Người học bỏ trống -> chưa đúng, không cần tính gì thêm.
  if (foldForCompare(answer).length === 0) {
    return { verdict: "wrong", score: 0, matched: [], missing: expectedCore };
  }

  // Trùng khít sau khi chuẩn hoá + bỏ dấu -> luôn đúng.
  if (foldForCompare(answer) === foldForCompare(expected)) {
    return { verdict: "correct", score: 1, matched: expectedCore, missing: [] };
  }

  if (expectedCore.length === 0) {
    return { verdict: "wrong", score: 0, matched: [], missing: [] };
  }

  const matched = countMatches(expectedCore, gotCore);
  const score = matched.length / expectedCore.length;
  const missing = subtract(expectedCore, matched);

  const verdict: Verdict =
    score >= th.correct ? "correct" : score >= th.close ? "close" : "wrong";

  return { verdict, score, matched, missing };
}

/** expected trừ đi matched (theo multiset) -> các từ còn thiếu. */
function subtract(expected: string[], matched: string[]): string[] {
  const pool = new Map<string, number>();
  for (const w of matched) pool.set(w, (pool.get(w) ?? 0) + 1);

  const rest: string[] = [];
  for (const w of expected) {
    const left = pool.get(w) ?? 0;
    if (left > 0) pool.set(w, left - 1);
    else rest.push(w);
  }
  return rest;
}

/**
 * Chấm câu trả lời. Có thể truyền nhiều đáp án chấp nhận được — lấy kết quả
 * TỐT NHẤT, đúng với tinh thần thoáng tay.
 */
export function gradeAnswer(
  answer: string,
  expected: string | string[],
  mode: StudyMode,
): GradeResult {
  const list = (Array.isArray(expected) ? expected : [expected]).filter(
    (e) => e.trim().length > 0,
  );
  if (list.length === 0) {
    return { verdict: "wrong", score: 0, matched: [], missing: [] };
  }

  let best = gradeAgainstOne(answer, list[0], mode);
  for (let i = 1; i < list.length; i++) {
    const next = gradeAgainstOne(answer, list[i], mode);
    if (next.score > best.score) best = next;
  }
  return best;
}

/** Nhãn tiếng Việt hiển thị cho từng mức kết quả. */
export const VERDICT_LABEL: Record<Verdict, string> = {
  correct: "Đúng rồi",
  close: "Gần đúng",
  wrong: "Chưa đúng",
};

/** Kết quả nào được tính là "trả lời đúng" khi cập nhật thống kê. */
export function isPass(verdict: Verdict): boolean {
  return verdict === "correct";
}
