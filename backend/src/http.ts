import type { Env } from "./env";

/** A failure the API reports to the app with a stable `code` the app can act on. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: { code: error.code, message: error.message, ...error.extra } }, error.status);
  }
  console.error("Unhandled error", error);
  return json({ error: { code: "internal", message: "Something went wrong on our side." } }, 500);
}

export function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-sophie-client",
    "access-control-max-age": "600",
    vary: "origin",
  };
}

export async function readJson(request: Request, maxBytes = 64_000): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > maxBytes) throw new HttpError(413, "payload_too_large", "Request body is too large.");
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "payload_too_large", "Request body is too large.");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be JSON.");
  }
}

/**
 * Optional shared-key check. This is a speed bump against casual misuse of the
 * token endpoint, NOT authentication: anything shipped inside an app binary can
 * be extracted. Real user auth is planned for a later milestone.
 */
export function checkClientKey(request: Request, env: Env): void {
  if (!env.APP_CLIENT_KEY) return;
  if (request.headers.get("x-sophie-client") !== env.APP_CLIENT_KEY) {
    throw new HttpError(401, "unauthorised_client", "This client is not allowed to use the API.");
  }
}

export async function enforceRateLimit(limiter: RateLimit | undefined, key: string): Promise<void> {
  if (!limiter) return;
  const { success } = await limiter.limit({ key });
  if (!success) {
    throw new HttpError(429, "rate_limited", "Too many requests. Give it a minute and try again.", {
      retryAfterSeconds: 60,
    });
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
