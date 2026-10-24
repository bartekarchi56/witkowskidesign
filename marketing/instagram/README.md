# Timbro on Instagram

Ready-to-post images and reels for the Timbro Instagram page, in Italian (`it/`) and English (`en/`), plus the profile picture and story highlight covers (`brand/`).

All of it is drawn by [`studio.html`](studio.html) with the same card the cafés' customers see, so it always matches the product. Rebuild after any change (copy, prices in `assets/js/config.js`):

```
FFMPEG=/path/to/ffmpeg node marketing/instagram/make.js          # everything
FFMPEG=/path/to/ffmpeg node marketing/instagram/make.js reel-how # one asset
```

The account posts in English: the `en/` images with the English caption (`schedule.json`: `"lang": "en"`, `"captions": ["en"]`). The Italian versions stay here if that ever changes.

## The files

| File | Format | What it is |
|---|---|---|
| `ad-hero.png` | Feed 4:5 | The ad: the card on an iPhone, four features, price and "30 days free" |
| `ad-hero-story.png` | Story 9:16 | The same ad for stories |
| `reel-ad-hero.mp4` | Reel 9:16, 7.5 s | The ad, animated: the phone turns in, stamps land, price and offer appear |
| `reel-showcase.mp4` | Reel 9:16, 17.4 s | 3D product video on a dark stage: the phone flies in, stamps land in close-up, the message lifts out of the screen, stamps burst at ten, three styles, results tiles |
| `stamps-sheet.png`, `stamps-inks.png` | 1:1, 4:5 | The six standard stamps; in three inks and on the card |
| `post-intro.png` | Feed 4:5 | The card on the phone: what Timbro is |
| `post-paper-vs-phone.png` | Feed 4:5 | Paper card vs phone card |
| `carousel-mistakes-1…7.png` | Carousel 4:5 | 5 loyalty card mistakes |
| `carousel-tricks-1…5.png` | Carousel 4:5 | 3 tricks that bring customers back |
| `post-prices.png` | Feed 4:5 | Start, Plus, Pro and the 30 free days |
| `post-not-just-coffee.png` | Feed 4:5 | Gelato shop, cocktail bar, bakery, salon |
| `reel-stamps.mp4` | Reel 9:16, 12 s | Ten mornings, ten stamps, a free coffee |
| `reel-paper-to-phone.mp4` | Reel 9:16, 11.8 s | The paper card left at home, then the phone card |
| `reel-styles.mp4` | Reel 9:16, 11.5 s | Five card styles, each with its stamp, then the sixth stamp |
| `reel-results.mp4` | Reel 9:16, 11.5 s | What the café sees (example data) |
| `reel-how.mp4` | Reel 9:16, 13 s | How it works in 3 steps |
| `reel-not-just-coffee.mp4` | Reel 9:16, 11.8 s | Four other kinds of shops |
| `reel-3-kinds.mp4` | Reel 9:16, 37 s, voice | "Your café has 3 kinds of customers": isometric café, regulars, almost there, slipped away (EN only) |
| `post-wallet-live.png` | Feed 4:5 | The card updates itself: iPhone, lock-screen notification, 9/10 |
| `post-reminder.png` | Feed 4:5 | The automatic "we miss you" reminder on a lock screen, with the café's name |
| `post-apple-google.png` | Feed 4:5 | The same card in Apple Wallet and Google Wallet |
| `carousel-doubts-1…6.png` | Carousel 4:5 | 4 doubts before switching: app, reader, no Wallet, time to start |
| `post-chains.png` | Feed 4:5 | Chains: visits per location (example numbers) and the per-location price |
| `reel-*-cover.png` | 9:16 | Cover image for each reel |
| `brand/profile.png` | 1:1 | Profile picture (the Timbro stamp) |
| `brand/highlight-*.png` | 9:16 | Highlight covers: how, prices, examples, faq, contact |

The reels have no sound on purpose: add a trending sound or music from Instagram's library when you post. Upload the matching `-cover.png` as the reel cover. Story text can go on the reels too: they're 9:16.

## Profile

- **Name:** Timbro · Carta fedeltà digitale
- **Username:** for example `timbro.card` or `timbro.milano` (check what's free)
- **Bio (IT):** La carta fedeltà del tuo bar, sul telefono. Niente app. 30 giorni gratis ⬇️ by @witkowskidesign
- **Bio (EN):** Your café's loyalty card, on the phone. No app. 30 days free ⬇️ by @witkowskidesign
- **Link:** https://timbro.witkowskidesign.com
- **Highlights:** Come funziona (`highlight-how`), Prezzi (`highlight-prices`), Esempi (`highlight-examples`), FAQ (`highlight-faq`), Contatti (`highlight-contact`). Fill them with stories made from the reels and posts.

## Posting plan (5 weeks, 3 posts a week)

| Week | Monday | Wednesday | Friday |
|---|---|---|---|
| 1 | `ad-hero` (pin it) | `reel-stamps` | `carousel-mistakes` |
| 2 | `reel-showcase` | `post-paper-vs-phone` | `reel-how` |
| 3 | `carousel-tricks` | `reel-styles` | `post-prices` |
| 4 | `reel-results` | `post-not-just-coffee` | `reel-not-just-coffee` |
| 5 | `reel-paper-to-phone` | `post-prices` again as a story | `reel-ad-hero` |

Post the first three on the same day before you start sharing the page, so it doesn't look empty. Reply to every comment in the first hour.

## Automatic posting

A GitHub Action (`.github/workflows/instagram.yml`) runs every 30 minutes during the day and posts whatever [`schedule.json`](schedule.json) says is due, through Instagram's official API. Captions come from the **Captions** section below: the Italian text, the English text under it, then the Italian hashtags. What it posted is written to `posted.json`, so nothing goes out twice. A post more than 2 days late is skipped, never dumped.

- **Add or move a post:** add a line to `schedule.json` (`at` in Rome time, `post` = the file name without extension, `type` = `image`, `carousel`, `reel` or `story`), or ask Claude.
- **New images:** after `make.js`, run `node marketing/instagram/make-jpg.js` (Instagram's API takes JPEG only) and push at least 15 minutes before the post, so the website already serves the file.
- **Check before it goes out:** `node marketing/instagram/post.js --dry --now "2026-11-02 12:45"` shows what would be posted at that time. `node marketing/instagram/test-post.js` tests the whole flow against a fake Instagram.
- **Post now by hand:** GitHub > Actions > Instagram > Run workflow.
- **Answers to TIMBRO comments:** after posting, the same job (`replies.js`) looks at the comments of the last month's posts. Everyone who writes **TIMBRO** gets one private message (Instagram's official *private reply* to a comment, allowed once per comment within 7 days) asking for their café's name and Instagram, plus a public reply under the comment ("Ti ho scritto in DM! / Sent you a DM! 📩"). Texts and keyword: `commentReply` in `schedule.json`. Who was answered: `replied.json`. So replies arrive within about 30 minutes during the day. When they write back with their café, make their sample card (or ask Claude) and answer by hand. It needs two permissions on the key, `instagram_business_manage_comments` and `instagram_business_manage_messages` (both offered under *API setup with Instagram login*; generate the key again if it was made without them), and in the Instagram app: Settings > Messages and story replies > Connected tools > **Allow access to messages**. Test: `node marketing/instagram/test-replies.js`.
- **Call to action:** every caption ends with `callToAction` from `schedule.json`, just before the hashtags (now: "Comment TIMBRO and we will send you the design of your card ☕"). Stories have no caption, so none there.

### Connecting the account (once, about 20 minutes)

This uses Instagram's own login, so no Facebook Page is needed. The account must be professional (Business or Creator).

1. **Developer account.** Go to developers.facebook.com and log in (register as a developer if it asks).
2. **App.** My Apps > Create app. Name: `Timbro poster`. Use case: **Manage messaging and content on Instagram**. Skip linking a business portfolio if it asks, then Create.
3. **Connect Instagram.** In the app: Instagram > **API setup with Instagram login** > Generate access tokens > **Add account**, and log in with Timbro's Instagram. If it asks for a tester first: App roles > Roles > Add Instagram tester, then accept it in the Instagram app (Settings > Apps and websites > Tester invites).
4. **Copy two things.** Next to the account: its **Instagram user ID** (a long number), and **Generate token** gives the key. The key is a password: never in chat, email or the repo.
5. **GitHub secrets.** In the repository: Settings > Secrets and variables > Actions > New repository secret: `IG_ACCESS_TOKEN` (the key) and `IG_USER_ID` (the ID).
6. **Key renewal.** The key lasts 60 days; `.github/workflows/instagram-token.yml` renews it every Monday. So that it can save a renewed key: github.com/settings/personal-access-tokens > Generate new token (fine-grained), only this repository, permission **Secrets: Read and write**, expiry 1 year. Save it as a third secret, `GH_SECRETS_TOKEN`.
7. **Test.** Actions > **Instagram key** > Run workflow (should say the key is valid for about 60 days), then Actions > **Instagram** > Run workflow (says "Nothing due" until the first date in `schedule.json`).

With a key made through a Facebook Page and a Meta system user instead (never expires), add the repository variable `IG_API_BASE` = `https://graph.facebook.com/v21.0`; the renewal job is then not needed.

GitHub often starts scheduled runs late (sometimes by an hour), and it pauses scheduled runs in a repository with no commits for 60 days. For exact times, let cron-job.org start the job: make a fine-grained GitHub token for this repository with **Actions: Read and write**, then a cron-job.org job (every 30 minutes) with URL `https://api.github.com/repos/bartekarchi56/witkowskidesign/actions/workflows/instagram.yml/dispatches`, method **POST**, headers `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, and body `{"ref":"claude/loopy-loyalty-pricing-redesign-yg54mp"}`. GitHub answers 204 when it starts.

## Captions

Instagram allows at most 5 hashtags per post.

### ad-hero, ad-hero-story, reel-ad-hero
Use it as the pinned post, for paid promotion, and as a story with a link sticker.

**IT**
> La carta fedeltà del tuo bar, sul telefono ☕
> Niente app: il cliente inquadra un QR alla cassa. Il barista timbra con il telefono che ha già. Tu vedi chi torna. La carta la disegniamo con il logo e i colori del tuo locale.
> 30 giorni gratis, poi da 19 € al mese. Link in bio.
>
> #cartafedeltà #barmilano #caffè #piccoleimprese #milano

**EN**
> Your café's loyalty card, on the phone ☕
> No app: customers scan a QR at the till. Staff stamp with the phone they already have. You see who comes back. We design the card with your logo and colours.
> 30 days free, then from €19 a month. Link in bio.
>
> #loyaltycard #coffeeshopowner #smallbusiness #cafe #milan

### reel-showcase
Add a punchy track with a clear beat: the shots change at about 2.6, 5.1, 7.7, 9.9, 12.4 and 14.8 seconds.

**Voiceover (ElevenLabs).** Model Multilingual v2 (it reads the `<break>` tags), a warm, relaxed voice, Stability 50, Similarity 75, Style 20, speed 1.0. Paste one block, then nudge the clip in the editor so each line starts on its shot. Keep the music about 15 dB under the voice. If the voice says "Tim-bro", write "Teembro".
`en/reel-showcase-voice.mp4` is the EN reel with the ElevenLabs take, each line moved onto its shot and the end card held 0.9 s longer (18.3 s, -16 LUFS). Make it again if the reel changes.

| Time | Shot | EN | IT |
|---|---|---|---|
| 0.3 | The phone flies in | Your café. On the phone. | Il tuo bar. Sul telefono. |
| 2.6 | Stamps land | Every coffee, a stamp. | Ogni caffè, un timbro. |
| 5.1 | The message lifts out | One stamp away? We remind them. | Manca un timbro? Glielo ricordiamo noi. |
| 7.7 | Stamps burst | The tenth is on the house. | Il decimo è offerto. |
| 9.9 | Three styles | Your style. Your stamp. | Il tuo stile. Il tuo timbro. |
| 12.4 | Results | And you see who comes back. | E vedi chi torna. |
| 15.2 | End card | Timbro. No app. Thirty days free. | Timbro. Niente app. Trenta giorni gratis. |

```
<break time="0.3s" /> Your café. On the phone. <break time="0.7s" /> Every coffee, a stamp. <break time="1.1s" /> One stamp away? We remind them. <break time="0.6s" /> The tenth is on the house. <break time="0.6s" /> Your style. Your stamp. <break time="0.9s" /> And you see who comes back. <break time="1.2s" /> Timbro. No app. Thirty days free.
```

```
<break time="0.3s" /> Il tuo bar. Sul telefono. <break time="0.6s" /> Ogni caffè, un timbro. <break time="1.0s" /> Manca un timbro? Glielo ricordiamo noi. <break time="0.4s" /> Il decimo è offerto. <break time="0.7s" /> Il tuo stile. Il tuo timbro. <break time="0.8s" /> E vedi chi torna. <break time="1.1s" /> Timbro. Niente app. Trenta giorni gratis.
```

**IT**
> Il tuo bar, sul telefono ☕
> Ogni caffè un timbro, al decimo offre il bar. Lo stile lo scegli tu, e vedi chi torna. Niente app, niente cartoncini.
> 30 giorni gratis: link in bio.
>
> #cartafedeltà #barmilano #caffè #design #milano

**EN**
> Your café, on the phone ☕
> Every coffee a stamp, the tenth is on the house. You pick the style, and you see who comes back. No app, no paper cards.
> 30 days free: link in bio.
>
> #loyaltycard #coffeeshop #productdesign #smallbusiness #milan

### post-intro
**IT**
> La carta fedeltà del tuo bar, sul telefono ☕
> I clienti inquadrano un QR alla cassa e la carta è loro. Il barista aggiunge il timbro in due secondi. Niente app, niente cartoncini da perdere.
> 30 giorni gratis: link in bio.
>
> #cartafedeltà #barmilano #caffè #piccoleimprese #milano

**EN**
> Your café's loyalty card, on the phone ☕
> Customers scan a QR code at the till and the card is theirs. Staff add a stamp in two seconds. No app, no paper cards to lose.
> 30 days free: link in bio.
>
> #loyaltycard #coffeeshopowner #smallbusiness #cafe #milan

### post-paper-vs-phone
**IT**
> Quanti cartoncini con 9 timbri su 10 hai nel portafoglio? 🙋
> Il cartoncino si perde, resta a casa o si "timbra" con una penna. Sul telefono c'è sempre, timbra solo il bar e finalmente vedi chi torna.
> Manda questo post al bar dove vai ogni mattina 👀
>
> #cartafedeltà #primaedopo #caffè #barmilano #piccoleimprese

**EN**
> How many coffee cards with 9 out of 10 stamps are in your wallet? 🙋
> Paper cards get lost, stay at home or get "stamped" with a pen. On the phone it's always there, only staff can stamp, and the café finally sees who comes back.
> Send this to the café you go to every morning 👀
>
> #loyaltycard #beforeandafter #coffeelovers #smallbusiness #cafe

### carousel-mistakes
**IT**
> Salvalo prima di stampare i prossimi cartoncini 📌
> Quasi tutte le carte fedeltà falliscono per gli stessi 5 motivi, e nessuno riguarda il caffè.
> Quale errore fa il tuo bar? Dimmelo nei commenti 👇
>
> #cartafedeltà #marketingbar #consiglimarketing #piccoleimprese #baristi

**EN**
> Save this before you print your next box of cards 📌
> Most loyalty cards fail for the same 5 reasons, and none of them is the coffee.
> Which one is your café guilty of? Tell me in the comments 👇
>
> #loyaltycard #cafemarketing #marketingtips #coffeeshopowner #smallbusiness

### carousel-tricks
**IT**
> Tre piccoli trucchi che fanno finire la carta ai clienti ☕
> Salvalo per la prossima riunione con lo staff. Quale provi per primo? 👇
>
> #cartafedeltà #marketingbar #fidelizzazione #piccoleimprese #milano

**EN**
> Three small tricks that make customers actually finish their card ☕
> Save it for your next team meeting. Which one will you try first? 👇
>
> #loyaltycard #cafemarketing #customerloyalty #smallbusinesstips #coffeeshopowner

### post-prices
**IT**
> Prezzi chiari: Start 19 €, Plus 39 €, Pro 79 € al mese, IVA esclusa.
> Con Plus la carta la disegniamo noi e il kit stampato arriva a casa tua. I primi 30 giorni sono gratis e disdici quando vuoi. Con l'annuale paghi 10 mesi e ne hai 12.
> Link in bio.
>
> #cartafedeltà #barmilano #piccoleimprese #ristorazione #milano

**EN**
> Simple prices: Start €19, Plus €39, Pro €79 a month, excluding VAT.
> On Plus we design the card for you and send the printed kit. The first 30 days are free and you can cancel anytime. Yearly: pay for 10 months, get 12.
> Link in bio.
>
> #loyaltycard #smallbusiness #cafeowner #hospitality #milan

### post-not-just-coffee
**IT**
> Il caffè era solo l'inizio. Gelato, brioche, spritz, una piega: se i tuoi clienti tornano, una carta timbri li fa tornare più spesso.
> Tagga un locale che ne ha bisogno 👇
>
> #gelateria #pasticceria #aperitivo #parrucchiere #piccoleimprese

**EN**
> Coffee was just the start. Gelato, pastries, spritz, a blow-dry: if your customers come back, a stamp card brings them back more often.
> Tag a place that needs this 👇
>
> #gelato #bakery #cocktailbar #hairsalon #smallbusiness

### reel-stamps
**IT**
> Ogni caffè, un timbro. Al decimo, offre il bar ☕
> La carta fedeltà sul telefono dei tuoi clienti, con il nome e lo stile del tuo locale. 30 giorni gratis: link in bio.
>
> #cartafedeltà #caffè #barmilano #baristi #milano

**EN**
> Every coffee, a stamp. At ten, it's on the house ☕
> The loyalty card on your customers' phones, with your café's name and style. 30 days free: link in bio.
>
> #loyaltycard #coffee #coffeeshop #barista #milan

### reel-paper-to-phone
**IT**
> Il cartoncino resta a casa. Il telefono no 📱
> Con Timbro la carta fedeltà è sempre in tasca, timbra solo il barista e tu vedi chi torna. Manda questo reel al tuo bar preferito 👀
>
> #cartafedeltà #primaedopo #caffè #barmilano #piccoleimprese

**EN**
> The paper card stays at home. The phone doesn't 📱
> With Timbro the loyalty card is always in their pocket, only staff can stamp, and you see who comes back. Send this to your favourite café 👀
>
> #loyaltycard #beforeandafter #coffeelovers #cafe #smallbusiness

### reel-styles
**IT**
> Timbro, minimal, giapponese, Milano sera, bottega: sei timbri da scegliere, o il tuo logo.
> Quale stile sceglieresti per il tuo bar? 👇 Con il piano Plus la carta la disegniamo noi.
>
> #cartafedeltà #graphicdesign #branding #barmilano #design

**EN**
> Timbro, minimal, Japanese, Milan night, bottega: six stamps to choose from, or your own logo.
> Which style fits your café? 👇 On the Plus plan, we design the card for you.
>
> #loyaltycard #graphicdesign #branding #cafedesign #design

### reel-results
**IT**
> Con i cartoncini non sai mai quanti clienti tornano. Con Timbro lo vedi nella tua area: clienti con la carta, visite, chi torna, premi dati.
> (Nel video: dati di esempio.) Commenta DEMO e ti mando il link per provarla.
>
> #cartafedeltà #datiedecisioni #piccoleimprese #barmilano #fidelizzazione

**EN**
> With paper cards you never know how many customers come back. With Timbro you see it in your dashboard: members, visits, who returns, rewards given.
> (The video uses example data.) Comment DEMO and I'll send you a link to try it.
>
> #loyaltycard #customerloyalty #smallbusiness #cafeowner #analytics

### reel-how
**IT**
> Come funziona, in 3 passi:
> 1. Il cliente inquadra il QR alla cassa.
> 2. Il barista timbra la carta con il telefono del bar.
> 3. Al decimo timbro, il premio.
> Niente app da scaricare, niente cassa nuova. 30 giorni gratis: link in bio.
>
> #cartafedeltà #comefunziona #barmilano #piccoleimprese #caffè

**EN**
> How it works, in 3 steps:
> 1. Customers scan the QR code at the till.
> 2. Staff stamp the card with the café's phone.
> 3. At the tenth stamp, the reward.
> No app to download, no new till. 30 days free: link in bio.
>
> #loyaltycard #howitworks #coffeeshopowner #smallbusiness #cafe

### reel-not-just-coffee
**IT**
> Non hai un bar? Funziona lo stesso 🍦🍹🥐✂️
> Gelaterie, cocktail bar, pasticcerie, parrucchieri: ovunque i clienti tornano. Tagga un locale che ne ha bisogno 👇
>
> #gelateria #aperitivo #pasticceria #parrucchiere #piccoleimprese

**EN**
> Not a café? It works just the same 🍦🍹🥐✂️
> Gelato shops, cocktail bars, bakeries, salons: anywhere customers come back. Tag a place that needs this 👇
>
> #gelato #cocktailbar #bakery #hairsalon #smallbusiness

### post-wallet-live
**IT**
> La carta si aggiorna da sola ✨
> Il barista timbra e la carta nel Wallet del cliente cambia in un secondo: niente da riaprire, niente app. Quando manca un timbro, arriva anche l'avviso sul telefono.
> 30 giorni gratis: link in bio.
>
> #cartafedeltà #applewallet #barmilano #caffè #piccoleimprese

**EN**
> The card updates itself ✨
> Staff add a stamp and the card in your customer's Wallet changes in a second: nothing to reopen, no app. One stamp away? Their phone tells them.
> 30 days free: link in bio.
>
> #loyaltycard #applewallet #coffeeshop #smallbusiness #cafe

### carousel-doubts
**IT**
> Le 4 domande che ci fanno tutti i baristi, con le risposte brevi 👇
> App? Tablet? E chi non usa il Wallet? Scorri, e se hai un altro dubbio scrivici in DM.
>
> #cartafedeltà #barmilano #baristi #piccoleimprese #milano

**EN**
> The 4 questions every café owner asks us, with short answers 👇
> An app? A tablet? What if they don't use Wallet? Swipe, and if you have another question, send us a DM.
>
> #loyaltycard #coffeeshopowner #smallbusiness #cafe #milan

### carousel-pocket
**IT**
> Il posto dove i tuoi clienti tengono sempre il telefono? In tasca. Ed è lì che vive la tua carta fedeltà 📲
> Bar, pasticceria, salone, gelateria: ogni locale con la sua carta, il suo timbro e il suo premio. Scorri fino all'ultima.
>
> #cartafedeltà #piccoleimprese #barmilano #marketinglocale #milano

**EN**
> Where do your customers always keep their phone? In their pocket. That's where your loyalty card lives now 📲
> Café, bakery, salon, gelato shop: every place gets its own card, its own stamp and its own reward. Swipe to the last one.
>
> #loyaltycard #smallbusiness #coffeeshop #localbusiness #cafeowner

### carousel-new-way
**IT**
> Il cartoncino fedeltà finisce sempre nella giacca sbagliata. Il telefono no ✨
> Il cliente inquadra il QR alla cassa, salva la carta nel Wallet e raccoglie i timbri. Niente app, niente carta.
>
> #cartafedeltà #baristi #piccoleimprese #applewallet #milano

**EN**
> The paper loyalty card always ends up in the wrong jacket. The phone never does ✨
> Customers scan the QR at the till, save the card to their Wallet and collect stamps. No app, no paper.
>
> #loyaltycard #coffeeshopowner #smallbusiness #applewallet #googlewallet

### post-reminder
**IT**
> Il cliente non passa da tre settimane? Glielo ricorda la carta, da sola 📲
> Un promemoria sul telefono con il nome del tuo bar e quanti timbri mancano. Il testo e i giorni li scegli tu, e arriva al massimo una volta per visita.
> Link in bio.
>
> #cartafedeltà #fidelizzazione #barmilano #marketingbar #piccoleimprese

**EN**
> A regular hasn't been in for three weeks? The card reminds them, by itself 📲
> A note on their phone with your café's name and how many stamps are left. You choose the words and the days, and it comes at most once per visit.
> Link in bio.
>
> #loyaltycard #customerloyalty #cafemarketing #coffeeshopowner #smallbusiness

### post-apple-google
**IT**
> iPhone o Android? Tutti e due ✅
> La stessa carta finisce nel Wallet che il cliente ha già, Apple o Google, e si aggiorna a ogni timbro. Niente app da scaricare.
> 30 giorni gratis: link in bio.
>
> #cartafedeltà #applewallet #googlewallet #barmilano #caffè

**EN**
> iPhone or Android? Both ✅
> The same card goes into the Wallet your customer already has, Apple or Google, and updates with every stamp. No app to download.
> 30 days free: link in bio.
>
> #loyaltycard #applewallet #googlewallet #coffeeshop #smallbusiness

### post-chains
**IT**
> Più sedi, una sola carta, e i numeri di ognuna 📊
> I clienti timbrano in qualsiasi sede; tu vedi visite, clienti e premi sede per sede. Per le catene da 11 sedi: da 8 € a sede al mese, con una prova in alcune sedi prima di partire.
> Scrivici in DM o dal link in bio.
>
> #cartafedeltà #franchising #catene #ristorazione #retail

**EN**
> Many locations, one card, and numbers for each 📊
> Customers collect stamps at any location; you see visits, customers and rewards shop by shop. For chains of 11 locations or more: from €8 per location a month, with a pilot in a few locations first.
> DM us or use the link in bio.
>
> #loyaltycard #franchise #retail #hospitality #multiunit

### tre-fatti (3D reel: `marketing/animation/timbro-tre-fatti-it.mp4`, `-en.mp4`, 37 s, with sound)
Three facts from published studies, each named on screen. The cover is `marketing/animation/timbro-tre-fatti-<lang>-cover.jpg`.

Voice-over: `timbro-tre-fatti-en-voice.mp4` is the same video with a voice (ElevenLabs, Multilingual v2). To make another, generate the script below as one take with a pause between sentences, then `FFMPEG=/path/to/ffmpeg node marketing/animation/voice.js tre-fatti <it|en> voice.mp3`: it finds the 14 sentences, puts each at its moment and lowers the music under the voice.

| Video | EN | IT |
|---|---|---|
| 0:00 | Three facts about regulars that most cafés don't know. | Tre fatti sui clienti abituali che quasi nessun bar conosce. |
| 0:03.7 | Fact one. Two cards, both need eight stamps. But card B starts with two already in. | Primo fatto. Due carte, servono otto timbri. Ma la B parte con due già fatti. |
| 0:09 | Nineteen percent finish card A. Thirty-four percent finish card B. Almost double, same reward. | La A la finisce il diciannove per cento. La B il trentaquattro. Quasi il doppio, stesso premio. |
| 0:14.8 | Fact two. The closer they get to the free coffee, the more often they come back. | Secondo fatto. Più si avvicinano al caffè gratis, più spesso tornano. |
| 0:19.5 | That's why Timbro reminds them when they're one stamp away. | Per questo Timbro li avvisa quando manca un timbro. |
| 0:23 | Fact three. Winning a new customer costs five to twenty-five times more than keeping one. | Terzo fatto. Trovare un cliente nuovo costa da cinque a venticinque volte di più che tenerne uno. |
| 0:29 | The easiest customer is the one you already have. | Il cliente più facile? Quello che hai già. |
| 0:32.7 | Comment TIMBRO, and we'll send you the design of your card. | Commenta TIMBRO, e ti mandiamo il design della tua carta. |

**IT**
> 3 fatti sui clienti abituali che quasi nessun bar conosce 🧠☕
> 1. Due carte, 8 timbri per tutte e due. Quella che parte con 2 timbri già fatti la completa il 34% dei clienti, l'altra il 19% (Nunes & Drèze, 2006).
> 2. Più si avvicinano al premio, più spesso tornano (Kivetz, Urminsky & Zheng, 2006, bar della Columbia University).
> 3. Trovare un cliente nuovo costa da 5 a 25 volte di più che tenerne uno (Harvard Business Review, 2014).
> Quale ti ha sorpreso di più? 👇
>
> #cartafedeltà #clientifedeli #barmilano #marketingperbar #piccoleimprese

**EN**
> 3 facts about regulars that most cafés don't know 🧠☕
> 1. Two cards, both need 8 stamps. The one that starts with 2 stamps already in is finished by 34% of customers, the other by 19% (Nunes & Drèze, 2006).
> 2. The closer they get to the reward, the more often they come (Kivetz, Urminsky & Zheng, 2006, a Columbia University café).
> 3. Winning a new customer costs 5 to 25 times more than keeping one (Harvard Business Review, 2014).
> Which one surprised you most? 👇
>
> #loyaltycard #customerloyalty #coffeeshopowner #cafemarketing #smallbusiness

### reel-3-kinds
The isometric 3D reel with a voice-over, English only, 37 s: `en/reel-3-kinds.mp4` (a copy of `marketing/animation/timbro-tre-clienti-en-voice.mp4`, made by `tre-clienti.html`).
"Your café has 3 kinds of customers. You only see one." The regulars, the ones almost at their reward and the ghosts of the ones who slipped away; the dashboard, the 1-stamp message and the reminder bring them back. Cover: `jpg/en/reel-3-kinds-cover.jpg`. The groups, labels and messages are the product's own (dashboard "Customers who come back", "Almost at the reward", "Not back for 30 days"; reminder after 21 days); the dashboard on the phone says "Example".

Voice (ElevenLabs, one take): Your café has three kinds of customers. / You only see one. / The regulars. They come back again and again, and you know their order. / Then there are the almost-there ones: one or two stamps from a free coffee, and nobody tells them. / And the ones who slipped away. Thirty days without a visit, and nobody noticed. / Timbro shows you all three. / It tells the almost-there ones they're one stamp away. / And after three weeks, it reminds the ones who drifted off to come back. / Comment TIMBRO, and we'll send you the design of your card.
The video is timed to that take (`tre-clienti.json`); a new take means setting the times there again, rendering, then `node marketing/animation/voice.js tre-clienti en voice.mp3`.

**EN**
> Your café has 3 kinds of customers. You only see one 👀
> 🔵 The regulars: they come back, you know their order.
> 🟡 The almost-there ones: 1 or 2 stamps from a free coffee, and nobody tells them.
> ⚪ The ones who slipped away: 30 days without a visit, and nobody noticed.
> Timbro shows you all three, tells the almost-there ones when they're 1 stamp away, and after 3 weeks reminds the ones who drifted off.
> Which kind is your best customer? 👇
>
> #loyaltycard #customerloyalty #coffeeshopowner #cafemarketing #smallbusiness #cafe #coffeeshop

## Keep it honest

- The posts say "on the phone", not "in Apple Wallet": Wallet saving isn't switched on yet (`wallet/README.md`). Change the copy once it is.
- `reel-results` shows example data, and says so on screen.
- `tre-fatti`: fact 1 comes from a car wash's loyalty cards and the video says so; the two cards are generic, not coffee cards. The "×5–25" range is HBR's; the coins are a picture of it, not a measurement.
- No real café's name or logo appears. When a café agrees, make a post about them with their own numbers, as an Instagram Collab post.
