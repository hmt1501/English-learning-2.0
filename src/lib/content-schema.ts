/**
 * Schema nội dung học — DÙNG CHUNG cho app (import qua TypeScript) và cho
 * script kiểm tra `scripts/validate-content.mjs` (Node 24 đọc thẳng file .ts).
 *
 * Vì file này được Node nạp trực tiếp bằng cơ chế "type stripping", ở đây
 * KHÔNG được dùng các cú pháp TS cần biên dịch thật (enum, namespace,
 * parameter property) và KHÔNG được import theo alias "@/...".
 */
import { z } from "zod";

/** Chuỗi bắt buộc có nội dung (không rỗng, không chỉ toàn khoảng trắng). */
const nonEmpty = z.string().trim().min(1);

/** id chỉ gồm chữ thường, số và dấu gạch ngang — vì id được dùng làm tên file audio. */
const idString = z
  .string()
  .regex(/^[a-z0-9-]+$/, "id chỉ được chứa chữ thường, số và dấu gạch ngang");

export const TopicSchema = z.object({
  id: idString,
  titleVi: nonEmpty,
  emoji: nonEmpty,
});

export const CardSchema = z.object({
  id: idString,
  chunk: nonEmpty,
  meaningVi: nonEmpty,
  example: nonEmpty,
  exampleVi: nonEmpty,
  cue: nonEmpty,
  cloze: nonEmpty,
  audio: z.string().regex(/^vocab\/[a-z0-9-]+\.mp3$/, "audio phải có dạng vocab/<id>.mp3"),
});

export const DeckSchema = z.array(CardSchema).min(1);

export const DialogueLineSchema = z.object({
  id: idString,
  speaker: nonEmpty,
  en: nonEmpty,
  vi: nonEmpty,
  audio: z
    .string()
    .regex(/^dialogues\/[a-z0-9-]+\.mp3$/, "audio phải có dạng dialogues/<id>.mp3"),
});

export const DialogueQuestionSchema = z.object({
  id: idString,
  questionVi: nonEmpty,
  options: z.array(nonEmpty).min(2),
  answerIndex: z.number().int().min(0),
  explainVi: nonEmpty,
});

export const DialogueSchema = z
  .object({
    id: idString,
    titleVi: nonEmpty,
    topic: idString,
    summaryVi: nonEmpty,
    lines: z.array(DialogueLineSchema).min(1),
    questions: z.array(DialogueQuestionSchema).min(1),
  })
  .refine(
    (d) => d.questions.every((q) => q.answerIndex < q.options.length),
    { message: "answerIndex vượt quá số lựa chọn" },
  );

export const ThreadMessageSchema = z.object({
  from: nonEmpty,
  text: nonEmpty,
});

export const SrsCardSchema = z.object({
  id: idString,
  chunk: nonEmpty,
  meaningVi: nonEmpty,
  audio: z.string().regex(/^vocab\/[a-z0-9-]+\.mp3$/, "audio phải có dạng vocab/<id>.mp3"),
});

export const ScenarioSchema = z.object({
  id: idString,
  titleVi: nonEmpty,
  topic: idString,
  situationVi: nonEmpty,
  thread: z.array(ThreadMessageSchema).min(1),
  hints: z.array(nonEmpty).min(1),
  modelAnswers: z.array(nonEmpty).min(1),
  rubricVi: z.array(nonEmpty).min(1),
  srsCards: z.array(SrsCardSchema),
});

export type Topic = z.infer<typeof TopicSchema>;
export type Card = z.infer<typeof CardSchema>;
export type Deck = z.infer<typeof DeckSchema>;
export type DialogueLine = z.infer<typeof DialogueLineSchema>;
export type DialogueQuestion = z.infer<typeof DialogueQuestionSchema>;
export type Dialogue = z.infer<typeof DialogueSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type SrsCard = z.infer<typeof SrsCardSchema>;
export type ThreadMessage = z.infer<typeof ThreadMessageSchema>;
