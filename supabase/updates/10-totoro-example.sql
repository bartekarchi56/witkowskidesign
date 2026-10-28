-- Timbro update 10 (October 2026): the Totoro House example card, in the database.
-- A café that commented on Instagram sent its logo (a rubber stamp); this card is their example:
-- open https://timbro.witkowskidesign.com/app/card.html?card=totoro-house and add it to Wallet.
-- It belongs to your own (Witkowski Design) account. The artwork is in assets/demo/totoro/.
-- Run after update 9. Paste in Supabase SQL Editor and Run. Safe to run again.
set search_path = timbro, extensions;

do $$
declare v_admin uuid; v_biz uuid;
begin
  select user_id into v_admin from admins order by user_id limit 1;
  if v_admin is null then raise exception 'Make your account a designer first (see "after setup" in schema.sql).'; end if;
  insert into businesses (owner_id, name) values (v_admin, 'Witkowski Design')
  on conflict (owner_id) do nothing;
  select id into v_biz from businesses where owner_id = v_admin;
  insert into cards (id, business_id, business, city, type, title, reward, title_en, reward_en, stamps_needed, plan, lang, design)
  values ('totoro-house', v_biz, 'Totoro House', '', 'caffe', 'Stamp card', 'a free drink', 'Stamp card', 'a free drink', 10, 'plus', 'en',
    jsonb_build_object('style', 'minimal', 'color', '#E6DCCB', 'ink', '#4F5E3B', 'font', 'sans', 'strip', '#DDD1BC',
      'logo', '/assets/demo/totoro/logo.png', 'stampImage', '/assets/demo/totoro/stamp.png'))
  on conflict (id) do nothing;
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
