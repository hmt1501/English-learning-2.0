"use client";

/**
 * Cầu nối giữa hàm thuần buildDailyPlan() và phần giao diện.
 *
 * Quy tắc React Compiler được tôn trọng ở đây:
 *   - "hôm nay là ngày nào" chỉ được đọc trong useEffect (new Date() là nguồn
 *     dữ liệu thay đổi, không được gọi khi render);
 *   - mọi thao tác ghi (đánh dấu hoàn thành, cộng streak) nằm trong event
 *     handler, không nằm trong render.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  appendActivity,
  loadActivityLog,
  topicLastLearnedFromLog,
  type ActivityLogEntry,
  type ActivityLogType,
} from "./db";
import { toLocalDateString } from "./date";
import {
  applyDayCompletion,
  buildDailyPlan,
  isPlanComplete,
  planKey,
  type Activity,
} from "./plan";
import { dialogues, scenarios, topics } from "./content";
import { useAppStore } from "./store";

/** Ngày hôm nay (giờ địa phương), null cho tới khi component mount. */
export function useToday(): string | null {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setToday(toLocalDateString(new Date()));
    update();

    // Người dùng có thể mở app qua đêm hoặc để tab chạy nền -> kiểm tra lại
    // khi quay lại tab để "ngày hôm nay" không bị kẹt ở hôm qua.
    const onVisible = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return today;
}

/** Nhật ký hoạt động, tải một lần từ IndexedDB. */
export function useActivityLog(): {
  log: ActivityLogEntry[];
  ready: boolean;
  reload: () => void;
} {
  const [log, setLog] = useState<ActivityLogEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    loadActivityLog().then((l) => {
      if (!alive) return;
      setLog(l);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { log, ready, reload };
}

export interface DailyPlanState {
  today: string | null;
  plan: Activity[];
  doneIds: string[];
  ready: boolean;
  complete: boolean;
}

/** Kế hoạch hôm nay + trạng thái hoàn thành. */
export function useDailyPlan(): DailyPlanState {
  const today = useToday();
  const { log, ready: logReady } = useActivityLog();

  const level = useAppStore((s) => s.level);
  const wordsPerSession = useAppStore((s) => s.wordsPerSession);
  const doneToday = useAppStore((s) => s.doneToday);
  const currentDate = useAppStore((s) => s.currentDate);
  const startDay = useAppStore((s) => s.startDay);

  const plan = useMemo(() => {
    if (!today || !logReady) return [];
    return buildDailyPlan({
      today,
      level,
      wordsPerSession,
      topics,
      dialogues: dialogues.map((d) => ({ id: d.id, titleVi: d.titleVi })),
      scenarios: scenarios.map((s) => ({ id: s.id, titleVi: s.titleVi })),
      topicLastLearned: topicLastLearnedFromLog(log),
    });
  }, [today, logReady, log, level, wordsPerSession]);

  const key = today ? planKey({ today, level, wordsPerSession }) : null;

  // Sang ngày mới (hoặc đổi cài đặt) thì reset danh sách "đã làm hôm nay".
  useEffect(() => {
    if (today && key) startDay(today, key);
  }, [today, key, startDay]);

  // Ngày đã đổi nhưng store chưa kịp reset -> coi như chưa làm gì.
  const doneIds = currentDate === today ? doneToday : [];

  return {
    today,
    plan,
    doneIds,
    ready: today !== null && logReady,
    complete: isPlanComplete(plan, doneIds),
  };
}

export interface CompleteInput {
  /** id hoạt động trong kế hoạch, ví dụ "vocab:greetings:learn" */
  activityId: string;
  type: ActivityLogType;
  refId?: string;
  count?: number;
}

/**
 * Ghi công một hoạt động đã hoàn thành:
 *   1. thêm dòng nhật ký vào IndexedDB;
 *   2. đánh dấu mục đó đã xong trong ngày (để hiện ✅);
 *   3. nếu xong TOÀN BỘ kế hoạch thì cộng streak.
 *
 * Chat với AI cố ý KHÔNG đi qua đây: nó là phần luyện thêm, không nằm trong
 * kế hoạch và không ảnh hưởng streak.
 */
export function useCompleteActivity() {
  const { plan } = useDailyPlan();

  return useCallback(
    async (input: CompleteInput) => {
      const now = new Date();
      const today = toLocalDateString(now);

      await appendActivity({
        date: today,
        type: input.type,
        refId: input.refId,
        count: input.count,
        at: now.getTime(),
      });

      const store = useAppStore.getState();
      store.markDone(input.activityId);

      const doneIds = [...new Set([...store.doneToday, input.activityId])];
      if (isPlanComplete(plan, doneIds)) {
        const next = applyDayCompletion(
          {
            streak: store.streak,
            bestStreak: store.bestStreak,
            lastCompletedDate: store.lastCompletedDate,
          },
          today,
        );
        store.setStreak(next);
      }
    },
    [plan],
  );
}
