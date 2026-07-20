/**
 * Tiện ích xử lý chuỗi thuần (không phụ thuộc DOM) dùng cho phần chấm bài.
 */

/** Bỏ dấu tiếng Việt: "được" -> "duoc". Cũng xử lý riêng chữ đ/Đ. */
export function stripVietnameseTones(input: string): string {
  return input
    .normalize("NFD")
    // U+0300..U+036F là các dấu tổ hợp (huyền, sắc, hỏi, ngã, nặng, mũ...)
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/**
 * Chuẩn hoá câu trả lời trước khi so sánh:
 * chữ thường, bỏ dấu câu, gộp khoảng trắng.
 * KHÔNG bỏ dấu tiếng Việt ở bước này — việc đó do `foldForCompare` làm,
 * để phần hiển thị vẫn giữ được nguyên văn.
 */
export function normalizeText(input: string): string {
  return input
    .normalize("NFC")
    .toLowerCase()
    // Giữ lại chữ cái (mọi ngôn ngữ), chữ số và khoảng trắng; còn lại thành khoảng trắng.
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Chuẩn hoá + bỏ dấu, dùng để so sánh "không phân biệt dấu tiếng Việt". */
export function foldForCompare(input: string): string {
  return stripVietnameseTones(normalizeText(input));
}

/** Tách thành mảng từ đã chuẩn hoá và bỏ dấu. */
export function tokenize(input: string): string[] {
  const folded = foldForCompare(input);
  return folded.length === 0 ? [] : folded.split(" ");
}

/**
 * Từ phụ (function words) bị loại khi tính "tỉ lệ từ cốt lõi trùng khớp".
 * Gồm cả tiếng Anh và tiếng Việt vì cùng một hàm chấm dùng cho cả hai chiều dịch.
 */
export const STOP_WORDS: ReadonlySet<string> = new Set([
  // tiếng Anh
  "a", "an", "the", "is", "are", "am", "was", "were", "be", "been", "being",
  "to", "of", "in", "on", "at", "for", "with", "and", "or", "but", "so",
  "do", "does", "did", "will", "would", "can", "could", "shall", "should",
  "may", "might", "must", "have", "has", "had", "it", "its", "this", "that",
  "these", "those", "there", "here", "as", "if", "then", "than", "from",
  "by", "about", "into", "over", "you", "your", "i", "my", "me", "we", "our",
  "us", "he", "she", "his", "her", "they", "them", "their", "s", "t", "re",
  "ll", "ve", "m", "d",
  // tiếng Việt
  "la", "thi", "ma", "va", "hoac", "nhung", "cua", "cho", "voi", "o", "tai",
  "den", "tu", "ve", "trong", "ngoai", "tren", "duoi", "mot", "cac", "nhung",
  "nay", "do", "kia", "ay", "rat", "qua", "lam", "duoc", "co", "khong",
  "roi", "da", "se", "dang", "cung", "nen", "vi", "boi", "rang", "a", "ah",
  "nhe", "nha", "ha", "u", "toi", "ban", "anh", "chi", "em", "minh", "ho",
  "chung", "ta", "no", "ai", "gi", "sao", "the", "hay",
]);

/** Bỏ từ phụ; nếu bỏ hết thì giữ nguyên danh sách gốc để không chia cho 0. */
export function coreTokens(input: string): string[] {
  const all = tokenize(input);
  const core = all.filter((w) => !STOP_WORDS.has(w));
  return core.length > 0 ? core : all;
}
