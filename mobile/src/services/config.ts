/**
 * Runtime configuration. EXPO_PUBLIC_* values are inlined into the JS bundle at
 * build time, so they must never contain secrets.
 */
const rawBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? "";

export const config = {
  apiBaseUrl: rawBase.replace(/\/+$/, ""),
  appClientKey: process.env.EXPO_PUBLIC_APP_CLIENT_KEY?.trim() || undefined,
} as const;

export function isApiConfigured(): boolean {
  return /^https?:\/\//.test(config.apiBaseUrl);
}

/** The page that hosts the live avatar, served by the Worker. */
export function liveHostUrl(): string {
  return `${config.apiBaseUrl}/live/`;
}
