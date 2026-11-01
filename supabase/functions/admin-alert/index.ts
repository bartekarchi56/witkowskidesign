// Emails Witkowski Design when a café signs up, sends a design for approval (or asks for a
// change), or its subscription changes. The database
// calls this (timbro._alert in schema.sql, through pg_net) with the key from timbro.job_keys,
// which is checked here with alert_key_ok. The email goes out with Resend.
// Deploy with "Verify JWT" OFF (the database has no Supabase login).
// Secrets: RESEND_API_KEY; optional ALERT_TO (default bartek.archi56@gmail.com) and
// ALERT_FROM (default "Timbro <noreply@witkowskidesign.com>", a sender verified in Resend).
import { createClient } from 'npm:@supabase/supabase-js@2';

const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || (() => { try { return Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}'))[0] as string; } catch { return ''; } })();
const db = createClient(Deno.env.get('SUPABASE_URL')!, serverKey, { db: { schema: 'timbro' } });
const TO = Deno.env.get('ALERT_TO') || 'bartek.archi56@gmail.com';
const FROM = Deno.env.get('ALERT_FROM') || 'Timbro <noreply@witkowskidesign.com>';
const RESEND = Deno.env.get('RESEND_API') || 'https://api.resend.com';   // tests: a local stand-in

type Data = { business?: string; contact?: string; email?: string; phone?: string; city?: string; address?: string; instagram?: string;
  type?: string; plan?: string; interval?: string; periodEnd?: string; cards?: string[];
  card?: string; request?: boolean; note?: string; images?: number };   // design: the card, a change asked in words, its note
const PRICE: Record<string, number> = { start: 19, plus: 39, pro: 79 };
const planText = (d: Data) => d.plan ? `${d.plan[0].toUpperCase()}${d.plan.slice(1)}${PRICE[d.plan] ? `, €${PRICE[d.plan]} a month` : ''}${d.interval === 'year' ? ' (paid yearly)' : ''}` : 'no plan';
const day = (t?: string) => t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

// Subject and first line for each kind of alert.
function headline(kind: string, d: Data): [string, string] {
  const name = d.business || 'A café';
  switch (kind) {
    case 'signup': return [`New café: ${name}`, `${name} just signed up and created their card.`];
    case 'design': return d.request
      ? [`Change requested: ${name}`, `${name} asked for a change to their card's design.`]
      : [`Design to approve: ${name}`, `${name} sent a new design for their card. Customers see it after you approve it in the Studio.`];
    case 'trial': return [`Trial started: ${name} · ${planText(d)}`, `${name} started the 30-day free trial of ${planText(d)}.`];
    case 'paying': return [`Paying: ${name} · ${planText(d)}`, `${name} paid: ${planText(d)}.`];
    case 'failed': return [`Payment failed: ${name}`, `${name}'s payment didn't go through (${planText(d)}). Stripe will retry; a call may help.`];
    case 'canceling': return [`Cancelled: ${name}`, `${name} cancelled ${planText(d)}. It stays active until ${day(d.periodEnd) || 'the end of the period'}.`];
    case 'ended': return [`Subscription ended: ${name}`, `${name}'s subscription has ended.`];
    default: return [`Timbro: ${name}`, `${name}: ${kind}.`];
  }
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let body: { key?: string; kind?: string; data?: Data };
  try { body = await req.json(); } catch { return new Response('Bad request', { status: 400 }); }
  const { data: ok } = await db.rpc('alert_key_ok', { p_key: String(body.key ?? '') });
  if (ok !== true) return new Response('Forbidden', { status: 403 });

  const d = body.data ?? {}, [subject, first] = headline(String(body.kind ?? ''), d);
  const card = d.card || d.cards?.[0];
  const field = (label: string, v?: string) => v ? `${label}: ${v}` : null;
  const lines = [first, '', field('Their note', d.note), field('Pictures attached', d.images ? String(d.images) : ''),
    ...(d.note || d.images ? [''] : []), field('Contact', d.contact), field('Email', d.email), field('Phone', d.phone),
    field('Where', [d.address, d.city].filter(Boolean).join(', ')), field('Instagram', d.instagram), field('Kind', d.type),
    field('Card', card && `https://timbro.witkowskidesign.com/app/card.html?card=${card}`),
    '', 'Studio: https://timbro.witkowskidesign.com/studio/'].filter(l => l !== null);

  const r = await fetch(`${RESEND}/emails`, {
    method: 'POST',
    headers: { authorization: `Bearer ${Deno.env.get('RESEND_API_KEY') ?? ''}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [TO], subject, text: lines.join('\n') })
  });
  if (!r.ok) { console.error('resend failed', r.status, await r.text()); return new Response('Email not sent', { status: 502 }); }
  return new Response(JSON.stringify({ sent: true }), { headers: { 'content-type': 'application/json' } });
});
