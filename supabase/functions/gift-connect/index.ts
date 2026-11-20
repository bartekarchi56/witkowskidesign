// Gift cards: the café connects its own Stripe account (Stripe Connect, Express), so the money from
// gift cards goes straight to the café. The owner clicks "Connect Stripe" in the dashboard; this makes
// the account once and returns Stripe's onboarding link (ID, bank account), or the Express dashboard
// once they are set up. Secrets: STRIPE_SECRET_KEY. Connect must be switched on in the Stripe account.
import Stripe from 'npm:stripe@23';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '');
const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || (() => { try { return Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}'))[0] as string; } catch { return ''; } })();
const db = createClient(Deno.env.get('SUPABASE_URL')!, serverKey, { db: { schema: 'timbro' } });
const SITE = (Deno.env.get('SITE_URL') ?? 'https://timbro.witkowskidesign.com/').replace(/\/?$/, '/');
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
    const { data: { user } } = await db.auth.getUser(jwt);
    if (!user) return reply({ error: 'Please log in again.' }, 401);
    const { data: biz } = await db.rpc('gift_account', { p_user: user.id });
    if (!biz) return reply({ error: 'Create your card first.' }, 400);

    let account = biz.account as string | null;
    if (!account) {
      const a = await stripe.accounts.create({
        type: 'express', email: biz.email ?? undefined, business_type: 'company',
        business_profile: { name: biz.name || undefined, product_description: 'Gift cards for a café, sold through Timbro' },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { business_id: biz.id }
      }, { idempotencyKey: 'timbro-connect-' + biz.id });
      account = a.id;
      await db.rpc('gift_set_account', { p_business: biz.id, p_account: account });
    }
    const a = await stripe.accounts.retrieve(account);
    if (a.charges_enabled && a.details_submitted) {
      const login = await stripe.accounts.createLoginLink(account);
      return reply({ url: login.url, ready: true });
    }
    const link = await stripe.accountLinks.create({
      account, type: 'account_onboarding',
      refresh_url: SITE + 'app/dashboard.html#gift', return_url: SITE + 'app/dashboard.html?connected=1#gift'
    });
    return reply({ url: link.url, ready: false });
  } catch (e) {
    console.error('gift-connect', (e as Error).message);
    return reply({ error: (e as Error).message }, 500);
  }
});
