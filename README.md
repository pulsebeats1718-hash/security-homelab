# Sophie: your London mate for English

Sophie is an Android-first AI companion for practising spoken British English. You talk to a live, lip-synced avatar of Sophie: a witty, opinionated Londoner, not a tutor. She replies naturally first and keeps corrections short and well-timed ("a native would say…"). After the call you get a written review, an expression bank and progress tracking.

> **Status: milestone 1.** The app, the backend and the integration are built and tested, but **only against mocks**. A real conversation still needs a Nuance Labs API key and an Android phone. See [What's verified](#whats-verified-and-what-isnt).

## Contents

- [How it works](#how-it-works)
- [Repository layout](#repository-layout)
- [What you need to set up](#what-you-need-to-set-up)
- [Setup on Windows (PowerShell)](#setup-on-windows-powershell)
- [Testing](#testing)
- [What's verified and what isn't](#whats-verified-and-what-isnt)
- [Configuration reference](#configuration-reference)
- [Troubleshooting](#troubleshooting)
- [Next milestones](#next-milestones)

## How it works

```
┌──────────────────────── Android app (Expo / React Native) ────────────────────────┐
│ Home · Review · Expressions · Progress · Settings  (native screens, on-device data) │
│                                                                                     │
│ Call screen ── native controls (mute, end, captions, status, voice activity)       │
│      │  JSON bridge (versioned)                                                     │
│      ▼                                                                              │
│ WebView ── /live/ page ── official @nuancelabs/js-sdk (LiveKit WebRTC) ────────────┼──► Nuance Live
└──────┬─────────────────────────────────────────────────────────────────────────────┘     (avatar, voice)
       │ HTTPS
       ▼
Cloudflare Worker (backend/)
  POST /v1/session      → builds Sophie's brief, mints a one-call Nuance session token (API key stays here)
  POST /v1/coach/review → post-call coaching analysis with Claude (structured JSON)
  GET  /live/           → serves the WebView page (static asset)
  GET  /health
```

Design choices:

- **No secrets in the app.** The Nuance and Anthropic keys live only in the Worker. The app gets a short-lived, single-use session token for each call.
- **Nuance runs in a WebView** because Nuance's official SDK is browser-only and doesn't mention React Native. Everything Nuance-specific on the client is in `backend/live/host.ts`, behind a bridge (`protocol.ts`), so the avatar provider can be swapped. [Full reasoning](docs/nuance-integration.md).
- **Coaching never interrupts.** During the call, Sophie's brief tells her to reply to *what* you said first, then add at most one light correction depending on your chosen style. The detailed analysis runs separately, after the call.
- **Learning data stays on the phone** in this milestone (AsyncStorage). A D1 schema for syncing is ready in `backend/migrations/` but not wired up yet.

## Repository layout

```
backend/                    Cloudflare Worker
  src/index.ts              routes, validation, rate limits
  src/providers/nuance.ts   session-token minting (verified against SDK 0.37.1)
  src/persona/sophie.ts     Sophie's character + coaching brief
  src/coach/analyze.ts      post-call review (Claude, structured output)
  live/host.ts              WebView page: runs the Nuance SDK, relays events
  live/protocol.ts          app ⇄ WebView bridge messages
  public/live/index.html    page shell (host.js is built into this folder)
  migrations/               D1 schema for milestone 2 (not applied)
mobile/                     Expo SDK 58 app (expo-router, TypeScript)
  src/app/                  screens: (tabs)/index, expressions, progress, settings; call; review/[id]
  src/features/live/        call state machine, bridge hook, WebView, voice activity
  src/features/learning/    on-device store, mistakes, expressions, progress selectors
  src/services/             API client + config
  tests/                    unit tests (state machine, learning logic)
docs/credentials.md         which credentials are needed and where they go
docs/nuance-integration.md  what was verified, what still needs checking
```

## What you need to set up

| Account / item | Why | Required? |
|---|---|---|
| **Nuance Labs developer account** and API key (`nk_…`) | Live avatar conversations. Accept the API Developer Agreement and Acceptable Use Policy on their platform. | Yes, for calls |
| **Cloudflare account** (free plan works) | Hosts the Worker over HTTPS | Yes |
| **Anthropic API key** | Post-call reviews (Review, Expression bank and Progress fill up from these) | Optional |
| **Expo account** | Cloud builds of the Android app with EAS, so you don't need Android Studio | Recommended |
| Android phone with **USB debugging** on | Running the app | Yes |
| Node.js **22 LTS** and Git for Windows | Tooling | Yes |
| Android Studio | Only if you want to build locally instead of with EAS | Optional |

Also check these on the Nuance side before going live. Details are in [docs/nuance-integration.md](docs/nuance-integration.md#still-to-check-in-the-nuance-docs-and-dashboard).

- Pricing and credits.
- The concurrency limit.
- Which persona (`sam`, `sonia` or `mira`) suits Sophie. The default is `sonia`, which is a guess.

## Setup on Windows (PowerShell)

The commands below assume PowerShell 7 (`pwsh`). Each block starts from the repository root.

### 1. Get the code

```powershell
git clone https://github.com/pulsebeats1718-hash/security-homelab.git
cd security-homelab
git checkout ccr-3321edb0-jnsir6
node --version   # should print v22.x
```

### 2. Deploy the backend (Cloudflare Worker)

> 🔐 **Your Nuance API key goes here, as a Cloudflare Worker secret, and nowhere else.** It's never placed in the app, in `wrangler.toml` or in git. Full guide: [docs/credentials.md](docs/credentials.md).

```powershell
cd backend
npm install
npx wrangler login

# Secrets are typed at a hidden prompt and stored encrypted by Cloudflare. Nothing is written to disk.
npx wrangler secret put NUANCE_API_KEY          # paste your nk_… key, press Enter

[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
npx wrangler secret put END_USER_SALT           # paste the random value printed above

npx wrangler secret put ANTHROPIC_API_KEY       # optional: enables post-call reviews

npm run check:secrets                           # shows which secrets are set (names only)
npm run deploy                                  # stops if a required secret is missing
```

Wrangler prints your URL, for example `https://sophie-backend.<your-subdomain>.workers.dev`. Check it:

```powershell
$api = "https://sophie-backend.<your-subdomain>.workers.dev"
Invoke-RestMethod "$api/health"
# → ok: True, integrations: @{nuance=True; coach=True}

# Mint a real Nuance session token (proves the key, terms and persona are accepted):
Invoke-RestMethod -Method Post -Uri "$api/v1/session" -ContentType "application/json" `
  -Body '{"deviceId":"windows-smoke-test-0001"}'
# → provider: nuance, token: st_…, expiresAt: …
```

If minting fails, the JSON error `code` says why. See [Troubleshooting](#troubleshooting).

### 3. Configure the app

```powershell
cd mobile
npm install
Copy-Item .env.example .env
notepad .env    # set EXPO_PUBLIC_API_BASE_URL=https://sophie-backend.<your-subdomain>.workers.dev
```

### 4a. Run on your phone: EAS development build (recommended, no Android Studio)

```powershell
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init                                              # links the project to your Expo account
npx eas-cli@latest build --profile development --platform android   # ~10–15 min in the cloud
```

1. Open the build link on your phone and install the APK.
2. Start the dev server on your PC. The phone and PC must be on the same Wi-Fi, or use `--tunnel`:

   ```powershell
   npx expo start --dev-client
   ```

3. Open **Sophie** on the phone, then scan the QR code or pick the server.
4. Tap **Start conversation**, allow the microphone and say hello.

> In development builds the JavaScript, including `.env`, comes from your PC, so changing `.env` only needs an Expo restart. **Preview and production builds** are bundled in the cloud and don't see your local `.env`, so set the variable on EAS first:
> `npx eas-cli@latest env:create --name EXPO_PUBLIC_API_BASE_URL --value $api --environment preview --visibility plaintext`
> then build with `npx eas-cli@latest build --profile preview --platform android`.

### 4b. Alternative: local build with Android Studio

Install Android Studio with an SDK and platform tools. Then plug in the phone with USB debugging on and run:

```powershell
cd mobile
adb devices                      # your phone should be listed
npx expo run:android --device    # builds, installs and starts the dev server
```

### 4c. Quickest look: Expo Go

The app only uses modules that ship in Expo Go, so you can install **Expo Go (SDK 58)** from the Play Store and run:

```powershell
cd mobile
npx expo start --go
```

This works for trying the UI. For real calls, use a development build, since microphone access inside Expo Go's WebView isn't guaranteed.

### Optional: run the backend locally instead of deploying

The microphone only works in the WebView from **HTTPS or `localhost`**, so a LAN address like `http://192.168.x.x` won't do. Use USB port-forwarding:

```powershell
cd backend
Copy-Item .env.example .env      # local-only secrets file, git-ignored
notepad .env                     # NUANCE_API_KEY, END_USER_SALT, optional ANTHROPIC_API_KEY
npm run dev                      # http://localhost:8787

# second terminal, phone on USB:
adb reverse tcp:8787 tcp:8787
# in mobile/.env:  EXPO_PUBLIC_API_BASE_URL=http://localhost:8787
```

Cleartext HTTP is only allowed in debug builds. Release builds need the HTTPS Worker.

## Testing

```powershell
# Backend
cd backend
npm run typecheck   # Worker + live page
npm test            # prompt builder, request validation, Nuance error mapping

# App
cd mobile
npm run typecheck
npm run lint
npm test            # call state machine (21 cases incl. errors/reconnect/end), learning data
npx expo export --platform android --output-dir $env:TEMP\sophie-export   # full Hermes bundle build
```

**Manual test on the phone (milestone 1 acceptance):**

1. The app launches and the Home screen renders. Check it on small and large phones.
2. **Start conversation** opens the call screen, and the microphone permission prompt appears.
   - Deny it: you get an "Open settings" screen.
   - Allow it: the call connects.
3. Sophie appears and greets you. Talk to her. The voice activity indicator shows who's speaking.
4. **Mute** stops Sophie hearing you. Unmute works.
5. **End** hangs up and opens the Review screen. The phone's back button asks before ending.
6. Turn on aeroplane mode mid-call. You get "Reconnecting…", then a "The call dropped / Reconnect" screen.
7. In dev builds, note the `events: …` line on the call screen. It lists the Nuance event types received. Use it to confirm the learner-transcript event names (see the notes doc).

## What's verified and what isn't

**Verified here:**

- **Builds and checks:** TypeScript (app, Worker and live page), ESLint, and a Metro Android bundle build.
- **Native config:** expo-doctor's 18 offline checks pass. `expo prebuild` produces an Android manifest with `RECORD_AUDIO`, the camera and storage permissions removed, and cleartext HTTP in debug builds only.
- **Unit tests:** 27 across the two packages.
- **Worker under `wrangler dev`:** every route and error path, the rate limit, and the exact request sent to Nuance's `/session-tokens` (against a mock).
- **Coaching endpoint:** request shape and parsing, against a mock Claude API.
- **Live page in headless Chromium with a fake microphone:**
  - The bridge handshake works.
  - It fetches a token through the app and the real Worker.
  - The official SDK uses that token against Nuance's `/conversation` endpoint.
  - Errors are typed and reported once.
- **Screens:** rendered at phone size and visually checked: Home, Review, Expressions, Progress and Settings.

**Not verified, because it needs your credentials and a device:**

- A real Nuance session: Sophie's video, her voice, and your speech reaching her.
- The exact event names for *your* transcript.
- Behaviour on physical Android hardware.
- A real Claude review.

**I haven't claimed the live integration works.** The code follows the official SDK exactly, but run the manual test above with a real key before relying on it.

## Configuration reference

**Worker `[vars]`** (in `backend/wrangler.toml`):

| Name | Default | Meaning |
|---|---|---|
| `NUANCE_PERSONA_ID` | `sonia` | `sam`, `sonia` or `mira`: Sophie's look and voice |
| `NUANCE_EXPRESSIVENESS` | `1` | Face and head movement, from 0 (calm) to 2 |
| `MAX_SESSION_SECONDS` | `900` | The app hangs up after this many seconds (cost control) |
| `COACH_MODEL` | `claude-opus-5-5` | Model used for reviews. Refusal fallbacks are enabled. |
| `ALLOWED_ORIGINS` | empty | Browser origins allowed to call the API (not needed for the app) |

**Worker secrets:**

| Name | Required? | Meaning |
|---|---|---|
| `NUANCE_API_KEY` | Yes | Your Nuance API key |
| `END_USER_SALT` | Yes | Random value used to hash device ids |
| `ANTHROPIC_API_KEY` | Optional | Enables post-call reviews |
| `APP_CLIENT_KEY` | Optional | Must match `EXPO_PUBLIC_APP_CLIENT_KEY` in the app. A speed bump, not authentication. |

Each device can mint 5 sessions and 10 reviews per minute. Adjust this under `[[ratelimits]]`.

**App** (`mobile/.env`):

| Name | Meaning |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | URL of the Worker |
| `EXPO_PUBLIC_APP_CLIENT_KEY` | Optional. Must match the Worker's `APP_CLIENT_KEY`. |

Never put secrets in `EXPO_PUBLIC_*` variables: they're compiled into the app. `npm start`, `npm run android` and EAS builds refuse to run if a key-like value is found (`npm run check:secrets`).

## Troubleshooting

| What you see | Likely cause |
|---|---|
| "Setup needed": `provider_not_configured` | `NUANCE_API_KEY` secret not set on the Worker |
| `provider_auth` | Wrong key, or the Nuance account hasn't accepted the API terms |
| `provider_config` | Persona id refused. Use `sam`, `sonia` or `mira`. |
| "Sophie's on another call" | Concurrency limit (409). One call at a time per plan slot. |
| "That's all for today" | Daily credits spent (429) |
| "Can't reach Sophie" | Wrong `EXPO_PUBLIC_API_BASE_URL`, or a LAN `http://` address. Use HTTPS or `adb reverse` + `localhost`. |
| Microphone silent warning | Another app has the mic, or the WebView was denied. Check Android app permissions. |
| Review says "Reviews aren't switched on" | `ANTHROPIC_API_KEY` not set |
| Review says "Not much to review" | No learner transcript arrived. Check the `events:` list in a dev build and see the notes doc. |

The Settings screen has a **Check connection** button that calls `/health` and shows which integrations are configured.

## Next milestones

1. **Real-device pass.** Confirm the learner transcript events, pick the persona, and tune Sophie's brief from real calls.
2. **Accounts and sync.** Add user auth on the Worker, apply the D1 migration, and sync sessions, mistakes and expressions.
3. **Practice mode.** Spaced revision of recurring mistakes and expressions, with exercises built from reviews.
4. **iOS.** The architecture already ports. It needs an iOS build and a WebView microphone test.
