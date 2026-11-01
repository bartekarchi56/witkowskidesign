-- Timbro update 17 (November 2026): the café's owner gets an email when Witkowski Design approves
-- their card's design or asks them for a change (needs updates 15-16; deploy the new admin-alert too).
-- Paste in Supabase SQL Editor and Run. Safe to run again.
set search_path = timbro, extensions;

-- A café sent a design for approval, or asked Witkowski Design for a change (owner_send_design):
-- Witkowski Design is told. Witkowski Design approved a design (admin_publish) or asked the café
-- for a change (admin_ask_changes): the café's owner is told, in the card's language.
create or replace function _alert_design() returns trigger
language plpgsql security definer set search_path = timbro
as $$
declare v_status text := new.review->>'status';
begin
  if v_status = 'pending' and (old.review is null or old.review->>'sentAt' is distinct from new.review->>'sentAt') then
    perform _alert('design', new.business_id, jsonb_build_object('card', new.id, 'cardName', new.business,
      'request', new.review->>'kind' = 'request', 'note', left(new.review->>'note', 600),
      'images', jsonb_array_length(coalesce(new.review->'images', '[]'::jsonb))));
  elsif v_status in ('approved', 'changes') and (old.review is null or old.review->>'status' is distinct from v_status or old.review->>'at' is distinct from new.review->>'at') then
    perform _alert(v_status, new.business_id, jsonb_build_object('card', new.id, 'cardName', new.business, 'lang', new.lang,
      'reply', left(new.review->>'reply', 600)));
  end if;
  return new;
end $$;
drop trigger if exists alert_design on cards;
create trigger alert_design after update of review on cards for each row execute function _alert_design();

grant usage on schema timbro to anon, authenticated;
revoke all on all tables in schema timbro from anon, authenticated;
revoke execute on all functions in schema timbro from public, anon, authenticated;

grant execute on function get_card(text), join_card(text, text, text, text, date, boolean, text), get_my_card(text, text),
  device_link(text, text), stamper_lookup(text, text), stamper_stamp(text, text, int), stamper_redeem(text, text), stamper_gift(text, text),
  wallet_register(text, text, text, text), wallet_unregister(text, text, text), wallet_updated(text, bigint), wallet_targets(text, text), reminders_due(text)
  to anon, authenticated;

grant execute on function owner_data(), owner_save_card(jsonb), owner_save_messages(text, jsonb), owner_send_design(text, text, jsonb, text, jsonb, jsonb),
  owner_link_code(), owner_remove_device(uuid), owner_set_device_location(uuid, text), owner_send_news(text, text), owner_news_targets(text),
  admin_cards(), admin_publish(text, jsonb), admin_ask_changes(text, text), admin_set_plan(text, text)
  to authenticated;

-- The Stripe functions (supabase/functions/) use the service role.
grant usage on schema timbro to service_role;
grant execute on function stripe_business(uuid), stripe_set_customer(uuid, text),
  stripe_sync(text, text, text, text, text, bigint, boolean), stripe_is_admin(uuid), alert_key_ok(text) to service_role;
