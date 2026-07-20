import { describe, expect, it, vi } from "vitest";
import {
  AiError,
  AI_ERROR_MESSAGE_VI,
  buildSystemPrompt,
  classifyHttpStatus,
  GROQ_MODELS,
  parseAiReply,
  ROLEPLAYS,
  sendChat,
} from "./groq";

const scenario = ROLEPLAYS[0];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function reply(content: string): Response {
  return jsonResponse({ choices: [{ message: { content } }] });
}

describe("parseAiReply", () => {
  it("tách đúng phần tiếng Anh và phần nhận xét tiếng Việt", () => {
    const r = parseAiReply("[EN]\nThat sounds great! What did you do?\n[VI]\nCâu của bạn tốt rồi.");
    expect(r.en).toBe("That sounds great! What did you do?");
    expect(r.vi).toBe("Câu của bạn tốt rồi.");
  });

  it("chịu được khoảng trắng thừa và marker viết thường", () => {
    const r = parseAiReply("  [en]   Hello there!   [vi]   Ổn nhé.  ");
    expect(r.en).toBe("Hello there!");
    expect(r.vi).toBe("Ổn nhé.");
  });

  it("giữ được nhận xét nhiều dòng", () => {
    const r = parseAiReply("[EN]\nOk!\n[VI]\nDòng 1\nDòng 2");
    expect(r.vi).toBe("Dòng 1\nDòng 2");
  });

  it("thiếu cả hai marker thì coi tất cả là lời thoại tiếng Anh", () => {
    const r = parseAiReply("Just a plain sentence.");
    expect(r.en).toBe("Just a plain sentence.");
    expect(r.vi).toBe("");
  });

  it("chỉ có [EN] thì phần nhận xét để trống", () => {
    const r = parseAiReply("[EN]\nHello!");
    expect(r.en).toBe("Hello!");
    expect(r.vi).toBe("");
  });
});

describe("classifyHttpStatus", () => {
  it("ánh xạ đúng các mã lỗi thường gặp", () => {
    expect(classifyHttpStatus(401)).toBe("bad-key");
    expect(classifyHttpStatus(403)).toBe("bad-key");
    expect(classifyHttpStatus(429)).toBe("rate-limit");
    expect(classifyHttpStatus(500)).toBe("server");
    expect(classifyHttpStatus(503)).toBe("server");
    expect(classifyHttpStatus(418)).toBe("unknown");
  });
});

describe("thông báo lỗi tiếng Việt", () => {
  it("mọi loại lỗi đều có thông báo tiếng Việt dễ hiểu", () => {
    for (const kind of ["no-key", "bad-key", "rate-limit", "offline", "server", "unknown"] as const) {
      expect(AI_ERROR_MESSAGE_VI[kind].length).toBeGreaterThan(10);
    }
  });

  it("AiError giữ cả thông báo tiếng Việt lẫn thông báo gốc để chẩn đoán", () => {
    const e = new AiError("rate-limit", "HTTP 429: quota exceeded");
    expect(e.message).toBe(AI_ERROR_MESSAGE_VI["rate-limit"]);
    expect(e.detail).toBe("HTTP 429: quota exceeded");
  });
});

describe("buildSystemPrompt", () => {
  it("ép định dạng hai phần và yêu cầu kết thúc bằng câu hỏi", () => {
    const p = buildSystemPrompt(scenario, "Hoàng");
    expect(p).toContain("[EN]");
    expect(p).toContain("[VI]");
    expect(p).toContain("end with a question");
    expect(p).toContain("A2-B1");
    expect(p).toContain("Hoàng");
  });

  it("không có tên người học thì bỏ qua, không chèn chuỗi rỗng", () => {
    expect(buildSystemPrompt(scenario, "   ")).not.toContain("The learner's name is");
  });
});

describe("sendChat", () => {
  const base = { scenario, learnerName: "An", history: [{ role: "user" as const, content: "Hi" }] };

  it("thiếu key thì báo lỗi no-key mà không gọi mạng", async () => {
    const fetchImpl = vi.fn();
    await expect(
      sendChat({ ...base, apiKey: "   ", fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ kind: "no-key" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("gọi thành công thì trả về hai phần đã tách", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply("[EN]\nHi there!\n[VI]\nTốt lắm."));
    const r = await sendChat({
      ...base,
      apiKey: "gsk_x",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r).toEqual({ en: "Hi there!", vi: "Tốt lắm." });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gửi kèm system prompt đứng đầu danh sách tin nhắn", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply("[EN]\nOk\n[VI]\nOk"));
    await sendChat({ ...base, apiKey: "gsk_x", fetchImpl: fetchImpl as unknown as typeof fetch });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1]).toEqual({ role: "user", content: "Hi" });
    expect(body.model).toBe(GROQ_MODELS[0]);
  });

  it("key sai thì dừng ngay, không thử model khác", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: { message: "Invalid API Key" } }, 401));
    await expect(
      sendChat({ ...base, apiKey: "sai", fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ kind: "bad-key" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("hết hạn mức ở model đầu thì tự chuyển sang model dự phòng", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: "rate limit" } }, 429))
      .mockResolvedValueOnce(reply("[EN]\nSaved!\n[VI]\nỔn."));
    const r = await sendChat({
      ...base,
      apiKey: "gsk_x",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.en).toBe("Saved!");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).model).toBe(GROQ_MODELS[1]);
  });

  it("mọi model đều hết hạn mức thì báo lỗi rate-limit kèm thông báo gốc", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: { message: "rate limit reached" } }, 429));
    await expect(
      sendChat({ ...base, apiKey: "gsk_x", fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ kind: "rate-limit" });
    expect(fetchImpl).toHaveBeenCalledTimes(GROQ_MODELS.length);
  });

  it("mất mạng thì báo lỗi offline", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(
      sendChat({ ...base, apiKey: "gsk_x", fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ kind: "offline", detail: "Failed to fetch" });
  });

  it("model trả về nội dung rỗng thì thử model kế tiếp", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(reply("   "))
      .mockResolvedValueOnce(reply("[EN]\nHello\n[VI]\nTốt"));
    const r = await sendChat({
      ...base,
      apiKey: "gsk_x",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.en).toBe("Hello");
  });

  it("lỗi máy chủ thì báo kind server", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: { message: "boom" } }, 500));
    await expect(
      sendChat({ ...base, apiKey: "gsk_x", fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ kind: "server" });
  });
});

describe("ROLEPLAYS", () => {
  it("có sẵn vài tình huống, mỗi tình huống đủ thông tin", () => {
    expect(ROLEPLAYS.length).toBeGreaterThanOrEqual(3);
    for (const r of ROLEPLAYS) {
      expect(r.titleVi.length).toBeGreaterThan(0);
      expect(r.setting.length).toBeGreaterThan(0);
      expect(r.opener.trim().endsWith("?")).toBe(true);
    }
  });

  it("id không trùng nhau", () => {
    expect(new Set(ROLEPLAYS.map((r) => r.id)).size).toBe(ROLEPLAYS.length);
  });
});
