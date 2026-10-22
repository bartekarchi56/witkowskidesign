# Timbro wallet server

Creates the cards customers save in **Apple Wallet** (iPhone) and **Google Wallet** (Android), drawn the same way as on the website: name or logo at the top, the stamp grid, reward, customer name and a QR code the stamper can scan.

The customer's card page (`app/card.html`) shows an "Add to Apple Wallet" or "Add to Google Wallet" button, depending on the phone. The button posts the card to this server, which answers with:

- **iPhone:** a signed `.pkpass` file. Safari opens it straight in Wallet.
- **Android:** a redirect to Google's "Save to Google Wallet" page.

## What you need (once)

### Apple Wallet
1. An **Apple Developer Program** membership (99 USD/year), as a company or individual. You can enrol on the website or in the Apple Developer app on an iPhone; no Mac or Xcode is needed for Wallet passes.
2. In *Certificates, Identifiers & Profiles* → *Identifiers*, create a **Pass Type ID**: Timbro's is `pass.com.witkowskidesign.timbro` (Team ID `D62ABP2359`).
3. Create a **Pass Type ID certificate** for it. No Mac needed: make the key and the request with OpenSSL
   (on Windows it comes with Git for Windows: open "Git Bash"):
   ```
   openssl req -new -newkey rsa:2048 -nodes -keyout signer.key -out pass.csr -subj "/CN=Witkowski Design/C=PL"
   ```
   Upload `pass.csr` when Apple asks for a Certificate Signing Request, download `pass_type.cer`.
   Keep `signer.key` secret: it never goes in the repo, in chat or by email.
4. Convert the certificate to PEM:
   ```
   openssl x509 -inform der -in pass_type.cer -out signer.pem
   ```
   (With a Mac you can instead export a `.p12` from Keychain Access and run
   `openssl pkcs12 -in pass.p12 -clcerts -nokeys -out signer.pem -legacy` and
   `openssl pkcs12 -in pass.p12 -nocerts -nodes -out signer.key -legacy`.)
5. Download Apple's **WWDR certificate (G4)** from apple.com/certificateauthority and convert it:
   `openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem`
6. Note your **Team ID** (top right of the developer site).

### Google Wallet
1. Sign up at **pay.google.com/business/console** (Google Pay & Wallet Console) with the company's Google account and open **Google Wallet API**. Note the **Issuer ID** (a long number).
2. At **console.cloud.google.com**: create a project (e.g. `timbro`), enable the **Google Wallet API**, then *IAM & Admin > Service accounts > Create* (e.g. `timbro-wallet`, no roles needed). In the account, *Keys > Add key > JSON* downloads the key file. Keep it secret like `signer.key`.
3. Back in the Wallet console, *Users > Invite a user*: the service account's email (`…@….iam.gserviceaccount.com`), access level *Developer*.
4. On Render: *Environment > Secret Files* add `service-account.json` (paste the key file's text), and set `GOOGLE_ISSUER_ID`. `/health` then says `"google":true`.
5. Publishing access: approved for Witkowski Design (issuer `3388000000023221940`) in October 2026, so every Android user can save cards. (Before approval only test users in the Wallet console could.)

## Settings (environment variables)

| Variable | Example |
|---|---|
| `PUBLIC_URL` | `https://wallet.timbro.it` (this server's own address) |
| `ALLOWED_ORIGINS` | `https://timbro.it` (the website; other sites are refused) |
| `APPLE_PASS_TYPE_ID` | `pass.com.witkowskidesign.timbro` |
| `APPLE_TEAM_ID` | `D62ABP2359` |
| `APPLE_SIGNER_CERT` / `APPLE_SIGNER_KEY` | paths to `signer.pem` / `signer.key`, or the PEM text |
| `APPLE_SIGNER_KEY_PASSPHRASE` | if the key has one |
| `APPLE_WWDR_CERT` | path to `wwdr.pem`, or the PEM text |
| `GOOGLE_ISSUER_ID` | `3388000000012345678` |
| `GOOGLE_SERVICE_ACCOUNT` | path to the JSON key, or the JSON text |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | your Supabase project. When set, the server reads the card and stamps from the database (using the customer's secret) instead of trusting the phone |

Never commit certificates or keys. `.gitignore` already excludes `*.pem`, `*.p12` and `service-account*.json`.

## Run and deploy

```
cd wallet
npm install
npm test          # builds a test pass with throwaway certificates
npm start         # http://localhost:8787, check /health
```

It is a plain Node 18+ server (no framework), so any Node host works: Render, Railway, Fly.io or a small VPS. When it's online, set `walletApi` in `assets/js/config.js` to its address. The buttons on the card page switch on by themselves.

### Deploy on Render (no command line)

1. At render.com sign up with GitHub and allow access to this repository.
2. **New > Blueprint**, pick the repository: Render reads `render.yaml` (service `timbro-wallet`, Frankfurt, free plan).
3. In the service, **Environment > Secret Files**, add three files with exactly these names, pasting each file's text:
   `signer.pem`, `signer.key`, `wwdr.pem`. They appear at `/etc/secrets/…`, where `render.yaml` points.
   They are never in the repository.
4. Set `PUBLIC_URL` to the service address Render shows (e.g. `https://timbro-wallet.onrender.com`) and deploy.
5. Open `PUBLIC_URL/health`: it should say Apple is ready.
6. Tell Claude the address: it goes in `walletApi` in `assets/js/config.js`.

The free plan sleeps after 15 minutes without visits, so the first card of the day takes about a minute. Switch the
plan to Starter (about 7 USD a month) before a café uses it.

## Card styles

Each card keeps its own look: card and strip colours, the name's font with an optional tagline (e.g. ザ・コーヒー), and its stamp: one of the standard stamps (a plain dot, sun, olive branch, flower, star, wave, tree and moon) printed in the card's ink, or the café's own artwork. Empty boxes show a faint print of the same stamp; with the dot, an empty circle.

The server draws the stamps from `stamps.cjs`, a copy of the website's `assets/js/stamps.js` (`npm test` fails if they differ: copy the website's file over it). Wallet apps draw text in their own font, so the website turns the name into an image (`logoAuto`) and sends it with the card. The lock-screen icon is the card's stamp.

## Live updates

A pass added from a database card updates by itself after every stamp or reward:

- The pass carries `webServiceURL` (`PUBLIC_URL` + `/passkit`) and an `authenticationToken`, which is the customer's own card secret. Demo cards (`DEMO_CARDS`, only on one phone) have neither and stay as they were saved.
- This server implements Apple's PassKit web service under `/passkit/v1/...` (register, unregister, list updated passes, latest pass, log). Registrations live in the database table `timbro.wallet_devices` (`supabase/updates/8-wallet-updates.sql`).
- After a stamp the till page calls `POST /notify` with its device token; the server asks the database which phones hold that customer's pass (`wallet_targets`, same café only) and sends each an empty APNs push with the Pass Type ID certificate. Wallet then downloads the new pass.
- **Google Wallet:** the same `/notify` call reads the customer's card through `stamper_lookup` and `PATCH`es the saved loyalty object (stamps, stamp picture, café message) with the Google Wallet API. Google fetches the pictures from `/img/strip?card=…` and `/img/icon?card=…`, drawn from the database card with its own artwork. A new café message arrives as a notification (Google allows a few a day).
- Passes saved before this existed have no update address: remove them from Wallet and add them again.
- On Render's free plan the server sleeps after 15 minutes, so the first update after a pause can take up to a minute. Use the Starter plan for real cafés.

Tested by `supabase/test/wallet.test.js` (needs the local Postgres from `supabase/README.md`).

## What's not done yet

- **Trusting the browser.** Solved when `SUPABASE_URL` is set: the card and stamps come from the database. In demo mode the page still sends them, so keep `ALLOWED_ORIGINS` set.
- **Uploaded logos on Google Wallet.** Google needs the logo at a public URL, so it uses the card's stamp for now. Apple uses the uploaded logo.
- **Official Google button.** The Apple badge is in place (`assets/wallet/`). Google publishes an official "Add to Google Wallet" button with its own rules; add it the same way when Google is switched on.

## Notifications to customers

Each café writes its own messages in the dashboard (**Notifiche / Notifications**): *almost there*, *reward ready*, a *reminder* after N days without a visit, and *near the café*. They are stored on the card (`messages`, see `supabase/schema.sql`) and this server already puts them on the passes (`messages.js`):

- **Apple:** a `news` field on the back of the pass carries the café's text with `changeMessage: "%@"`, so when it changes Wallet shows it on the lock screen (the plain "Stamps: 7/8" alert is left out while there is a message). With *near the café* on and a location saved, the pass gets `locations` + `relevantText`, so iPhones show the card on the lock screen near the café, with no server needed.
- **Google:** the same text is added to the loyalty object's `messages`.

### Phase 2: sending updates to phones (needs the accounts above and this server online)

Today a pass shows the message it was saved with. To update passes already in Wallet:

1. **Apple:** done (see *Live updates* above): after each stamp the phone downloads the new pass and shows the message.
2. **Google:** done (see *Live updates*).
3. **Message to all customers:** done. In the dashboard (**Notifiche**) the owner writes one message (up to 140 characters, once a day), e.g. "Fresh cornetti this morning!". The database saves it on the card (`owner_send_news`, `supabase/updates/13-news.sql`), then the page calls `POST /news` with the owner's login; this server asks the database for the card's customers (`owner_news_targets`, only for the card's owner and only within 15 minutes of sending), pushes every iPhone and updates every Google card. The message stays on the cards for 3 days (`NEWS_HOURS` in `messages.js`, `newsHours` in `assets/js/config.js`).
4. **Reminders:** done. Once a day call `GET /reminders?key=<key>` (cron-job.org, around 11:00). The key is in the database: `select key from timbro.job_keys where name = 'reminders';` (`supabase/updates/10-reminders.sql`). The database picks customers who haven't been in for the café's chosen days (`messages.remind`, default 21) and haven't been reminded since their last visit, at most 300 a run, and marks them. iPhones get a push and the new pass shows the café's reminder text (with `{business}`, `{name}`, `{left}`, `{reward}` filled in) on the lock screen; Google cards get it as a notification. The reminder stays on the card until the next stamp.

