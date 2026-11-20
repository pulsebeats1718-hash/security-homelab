import type { CoachReport, CorrectionCategory, CorrectionStyle, EnglishLevel, ExpressionKind } from "../../services/api/types";

export interface Settings {
  firstName?: string;
  level?: EnglishLevel;
  correctionStyle: CorrectionStyle;
  /** What the learner wants to talk about or work on. */
  focus?: string;
  /** Keep conversation transcripts on this device after the review is done. */
  saveTranscripts: boolean;
  /** Show Sophie's words as captions during a call. */
  captions: boolean;
}

export interface Turn {
  id: string;
  role: "user" | "sophie";
  text: string;
  at: number;
}

export type ReviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; report: CoachReport }
  | { status: "error"; code: string; message: string };

export interface SessionRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  turns: Turn[];
  endReason?: string;
  review: ReviewState;
}

export interface ExpressionEntry {
  id: string;
  phrase: string;
  kind: ExpressionKind;
  meaning: string;
  example: string;
  synonyms: string[];
  savedAt: number;
  origin: "starter" | "conversation";
  sessionId?: string;
  practised: number;
}

export interface MistakeEntry {
  key: string;
  original: string;
  suggestion: string;
  explanation: string;
  category: CorrectionCategory;
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
}

export interface LearningData {
  version: 1;
  deviceId: string;
  settings: Settings;
  sessions: SessionRecord[];
  expressions: ExpressionEntry[];
  mistakes: MistakeEntry[];
}

export const DEFAULT_SETTINGS: Settings = {
  correctionStyle: "balanced",
  saveTranscripts: true,
  captions: true,
};
