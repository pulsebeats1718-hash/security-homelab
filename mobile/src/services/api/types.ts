/**
 * Mirrors backend/src/contract.ts and backend/src/coach/analyze.ts — keep in step.
 */
export type CorrectionStyle = "relaxed" | "balanced" | "detailed";
export type EnglishLevel = "intermediate" | "upper-intermediate" | "advanced";

export interface SessionRequest {
  deviceId: string;
  preferences: { correctionStyle: CorrectionStyle; focus?: string };
  learner: {
    firstName?: string;
    level?: EnglishLevel;
    recentMistakes: { original: string; better: string }[];
    expressionOfTheDay?: { phrase: string; meaning: string };
  };
}

export interface SessionResponse {
  provider: "nuance";
  token: string;
  expiresAt: string;
  personaId: string;
  maxSessionSeconds: number;
  warnings: string[];
}

export type CorrectionCategory = "grammar" | "tense" | "preposition" | "vocabulary" | "collocation" | "word-order" | "naturalness";
export type ExpressionKind = "idiom" | "phrasal-verb" | "collocation" | "expression";

export interface CoachReport {
  summary: string;
  corrections: {
    original: string;
    suggestion: string;
    explanation: string;
    category: CorrectionCategory;
    severity: "mistake" | "less-natural";
  }[];
  expressions: {
    phrase: string;
    kind: ExpressionKind;
    meaning: string;
    example: string;
    synonyms: string[];
    source: "sophie-used" | "suggested";
  }[];
  strengths: string[];
  practice: { kind: "rephrase" | "fill-the-gap" | "use-it"; instruction: string; prompt: string; answer: string };
}

export interface ApiErrorBody {
  error: { code: string; message: string; retryAfterSeconds?: number; renewsAt?: string };
}
