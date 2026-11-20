import { analyseConversation } from "./coach/analyze";
import { CoachRequest, SessionRequest, type SessionResponse } from "./contract";
import type { Env } from "./env";
import {
  HttpError,
  checkClientKey,
  corsHeaders,
  enforceRateLimit,
  errorResponse,
  json,
  readJson,
  sha256Hex,
} from "./http";
import { buildSophieSystemPrompt } from "./persona/sophie";
import { mintNuanceSessionToken } from "./providers/nuance";

const API_VERSION = "2026-11-20";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    try {
      let response: Response;
      if (url.pathname === "/health" && request.method === "GET") {
        response = health(env);
      } else if (url.pathname === "/v1/session" && request.method === "POST") {
        response = await createSession(request, env);
      } else if (url.pathname === "/v1/coach/review" && request.method === "POST") {
        response = await reviewConversation(request, env);
      } else if (url.pathname.startsWith("/v1/")) {
        throw new HttpError(404, "not_found", "No such endpoint.");
      } else {
        return env.ASSETS.fetch(request);
      }
      for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
      return response;
    } catch (error) {
      const response = errorResponse(error);
      for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
      return response;
    }
  },
} satisfies ExportedHandler<Env>;

function health(env: Env): Response {
  // Reports which integrations are configured, never their values.
  return json({
    ok: true,
    apiVersion: API_VERSION,
    integrations: {
      nuance: Boolean(env.NUANCE_API_KEY),
      coach: Boolean(env.ANTHROPIC_API_KEY),
    },
  });
}

function parse<T>(schema: { safeParse(input: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.map(String).join(".") || "body";
    throw new HttpError(400, "invalid_request", `${where}: ${issue?.message ?? "invalid"}`);
  }
  return result.data;
}

async function endUserIdFor(deviceId: string, env: Env): Promise<string> {
  if (!env.END_USER_SALT) {
    throw new HttpError(503, "server_not_configured", "END_USER_SALT is not set on the server.");
  }
  // Nuance wants a stable per-person id that is never an email or a name.
  return `sophie_${(await sha256Hex(`${env.END_USER_SALT}:${deviceId}`)).slice(0, 40)}`;
}

async function createSession(request: Request, env: Env): Promise<Response> {
  checkClientKey(request, env);
  const body = parse(SessionRequest, await readJson(request));
  await enforceRateLimit(env.SESSION_LIMITER, `session:${body.deviceId}`);

  if (!env.NUANCE_API_KEY) {
    throw new HttpError(
      503,
      "provider_not_configured",
      "Live conversations aren't set up on this server yet: NUANCE_API_KEY is missing.",
    );
  }

  const personaId = env.NUANCE_PERSONA_ID || "sonia";
  const expressiveness = clampNumber(env.NUANCE_EXPRESSIVENESS, 1, 0, 2);
  const maxSessionSeconds = clampNumber(env.MAX_SESSION_SECONDS, 900, 60, 3_600);

  const minted = await mintNuanceSessionToken({
    apiKey: env.NUANCE_API_KEY,
    host: env.NUANCE_API_HOST,
    systemPrompt: buildSophieSystemPrompt(body),
    personaId,
    endUserId: await endUserIdFor(body.deviceId, env),
    expressiveness,
  });
  if (minted.warnings?.length) console.warn("Nuance token warnings", minted.warnings);

  const payload: SessionResponse = {
    provider: "nuance",
    token: minted.token,
    expiresAt: minted.expires_at,
    personaId,
    maxSessionSeconds,
    warnings: minted.warnings ?? [],
  };
  return json(payload);
}

async function reviewConversation(request: Request, env: Env): Promise<Response> {
  checkClientKey(request, env);
  const body = parse(CoachRequest, await readJson(request, 256_000));
  await enforceRateLimit(env.COACH_LIMITER, `coach:${body.deviceId}`);

  if (!env.ANTHROPIC_API_KEY) {
    throw new HttpError(503, "coach_not_configured", "Conversation reviews aren't set up on this server yet: ANTHROPIC_API_KEY is missing.");
  }
  const report = await analyseConversation(body, {
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.COACH_MODEL || "claude-opus-5-5",
    baseURL: env.ANTHROPIC_BASE_URL,
  });
  return json({ report });
}

function clampNumber(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
