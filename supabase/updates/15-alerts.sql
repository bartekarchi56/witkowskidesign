-- Timbro update 15 (November 2026): email alerts to Witkowski Design when a café signs up
-- and when its subscription starts, is paid, fails or is cancelled (supabase/functions/admin-alert).
-- Deploy admin-alert first (see STRIPE.md, "Alerts"). Paste in Supabase SQL Editor and Run. Safe to run again.
set search_path = timbro, extensions;

do $$ begin create extension if not exists pg_net; exception when others then raise notice 'pg_net not available: no alerts'; end $$;
create table if not exists settings (name text primary key, value text not null default '');
alter table settings enable row level security;
insert into job_keys (name) values ('alerts') on conflict (name) do nothing;

create or replace function _alert(p_kind text, p_business uuid) returns void
language plpgsql security definer set search_path = timbro, extensions
as $$
declare v_url text := (select value from settings where name = 'alerts_url'); v_data jsonb;
begin
  if coalesce(v_url, '') = '' then return; end if;
  select jsonb_build_object('business', b.name, 'contact', b.contact_name, 'email', u.email, 'phone', b.phone, 'city', b.city,
      'address', b.address, 'instagram', b.instagram, 'type', b.kind, 'plan', b.billing_plan, 'interval', b.billing_interval,
      'periodEnd', b.billing_period_end, 'cards', (select coalesce(jsonb_agg(c.id order by c.created_at), '[]'::jsonb) from cards c where c.business_id = b.id))
    into v_data from businesses b left join auth.users u on u.id = b.owner_id where b.id = p_business;
  begin
    perform net.http_post(url := v_url, body := jsonb_build_object('key', (select key from job_keys where name = 'alerts'), 'kind', p_kind, 'data', v_data));
  exception when others then raise warning 'alert not sent: %', sqlerrm;
  end;
end $$;

-- Someone new signed up: their café's first card got its name. Once per café (cafés that
-- existed before alerts count as already announced: the column is added true, then defaults to false).
alter table businesses add column if not exists signup_alerted boolean not null default true;
alter table businesses alter column signup_alerted set default false;
create or replace function _alert_card() returns trigger
language plpgsql security definer set search_path = timbro
as $$
begin
  if new.business <> '' then
    update businesses set signup_alerted = true, name = case when name = '' then new.business else name end
    where id = new.business_id and not signup_alerted;
    if found then perform _alert('signup', new.business_id); end if;
  end if;
  return new;
end $$;
drop trigger if exists alert_card on cards;
create trigger alert_card after insert or update of business on cards for each row execute function _alert_card();

-- The subscription changed (stripe_sync): trial started, paying, payment failed, cancelled, ended.
create or replace function _alert_billing() returns trigger
language plpgsql security definer set search_path = timbro
as $$
declare v_kind text;
begin
  if new.billing_status is distinct from old.billing_status then
    v_kind := case new.billing_status when 'trialing' then 'trial' when 'active' then 'paying' when 'past_due' then 'failed'
      when 'unpaid' then 'failed' when 'canceled' then 'ended' end;
  elsif new.billing_canceling and not old.billing_canceling then v_kind := 'canceling';
  end if;
  if v_kind is not null then perform _alert(v_kind, new.id); end if;
  return new;
end $$;
drop trigger if exists alert_billing on businesses;
create trigger alert_billing after update of billing_status, billing_canceling on businesses for each row execute function _alert_billing();

-- The admin-alert function checks that a request really comes from this database.
create or replace function alert_key_ok(p_key text) returns boolean
language sql stable security definer set search_path = timbro
as $$ select exists (select 1 from job_keys where name = 'alerts' and key = coalesce(p_key, '')) $$;

insert into settings (name, value) values ('alerts_url', 'https://xchpnvadjxonhnknywis.supabase.co/functions/v1/admin-alert')
on conflict (name) do update set value = excluded.value;

grant usage on schema timbro to anon, authenticated;
revoke all on all tables in schema timbro from anon, authenticated;
revoke execute on all functions in schema timbro from public, anon, authenticated;

grant execute on function get_card(text), join_card(text, text, text, text, date, boolean, text), get_my_card(text, text),
  device_link(text, text), stamper_lookup(text, text), stamper_stamp(text, text, int), stamper_redeem(text, text), stamper_gift(text, text),
  wallet_register(text, text, text, text), wallet_unregister(text, text, text), wallet_updated(text, bigint), wallet_targets(text, text), reminders_due(text)
  to anon, authenticated;

grant execute on function owner_data(), owner_save_card(jsonb), owner_save_messages(text, jsonb), owner_send_design(text, text, jsonb, text, jsonb, jsonb),
  owner_link_code(), owner_remove_device(uuid), owner_set_device_location(uuid, text), owner_send_news(text, text), owner_news_targets(text),
  admin_cards(), admin_publish(text, jsonb), admin_ask_changes(text, text), admin_set_plan(text, text)
  to authenticated;

-- The Stripe functions (supabase/functions/) use the service role.
grant usage on schema timbro to service_role;
grant execute on function stripe_business(uuid), stripe_set_customer(uuid, text),
  stripe_sync(text, text, text, text, text, bigint, boolean), stripe_is_admin(uuid), alert_key_ok(text) to service_role;
