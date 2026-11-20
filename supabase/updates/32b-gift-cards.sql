-- Gift cards, part 2 (run after 32a): the till and the Stripe functions.
set search_path = timbro;

-- Till: look a gift card up, and take what was spent off its balance.
create or replace function stamper_voucher(p_token text, p_code text) returns jsonb language plpgsql security definer set search_path = timbro as $$
declare d devices := _device(p_token); v vouchers;
begin
  select * into v from vouchers where id = upper(trim(p_code)) and business_id = d.business_id;
  return case when found then _voucher_json(v) end;
end $$;

create or replace function stamper_voucher_spend(p_token text, p_code text, p_amount int) returns jsonb language plpgsql security definer set search_path = timbro as $$
declare d devices := _device(p_token); v vouchers;
begin
  select * into v from vouchers where id = upper(trim(p_code)) and business_id = d.business_id for update;
  if not found then raise exception 'Gift card not found.' using errcode = 'P0002'; end if;
  if v.expires_at < now() then raise exception 'This gift card has expired.' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > v.balance then raise exception 'Not enough credit on the card.' using errcode = '22023'; end if;
  update vouchers set balance = balance - p_amount where id = v.id returning * into v;
  insert into voucher_spends (voucher_id, device_id, amount) values (v.id, d.id, p_amount);
  return _voucher_json(v);
end $$;

-- After paying, the buyer's page finds the card by the Stripe session id (long and secret).
create or replace function gift_by_session(p_session text) returns jsonb language sql stable security definer set search_path = timbro as $$
  select _voucher_json(v) from vouchers v where v.session = p_session and p_session like 'cs\_%' $$;

-- Stripe functions (service role): the café's Connect account, and a paid card.
create or replace function gift_set_account(p_business uuid, p_account text) returns void language sql security definer set search_path = timbro as $$
  update businesses set stripe_account = p_account where id = p_business $$;
create or replace function gift_account(p_user uuid) returns jsonb language sql stable security definer set search_path = timbro as $$
  select jsonb_build_object('id', b.id, 'account', b.stripe_account, 'email', (select email from auth.users where id = p_user), 'name', b.name)
  from businesses b where b.owner_id = p_user $$;
create or replace function gift_seller(p_business uuid) returns jsonb language sql stable security definer set search_path = timbro as $$
  select jsonb_build_object('name', b.name, 'account', b.stripe_account, 'gift', b.gift,
    'plan', (select c.plan from cards c where c.business_id = b.id order by c.created_at limit 1))
  from businesses b where b.id = p_business $$;
create or replace function gift_create(p_session text, p_business uuid, p_amount int, p_bonus int, p_email text, p_recipient text, p_note text, p_months int) returns jsonb
language plpgsql security definer set search_path = timbro as $$
declare v vouchers;
begin
  select * into v from vouchers where session = p_session;
  if not found then
    insert into vouchers (id, business_id, amount, bonus, balance, buyer_email, recipient, note, session, expires_at)
    values ('G' || _code(9), p_business, p_amount, p_bonus, p_amount + p_bonus, left(coalesce(p_email, ''), 200), left(coalesce(p_recipient, ''), 80),
      left(coalesce(p_note, ''), 300), p_session, now() + make_interval(months => greatest(p_months, 1))) returning * into v;
  end if;
  return _voucher_json(v);
end $$;

-- ----------------------------------------------------------- permissions --

-- Only inside the timbro schema: other apps in this project are not touched.
grant usage on schema timbro to anon, authenticated;
revoke all on all tables in schema timbro from anon, authenticated;
revoke execute on all functions in schema timbro from public, anon, authenticated;

grant execute on function get_card(text), join_card(text, text, text, text, date, boolean, text), get_my_card(text, text),
  device_link(text, text), stamper_lookup(text, text), stamper_stamp(text, text, int), stamper_redeem(text, text), stamper_gift(text, text),
  gift_shop(uuid), gift_get(text), stamper_voucher(text, text), stamper_voucher_spend(text, text, int), gift_by_session(text),
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
  leads_add(jsonb), leads_list(text), leads_get(text), leads_set(text, text), leads_update(text, text, text, text),
  gift_set_account(uuid, text), gift_account(uuid), gift_seller(uuid), gift_create(text, uuid, int, int, text, text, text, int), gift_get(text) to service_role;
