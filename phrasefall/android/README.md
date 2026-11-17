# Phrasefall for Android

An Android app (a **Trusted Web Activity**) that opens the live game,
<https://phrasefall.pulsebeats1718.workers.dev>, full screen in the phone's Chrome. There is no
copy of the game inside the app: it always runs the latest version of the site, plays offline once
it has loaded (the site's service worker), and keeps progress in the site's storage. Reinstalling
the app, or switching between the app and the browser, keeps your progress.

| | |
|---|---|
| Package name | `dev.workers.pulsebeats1718.phrasefall` |
| Needs | Android 7.0 or newer with Chrome (or another browser that supports Trusted Web Activities) |
| Icon, splash | made from the game's icons by `make-icons.sh` |

## Build

Needs JDK 17 or newer and the Android SDK (`ANDROID_HOME`, or `sdk.dir` in `local.properties`),
with Android platform 36. Android Studio installs both: open this folder in it and choose
**Build → Generate Signed App Bundle or APK**. From the command line:

```bash
cd android
./gradlew assembleRelease     # app/build/outputs/apk/release/app-release.apk
./gradlew bundleRelease       # app/build/outputs/bundle/release/app-release.aab (for Google Play)
```

### The signing key

A release build is signed when `keystore.properties` (in this folder) names a keystore:

```properties
storeFile=/path/to/phrasefall-release.jks
storePassword=…
keyAlias=phrasefall
keyPassword=…
```

or when the `PHRASEFALL_KEYSTORE`, `PHRASEFALL_KEYSTORE_PASSWORD`, `PHRASEFALL_KEY_ALIAS` and
`PHRASEFALL_KEY_PASSWORD` environment variables do. **Neither the keystore nor its passwords go into
the repository** (`.gitignore` keeps them out). Keep the keystore safe: Android only installs an
update over the app if it is signed with the same key.

A new key: `keytool -genkeypair -keystore phrasefall-release.jks -alias phrasefall -keyalg RSA
-keysize 2048 -validity 10000`.

### Full screen needs the site to vouch for the app

The app opens without an address bar only if the website lists the app's signing key in
`public/.well-known/assetlinks.json` (Digital Asset Links). Its `sha256_cert_fingerprints` must be
the SHA-256 of the key that signed the APK:

```bash
keytool -list -v -keystore phrasefall-release.jks -alias phrasefall | grep SHA256
```

With a new key, put its fingerprint in that file, rebuild the site and publish it. If the
fingerprint does not match, the app still works, but Chrome shows a thin address bar at the top.

On Google Play with Play App Signing, Google re-signs the app with its own key: add the
fingerprint shown under **Play Console → Test and release → App integrity → App signing** to the
same list (keep the upload key's too).

## Install the APK on a phone

1. Copy `app-release.apk` to the phone (download it, or send it to yourself).
2. Open it. Android asks to allow installing apps from that source (the browser or the Files app):
   allow it, go back, and tap **Install**.
3. Phrasefall appears in the app drawer and on the home screen.

Google Play Protect may say it doesn't recognise the developer, because the app isn't from the Play
Store: tap **More details → Install anyway**.

## Change it

- The website address, colours and names: the top of `app/build.gradle`.
- The icon: run `./make-icons.sh` after changing `public/icons/`.
- A new release: raise `versionCode` (and `versionName`) in `app/build.gradle`. You only need a
  new APK for changes to the app itself (name, icon, colours); changes to the game reach the app
  through the website.
