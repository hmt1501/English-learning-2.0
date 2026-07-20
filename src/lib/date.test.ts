import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatDateVi,
  fromLocalDateString,
  isYesterday,
  toLocalDateString,
} from "./date";

describe("toLocalDateString — theo giờ địa phương", () => {
  it("định dạng YYYY-MM-DD có đệm số 0", () => {
    expect(toLocalDateString(new Date(2026, 6, 5, 10, 0))).toBe("2026-07-05");
  });

  it("gần nửa đêm vẫn giữ đúng ngày địa phương (không lệch sang UTC)", () => {
    // 23:30 ngày 20/7 giờ địa phương vẫn phải là 2026-07-20,
    // dù ở UTC có thể đã sang ngày 21.
    expect(toLocalDateString(new Date(2026, 6, 20, 23, 30))).toBe("2026-07-20");
    // 00:30 ngày 20/7 vẫn là 2026-07-20 dù ở UTC có thể còn là ngày 19.
    expect(toLocalDateString(new Date(2026, 6, 20, 0, 30))).toBe("2026-07-20");
  });
});

describe("chuyển đổi hai chiều", () => {
  it("chuỗi -> Date -> chuỗi giữ nguyên giá trị", () => {
    for (const s of ["2026-01-01", "2026-02-28", "2026-07-20", "2026-12-31"]) {
      expect(toLocalDateString(fromLocalDateString(s))).toBe(s);
    }
  });
});

describe("addDays", () => {
  it("cộng ngày bình thường", () => {
    expect(addDays("2026-07-20", 1)).toBe("2026-07-21");
  });

  it("qua mốc cuối tháng", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
  });

  it("qua mốc cuối năm", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("trừ ngày", () => {
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31");
  });

  it("năm nhuận", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("daysBetween & isYesterday", () => {
  it("đếm đúng khoảng cách ngày", () => {
    expect(daysBetween("2026-07-20", "2026-07-20")).toBe(0);
    expect(daysBetween("2026-07-20", "2026-07-21")).toBe(1);
    expect(daysBetween("2026-07-21", "2026-07-20")).toBe(-1);
    expect(daysBetween("2026-07-01", "2026-08-01")).toBe(31);
  });

  it("nhận ra ngày liền trước", () => {
    expect(isYesterday("2026-07-19", "2026-07-20")).toBe(true);
    expect(isYesterday("2026-07-18", "2026-07-20")).toBe(false);
    expect(isYesterday("2026-07-31", "2026-08-01")).toBe(true);
  });
});

describe("formatDateVi", () => {
  it("hiển thị thứ và ngày bằng tiếng Việt", () => {
    // 20/07/2026 là thứ Hai
    expect(formatDateVi("2026-07-20")).toBe("Thứ Hai, 20/07/2026");
  });
});
