import { z } from "zod";

/**
 * Request/response contract between the Sophie app and this Worker.
 * Mirrored by mobile/src/services/api/types.ts — keep the two in step.
 */

const shortText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    // Collapse whitespace so user-supplied text cannot add structure to the system prompt.
    .transform((value) => value.replace(/\s+/g, " "));

export const CorrectionStyle = z.enum(["relaxed", "balanced", "detailed"]);
export type CorrectionStyle = z.infer<typeof CorrectionStyle>;

export const SessionRequest = z.object({
  /** Random install id generated on the device. Hashed before it leaves the Worker. */
  deviceId: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, "deviceId must be 16–64 url-safe characters"),
  preferences: z
    .object({
      correctionStyle: CorrectionStyle.default("balanced"),
      /** What the learner would like to talk about or work on, in their words. */
      focus: shortText(200).optional(),
    })
    .default({ correctionStyle: "balanced" }),
  learner: z
    .object({
      firstName: shortText(40).optional(),
      level: z.enum(["intermediate", "upper-intermediate", "advanced"]).optional(),
      /** Recurring mistakes from previous sessions, newest first. */
      recentMistakes: z
        .array(z.object({ original: shortText(160), better: shortText(160) }))
        .max(5)
        .default([]),
      /** One expression to weave in naturally this session. */
      expressionOfTheDay: z
        .object({ phrase: shortText(80), meaning: shortText(200) })
        .optional(),
    })
    .default({ recentMistakes: [] }),
});
export type SessionRequest = z.infer<typeof SessionRequest>;

export interface SessionResponse {
  provider: "nuance";
  token: string;
  expiresAt: string;
  personaId: string;
  maxSessionSeconds: number;
  warnings: string[];
}

export const TranscriptTurn = z.object({
  role: z.enum(["user", "sophie"]),
  text: shortText(2_000),
});

export const CoachRequest = z.object({
  deviceId: SessionRequest.shape.deviceId,
  correctionStyle: CorrectionStyle.default("balanced"),
  turns: z.array(TranscriptTurn).min(1).max(120),
});
export type CoachRequest = z.infer<typeof CoachRequest>;
