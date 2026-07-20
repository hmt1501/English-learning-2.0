/**
 * Kiểm tra toàn bộ nội dung học trước khi build.
 *
 * Dùng CHUNG schema zod với app (src/lib/content-schema.ts) — Node 24 đọc
 * thẳng file .ts được nên không cần bước biên dịch riêng, và schema không bao
 * giờ bị lệch giữa app và script.
 *
 * Chạy:  npm run validate     (tự chạy trước `npm run build`)
 */
import { readdir, readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const {
  TopicSchema,
  DeckSchema,
  DialogueSchema,
  ScenarioSchema,
} = await import("../src/lib/content-schema.ts");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = join(root, "content");
const audioDir = join(root, "public", "audio");

const errors = [];
const warnings = [];

const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Gom lỗi zod thành dòng dễ đọc. */
function zodIssues(result) {
  return result.error.issues
    .map((i) => `  - ${i.path.join(".") || "(gốc)"}: ${i.message}`)
    .join("\n");
}

// ---------------------------------------------------------------- chủ đề ---
const topics = await readJson(join(contentDir, "topics.json"));
const topicIds = new Set();

if (!Array.isArray(topics)) {
  fail("topics.json", "phải là một mảng");
} else {
  for (const [i, topic] of topics.entries()) {
    const parsed = TopicSchema.safeParse(topic);
    if (!parsed.success) {
      fail(`topics.json[${i}]`, `sai schema\n${zodIssues(parsed)}`);
      continue;
    }
    if (topicIds.has(topic.id)) fail("topics.json", `id trùng: "${topic.id}"`);
    topicIds.add(topic.id);
  }
}

// ------------------------------------------------------------------ deck ---
/** Mọi id thẻ trên toàn bộ nội dung — id phải là DUY NHẤT vì gắn với tên file audio. */
const allCardIds = new Set();
const audioRefs = [];

const deckDir = join(contentDir, "decks");
const deckFiles = (await readdir(deckDir)).filter((f) => f.endsWith(".json")).sort();

for (const file of deckFiles) {
  const where = `decks/${file}`;
  const topicId = basename(file, ".json");

  if (!topicIds.has(topicId)) {
    fail(where, `tên file "${topicId}" không khớp id chủ đề nào trong topics.json`);
  }

  const deck = await readJson(join(deckDir, file));
  const parsed = DeckSchema.safeParse(deck);
  if (!parsed.success) {
    fail(where, `sai schema\n${zodIssues(parsed)}`);
    continue;
  }

  for (const card of deck) {
    if (allCardIds.has(card.id)) fail(where, `id thẻ bị trùng: "${card.id}"`);
    allCardIds.add(card.id);

    // id là bất biến và gắn với tên file audio -> hai thứ phải khớp nhau.
    if (card.audio !== `vocab/${card.id}.mp3`) {
      fail(where, `thẻ "${card.id}": audio phải là "vocab/${card.id}.mp3", đang là "${card.audio}"`);
    }
    audioRefs.push({ where, id: card.id, rel: card.audio, text: card.chunk });

    // Thẻ phải dạy đúng cụm từ của nó.
    if (!card.example.toLowerCase().includes(card.chunk.toLowerCase())) {
      fail(where, `thẻ "${card.id}": câu ví dụ không chứa cụm từ "${card.chunk}"`);
    }
    if (!card.cloze.includes("___")) {
      fail(where, `thẻ "${card.id}": cloze phải có chỗ trống "___"`);
    }
  }
}

for (const topicId of topicIds) {
  if (!deckFiles.includes(`${topicId}.json`)) {
    fail("decks/", `thiếu file deck cho chủ đề "${topicId}"`);
  }
}

// ------------------------------------------------------------- hội thoại ---
const dialogueDir = join(contentDir, "dialogues");
const dialogueFiles = (await readdir(dialogueDir)).filter((f) => f.endsWith(".json")).sort();
const dialogueIds = new Set();

for (const file of dialogueFiles) {
  const where = `dialogues/${file}`;
  const dialogue = await readJson(join(dialogueDir, file));

  const parsed = DialogueSchema.safeParse(dialogue);
  if (!parsed.success) {
    fail(where, `sai schema\n${zodIssues(parsed)}`);
    continue;
  }

  if (dialogue.id !== basename(file, ".json")) {
    fail(where, `id "${dialogue.id}" không khớp tên file`);
  }
  if (dialogueIds.has(dialogue.id)) fail(where, `id trùng: "${dialogue.id}"`);
  dialogueIds.add(dialogue.id);

  if (!topicIds.has(dialogue.topic)) {
    fail(where, `topic "${dialogue.topic}" không có trong topics.json`);
  }

  const lineIds = new Set();
  for (const line of dialogue.lines) {
    if (lineIds.has(line.id)) fail(where, `id lời thoại trùng: "${line.id}"`);
    lineIds.add(line.id);

    if (!line.id.startsWith(dialogue.id)) {
      fail(where, `lời thoại "${line.id}" phải bắt đầu bằng id hội thoại`);
    }
    if (line.audio !== `dialogues/${line.id}.mp3`) {
      fail(where, `lời thoại "${line.id}": audio phải là "dialogues/${line.id}.mp3"`);
    }
    audioRefs.push({ where, id: line.id, rel: line.audio, text: line.en, slow: true });
  }

  for (const q of dialogue.questions) {
    if (q.answerIndex >= q.options.length) {
      fail(where, `câu hỏi "${q.id}": answerIndex ${q.answerIndex} vượt quá số lựa chọn`);
    }
  }
}

// ------------------------------------------------------------ tình huống ---
const scenarioDir = join(contentDir, "scenarios");
const scenarioFiles = (await readdir(scenarioDir)).filter((f) => f.endsWith(".json")).sort();
const scenarioIds = new Set();

for (const file of scenarioFiles) {
  const where = `scenarios/${file}`;
  const scenario = await readJson(join(scenarioDir, file));

  const parsed = ScenarioSchema.safeParse(scenario);
  if (!parsed.success) {
    fail(where, `sai schema\n${zodIssues(parsed)}`);
    continue;
  }

  if (scenario.id !== basename(file, ".json")) {
    fail(where, `id "${scenario.id}" không khớp tên file`);
  }
  if (scenarioIds.has(scenario.id)) fail(where, `id trùng: "${scenario.id}"`);
  scenarioIds.add(scenario.id);

  if (!topicIds.has(scenario.topic)) {
    fail(where, `topic "${scenario.topic}" không có trong topics.json`);
  }

  for (const card of scenario.srsCards) {
    if (allCardIds.has(card.id)) fail(where, `id thẻ bị trùng với nơi khác: "${card.id}"`);
    allCardIds.add(card.id);

    if (card.audio !== `vocab/${card.id}.mp3`) {
      fail(where, `thẻ "${card.id}": audio phải là "vocab/${card.id}.mp3"`);
    }
    audioRefs.push({ where, id: card.id, rel: card.audio, text: card.chunk });

    // Cụm từ phải thực sự xuất hiện trong câu mẫu, nếu không người học không có chỗ để học nó.
    const inModel = scenario.modelAnswers.some((m) =>
      m.toLowerCase().includes(card.chunk.toLowerCase()),
    );
    if (!inModel) {
      fail(where, `cụm từ "${card.chunk}" không xuất hiện trong câu mẫu nào`);
    }
  }
}

// ---------------------------------------------------------------- audio ----
// Thiếu file MP3 chỉ là CẢNH BÁO, không phải lỗi: app tự chuyển sang giọng đọc
// của trình duyệt, và ta không muốn chặn build chỉ vì chưa kịp chạy TTS.
let missingAudio = 0;
for (const ref of audioRefs) {
  if (!(await exists(join(audioDir, ref.rel)))) missingAudio += 1;
}
if (missingAudio > 0) {
  warn(
    "audio",
    `thiếu ${missingAudio}/${audioRefs.length} file MP3 — app sẽ dùng giọng đọc của trình duyệt. ` +
      `Chạy "npm run audio" để sinh file còn thiếu.`,
  );
}

// ----------------------------------------------------------------- báo cáo -
console.log("Kiểm tra nội dung học");
console.log(`  chủ đề     : ${topicIds.size}`);
console.log(`  deck       : ${deckFiles.length} file, ${allCardIds.size} thẻ (kể cả thẻ trong tình huống)`);
console.log(`  hội thoại  : ${dialogueIds.size}`);
console.log(`  tình huống : ${scenarioIds.size}`);
console.log(`  audio      : ${audioRefs.length} tham chiếu`);

if (warnings.length > 0) {
  console.log(`\n⚠ ${warnings.length} cảnh báo:`);
  for (const w of warnings) console.log(`  ${w}`);
}

if (errors.length > 0) {
  console.error(`\n✖ ${errors.length} lỗi:`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

console.log("\n✓ Nội dung hợp lệ.");
