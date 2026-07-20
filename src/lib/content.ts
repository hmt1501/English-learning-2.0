/**
 * Điểm truy cập duy nhất tới nội dung học.
 *
 * Nội dung được import TĨNH (không fetch) để:
 *   - gói thẳng vào bundle -> chạy offline ngay từ lần đầu;
 *   - TypeScript kiểm tra được kiểu;
 *   - không cần server (app xuất tĩnh).
 */
import topicsJson from "@content/topics.json";

import greetings from "@content/decks/greetings.json";
import email from "@content/decks/email.json";
import meetings from "@content/decks/meetings.json";
import phone from "@content/decks/phone.json";
import smalltalk from "@content/decks/smalltalk.json";
import requests from "@content/decks/requests.json";
import problems from "@content/decks/problems.json";
import feedback from "@content/decks/feedback.json";

import dlgMorningCheckin from "@content/dialogues/dlg-morning-checkin.json";
import dlgProjectUpdate from "@content/dialogues/dlg-project-update.json";
import dlgClientCall from "@content/dialogues/dlg-client-call.json";
import dlgLunchBreak from "@content/dialogues/dlg-lunch-break.json";
import dlgDeadlineDelay from "@content/dialogues/dlg-deadline-delay.json";
import dlgAskingHelp from "@content/dialogues/dlg-asking-help.json";

import scLateStandup from "@content/scenarios/sc-late-standup.json";
import scFileRequest from "@content/scenarios/sc-file-request.json";
import scMeetingReschedule from "@content/scenarios/sc-meeting-reschedule.json";
import scClientFollowup from "@content/scenarios/sc-client-followup.json";
import scWeekendChat from "@content/scenarios/sc-weekend-chat.json";
import scBugReport from "@content/scenarios/sc-bug-report.json";
import scPraiseTeammate from "@content/scenarios/sc-praise-teammate.json";
import scCallMeBack from "@content/scenarios/sc-call-me-back.json";

import type { Card, Dialogue, Scenario, Topic } from "./content-schema";

export const topics: Topic[] = topicsJson;

/** deck theo id chủ đề — id trùng với tên file trong content/decks/. */
export const decks: Record<string, Card[]> = {
  greetings,
  email,
  meetings,
  phone,
  smalltalk,
  requests,
  problems,
  feedback,
};

export const dialogues: Dialogue[] = [
  dlgMorningCheckin,
  dlgProjectUpdate,
  dlgClientCall,
  dlgLunchBreak,
  dlgDeadlineDelay,
  dlgAskingHelp,
];

export const scenarios: Scenario[] = [
  scLateStandup,
  scFileRequest,
  scMeetingReschedule,
  scClientFollowup,
  scWeekendChat,
  scBugReport,
  scPraiseTeammate,
  scCallMeBack,
];

export function getTopic(id: string): Topic | undefined {
  return topics.find((t) => t.id === id);
}

export function getDeck(topicId: string): Card[] {
  return decks[topicId] ?? [];
}

export function getCard(cardId: string): Card | undefined {
  for (const deck of Object.values(decks)) {
    const found = deck.find((c) => c.id === cardId);
    if (found) return found;
  }
  return undefined;
}

export function getDialogue(id: string): Dialogue | undefined {
  return dialogues.find((d) => d.id === id);
}

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}

/** Tổng số thẻ trong toàn bộ nội dung — dùng cho phần thống kê. */
export function totalCardCount(): number {
  return Object.values(decks).reduce((sum, deck) => sum + deck.length, 0);
}
