export interface Env {
  ASSETS: Fetcher;
  SESSION_LIMITER?: RateLimit;
  COACH_LIMITER?: RateLimit;

  // Secrets
  NUANCE_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  END_USER_SALT?: string;
  APP_CLIENT_KEY?: string;

  // Vars
  NUANCE_PERSONA_ID?: string;
  NUANCE_EXPRESSIVENESS?: string;
  MAX_SESSION_SECONDS?: string;
  COACH_MODEL?: string;
  ALLOWED_ORIGINS?: string;
  /** Override for tests/staging only. Defaults to the SDK's own host. */
  NUANCE_API_HOST?: string;
  /** Override for tests only. Defaults to the Anthropic SDK's own base URL. */
  ANTHROPIC_BASE_URL?: string;
}
