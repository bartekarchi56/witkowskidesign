-- Timbro update 23 (November 2026): leads keep the Instagram handle found on their website, to
-- write to places without an e-mail (needs update 22; deploy the new leads function too).
-- Paste in Supabase SQL Editor and Run. Safe to run again.
set search_path = timbro, extensions;

alter table leads add column if not exists instagram text not null default '';

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
  stripe_sync(text, text, text, text, text, bigint, boolean), stripe_is_admin(uuid), alert_key_ok(text),
  leads_add(jsonb), leads_list(text), leads_get(text), leads_set(text, text) to service_role;
