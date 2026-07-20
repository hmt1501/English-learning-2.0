"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadWordStats, saveWordStats } from "./db";
import { recordAnswer, reviseAnswer, type WordStats } from "./stats";
import type { StudyMode } from "./grade";

/**
 * Thống kê từ vựng, đồng bộ với IndexedDB.
 *
 * Hành vi cố ý: GHI NGAY sau mỗi câu trả lời. Người học thoát giữa chừng vẫn
 * giữ được tiến độ từng câu — chỉ có phần "đã học hôm nay" là cần hoàn tất
 * buổi mới được ghi công.
 */
export function useWordStats() {
  const [stats, setStats] = useState<WordStats>({});
  const [ready, setReady] = useState(false);

  // Giữ bản mới nhất để event handler ghi đúng, không phụ thuộc closure cũ.
  const latest = useRef<WordStats>({});

  useEffect(() => {
    let alive = true;
    loadWordStats().then((s) => {
      if (!alive) return;
      latest.current = s;
      setStats(s);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const record = useCallback(
    async (mode: StudyMode, cardId: string, passed: boolean) => {
      const next = recordAnswer(latest.current, mode, cardId, passed, Date.now());
      latest.current = next;
      setStats(next);
      await saveWordStats(next);
    },
    [],
  );

  const revise = useCallback(
    async (mode: StudyMode, cardId: string, passed: boolean) => {
      const next = reviseAnswer(latest.current, mode, cardId, passed, Date.now());
      latest.current = next;
      setStats(next);
      await saveWordStats(next);
    },
    [],
  );

  return { stats, ready, record, revise };
}
