"use client";

import { useEffect, useState } from "react";
import { loadSessions } from "./db";
import type { SessionStore } from "./session";

/**
 * Các buổi học đang làm dở, đọc từ IndexedDB.
 *
 * Dùng để hiện ngay số câu đã làm ở trang Hôm nay và menu Từ vựng — người học
 * không phải hoàn tất cả buổi mới thấy công sức của mình.
 */
export function useSessions(): { sessions: SessionStore; ready: boolean } {
  const [sessions, setSessions] = useState<SessionStore>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSessions().then((s) => {
      if (!alive) return;
      setSessions(s);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { sessions, ready };
}
