-- Timbro database, part 9 of 12. Run the parts in order.
set search_path = timbro, extensions;

create or replace function wallet_register(p_code text, p_secret text, p_device text, p_push text) returns int
language plpgsql security definer set search_path = timbro
as $$
declare v_id text;
begin
  select id into v_id from customers where id = upper(p_code) and secret_hash = _hash(p_secret);
  if not found then return 401; end if;
  if length(coalesce(p_device, '')) not between 1 and 200 or length(coalesce(p_push, '')) not between 1 and 200 then return 400; end if;
  update wallet_devices set push_token = p_push where device_id = p_device and customer_id = v_id;
  if found then return 200; end if;
  insert into wallet_devices (device_id, customer_id, push_token) values (p_device, v_id, p_push);
  return 201;
end $$;

create or replace function wallet_unregister(p_code text, p_secret text, p_device text) returns int
language plpgsql security definer set search_path = timbro
as $$
begin
  if not exists (select 1 from customers where id = upper(p_code) and secret_hash = _hash(p_secret)) then return 401; end if;
  delete from wallet_devices where device_id = p_device and customer_id = upper(p_code);
  return 200;
end $$;

create or replace function wallet_updated(p_device text, p_since bigint) returns jsonb
language sql stable security definer set search_path = timbro
as $$
  select jsonb_build_object('serialNumbers', coalesce(jsonb_agg(c.id || '-' || m.id), '[]'::jsonb),
    'lastUpdated', coalesce(max(_pass_updated(m)), 0)::text)
  from wallet_devices w join customers m on m.id = w.customer_id join cards c on c.id = m.card_id
  where w.device_id = p_device and _pass_updated(m) > coalesce(p_since, 0)
$$;

create or replace function wallet_targets(p_token text, p_code text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare d devices := _device(p_token);
begin
  return coalesce((select jsonb_agg(w.push_token) from wallet_devices w join customers m on m.id = w.customer_id
    join cards c on c.id = m.card_id where m.id = upper(trim(p_code)) and c.business_id = d.business_id), '[]'::jsonb);
end $$;

create table if not exists job_keys (
  name  text primary key,
  key   text not null default _token()
);

insert into job_keys (name) values ('reminders') on conflict (name) do nothing;

create or replace function reminders_due(p_key text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare v_ids text[];
begin
  if not exists (select 1 from job_keys where name = 'reminders' and key = coalesce(p_key, '')) then
    raise exception 'Wrong key' using errcode = '28000';
  end if;
  select array_agg(id) into v_ids from (
    select m.id from customers m join cards c on c.id = m.card_id
    where coalesce((c.messages->'remind'->>'on')::boolean, true)
      and m.stamps < c.stamps_needed
      and coalesce(m.last_visit, m.joined_at) < now() - make_interval(days => coalesce((c.messages->'remind'->>'days')::int, 21))
      and (m.reminded_at is null or m.reminded_at < coalesce(m.last_visit, m.joined_at))
    order by m.id limit 300
  ) due;
  update customers set reminded_at = now() where id = any(v_ids);
  return coalesce((select jsonb_agg(jsonb_build_object('card', _card_json(c), 'customer', _customer_json(m, 0),
      'pushTokens', coalesce((select jsonb_agg(w.push_token) from wallet_devices w where w.customer_id = m.id), '[]'::jsonb)))
    from customers m join cards c on c.id = m.card_id where m.id = any(v_ids)), '[]'::jsonb);
end $$;

do $$ begin create extension if not exists pg_net; exception when others then raise notice 'pg_net not available: no alerts'; end $$;

create table if not exists settings (name text primary key, value text not null default '');

alter table settings enable row level security;

insert into job_keys (name) values ('alerts') on conflict (name) do nothing;

drop function if exists _alert(text, uuid);
