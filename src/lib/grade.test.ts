import { describe, expect, it } from "vitest";
import { gradeAnswer, isPass, THRESHOLDS } from "./grade";
import { coreTokens, foldForCompare, normalizeText, stripVietnameseTones } from "./text";

describe("chuẩn hoá chuỗi", () => {
  it("bỏ dấu câu, hoa/thường và khoảng trắng thừa", () => {
    expect(normalizeText("  Nice to MEET you,  Mr. Tran! ")).toBe("nice to meet you mr tran");
  });

  it("bỏ dấu tiếng Việt, kể cả chữ đ", () => {
    expect(stripVietnameseTones("Được rồi, cảm ơn")).toBe("Duoc roi, cam on");
  });

  it("so sánh không phân biệt dấu tiếng Việt", () => {
    expect(foldForCompare("Rất vui được gặp bạn")).toBe(foldForCompare("rat vui duoc gap ban"));
  });

  it("loại từ phụ khi lấy từ cốt lõi", () => {
    expect(coreTokens("I would like to book a meeting room")).toEqual([
      "like",
      "book",
      "meeting",
      "room",
    ]);
  });

  it("giữ nguyên danh sách nếu câu toàn từ phụ (không chia cho 0)", () => {
    expect(coreTokens("it is the")).toEqual(["it", "is", "the"]);
  });
});

describe("gradeAnswer — chấm thoáng tay", () => {
  it("trùng khít thì đúng", () => {
    const r = gradeAnswer("rất vui được gặp bạn", "rất vui được gặp bạn", "learn");
    expect(r.verdict).toBe("correct");
    expect(r.score).toBe(1);
  });

  it("gõ không dấu vẫn được tính là đúng", () => {
    const r = gradeAnswer("rat vui duoc gap ban", "rất vui được gặp bạn", "learn");
    expect(r.verdict).toBe("correct");
  });

  it("khác hoa thường và dấu câu vẫn đúng", () => {
    const r = gradeAnswer("NICE to meet you!!!", "nice to meet you", "vi2en");
    expect(r.verdict).toBe("correct");
  });

  it("thiếu từ phụ vẫn đúng vì chỉ tính từ cốt lõi", () => {
    const r = gradeAnswer("vui gặp bạn", "rất vui được gặp bạn", "learn");
    expect(r.verdict).toBe("correct");
  });

  it("bỏ trống thì chưa đúng và liệt kê hết từ còn thiếu", () => {
    const r = gradeAnswer("   ", "nice to meet you", "learn");
    expect(r.verdict).toBe("wrong");
    expect(r.score).toBe(0);
    expect(r.missing).toEqual(["nice", "meet"]);
  });

  it("sai hoàn toàn thì chưa đúng", () => {
    const r = gradeAnswer("tôi đói bụng quá", "rất vui được gặp bạn", "learn");
    expect(r.verdict).toBe("wrong");
  });

  it("đúng một phần thì trả về gần đúng", () => {
    // 2/4 từ cốt lõi = 0.5 -> trên ngưỡng close (0.34), dưới correct (0.6)
    const r = gradeAnswer(
      "gửi báo cáo",
      "gửi báo cáo trước thứ sáu tuần này nhé",
      "learn",
    );
    expect(r.verdict).toBe("close");
    expect(r.score).toBeGreaterThanOrEqual(THRESHOLDS.learn.close);
    expect(r.score).toBeLessThan(THRESHOLDS.learn.correct);
  });

  it("báo đúng danh sách từ khớp và từ thiếu", () => {
    const r = gradeAnswer("book meeting", "book a meeting room", "vi2en");
    expect(r.matched).toEqual(["book", "meeting"]);
    expect(r.missing).toEqual(["room"]);
  });

  it("không cộng điểm khống khi người học lặp lại một từ", () => {
    const r = gradeAnswer("room room room", "book a meeting room", "vi2en");
    // chỉ khớp được đúng 1 lần "room" trên 3 từ cốt lõi
    expect(r.matched).toEqual(["room"]);
    expect(r.score).toBeCloseTo(1 / 3, 5);
  });

  it("nhiều đáp án chấp nhận được thì lấy kết quả tốt nhất", () => {
    const r = gradeAnswer("hẹn gặp lại", ["tạm biệt nhé", "hẹn gặp lại"], "learn");
    expect(r.verdict).toBe("correct");
    expect(r.score).toBe(1);
  });
});

describe("ngưỡng theo chế độ", () => {
  it("dịch sang tiếng Anh chặt hơn gõ nghĩa tiếng Việt", () => {
    expect(THRESHOLDS.vi2en.correct).toBeGreaterThan(THRESHOLDS.learn.correct);
    expect(THRESHOLDS.vi2en.close).toBeGreaterThan(THRESHOLDS.learn.close);
  });

  it("cùng một câu trả lời: learn cho đúng, vi2en chỉ cho gần đúng", () => {
    // 2/3 từ cốt lõi = 0.67 -> nằm giữa ngưỡng của learn (0.6) và vi2en (0.75)
    const answer = "send the report";
    const expected = "send the report tomorrow";
    expect(gradeAnswer(answer, expected, "learn").verdict).toBe("correct");
    expect(gradeAnswer(answer, expected, "vi2en").verdict).toBe("close");
  });
});

describe("isPass", () => {
  it("chỉ 'đúng' mới được tính là qua", () => {
    expect(isPass("correct")).toBe(true);
    expect(isPass("close")).toBe(false);
    expect(isPass("wrong")).toBe(false);
  });
});
