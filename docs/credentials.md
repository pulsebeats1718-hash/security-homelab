# Credentials: what's needed and where it goes

**Short answer:** your Nuance Labs API key goes into **Cloudflare as a Worker secret**, using `npx wrangler secret put NUANCE_API_KEY`. It never goes in the app, in any `EXPO_PUBLIC_*` variable, in `wrangler.toml`, or in git.

```
Phone app ──(no keys, only the Worker URL)──► Cloudflare Worker ──(NUANCE_API_KEY)──► Nuance Labs
                                                     │
          ◄──── short-lived, single-use session token (st_…) ────┘
```

The app receives only a session token. Nuance limits it to one conversation and gives it an expiry time. The API key itself never leaves Cloudflare.

## What's required

| Credential | Required? | What it is | Where it lives |
|---|---|---|---|
| `NUANCE_API_KEY` | **Yes** | Your Nuance Labs API key (starts with `nk_`) | Cloudflare Worker secret |
| `END_USER_SALT` | **Yes** | A random string you generate. Device ids are hashed with it before they reach Nuance. | Cloudflare Worker secret |
| `ANTHROPIC_API_KEY` | Optional | Anthropic API key. Turns on post-call reviews. | Cloudflare Worker secret |
| `APP_CLIENT_KEY` | Optional | A shared value the app sends, to deter casual misuse of your Worker. **Not a real secret**, because it ships inside the app. | Worker secret **and** `EXPO_PUBLIC_APP_CLIENT_KEY` in `mobile/.env` |
| Cloudflare login | Yes | Lets Wrangler deploy and store secrets for your account | `npx wrangler login` (browser sign-in) |

The app itself needs only one setting, and it isn't secret: `EXPO_PUBLIC_API_BASE_URL`, the URL of your Worker.

## Production: set the Worker secrets (Windows PowerShell)

```powershell
cd backend
npm install
npx wrangler login                          # opens the browser; sign in to Cloudflare

npx wrangler secret put NUANCE_API_KEY      # paste your nk_… key at the hidden prompt, press Enter
```

Next, generate a random salt and store it:

```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
npx wrangler secret put END_USER_SALT       # paste the value printed above
```

Optionally, add the Anthropic key for reviews:

```powershell
npx wrangler secret put ANTHROPIC_API_KEY
```

Then check and deploy:

```powershell
npm run check:secrets                       # lists which secrets are set (names only, never values)
npm run deploy                              # refuses to deploy if a required secret is missing
```

Notes:

- **On the very first `secret put`**, Wrangler may say the Worker doesn't exist yet and offer to create it. Answer yes.
- **The key is entered at a hidden prompt.** It doesn't appear on screen or in your PowerShell history, and it isn't written to any file. Cloudflare stores it encrypted. Once saved, nobody can read the value back from the dashboard or from Wrangler.
- **Prefer the dashboard?** Go to Cloudflare dashboard → Workers & Pages → `sophie-backend` → Settings → Variables and Secrets → Add. Choose type **Secret**, not Text.
- **To rotate the key**, run `npx wrangler secret put NUANCE_API_KEY` again with the new key. It takes effect immediately. To remove a secret, run `npx wrangler secret delete NUANCE_API_KEY`.

### Check it worked

```powershell
$api = "https://sophie-backend.<your-subdomain>.workers.dev"   # printed by `npm run deploy`
Invoke-RestMethod "$api/health"
# integrations: nuance = True means the key is configured (the value is never returned)

Invoke-RestMethod -Method Post -Uri "$api/v1/session" -ContentType "application/json" `
  -Body '{"deviceId":"windows-smoke-test-0001"}'
# token: st_…  means Nuance accepted your key
```

If you get `provider_auth`, Nuance rejected the key, or your Nuance account hasn't accepted the API terms yet.

## Local development only: `backend/.env`

You only need this file if you run the Worker on your own PC with `npm run dev`. Deployed Workers never read it.

```powershell
cd backend
Copy-Item .env.example .env
notepad .env        # replace the placeholders with your real values
```

`backend/.env` is git-ignored. `backend/.env.example` is the committed template and must only ever contain placeholders. A unit test enforces this.

## The app: `mobile/.env` (public settings only)

```powershell
cd mobile
Copy-Item .env.example .env
notepad .env        # EXPO_PUBLIC_API_BASE_URL=https://sophie-backend.<your-subdomain>.workers.dev
```

Everything in `mobile/.env` is compiled into the app and can be read by anyone who has the APK.

As a safety net, `npm start`, `npm run android`, `npm run ios` and EAS builds first run `scripts/check-env.mjs`. It **refuses to continue** if any of these appear:

- a Nuance key, Nuance session token, Anthropic key or private key in `mobile/.env*`;
- one of those in an `EXPO_PUBLIC_*` environment variable on EAS;
- one of those in the app's source or config;
- a variable named like a server secret (for example `EXPO_PUBLIC_NUANCE_API_KEY`).

You can run it any time with `npm run check:secrets`.

## What protects you from accidental leaks

| Safeguard | Where |
|---|---|
| The key is only ever read inside the Worker, in the `POST /session-tokens` call to Nuance | `backend/src/providers/nuance.ts` |
| The app only ever receives a single-use, expiring session token | `backend/src/index.ts` |
| Provider error details (which could echo request data) are logged on the server, not sent to the app | `mapNuanceError` |
| `.env`, `.env.*` and `.dev.vars*` are git-ignored at the repo root and in both packages; only `.env.example` is tracked | `.gitignore` files |
| Deploy stops if a required secret is missing | `backend/scripts/check-secrets.mjs` |
| The app won't start or build if a key-like value is about to be bundled | `mobile/scripts/check-env.mjs` |
| A test fails if `wrangler.toml` ever defines a secret as a plain `[vars]` entry, or `.env.example` holds a real-looking key | `backend/test/backend.test.ts` |
| Stray spaces, newlines or quotes around a pasted key are trimmed, with a warning if it doesn't start with `nk_` | `cleanSecret` in `backend/src/index.ts` |
| Each device can mint 5 sessions per minute, so a leaked app build can't burn your credits quickly | `[[ratelimits]]` in `wrangler.toml` |

## If a key is ever exposed

1. Revoke it in the Nuance Labs dashboard and create a new one.
2. Run `npx wrangler secret put NUANCE_API_KEY` with the new key.
3. If it was committed to git, deleting the file isn't enough, because the key stays in the history. Treat it as leaked even after you rewrite the history.

## Please don't share keys in chat

Never paste API keys into chats, issues, screenshots or support tickets, including conversations with an AI assistant. Enter them only at the `wrangler secret put` prompt or in the Cloudflare dashboard.
