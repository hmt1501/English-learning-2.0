/**
 * Dữ liệu "nặng" và hay ghi: đặt ở IndexedDB (qua idb-keyval), không nhét vào
 * localStorage để tránh đầy quota và tránh chặn luồng chính.
 *
 * Gồm hai kho:
 *   - wordStats: thống kê từng thẻ theo từng chế độ học
 *   - activityLog: nhật ký hoạt động theo ngày (để vẽ lịch sử học)
 */
import { get, set } from "idb-keyval";
import type { WordStats } from "./stats";
import type { SessionCheckpoint, SessionStore } from "./session";

const KEY_WORD_STATS = "wordStats";
const KEY_ACTIVITY_LOG = "activityLog";
const KEY_SESSIONS = "sessions";

export type ActivityLogType =
  | "vocab"
  | "listen"
  | "shadow"
  | "reply"
  | "chat";

export interface ActivityLogEntry {
  /** YYYY-MM-DD theo giờ địa phương */
  date: string;
  type: ActivityLogType;
  /** id chủ đề / hội thoại / tình huống liên quan */
  refId?: string;
  /** số câu đã làm trong lần đó */
  count?: number;
  /** epoch ms */
  at: number;
}

export async function loadWordStats(): Promise<WordStats> {
  return (await get<WordStats>(KEY_WORD_STATS)) ?? {};
}

export async function saveWordStats(stats: WordStats): Promise<void> {
  await set(KEY_WORD_STATS, stats);
}

export async function loadActivityLog(): Promise<ActivityLogEntry[]> {
  return (await get<ActivityLogEntry[]>(KEY_ACTIVITY_LOG)) ?? [];
}

export async function saveActivityLog(log: ActivityLogEntry[]): Promise<void> {
  await set(KEY_ACTIVITY_LOG, log);
}

// --------------------------------------------- buổi học đang làm dở ------

export async function loadSessions(): Promise<SessionStore> {
  return (await get<SessionStore>(KEY_SESSIONS)) ?? {};
}

export async function saveSessions(sessions: SessionStore): Promise<void> {
  await set(KEY_SESSIONS, sessions);
}

/** Ghi checkpoint của một buổi. Gọi sau MỖI câu để thoát ra vẫn giữ được. */
export async function saveSession(
  key: string,
  checkpoint: SessionCheckpoint,
): Promise<void> {
  const all = await loadSessions();
  all[key] = checkpoint;
  await saveSessions(all);
}

/** Xoá checkpoint khi buổi học đã hoàn tất. */
export async function clearSession(key: string): Promise<void> {
  const all = await loadSessions();
  if (!(key in all)) return;
  delete all[key];
  await saveSessions(all);
}

/** Ghi thêm một dòng nhật ký. Đọc–sửa–ghi nên chỉ gọi từ event handler. */
export async function appendActivity(entry: ActivityLogEntry): Promise<void> {
  const log = await loadActivityLog();
  log.push(entry);
  // Giữ lại 2000 dòng gần nhất để file sao lưu không phình vô hạn.
  await saveActivityLog(log.slice(-2000));
}

/** Số ngày khác nhau đã có hoạt động — hiển thị ở trang Hôm nay. */
export function countActiveDays(log: ActivityLogEntry[]): number {
  return new Set(log.map((e) => e.date)).size;
}

/**
 * Ngày gần nhất từng học từ vựng của mỗi chủ đề — đầu vào cho việc xoay vòng
 * chủ đề trong kế hoạch hằng ngày.
 */
export function topicLastLearnedFromLog(
  log: ActivityLogEntry[],
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const e of log) {
    if (e.type !== "vocab" || !e.refId) continue;
    const prev = out[e.refId];
    if (!prev || e.date > prev) out[e.refId] = e.date;
  }
  return out;
}
