import type { StudyMode } from "./grade";

/** Mô tả ba cách học từ vựng — dùng chung cho danh sách chủ đề và màn chọn cách học. */
export interface ModeInfo {
  id: StudyMode;
  titleVi: string;
  shortVi: string;
  descVi: string;
  emoji: string;
}

export const MODE_LIST: ModeInfo[] = [
  {
    id: "learn",
    titleVi: "Học từ vựng",
    shortVi: "Học từ",
    descVi: "Xem trước cụm từ, nghĩa và câu ví dụ, sau đó gõ lại nghĩa tiếng Việt.",
    emoji: "📖",
  },
  {
    id: "en2vi",
    titleVi: "Dịch câu Anh → Việt",
    shortVi: "Anh → Việt",
    descVi: "Nghe và đọc câu tiếng Anh, gõ bản dịch tiếng Việt.",
    emoji: "🇬🇧",
  },
  {
    id: "vi2en",
    titleVi: "Dịch câu Việt → Anh",
    shortVi: "Việt → Anh",
    descVi: "Đọc câu tiếng Việt và gõ lại bằng tiếng Anh. Khó nhất, chấm chặt hơn.",
    emoji: "🇻🇳",
  },
];

export function getMode(id: string): ModeInfo | undefined {
  return MODE_LIST.find((m) => m.id === id);
}

export const MODE_IDS: StudyMode[] = MODE_LIST.map((m) => m.id);
