"use client";

/**
 * Bọc MediaRecorder cho phần "Nói theo".
 *
 * Ghi âm nằm HOÀN TOÀN trên máy: tạo blob URL để nghe lại rồi thu hồi,
 * không upload đi đâu cả.
 */

export interface Recording {
  url: string;
  blob: Blob;
}

export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  /** Trình duyệt có hỗ trợ ghi âm không. */
  static isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined"
    );
  }

  async start(): Promise<void> {
    this.stop();
    this.chunks = [];

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(this.stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    recorder.start();
    this.recorder = recorder;
  }

  /** Dừng ghi và trả về bản ghi; trả null nếu không ghi được gì. */
  async stopAndGet(): Promise<Recording | null> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === "inactive") {
      this.releaseStream();
      return null;
    }

    const done = new Promise<Recording | null>((resolve) => {
      recorder.onstop = () => {
        if (this.chunks.length === 0) {
          resolve(null);
          return;
        }
        const blob = new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" });
        resolve({ blob, url: URL.createObjectURL(blob) });
      };
    });

    recorder.stop();
    const result = await done;
    this.releaseStream();
    this.recorder = null;
    return result;
  }

  /** Dừng khẩn cấp, bỏ dữ liệu (dùng khi rời trang). */
  stop(): void {
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.recorder = null;
    this.releaseStream();
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
