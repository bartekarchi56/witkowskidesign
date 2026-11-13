-- Timbro update 31 (November 2026): a café chooses a plan (the free trial included) before its card works.
-- Until then customers can't join, the till can't be linked and no stamps or rewards are given.
-- Never locked: billing_free cafés (set by hand), cafés with no owner login (cards made by Witkowski
-- Design: demos and examples), admins' own cafés, and chains (invoiced).
-- To make a café free by hand:  update timbro.businesses set billing_free = true where name = '...';
-- Paste in Supabase SQL Editor and Run. Safe to run again.
set search_path = timbro, extensions;

alter table businesses add column if not exists billing_free boolean not null default false;

create or replace function _biz_live(p_biz uuid) returns boolean
language sql stable security definer set search_path = timbro
as $$
  select exists (select 1 from businesses b where b.id = p_biz and (
    b.billing_free
    or b.billing_status in ('trialing', 'active', 'past_due', 'unpaid', 'paused')
    or not exists (select 1 from auth.users u where u.id = b.owner_id)
    or exists (select 1 from admins a where a.user_id = b.owner_id)
    or exists (select 1 from cards c where c.business_id = b.id and c.plan = 'chain')))
$$;

-- The dashboard reads billing.live to show the link and QR code, or the plans first.
create or replace function _billing_json(b businesses) returns jsonb
language sql stable
as $$
  select jsonb_build_object('status', b.billing_status, 'plan', b.billing_plan, 'interval', b.billing_interval,
    'periodEnd', (extract(epoch from b.billing_period_end) * 1000)::bigint, 'trialUsed', b.trial_used,
    'customer', b.stripe_customer is not null, 'canceling', b.billing_canceling, 'live', _biz_live(b.id))
$$;

-- One guard for joins, stamps, rewards, gifts and till links, whatever function writes them.
create or replace function _need_plan() returns trigger
language plpgsql security definer set search_path = timbro
as $$
declare v_biz uuid;
begin
  if tg_table_name = 'customers' then
    select business_id into v_biz from cards where id = new.card_id;
  elsif tg_table_name = 'events' then
    if new.type not in ('stamp', 'redeem', 'gift', 'bonus', 'friend') then return new; end if;
    select c.business_id into v_biz from customers m join cards c on c.id = m.card_id where m.id = new.customer_id;
  else
    v_biz := new.business_id;
  end if;
  if v_biz is not null and not _biz_live(v_biz) then
    raise exception 'PLAN_REQUIRED: the café must choose a plan before using the card';
  end if;
  return new;
end $$;

drop trigger if exists need_plan on customers;
create trigger need_plan before insert on customers for each row execute function _need_plan();
drop trigger if exists need_plan on events;
create trigger need_plan before insert on events for each row execute function _need_plan();
drop trigger if exists need_plan on devices;
create trigger need_plan before insert on devices for each row execute function _need_plan();
drop trigger if exists need_plan on link_codes;
create trigger need_plan before insert on link_codes for each row execute function _need_plan();

-- Who is locked now (cafés with an owner login and no plan): check this list after running.
select b.name, b.billing_status, _biz_live(b.id) as live from businesses b order by live, b.name;

-- ----------------------------------------------------------- permissions --

-- Only inside the timbro schema: other apps in this project are not touched.
grant usage on schema timbro to anon, authenticated;
revoke all on all tables in schema timbro from anon, authenticated;
revoke execute on all functions in schema timbro from public, anon, authenticated;

grant execute on function get_card(text), join_card(text, text, text, text, date, boolean, text), get_my_card(text, text),
  device_link(text, text), stamper_lookup(text, text), stamper_stamp(text, text, int), stamper_redeem(text, text), stamper_gift(text, text),
  wallet_register(text, text, text, text), wallet_unregister(text, text, text), wallet_updated(text, bigint), wallet_targets(text, text), reminders_due(text)
  to anon, authenticated;

grant execute on function owner_data(), owner_save_card(jsonb), owner_save_messages(text, jsonb), owner_send_design(text, text, jsonb, text, jsonb, jsonb),
  owner_link_code(), owner_remove_device(uuid), owner_set_device_location(uuid, text), owner_send_news(text, text), owner_news_targets(text),
  owner_import_orders(text, jsonb), owner_online_orders(text), owner_clear_orders(text, text),
  admin_cards(), admin_publish(text, jsonb), admin_ask_changes(text, text), admin_set_plan(text, text)
  to authenticated;

-- The Stripe functions (supabase/functions/) use the service role.
grant usage on schema timbro to service_role;
grant execute on function stripe_business(uuid), stripe_set_customer(uuid, text),
  stripe_sync(text, text, text, text, text, bigint, boolean), stripe_is_admin(uuid), alert_key_ok(text) to service_role;
