/*
 * Everything you are likely to change lives here: name, contact details,
 * prices and the starter templates. The website, dashboard, brochure and
 * outreach kit all read from this file.
 */
window.CONFIG = {
  brand: 'Timbro',

  // Where the site is published. Printed QR codes point here, so set it
  // before printing anything (e.g. https://timbro.it/).
  siteUrl: 'https://timbro.witkowskidesign.com/',

  // Your Supabase project (Settings → API). Leave empty to run the
  // browser-only demo, where data stays on one device.
  // Example cards that always run as a browser demo (printed brochures point to them).
  demoCards: ['the-coffee', 'orsonero', 'sisu', 'parzymy', 'younique'],

  supabase: {
    url: 'https://xchpnvadjxonhnknywis.supabase.co',
    anonKey: 'sb_publishable_7zczBoBp11UwHVLlIz8XuA_XnrAigOn'  // publishable/anon key (safe to publish: the database checks every call)
  },

  // Address of the wallet server (wallet/server.js) once it is deployed,
  // e.g. 'https://wallet.timbro.it'. Empty = "Add to Wallet" stays switched off.
  walletApi: 'https://timbro-wallet.onrender.com',
  // Which Wallets the server is set up for (its /health says so). Add 'google' once Google Wallet is ready.
  walletPlatforms: ['apple', 'google'],

  contact: {
    name: 'Bartek Witkowski',
    phone: '+48 530 340 988',  // also used for WhatsApp
    email: '',            // e.g. 'ciao@timbro.it'
    city: 'Milano'
  },

  // Who provides the service, shown on the legal pages (legal/). Fill in the
  // empty fields once the business is registered; until then the pages show
  // a highlighted "to be completed".
  legal: {
    company: 'Witkowski Design',
    owner: 'Bartosz Witkowski',  // legal name (brochures use 'Bartek' from contact.name)
    address: '',          // registered address, e.g. 'ul. ..., 00-000 Warszawa, Polska'
    vat: '',              // VAT / NIP / partita IVA
    email: 'bartek.archi56@gmail.com', // contact for privacy and legal requests
    country: 'Polska',    // country of registration, e.g. 'Polska' / 'Italia'; sets the applicable law
    updated: '2026-10-15' // date shown as "last updated"
  },

  // Default notification texts; each café can change them (dashboard → Notifications).
  // {name} first name · {left} stamps to go ("1 timbro", "3 stamps", "2 pieczątki") · {reward} · {business}
  // A card shows them in its own language (card.lang) and in English to visitors browsing in English.
  messages: {
    close:  { on: true, left: 1, it: 'Ancora {left} per {reward}! Ti aspettiamo da {business}.', en: 'Just {left} to go for {reward}! See you at {business}.',
              pl: 'Jeszcze {left} i odbierasz nagrodę: {reward}. {business} czeka na Ciebie!' },
    ready:  { on: true, it: '{name}, il tuo premio è pronto: {reward}. Mostra la carta alla cassa.', en: '{name}, your reward is ready: {reward}. Show your card at the till.',
              pl: '{name}, Twoja nagroda czeka: {reward}. Pokaż kartę przy kasie.' },
    remind: { on: true, days: 21, it: 'Ciao {name}! Ancora {left} per {reward}. Passa a trovarci da {business}.', en: 'Hi {name}! Just {left} to go for {reward}. Come and see us at {business}.',
              pl: 'Cześć {name}! Jeszcze {left} i odbierasz nagrodę: {reward}. Wpadnij, {business} czeka na Ciebie.' },
    near:   { on: false, it: 'Sei vicino a {business}: ancora {left} per {reward}.', en: 'You are near {business}: {left} to go for {reward}.',
              pl: '{business} jest tuż obok! Jeszcze {left} i odbierasz nagrodę: {reward}.' }
  },

  currency: '€',
  trialDays: 30,
  yearlyMonths: 10,       // pay 10 months, get 12

  // design: 'self'   = the café customises logo, colours, background and stamp;
  //                    every change is approved by Witkowski Design first.
  //         'custom' = Witkowski Design designs the card; the café asks for changes.
  // contact: true = not sold online: the price is "from", per location, and the
  //                 button opens WhatsApp. Witkowski Design sets the plan in Studio.
  plans: [
    { id: 'start', design: 'self', month: 19, locations: 1, cards: 1, staff: 3,
      it: { name: 'Start', for: 'Un bar, una sede', extras: ['Personalizzi tu logo, colori, sfondo e timbro', 'Poster e QR da stampare', 'Piano di lancio di 7 giorni', 'Post Instagram pronti'] },
      en: { name: 'Start', for: 'One café, one location', extras: ['Customise logo, colours, background and stamp', 'Printable poster and QR code', '7-day launch plan', 'Ready-made Instagram posts'] },
      pl: { name: 'Start', for: 'Jeden lokal', extras: ['Sam ustawiasz logo, kolory, tło i pieczątkę', 'Plakat i kod QR do wydruku', '7-dniowy plan startu', 'Gotowe posty na Instagrama'] } },
    { id: 'plus', design: 'custom', month: 39, locations: 3, cards: 3, staff: 10, popular: true,
      it: { name: 'Plus', for: 'Vuoi che ci pensiamo noi', extras: ['Tutto di Start', 'Carta disegnata su misura da noi', 'Kit stampato a casa tua', 'Nuovi post e messaggi ogni mese'] },
      en: { name: 'Plus', for: 'You want us to handle it', extras: ['Everything in Start', 'Card custom-designed by us', 'Printed kit sent to you', 'New posts and messages every month'] },
      pl: { name: 'Plus', for: 'Chcesz, żebyśmy zajęli się wszystkim', extras: ['Wszystko z planu Start', 'Karta zaprojektowana przez nas', 'Wydrukowane materiały z wysyłką do Ciebie', 'Nowe posty i wiadomości co miesiąc'] } },
    { id: 'pro', design: 'custom', month: 79, locations: 10, cards: 10, staff: 50,
      it: { name: 'Pro', for: 'Più sedi', extras: ['Tutto di Plus', 'Statistiche per sede', 'Esporta i clienti in Excel', 'Assistenza prioritaria su WhatsApp'] },
      en: { name: 'Pro', for: 'Several locations', extras: ['Everything in Plus', 'Stats per location', 'Export customers to Excel', 'Priority WhatsApp support'] },
      pl: { name: 'Pro', for: 'Kilka lokali', extras: ['Wszystko z planu Plus', 'Statystyki dla każdego lokalu', 'Eksport klientów do Excela', 'Priorytetowe wsparcie na WhatsAppie'] } },
    { id: 'chain', design: 'custom', month: 8, contact: true, locations: 0, cards: 0, staff: 0,
      it: { name: 'Catene', for: 'Da 11 sedi in su', extras: ['Tutto di Pro', 'Prezzo per sede, con sconto sui volumi', 'Prova in alcune sedi prima di partire', 'Avvio, formazione e kit per ogni sede', 'Contratto, fattura e accordo GDPR'] },
      en: { name: 'Chains', for: '11 locations or more', extras: ['Everything in Pro', 'Price per location, with volume discounts', 'Pilot in a few locations first', 'Setup, training and a kit for every location', 'Contract, invoice and GDPR agreement'] },
      pl: { name: 'Sieci', for: 'Od 11 lokali', extras: ['Wszystko z planu Pro', 'Cena za lokal, niższa przy większej sieci', 'Najpierw pilotaż w kilku lokalach', 'Wdrożenie, szkolenie i zestaw dla każdego lokalu', 'Umowa, faktura i umowa powierzenia przetwarzania danych (RODO)'] } }
  ],

  // Card styles. A style sets the whole look; every part can still be changed.
  //   stamp: one of the standard stamps in assets/js/stamps.js
  //          (punto, sole, ramo, fiore, stella, onda, albero, ziarno), printed in `ink`;
  //          a card's own artwork (stampImage) replaces it
  //   font:  sans | wide | serif | mono
  //   strip: background colour behind the stamps ('' = same as the card)
  styles: [
    { id: 'timbro', it: 'Timbro', en: 'Timbro', pl: 'Timbro',
      look: { color: '#FFFFFF', ink: '#2B32FF', stamp: 'sole', font: 'sans', strip: '' } },
    { id: 'minimal', it: 'Minimal', en: 'Minimal', pl: 'Minimal',
      look: { color: '#FFFFFF', ink: '#0B0B0C', stamp: 'fiore', font: 'serif', strip: '' } },
    { id: 'giappone', it: 'Giapponese', en: 'Japanese', pl: 'Japoński',
      look: { color: '#FFFFFF', ink: '#B5442E', stamp: 'onda', font: 'wide', strip: '#EEE9E1' } },
    { id: 'milano', it: 'Milano sera', en: 'Milan night', pl: 'Mediolan nocą',
      look: { color: '#0B0B0C', ink: '#C9A24A', stamp: 'stella', font: 'wide', strip: '' } },
    { id: 'bottega', it: 'Bottega', en: 'Bottega', pl: 'Bottega',
      look: { color: '#F3EEE4', ink: '#4A2E21', stamp: 'ramo', font: 'serif', strip: '' } }
  ],

  // Starter templates by type of business. Picking one fills in a sensible card.
  templates: [
    { id: 'caffe', icon: 'cup', stamps: 10, color: '#FFFFFF',
      it: { type: 'Caffè e bar', title: 'Carta caffè', reward: 'un caffè gratis' },
      en: { type: 'Café', title: 'Coffee card', reward: 'a free coffee' },
      pl: { type: 'Kawiarnia', title: 'Karta kawowa', reward: 'darmowa kawa' } },
    { id: 'pasticceria', icon: 'cake', stamps: 8, color: '#FFFFFF',
      it: { type: 'Pasticceria', title: 'Carta dolce', reward: 'una brioche gratis' },
      en: { type: 'Bakery', title: 'Pastry card', reward: 'a free pastry' },
      pl: { type: 'Cukiernia', title: 'Słodka karta', reward: 'darmowe ciastko' } },
    { id: 'aperitivo', icon: 'glass', stamps: 8, color: '#0B0B0C',
      it: { type: 'Aperitivo', title: 'Carta aperitivo', reward: 'uno spritz gratis' },
      en: { type: 'Cocktail bar', title: 'Aperitivo card', reward: 'a free spritz' },
      pl: { type: 'Bar koktajlowy', title: 'Karta aperitivo', reward: 'darmowy spritz' } },
    { id: 'gelateria', icon: 'cone', stamps: 8, color: '#FFFFFF',
      it: { type: 'Gelateria', title: 'Carta gelato', reward: 'una coppetta gratis' },
      en: { type: 'Gelato shop', title: 'Gelato card', reward: 'a free gelato' },
      pl: { type: 'Lodziarnia', title: 'Lodowa karta', reward: 'darmowa gałka lodów' } },
    { id: 'pizzeria', icon: 'pizza', stamps: 10, color: '#0B0B0C',
      it: { type: 'Pizzeria', title: 'Carta pizza', reward: 'una margherita gratis' },
      en: { type: 'Pizzeria', title: 'Pizza card', reward: 'a free margherita' },
      pl: { type: 'Pizzeria', title: 'Karta pizzerii', reward: 'darmowa margherita' } },
    { id: 'parrucchiere', icon: 'scissors', stamps: 6, color: '#0B0B0C',
      it: { type: 'Parrucchiere', title: 'Carta taglio', reward: 'una piega gratis' },
      en: { type: 'Hair salon', title: 'Haircut card', reward: 'a free blow-dry' },
      pl: { type: 'Fryzjer', title: 'Karta fryzjerska', reward: 'darmowe modelowanie' } },
    { id: 'estetica', icon: 'leaf', stamps: 6, color: '#FFFFFF',
      it: { type: 'Centro estetico', title: 'Carta bellezza', reward: 'un trattamento viso gratis' },
      en: { type: 'Beauty salon', title: 'Beauty card', reward: 'a free facial' },
      pl: { type: 'Salon kosmetyczny', title: 'Karta salonu', reward: 'darmowy zabieg na twarz' } }
  ]
};
