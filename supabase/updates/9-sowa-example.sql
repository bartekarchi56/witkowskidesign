-- Timbro update 9 (October 2026): the Cukiernia Sowa example card, in the database.
-- It belongs to your own (Witkowski Design) account, so it works across phones:
-- stamp it from your linked till phone and the card in Apple Wallet updates.
-- Run after update 8. Paste in Supabase SQL Editor and Run. Safe to run again.
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
  values ('sowa', v_biz, 'Cukiernia Sowa', 'Bydgoszcz', 'pasticceria', 'Karta kawowa', 'kawa gratis', 'Coffee card', 'a free coffee', 8, 'chain', 'pl',
    jsonb_build_object('style', 'bottega', 'color', '#FBF6EE', 'ink', '#522D24', 'font', 'serif', 'strip', '#FBF6EE',
      'tagline', '80 lat tradycji', 'logo', '/assets/demo/sowa/logo-80.svg',
      'stampImage', '/assets/demo/sowa/owl-stamp.png', 'stripImage', '/assets/demo/sowa/strip.png'))
  on conflict (id) do nothing;
end $$;

grant usage on schema timbro to anon, authenticated;
revoke all on all tables in schema timbro from anon, authenticated;
revoke execute on all functions in schema timbro from public, anon, authenticated;

grant execute on function get_card(text), join_card(text, text, text, text, date, boolean), get_my_card(text, text),
  device_link(text, text), stamper_lookup(text, text), stamper_stamp(text, text, int), stamper_redeem(text, text),
  wallet_register(text, text, text, text), wallet_unregister(text, text, text), wallet_updated(text, bigint), wallet_targets(text, text)
  to anon, authenticated;

grant execute on function owner_data(), owner_save_card(jsonb), owner_save_messages(text, jsonb), owner_send_design(text, text, jsonb, text, jsonb, jsonb),
  owner_link_code(), owner_remove_device(uuid),
  admin_cards(), admin_publish(text, jsonb), admin_ask_changes(text, text), admin_set_plan(text, text)
  to authenticated;

grant usage on schema timbro to service_role;
grant execute on function stripe_business(uuid), stripe_set_customer(uuid, text),
  stripe_sync(text, text, text, text, text, bigint, boolean), stripe_is_admin(uuid) to service_role;
