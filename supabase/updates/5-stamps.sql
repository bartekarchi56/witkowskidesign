-- Timbro update 5 (October 2026): the standard stamps.
-- Cards remember which of the six stamps they use (design.stamp).
-- Paste in Supabase SQL Editor and Run. Safe to run again.
set search_path = timbro, extensions;

-- The design keys the website uses (assets/js/store.js DESIGN_KEYS).
create or replace function _clean_design(d jsonb) returns jsonb
language sql immutable
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from jsonb_each(coalesce(d, '{}'::jsonb))
  where key in ('style','color','ink','stamp','shape','mark','markText','empty','font','strip','tagline','icon','logo','stampImage','stripImage')
    and octet_length(value::text) < 1200000
$$;

grant usage on schema timbro to anon, authenticated;

revoke all on all tables in schema timbro from anon, authenticated;

revoke execute on all functions in schema timbro from public, anon, authenticated;

grant execute on function get_card(text), join_card(text, text), get_my_card(text, text),
  device_link(text, text), stamper_lookup(text, text), stamper_stamp(text, text, int), stamper_redeem(text, text)
  to anon, authenticated;

grant execute on function owner_data(), owner_save_card(jsonb), owner_save_messages(text, jsonb), owner_send_design(text, text, jsonb, text, jsonb, jsonb),
  owner_link_code(), owner_remove_device(uuid),
  admin_cards(), admin_publish(text, jsonb), admin_ask_changes(text, text), admin_set_plan(text, text)
  to authenticated;

grant usage on schema timbro to service_role;

grant execute on function stripe_business(uuid), stripe_set_customer(uuid, text),
  stripe_sync(text, text, text, text, text, bigint, boolean), stripe_is_admin(uuid) to service_role;
