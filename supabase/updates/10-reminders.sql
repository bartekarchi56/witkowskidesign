-- Timbro update 10 (October 2026): daily "we miss you" reminders.
-- Customers who haven't been in for the café's chosen number of days get the café's
-- reminder on their Wallet card, once per visit. Paste in Supabase SQL Editor and Run.
-- Safe to run again. Afterwards: select key from timbro.job_keys where name = 'reminders';
set search_path = timbro, extensions;

alter table customers add column if not exists reminded_at timestamptz;

create or replace function _customer_json(m customers, history_limit int default 5) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'id', m.id, 'cardId', m.card_id, 'name', m.name, 'stamps', m.stamps, 'redeemed', m.redeemed,
    'joinedAt', (extract(epoch from m.joined_at) * 1000)::bigint,
    'lastVisit', (extract(epoch from m.last_visit) * 1000)::bigint,
    'remindedAt', (extract(epoch from m.reminded_at) * 1000)::bigint,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('t', (extract(epoch from e.created_at) * 1000)::bigint, 'type', e.type, 'n', e.n) order by e.created_at)
      from (select * from events where customer_id = m.id order by created_at desc limit history_limit) e
    ), '[]'::jsonb)
  )
$$;

create or replace function _pass_updated(m customers) returns bigint
language sql stable set search_path = timbro
as $$
  select (extract(epoch from greatest(m.joined_at, c.updated_at, m.reminded_at,
    coalesce((select max(e.created_at) from events e where e.customer_id = m.id), m.joined_at))) * 1000)::bigint
  from cards c where c.id = m.card_id
$$;

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

grant usage on schema timbro to anon, authenticated;
revoke all on all tables in schema timbro from anon, authenticated;
revoke execute on all functions in schema timbro from public, anon, authenticated;

grant execute on function get_card(text), join_card(text, text, text, text, date, boolean), get_my_card(text, text),
  device_link(text, text), stamper_lookup(text, text), stamper_stamp(text, text, int), stamper_redeem(text, text),
  wallet_register(text, text, text, text), wallet_unregister(text, text, text), wallet_updated(text, bigint), wallet_targets(text, text), reminders_due(text)
  to anon, authenticated;

grant execute on function owner_data(), owner_save_card(jsonb), owner_save_messages(text, jsonb), owner_send_design(text, text, jsonb, text, jsonb, jsonb),
  owner_link_code(), owner_remove_device(uuid),
  admin_cards(), admin_publish(text, jsonb), admin_ask_changes(text, text), admin_set_plan(text, text)
  to authenticated;

grant usage on schema timbro to service_role;
grant execute on function stripe_business(uuid), stripe_set_customer(uuid, text),
  stripe_sync(text, text, text, text, text, bigint, boolean), stripe_is_admin(uuid) to service_role;
