-- Timbro update 16 (November 2026): an email alert when a café sends a design for approval
-- or asks for a change (needs update 15 and the admin-alert function: deploy its new version too).
-- Paste in Supabase SQL Editor and Run. Safe to run again.
set search_path = timbro, extensions;

-- p_extra: more for the email (a design sent for approval: the card, its note).
drop function if exists _alert(text, uuid);
create or replace function _alert(p_kind text, p_business uuid, p_extra jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = timbro, extensions
as $$
declare v_url text := (select value from settings where name = 'alerts_url'); v_data jsonb;
begin
  if coalesce(v_url, '') = '' then return; end if;
  select jsonb_build_object('business', b.name, 'contact', b.contact_name, 'email', u.email, 'phone', b.phone, 'city', b.city,
      'address', b.address, 'instagram', b.instagram, 'type', b.kind, 'plan', b.billing_plan, 'interval', b.billing_interval,
      'periodEnd', b.billing_period_end, 'cards', (select coalesce(jsonb_agg(c.id order by c.created_at), '[]'::jsonb) from cards c where c.business_id = b.id))
    into v_data from businesses b left join auth.users u on u.id = b.owner_id where b.id = p_business;
  v_data := v_data || coalesce(p_extra, '{}'::jsonb);
  begin
    perform net.http_post(url := v_url, body := jsonb_build_object('key', (select key from job_keys where name = 'alerts'), 'kind', p_kind, 'data', v_data));
  exception when others then raise warning 'alert not sent: %', sqlerrm;
  end;
end $$;

-- A café sent a design for approval, or asked Witkowski Design for a change (owner_send_design).
create or replace function _alert_design() returns trigger
language plpgsql security definer set search_path = timbro
as $$
begin
  if new.review->>'status' = 'pending' and (old.review is null or old.review->>'sentAt' is distinct from new.review->>'sentAt') then
    perform _alert('design', new.business_id, jsonb_build_object('card', new.id, 'cardName', new.business,
      'request', new.review->>'kind' = 'request', 'note', left(new.review->>'note', 600),
      'images', jsonb_array_length(coalesce(new.review->'images', '[]'::jsonb))));
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
