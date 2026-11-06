-- Timbro update 27 (November 2026): removes the demo and test cards from Studio.
-- Kept: Totoro House, Bromberg Kaffee, Cukiernia Sowa, PARZYMY TUTAJ (their own account, written
-- in capitals; the lower-case "Parzymy Tutaj" is the old demo parzymy-pokaz and goes), and the
-- cards the website itself links to (the-coffee, orsonero, sisu: examples, e-mails, proposals).
-- A card's customers, stamps and Wallet registrations go with it. Businesses (owner accounts) stay.
-- Paste in Supabase SQL Editor and Run. The result lists the cards that were removed.
set search_path = timbro, extensions;

delete from cards
where business not in ('Totoro House', 'Bromberg Kaffee', 'Cukiernia Sowa', 'PARZYMY TUTAJ')
  and id not in ('the-coffee', 'orsonero', 'sisu')
returning id, business;

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
