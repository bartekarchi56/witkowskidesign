-- Timbro database, part 12 of 12. Run the parts in order.
set search_path = timbro, extensions;

create or replace function leads_get(p_place text) returns jsonb
language sql stable security definer set search_path = timbro
as $$ select to_jsonb(l) from leads l where l.place_id = p_place $$;

create or replace function leads_update(p_place text, p_email text, p_instagram text, p_loyalty text) returns void
language sql security definer set search_path = timbro
as $$ update leads set email = left(coalesce(p_email, ''), 200), instagram = left(coalesce(p_instagram, ''), 30), loyalty = left(coalesce(p_loyalty, ''), 60) where place_id = p_place $$;

create or replace function leads_set(p_place text, p_status text) returns void
language sql security definer set search_path = timbro
as $$ update leads set status = p_status, sent_at = case when p_status = 'sent' then now() else sent_at end where place_id = p_place $$;

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

grant usage on schema timbro to service_role;

grant execute on function stripe_business(uuid), stripe_set_customer(uuid, text),
  stripe_sync(text, text, text, text, text, bigint, boolean), stripe_is_admin(uuid), alert_key_ok(text),
  leads_add(jsonb), leads_list(text), leads_get(text), leads_set(text, text), leads_update(text, text, text, text) to service_role;
