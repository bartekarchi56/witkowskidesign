# Kit for Orsonero Coffee

Everything to send to or show Orsonero Coffee (Via Giuseppe Broggi 15, Porta Venezia, Milano).
Brent Jopson is Canadian: write to him in English. Giulia Gasperini is from Milan: Italian.
Open Tuesday to Friday 8-17, Saturday 9-17, Sunday 9-13, closed Monday.

Rebuild the files after changes: `node print/make-pdfs.js`, then `node print/make-kit-orsonero.js`.

## The files

| File | What it is | Use it for |
|---|---|---|
| `proposal-orsonero-en.pdf` | The whole proposal page in one PDF | Attach to the first email |
| `orsonero-card-iphone.png` | Their card in Apple Wallet, 6 of 8 bears | Email, Instagram DM, WhatsApp |
| `orsonero-card-android.png` | The same card in Google Wallet | WhatsApp, if they use Android |
| `orsonero-instagram-post.png` | The launch post they would publish (4:5) | Show what they get for Instagram |
| `orsonero-notifications.png` | Messages their customers get on the lock screen | Follow-up email |
| `orsonero-results.png` | The Results page after a few weeks (**example numbers**) | Follow-up email |
| `brochure-orsonero-en.pdf` / `-it.pdf` | A5 brochure with their name | Print one and leave it at the café |
| `poster-orsonero-a5.pdf` | The A5 till poster with the QR code | Print it and bring it to the visit |

## Links

- Proposal (EN): https://timbro.witkowskidesign.com/examples/orsonero/?lang=en
- Proposal (IT): https://timbro.witkowskidesign.com/examples/orsonero/?lang=it
- Their card, as a customer: https://timbro.witkowskidesign.com/app/card.html?card=orsonero
- Their dashboard, Results (example data): https://timbro.witkowskidesign.com/app/dashboard.html?card=orsonero&lang=en#results
- Their dashboard, Notifications: https://timbro.witkowskidesign.com/app/dashboard.html?card=orsonero&lang=en#notify

## The plan

1. **Visit first**, Tuesday to Friday around 10:30 or 14:30, when it is quieter. Have a coffee first, ask for Brent or Giulia, keep it to 5 minutes.
2. **Bring**: your phone with the proposal open, the printed A5 poster and one printed brochure (EN for Brent, IT for Giulia). Leave the brochure.
3. **Same day**: send the email with the PDF and the card image, so they have the link.
4. **No answer in 4-5 days**: the WhatsApp or Instagram follow-up.
5. If you can't go in person, start with the email, then the Instagram DM two days later.

## Before Orsonero starts

- **Wallet is not switched on yet.** Saving to Apple or Google Wallet and the lock-screen reminders need the Apple Developer account, the Google Wallet issuer account and hosting for the wallet server (`wallet/README.md`). Until then the card is a web page customers add to their home screen, and the "one stamp to go" message shows on the card itself. If they say yes, set Wallet up before their launch week, or tell them Wallet arrives in a few weeks.
- **Stripe is still in test mode.** Don't send them to the Plan tab yet. Witkowski Design starts on 1 November 2026: switch Stripe to live then (`supabase/STRIPE.md`), and their 30 free days start when they pick the plan.

## Email to Brent (English)

**Subject:** A loyalty card for Orsonero, with a little black bear

Hi Brent,

I'm Bartek, a designer here in Milan, and a regular fan of Orsonero. I've been building Timbro, a digital stamp card for independent cafés, and I made a first design for you: every stamp is a little black bear, in the spirit of the café.

You can try it here: https://timbro.witkowskidesign.com/examples/orsonero/?lang=en

How it works:
- Customers scan a QR code at the till and the card goes into Apple or Google Wallet. No app to download.
- Your staff add a stamp by scanning the card with the café phone. It takes two seconds.
- At the eighth stamp, the coffee of their choice is on you.
- You see how many people come back, and the card can remind them when they are one stamp away.

For Orsonero I'd suggest the Plus plan: I design the card with your real logo and colours, and send you the printed kit (till poster, window sticker, table cards). It's free for the first 30 days, then €20 a month plus VAT, and you can cancel anytime.

I've attached the proposal as a PDF. Could I drop by one morning this week to show it on a phone? Ten minutes is enough.

Thanks, and see you at the counter,
Bartek

Bartosz Witkowski · Witkowski Design
+48 530 340 988 (WhatsApp)
https://timbro.witkowskidesign.com

*Attach: `proposal-orsonero-en.pdf`, `orsonero-card-iphone.png`*

## Email to Giulia (italiano)

**Oggetto:** Una carta fedeltà per Orsonero, con un piccolo orso nero

Ciao Giulia,

sono Bartek, un designer qui a Milano e cliente affezionato di Orsonero. Sto lanciando Timbro, una carta timbri digitale per i bar indipendenti, e ho preparato una prima idea per voi: ogni timbro è un piccolo orso nero, nello stile del locale.

La potete provare qui: https://timbro.witkowskidesign.com/examples/orsonero/?lang=it

Come funziona:
- Il cliente inquadra il QR alla cassa e la carta va nel Wallet del telefono (Apple o Google). Nessuna app da scaricare.
- Lo staff aggiunge il timbro inquadrando la carta con il telefono del bar. Due secondi.
- All'ottavo timbro, il caffè che preferisce lo offrite voi.
- Vedete quanti clienti tornano, e la carta può ricordare a chi manca un solo timbro di passare.

Per Orsonero consiglio il piano Plus: disegno io la carta con il vostro logo e i vostri colori, e vi mando il kit stampato (poster per la cassa, adesivo per la vetrina, segnatavoli). I primi 30 giorni sono gratis, poi 20 € al mese più IVA, e si disdice quando volete.

Vi allego la proposta in PDF. Posso passare una mattina questa settimana per farvela vedere sul telefono? Bastano dieci minuti.

Grazie e a presto al bancone,
Bartek

Bartosz Witkowski · Witkowski Design
+48 530 340 988 (WhatsApp)
https://timbro.witkowskidesign.com

*Allegati: `brochure-orsonero-it.pdf`, `orsonero-card-iphone.png`*

## Instagram DM

**English:**
Hi Orsonero! I'm Bartek, a designer in Milan. I made a first design of a digital loyalty card for you: it goes in Apple or Google Wallet, no app, and every stamp is a little black bear 🐻 Have a look: https://timbro.witkowskidesign.com/examples/orsonero/?lang=en
Happy to drop by and show it on a phone. Who's the best person to talk to?

**Italiano:**
Ciao Orsonero! Sono Bartek, designer a Milano. Ho disegnato per voi una carta fedeltà digitale: va nel Wallet del telefono, senza app, e ogni timbro è un piccolo orso nero 🐻 Eccola: https://timbro.witkowskidesign.com/examples/orsonero/?lang=it
Passo volentieri a farvela vedere. Con chi posso parlarne?

*Send with `orsonero-card-iphone.png`.*

## WhatsApp follow-up (after the visit or 4-5 days after the email)

**English:**
Hi Brent, Bartek here, thanks for your time today. Here is the Orsonero card again: https://timbro.witkowskidesign.com/examples/orsonero/?lang=en
This is what your customers would see on the lock screen, and what you'd see after a few weeks (example numbers). If you like it, send me your logo and I'll have your real card ready in a couple of days, with the first 30 days free.

**Italiano:**
Ciao Giulia, sono Bartek, grazie per il tempo di oggi. Ecco di nuovo la carta di Orsonero: https://timbro.witkowskidesign.com/examples/orsonero/?lang=it
Questo è quello che vedono i clienti sul telefono, e quello che vedreste voi dopo qualche settimana (numeri di esempio). Se vi piace, mandatemi il logo e in un paio di giorni la carta vera è pronta, con i primi 30 giorni gratis.

*Send with `orsonero-notifications.png` and `orsonero-results.png`.*

## At the café: what to say (about one minute)

> Hi, I'm Bartek, I'm a designer here in Milan. I made something for Orsonero and wanted to show you in person.
> It's a stamp card, but on the phone. *(Show the card on your phone.)* The customer scans this poster at the till, and the card goes into their Wallet. No app.
> Your staff scan it to add a stamp. At eight bears, the coffee is on you.
> And you can see who comes back. *(Show Results.)* The card can also remind people when they are one stamp away. *(Show Notifications.)*
> The first 30 days are free. If you like it, I put your real logo on it and send you the printed poster and stickers. After that it's €20 a month, cancel anytime.
> I'll leave you this brochure. Can I send you the link on WhatsApp?

## Questions they might ask

- **"What if a customer doesn't use Wallet?"** The card also opens as a web page on any phone; they can save it to the home screen.
- **"Does staff need a new device?"** No. Any phone or tablet with a camera, in the browser.
- **"What about our paper cards?"** Keep them until they run out; the poster says the new card is on the phone.
- **"Customer data and privacy?"** Customers only give a first name. The data belongs to the café and is not shared or sold. Privacy page: https://timbro.witkowskidesign.com/legal/#privacy
- **"Can we change the reward or the number of stamps?"** Yes, any time, from the dashboard.
- **"Can we stop?"** Yes, cancel from the dashboard, it stops at the end of the month. No contract.
