# Deploying Phrasefall online (Firebase)

Phrasefall's online features run on Firebase: **optional Google sign-in**, a **cloud save** that
follows the player between devices, and **leaderboards** (today's daily challenge, this week and
all time). Guests can still play straight away. When a guest signs in, the progress they made as
a guest is added to their account.

Without a Firebase config, `npm run build` produces the same guest-only game as before, and the
Firebase SDK is left out of the bundle. `npm run build:single` (the private one-file preview)
never includes online features, even when a config is present.

You need a Google account, Node 18 or newer, and about 30 minutes. Steps 1–9 get the game live
at `https://<project-id>.web.app`; step 10 moves it to your own domain.

---

## 1. Create the Firebase project

1. Open <https://console.firebase.google.com> and choose **Create a project**.
2. Name it (for example `Phrasefall`). Firebase shows the **Project ID** under the name
   (for example `phrasefall-4f2a1`). You will need it in step 6.
3. Google Analytics: the game does not use it, so you can switch it off. Then **Create project**.

## 2. Add a Web app and copy its config into `.env.local`

1. On the project's home page, click the **Web** icon (`</>`). Enter an app nickname such as
   `Phrasefall web`. Leave "Firebase Hosting" unticked, because the CLI sets that up later.
   Click **Register app**.
2. Firebase shows a `firebaseConfig = { … }` block. In the game's folder, run:

   ```bash
   cp .env.example .env.local
   ```

   Then copy the values across:

   | `firebaseConfig`                                          | `.env.local`                                    |
   | --------------------------------------------------------- | ----------------------------------------------- |
   | `apiKey`                                                  | `VITE_FIREBASE_API_KEY`                         |
   | `authDomain`                                              | `VITE_FIREBASE_AUTH_DOMAIN`                     |
   | `projectId`                                               | `VITE_FIREBASE_PROJECT_ID`                      |
   | `appId`                                                   | `VITE_FIREBASE_APP_ID`                          |
   | `storageBucket`, `messagingSenderId`, `measurementId`     | optional, same names in capitals                |

   You can find this block again later under ⚙ **Project settings → General → Your apps**.
   These values are built into the public JavaScript; every Firebase web app works this way.
   What players can read and write is controlled by `firestore.rules`, not by hiding the
   config. `.env.local` is listed in `.gitignore`.

## 3. Switch on Google sign-in

1. Go to **Build → Authentication → Get started → Sign-in method → Google → Enable**.
2. Choose a **support email**, then **Save**.
3. Set the name players see on Google's consent screen. Open the Google Cloud console for the
   same project (<https://console.cloud.google.com>), then go to **Google Auth Platform →
   Branding** (on older consoles: **APIs & Services → OAuth consent screen**). Set the app name to
   `Phrasefall`, choose a support email, and add a privacy-policy URL. If you skip this, Google's
   sign-in window says "Continue to *project-id*.firebaseapp.com".

## 4. Check the authorised domains

**Authentication → Settings → Authorized domains** already lists `localhost`,
`<project-id>.firebaseapp.com` and `<project-id>.web.app`. Add your own domain in step 10.
On any domain not in this list, sign-in fails with "Sign-in is not set up for this web address yet".

## 5. Create the Firestore database in London

1. Go to **Build → Firestore Database → Create database**.
2. If you are asked for an edition, choose **Standard**. Keep the database ID `(default)`.
3. Location: **`europe-west2` (London)**. This can't be changed later.
4. Choose **Start in production mode**, then **Create**. Production mode blocks all reads and
   writes until step 7 deploys the game's rules.

## 6. Install the Firebase CLI and log in

```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc      # put your Project ID in place of your-firebase-project-id
```

You can run `firebase use --add` instead of copying the file.

## 7. Deploy the security rules and indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

The leaderboard index takes a few minutes to build. You can watch it under
**Firestore → Indexes**. Until it is ready, the boards sort by score only, which still works.

## 8. Build

```bash
npm install
npm run build          # reads .env.local: online features on
npm run preview        # optional check at http://localhost:4173
```

To check it worked, look for a **Sign in** button with the Google "G" next to the settings cog
in the menu. Sign-in also works on `localhost`.

## 9. Deploy the site

```bash
firebase deploy --only hosting
```

The game is now live at `https://<project-id>.web.app`. `firebase.json` controls how it is served:

- the site is served from `dist/`
- every path falls back to `index.html`
- files in `/assets/` are cached for a year; their names change whenever their contents do
- `index.html` and `sw.js` use `no-cache`, so a new deploy reaches players on their next visit

To update the game later, run `npm run build && firebase deploy --only hosting`. Run step 7 again
only when `firestore.rules` or `firestore.indexes.json` changes.

## 10. Use your own domain

1. Go to **Hosting → Add custom domain** and enter the domain (for example `phrasefall.com`, and
   `www.phrasefall.com` if you want it too). Add the DNS records it shows (a TXT record to prove
   ownership, then A records) at your domain registrar. The certificate is usually ready within
   an hour, and always within 24 hours.
2. Go to **Authentication → Settings → Authorized domains → Add domain** and add the domain.
3. In `.env.local`, set `VITE_FIREBASE_AUTH_DOMAIN=phrasefall.com` (your domain). Then run
   `npm run build` and `firebase deploy --only hosting` again.
   This keeps Google sign-in working in Safari on iPhone, iPad and Mac. Safari blocks the storage
   that sign-in needs when the sign-in page is on a different site from the game. Firebase
   Hosting serves that page at `/__/auth/` on your own domain automatically, so it then counts
   as the same site. Installed iPhone web apps, and browsers that block pop-ups, sign in by
   redirect and depend on this.
4. In the Google Cloud console, go to **APIs & Services → Credentials**. Open the OAuth client
   called *Web client (auto created by Google Service)*. Under **Authorized redirect URIs**, add
   `https://phrasefall.com/__/auth/handler`, then **Save**.

---

## How it works

| Where                                 | What                                                                 | Who can read / write                   |
| ------------------------------------- | -------------------------------------------------------------------- | -------------------------------------- |
| `profiles/{uid}`                      | nickname                                                             | anyone / the player                    |
| `saves/{uid}`                         | the player's progress, packed (`src/online/pack.js`)                 | the player only                        |
| `boards/daily-YYYY-MM-DD/scores/{uid}`| first ranked daily attempt (created once, never changed)             | signed-in players / the player         |
| `boards/week-YYYY-Www/scores/{uid}`   | best classic game this week (ISO week, UTC; may only go up)          | signed-in players / the player         |
| `boards/all/scores/{uid}`             | best classic game ever (may only go up)                              | signed-in players / the player         |

- **Sign-in.** Google opens in a pop-up. If the pop-up is blocked, and in installed iPhone web
  apps, it uses a full-page redirect instead. The sign-in survives page reloads.
- **Nickname.** On their first sign-in, players choose a public nickname. Their Google first name
  is suggested. A nickname is 3–16 letters (any alphabet), digits and spaces. A small block-list
  in `src/online/names.js` turns away obvious abuse, and the rules check the format again.
  Players can change their nickname from the account chip or in Settings.
- **Cloud save.** When a player signs in, the cloud copy and the device's copy are merged and
  saved to both. For each expression, the more recent record wins. Unlocks are combined, best
  scores keep the highest value, and game counts add up, so nothing is counted twice. After that,
  progress is saved to the cloud about 12 seconds after it changes, and straight away when the
  page is hidden. Each write merges with whatever is already in the cloud, so two devices never
  overwrite each other. Settings such as volume and graphics stay on each device. 6,000
  expressions plus a year of daily challenges take about 370 KB, about a third of Firestore's
  1 MiB document limit.
- **Leaderboards.** Each board shows the top 50 and updates live while it is on screen. A player
  outside the top 50 sees their own position pinned at the bottom. Exact positions are counted
  down to 10,000; below that the rank reads "#10,000+". A score that can't be sent because the
  player is offline is kept on the device and sent when the connection returns.
- **Signing out.** Progress stays on the device. If a different Google account then signs in on
  the same device, it starts from its own cloud progress instead of inheriting someone else's.
- **Reset progress** (Settings) also resets the cloud copy, and the player's other devices pick
  up the reset.
- **Delete my online data** (Settings) deletes the cloud save, the nickname and every
  leaderboard entry, then removes the sign-in record. If Google requires a fresh sign-in before
  that last step, the player is signed out instead, and the empty account stays under
  **Authentication → Users**, where you can delete it. Progress on the device is kept.
- Players' Google email, name and photo stay in Firebase Authentication. The photo is only ever
  shown to the player themself; leaderboards show the nickname and the chosen character.

You will need a **privacy policy** before launch, because the game uses Google sign-in and shows
public nicknames. It should say what is stored, that the data is held in London
(`europe-west2`), and how players delete it (Settings → Delete my online data).

## Costs

**Free tier.** The free Spark plan and the pay-as-you-go Blaze plan include the same free allowance:

| Service              | Free allowance                                                                      |
| -------------------- | ----------------------------------------------------------------------------------- |
| Firestore            | 50,000 reads, 20,000 writes and 20,000 deletes **per day**; 1 GiB stored            |
| Hosting              | 10 GB stored; 360 MB transferred **per day**                                        |
| Authentication       | Google sign-in has no per-user charge on Firebase Authentication. If the project is upgraded to Identity Platform, the first 50,000 monthly active users are free. |

Above the free allowance, Firestore's list price is about **$0.03 per 100,000 reads, $0.09 per
100,000 writes and $0.01 per 100,000 deletes**. London costs a little more than the US regions;
check the `europe-west2` column at <https://cloud.google.com/firestore/pricing>. Hosting
transfer costs about **$0.15 per GB**. Prices change, so treat everything here as an estimate.

**What one player uses.** These estimates assume every player is signed in; guests cost nothing
in Firestore. A typical signed-in player in a day visits once, plays three classic games and the
daily challenge, and opens two leaderboards. That comes to about 150 reads and 8 writes:

- about 50 reads each time a board opens (its top 50), plus one read per change while it is open
- a few reads and writes per game for the board and the cloud save
- a rank count costs 1 read per 1,000 players above you, at most 10, and is reused for 5 minutes

A first visit downloads about 1.3 MB (compressed). Later visits use the browser's cached copy.

| Daily players | Firestore reads / writes a day | Firestore | Hosting (25 % first visits) | **Roughly**          |
| ------------- | ------------------------------ | --------- | --------------------------- | -------------------- |
| 1,000         | 150,000 / 8,000                | ~$1/month | ~0.35 GB/day, within free   | **$0–5 a month**     |
| 10,000        | 1.5 million / 80,000           | ~$15      | ~3.4 GB/day, ~$15           | **$30–40 a month**   |
| 100,000       | 15 million / 800,000           | ~$150     | ~34 GB/day, ~$150           | **$300–400 a month** |

- **On the free Spark plan**, the allowance covers about 300 signed-in players a day, or about
  250 first-time visitors a day for hosting. When a quota runs out, that service stops until
  the quota resets.
- **Before launch**, switch to **Blaze**: **Usage and billing → Modify plan**. Then set a
  **budget alert** in the Google Cloud console under **Billing → Budgets & alerts**. A budget
  alert warns you; it does not stop spending.
- **At 100,000 players a day**, opening boards is the biggest cost. The next step is a Cloud
  Function that copies each board's top 50 into a single document once a minute, so opening a
  board costs 1 read instead of about 50. That cuts Firestore costs by roughly two-thirds.
  Hosting transfer scales with first visits, and a service worker or a CDN in front of the site
  reduces it.

## Cheating, and what the rules can and can't do

Phrasefall runs entirely in the player's browser and sends its score at the end of a game. A
determined player can use the browser's developer tools to send a score they never earned.
`firestore.rules` limits the damage: it checks that a score looks possible and that players can
only touch their own entries. It cannot prove that a game was really played.

What the rules enforce:
- only the signed-in player can write their own entries, nickname and save
- scores must be whole numbers from 0 to 200,000, stage from 1 to 5, and
  correct ≤ answered ≤ 500
- timestamps must come from the server
- a daily entry is created once, only while that day's challenge is open (its UTC day, until
  midday the next day), and can never be raised
- weekly and all-time entries can only go up
- nicknames must match the allowed format

**The upgrade path is server-side checking with Cloud Functions** (Blaze plan):
- the game asks a function to start a run, and the function records the start time and the day's cards
- the game sends its answers and the function scores them, then writes the leaderboard entry
  itself; the rules stop allowing players to write scores directly
- tighter limits come cheaply: with the current scoring (streak bonuses, plus the daily
  challenge's speed bonus) a score can't exceed about 225 × correct answers, and a run can't be
  shorter than its cards take to fall
- **App Check** (with reCAPTCHA Enterprise) also helps, by making it harder to call the database
  from anything but the real game

Moderation works the same way: the nickname block-list runs on the player's device. To remove
an offensive nickname or a fake score, delete the document in the Firestore console. A Cloud
Function that checks new nicknames is the upgrade path.

## Local development with the emulators

The Firebase emulators let you try every online feature without touching the real project. They
need Java 11 or newer.

```bash
firebase emulators:start --only auth,firestore --project demo-phrasefall    # uses firestore.rules
```

In another terminal, run `npm run dev` with these settings in `.env.development.local`:

```bash
VITE_FIREBASE_API_KEY=demo-key
VITE_FIREBASE_AUTH_DOMAIN=demo-phrasefall.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-phrasefall
VITE_FIREBASE_APP_ID=1:1:web:1
VITE_FIREBASE_EMULATOR_HOST=127.0.0.1
```

In emulator mode, `__pf.online.emulatorSignIn('Sam Smith', 'sam@example.com')` in the browser
console signs in a test player without the Google pop-up. To run the merge, encoding and
nickname unit tests: `node src/online/merge.test.mjs`.
