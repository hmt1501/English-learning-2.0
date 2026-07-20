import { describe, expect, it } from "vitest";
import {
  isMastered,
  MASTERY_THRESHOLD,
  pickSessionCards,
  recordAnswer,
  reviseAnswer,
  statKey,
  topicProgress,
  type WordStats,
} from "./stats";

describe("statKey — tách tiến độ theo chế độ học", () => {
  it("chế độ học từ dùng cardId trần", () => {
    expect(statKey("learn", "greetings-01")).toBe("greetings-01");
  });

  it("hai chế độ dịch câu có tiền tố riêng", () => {
    expect(statKey("en2vi", "greetings-01")).toBe("en2vi:greetings-01");
    expect(statKey("vi2en", "greetings-01")).toBe("vi2en:greetings-01");
  });

  it("ba chế độ không bao giờ đụng khoá nhau", () => {
    const keys = (["learn", "en2vi", "vi2en"] as const).map((m) => statKey(m, "x-01"));
    expect(new Set(keys).size).toBe(3);
  });
});

describe("recordAnswer", () => {
  it("ghi nhận trả lời đúng", () => {
    const s = recordAnswer({}, "learn", "a-01", true, 1000);
    expect(s["a-01"]).toEqual({ correct: 1, wrong: 0, lastSeen: 1000 });
  });

  it("ghi nhận trả lời sai", () => {
    const s = recordAnswer({}, "learn", "a-01", false, 1000);
    expect(s["a-01"]).toEqual({ correct: 0, wrong: 1, lastSeen: 1000 });
  });

  it("cộng dồn qua nhiều lượt", () => {
    let s: WordStats = {};
    s = recordAnswer(s, "en2vi", "a-01", true, 1);
    s = recordAnswer(s, "en2vi", "a-01", false, 2);
    s = recordAnswer(s, "en2vi", "a-01", true, 3);
    expect(s["en2vi:a-01"]).toEqual({ correct: 2, wrong: 1, lastSeen: 3 });
  });

  it("không sửa object cũ tại chỗ", () => {
    const before: WordStats = {};
    const after = recordAnswer(before, "learn", "a-01", true, 1);
    expect(before).toEqual({});
    expect(after).not.toBe(before);
  });

  it("học cùng một thẻ ở chế độ khác không ảnh hưởng chế độ kia", () => {
    let s: WordStats = {};
    s = recordAnswer(s, "learn", "a-01", true, 1);
    s = recordAnswer(s, "vi2en", "a-01", false, 2);
    expect(s["a-01"].correct).toBe(1);
    expect(s["vi2en:a-01"].wrong).toBe(1);
  });
});

describe("isMastered — đã thuộc khi đúng >= 2", () => {
  it("ngưỡng đúng như quy ước", () => {
    expect(MASTERY_THRESHOLD).toBe(2);
  });

  it("chưa gặp bao giờ thì chưa thuộc", () => {
    expect(isMastered(undefined)).toBe(false);
  });

  it("đúng 1 lần chưa thuộc, đúng 2 lần là thuộc", () => {
    expect(isMastered({ correct: 1, wrong: 0, lastSeen: 0 })).toBe(false);
    expect(isMastered({ correct: 2, wrong: 0, lastSeen: 0 })).toBe(true);
  });

  it("sai nhiều nhưng đủ 2 lần đúng vẫn tính là thuộc", () => {
    expect(isMastered({ correct: 2, wrong: 9, lastSeen: 0 })).toBe(true);
  });
});

describe("reviseAnswer — người học tự chấm lại", () => {
  it("đổi sai thành đúng, không cộng thêm lượt", () => {
    const before = recordAnswer({}, "learn", "a-01", false, 10);
    const after = reviseAnswer(before, "learn", "a-01", true, 20);
    expect(after["a-01"]).toEqual({ correct: 1, wrong: 0, lastSeen: 20 });
  });

  it("đổi đúng thành sai", () => {
    const before = recordAnswer({}, "learn", "a-01", true, 10);
    const after = reviseAnswer(before, "learn", "a-01", false, 20);
    expect(after["a-01"]).toEqual({ correct: 0, wrong: 1, lastSeen: 20 });
  });

  it("không bao giờ để số đếm xuống âm", () => {
    const after = reviseAnswer({}, "learn", "a-01", false, 5);
    expect(after["a-01"].correct).toBe(0);
    expect(after["a-01"].wrong).toBe(0);
  });
});

describe("topicProgress", () => {
  it("đếm số thẻ đã thuộc trên tổng số", () => {
    let s: WordStats = {};
    s = recordAnswer(s, "learn", "a-01", true, 1);
    s = recordAnswer(s, "learn", "a-01", true, 2);
    s = recordAnswer(s, "learn", "a-02", true, 3);
    const p = topicProgress(s, "learn", ["a-01", "a-02", "a-03"]);
    expect(p).toEqual({ mastered: 1, total: 3, ratio: 1 / 3 });
  });

  it("chủ đề rỗng không gây chia cho 0", () => {
    expect(topicProgress({}, "learn", [])).toEqual({ mastered: 0, total: 0, ratio: 0 });
  });

  it("tiến độ tính riêng cho từng chế độ", () => {
    let s: WordStats = {};
    s = recordAnswer(s, "learn", "a-01", true, 1);
    s = recordAnswer(s, "learn", "a-01", true, 2);
    expect(topicProgress(s, "learn", ["a-01"]).mastered).toBe(1);
    expect(topicProgress(s, "vi2en", ["a-01"]).mastered).toBe(0);
  });
});

describe("pickSessionCards", () => {
  const cards = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

  it("ưu tiên thẻ chưa thuộc", () => {
    let s: WordStats = {};
    s = recordAnswer(s, "learn", "a", true, 1);
    s = recordAnswer(s, "learn", "a", true, 2);
    const picked = pickSessionCards(cards, s, "learn", 2).map((c) => c.id);
    expect(picked).not.toContain("a");
  });

  it("trong nhóm chưa thuộc thì thẻ lâu chưa gặp lên trước", () => {
    let s: WordStats = {};
    s = recordAnswer(s, "learn", "b", false, 500);
    s = recordAnswer(s, "learn", "c", false, 100);
    const picked = pickSessionCards(cards, s, "learn", 4).map((c) => c.id);
    // "a" và "d" chưa gặp (lastSeen 0) -> trước; rồi "c" (100), rồi "b" (500)
    expect(picked).toEqual(["a", "d", "c", "b"]);
  });

  it("thuộc hết rồi thì vẫn trả về thẻ để ôn lại", () => {
    let s: WordStats = {};
    for (const c of cards) {
      s = recordAnswer(s, "learn", c.id, true, 1);
      s = recordAnswer(s, "learn", c.id, true, 2);
    }
    expect(pickSessionCards(cards, s, "learn", 3)).toHaveLength(3);
  });

  it("xin nhiều hơn số thẻ có thì trả về tối đa có thể", () => {
    expect(pickSessionCards(cards, {}, "learn", 99)).toHaveLength(4);
  });

  it("xin 0 hoặc số âm thì trả về mảng rỗng", () => {
    expect(pickSessionCards(cards, {}, "learn", 0)).toEqual([]);
    expect(pickSessionCards(cards, {}, "learn", -3)).toEqual([]);
  });

  it("tất định: gọi hai lần cho cùng kết quả", () => {
    expect(pickSessionCards(cards, {}, "learn", 3)).toEqual(
      pickSessionCards(cards, {}, "learn", 3),
    );
  });
});
