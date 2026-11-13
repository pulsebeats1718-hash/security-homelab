# Install Phrasefall on an Android phone

Phrasefall is a Progressive Web App (PWA). Once it is on a website served over HTTPS, Chrome on
Android installs it like an app: its own icon on the home screen and in the app drawer, full
screen with no address bar, its own card in the app switcher, and it plays offline.

You need a computer with Node 18 or newer (to build the game), a free hosting account, and
Chrome on the phone. About 15 minutes.

---

## 1. Build it

```bash
npm install
npm run build          # the installable site, in dist/
```

- Only `npm run build` makes an installable app. `npm run build:single` (the one-file preview) has
  no manifest or service worker, and a file opened from the phone's storage can't be installed.
- Without a Firebase config the build is guest-only: progress is saved on the phone. With one
  (`.env.local`, see [DEPLOY.md](DEPLOY.md)), it also has Google sign-in, cloud saves and
  leaderboards.

## 2. Put it online over HTTPS

Android only installs apps from secure (`https://`) sites, and the service worker that makes
offline play possible only runs on them. All the options below give you HTTPS automatically, for
free.

### Option A: Cloudflare Workers

The project is set up for it: `wrangler.jsonc` publishes `dist/` as a Worker with static assets,
and `public/_headers` sets the cache rules.

```bash
npx wrangler login                 # once: opens Cloudflare in your browser
npm run deploy:cloudflare          # builds, then publishes
```

The game is live at `https://phrasefall.<your-subdomain>.workers.dev`. Run the same command to
publish a new version.

If the publish fails with "401 Unauthorized" at the asset upload, something between you and
Cloudflare (a proxy, or a cloud session such as Claude's) is rewriting the `Authorization`
header. `npm run deploy:cloudflare:embed` publishes the same build packed into the Worker
itself and only needs the API token; see the note at the top of
`scripts/cloudflare-embed.mjs`.

This copy is guest-only unless the build has a Firebase config. For Google sign-in, Firebase
Hosting (option B) is simpler, because it serves the sign-in pages on the game's own address.

### Option B: Firebase Hosting

The project is already set up for it: `firebase.json` serves `dist/` with the right cache rules.

1. Create a project at <https://console.firebase.google.com> (step 1 of [DEPLOY.md](DEPLOY.md)).
2. In the game's folder:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add                 # choose your project
   firebase deploy --only hosting
   ```

3. The game is live at `https://<project-id>.web.app`.

For sign-in and leaderboards as well, follow steps 2–9 of [DEPLOY.md](DEPLOY.md) instead.
To publish a new version later: `npm run build && firebase deploy --only hosting`.

### Option C: Netlify (no command line after the build)

1. Create a free account at <https://www.netlify.com>.
2. Open <https://app.netlify.com/drop> and drag the `dist` folder onto the page.
3. Netlify gives the site an address like `https://<some-name>.netlify.app`. The `_headers` file
   in `dist/` sets the cache rules. To publish a new version, build again and drag the new
   `dist` folder onto the site's **Deploys** page.

Any other static host with HTTPS works too (Cloudflare Pages, GitHub Pages and others): upload
the *contents* of `dist/`. The game also works from a sub-folder address such as
`https://<name>.github.io/phrasefall/`, because every path in the build is relative.

## 3. Install it on the phone

1. Open the address in **Chrome** on the phone and wait for the game to load. The first visit
   downloads about 1.6 MB and saves the game on the phone for offline play.
2. Chrome may offer to install it in a banner at the bottom of the screen. If it doesn't, tap
   **⋮** (top right) → **Install app**. On some Chrome versions the item is called
   **Add to Home screen**: choose **Install** in the box that opens, not "Create shortcut".
3. Tap **Install**. The box shows the game's description and screenshots. Phrasefall appears on
   the home screen and in the app drawer.

Open it from its icon. It starts full screen, with the status bar in the game's dark purple, and
works without a connection. The phone's **Back** button works the way you'd expect inside the app:
it closes the screen you're on, pauses a game (Back again resumes it), and on the main menu it
leaves the app. Games pause when you switch to another app.

Progress you made in Chrome carries over, because the app and Chrome share the site's storage.
In Samsung Internet, tap the install icon in the address bar, or **≡** → **Add page to** →
**Home screen**.

## Updates

When you publish a new build, the installed app picks it up the next time it is opened with a
connection. There is nothing to reinstall, and progress is kept.

## Try it on the phone before publishing (optional)

Your computer's network address (`http://192.168…:4173`) plays the game, but it can't be
installed, because it isn't HTTPS. `localhost` counts as secure, so you can forward it to the phone
over USB instead:

1. On the phone, turn on **Developer options → USB debugging** and connect it to the computer.
2. On the computer, run `npm run build && npm run preview`, then open `chrome://inspect` in Chrome
   → **Port forwarding** → add `4173` → `localhost:4173` → tick **Enable port forwarding**.
3. On the phone, open `http://localhost:4173/?sw=1` in Chrome (`?sw=1` switches on offline mode on
   `localhost`), then install as in step 3.

## Troubleshooting

- **No Install option, only "Create shortcut".** The site isn't installable yet. Check that the
  address starts with `https://`, that you published `dist/` from `npm run build` (not
  `build:single`), and reload the page once. On a computer, Chrome DevTools → **Application** →
  **Manifest** lists anything missing.
- **It says "Open app" instead of Install.** It is already installed.
- **An old version keeps opening.** Open the app once while online, close it from the app
  switcher and open it again.
- **Google sign-in fails on your own domain.** Add the domain to Firebase's authorised domains
  ([DEPLOY.md](DEPLOY.md), step 10).
- **Guest progress disappeared.** It lives in Chrome's storage for the site, so clearing Chrome's
  data for the site erases it. Signing in keeps a copy in the cloud.

---

## What makes it installable

| Requirement                                                        | Where                                              |
| ------------------------------------------------------------------ | -------------------------------------------------- |
| Served over HTTPS                                                  | the host (Cloudflare Workers, Firebase Hosting, Netlify …) |
| Web app manifest: name, short name, description, start URL and scope, `standalone` display, theme and background colour `#17123f`, 192 × 192 and 512 × 512 icons plus maskable versions (for Android's icon shapes), install screenshots | `public/manifest.webmanifest`, `public/icons/`, `public/screenshots/` |
| Service worker with a fetch handler: caches the whole game on the first visit, so it starts and plays offline | `public/sw.js`, registered by `public/sw-register.js` |
| Manifest link, theme colour and Apple touch icon in the page       | `index.html`; `vite.config.js` adds the manifest link, the Apple touch icon and the service worker script to the build |
| Back button, safe areas (notches, gesture bar), pause when hidden  | `src/ui/ui.js`, `src/styles/main.css`, `src/main.js` |

Checked on an emulated Android phone (Pixel, Chrome) against the production build: Chrome's own
installability check (`Page.getInstallabilityErrors`) reports no errors and the manifest parses
with none, the service worker controls the page, every icon and screenshot loads at its declared
size, and after going offline the game reloads and a game starts. The same checks pass with the
build served from a sub-folder, and on the live Cloudflare Workers copy over HTTPS.
