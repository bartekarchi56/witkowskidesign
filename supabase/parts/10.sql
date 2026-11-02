-- Timbro database, part 10 of 11. Run the parts in order.
set search_path = timbro, extensions;

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

create or replace function alert_key_ok(p_key text) returns boolean
language sql stable security definer set search_path = timbro
as $$ select exists (select 1 from job_keys where name = 'alerts' and key = coalesce(p_key, '')) $$;

create table if not exists online_orders (
  card_id   text not null references cards(id) on delete cascade,
  platform  text not null check (platform in ('wolt', 'ubereats', 'glovo', 'deliveroo')),
  order_id  text not null check (length(order_id) between 1 and 80),
  at        timestamptz not null,
  total     numeric(10,2) not null check (total >= 0 and total < 100000),
  currency  text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  primary key (card_id, platform, order_id)
);

alter table online_orders enable row level security;

create or replace function _my_card(p_card_id text) returns text
language plpgsql stable security definer set search_path = timbro
as $$
declare v text;
begin
  if auth.uid() is null then raise exception 'Not logged in.' using errcode = '28000'; end if;
  select id into v from cards where id = lower(p_card_id) and business_id = _my_business();
  if v is null then raise exception 'This card belongs to another café.' using errcode = '42501'; end if;
  return v;
end $$;

create or replace function owner_import_orders(p_card_id text, p_orders jsonb) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare v_card text := _my_card(p_card_id); v_before int; v_after int;
begin
  if jsonb_typeof(p_orders) <> 'array' or jsonb_array_length(p_orders) > 2000 then
    raise exception 'Too many orders in one go.' using errcode = '22023';
  end if;
  select count(*) into v_before from online_orders where card_id = v_card;
  insert into online_orders (card_id, platform, order_id, at, total, currency)
  select distinct on (o->>'p', left(o->>'id', 80)) v_card, o->>'p', left(o->>'id', 80),
         to_timestamp((o->>'t')::bigint / 1000.0), round((o->>'v')::numeric, 2), coalesce(nullif(o->>'c', ''), 'EUR')
  from jsonb_array_elements(p_orders) o
  where o->>'p' in ('wolt', 'ubereats', 'glovo', 'deliveroo') and coalesce(o->>'id', '') <> ''
    and (o->>'t') ~ '^\d{10,14}$' and (o->>'v') ~ '^\d{1,5}(\.\d+)?$' and coalesce(o->>'c', 'EUR') ~ '^[A-Z]{3}$'
  on conflict (card_id, platform, order_id) do update set at = excluded.at, total = excluded.total, currency = excluded.currency;
  select count(*) into v_after from online_orders where card_id = v_card;
  return jsonb_build_object('added', v_after - v_before);
end $$;

create or replace function owner_online_orders(p_card_id text) returns jsonb
language plpgsql stable security definer set search_path = timbro
as $$
declare v_card text := _my_card(p_card_id);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('p', platform, 'id', order_id, 't', (extract(epoch from at) * 1000)::bigint,
    'v', total, 'c', currency) order by at) from online_orders where card_id = v_card and at > now() - interval '400 days'), '[]'::jsonb);
end $$;

create or replace function owner_clear_orders(p_card_id text, p_platform text) returns int
language plpgsql security definer set search_path = timbro
as $$
declare v_card text := _my_card(p_card_id); n int;
begin
  delete from online_orders where card_id = v_card and platform = p_platform;
  get diagnostics n = row_count;
  return n;
end $$;

grant usage on schema timbro to anon, authenticated;

revoke all on all tables in schema timbro from anon, authenticated;

revoke execute on all functions in schema timbro from public, anon, authenticated;

grant execute on function get_card(text), join_card(text, text, text, text, date, boolean, text), get_my_card(text, text),
  device_link(text, text), stamper_lookup(text, text), stamper_stamp(text, text, int), stamper_redeem(text, text), stamper_gift(text, text),
  wallet_register(text, text, text, text), wallet_unregister(text, text, text), wallet_updated(text, bigint), wallet_targets(text, text), reminders_due(text)
  to anon, authenticated;
