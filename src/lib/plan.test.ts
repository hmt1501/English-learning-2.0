import { describe, expect, it } from "vitest";
import {
  applyDayCompletion,
  buildDailyPlan,
  isPlanComplete,
  pickTodayTopic,
  planKey,
  type PlanInput,
} from "./plan";

const topics = [
  { id: "greetings", titleVi: "Chào hỏi", emoji: "👋" },
  { id: "email", titleVi: "Email", emoji: "✉️" },
  { id: "meetings", titleVi: "Họp hành", emoji: "🗓️" },
];

const dialogues = [
  { id: "dlg-a", titleVi: "Hội thoại A" },
  { id: "dlg-b", titleVi: "Hội thoại B" },
];

const scenarios = [
  { id: "sc-a", titleVi: "Tình huống A" },
  { id: "sc-b", titleVi: "Tình huống B" },
];

function makeInput(over: Partial<PlanInput> = {}): PlanInput {
  return {
    today: "2026-07-20",
    level: 40,
    wordsPerSession: 10,
    topics,
    dialogues,
    scenarios,
    topicLastLearned: {},
    ...over,
  };
}

describe("pickTodayTopic — xoay vòng chủ đề", () => {
  it("chủ đề chưa từng học được ưu tiên trước", () => {
    const t = pickTodayTopic(topics, { greetings: "2026-07-19" });
    expect(t?.id).toBe("email");
  });

  it("chọn chủ đề lâu chưa học nhất", () => {
    const t = pickTodayTopic(topics, {
      greetings: "2026-07-19",
      email: "2026-07-10",
      meetings: "2026-07-15",
    });
    expect(t?.id).toBe("email");
  });

  it("hoà nhau thì giữ thứ tự khai báo", () => {
    const t = pickTodayTopic(topics, {
      greetings: "2026-07-19",
      email: "2026-07-19",
      meetings: "2026-07-19",
    });
    expect(t?.id).toBe("greetings");
  });

  it("không có chủ đề nào thì trả về undefined", () => {
    expect(pickTodayTopic([], {})).toBeUndefined();
  });
});

describe("buildDailyPlan", () => {
  it("luôn mở đầu bằng mục từ vựng của chủ đề hôm nay", () => {
    for (const level of [20, 40, 60] as const) {
      const plan = buildDailyPlan(makeInput({ level }));
      expect(plan[0].type).toBe("vocab");
      expect(plan[0].mode).toBe("learn");
      expect(plan[0].refId).toBe("greetings");
    }
  });

  it("số mục tăng dần theo quỹ thời gian", () => {
    const p20 = buildDailyPlan(makeInput({ level: 20 }));
    const p40 = buildDailyPlan(makeInput({ level: 40 }));
    const p60 = buildDailyPlan(makeInput({ level: 60 }));
    expect(p20.length).toBeLessThan(p40.length);
    expect(p40.length).toBeLessThan(p60.length);
  });

  it("tổng thời lượng ước tính bám sát quỹ thời gian đã chọn", () => {
    const total = (level: 20 | 40 | 60) =>
      buildDailyPlan(makeInput({ level })).reduce((s, a) => s + a.estMinutes, 0);
    expect(total(20)).toBeLessThanOrEqual(25);
    expect(total(40)).toBeLessThanOrEqual(45);
    expect(total(60)).toBeLessThanOrEqual(65);
  });

  it("mức 60 phút dùng đủ cả ba cách học từ vựng", () => {
    const plan = buildDailyPlan(makeInput({ level: 60 }));
    const modes = plan.filter((a) => a.type === "vocab").map((a) => a.mode);
    expect(modes).toEqual(["learn", "en2vi", "vi2en"]);
  });

  it("tất định: cùng input cho ra cùng kế hoạch", () => {
    expect(buildDailyPlan(makeInput())).toEqual(buildDailyPlan(makeInput()));
  });

  it("id của mọi hoạt động là duy nhất (để ghim trạng thái hoàn thành)", () => {
    const plan = buildDailyPlan(makeInput({ level: 60 }));
    expect(new Set(plan.map((a) => a.id)).size).toBe(plan.length);
  });

  it("bài nói theo không trùng bài nghe trong cùng một ngày", () => {
    const plan = buildDailyPlan(makeInput({ level: 60 }));
    const listen = plan.find((a) => a.type === "listen");
    const shadow = plan.find((a) => a.type === "shadow");
    expect(listen!.refId).not.toBe(shadow!.refId);
  });

  it("đổi ngày thì nội dung nghe/nói được xoay vòng", () => {
    const days = ["2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23"];
    const picked = new Set(
      days.map(
        (today) =>
          buildDailyPlan(makeInput({ today })).find((a) => a.type === "listen")!.refId,
      ),
    );
    expect(picked.size).toBeGreaterThan(1);
  });

  it("không có hội thoại/tình huống thì bỏ qua mục đó, không văng lỗi", () => {
    const plan = buildDailyPlan(makeInput({ dialogues: [], scenarios: [], level: 60 }));
    expect(plan.every((a) => a.type === "vocab")).toBe(true);
    expect(plan.length).toBe(3);
  });

  it("không có chủ đề nào thì trả về kế hoạch rỗng", () => {
    expect(buildDailyPlan(makeInput({ topics: [] }))).toEqual([]);
  });

  it("href trỏ đúng trang của từng hoạt động", () => {
    const plan = buildDailyPlan(makeInput({ level: 60 }));
    expect(plan[0].href).toBe("/vocab/greetings/learn/");
    expect(plan.find((a) => a.type === "listen")!.href).toMatch(/^\/listen\/dlg-[ab]\/$/);
    expect(plan.find((a) => a.type === "reply")!.href).toMatch(/^\/reply\/sc-[ab]\/$/);
  });
});

describe("planKey — giữ kế hoạch ổn định trong ngày", () => {
  it("đổi ngày / mức / số từ thì khoá đổi", () => {
    const base = { today: "2026-07-20", level: 40 as const, wordsPerSession: 10 };
    expect(planKey(base)).toBe(planKey({ ...base }));
    expect(planKey(base)).not.toBe(planKey({ ...base, today: "2026-07-21" }));
    expect(planKey(base)).not.toBe(planKey({ ...base, level: 60 }));
    expect(planKey(base)).not.toBe(planKey({ ...base, wordsPerSession: 15 }));
  });
});

describe("isPlanComplete", () => {
  it("chỉ xong khi làm hết mọi mục", () => {
    const plan = buildDailyPlan(makeInput({ level: 20 }));
    expect(isPlanComplete(plan, [])).toBe(false);
    expect(isPlanComplete(plan, [plan[0].id])).toBe(false);
    expect(isPlanComplete(plan, plan.map((a) => a.id))).toBe(true);
  });

  it("kế hoạch rỗng không được coi là đã xong", () => {
    expect(isPlanComplete([], [])).toBe(false);
  });
});

describe("applyDayCompletion — streak", () => {
  it("ngày đầu tiên bắt đầu từ 1", () => {
    const s = applyDayCompletion({ streak: 0, bestStreak: 0, lastCompletedDate: null }, "2026-07-20");
    expect(s).toEqual({ streak: 1, bestStreak: 1, lastCompletedDate: "2026-07-20" });
  });

  it("học tiếp ngày liền sau thì cộng dồn", () => {
    const s = applyDayCompletion(
      { streak: 4, bestStreak: 9, lastCompletedDate: "2026-07-19" },
      "2026-07-20",
    );
    expect(s.streak).toBe(5);
    expect(s.bestStreak).toBe(9);
  });

  it("nghỉ cách quãng thì đếm lại từ 1 nhưng giữ kỷ lục", () => {
    const s = applyDayCompletion(
      { streak: 7, bestStreak: 7, lastCompletedDate: "2026-07-15" },
      "2026-07-20",
    );
    expect(s.streak).toBe(1);
    expect(s.bestStreak).toBe(7);
  });

  it("phá kỷ lục thì cập nhật bestStreak", () => {
    const s = applyDayCompletion(
      { streak: 9, bestStreak: 9, lastCompletedDate: "2026-07-19" },
      "2026-07-20",
    );
    expect(s.bestStreak).toBe(10);
  });

  it("gọi lại trong cùng ngày không cộng thêm", () => {
    const first = applyDayCompletion(
      { streak: 2, bestStreak: 5, lastCompletedDate: "2026-07-19" },
      "2026-07-20",
    );
    expect(applyDayCompletion(first, "2026-07-20")).toEqual(first);
  });

  it("chạy qua mốc cuối tháng vẫn liên tục", () => {
    const s = applyDayCompletion(
      { streak: 3, bestStreak: 3, lastCompletedDate: "2026-07-31" },
      "2026-08-01",
    );
    expect(s.streak).toBe(4);
  });
});
