-- Timbro update 14c: extras, part 3 of 3. What a customer's card knows about the extras:
-- birthday gift due, last friend bonus and reward, friends who joined with their invite.
set search_path = timbro, extensions;

create or replace function _customer_json(m customers, history_limit int default 5) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'id', m.id, 'cardId', m.card_id, 'name', m.name, 'stamps', m.stamps, 'redeemed', m.redeemed,
    'joinedAt', (extract(epoch from m.joined_at) * 1000)::bigint,
    'lastVisit', (extract(epoch from m.last_visit) * 1000)::bigint,
    'remindedAt', (extract(epoch from m.reminded_at) * 1000)::bigint,
    -- Extras: birthday gift due now; when a friend's bonus and the last reward came (ms); friends who joined with their invite.
    'birthday', _birthday_now(m),
    'lastFriend', (select (extract(epoch from max(created_at)) * 1000)::bigint from events where customer_id = m.id and type = 'friend'),
    'lastRedeem', (select (extract(epoch from max(created_at)) * 1000)::bigint from events where customer_id = m.id and type = 'redeem'),
    'friends', (select count(*) from customers f where f.referred_by = m.id and f.ref_paid),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('t', (extract(epoch from e.created_at) * 1000)::bigint, 'type', e.type, 'n', e.n)
        || case when dv.location <> '' then jsonb_build_object('at', dv.location) else '{}'::jsonb end order by e.created_at)
      from (select * from events where customer_id = m.id order by created_at desc limit history_limit) e
      left join devices dv on dv.id = e.device_id
    ), '[]'::jsonb)
  )
$$;

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
  stripe_sync(text, text, text, text, text, bigint, boolean), stripe_is_admin(uuid) to service_role;
