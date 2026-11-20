# Nuance Live integration notes

Checked on 2026-11-20 against **`@nuancelabs/js-sdk` 0.37.1**, the official package published by Nuance Labs on npm (Apache-2.0). Its README, type definitions (`index.d.ts`) and source (`index.js`) were read directly.

The developer docs at <https://docs.nuancelabs.ai> couldn't be reached from the build environment, so everything below comes from the SDK package. Read the docs pages listed at the end before going to production.

## Verified from the official SDK

| Topic | What the SDK says | Where we use it |
|---|---|---|
| Auth model | Your server holds the API key (`nk_…`) and mints a short-lived **session token** (`st_…`). The page/app only ever sees the session token. One token starts **one** conversation. | `backend/src/providers/nuance.ts` |
| Token endpoint | `POST https://api.nuancelabs.ai/session-tokens` with `Authorization: Bearer nk_…`. The host is the SDK's `DEFAULT_HOST`. | same |
| Token request body | `SessionTokenRequest`: `personality { system_prompt, persona_id }`, `end_user_id`, `interface` (`"nuance_live"`), `interface_setup { delegation, runtime_tools, video }`, `expressiveness` (0–2). | same |
| Token response | `SessionTokenResponse`: `{ token, expires_at, warnings? }` | same |
| Personas | `persona_id` accepts **`"sam"` (default), `"sonia"`, `"mira"`**. Any other id, `"emma"` included, is refused when the token is minted. | `NUANCE_PERSONA_ID` in `backend/wrangler.toml` |
| Custom personality | `personality.system_prompt` is your own plain-text brief. It's fixed by the token. | `backend/src/persona/sophie.ts` |
| Voice / accent | **No voice or accent option exists** in the SDK types. Look and voice come from the persona. | Settings screen says so |
| Camera | `interface_setup.video.input.camera: false` stops the persona using the camera. `mediaDevices.cameraEnabled: false` stops capture. | Both set; Android `CAMERA` permission is blocked |
| End-user id | `end_user_id` should be set on every token so policy pauses apply per person: letters, digits and `_ . : -`, max 128 characters, never an email or a name. | Salted SHA-256 of a random install id |
| Client runtime | Browser SDK built on `livekit-client`. Uses `document`, `window`, `navigator.mediaDevices` and `HTMLVideoElement.attach()`. **React Native isn't mentioned anywhere.** | Runs in a WebView (see below) |
| Starting speech | The persona doesn't speak first. Send `{ type: "response.create" }` on `avatar-presented`. | `backend/live/host.ts` |
| Sophie's transcript | `session.output_transcript.delta` (`{ delta }`). Her spoken turn ends with `session.output_audio.done`. | same |
| Errors | `ApiError` (status/code), `MediaAccessError`, `ActiveSessionError`, `MaintenanceError`, `LegalRequiredError`, `PolicyCurfewError`, `GuestLimitError`. 401 = token expired or already used, 409 = concurrency limit, 429 = credits spent. | `host.ts`, `liveReducer.ts` |
| Lifecycle | `idle → queued/connecting → connected → disconnected/failed`, plus `session-ended` with `reason` (`time-limit`, `ended`, `policy-violation`, `age-check`, `refused`, `connection-lost`). | `liveReducer.ts` |
| Preview status | "Until 1.0, a minor version may change the API." | SDK pinned to exactly `0.37.1` |

## Why a WebView, not native LiveKit

The SDK is browser-only and handles session creation, queueing, heartbeats, reconnection, A/V sync and its event protocol. Re-implementing it on `@livekit/react-native` would mean copying undocumented internals (the `/conversation` endpoints the SDK calls), which would break on SDK updates.

Instead, the official SDK runs unmodified in a locked-down `react-native-webview` page served by our Worker (`/live/`). Everything else is native React Native, and the two sides talk over a small versioned JSON bridge (`backend/live/protocol.ts`). Android WebView supports WebRTC and `getUserMedia`, and react-native-webview grants the WebView microphone access when the app holds `RECORD_AUDIO`.

The page must load from a **secure context**: HTTPS, or `http://localhost` through `adb reverse`. Otherwise the browser blocks microphone access.

If Nuance ships a React Native SDK, only `LiveAvatarView` and `backend/live/` need replacing. The rest of the app depends on the bridge messages, not on Nuance.

## Tested here (without real credentials)

- The Worker's request to `POST /session-tokens` against a mock: exact URL, `Bearer` header and body shape.
- Each Nuance error status (401, 409, 422, 429, 5xx) mapped to an app-facing error code.
- Rate limiting.
- The host page in headless Chromium with a fake microphone:
  - The bridge handshake works.
  - The SDK asks the app for a token.
  - The SDK sends the token as `Bearer st_…` to `POST https://api.nuancelabs.ai/conversation` with `camera: "off"`.
  - Refusals come back to the app as typed errors.
- The full chain: host page → simulated app → real Worker → mock Nuance mint → SDK.

## Not tested: needs a real key and a phone

- An actual Nuance session: LiveKit media, the avatar video, Sophie's voice, and two-way audio on an Android device.
- **The learner's transcript event names.** The SDK package only names Sophie's output events. `host.ts` handles any `*input_transcript*` or `*input_audio_transcription*` event as the learner's words, but this is a guess. In development builds, the call screen lists every Nuance Live event type it receives (`events: …`). Use that list on the first real call to confirm the names, then tighten the mapping. Until then, reviews may not include the learner's own words.
- Whether `maxSessionSeconds` can be combined with a session token. The SDK only rules out `personality`. We cap length in the app instead (`MAX_SESSION_SECONDS`).
- Which persona looks and sounds right for Sophie. We default to `"sonia"` as a guess, so check it on the Nuance dashboard or playground.

## Still to check in the Nuance docs and dashboard

1. **Access and pricing:** whether the API is open or needs approval, the credit price per minute, the daily credit cap and the concurrency limit. The SDK only shows that these limits exist (`429 credits_spent`, `409 concurrency_limit`).
2. **Terms:** the account that creates the API key must accept the API Developer Agreement and Acceptable Use Policy, or calls fail with `LegalRequiredError`.
3. **Personas:** previews of `sam`, `sonia` and `mira`, and whether any sound British.
4. **Events reference:** the learner transcript events, plus any `session.update` options for voice or language.
5. **Mobile:** any official guidance on Android WebView or React Native support.

Pages to read: `/keys-and-tokens`, `/connect`, `/js-sdk`, `/reference/api` (OpenAPI at `/openapi.json`), and the events and errors guides.
