-- Timbro update 13 (October 2026): one message to all customers.
-- The owner writes it in the dashboard (Notifications), at most once a day; every
-- customer's Wallet card shows it with a notification. Needs the wallet server (POST /news).
-- Run after update 12 (or 11). Paste in Supabase SQL Editor and Run. Safe to run again.
set search_path = timbro, extensions;

alter table cards add column if not exists news text not null default '';
alter table cards add column if not exists news_at timestamptz;

create or replace function _card_json(c cards, with_review boolean default false) returns jsonb
language sql stable
as $$
  select c.design || jsonb_build_object(
    'id', c.id, 'business', c.business, 'city', c.city, 'type', c.type,
    'title', c.title, 'reward', c.reward, 'titleEn', c.title_en, 'rewardEn', c.reward_en, 'lang', c.lang,
    'stampsNeeded', c.stamps_needed, 'plan', c.plan, 'messages', c.messages,
    'news', c.news, 'newsAt', (extract(epoch from c.news_at) * 1000)::bigint,
    'createdAt', (extract(epoch from c.created_at) * 1000)::bigint,
    'updatedAt', (extract(epoch from c.updated_at) * 1000)::bigint
  ) || case when with_review and c.review is not null then jsonb_build_object('review', c.review) else '{}'::jsonb end
$$;

-- A message to all customers ("Fresh cornetti this morning!", "New: Matcha Maple Apple"):
-- the owner sends it from the dashboard, at most once a day. Each customer's Wallet card
-- shows it for 3 days (CONFIG.newsHours); the card's updated_at makes iPhones fetch the new pass.
create or replace function owner_send_news(p_card_id text, p_text text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare c cards; v_text text := left(trim(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]]', ' ', 'g')), 140);
begin
  if auth.uid() is null then raise exception 'Not logged in.' using errcode = '28000'; end if;
  if v_text = '' then raise exception 'Write a message first.' using errcode = '22023'; end if;
  select * into c from cards where id = lower(p_card_id) and business_id = _my_business();
  if not found then raise exception 'This card belongs to another café.' using errcode = '42501'; end if;
  if c.news_at > now() - interval '20 hours' then raise exception 'One message a day: you can send the next one tomorrow.' using errcode = 'P0001'; end if;
  update cards set news = v_text, news_at = now(), updated_at = now() where id = c.id returning * into c;
  return _card_json(c, true);
end $$;

-- Right after sending, the wallet server (POST /news, as the owner) gets the phones to wake:
-- every customer of the card with their Apple push tokens, for 15 minutes after the message.
create or replace function owner_news_targets(p_card_id text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare c cards;
begin
  select * into c from cards where id = lower(p_card_id) and business_id = _my_business() and news_at > now() - interval '15 minutes';
  if not found then return null; end if;
  return jsonb_build_object('card', _card_json(c), 'customers', coalesce((select jsonb_agg(jsonb_build_object('customer', _customer_json(m, 0),
      'pushTokens', coalesce((select jsonb_agg(w.push_token) from wallet_devices w where w.customer_id = m.id), '[]'::jsonb)))
    from (select * from customers where card_id = c.id order by last_visit desc nulls last limit 5000) m), '[]'::jsonb));
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
