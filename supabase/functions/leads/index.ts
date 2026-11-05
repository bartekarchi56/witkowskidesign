// Leads for Witkowski Design (studio/leads.html): finds cafés, pizzerias, barbers... on Google Maps,
// reads each one's website for a public e-mail and any sign of a loyalty programme, and sends the
// short first e-mail that asks for permission to send a proposal (Polish law: no offer by e-mail
// without consent). Only Witkowski Design accounts (timbro.admins) can use it.
// Deploy with "Verify JWT" ON. Secrets: GOOGLE_MAPS_KEY (Places API (New)), RESEND_API_KEY;
// optional LEADS_FROM (default "Timbro · Bartek Witkowski <timbro@witkowskidesign.com>": Resend sends only
// from the verified domain, not from a @gmail.com address) and LEADS_REPLY_TO, where replies go
// (default bartek.archi56@gmail.com; e.g. timbro.witkowskidesign@gmail.com).
//   POST { action: 'find', query: 'kawiarnia', city: 'Bydgoszcz' }   → { added, found }
//   POST { action: 'list', status: 'new' }                          → leads
//   POST { action: 'skip' | 'manual' | 'replied' | 'sent', place: id }   (sent: written by hand, e.g. on Instagram)
//   POST { action: 'preview', place: id } / { action: 'send', place: id }   → { subject, text } / { sent }
//   POST { action: 'proposal', place: id [, preview: true] }   → the long e-mail for a place that said yes
import { createClient } from 'npm:@supabase/supabase-js@2';

const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || (() => { try { return Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}'))[0] as string; } catch { return ''; } })();
const db = createClient(Deno.env.get('SUPABASE_URL')!, serverKey, { db: { schema: 'timbro' } });
const GKEY = Deno.env.get('GOOGLE_MAPS_KEY') ?? '';
// Optional: a Programmable Search Engine (programmablesearchengine.google.com, "Search the entire web")
// with the Custom Search API on the same key, to find the Instagram of places whose website doesn't
// link it. 100 searches a day are free.
const CSE = Deno.env.get('GOOGLE_CSE_ID') ?? '';
async function findInstagram(name: string, city: string) {
  if (!CSE || !GKEY) return '';
  try {
    const q = encodeURIComponent(`site:instagram.com ${name} ${city}`);
    const r = await fetch(`https://www.googleapis.com/customsearch/v1?key=${GKEY}&cx=${CSE}&num=3&q=${q}`, { signal: AbortSignal.timeout(6000) });
    const items = (await r.json()).items ?? [];
    for (const it of items) {
      const m = /instagram\.com\/([A-Za-z0-9_.]{2,30})\/?(?:$|\?)/.exec(it.link ?? '');
      if (m && !/^(p|reel|reels|explore|accounts|stories|tv)$/i.test(m[1])) return m[1];
    }
  } catch { /* none found */ }
  return '';
}
const FROM = Deno.env.get('LEADS_FROM') || 'Timbro · Bartek Witkowski <timbro@witkowskidesign.com>';
const REPLY_TO = Deno.env.get('LEADS_REPLY_TO') || 'bartek.archi56@gmail.com';
// The "yes" buttons write to an address on the sending domain (spam filters dislike links to another
// domain); forward it to your inbox with Cloudflare Email Routing.
const MAILTO = Deno.env.get('LEADS_MAILTO') || 'timbro@witkowskidesign.com';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

// Words on a website that show a loyalty programme already (and which one, when it's a known app).
const LOYALTY: [RegExp, string][] = [
  [/stamp ?me/i, 'Stamp Me'], [/loyverse/i, 'Loyverse'], [/stampy?\.(app|pl)/i, 'Stampy'], [/embargo/i, 'Embargo'],
  [/upsell\.?pl|moja ?karta/i, 'aplikacja lojalnościowa'], [/karta lojalno|program lojalno|karta sta[lł]ego klienta/i, 'karta lojalnościowa'],
  [/loyalty|punch ?card|stamp card|rewards? (club|program)/i, 'loyalty card'], [/pieczątk|piecz[aą]tk/i, 'pieczątki'], [/aplikacj[aęi] .{0,40}(punkt|nagrod)/i, 'aplikacja z punktami']
];
const BAD_MAIL = /\.(png|jpe?g|gif|webp|svg)$|example\.|sentry|wixpress|@2x|domain\.com|email\.com/i;

async function page(url: string) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; WitkowskiDesign/1.0)' }, signal: AbortSignal.timeout(7000), redirect: 'follow' });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('html')) return '';
    return (await r.text()).slice(0, 600000);
  } catch { return ''; }
}
// The website's public e-mail (homepage, then a contact page) and any loyalty programme it mentions.
// E-mails in a page: mailto links, plain addresses, "name [at] domain [dot] pl" spellings, HTML
// entities, Cloudflare's hidden addresses (data-cfemail) and schema.org "email" fields.
function mailsIn(h: string) {
  const cf = [...h.matchAll(/data-cfemail="([0-9a-f]+)"/gi)].map(m => { const k = parseInt(m[1].slice(0, 2), 16); let o = ''; for (let i = 2; i < m[1].length; i += 2) o += String.fromCharCode(parseInt(m[1].slice(i, i + 2), 16) ^ k); return o; });
  const t = h.replace(/&#0*64;|&#x0*40;|&commat;/gi, '@').replace(/&#0*46;|&#x0*2e;/gi, '.')
    .replace(/\s*[\[\(\{]\s*(at|małpa|malpa|chiocciola)\s*[\]\)\}]\s*/gi, '@').replace(/\s*[\[\(\{]\s*(dot|kropka|punto)\s*[\]\)\}]\s*/gi, '.');
  const found = [...t.matchAll(/mailto:([^"'?\s>]+)/gi)].map(m => { try { return decodeURIComponent(m[1]); } catch { return m[1]; } })
    .concat(t.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [], cf, [...t.matchAll(/"email"\s*:\s*"([^"]+)"/gi)].map(m => m[1].replace(/^mailto:/i, '')));
  return [...new Set(found.map(e => e.toLowerCase().trim().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')))].filter(e => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) && !BAD_MAIL.test(e));
}
// Reads the website before a place is shown: the homepage, then its contact, about and legal pages
// (and the usual addresses for them), until an e-mail turns up. Also any loyalty programme and
// the Instagram it links.
async function readSite(site: string) {
  const igOf = (t: string) => (/instagram\.com\/([A-Za-z0-9_.]{2,30})/i.exec(t)?.[1] ?? '').replace(/^(p|reel|explore|accounts|stories)$/i, '');
  if (/instagram\.com/i.test(site)) return { email: '', loyalty: '', instagram: igOf(site) };
  if (!/^https?:\/\//.test(site) || /facebook\.com/i.test(site)) return { email: '', loyalty: '', instagram: '' };
  let html = await page(site);
  let mails = mailsIn(html);
  if (!mails.length) {
    const base = new URL(site);
    const linked = [...html.matchAll(/href=["']([^"'#]+)["']/gi)].map(m => m[1])
      .filter(h => /kontakt|contact|contatt|impressum|regulamin|polityka|privacy|o-nas|onas|about|chi-siamy|rezerw|reserv|footer/i.test(h))
      .map(h => { try { return new URL(h, base).href; } catch { return ''; } }).filter(h => h && new URL(h).hostname === base.hostname);
    const guesses = ['/kontakt', '/kontakt/', '/contact', '/contact/', '/contatti', '/o-nas', '/about'].map(p => new URL(p, base.origin).href);
    for (const url of [...new Set([...linked, ...guesses])].slice(0, 8)) {
      const more = await page(url);
      if (!more) continue;
      html += more; mails = mailsIn(more);
      if (mails.length) break;
    }
  }
  const host = new URL(site).hostname.replace(/^www\./, '');
  const email = mails.find(e => e.endsWith(host)) ?? mails.find(e => !/wordpress|wix|godaddy|domain|hosting/.test(e)) ?? '';
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ');
  const loyalty = LOYALTY.find(([re]) => re.test(text))?.[1] ?? '';
  return { email, loyalty, instagram: igOf(html) };
}

async function find(query: string, city: string, kindLabel = '') {
  if (!GKEY) throw new Error('Add the GOOGLE_MAPS_KEY secret first.');
  // Only places inside the city: its area on the map first, then the search limited to it.
  let area: any = null;
  if (city) {
    const g = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST', headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': GKEY, 'X-Goog-FieldMask': 'places.viewport' },
      body: JSON.stringify({ textQuery: city, includedType: 'locality', pageSize: 1 })
    }).then(x => x.json()).catch(() => null);
    const v = g?.places?.[0]?.viewport;
    if (v?.low && v?.high) area = { low: v.low, high: v.high };
  }
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': GKEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri,places.editorialSummary,places.primaryTypeDisplayName,places.photos,places.businessStatus' },
    body: JSON.stringify({ textQuery: `${query} ${city}`.trim(), languageCode: 'pl', pageSize: 20, ...(area ? { locationRestriction: { rectangle: area } } : {}) })
  });
  if (!r.ok) throw new Error('Google Maps: ' + (await r.text()).slice(0, 200));
  const places = ((await r.json()).places ?? []).filter((p: any) => p.businessStatus !== 'CLOSED_PERMANENTLY');
  const leads = await Promise.all(places.map(async (p: any) => {
    // 3 photos: the public image addresses (the key stays here).
    const photos = (await Promise.all((p.photos ?? []).slice(0, 3).map(async (ph: any) => {
      const m = await fetch(`https://places.googleapis.com/v1/${ph.name}/media?maxWidthPx=900&skipHttpRedirect=true&key=${GKEY}`).then(x => x.json()).catch(() => null);
      return m?.photoUri ?? '';
    }))).filter(Boolean);
    const site = await readSite(p.websiteUri ?? '');
    if (!site.email && !site.instagram) site.instagram = await findInstagram(p.displayName?.text ?? '', city);
    return { place_id: p.id, name: p.displayName?.text ?? '', kind: kindLabel || p.primaryTypeDisplayName?.text || query, address: p.formattedAddress ?? '', city,
      rating: p.rating ?? '', reviews: p.userRatingCount ?? '', website: p.websiteUri ?? '', email: site.email, phone: p.nationalPhoneNumber ?? '',
      maps_url: p.googleMapsUri ?? '', summary: p.editorialSummary?.text ?? '', photos, loyalty: site.loyalty, instagram: site.instagram };
  }));
  const { data: added, error } = await db.rpc('leads_add', { p_leads: leads });
  if (error) throw error;
  return { added, found: leads.length };
}

// The first e-mail: short, no offer, asks if a proposal may be sent. In the place's language
// (from the country in its address): Polish, Italian, otherwise English.
const SIGN = ['Bartek Witkowski', 'Witkowski Design · timbro.witkowskidesign.com', '+48 530 340 988'];
function draft(l: any) {
  const lang = /W[łl]ochy|Itali[ae]|Italy/i.test(l.address) ? 'it' : /Polska|Poland/i.test(l.address) || !/,.*,/.test(l.address) ? 'pl' : 'en';
  const T = {
    pl: [`Pytanie do ${l.name}`, ['Witam,', '', `z tej strony Timbro. Projektujemy karty lojalnościowe w telefonie dla lokali takich jak ${l.name}: klient zapisuje kartę w Apple Wallet lub Google Wallet, a obsługa dodaje pieczątkę telefonem w dwie sekundy. Bez aplikacji i bez papierowych kartoników.`, '', `Zobacz, jak to działa: ${SITE}`, '',
      'Czy mogę przesłać Państwu krótką propozycję z projektem karty dla Państwa lokalu? Wystarczy odpowiedzieć „tak” na tego maila.', '',
      'Jeśli nie są Państwo zainteresowani, proszę zignorować tę wiadomość: nie napiszę ponownie.', '', 'Pozdrawiam']],
    it: [`Una domanda per ${l.name}`, ['Salve,', '', `qui è Timbro. Disegniamo carte fedeltà nel telefono per locali come ${l.name}: il cliente salva la carta in Apple Wallet o Google Wallet e lo staff aggiunge il timbro con il telefono in due secondi. Senza app e senza cartoncini.`, '', `Guarda come funziona: ${SITE}/?lang=it`, '',
      'Posso inviarvi una breve proposta con il design della carta per il vostro locale? Basta rispondere “sì” a questa mail.', '',
      'Se non siete interessati, ignorate pure questo messaggio: non scriverò di nuovo.', '', 'Cordiali saluti']],
    en: [`A question for ${l.name}`, ['Hello,', '', `this is Timbro. We design phone loyalty cards for places like ${l.name}: customers save the card to Apple Wallet or Google Wallet and staff add a stamp with their phone in two seconds. No app and no paper cards.`, '', `See how it works: ${SITE}/?lang=en`, '',
      'May I send you a short proposal with a card design for your place? Just reply “yes” to this e-mail.', '',
      'If you are not interested, please ignore this message: I will not write again.', '', 'Best regards']]
  }[lang] as [string, string[]];
  return { subject: T[0], text: [...T[1], ...SIGN].join('\n'), html: html(lang, T[0], T[1]), lang };
}

// The same e-mail as a page in the website's style: the banner (print/email-banner.html), the
// text, a blue "reply yes" button and the signature. Plain tables and inline styles, for e-mail apps.
const SITE = 'https://timbro.witkowskidesign.com';
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function html(lang: string, subject: string, lines: string[]) {
  const B = { pl: ['Tak, wyślij propozycję', 'Zobacz, jak to działa', 'Tak, chętnie zobaczę propozycję.'], it: ['Sì, inviatemi la proposta', 'Guarda come funziona', 'Sì, vorrei vedere la proposta.'], en: ['Yes, send me the proposal', 'See how it works', 'Yes, I would like to see the proposal.'] }[lang]!;
  const H = { pl: ['Karta lojalnościowa, której nikt', 'nie gubi.'], it: ['La carta fedeltà che nessuno', 'perde.'], en: ['The loyalty card nobody', 'loses.'] }[lang]!;
  const yes = `mailto:${MAILTO}?subject=${encodeURIComponent('Re: ' + subject)}&body=${encodeURIComponent(B[2])}`;
  const paras = lines.join('\n').split('\n\n').map(p => p.trim()).filter(Boolean);
  const close = paras.pop() ?? '';
  const F = "font-family:Archivo,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif", BLUE = '#2B32FF', INK = '#0B0B0C';
  // Same look as the proposal: the Timbro header, the wide headline with a blue word, the floating
  // iPhones (assets/email/hero-<lang>.png), then the short question and a blue button.
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,400..800&display=swap" rel="stylesheet"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#F4F4F6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F6"><tr><td align="center" style="padding:24px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:24px;overflow:hidden">
<tr><td style="padding:24px 32px;${F};font-size:18px;font-weight:800;color:${INK}"><span style="display:inline-block;width:12px;height:12px;border:4px solid ${BLUE};border-radius:50%;vertical-align:-2px;margin-right:8px"></span>Timbro</td></tr>
<tr><td style="padding:6px 32px 0"><div style="${F};font-stretch:125%;font-weight:800;letter-spacing:-.03em;font-size:38px;line-height:1;color:${INK}">${H[0]} <span style="color:${BLUE}">${H[1]}</span></div></td></tr>
<tr><td style="padding:16px 0 0"><a href="${SITE}/?lang=${lang}"><img src="${SITE}/assets/email/hero-${lang}.png" width="600" alt="Timbro" style="display:block;width:100%;height:auto;border:0"></a></td></tr>
<tr><td style="padding:22px 32px 8px;${F};font-size:16px;line-height:1.6;color:#2A2A2E">
${paras.map(p => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, '<br>').replace(/(https:\/\/[^\s<]+)/g, `<a href="$1" style="color:${BLUE};font-weight:700;text-decoration:none">$1</a>`)}</p>`).join('')}
<div style="margin:10px 0 26px"><a href="${yes}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:${BLUE};color:#fff;${F};font-size:15px;font-weight:700;text-decoration:none">${B[0]}</a>&nbsp;&nbsp;
<a href="${SITE}/?lang=${lang}" style="${F};font-size:15px;font-weight:700;color:${BLUE};text-decoration:none">${B[1]} →</a></div>
<p style="margin:0 0 4px">${esc(close)}</p>
<p style="margin:0 0 26px"><b>${SIGN[0]}</b><br><span style="color:#8A8A90;font-size:14px">${esc(SIGN[1])}<br>${SIGN[2]}</span></p>
</td></tr></table>
</td></tr></table></body></html>`;
}

// The long e-mail for places that said yes, in the website's style: white, Archivo, a wide bold
// headline with a blue word, blue pills, floating iPhones (Parzymy Tutaj's real card, and simple
// white cards with blue stamps), the three steps and the free month on a blue card. Pictures: print/email-art.html → assets/email/.
const P = {
  pl: { subject: (n: string) => `Karta lojalnościowa dla ${n}`, label: 'Propozycja dla', title: 'Karta lojalnościowa', sub: 'w telefonie Twoich klientów', demo: 'Zobacz demo',
    closer: 'Z bliska', intro: 'Klient skanuje kod QR przy kasie i karta trafia do Apple Wallet lub Google Wallet. Bez aplikacji do pobrania i bez kartoników. Obsługa dodaje pieczątkę telefonem w dwie sekundy, a telefon sam przypomina klientom o nagrodzie.',
    looks: [['Ziarno', 'Ciemna zieleń'], ['Gwiazda', 'Biel i niebieski'], ['Gałązka', 'Cegła'], ['Kwiat', 'Czerń']], made: 'Każdą kartę projektuję od zera, w kolorach i z logo Twojego lokalu.',
    how: 'Jak to działa', steps: [['Skanuj', 'Klient skanuje kod QR z plakatu przy kasie.'], ['Pieczątka', 'Obsługa dodaje pieczątkę telefonem, który już macie.'], ['Nagroda', 'Pełna karta: nagroda i karta zaczyna się od nowa.']],
    price: '30 dni za darmo', priceSub: 'Potem od 19 € miesięcznie (ok. 80 zł). Rezygnacja w każdej chwili.', cta: 'Zaprojektuj moją kartę', ctaBody: 'Chcę kartę lojalnościową dla naszego lokalu.',
    feats: ['Bez aplikacji', 'Apple i Google Wallet', 'Gotowe w kilka dni'], hello: (n: string) => `Dzień dobry, dziękuję za odpowiedź! Poniżej krótko, jak mogłaby wyglądać karta dla ${n}.` },
  it: { subject: (n: string) => `La carta fedeltà per ${n}`, label: 'Proposta per', title: 'Carta fedeltà', sub: 'nel telefono dei tuoi clienti', demo: 'Guarda la demo',
    closer: 'Da vicino', intro: "Il cliente inquadra il QR alla cassa e la carta va in Apple Wallet o Google Wallet. Nessuna app da scaricare, niente cartoncini. Lo staff aggiunge il timbro con il telefono in due secondi e il telefono ricorda ai clienti il premio.",
    looks: [['Chicco', 'Verde scuro'], ['Stella', 'Bianco e blu'], ['Rametto', 'Mattone'], ['Fiore', 'Nero']], made: 'Ogni carta la disegno da zero, con i colori e il logo del tuo locale.',
    how: 'Come funziona', steps: [['Scansiona', 'Il cliente inquadra il QR del poster alla cassa.'], ['Timbro', 'Lo staff aggiunge il timbro con il telefono che avete già.'], ['Premio', 'Carta piena: il premio, e la carta ricomincia.']],
    price: '30 giorni gratis', priceSub: 'Poi da 19 € al mese. Disdici quando vuoi.', cta: 'Disegnate la mia carta', ctaBody: 'Vorrei una carta fedeltà per il nostro locale.',
    feats: ['Senza app', 'Apple e Google Wallet', 'Pronta in pochi giorni'], hello: (n: string) => `Buongiorno, grazie della risposta! Ecco in breve come potrebbe essere la carta per ${n}.` },
  en: { subject: (n: string) => `A loyalty card for ${n}`, label: 'A proposal for', title: 'Loyalty card', sub: "on your customers' phones", demo: 'See the demo',
    closer: 'A closer look', intro: 'Customers scan a QR code at the till and the card goes into Apple Wallet or Google Wallet. No app to download, no paper cards. Staff add a stamp with their phone in two seconds, and the phone reminds customers about their reward.',
    looks: [['Bean', 'Dark green'], ['Star', 'White and blue'], ['Sprig', 'Brick'], ['Flower', 'Black']], made: "I design every card from scratch, in your place's colours and with your logo.",
    how: 'How it works', steps: [['Scan', 'Customers scan the QR code on the poster at the till.'], ['Stamp', 'Staff add a stamp with the phone you already have.'], ['Reward', 'A full card: the reward, and the card starts again.']],
    price: '30 days free', priceSub: 'Then from €19 a month. Cancel any time.', cta: 'Design my card', ctaBody: 'I would like a loyalty card for our place.',
    feats: ['No app', 'Apple and Google Wallet', 'Ready in a few days'], hello: (n: string) => `Hello, thank you for your reply! Here is, in short, how a card for ${n} could look.` }
};
// The first e-mail is the same page, opening with an introduction instead of "thanks for your reply",
// and ending with the promise not to write again.
const FIRST: Record<string, { hello: (n: string) => string; optout: string }> = {
  pl: { hello: n => `Dzień dobry! Nazywam się Bartek Witkowski (Witkowski Design) i projektuję karty lojalnościowe w telefonie. Tak mogłaby wyglądać karta dla ${n}.`, optout: 'Jeśli to nie dla Was, proszę zignorować tę wiadomość: nie napiszę ponownie.' },
  it: { hello: n => `Buongiorno! Sono Bartek Witkowski (Witkowski Design) e disegno carte fedeltà nel telefono. Ecco come potrebbe essere la carta per ${n}.`, optout: 'Se non fa per voi, ignorate pure questo messaggio: non scriverò di nuovo.' },
  en: { hello: n => `Hello! I'm Bartek Witkowski (Witkowski Design) and I design phone loyalty cards. This is how a card for ${n} could look.`, optout: 'If it is not for you, please ignore this message: I will not write again.' }
};
function proposal(l: any, first = false) {
  const lang = /W[łl]ochy|Itali[ae]|Italy/i.test(l.address) ? 'it' : /Polska|Poland/i.test(l.address) || !/,.*,/.test(l.address) ? 'pl' : 'en';
  const t = (P as any)[lang], img = (n: string) => `${SITE}/assets/email/${n}-${lang}.png`;
  const H = { pl: ['Karta lojalnościowa, której nikt', 'nie gubi.'], it: ['La carta fedeltà che nessuno', 'perde.'], en: ['The loyalty card nobody', 'loses.'] }[lang]!;
  const SHOW = { pl: ['Prosto i w Twoim stylu', 'Minimalistyczna, klasyczna albo nocna: każdą kartę projektujemy od zera, w stylu Twojego lokalu. Parzymy Tutaj z Bydgoszczy już dołączyło do Timbro.'], it: ['Semplice, nel tuo stile', 'Minimal, classica o notturna: ogni carta la disegniamo da zero, nello stile del tuo locale. Parzymy Tutaj di Bydgoszcz è già entrato in Timbro.'], en: ['Simple, in your style', 'Minimal, classic or after dark: we design every card from scratch, in your style. Parzymy Tutaj from Bydgoszcz has already joined Timbro.'] }[lang]!;
  const WAL = { pl: ['Zawsze pod ręką', 'W Portfelu, obok karty płatniczej.', 'Klient nie szuka kartonika ani aplikacji: Twoja karta jest w Apple Wallet, tuż przy karcie, którą płaci. Jedno przesunięcie i pokazuje ją przy kasie.'],
    it: ['Sempre a portata di mano', 'Nel Wallet, accanto alla carta di pagamento.', "Il cliente non cerca cartoncini né app: la tua carta è in Apple Wallet, proprio accanto alla carta con cui paga. Un gesto e la mostra alla cassa."],
    en: ['Always at hand', 'In Wallet, next to their bank card.', 'No paper card or app to look for: your card sits in Apple Wallet, right next to the card they pay with. One swipe and they show it at the till.'] }[lang]!;
  const F = "font-family:Archivo,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
  const W = 'font-stretch:125%;font-weight:800;letter-spacing:-.03em';
  const BLUE = '#2B32FF', INK = '#0B0B0C', MUTED = '#5A5A60';
  const kicker = (x: string) => `<div style="${F};font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${BLUE}">${x}</div>`;
  const pill = (href: string, label: string, filled = true) => `<a href="${href}" style="display:inline-block;padding:14px 26px;border-radius:999px;${F};font-size:15px;font-weight:700;text-decoration:none;${filled ? `background:${BLUE};color:#fff` : `border:1.5px solid ${INK};color:${INK}`}">${label}</a>`;
  const yes = `mailto:${MAILTO}?subject=${encodeURIComponent(t.subject(l.name))}&body=${encodeURIComponent(t.ctaBody)}`;
  const demo = `${SITE}/app/card.html?card=the-coffee&lang=${lang}`;
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,400..800&display=swap" rel="stylesheet"><title>${esc(t.subject(l.name))}</title></head>
<body style="margin:0;padding:0;background:#F4F4F6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F6"><tr><td align="center" style="padding:24px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:24px;overflow:hidden">
<tr><td style="padding:24px 32px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td style="${F};font-size:18px;font-weight:800;color:${INK}"><span style="display:inline-block;width:12px;height:12px;border:4px solid ${BLUE};border-radius:50%;vertical-align:-2px;margin-right:8px"></span>Timbro</td>
  <td align="right"><a href="${SITE}/?lang=${lang}" style="${F};font-size:13px;font-weight:700;color:${BLUE};text-decoration:none">${t.price} →</a></td></tr></table></td></tr>
<tr><td style="padding:18px 32px 0">
  ${kicker(`${t.label} ${esc(l.name)}`)}
  <div style="${F};${W};font-size:42px;line-height:1;color:${INK};margin:14px 0 16px">${H[0]} <span style="color:${BLUE}">${H[1]}</span></div>
  <p style="${F};font-size:16px;line-height:1.55;color:${MUTED};margin:0 0 22px">${esc(first ? FIRST[lang].hello(l.name) : t.hello(l.name))} ${t.intro}</p>
  ${pill(yes, t.cta)}&nbsp;&nbsp;${pill(demo, t.demo, false)}</td></tr>
<tr><td style="padding:22px 0 0"><img src="${img('hero')}" width="600" alt="" style="display:block;width:100%;height:auto;border:0"></td></tr>
<tr><td style="padding:6px 32px 30px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  ${t.feats.map((f: string) => `<td align="center" style="${F};font-size:13px;font-weight:600;color:${INK};padding:0 4px"><span style="color:${BLUE}">●</span>&nbsp;${f}</td>`).join('')}</tr></table></td></tr>
<tr><td style="padding:34px 32px 8px;border-top:1px solid #EDEDF0">${kicker(t.how)}
  <div style="${F};${W};font-size:30px;line-height:1.05;color:${INK};margin:10px 0 18px">${{ pl: 'Trzy kroki i gotowe.', it: 'Tre passi ed è fatta.', en: 'Three steps, done.' }[lang]}</div></td></tr>
<tr><td style="padding:0 26px 30px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  ${t.steps.map((st: string[], i: number) => `<td width="33%" valign="top" style="padding:0 6px"><div style="background:#F4F4F6;border-radius:18px;padding:18px 16px;min-height:150px">
    <div style="width:34px;height:34px;line-height:34px;border-radius:50%;background:${BLUE};color:#fff;text-align:center;${F};font-size:15px;font-weight:800">${i + 1}</div>
    <div style="${F};font-size:16px;font-weight:800;color:${INK};margin:12px 0 6px">${st[0]}</div>
    <div style="${F};font-size:13.5px;line-height:1.45;color:${MUTED}">${st[1]}</div></div></td>`).join('')}</tr></table></td></tr>
<tr><td style="padding:30px 32px 6px;border-top:1px solid #EDEDF0">${kicker(SHOW[0])}
  <p style="${F};font-size:15px;line-height:1.55;color:${MUTED};margin:10px 0 0">${SHOW[1]}</p></td></tr>
<tr><td style="padding:14px 0 0"><img src="${img('phones')}" width="600" alt="" style="display:block;width:100%;height:auto;border:0"></td></tr>
<tr><td style="padding:30px 32px 6px;border-top:1px solid #EDEDF0">${kicker(WAL[0])}
  <div style="${F};${W};font-size:30px;line-height:1.05;color:${INK};margin:10px 0 10px">${WAL[1]}</div>
  <p style="${F};font-size:15px;line-height:1.55;color:${MUTED};margin:0">${WAL[2]}</p></td></tr>
<tr><td style="padding:14px 0 0"><img src="${img('stack')}" width="600" alt="" style="display:block;width:100%;height:auto;border:0"></td></tr>
<tr><td style="padding:12px 24px 28px"><div style="background:${BLUE};border-radius:22px;padding:34px 28px;text-align:center">
  <div style="${F};${W};font-size:34px;line-height:1;color:#fff">${t.price}</div>
  <p style="${F};font-size:15px;line-height:1.5;color:#DADCFF;margin:12px 0 22px">${t.priceSub}</p>
  <a href="${yes}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#fff;color:${BLUE};${F};font-size:15px;font-weight:800;text-decoration:none">${t.cta}</a></div></td></tr>
${first ? `<tr><td style="padding:4px 32px 14px;${F};font-size:13px;line-height:1.6;color:#8A8A90">${FIRST[lang].optout}</td></tr>` : ''}
<tr><td style="padding:6px 32px 30px;${F};font-size:13px;line-height:1.7;color:#8A8A90">
  <b style="color:${INK}">${SIGN[0]}</b><br>${esc(SIGN[1])}<br>${SIGN[2]}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [first ? FIRST[lang].hello(l.name) : t.hello(l.name), '', t.intro, '', t.made, '', ...t.steps.map((s: string[], i: number) => `${i + 1}. ${s[0]}: ${s[1]}`), '', `${t.price}. ${t.priceSub}`, '', demo, '', ...(first ? [FIRST[lang].optout, ''] : []), ...SIGN].join('\n');
  return { subject: t.subject(l.name), text, html };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
    const { data: { user } } = await db.auth.getUser(jwt);
    if (!user) return reply({ error: 'Please log in again.' }, 401);
    const { data: admin } = await db.rpc('stripe_is_admin', { p_user: user.id });
    if (admin !== true) return reply({ error: 'Only Witkowski Design.' }, 403);

    const b = await req.json().catch(() => ({}));
    const place = String(b.place ?? '');
    switch (b.action) {
      case 'find': return reply(await find(String(b.query ?? 'cafe').slice(0, 60), String(b.city ?? '').slice(0, 60), String(b.kind ?? '').slice(0, 40)));
      case 'list': { const { data } = await db.rpc('leads_list', { p_status: ['new', 'sent', 'skipped', 'manual', 'replied'].includes(b.status) ? b.status : 'new' }); return reply(data ?? []); }
      case 'recheck': {   // read the websites again for places shown without an e-mail (10 at a time, under 2 minutes)
        let found = 0;
        const stop = Date.now() + 100000, todo: [any, string][] = [];
        for (const st of ['new', 'manual']) {
          const { data: list } = await db.rpc('leads_list', { p_status: st });
          for (const l of (list ?? []).filter((x: any) => !x.email && x.website)) todo.push([l, st]);
        }
        for (let k = 0; k < todo.length && k < 40 && Date.now() < stop; k += 10) {
          await Promise.all(todo.slice(k, k + 10).map(async ([l, st]) => {
            const site = await readSite(l.website);
            if (!site.email && !(site.instagram && !l.instagram)) return;
            await db.rpc('leads_update', { p_place: l.place_id, p_email: site.email, p_instagram: site.instagram || l.instagram, p_loyalty: site.loyalty || l.loyalty });
            if (site.email) { found++; if (st === 'manual') await db.rpc('leads_set', { p_place: l.place_id, p_status: 'new' }); }
          }));
        }
        return reply({ found, checked: Math.min(todo.length, 40) });
      }
      case 'skip': case 'manual': case 'replied': case 'sent':
        await db.rpc('leads_set', { p_place: place, p_status: b.action === 'skip' ? 'skipped' : b.action }); return reply({ ok: true });
      case 'proposal': {   // the long e-mail, for a place that answered yes
        const { data: l } = await db.rpc('leads_get', { p_place: place });
        if (!l?.email) return reply({ error: 'No e-mail for this place.' }, 400);
        const mail = proposal(l);
        if (b.preview) return reply(mail);
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { authorization: `Bearer ${Deno.env.get('RESEND_API_KEY') ?? ''}`, 'content-type': 'application/json' },
          body: JSON.stringify({ from: FROM, to: [l.email], reply_to: REPLY_TO, subject: mail.subject, text: mail.text, html: mail.html })
        });
        if (!r.ok) { console.error('resend', r.status, await r.text()); return reply({ error: 'E-mail not sent. Try again.' }, 502); }
        await db.rpc('leads_set', { p_place: place, p_status: 'replied' });
        return reply({ sent: true });
      }
      case 'preview': case 'send': {
        const { data: l } = await db.rpc('leads_get', { p_place: place });
        if (!l) return reply({ error: 'Not found.' }, 404);
        const mail = draft(l);   // first contact: the short question with the phones banner (proposal(l, true) is the long one)
        if (b.action === 'preview') return reply(mail);
        if (l.status === 'sent') return reply({ error: 'Already sent.' }, 409);
        if (!l.email) return reply({ error: 'No e-mail for this place.' }, 400);
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { authorization: `Bearer ${Deno.env.get('RESEND_API_KEY') ?? ''}`, 'content-type': 'application/json' },
          body: JSON.stringify({ from: FROM, to: [l.email], reply_to: REPLY_TO, subject: mail.subject, text: mail.text, html: mail.html })
        });
        if (!r.ok) { console.error('resend', r.status, await r.text()); return reply({ error: 'E-mail not sent. Try again.' }, 502); }
        await db.rpc('leads_set', { p_place: place, p_status: 'sent' });
        return reply({ sent: true });
      }
      default: return reply({ error: 'Unknown action.' }, 400);
    }
  } catch (e) {
    console.error('leads', (e as Error).message);
    return reply({ error: (e as Error).message }, 500);
  }
});
