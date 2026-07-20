/**
 * Sinh kế hoạch học hằng ngày.
 *
 * Đây là một HÀM THUẦN: nhận trạng thái hiện tại, trả về danh sách hoạt động.
 * Không đọc Date.now(), không đọc store, không chạm IndexedDB — nhờ vậy test
 * được và không vi phạm quy tắc React Compiler khi gọi trong lúc render.
 *
 * Hai hành vi cố ý:
 *  1. Kế hoạch LUÔN mở đầu bằng mục từ vựng của chủ đề hôm nay, và chủ đề
 *     hôm nay được xoay vòng theo kiểu "lâu chưa học nhất lên trước".
 *  2. Mục đã hoàn thành trong ngày được GHIM (pinned): danh sách hoạt động
 *     chỉ phụ thuộc vào planKey (ngày + mức + số từ), nên làm xong một mục
 *     giữa ngày cũng không làm kế hoạch bị xáo lại.
 */

export type SessionLevel = 20 | 40 | 60;

export type ActivityType = "vocab" | "listen" | "shadow" | "reply";

export interface Activity {
  /** id ổn định, dùng để ghim trạng thái đã hoàn thành trong ngày. */
  id: string;
  type: ActivityType;
  /** id của chủ đề / hội thoại / tình huống tương ứng. */
  refId: string;
  /** Chỉ có ở type "vocab": học theo cách nào. */
  mode?: "learn" | "en2vi" | "vi2en";
  titleVi: string;
  subtitleVi: string;
  href: string;
  estMinutes: number;
}

export interface PlanInput {
  /** Ngày hôm nay, YYYY-MM-DD theo giờ địa phương. */
  today: string;
  level: SessionLevel;
  wordsPerSession: number;
  topics: { id: string; titleVi: string; emoji: string }[];
  dialogues: { id: string; titleVi: string }[];
  scenarios: { id: string; titleVi: string }[];
  /**
   * Ngày gần nhất đã học từ vựng của từng chủ đề (YYYY-MM-DD).
   * Chủ đề chưa từng học thì không có mặt trong object này.
   */
  topicLastLearned: Record<string, string | undefined>;
}

/**
 * Khoá kế hoạch: khi khoá đổi thì mới sinh lại kế hoạch mới.
 * Nhờ vậy kế hoạch đứng yên suốt cả ngày dù người học có làm xong mục nào.
 */
export function planKey(input: Pick<PlanInput, "today" | "level" | "wordsPerSession">): string {
  return `${input.today}|${input.level}|${input.wordsPerSession}`;
}

/** Hash chuỗi -> số nguyên không âm, tất định, để xoay vòng nội dung theo ngày. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Chủ đề của hôm nay: ưu tiên chủ đề LÂU CHƯA HỌC NHẤT.
 * Chủ đề chưa từng học được coi là cũ nhất (xếp trước hết).
 * Hoà nhau thì giữ thứ tự khai báo trong topics.json.
 */
export function pickTodayTopic(
  topics: PlanInput["topics"],
  topicLastLearned: PlanInput["topicLastLearned"],
): PlanInput["topics"][number] | undefined {
  if (topics.length === 0) return undefined;

  const ranked = topics.map((topic, index) => ({
    topic,
    index,
    // "" sắp xếp trước mọi chuỗi YYYY-MM-DD nên chủ đề chưa học luôn lên đầu.
    last: topicLastLearned[topic.id] ?? "",
  }));

  ranked.sort((a, b) => {
    if (a.last !== b.last) return a.last < b.last ? -1 : 1;
    return a.index - b.index;
  });

  return ranked[0].topic;
}

/** Số mục và thành phần của kế hoạch theo quỹ thời gian. */
const LEVEL_RECIPE: Record<SessionLevel, ActivityType[]> = {
  20: ["vocab", "listen"],
  40: ["vocab", "vocab", "listen", "reply"],
  60: ["vocab", "vocab", "vocab", "listen", "shadow", "reply"],
};

/** Thứ tự các chế độ từ vựng khi kế hoạch cần nhiều hơn một mục vocab. */
const VOCAB_MODES: NonNullable<Activity["mode"]>[] = ["learn", "en2vi", "vi2en"];

const MODE_LABEL: Record<NonNullable<Activity["mode"]>, string> = {
  learn: "Học từ vựng",
  en2vi: "Dịch câu Anh → Việt",
  vi2en: "Dịch câu Việt → Anh",
};

/**
 * Sinh danh sách hoạt động cho hôm nay.
 * Luôn tất định với cùng một PlanInput.
 */
export function buildDailyPlan(input: PlanInput): Activity[] {
  const { today, level, wordsPerSession, topics, dialogues, scenarios } = input;
  const topic = pickTodayTopic(topics, input.topicLastLearned);
  if (!topic) return [];

  const seed = hashString(planKey(input));
  const recipe = LEVEL_RECIPE[level] ?? LEVEL_RECIPE[20];

  const activities: Activity[] = [];
  let vocabSeen = 0;

  for (const type of recipe) {
    if (type === "vocab") {
      const mode = VOCAB_MODES[vocabSeen % VOCAB_MODES.length];
      vocabSeen += 1;
      activities.push({
        id: `vocab:${topic.id}:${mode}`,
        type: "vocab",
        refId: topic.id,
        mode,
        titleVi: MODE_LABEL[mode],
        subtitleVi: `${topic.emoji} ${topic.titleVi} · ${wordsPerSession} câu`,
        href: `/vocab/${topic.id}/${mode}/`,
        estMinutes: 10,
      });
      continue;
    }

    if (type === "listen" && dialogues.length > 0) {
      const d = dialogues[seed % dialogues.length];
      activities.push({
        id: `listen:${d.id}`,
        type: "listen",
        refId: d.id,
        titleVi: "Nghe hội thoại",
        subtitleVi: d.titleVi,
        href: `/listen/${d.id}/`,
        estMinutes: 8,
      });
      continue;
    }

    if (type === "shadow" && dialogues.length > 0) {
      // Lệch một bước so với bài nghe để không trùng bài trong cùng một ngày.
      const d = dialogues[(seed + 1) % dialogues.length];
      activities.push({
        id: `shadow:${d.id}`,
        type: "shadow",
        refId: d.id,
        titleVi: "Nói theo",
        subtitleVi: d.titleVi,
        href: `/shadow/${d.id}/`,
        estMinutes: 10,
      });
      continue;
    }

    if (type === "reply" && scenarios.length > 0) {
      const s = scenarios[seed % scenarios.length];
      activities.push({
        id: `reply:${s.id}`,
        type: "reply",
        refId: s.id,
        titleVi: "Trả lời tin nhắn",
        subtitleVi: s.titleVi,
        href: `/reply/${s.id}/`,
        estMinutes: 8,
      });
    }
  }

  // `today` đã nằm trong seed qua planKey; tham chiếu ở đây cho rõ ý định.
  void today;
  return activities;
}

/** Kế hoạch hôm nay đã xong hết chưa. */
export function isPlanComplete(plan: Activity[], doneIds: string[]): boolean {
  if (plan.length === 0) return false;
  const done = new Set(doneIds);
  return plan.every((a) => done.has(a.id));
}

export interface StreakState {
  streak: number;
  bestStreak: number;
  lastCompletedDate: string | null;
}

/**
 * Cập nhật streak khi người học hoàn thành TOÀN BỘ kế hoạch trong ngày.
 * - Hoàn thành ngày liền sau ngày trước đó -> cộng tiếp.
 * - Ngắt quãng -> đếm lại từ 1.
 * - Gọi lại nhiều lần trong cùng một ngày -> không cộng thêm (idempotent).
 */
export function applyDayCompletion(state: StreakState, today: string): StreakState {
  if (state.lastCompletedDate === today) return state;

  const isConsecutive =
    state.lastCompletedDate !== null &&
    daysBetweenStrings(state.lastCompletedDate, today) === 1;

  const streak = isConsecutive ? state.streak + 1 : 1;

  return {
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    lastCompletedDate: today,
  };
}

/** Bản rút gọn của date.ts để plan.ts không phụ thuộc chéo. */
function daysBetweenStrings(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = new Date(ay, am - 1, ad, 12).getTime();
  const db = new Date(by, bm - 1, bd, 12).getTime();
  return Math.round((db - da) / 86_400_000);
}
