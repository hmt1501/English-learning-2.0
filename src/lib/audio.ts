"use client";

/**
 * Module âm thanh dùng chung.
 *
 * Hành vi cố ý: luôn thử phát file MP3 đã tạo sẵn trước; nếu THIẾU FILE hoặc
 * phát lỗi thì TỰ ĐỘNG chuyển sang speechSynthesis của trình duyệt. Nhờ vậy
 * nội dung mới thêm vào vẫn nghe được ngay cả khi chưa kịp chạy script sinh
 * audio, và app không bao giờ "câm" trước mặt người học.
 */
import { withBase } from "./basePath";

let current: HTMLAudioElement | null = null;

/** Dừng mọi thứ đang phát (cả file lẫn giọng đọc máy). */
export function stopAudio(): void {
  if (current) {
    current.pause();
    current = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

/** Đọc bằng giọng của trình duyệt. */
export function speak(text: string, opts: { rate?: number; lang?: string } = {}): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  stopAudio();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = opts.lang ?? "en-US";
  u.rate = opts.rate ?? 1;
  window.speechSynthesis.speak(u);
}

export interface PlayOptions {
  /** Đường dẫn tương đối trong public/audio, ví dụ "vocab/greetings-01.mp3" */
  src?: string;
  /** Văn bản dùng cho giọng đọc máy khi không phát được file */
  text: string;
  /** 1 = bình thường, <1 = chậm */
  rate?: number;
  lang?: string;
}

/**
 * Phát audio, tự fallback sang giọng máy.
 * Trả về true nếu phát được file MP3, false nếu đã phải dùng giọng máy.
 */
export async function playAudio(opts: PlayOptions): Promise<boolean> {
  const { src, text, rate = 1, lang = "en-US" } = opts;
  stopAudio();

  if (!src) {
    speak(text, { rate, lang });
    return false;
  }

  const el = new Audio(withBase(`/audio/${src}`));
  el.playbackRate = rate;
  current = el;

  try {
    await el.play();
    return true;
  } catch {
    // Thiếu file, sai định dạng, hoặc trình duyệt chặn phát tự động.
    if (current === el) current = null;
    speak(text, { rate, lang });
    return false;
  }
}

/**
 * Phát và CHỜ CHO ĐẾN KHI PHÁT XONG.
 *
 * Khác hẳn playAudio(): `HTMLAudioElement.play()` trả về Promise resolve ngay
 * khi âm thanh BẮT ĐẦU phát, chứ không phải khi phát xong. Muốn phát tuần tự
 * cả bài hội thoại thì phải đợi sự kiện "ended", nếu không mỗi câu chỉ kịp kêu
 * được một tiếng rồi bị câu sau cắt ngang.
 *
 * Luôn resolve (kể cả khi bị stopAudio() cắt ngang hoặc file lỗi) để vòng lặp
 * gọi nó không bao giờ bị treo.
 */
export async function playAudioUntilEnd(opts: PlayOptions): Promise<void> {
  const { src, text, rate = 1, lang = "en-US" } = opts;
  stopAudio();

  if (src) {
    const el = new Audio(withBase(`/audio/${src}`));
    el.playbackRate = rate;
    current = el;

    try {
      await el.play();
      await new Promise<void>((resolve) => {
        const finish = () => resolve();
        el.addEventListener("ended", finish, { once: true });
        // "pause" bắn ra khi bị stopAudio() dừng giữa chừng.
        el.addEventListener("pause", finish, { once: true });
        el.addEventListener("error", finish, { once: true });
      });
      return;
    } catch {
      if (current === el) current = null;
      // Rơi xuống dùng giọng đọc máy bên dưới.
    }
  }

  await speakUntilEnd(text, { rate, lang });
}

/** Đọc bằng giọng máy và chờ đọc xong. */
function speakUntilEnd(
  text: string,
  opts: { rate?: number; lang?: string },
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }

    const u = new SpeechSynthesisUtterance(text);
    u.lang = opts.lang ?? "en-US";
    u.rate = opts.rate ?? 1;
    u.onend = () => resolve();
    // cancel() cũng làm bắn onerror -> vẫn phải resolve để không treo.
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

/** Phát bản đọc chậm của một lời thoại: ưu tiên file "-slow", không có thì giảm tốc độ. */
export async function playSlow(opts: PlayOptions): Promise<boolean> {
  const slowSrc = opts.src ? opts.src.replace(/\.mp3$/, "-slow.mp3") : undefined;
  return playAudio({ ...opts, src: slowSrc, rate: 0.75 });
}
