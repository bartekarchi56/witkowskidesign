// Gift cards: anyone buys a café's gift card on gift/?b=<business>. One-off Stripe Checkout payment,
// charged on Timbro's account and sent on to the café's Connect account (destination charge), minus
// Timbro's fee: 2% on Pro and Chains, 5% on Start. The card is made by stripe-webhook when the payment
// is complete. Deploy with "Verify JWT" OFF (buyers are not logged in). Secrets: STRIPE_SECRET_KEY.
import Stripe from 'npm:stripe@23';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '');
const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || (() => { try { return Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}'))[0] as string; } catch { return ''; } })();
const db = createClient(Deno.env.get('SUPABASE_URL')!, serverKey, { db: { schema: 'timbro' } });
const SITE = (Deno.env.get('SITE_URL') ?? 'https://timbro.witkowskidesign.com/').replace(/\/?$/, '/');
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
const FEE: Record<string, number> = { pro: 0.02, chain: 0.02, plus: 0.02, start: 0.05 };

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const b = await req.json().catch(() => ({}));
    const business = String(b.business ?? ''), pick = Number(b.amount);
    if (!/^[0-9a-f-]{36}$/.test(business)) return reply({ error: 'Unknown café.' }, 400);
    const { data: s } = await db.rpc('gift_seller', { p_business: business });
    if (!s?.account || !s.gift?.on) return reply({ error: 'This café does not sell gift cards yet.' }, 400);
    // Only the amounts the café set (in cents).
    const option = (s.gift.amounts ?? []).find((a: { amount: number }) => a.amount === pick);
    if (!option) return reply({ error: 'Choose an amount.' }, 400);
    const fee = Math.round(option.amount * (FEE[s.plan] ?? 0.05));
    const lang = ['it', 'en', 'pl'].includes(b.lang) ? b.lang : 'en';
    const words = { it: 'Carta regalo', en: 'Gift card', pl: 'Karta podarunkowa' }[lang]!;
    const bonus = option.bonus ? ` (+${(option.bonus / 100).toFixed(2)} € bonus)` : '';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: option.amount, product_data: { name: `${words} · ${s.name}${bonus}` } } }],
      payment_intent_data: { application_fee_amount: fee, transfer_data: { destination: s.account }, metadata: { kind: 'gift', business_id: business } },
      customer_email: typeof b.email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email) ? b.email : undefined,
      metadata: { kind: 'gift', business_id: business, amount: String(option.amount), bonus: String(option.bonus || 0),
        months: String(s.gift.months || 12), recipient: String(b.recipient ?? '').slice(0, 80), note: String(b.note ?? '').slice(0, 300) },
      locale: lang === 'pl' ? 'pl' : lang === 'it' ? 'it' : 'en',
      success_url: SITE + `gift/card.html?session={CHECKOUT_SESSION_ID}&lang=${lang}`,
      cancel_url: SITE + `gift/?b=${business}&lang=${lang}`
    });
    return reply({ url: session.url });
  } catch (e) {
    console.error('gift-checkout', (e as Error).message);
    return reply({ error: (e as Error).message }, 500);
  }
});
