/**
 * Sao lưu / khôi phục toàn bộ dữ liệu học (IndexedDB + store).
 *
 * Nguyên tắc khi NHẬP: dữ liệu sai kiểu thì BỎ QUA phần đó, tuyệt đối không
 * làm hỏng phần còn lại. Người dùng thà mất một trường còn hơn mất cả tiến độ,
 * và file sao lưu có thể đến từ phiên bản app cũ hơn.
 *
 * Logic thuần, có unit test.
 */
import { z } from "zod";

export const BACKUP_VERSION = 1;

const WordStatSchema = z.object({
  correct: z.number().int().min(0),
  wrong: z.number().int().min(0),
  lastSeen: z.number().min(0),
});

const ActivityLogEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["vocab", "listen", "shadow", "reply", "chat"]),
  refId: z.string().optional(),
  count: z.number().int().min(0).optional(),
  at: z.number().min(0),
});

const SessionCheckpointSchema = z.object({
  cardIds: z.array(z.string()),
  index: z.number().int().min(0),
  correctCount: z.number().int().min(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updatedAt: z.number().min(0),
});

const StoreSchema = z.object({
  learnerName: z.string(),
  level: z.union([z.literal(20), z.literal(40), z.literal(60)]),
  wordsPerSession: z.number().int().min(1).max(100),
  streak: z.number().int().min(0),
  bestStreak: z.number().int().min(0),
  lastCompletedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  currentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  doneToday: z.array(z.string()),
  todayPlanKey: z.string().nullable(),
  apiKey: z.string(),
});

export type BackupStore = z.infer<typeof StoreSchema>;
export type BackupWordStat = z.infer<typeof WordStatSchema>;
export type BackupLogEntry = z.infer<typeof ActivityLogEntrySchema>;
export type BackupSession = z.infer<typeof SessionCheckpointSchema>;

export interface BackupFile {
  app: "tieng-anh-cong-so";
  version: number;
  exportedAt: string;
  store: Partial<BackupStore>;
  wordStats: Record<string, BackupWordStat>;
  activityLog: BackupLogEntry[];
  sessions: Record<string, BackupSession>;
}

export interface ImportResult {
  store: Partial<BackupStore>;
  wordStats: Record<string, BackupWordStat>;
  activityLog: BackupLogEntry[];
  sessions: Record<string, BackupSession>;
  /** Mô tả tiếng Việt những gì đã bị bỏ qua vì sai kiểu. */
  skipped: string[];
}

export function buildBackup(
  store: Partial<BackupStore>,
  wordStats: Record<string, unknown>,
  activityLog: unknown[],
  exportedAt: string,
  sessions: Record<string, unknown> = {},
): BackupFile {
  const parsed = parseBackup({
    app: "tieng-anh-cong-so",
    version: BACKUP_VERSION,
    exportedAt,
    store,
    wordStats,
    activityLog,
    sessions,
  });

  return {
    app: "tieng-anh-cong-so",
    version: BACKUP_VERSION,
    exportedAt,
    store: parsed.store,
    wordStats: parsed.wordStats,
    activityLog: parsed.activityLog,
    sessions: parsed.sessions,
  };
}

/**
 * Đọc nội dung file sao lưu một cách "khoan dung":
 * lọc từng phần tử, giữ lại những gì hợp lệ, liệt kê phần bị bỏ.
 */
export function parseBackup(raw: unknown): ImportResult {
  const skipped: string[] = [];
  const empty: ImportResult = {
    store: {},
    wordStats: {},
    activityLog: [],
    sessions: {},
    skipped,
  };

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    skipped.push("File sao lưu không đúng định dạng JSON của ứng dụng.");
    return empty;
  }

  const obj = raw as Record<string, unknown>;

  // --- store: xét TỪNG TRƯỜNG, sai trường nào bỏ trường đó ---
  const store: Partial<BackupStore> = {};
  if (typeof obj.store === "object" && obj.store !== null && !Array.isArray(obj.store)) {
    const rawStore = obj.store as Record<string, unknown>;
    for (const [key, fieldSchema] of Object.entries(StoreSchema.shape)) {
      if (!(key in rawStore)) continue;
      const result = fieldSchema.safeParse(rawStore[key]);
      if (result.success) {
        // Ghi theo từng khoá đã được schema xác nhận.
        (store as Record<string, unknown>)[key] = result.data;
      } else {
        skipped.push(`Bỏ qua cài đặt "${key}" vì sai kiểu dữ liệu.`);
      }
    }
  } else if (obj.store !== undefined) {
    skipped.push("Bỏ qua phần cài đặt vì sai định dạng.");
  }

  // --- wordStats: bỏ từng mục hỏng ---
  const wordStats: Record<string, BackupWordStat> = {};
  if (
    typeof obj.wordStats === "object" &&
    obj.wordStats !== null &&
    !Array.isArray(obj.wordStats)
  ) {
    let bad = 0;
    for (const [key, value] of Object.entries(obj.wordStats as Record<string, unknown>)) {
      const result = WordStatSchema.safeParse(value);
      if (result.success) wordStats[key] = result.data;
      else bad += 1;
    }
    if (bad > 0) skipped.push(`Bỏ qua ${bad} mục thống kê từ vựng bị hỏng.`);
  } else if (obj.wordStats !== undefined) {
    skipped.push("Bỏ qua phần thống kê từ vựng vì sai định dạng.");
  }

  // --- activityLog: bỏ từng dòng hỏng ---
  const activityLog: BackupLogEntry[] = [];
  if (Array.isArray(obj.activityLog)) {
    let bad = 0;
    for (const entry of obj.activityLog) {
      const result = ActivityLogEntrySchema.safeParse(entry);
      if (result.success) activityLog.push(result.data);
      else bad += 1;
    }
    if (bad > 0) skipped.push(`Bỏ qua ${bad} dòng nhật ký hoạt động bị hỏng.`);
  } else if (obj.activityLog !== undefined) {
    skipped.push("Bỏ qua phần nhật ký hoạt động vì sai định dạng.");
  }

  // --- sessions: bỏ từng buổi hỏng ---
  const sessions: Record<string, BackupSession> = {};
  if (
    typeof obj.sessions === "object" &&
    obj.sessions !== null &&
    !Array.isArray(obj.sessions)
  ) {
    let bad = 0;
    for (const [key, value] of Object.entries(obj.sessions as Record<string, unknown>)) {
      const result = SessionCheckpointSchema.safeParse(value);
      if (result.success) sessions[key] = result.data;
      else bad += 1;
    }
    if (bad > 0) skipped.push(`Bỏ qua ${bad} buổi học dở bị hỏng.`);
  } else if (obj.sessions !== undefined) {
    skipped.push("Bỏ qua phần buổi học dở vì sai định dạng.");
  }

  return { store, wordStats, activityLog, sessions, skipped };
}

/** Tên file gợi ý khi tải sao lưu về. */
export function backupFileName(date: string): string {
  return `tieng-anh-cong-so-${date}.json`;
}
