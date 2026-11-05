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
import { createClient } from 'npm:@supabase/supabase-js@2';

const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || (() => { try { return Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}'))[0] as string; } catch { return ''; } })();
const db = createClient(Deno.env.get('SUPABASE_URL')!, serverKey, { db: { schema: 'timbro' } });
const GKEY = Deno.env.get('GOOGLE_MAPS_KEY') ?? '';
const FROM = Deno.env.get('LEADS_FROM') || 'Timbro · Bartek Witkowski <timbro@witkowskidesign.com>';
const REPLY_TO = Deno.env.get('LEADS_REPLY_TO') || 'bartek.archi56@gmail.com';
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
async function readSite(site: string) {
  const igOf = (t: string) => (/instagram\.com\/([A-Za-z0-9_.]{2,30})/i.exec(t)?.[1] ?? '').replace(/^(p|reel|explore|accounts|stories)$/i, '');
  if (/instagram\.com/i.test(site)) return { email: '', loyalty: '', instagram: igOf(site) };
  if (!/^https?:\/\//.test(site) || /facebook\.com/i.test(site)) return { email: '', loyalty: '', instagram: '' };
  let html = await page(site);
  const find = (h: string) => [...new Set([...h.matchAll(/mailto:([^"'?\s>]+)/gi)].map(m => decodeURIComponent(m[1])).concat(h.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []))]
    .map(e => e.toLowerCase().trim()).filter(e => !BAD_MAIL.test(e));
  let mails = find(html);
  if (!mails.length) {
    const link = /href=["']([^"']*(kontakt|contact)[^"']*)["']/i.exec(html)?.[1];
    if (link) { const more = await page(new URL(link, site).href); html += more; mails = find(more); }
  }
  const host = new URL(site).hostname.replace(/^www\./, '');
  const email = mails.find(e => e.endsWith(host)) ?? mails[0] ?? '';
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ');
  const loyalty = LOYALTY.find(([re]) => re.test(text))?.[1] ?? '';
  return { email, loyalty, instagram: igOf(html) };
}

async function find(query: string, city: string) {
  if (!GKEY) throw new Error('Add the GOOGLE_MAPS_KEY secret first.');
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': GKEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri,places.editorialSummary,places.primaryTypeDisplayName,places.photos,places.businessStatus' },
    body: JSON.stringify({ textQuery: `${query} ${city}`.trim(), languageCode: 'pl', pageSize: 20 })
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
    return { place_id: p.id, name: p.displayName?.text ?? '', kind: p.primaryTypeDisplayName?.text ?? query, address: p.formattedAddress ?? '', city,
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
    pl: [`Pytanie do ${l.name}`, ['Dzień dobry,', '', `nazywam się Bartek Witkowski, jestem projektantem (Witkowski Design). Projektuję karty lojalnościowe w telefonie dla lokali takich jak ${l.name}: klient zapisuje kartę w Apple Wallet lub Google Wallet, a obsługa dodaje pieczątkę telefonem w dwie sekundy.`, '',
      'Czy mogę przesłać Państwu krótką propozycję z projektem karty dla Państwa lokalu? Wystarczy odpowiedzieć „tak” na tego maila.', '',
      'Jeśli nie są Państwo zainteresowani, proszę zignorować tę wiadomość: nie napiszę ponownie.', '', 'Pozdrawiam']],
    it: [`Una domanda per ${l.name}`, ['Buongiorno,', '', `sono Bartek Witkowski, designer (Witkowski Design). Disegno carte fedeltà nel telefono per locali come ${l.name}: il cliente salva la carta in Apple Wallet o Google Wallet e lo staff aggiunge il timbro con il telefono in due secondi.`, '',
      'Posso inviarvi una breve proposta con il design della carta per il vostro locale? Basta rispondere “sì” a questa mail.', '',
      'Se non siete interessati, ignorate pure questo messaggio: non scriverò di nuovo.', '', 'Cordiali saluti']],
    en: [`A question for ${l.name}`, ['Hello,', '', `I'm Bartek Witkowski, a designer (Witkowski Design). I design phone loyalty cards for places like ${l.name}: customers save the card to Apple Wallet or Google Wallet and staff add a stamp with their phone in two seconds.`, '',
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
  const yes = `mailto:${REPLY_TO}?subject=${encodeURIComponent('Re: ' + subject)}&body=${encodeURIComponent(B[2])}`;
  const paras = lines.join('\n').split('\n\n').map(p => p.trim()).filter(Boolean);
  const close = paras.pop() ?? '';
  const font = "font-family:Archivo,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#EDEAE2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDEAE2"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td><a href="${SITE}/?lang=${lang}"><img src="${SITE}/assets/email/banner-${lang}.png" width="600" alt="Timbro" style="display:block;width:100%;height:auto;border:0"></a></td></tr>
<tr><td style="padding:28px 34px 8px;${font};font-size:16px;line-height:1.55;color:#0B0B0C">
${paras.map(p => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px"><tr>
<td style="background:#2B32FF;border-radius:999px"><a href="${yes}" style="display:inline-block;padding:13px 24px;${font};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">${B[0]}</a></td>
<td style="padding-left:16px"><a href="${SITE}/?lang=${lang}" style="${font};font-size:15px;font-weight:600;color:#2B32FF;text-decoration:none">${B[1]} →</a></td></tr></table>
<p style="margin:0 0 4px">${esc(close)}</p>
<p style="margin:0 0 24px"><b>${SIGN[0]}</b><br><span style="color:#5A5A60;font-size:14px">${esc(SIGN[1])}<br>${SIGN[2]}</span></p>
</td></tr></table>
</td></tr></table></body></html>`;
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
      case 'find': return reply(await find(String(b.query ?? 'kawiarnia').slice(0, 60), String(b.city ?? '').slice(0, 60)));
      case 'list': { const { data } = await db.rpc('leads_list', { p_status: ['new', 'sent', 'skipped', 'manual', 'replied'].includes(b.status) ? b.status : 'new' }); return reply(data ?? []); }
      case 'skip': case 'manual': case 'replied': case 'sent':
        await db.rpc('leads_set', { p_place: place, p_status: b.action === 'skip' ? 'skipped' : b.action }); return reply({ ok: true });
      case 'preview': case 'send': {
        const { data: l } = await db.rpc('leads_get', { p_place: place });
        if (!l) return reply({ error: 'Not found.' }, 404);
        const mail = draft(l);
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
