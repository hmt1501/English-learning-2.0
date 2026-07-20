import { describe, expect, it } from "vitest";
import {
  advanceCheckpoint,
  createCheckpoint,
  isFinished,
  isResumable,
  progressLabel,
  reviseCheckpoint,
  sessionKey,
} from "./session";

const ids = ["a", "b", "c"];
const valid = new Set(ids);
const base = createCheckpoint(ids, "2026-07-20", 1000);

describe("sessionKey", () => {
  it("tách theo chủ đề và cách học", () => {
    expect(sessionKey("greetings", "learn")).toBe("greetings:learn");
    expect(sessionKey("greetings", "vi2en")).toBe("greetings:vi2en");
  });

  it("ba cách học của cùng chủ đề không đụng khoá nhau", () => {
    const keys = (["learn", "en2vi", "vi2en"] as const).map((m) => sessionKey("x", m));
    expect(new Set(keys).size).toBe(3);
  });
});

describe("createCheckpoint", () => {
  it("bắt đầu từ câu 0, chưa câu nào đúng", () => {
    expect(base).toEqual({
      cardIds: ids,
      index: 0,
      correctCount: 0,
      date: "2026-07-20",
      updatedAt: 1000,
    });
  });
});

describe("advanceCheckpoint", () => {
  it("làm đúng thì tiến một câu và cộng điểm", () => {
    const cp = advanceCheckpoint(base, true, 2000);
    expect(cp.index).toBe(1);
    expect(cp.correctCount).toBe(1);
    expect(cp.updatedAt).toBe(2000);
  });

  it("làm sai vẫn tiến một câu nhưng không cộng điểm", () => {
    const cp = advanceCheckpoint(base, false, 2000);
    expect(cp.index).toBe(1);
    expect(cp.correctCount).toBe(0);
  });

  it("không vượt quá số thẻ của buổi", () => {
    let cp = base;
    for (let i = 0; i < 10; i++) cp = advanceCheckpoint(cp, true, 3000);
    expect(cp.index).toBe(3);
  });

  it("không sửa checkpoint cũ tại chỗ", () => {
    advanceCheckpoint(base, true, 2000);
    expect(base.index).toBe(0);
  });
});

describe("reviseCheckpoint — tự chấm lại", () => {
  it("đổi sai thành đúng thì cộng một điểm, giữ nguyên vị trí", () => {
    const answered = advanceCheckpoint(base, false, 2000);
    const revised = reviseCheckpoint(answered, true, 3000);
    expect(revised.correctCount).toBe(1);
    expect(revised.index).toBe(1);
  });

  it("đổi đúng thành sai thì trừ một điểm", () => {
    const answered = advanceCheckpoint(base, true, 2000);
    expect(reviseCheckpoint(answered, false, 3000).correctCount).toBe(0);
  });

  it("không bao giờ âm", () => {
    const answered = advanceCheckpoint(base, false, 2000);
    expect(reviseCheckpoint(answered, false, 3000).correctCount).toBe(0);
  });

  it("số câu đúng không vượt quá số câu đã làm", () => {
    const answered = advanceCheckpoint(base, true, 2000);
    expect(reviseCheckpoint(answered, true, 3000).correctCount).toBe(1);
  });
});

describe("isResumable", () => {
  it("không có checkpoint thì không nối được", () => {
    expect(isResumable(undefined, valid)).toBe(false);
  });

  it("chưa làm câu nào thì không có gì để nối", () => {
    expect(isResumable(base, valid)).toBe(false);
  });

  it("đang làm dở thì nối được", () => {
    expect(isResumable(advanceCheckpoint(base, true, 2000), valid)).toBe(true);
  });

  it("đã làm hết thì không nối (buổi đó xong rồi)", () => {
    let cp = base;
    for (let i = 0; i < 3; i++) cp = advanceCheckpoint(cp, true, 2000);
    expect(isResumable(cp, valid)).toBe(false);
  });

  it("thẻ trong checkpoint không còn tồn tại thì bỏ, không nối", () => {
    const stale = { ...advanceCheckpoint(base, true, 2000), cardIds: ["a", "đã-xoá"] };
    expect(isResumable(stale, valid)).toBe(false);
  });

  it("buổi dở từ hôm trước vẫn nối được — cố ý không xét ngày", () => {
    const yesterday = { ...advanceCheckpoint(base, true, 2000), date: "2026-07-01" };
    expect(isResumable(yesterday, valid)).toBe(true);
  });

  it("checkpoint rỗng thì không nối", () => {
    expect(isResumable(createCheckpoint([], "2026-07-20", 1), valid)).toBe(false);
  });
});

describe("isFinished", () => {
  it("nhận ra buổi đã xong", () => {
    let cp = base;
    expect(isFinished(cp)).toBe(false);
    for (let i = 0; i < 3; i++) cp = advanceCheckpoint(cp, true, 2000);
    expect(isFinished(cp)).toBe(true);
  });
});

describe("progressLabel", () => {
  it("hiện số câu đã làm khi đang dở", () => {
    expect(progressLabel(advanceCheckpoint(base, true, 2000))).toBe("1/3");
  });

  it("chưa làm gì hoặc đã xong thì không hiện", () => {
    expect(progressLabel(base)).toBeNull();
    expect(progressLabel(undefined)).toBeNull();

    let cp = base;
    for (let i = 0; i < 3; i++) cp = advanceCheckpoint(cp, true, 2000);
    expect(progressLabel(cp)).toBeNull();
  });
});
