/**
 * Sinh file MP3 còn thiếu bằng Microsoft Edge TTS (miễn phí, không cần API key).
 *
 * Chạy INCREMENTAL: file nào đã có thì bỏ qua, nên chạy lại nhiều lần rất rẻ
 * và chỉ tốn thời gian cho nội dung mới thêm vào.
 *
 *   npm run audio              sinh file còn thiếu
 *   npm run audio -- --force   sinh lại tất cả (khi đổi giọng đọc)
 *   npm run audio -- --dry     chỉ liệt kê những gì sẽ sinh
 *
 * Ghi chú: id thẻ/lời thoại là BẤT BIẾN vì tên file audio bám theo id.
 * Đổi id đồng nghĩa với việc mọi file audio cũ thành rác.
 */
import { mkdir, readdir, readFile, access, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = join(root, "content");
const audioDir = join(root, "public", "audio");

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const DRY = args.includes("--dry");

/** Giọng đọc. Đổi giọng thì nhớ chạy lại với --force. */
const VOICE_DEFAULT = "en-US-AriaNeural";
const VOICE_POOL = ["en-US-GuyNeural", "en-US-AriaNeural"];

/** Tốc độ cho bản đọc chậm của lời thoại. */
const SLOW_RATE = "-25%";

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

// ------------------------------------------------ gom danh sách cần sinh ---
/** @type {{rel: string, text: string, voice: string, rate?: string}[]} */
const jobs = [];

// Thẻ từ vựng
const deckDir = join(contentDir, "decks");
for (const file of (await readdir(deckDir)).filter((f) => f.endsWith(".json"))) {
  for (const card of await readJson(join(deckDir, file))) {
    // Đọc cả câu ví dụ chứ không chỉ cụm từ rời -> nghe tự nhiên hơn nhiều.
    jobs.push({ rel: card.audio, text: card.example, voice: VOICE_DEFAULT });
  }
}

// Lời thoại (kèm biến thể đọc chậm)
const dialogueDir = join(contentDir, "dialogues");
for (const file of (await readdir(dialogueDir)).filter((f) => f.endsWith(".json"))) {
  const dialogue = await readJson(join(dialogueDir, file));

  // Mỗi người nói một giọng, gán theo thứ tự xuất hiện để cả bài nghe nhất quán.
  const speakers = [...new Set(dialogue.lines.map((l) => l.speaker))];

  for (const line of dialogue.lines) {
    const voice = VOICE_POOL[speakers.indexOf(line.speaker) % VOICE_POOL.length];
    jobs.push({ rel: line.audio, text: line.en, voice });
    jobs.push({
      rel: line.audio.replace(/\.mp3$/, "-slow.mp3"),
      text: line.en,
      voice,
      rate: SLOW_RATE,
    });
  }
}

// Cụm từ trong các tình huống
const scenarioDir = join(contentDir, "scenarios");
for (const file of (await readdir(scenarioDir)).filter((f) => f.endsWith(".json"))) {
  const scenario = await readJson(join(scenarioDir, file));
  for (const card of scenario.srsCards) {
    // Đọc câu mẫu chứa cụm từ nếu tìm được, để có ngữ cảnh.
    const sentence =
      scenario.modelAnswers.find((m) =>
        m.toLowerCase().includes(card.chunk.toLowerCase()),
      ) ?? card.chunk;
    jobs.push({ rel: card.audio, text: sentence, voice: VOICE_DEFAULT });
  }
}

// ------------------------------------------------------- lọc file đã có ---
const pending = [];
for (const job of jobs) {
  const out = join(audioDir, job.rel);
  if (!FORCE && (await exists(out))) continue;
  pending.push({ ...job, out });
}

console.log(`Tổng cộng ${jobs.length} file audio, cần sinh ${pending.length}.`);

if (pending.length === 0) {
  console.log("✓ Không thiếu file nào.");
  process.exit(0);
}

if (DRY) {
  for (const j of pending) console.log(`  sẽ sinh: ${j.rel}`);
  process.exit(0);
}

// ------------------------------------------------------------- sinh file ---
/** Mỗi giọng dùng một kết nối riêng, tránh setMetadata liên tục. */
const clients = new Map();

async function getClient(voice) {
  if (clients.has(voice)) return clients.get(voice);
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  clients.set(voice, tts);
  return tts;
}

async function synth(job) {
  const tts = await getClient(job.voice);
  const options = job.rate ? { rate: job.rate } : undefined;

  const chunks = [];
  const { audioStream } = tts.toStream(job.text, options);

  await new Promise((resolve, reject) => {
    audioStream.on("data", (c) => chunks.push(c));
    audioStream.on("end", resolve);
    audioStream.on("error", reject);
  });

  const buffer = Buffer.concat(chunks);
  if (buffer.length === 0) throw new Error("TTS trả về 0 byte");

  await mkdir(dirname(job.out), { recursive: true });
  // Ghi ra file tạm rồi đổi tên: đứt giữa chừng cũng không để lại file MP3 hỏng
  // (lần chạy sau sẽ tưởng file đã xong và bỏ qua).
  const tmp = `${job.out}.tmp`;
  await writeFile(tmp, buffer);
  await rename(tmp, job.out);

  return buffer.length;
}

let done = 0;
let failed = 0;

for (const job of pending) {
  try {
    const size = await synth(job);
    done += 1;
    console.log(`  ✓ [${done}/${pending.length}] ${job.rel} (${Math.round(size / 1024)} KB)`);
  } catch (e) {
    failed += 1;
    console.error(`  ✖ ${job.rel}: ${e.message}`);
  }
}

for (const tts of clients.values()) {
  try {
    tts.close();
  } catch {
    // đóng được thì tốt, không thì thôi
  }
}

console.log(`\nXong: ${done} file mới, ${failed} lỗi.`);
if (failed > 0) {
  console.log("Chạy lại lệnh này để thử tiếp những file bị lỗi (đã có thì tự bỏ qua).");
  process.exit(1);
}
