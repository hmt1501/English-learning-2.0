"use client";

import { useCallback, useRef, useState } from "react";
import {
  backupFileName,
  buildBackup,
  parseBackup,
  type BackupStore,
} from "@/lib/backup";
import {
  loadActivityLog,
  loadSessions,
  loadWordStats,
  saveActivityLog,
  saveSessions,
  saveWordStats,
} from "@/lib/db";
import { toLocalDateString } from "@/lib/date";
import { useAppStore } from "@/lib/store";
import { useMounted } from "@/lib/useMounted";
import type { SessionLevel } from "@/lib/plan";
import { Button, Card, Page, PageHeader } from "@/components/ui";

const LEVELS: { value: SessionLevel; label: string }[] = [
  { value: 20, label: "~20 phút" },
  { value: 40, label: "~40 phút" },
  { value: 60, label: "~60 phút" },
];

export default function SettingsPage() {
  const mounted = useMounted();

  const learnerName = useAppStore((s) => s.learnerName);
  const level = useAppStore((s) => s.level);
  const wordsPerSession = useAppStore((s) => s.wordsPerSession);
  const apiKey = useAppStore((s) => s.apiKey);

  const setLearnerName = useAppStore((s) => s.setLearnerName);
  const setLevel = useAppStore((s) => s.setLevel);
  const setWordsPerSession = useAppStore((s) => s.setWordsPerSession);
  const setApiKey = useAppStore((s) => s.setApiKey);
  const replaceAll = useAppStore((s) => s.replaceAll);

  const [showKey, setShowKey] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Xuất sao lưu: gộp cả IndexedDB lẫn store vào một file JSON. */
  const exportBackup = useCallback(async () => {
    const now = new Date();
    const store = useAppStore.getState();

    const payload: Partial<BackupStore> = {
      learnerName: store.learnerName,
      level: store.level,
      wordsPerSession: store.wordsPerSession,
      streak: store.streak,
      bestStreak: store.bestStreak,
      lastCompletedDate: store.lastCompletedDate,
      currentDate: store.currentDate,
      doneToday: store.doneToday,
      todayPlanKey: store.todayPlanKey,
      apiKey: store.apiKey,
    };

    const backup = buildBackup(
      payload,
      await loadWordStats(),
      await loadActivityLog(),
      now.toISOString(),
      await loadSessions(),
    );

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName(toLocalDateString(now));
    a.click();
    URL.revokeObjectURL(url);

    setMessage("Đã tải file sao lưu về máy.");
    setSkipped([]);
  }, []);

  /** Nhập sao lưu: trường nào sai kiểu thì bỏ qua, không làm hỏng phần còn lại. */
  const importBackup = useCallback(
    async (file: File) => {
      setMessage(null);
      setSkipped([]);
      try {
        const raw: unknown = JSON.parse(await file.text());
        const result = parseBackup(raw);

        if (Object.keys(result.store).length > 0) replaceAll(result.store);
        if (Object.keys(result.wordStats).length > 0) await saveWordStats(result.wordStats);
        if (result.activityLog.length > 0) await saveActivityLog(result.activityLog);
        if (Object.keys(result.sessions).length > 0) await saveSessions(result.sessions);

        setMessage(
          `Đã khôi phục: ${Object.keys(result.wordStats).length} mục từ vựng, ` +
            `${result.activityLog.length} dòng nhật ký. Tải lại trang để thấy đầy đủ.`,
        );
        setSkipped(result.skipped);
      } catch {
        setMessage("Không đọc được file. Bạn kiểm tra lại xem có đúng file .json sao lưu không nhé.");
      }
    },
    [replaceAll],
  );

  return (
    <>
      <PageHeader title="Cài đặt" subtitle="Tuỳ chỉnh và sao lưu dữ liệu" />
      <Page>
        {/* --- Thông tin người học --- */}
        <Card className="mb-3">
          <label className="block text-sm font-medium" htmlFor="name">
            Tên của bạn
          </label>
          <input
            id="name"
            className="field mt-1"
            value={mounted ? learnerName : ""}
            onChange={(e) => setLearnerName(e.target.value)}
            placeholder="Ví dụ: Hoàng"
          />
          <p className="mt-1.5 text-xs text-muted">
            Chỉ dùng để chào bạn ở trang Hôm nay.
          </p>
        </Card>

        {/* --- Mức buổi học --- */}
        <Card className="mb-3">
          <p className="text-sm font-medium">Mỗi ngày bạn học bao lâu?</p>
          <div className="mt-2 flex gap-2">
            {LEVELS.map((l) => (
              <Button
                key={l.value}
                variant={mounted && level === l.value ? "primary" : "secondary"}
                className="flex-1"
                onClick={() => setLevel(l.value)}
              >
                {l.label}
              </Button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Quyết định kế hoạch hôm nay có bao nhiêu mục.
          </p>
        </Card>

        {/* --- Số câu mỗi buổi --- */}
        <Card className="mb-3">
          <label className="block text-sm font-medium" htmlFor="wps">
            Số câu mỗi buổi từ vựng: {mounted ? wordsPerSession : "—"}
          </label>
          <input
            id="wps"
            type="range"
            min={5}
            max={20}
            step={1}
            value={mounted ? wordsPerSession : 10}
            onChange={(e) => setWordsPerSession(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--primary)]"
          />
          <div className="flex justify-between text-xs text-muted">
            <span>5</span>
            <span>20</span>
          </div>
        </Card>

        {/* --- API key --- */}
        <Card className="mb-3">
          <label className="block text-sm font-medium" htmlFor="key">
            API key cho phần Chat AI
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="key"
              className="field flex-1"
              type={showKey ? "text" : "password"}
              value={mounted ? apiKey : ""}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="gsk_..."
              autoComplete="off"
              spellCheck={false}
            />
            <Button variant="secondary" onClick={() => setShowKey((v) => !v)}>
              {showKey ? "Ẩn" : "Hiện"}
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Lấy key miễn phí ở{" "}
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              console.groq.com/keys
            </a>
            . Key chỉ được lưu trên máy bạn, không gửi đi đâu ngoài Groq. Các phần
            học khác không cần key.
          </p>
        </Card>

        {/* --- Sao lưu --- */}
        <Card className="mb-3">
          <p className="text-sm font-medium">Sao lưu dữ liệu</p>
          <p className="mt-1 text-xs text-muted">
            Toàn bộ tiến độ nằm trên máy này. Xoá dữ liệu trình duyệt hoặc đổi máy
            là mất, nên thỉnh thoảng bạn tải một bản sao lưu về nhé.
          </p>

          <div className="mt-3 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => void exportBackup()}>
              ⬇️ Tải sao lưu
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => fileRef.current?.click()}>
              ⬆️ Khôi phục
            </Button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importBackup(file);
              e.target.value = "";
            }}
          />

          {message && <p className="mt-3 rounded-xl bg-muted-bg p-3 text-sm">{message}</p>}

          {skipped.length > 0 && (
            <div className="mt-2 rounded-xl border border-warning p-3">
              <p className="text-sm font-medium text-warning">
                Một số phần bị bỏ qua vì sai định dạng:
              </p>
              <ul className="mt-1 flex flex-col gap-1 text-xs text-muted">
                {skipped.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <p className="mt-4 text-center text-xs text-muted">
          Tiếng Anh Công Sở · dữ liệu lưu trên thiết bị · không cần đăng nhập
        </p>
      </Page>
    </>
  );
}
