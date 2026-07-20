import { describe, expect, it } from "vitest";
import { backupFileName, BACKUP_VERSION, buildBackup, parseBackup } from "./backup";

const goodStore = {
  learnerName: "Hoàng",
  level: 40 as const,
  wordsPerSession: 12,
  streak: 3,
  bestStreak: 8,
  lastCompletedDate: "2026-07-19",
  currentDate: "2026-07-20",
  doneToday: ["vocab:greetings:learn"],
  todayPlanKey: "2026-07-20|40|12",
  apiKey: "gsk_abc",
};

const goodStats = { "greetings-01": { correct: 2, wrong: 1, lastSeen: 1000 } };
const goodLog = [{ date: "2026-07-20", type: "vocab", refId: "greetings", count: 10, at: 1000 }];

describe("buildBackup", () => {
  it("gói đủ ba phần và gắn phiên bản", () => {
    const b = buildBackup(goodStore, goodStats, goodLog, "2026-07-20T10:00:00.000Z");
    expect(b.app).toBe("tieng-anh-cong-so");
    expect(b.version).toBe(BACKUP_VERSION);
    expect(b.store.learnerName).toBe("Hoàng");
    expect(b.wordStats["greetings-01"].correct).toBe(2);
    expect(b.activityLog).toHaveLength(1);
  });

  it("xuất ra rồi nhập lại thì dữ liệu không đổi", () => {
    const b = buildBackup(goodStore, goodStats, goodLog, "2026-07-20T10:00:00.000Z");
    const round = parseBackup(JSON.parse(JSON.stringify(b)));
    expect(round.store).toEqual(goodStore);
    expect(round.wordStats).toEqual(goodStats);
    expect(round.activityLog).toEqual(goodLog);
    expect(round.skipped).toEqual([]);
  });
});

describe("parseBackup — bỏ qua trường sai kiểu, không làm hỏng phần còn lại", () => {
  it("giữ các cài đặt đúng, bỏ cài đặt sai kiểu", () => {
    const r = parseBackup({
      store: { ...goodStore, wordsPerSession: "mười hai", streak: -5 },
      wordStats: goodStats,
      activityLog: goodLog,
    });
    expect(r.store.learnerName).toBe("Hoàng");
    expect(r.store.level).toBe(40);
    expect(r.store.wordsPerSession).toBeUndefined();
    expect(r.store.streak).toBeUndefined();
    expect(r.skipped).toHaveLength(2);
    // phần khác vẫn nguyên vẹn
    expect(r.wordStats).toEqual(goodStats);
    expect(r.activityLog).toEqual(goodLog);
  });

  it("bỏ đúng những mục thống kê hỏng, giữ mục tốt", () => {
    const r = parseBackup({
      wordStats: {
        ok: { correct: 1, wrong: 0, lastSeen: 5 },
        thiếuTrường: { correct: 1 },
        saiKiểu: { correct: "nhiều", wrong: 0, lastSeen: 0 },
        sốÂm: { correct: -1, wrong: 0, lastSeen: 0 },
        khôngPhảiObject: 42,
      },
    });
    expect(Object.keys(r.wordStats)).toEqual(["ok"]);
    expect(r.skipped[0]).toContain("4");
  });

  it("bỏ đúng những dòng nhật ký hỏng, giữ dòng tốt", () => {
    const r = parseBackup({
      activityLog: [
        { date: "2026-07-20", type: "vocab", at: 1 },
        { date: "20/07/2026", type: "vocab", at: 2 },
        { date: "2026-07-20", type: "khôngTồnTại", at: 3 },
        { date: "2026-07-20", type: "listen" },
        "không phải object",
      ],
    });
    expect(r.activityLog).toHaveLength(1);
    expect(r.activityLog[0].type).toBe("vocab");
    expect(r.skipped[0]).toContain("4");
  });

  it("level chỉ nhận 20 / 40 / 60", () => {
    expect(parseBackup({ store: { level: 40 } }).store.level).toBe(40);
    expect(parseBackup({ store: { level: 30 } }).store.level).toBeUndefined();
  });

  it("lastCompletedDate được phép là null", () => {
    const r = parseBackup({ store: { lastCompletedDate: null } });
    expect(r.store.lastCompletedDate).toBeNull();
    expect(r.skipped).toEqual([]);
  });

  it("trường thiếu hẳn thì không bị báo là sai kiểu", () => {
    const r = parseBackup({ store: { learnerName: "An" } });
    expect(r.store).toEqual({ learnerName: "An" });
    expect(r.skipped).toEqual([]);
  });

  it("file rỗng / sai định dạng thì trả về dữ liệu rỗng chứ không văng lỗi", () => {
    for (const bad of [null, undefined, 42, "chuỗi", []]) {
      const r = parseBackup(bad);
      expect(r.store).toEqual({});
      expect(r.wordStats).toEqual({});
      expect(r.activityLog).toEqual([]);
      expect(r.skipped.length).toBeGreaterThan(0);
    }
  });

  it("các phần sai định dạng được báo riêng từng phần", () => {
    const r = parseBackup({ store: "hỏng", wordStats: [], activityLog: {} });
    expect(r.skipped).toHaveLength(3);
  });

  it("không có khoá nào thì im lặng trả về rỗng", () => {
    const r = parseBackup({});
    expect(r.skipped).toEqual([]);
  });
});

describe("backupFileName", () => {
  it("gắn ngày vào tên file", () => {
    expect(backupFileName("2026-07-20")).toBe("tieng-anh-cong-so-2026-07-20.json");
  });
});
