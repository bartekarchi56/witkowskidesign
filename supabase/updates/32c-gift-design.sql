-- Gift cards, part 3: the card's own look (logo, background picture, text and background colour),
-- kept with the other gift settings. Pictures are small data URLs (the dashboard shrinks them first).
set search_path = timbro;

create or replace function owner_gift_save(p_gift jsonb) returns jsonb language plpgsql security definer set search_path = timbro as $$
declare v_biz uuid := _my_business(); v_am jsonb; d jsonb := coalesce(p_gift->'design', '{}'); v_design jsonb;
begin
  if v_biz is null then raise exception 'Create your card first.' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('amount', least(greatest((a->>'amount')::int, 100), 100000), 'bonus', least(greatest(coalesce((a->>'bonus')::int, 0), 0), 100000))), '[]')
    into v_am from jsonb_array_elements(coalesce(p_gift->'amounts', '[]')) a where (a->>'amount') ~ '^\d+$';
  v_design := jsonb_strip_nulls(jsonb_build_object(
    'color', case when d->>'color' ~ '^#[0-9A-Fa-f]{6}$' then d->>'color' end,
    'text',  case when d->>'text'  ~ '^#[0-9A-Fa-f]{6}$' then d->>'text' end,
    'logo',  case when d->>'logo' ~ '^data:image/(png|jpeg|webp);base64,' and length(d->>'logo') < 300000 then d->>'logo' end,
    'bg',    case when d->>'bg'   ~ '^data:image/(png|jpeg|webp);base64,' and length(d->>'bg')   < 500000 then d->>'bg' end));
  update businesses set gift = jsonb_build_object('on', coalesce((p_gift->>'on')::boolean, false), 'amounts', v_am,
    'months', least(greatest(coalesce((p_gift->>'months')::int, 12), 1), 60), 'design', v_design) where id = v_biz;
  return (select jsonb_build_object('gift', gift, 'connected', stripe_account is not null) from businesses where id = v_biz);
end $$;

-- A card shows its café's gift design too.
create or replace function _voucher_json(v vouchers) returns jsonb language sql stable set search_path = timbro as $$
  select jsonb_build_object('code', v.id, 'amount', v.amount, 'bonus', v.bonus, 'balance', v.balance, 'recipient', v.recipient,
    'note', v.note, 'expires', v.expires_at, 'expired', coalesce(v.expires_at < now(), false), 'business', b.name, 'businessId', b.id,
    'design', coalesce(b.gift->'design', '{}'),
    'card', (select _card_json(c) from cards c where c.business_id = b.id order by c.created_at limit 1))
  from businesses b where b.id = v.business_id $$;

-- ----------------------------------------------------------- permissions --

-- Only inside the timbro schema: other apps in this project are not touched.
grant usage on schema timbro to anon, authenticated;
revoke all on all tables in schema timbro from anon, authenticated;
revoke execute on all functions in schema timbro from public, anon, authenticated;

grant execute on function get_card(text), join_card(text, text, text, text, date, boolean, text), get_my_card(text, text),
  device_link(text, text), stamper_lookup(text, text), stamper_stamp(text, text, int), stamper_redeem(text, text), stamper_gift(text, text),
  gift_shop(uuid), gift_get(text), stamper_voucher(text, text), stamper_voucher_spend(text, text, int), gift_by_session(text),
  wallet_register(text, text, text, text), wallet_unregister(text, text, text), wallet_updated(text, bigint), wallet_targets(text, text), reminders_due(text)
  to anon, authenticated;

grant execute on function owner_data(), owner_save_card(jsonb), owner_save_messages(text, jsonb), owner_send_design(text, text, jsonb, text, jsonb, jsonb),
  owner_link_code(), owner_remove_device(uuid), owner_set_device_location(uuid, text), owner_send_news(text, text), owner_news_targets(text),
  owner_import_orders(text, jsonb), owner_online_orders(text), owner_clear_orders(text, text), owner_gift_save(jsonb), owner_gifts(),
  admin_cards(), admin_publish(text, jsonb), admin_ask_changes(text, text), admin_set_plan(text, text)
  to authenticated;

-- The Stripe functions (supabase/functions/) use the service role.
grant usage on schema timbro to service_role;
grant execute on function stripe_business(uuid), stripe_set_customer(uuid, text),
  stripe_sync(text, text, text, text, text, bigint, boolean), stripe_is_admin(uuid), alert_key_ok(text),
  leads_add(jsonb), leads_list(text), leads_get(text), leads_set(text, text), leads_update(text, text, text, text),
  gift_set_account(uuid, text), gift_account(uuid), gift_seller(uuid), gift_create(text, uuid, int, int, text, text, text, int), gift_get(text) to service_role;
