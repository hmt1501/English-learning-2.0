/**
 * Chat với "đồng nghiệp ảo" — gọi thẳng Groq API từ trình duyệt.
 *
 * Vì đây là web tĩnh, KHÔNG có chỗ nào giấu được API key: bất kỳ key nào nhúng
 * vào repo cũng lộ ngay với người xem trang. Nên người dùng tự dán key MIỄN PHÍ
 * của họ và key chỉ nằm trong localStorage trên máy họ.
 *
 * Phần parse và ánh xạ lỗi là logic thuần, có unit test.
 */

export const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Danh sách model dự phòng: hết hạn mức / lỗi model thì thử model kế tiếp.
 * Đối chiếu với https://console.groq.com/docs/models — Groq có gỡ model cũ,
 * nên nếu chat báo lỗi ở MỌI model thì việc đầu tiên là kiểm tra danh sách này.
 */
export const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-20b",
] as const;

export interface RoleplayScenario {
  id: string;
  titleVi: string;
  emoji: string;
  /** Bối cảnh nhét vào system prompt */
  setting: string;
  /** Câu mở đầu của AI, để người học không phải nghĩ trước */
  opener: string;
}

/**
 * id của mục "chat tự do" — không có bối cảnh cố định, người học muốn nói gì
 * thì nói. Tách ra thành hằng số vì giao diện hiển thị mục này riêng một nhóm.
 */
export const FREE_CHAT_ID = "free";

export const ROLEPLAYS: RoleplayScenario[] = [
  {
    id: FREE_CHAT_ID,
    titleVi: "Chat tự do",
    emoji: "💬",
    setting:
      "You and the learner are friendly colleagues having an open conversation. " +
      "There is no fixed scenario: let the learner choose the topic and follow " +
      "wherever they take it — work, hobbies, family, weekend plans, anything. " +
      "Do not steer the conversation back to a preset situation.",
    opener: "Hi! I'm free for a chat. What would you like to talk about today?",
  },
  {
    id: "coffee",
    titleVi: "Tán gẫu ở khu pha cà phê",
    emoji: "☕",
    setting:
      "You and the learner are colleagues chatting casually in the office pantry before work starts.",
    opener: "Morning! You're in early today. Did you have a good weekend?",
  },
  {
    id: "standup",
    titleVi: "Họp đầu ngày với nhóm",
    emoji: "🗓️",
    setting:
      "You are the learner's teammate at a short daily stand-up meeting. Ask about their tasks and blockers.",
    opener: "Hi! Let's start our stand-up. What did you work on yesterday?",
  },
  {
    id: "newteammate",
    titleVi: "Làm quen đồng nghiệp mới",
    emoji: "👋",
    setting:
      "You are a new colleague who just joined the company today and is meeting the learner for the first time.",
    opener: "Hello! I'm Alex, I just joined the marketing team today. What do you do here?",
  },
  {
    id: "lunch",
    titleVi: "Rủ nhau đi ăn trưa",
    emoji: "🍜",
    setting:
      "You are a friendly colleague deciding where to have lunch with the learner.",
    opener: "I'm getting hungry. Do you want to grab lunch together? Any place you like?",
  },
];

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiReply {
  /** Phần đồng nghiệp ảo nói bằng tiếng Anh */
  en: string;
  /** Phần nhận xét tiếng Việt về câu vừa rồi của người học */
  vi: string;
}

/** Mã lỗi -> để UI chọn thông báo tiếng Việt phù hợp. */
export type AiErrorKind =
  | "no-key"
  | "bad-key"
  | "rate-limit"
  | "offline"
  | "server"
  | "unknown";

export class AiError extends Error {
  kind: AiErrorKind;
  /** Thông báo gốc (tiếng Anh) để chẩn đoán khi cần. */
  detail: string;

  constructor(kind: AiErrorKind, detail: string) {
    super(AI_ERROR_MESSAGE_VI[kind]);
    this.name = "AiError";
    this.kind = kind;
    this.detail = detail;
  }
}

export const AI_ERROR_MESSAGE_VI: Record<AiErrorKind, string> = {
  "no-key":
    "Bạn chưa nhập API key. Vào Cài đặt, dán key miễn phí lấy từ console.groq.com rồi quay lại nhé.",
  "bad-key":
    "API key không đúng hoặc đã bị thu hồi. Kiểm tra lại key trong Cài đặt giúp mình nhé.",
  "rate-limit":
    "Bạn đã dùng hết hạn mức miễn phí trong lúc này. Chờ vài phút rồi thử lại nhé.",
  offline:
    "Không kết nối được mạng. Phần chat cần Internet, còn các phần học khác vẫn dùng offline được.",
  server:
    "Máy chủ AI đang trục trặc. Thử lại sau một lát nhé.",
  unknown: "Có lỗi không xác định khi gọi AI.",
};

/** Ánh xạ mã HTTP -> loại lỗi. Hàm thuần, có test. */
export function classifyHttpStatus(status: number): AiErrorKind {
  if (status === 401 || status === 403) return "bad-key";
  if (status === 429) return "rate-limit";
  if (status >= 500) return "server";
  return "unknown";
}

/**
 * System prompt: ép AI trả về ĐÚNG một định dạng cố định để app tách được
 * phần tiếng Anh và phần nhận xét tiếng Việt.
 */
export function buildSystemPrompt(scenario: RoleplayScenario, learnerName: string): string {
  const who = learnerName.trim() ? `The learner's name is ${learnerName.trim()}.` : "";
  return [
    "You are a friendly Vietnamese-friendly office colleague helping someone practise workplace English.",
    scenario.setting,
    who,
    "",
    "RULES:",
    "- Reply in simple English at A2-B1 level. Short sentences, common words.",
    "- Your English reply must be 1 to 3 sentences and must ALWAYS end with a question.",
    "- Be warm and encouraging. Never lecture.",
    "",
    "You MUST answer in exactly this format, with these two markers on their own lines:",
    "[EN]",
    "<your English reply here>",
    "[VI]",
    "<short feedback in Vietnamese about the learner's last message: what was good, and one thing to fix. If they made a grammar or word-choice mistake, show the corrected sentence.>",
    "",
    "Never add anything before [EN] or after the Vietnamese feedback.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Tách phản hồi thành hai phần.
 * Cố ý khoan dung: model đôi khi quên marker, khi đó vẫn hiển thị được
 * thay vì báo lỗi cho người học.
 */
export function parseAiReply(raw: string): AiReply {
  const text = raw.trim();

  const enMatch = text.match(/\[EN\]\s*([\s\S]*?)(?=\[VI\]|$)/i);
  const viMatch = text.match(/\[VI\]\s*([\s\S]*)$/i);

  const en = enMatch?.[1]?.trim() ?? "";
  const vi = viMatch?.[1]?.trim() ?? "";

  if (en && vi) return { en, vi };
  // Thiếu marker: coi toàn bộ là lời thoại tiếng Anh, không có nhận xét.
  if (!en && !vi) return { en: text, vi: "" };
  return { en: en || text, vi };
}

interface GroqChoice {
  message?: { content?: string };
}

interface GroqResponse {
  choices?: GroqChoice[];
  error?: { message?: string };
}

export interface SendChatOptions {
  apiKey: string;
  scenario: RoleplayScenario;
  learnerName: string;
  history: ChatTurn[];
  /** Cho phép test bơm fetch giả. */
  fetchImpl?: typeof fetch;
  models?: readonly string[];
}

/**
 * Gửi hội thoại lên Groq, tự thử lần lượt các model dự phòng.
 * Ném AiError với thông báo tiếng Việt + thông báo gốc.
 */
export async function sendChat(opts: SendChatOptions): Promise<AiReply> {
  const {
    apiKey,
    scenario,
    learnerName,
    history,
    fetchImpl = fetch,
    models = GROQ_MODELS,
  } = opts;

  if (!apiKey.trim()) {
    throw new AiError("no-key", "API key is empty");
  }

  const messages = [
    { role: "system" as const, content: buildSystemPrompt(scenario, learnerName) },
    ...history,
  ];

  let lastError: AiError | null = null;

  for (const model of models) {
    let res: Response;
    try {
      res = await fetchImpl(GROQ_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 400,
        }),
      });
    } catch (e) {
      // fetch chỉ ném khi mất mạng / bị chặn CORS.
      throw new AiError("offline", e instanceof Error ? e.message : String(e));
    }

    if (res.ok) {
      const data = (await res.json()) as GroqResponse;
      const content = data.choices?.[0]?.message?.content ?? "";
      if (!content.trim()) {
        lastError = new AiError("unknown", `Model ${model} trả về nội dung rỗng`);
        continue;
      }
      return parseAiReply(content);
    }

    const kind = classifyHttpStatus(res.status);
    const detail = await readErrorDetail(res, model);

    // Key sai thì đổi model cũng vô ích -> dừng ngay.
    if (kind === "bad-key" || kind === "no-key") throw new AiError(kind, detail);

    lastError = new AiError(kind, detail);
    // rate-limit / lỗi server / model không tồn tại -> thử model kế tiếp.
  }

  throw lastError ?? new AiError("unknown", "Không có model nào phản hồi");
}

async function readErrorDetail(res: Response, model: string): Promise<string> {
  try {
    const data = (await res.json()) as GroqResponse;
    const msg = data.error?.message ?? JSON.stringify(data);
    return `HTTP ${res.status} (${model}): ${msg}`;
  } catch {
    return `HTTP ${res.status} (${model}): ${res.statusText}`;
  }
}
