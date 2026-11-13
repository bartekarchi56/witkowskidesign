-- Timbro database, part 11 of 12. Run the parts in order.
set search_path = timbro, extensions;

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

create table if not exists leads (
  place_id    text primary key,
  name        text not null default '',
  kind        text not null default '',
  address     text not null default '',
  city        text not null default '',
  rating      numeric(2,1),
  reviews     int,
  website     text not null default '',
  email       text not null default '',
  phone       text not null default '',
  maps_url    text not null default '',
  summary     text not null default '',
  photos      jsonb not null default '[]'::jsonb,
  loyalty     text not null default '',
  status      text not null default 'new' check (status in ('new', 'sent', 'skipped', 'manual', 'replied')),
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

alter table leads add column if not exists instagram text not null default '';   -- handle from their website

alter table leads enable row level security;

create or replace function leads_add(p_leads jsonb) returns int
language plpgsql security definer set search_path = timbro
as $$
declare n int;
begin
  insert into leads (place_id, name, kind, address, city, rating, reviews, website, email, phone, maps_url, summary, photos, loyalty, instagram)
  select l->>'place_id', coalesce(l->>'name', ''), coalesce(l->>'kind', ''), coalesce(l->>'address', ''), coalesce(l->>'city', ''),
         nullif(l->>'rating', '')::numeric, nullif(l->>'reviews', '')::int, coalesce(l->>'website', ''), coalesce(l->>'email', ''),
         coalesce(l->>'phone', ''), coalesce(l->>'maps_url', ''), coalesce(l->>'summary', ''), coalesce(l->'photos', '[]'::jsonb), coalesce(l->>'loyalty', ''),
         left(coalesce(l->>'instagram', ''), 30)
  from jsonb_array_elements(p_leads) l where coalesce(l->>'place_id', '') <> ''
  on conflict (place_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function leads_list(p_status text) returns jsonb
language sql stable security definer set search_path = timbro
as $$ select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at), '[]'::jsonb) from leads l where l.status = p_status $$;
