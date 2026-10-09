# Timbro on Instagram

Ready-to-post images and reels for the Timbro Instagram page, in Italian (`it/`) and English (`en/`), plus the profile picture and story highlight covers (`brand/`).

All of it is drawn by [`studio.html`](studio.html) with the same card the cafés' customers see, so it always matches the product. Rebuild after any change (copy, prices in `assets/js/config.js`):

```
FFMPEG=/path/to/ffmpeg node marketing/instagram/make.js          # everything
FFMPEG=/path/to/ffmpeg node marketing/instagram/make.js reel-how # one asset
```

Milan cafés mostly read Italian: post the `it/` version with the Italian caption, and put the English caption underneath if you like.

## The files

| File | Format | What it is |
|---|---|---|
| `ad-hero.png` | Feed 4:5 | The ad: the card on an iPhone, four features, price and "30 days free" |
| `ad-hero-story.png` | Story 9:16 | The same ad for stories |
| `reel-ad-hero.mp4` | Reel 9:16, 7.5 s | The ad, animated: the phone turns in, stamps land, price and offer appear |
| `post-intro.png` | Feed 4:5 | The card on the phone: what Timbro is |
| `post-paper-vs-phone.png` | Feed 4:5 | Paper card vs phone card |
| `carousel-mistakes-1…7.png` | Carousel 4:5 | 5 loyalty card mistakes |
| `carousel-tricks-1…5.png` | Carousel 4:5 | 3 tricks that bring customers back |
| `post-prices.png` | Feed 4:5 | Start, Plus, Pro and the 30 free days |
| `post-not-just-coffee.png` | Feed 4:5 | Gelato shop, cocktail bar, bakery, salon |
| `reel-stamps.mp4` | Reel 9:16, 12 s | Ten mornings, ten stamps, a free coffee |
| `reel-paper-to-phone.mp4` | Reel 9:16, 11.8 s | The paper card left at home, then the phone card |
| `reel-styles.mp4` | Reel 9:16, 11.5 s | Five card styles, then your logo as the stamp |
| `reel-results.mp4` | Reel 9:16, 11.5 s | What the café sees (example data) |
| `reel-how.mp4` | Reel 9:16, 13 s | How it works in 3 steps |
| `reel-not-just-coffee.mp4` | Reel 9:16, 11.8 s | Four other kinds of shops |
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

## Posting plan (4 weeks, 3 posts a week)

| Week | Monday | Wednesday | Friday |
|---|---|---|---|
| 1 | `ad-hero` (pin it) | `reel-stamps` | `carousel-mistakes` |
| 2 | `reel-paper-to-phone` | `post-paper-vs-phone` | `reel-how` |
| 3 | `carousel-tricks` | `reel-styles` | `post-prices` |
| 4 | `reel-results` | `post-not-just-coffee` | `reel-not-just-coffee` |

Post the first three on the same day before you start sharing the page, so it doesn't look empty. Reply to every comment in the first hour.

## Captions

Instagram allows at most 5 hashtags per post.

### ad-hero, ad-hero-story, reel-ad-hero
Use it as the pinned post, for paid promotion, and as a story with a link sticker.

**IT**
> La carta fedeltà del tuo bar, sul telefono ☕
> Niente app: il cliente inquadra un QR alla cassa. Il barista timbra con il telefono che ha già. Tu vedi chi torna. La carta la disegniamo con il logo e i colori del tuo locale.
> 30 giorni gratis, poi da 10 € al mese. Link in bio.
>
> #cartafedeltà #barmilano #caffè #piccoleimprese #milano

**EN**
> Your café's loyalty card, on the phone ☕
> No app: customers scan a QR at the till. Staff stamp with the phone they already have. You see who comes back. We design the card with your logo and colours.
> 30 days free, then from €10 a month. Link in bio.
>
> #loyaltycard #coffeeshopowner #smallbusiness #cafe #milan

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
> Prezzi chiari: Start 10 €, Plus 20 €, Pro 30 € al mese, IVA esclusa.
> Con Plus la carta la disegniamo noi e il kit stampato arriva a casa tua. I primi 30 giorni sono gratis e disdici quando vuoi. Con l'annuale paghi 10 mesi e ne hai 12.
> Link in bio.
>
> #cartafedeltà #barmilano #piccoleimprese #ristorazione #milano

**EN**
> Simple prices: Start €10, Plus €20, Pro €30 a month, excluding VAT.
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
> Minimal, giapponese, Milano sera, bottega… o il tuo logo come timbro.
> Quale stile sceglieresti per il tuo bar? 👇 Con il piano Plus la carta la disegniamo noi.
>
> #cartafedeltà #graphicdesign #branding #barmilano #design

**EN**
> Minimal, Japanese, Milan night, bottega… or your own logo as the stamp.
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

## Keep it honest

- The posts say "on the phone", not "in Apple Wallet": Wallet saving isn't switched on yet (`wallet/README.md`). Change the copy once it is.
- `reel-results` shows example data, and says so on screen.
- No real café's name or logo appears. When a café agrees, make a post about them with their own numbers, as an Instagram Collab post.
