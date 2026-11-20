import type { SessionTokenRequest, SessionTokenResponse } from "@nuancelabs/js-sdk";
import { HttpError } from "../http";

/**
 * Nuance Labs (Nuance Live) session-token minting.
 *
 * Verified against the official @nuancelabs/js-sdk 0.37.1 package (types + source):
 *  - host:   https://api.nuancelabs.ai (the SDK's DEFAULT_HOST)
 *  - route:  POST /session-tokens, called from a server with the API key
 *  - auth:   Authorization: Bearer nk_…
 *  - body:   SessionTokenRequest  → { personality, end_user_id, interface_setup, expressiveness }
 *  - result: SessionTokenResponse → { token: "st_…", expires_at, warnings? }
 * A token starts exactly one conversation and fixes its settings, so the app asks
 * for a fresh one for every call.
 */
export const NUANCE_DEFAULT_HOST = "https://api.nuancelabs.ai";

/** Personas the SDK 0.37.1 documents. Anything else is refused by Nuance at mint time. */
export const KNOWN_NUANCE_PERSONAS = ["sam", "sonia", "mira"] as const;

export interface MintOptions {
  apiKey: string;
  host?: string;
  systemPrompt: string;
  personaId: string;
  endUserId: string;
  expressiveness: number;
}

export async function mintNuanceSessionToken(options: MintOptions): Promise<SessionTokenResponse> {
  const body: SessionTokenRequest = {
    personality: { system_prompt: options.systemPrompt, persona_id: options.personaId },
    end_user_id: options.endUserId,
    interface_setup: {
      // Nothing on our side answers hand-offs yet, so the persona handles everything itself.
      delegation: { type: "none" },
      // Microphone-only product: never ask for or use the learner's camera.
      video: { input: { camera: false } },
      // Let Sophie say goodbye and hang up when the learner wraps up.
      runtime_tools: { end_call: true },
    },
    expressiveness: options.expressiveness,
  };

  let response: Response;
  try {
    response = await fetch(`${(options.host ?? NUANCE_DEFAULT_HOST).replace(/\/+$/, "")}/session-tokens`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    console.error("Nuance unreachable", cause);
    throw new HttpError(502, "provider_unreachable", "Couldn't reach the conversation service.");
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) throw mapNuanceError(response.status, payload);

  if (!payload || typeof payload.token !== "string" || typeof payload.expires_at !== "string") {
    throw new HttpError(502, "provider_bad_response", "The conversation service sent an unexpected answer.");
  }
  return payload as unknown as SessionTokenResponse;
}

/** Turns a Nuance error answer into one the app can act on, without leaking provider details. */
export function mapNuanceError(status: number, body: Record<string, unknown> | null): HttpError {
  const code = typeof body?.code === "string" ? body.code : null;
  const detail = typeof body?.detail === "string" ? body.detail : null;
  // Server log keeps the provider's own words for debugging.
  console.warn("Nuance refused session token", { status, code, detail });

  const renewsAt = typeof body?.renews_at === "string" ? body.renews_at : undefined;
  const retryAfterSeconds = typeof body?.retry_after_seconds === "number" ? body.retry_after_seconds : undefined;

  switch (status) {
    case 401:
    case 403:
      return new HttpError(502, "provider_auth", "The conversation service rejected our credentials. Check NUANCE_API_KEY and that the account has accepted the API terms.");
    case 409:
      return new HttpError(409, "provider_busy", "Sophie is already on as many calls as this plan allows. Try again in a moment.", { retryAfterSeconds });
    case 422:
      return new HttpError(502, "provider_config", "The conversation settings were refused. Check NUANCE_PERSONA_ID and the server logs.");
    case 429:
      return new HttpError(429, "provider_quota", "Today's conversation allowance has been used up.", { renewsAt, retryAfterSeconds });
    default:
      if (status >= 500) {
        return new HttpError(503, "provider_unavailable", "The conversation service is having a moment. Try again shortly.", { retryAfterSeconds });
      }
      return new HttpError(502, "provider_error", "The conversation service couldn't start a session.");
  }
}
