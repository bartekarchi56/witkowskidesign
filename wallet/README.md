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
1. Sign up at **pay.google.com/business/console** and request access to the Google Wallet API. You get an **Issuer ID**.
2. In Google Cloud, enable the **Google Wallet API**, create a **service account** and download its JSON key.
3. In the Wallet console, add the service account's email under *Users*.
4. Passes work right away for test accounts. Ask Google to approve your issuer before real customers use it.

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

## What's not done yet (needs the database)

- **Live updates.** A saved pass shows the stamps it had when it was added. To update it on every stamp:
  - Apple: add `webServiceURL` + `authenticationToken` to the pass, implement Apple's PassKit web service endpoints (register device, list updated passes, send latest pass) and send an APNs push with the pass certificate after each stamp.
  - Google: after each stamp, `PATCH` the loyalty object through the Google Wallet REST API.
- **Trusting the browser.** Solved when `SUPABASE_URL` is set: the card and stamps come from the database. In demo mode the page still sends them, so keep `ALLOWED_ORIGINS` set.
- **Uploaded logos on Google Wallet.** Google needs the logo at a public URL, so it uses the card's stamp for now. Apple uses the uploaded logo.
- **Official buttons.** Apple and Google publish official "Add to Wallet" badge artwork with usage rules. Swap them in for the buttons in `app/card.html` before launch.

## Notifications to customers

Each café writes its own messages in the dashboard (**Notifiche / Notifications**): *almost there*, *reward ready*, a *reminder* after N days without a visit, and *near the café*. They are stored on the card (`messages`, see `supabase/schema.sql`) and this server already puts them on the passes (`messages.js`):

- **Apple:** a `news` field on the back of the pass carries the café's text with `changeMessage: "%@"`, so when it changes Wallet shows it on the lock screen (the plain "Stamps: 7/8" alert is left out while there is a message). With *near the café* on and a location saved, the pass gets `locations` + `relevantText`, so iPhones show the card on the lock screen near the café, with no server needed.
- **Google:** the same text is added to the loyalty object's `messages`.

### Phase 2: sending updates to phones (needs the accounts above and this server online)

Today a pass shows the message it was saved with. To update passes already in Wallet:

1. **Host this server** (e.g. Render, Railway or Fly.io) and set `PUBLIC_URL`.
2. **Apple:** add `webServiceURL` and an `authenticationToken` to each pass, implement Apple's PassKit web service on this server (register / unregister a device, list updated passes, return the latest pass, log), and store device registrations in the database. After each stamp, or when a message applies, send an empty push through APNs with the Pass Type ID certificate; the phone then downloads the new pass and shows the message.
3. **Google:** after each stamp, PATCH the loyalty object; to notify, add a message with `messageType: TEXT_AND_NOTIFY` (Google allows a few per day per pass).
4. **Reminders:** a daily job (Supabase `pg_cron` or a scheduled function) finds customers whose last visit is older than the café's `remind.days` and who haven't been reminded since that visit, builds their pass with `notice` set to the reminder text (`buildApplePass({ ..., notice })`) and pushes it.

