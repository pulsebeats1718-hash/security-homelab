import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { CoachRequest, CorrectionStyle } from "../contract";
import { HttpError } from "../http";

/**
 * Post-conversation coaching: analyses the learner's completed turns separately
 * from the live call, so the conversation itself is never held up by grading.
 */

export const CoachReport = z.object({
  summary: z.string().describe("One or two warm, specific sentences about how the conversation went, written as Sophie to the learner."),
  corrections: z
    .array(
      z.object({
        original: z.string().describe("The learner's words, quoted exactly."),
        suggestion: z.string().describe("What a native British speaker would say instead (just the improved phrase or sentence)."),
        explanation: z.string().describe("Why, in one short plain-English sentence. No jargon unless it genuinely helps."),
        category: z.enum(["grammar", "tense", "preposition", "vocabulary", "collocation", "word-order", "naturalness"]),
        severity: z.enum(["mistake", "less-natural"]).describe("'mistake' = actually wrong; 'less-natural' = correct but not how a native would say it."),
      }),
    )
    .describe("Most useful first. Empty if the learner made no mistakes worth noting."),
  expressions: z
    .array(
      z.object({
        phrase: z.string(),
        kind: z.enum(["idiom", "phrasal-verb", "collocation", "expression"]),
        meaning: z.string().describe("Plain-English definition in under 20 words."),
        example: z.string().describe("A natural British example sentence."),
        synonyms: z.array(z.string()).describe("Up to three alternatives with a similar meaning."),
        source: z.enum(["sophie-used", "suggested"]).describe("'sophie-used' if Sophie said it in the conversation; 'suggested' if it would have helped the learner."),
      }),
    )
    .describe("Expressions worth saving to the learner's expression bank, at most four."),
  strengths: z.array(z.string()).describe("Up to three specific things the learner did well."),
  practice: z
    .object({
      kind: z.enum(["rephrase", "fill-the-gap", "use-it"]),
      instruction: z.string(),
      prompt: z.string(),
      answer: z.string(),
    })
    .describe("One short exercise built from this conversation's most useful correction or expression."),
});
export type CoachReport = z.infer<typeof CoachReport>;

const STYLE_NOTE: Record<CorrectionStyle, string> = {
  relaxed: "The learner prefers light feedback: include at most three corrections, only ones that matter.",
  balanced: "Include up to six corrections, prioritising what will help most.",
  detailed: "The learner wants thorough feedback: include up to ten corrections, including less-natural phrasing.",
};

const SYSTEM = `You are the coaching engine behind Sophie, a friendly British English conversation companion from London. You review a finished voice conversation and write feedback for the learner.

Rules:
- Only analyse the learner's turns. Sophie's turns are context.
- The transcript comes from speech recognition, so ignore missing punctuation, capitalisation, filler words ("um", "like") and obvious transcription glitches. Never flag something that could simply be a transcription error.
- Distinguish genuine mistakes (severity "mistake") from phrasing that is correct but less idiomatic (severity "less-natural").
- Suggest natural, contemporary British English. Don't mark American usage as wrong.
- Don't comment on pronunciation or accent.
- Be warm, concise and specific. No lectures, no grammar jargon unless it genuinely helps.`;

export async function analyseConversation(
  request: CoachRequest,
  options: { apiKey: string; model: string; baseURL?: string },
): Promise<CoachReport> {
  const learnerTurns = request.turns.filter((turn) => turn.role === "user");
  if (learnerTurns.length === 0) {
    throw new HttpError(422, "nothing_to_review", "There aren't any learner turns to review yet.");
  }

  const transcript = request.turns
    .map((turn) => `${turn.role === "user" ? "Learner" : "Sophie"}: ${turn.text}`)
    .join("\n");

  const client = new Anthropic({ apiKey: options.apiKey, ...(options.baseURL ? { baseURL: options.baseURL } : {}) });
  try {
    const response = await client.beta.messages.parse({
      model: options.model,
      max_tokens: 16000,
      // If the primary model declines, the API re-runs the request on a suitable fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(CoachReport) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `${STYLE_NOTE[request.correctionStyle]}\n\n<transcript>\n${transcript}\n</transcript>`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      throw new HttpError(422, "review_declined", "This conversation couldn't be reviewed.");
    }
    if (!response.parsed_output) {
      throw new HttpError(502, "review_failed", "The review came back in an unexpected shape. Try again.");
    }
    return response.parsed_output;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      throw new HttpError(502, "coach_auth", "The coaching service rejected our credentials. Check ANTHROPIC_API_KEY.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new HttpError(429, "coach_busy", "The coaching service is busy. Try the review again in a minute.");
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Coach API error", error.status, error.message);
      throw new HttpError(503, "coach_unavailable", "The coaching service couldn't review this conversation right now.");
    }
    throw error;
  }
}
