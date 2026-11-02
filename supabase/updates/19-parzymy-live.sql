-- Timbro update 19 (November 2026): a live demo card for Parzymy Tutaj (Bydgoszcz) in the real
-- database, so a customer's phone and the till (another phone or a laptop) see the same stamps.
-- Card: /app/card.html?card=parzymy-pokaz · Till: /app/stamper.html, link code PARZYMY1 (2 days).
-- Paste in Supabase SQL Editor and Run. Safe to run again (it also renews the link code).
set search_path = timbro, extensions;

-- A business with no owner account (nobody logs in as it); no "new café" email.
insert into businesses (id, owner_id, name, city, kind, signup_alerted)
values ('7a0c0000-0000-4000-8000-00000000a001', '7a0c0000-0000-4000-8000-00000000b001', 'Parzymy Tutaj', 'Bydgoszcz', 'caffe', true)
on conflict (id) do nothing;

insert into cards (id, business_id, business, city, type, title, reward, title_en, reward_en, stamps_needed, plan, lang, design)
values ('parzymy-pokaz', '7a0c0000-0000-4000-8000-00000000a001', 'Parzymy Tutaj', 'Bydgoszcz', 'caffe',
  'Karta kawowa', 'kawa gratis', 'Coffee card', 'a free coffee', 10, 'plus', 'pl',
  '{"style": "minimal", "color": "#C9E3A3", "ink": "#2F4A2B", "font": "sans", "strip": "#C9E3A3", "icon": "cup",
    "logo": "https://timbro.witkowskidesign.com/assets/demo/parzymy/logo.png",
    "stampImage": "https://timbro.witkowskidesign.com/assets/demo/parzymy/stamp.png",
    "stripImage": "https://timbro.witkowskidesign.com/assets/demo/parzymy/strip.png"}'::jsonb)
on conflict (id) do update set design = excluded.design, updated_at = now();

-- The code to link the till (stamper.html → "Połącz"); one use, 2 days.
delete from link_codes where code = 'PARZYMY1';
insert into link_codes (code, business_id, expires_at) values ('PARZYMY1', '7a0c0000-0000-4000-8000-00000000a001', now() + interval '2 days');

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
