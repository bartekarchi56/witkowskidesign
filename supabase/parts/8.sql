-- Timbro database, part 8 of 8. Run the parts in order.
set search_path = timbro, extensions;

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

grant usage on schema timbro to anon, authenticated;

revoke all on all tables in schema timbro from anon, authenticated;

revoke execute on all functions in schema timbro from public, anon, authenticated;

grant execute on function get_card(text), join_card(text, text, text, text, date, boolean), get_my_card(text, text),
  device_link(text, text), stamper_lookup(text, text), stamper_stamp(text, text, int), stamper_redeem(text, text),
  wallet_register(text, text, text, text), wallet_unregister(text, text, text), wallet_updated(text, bigint), wallet_targets(text, text), reminders_due(text)
  to anon, authenticated;

grant execute on function owner_data(), owner_save_card(jsonb), owner_save_messages(text, jsonb), owner_send_design(text, text, jsonb, text, jsonb, jsonb),
  owner_link_code(), owner_remove_device(uuid), owner_set_device_location(uuid, text), owner_send_news(text, text), owner_news_targets(text),
  admin_cards(), admin_publish(text, jsonb), admin_ask_changes(text, text), admin_set_plan(text, text)
  to authenticated;

grant usage on schema timbro to service_role;

grant execute on function stripe_business(uuid), stripe_set_customer(uuid, text),
  stripe_sync(text, text, text, text, text, bigint, boolean), stripe_is_admin(uuid) to service_role;
