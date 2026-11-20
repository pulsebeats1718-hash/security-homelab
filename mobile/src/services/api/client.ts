import { config, isApiConfigured } from "../config";
import type { ApiErrorBody, CoachReport, CorrectionStyle, SessionRequest, SessionResponse } from "./types";

/** An error from the Sophie backend, with the stable `code` the server sent. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function post<T>(path: string, body: unknown, timeoutMs = 20_000): Promise<T> {
  if (!isApiConfigured()) {
    throw new ApiError(0, "app_not_configured", "EXPO_PUBLIC_API_BASE_URL isn't set, so the app can't reach Sophie's server.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(config.appClientKey ? { "x-sophie-client": config.appClientKey } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, "network", controller.signal.aborted ? "Sophie's server took too long to answer." : "Couldn't reach Sophie's server. Check your connection.");
  } finally {
    clearTimeout(timer);
  }

  const payload = (await response.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(response.status, error?.code ?? "http_error", error?.message ?? `Server error (${response.status}).`, error?.retryAfterSeconds);
  }
  if (!payload) throw new ApiError(response.status, "bad_response", "The server sent an empty answer.");
  return payload;
}

export interface HealthResponse {
  ok: boolean;
  apiVersion: string;
  integrations: { nuance: boolean; coach: boolean };
}

export const api = {
  async health(): Promise<HealthResponse> {
    if (!isApiConfigured()) throw new ApiError(0, "app_not_configured", "EXPO_PUBLIC_API_BASE_URL isn't set.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(`${config.apiBaseUrl}/health`, { signal: controller.signal });
      if (!response.ok) throw new ApiError(response.status, "http_error", `Server answered ${response.status}.`);
      return (await response.json()) as HealthResponse;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(0, "network", "Couldn't reach the server.");
    } finally {
      clearTimeout(timer);
    }
  },
  createSession(request: SessionRequest): Promise<SessionResponse> {
    return post<SessionResponse>("/v1/session", request);
  },
  async reviewConversation(input: {
    deviceId: string;
    correctionStyle: CorrectionStyle;
    turns: { role: "user" | "sophie"; text: string }[];
  }): Promise<CoachReport> {
    const { report } = await post<{ report: CoachReport }>("/v1/coach/review", input, 120_000);
    return report;
  },
};
