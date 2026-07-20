"use client";

/**
 * Cài đặt và tiến độ "nhẹ" -> localStorage qua zustand/persist.
 *
 * Lưu ý về hydration: giá trị đã persist chỉ có sau khi component mount.
 * Component nào đọc store để render thì phải dùng hook useMounted() để tránh
 * lệch giữa HTML tĩnh (server) và trình duyệt.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionLevel } from "./plan";

export interface AppState {
  learnerName: string;
  /** Quỹ thời gian mỗi buổi: 20 / 40 / 60 phút */
  level: SessionLevel;
  /** Số câu mỗi buổi học từ vựng */
  wordsPerSession: number;

  streak: number;
  bestStreak: number;
  /** Ngày gần nhất hoàn thành TOÀN BỘ kế hoạch (YYYY-MM-DD) */
  lastCompletedDate: string | null;

  /** Ngày mà `doneToday` / `todayPlanKey` đang mô tả */
  currentDate: string | null;
  /** id các hoạt động đã hoàn thành trong ngày hiện tại */
  doneToday: string[];
  /** Khoá kế hoạch hôm nay — đổi khoá mới sinh lại kế hoạch */
  todayPlanKey: string | null;

  /** API key do NGƯỜI DÙNG tự dán. Chỉ nằm trên máy họ, không bao giờ vào repo. */
  apiKey: string;

  setLearnerName: (v: string) => void;
  setLevel: (v: SessionLevel) => void;
  setWordsPerSession: (v: number) => void;
  setApiKey: (v: string) => void;

  /** Chuyển sang ngày mới: xoá tiến độ trong ngày, giữ streak. */
  startDay: (date: string, planKey: string) => void;
  markDone: (activityId: string) => void;
  setStreak: (s: { streak: number; bestStreak: number; lastCompletedDate: string | null }) => void;

  /** Ghi đè toàn bộ phần store khi khôi phục sao lưu. */
  replaceAll: (partial: Partial<AppState>) => void;
}

export const DEFAULT_STATE = {
  learnerName: "",
  level: 20 as SessionLevel,
  wordsPerSession: 10,
  streak: 0,
  bestStreak: 0,
  lastCompletedDate: null,
  currentDate: null,
  doneToday: [],
  todayPlanKey: null,
  apiKey: "",
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,

      setLearnerName: (v) => set({ learnerName: v }),
      setLevel: (v) => set({ level: v }),
      setWordsPerSession: (v) => set({ wordsPerSession: v }),
      setApiKey: (v) => set({ apiKey: v }),

      startDay: (date, planKey) =>
        set((s) =>
          s.currentDate === date && s.todayPlanKey === planKey
            ? s
            : { currentDate: date, todayPlanKey: planKey, doneToday: [] },
        ),

      markDone: (activityId) =>
        set((s) =>
          s.doneToday.includes(activityId)
            ? s
            : { doneToday: [...s.doneToday, activityId] },
        ),

      setStreak: (v) => set(v),

      replaceAll: (partial) => set(partial),
    }),
    {
      name: "tacs-app-state",
      version: 1,
    },
  ),
);
