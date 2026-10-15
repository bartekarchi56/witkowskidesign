-- Timbro update 11 (October 2026): locations for chains.
-- Each till phone can say which shop it is in; the dashboard's Results split by it.
-- Paste in Supabase SQL Editor and Run. Safe to run again.
set search_path = timbro, extensions;

alter table devices add column if not exists location text not null default '';

create or replace function _customer_json(m customers, history_limit int default 5) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'id', m.id, 'cardId', m.card_id, 'name', m.name, 'stamps', m.stamps, 'redeemed', m.redeemed,
    'joinedAt', (extract(epoch from m.joined_at) * 1000)::bigint,
    'lastVisit', (extract(epoch from m.last_visit) * 1000)::bigint,
    'remindedAt', (extract(epoch from m.reminded_at) * 1000)::bigint,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('t', (extract(epoch from e.created_at) * 1000)::bigint, 'type', e.type, 'n', e.n)
        || case when dv.location <> '' then jsonb_build_object('at', dv.location) else '{}'::jsonb end order by e.created_at)
      from (select * from events where customer_id = m.id order by created_at desc limit history_limit) e
      left join devices dv on dv.id = e.device_id
    ), '[]'::jsonb)
  )
$$;

create or replace function owner_data() returns jsonb
language plpgsql stable security definer set search_path = timbro
as $$
declare v_biz uuid := _my_business();
begin
  if auth.uid() is null then raise exception 'Not logged in.' using errcode = '28000'; end if;
  return jsonb_build_object(
    'isAdmin', _is_admin(),
    'profile', _profile(),
    'billing', (select _billing_json(b) from businesses b where b.id = v_biz),
    'cards', coalesce((select jsonb_agg(_card_json(c, true) order by c.created_at) from cards c where c.business_id = v_biz), '[]'::jsonb),
    'customers', coalesce((select jsonb_agg(_customer_json(m, 200) || _customer_contact(m)) from customers m join cards c on c.id = m.card_id where c.business_id = v_biz), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'location', d.location, 'lastUsed', (extract(epoch from d.last_used) * 1000)::bigint) order by d.created_at) from devices d where d.business_id = v_biz), '[]'::jsonb)
  );
end $$;

create or replace function owner_set_device_location(p_device_id uuid, p_location text) returns void
language sql security definer set search_path = timbro
as $$ update devices set location = left(trim(regexp_replace(coalesce(p_location, ''), '[[:cntrl:]]', ' ', 'g')), 60)
      where id = p_device_id and business_id = _my_business() $$;

grant usage on schema timbro to anon, authenticated;
revoke all on all tables in schema timbro from anon, authenticated;
revoke execute on all functions in schema timbro from public, anon, authenticated;

grant execute on function get_card(text), join_card(text, text, text, text, date, boolean), get_my_card(text, text),
  device_link(text, text), stamper_lookup(text, text), stamper_stamp(text, text, int), stamper_redeem(text, text),
  wallet_register(text, text, text, text), wallet_unregister(text, text, text), wallet_updated(text, bigint), wallet_targets(text, text), reminders_due(text)
  to anon, authenticated;

grant execute on function owner_data(), owner_save_card(jsonb), owner_save_messages(text, jsonb), owner_send_design(text, text, jsonb, text, jsonb, jsonb),
  owner_link_code(), owner_remove_device(uuid), owner_set_device_location(uuid, text),
  admin_cards(), admin_publish(text, jsonb), admin_ask_changes(text, text), admin_set_plan(text, text)
  to authenticated;

grant usage on schema timbro to service_role;
grant execute on function stripe_business(uuid), stripe_set_customer(uuid, text),
  stripe_sync(text, text, text, text, text, bigint, boolean), stripe_is_admin(uuid) to service_role;
