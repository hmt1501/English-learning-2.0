/**
 * Chuyển file CSV thành deck JSON để soạn nội dung nhanh bằng bảng tính.
 *
 *   node scripts/csv-to-deck.mjs <file.csv> <topicId> [--out content/decks/<topicId>.json]
 *
 * CSV cần có dòng tiêu đề với các cột (thứ tự tuỳ ý):
 *   chunk, meaningVi, example, exampleVi, cue, cloze
 *
 * Các cột được sinh TỰ ĐỘNG nếu bỏ trống:
 *   - id    : "<topicId>-01", "<topicId>-02", ... theo thứ tự dòng
 *   - cloze : câu ví dụ với cụm từ thay bằng "___"
 *   - audio : "vocab/<id>.mp3"
 *
 * Sau khi chạy nhớ:  npm run validate  &&  npm run audio
 *
 * CẢNH BÁO: id sinh theo THỨ TỰ DÒNG. Chèn thêm một dòng vào giữa file CSV
 * cũ sẽ làm lệch id của mọi dòng phía sau, và mọi file audio đã sinh sẽ gắn
 * sai thẻ. Muốn thêm thẻ mới thì thêm vào CUỐI file.
 */
import { readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const [csvPath, topicId] = args.filter((a) => !a.startsWith("--"));

if (!csvPath || !topicId) {
  console.error(
    "Cách dùng: node scripts/csv-to-deck.mjs <file.csv> <topicId> [--out <đường dẫn>]",
  );
  process.exit(1);
}

const outFlag = args.indexOf("--out");
const outPath =
  outFlag !== -1 && args[outFlag + 1]
    ? resolve(args[outFlag + 1])
    : join(root, "content", "decks", `${topicId}.json`);

/**
 * Bộ đọc CSV tối giản nhưng đúng chuẩn RFC 4180 ở những chỗ hay gặp:
 * hỗ trợ dấu nháy kép, dấu phẩy trong ô, và "" để escape dấu nháy.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  // Bỏ BOM nếu file xuất từ Excel.
  const s = text.replace(/^﻿/, "");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      // Nuốt \r\n thành một lần xuống dòng.
      if (c === "\r" && s[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      // Bỏ qua dòng trống.
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);

  return rows;
}

/** Thay lần xuất hiện đầu tiên của cụm từ bằng "___" (không phân biệt hoa thường). */
function makeCloze(example, chunk) {
  const lower = example.toLowerCase();
  const at = lower.indexOf(chunk.toLowerCase());
  if (at === -1) return example;
  return example.slice(0, at) + "___" + example.slice(at + chunk.length);
}

const rows = parseCsv(await readFile(csvPath, "utf8"));

if (rows.length < 2) {
  console.error("CSV phải có dòng tiêu đề và ít nhất một dòng dữ liệu.");
  process.exit(1);
}

const header = rows[0].map((h) => h.trim());
const required = ["chunk", "meaningVi", "example", "exampleVi"];
const missing = required.filter((c) => !header.includes(c));

if (missing.length > 0) {
  console.error(`CSV thiếu cột bắt buộc: ${missing.join(", ")}`);
  console.error(`Cột đang có: ${header.join(", ")}`);
  process.exit(1);
}

const cards = [];
const problems = [];

rows.slice(1).forEach((row, i) => {
  const get = (name) => (row[header.indexOf(name)] ?? "").trim();
  const lineNo = i + 2;

  const chunk = get("chunk");
  const example = get("example");
  const id = `${topicId}-${String(i + 1).padStart(2, "0")}`;

  if (!chunk) problems.push(`dòng ${lineNo}: thiếu "chunk"`);
  if (!example) problems.push(`dòng ${lineNo}: thiếu "example"`);
  if (!get("meaningVi")) problems.push(`dòng ${lineNo}: thiếu "meaningVi"`);
  if (!get("exampleVi")) problems.push(`dòng ${lineNo}: thiếu "exampleVi"`);

  if (chunk && example && !example.toLowerCase().includes(chunk.toLowerCase())) {
    problems.push(`dòng ${lineNo}: câu ví dụ không chứa cụm từ "${chunk}"`);
  }

  cards.push({
    id,
    chunk,
    meaningVi: get("meaningVi"),
    example,
    exampleVi: get("exampleVi"),
    cue: get("cue") || `Khi bạn cần dùng "${chunk}"`,
    cloze: get("cloze") || makeCloze(example, chunk),
    audio: `vocab/${id}.mp3`,
  });
});

if (problems.length > 0) {
  console.error(`✖ ${problems.length} vấn đề trong CSV:`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

// Cảnh báo nếu ghi đè lên deck đã có nhiều thẻ hơn -> nhiều khả năng là nhầm file.
try {
  await access(outPath);
  const old = JSON.parse(await readFile(outPath, "utf8"));
  if (Array.isArray(old) && old.length > cards.length) {
    console.warn(
      `⚠ ${outPath} đang có ${old.length} thẻ, file mới chỉ có ${cards.length}. ` +
        `Kiểm tra lại xem có nhầm file không — id cũ mất đi sẽ làm audio thành rác.`,
    );
  }
} catch {
  // Chưa có file thì cứ ghi mới.
}

await writeFile(outPath, JSON.stringify(cards, null, 2) + "\n", "utf8");

console.log(`✓ Đã ghi ${cards.length} thẻ vào ${outPath}`);
console.log("Bước tiếp theo: npm run validate && npm run audio");
