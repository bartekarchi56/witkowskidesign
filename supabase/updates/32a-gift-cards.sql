-- Gift cards ("vouchers"): a café sells prepaid credit online (Stripe Connect: the money goes to the
-- café's own Stripe account, Timbro keeps a small fee), the card goes to Apple/Google Wallet, and the
-- till deducts what is spent. Settings in the dashboard; selling page gift/?b=<business>.
set search_path = timbro;

alter table businesses add column if not exists stripe_account text;              -- the café's Connect account (acct_...)
alter table businesses add column if not exists gift jsonb not null default '{}';  -- { on, amounts: [{amount, bonus}], months }

create table if not exists vouchers (
  id           text primary key,                                   -- the code under the QR (G + 9 characters)
  business_id  uuid not null references businesses(id) on delete cascade,
  amount       int  not null check (amount > 0),                   -- cents paid
  bonus        int  not null default 0 check (bonus >= 0),         -- cents of extra credit
  balance      int  not null check (balance >= 0),                 -- cents left
  buyer_email  text not null default '',
  recipient    text not null default '',
  note         text not null default '',
  session      text unique,                                        -- the Stripe Checkout session (one card per payment)
  created_at   timestamptz not null default now(),
  expires_at   timestamptz
);
create index if not exists vouchers_business on vouchers(business_id, created_at);
create table if not exists voucher_spends (
  id bigint generated always as identity primary key,
  voucher_id text not null references vouchers(id) on delete cascade,
  device_id uuid references devices(id) on delete set null,
  amount int not null, created_at timestamptz not null default now()
);

create or replace function _voucher_json(v vouchers) returns jsonb language sql stable set search_path = timbro as $$
  select jsonb_build_object('code', v.id, 'amount', v.amount, 'bonus', v.bonus, 'balance', v.balance, 'recipient', v.recipient,
    'note', v.note, 'expires', v.expires_at, 'expired', coalesce(v.expires_at < now(), false), 'business', b.name, 'businessId', b.id,
    'card', (select _card_json(c) from cards c where c.business_id = b.id order by c.created_at limit 1))
  from businesses b where b.id = v.business_id $$;

-- Owner: settings, and the cards sold.
create or replace function owner_gift_save(p_gift jsonb) returns jsonb language plpgsql security definer set search_path = timbro as $$
declare v_biz uuid := _my_business(); v_am jsonb;
begin
  if v_biz is null then raise exception 'Create your card first.' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('amount', least(greatest((a->>'amount')::int, 100), 100000), 'bonus', least(greatest(coalesce((a->>'bonus')::int, 0), 0), 100000))), '[]')
    into v_am from jsonb_array_elements(coalesce(p_gift->'amounts', '[]')) a where (a->>'amount') ~ '^\d+$';
  update businesses set gift = jsonb_build_object('on', coalesce((p_gift->>'on')::boolean, false), 'amounts', v_am,
    'months', least(greatest(coalesce((p_gift->>'months')::int, 12), 1), 60)) where id = v_biz;
  return (select jsonb_build_object('gift', gift, 'connected', stripe_account is not null) from businesses where id = v_biz);
end $$;

create or replace function owner_gifts() returns jsonb language sql stable security definer set search_path = timbro as $$
  select jsonb_build_object('gift', b.gift, 'connected', b.stripe_account is not null, 'business', b.id,
    'sold', coalesce((select jsonb_agg(jsonb_build_object('code', v.id, 'amount', v.amount, 'bonus', v.bonus, 'balance', v.balance,
      'recipient', v.recipient, 'email', v.buyer_email, 'created', v.created_at, 'expires', v.expires_at) order by v.created_at desc)
      from vouchers v where v.business_id = b.id), '[]'))
  from businesses b where b.id = _my_business() $$;

-- Public: what the selling page shows, and a card's balance (the code is the key).
create or replace function gift_shop(p_business uuid) returns jsonb language sql stable security definer set search_path = timbro as $$
  select jsonb_build_object('name', b.name, 'gift', b.gift, 'ready', b.stripe_account is not null and coalesce((b.gift->>'on')::boolean, false),
    'card', (select _card_json(c) from cards c where c.business_id = b.id order by c.created_at limit 1))
  from businesses b where b.id = p_business $$;

create or replace function gift_get(p_code text) returns jsonb language sql stable security definer set search_path = timbro as $$
  select _voucher_json(v) from vouchers v where v.id = upper(trim(p_code)) $$;

-- ----------------------------------------------------------- permissions --

-- Only inside the timbro schema: other apps in this project are not touched.
grant usage on schema timbro to anon, authenticated;
revoke all on all tables in schema timbro from anon, authenticated;
revoke execute on all functions in schema timbro from public, anon, authenticated;

grant execute on function get_card(text), join_card(text, text, text, text, date, boolean, text), get_my_card(text, text),
  device_link(text, text), stamper_lookup(text, text), stamper_stamp(text, text, int), stamper_redeem(text, text), stamper_gift(text, text),
  gift_shop(uuid), gift_get(text),
  wallet_register(text, text, text, text), wallet_unregister(text, text, text), wallet_updated(text, bigint), wallet_targets(text, text), reminders_due(text)
  to anon, authenticated;

grant execute on function owner_data(), owner_save_card(jsonb), owner_save_messages(text, jsonb), owner_send_design(text, text, jsonb, text, jsonb, jsonb),
  owner_link_code(), owner_remove_device(uuid), owner_set_device_location(uuid, text), owner_send_news(text, text), owner_news_targets(text),
  owner_import_orders(text, jsonb), owner_online_orders(text), owner_clear_orders(text, text), owner_gift_save(jsonb), owner_gifts(),
  admin_cards(), admin_publish(text, jsonb), admin_ask_changes(text, text), admin_set_plan(text, text)
  to authenticated;

-- The Stripe functions (supabase/functions/) use the service role.
grant usage on schema timbro to service_role;
grant execute on function stripe_business(uuid), stripe_set_customer(uuid, text),
  stripe_sync(text, text, text, text, text, bigint, boolean), stripe_is_admin(uuid), alert_key_ok(text),
  leads_add(jsonb), leads_list(text), leads_get(text), leads_set(text, text), leads_update(text, text, text, text) to service_role;
