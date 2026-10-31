-- Timbro update 14b: extras, part 2 of 3. Double-stamp hours, the extras' settings,
-- and stamping with extra stamps (a visit stays one 'stamp' event; extras are 'bonus').
set search_path = timbro, extensions;

-- Double-stamp hours (messages.double): on, the weekdays (1 = Monday) and the hours [from, to), café time.
create or replace function _double_now(c cards) returns boolean
language sql stable set search_path = timbro
as $$
  select coalesce((c.messages->'double'->>'on')::boolean, false)
    and coalesce(c.messages->'double'->'week', '[]'::jsonb) @> to_jsonb(extract(isodow from l)::int)
    and extract(hour from l) >= coalesce((c.messages->'double'->>'from')::int, 15)
    and extract(hour from l) < coalesce((c.messages->'double'->>'to')::int, 17)
  from (select now() at time zone case c.lang when 'pl' then 'Europe/Warsaw' else 'Europe/Rome' end as l) t
$$;

-- -------------------------------------------------------------- messages --
-- The café's own notification texts (Wallet passes and the web card):
-- close (1-3 stamps to go), ready (reward ready), remind (no visit for N
-- days) and near (lock screen near the café). Each has on, it, en, pl.
-- Extras, all off until the café switches them on: friend (Bring a friend), double
-- (double-stamp hours: week, from, to), birthday (gift in the birthday week), review (Google link).
-- (The column itself is added with the tables, above.)
create or replace function _clean_messages(m jsonb) returns jsonb
language sql immutable
as $$
  select coalesce(jsonb_object_agg(k, jsonb_strip_nulls(jsonb_build_object(
    'on', coalesce(m->k->>'on', '') = 'true',
    'it', left(m->k->>'it', 140),
    'en', left(m->k->>'en', 140),
    'pl', left(m->k->>'pl', 140),
    'left', case when k = 'close' then greatest(1, least(3, coalesce(nullif(regexp_replace(m->k->>'left', '[^0-9]', '', 'g'), '')::int, 1))) end,
    'days', case when k = 'remind' then greatest(7, least(90, coalesce(nullif(regexp_replace(m->k->>'days', '[^0-9]', '', 'g'), '')::int, 21))) end,
    'lat', case when k = 'near' and m->k->>'lat' ~ '^-?[0-9]{1,2}(\.[0-9]{1,7})?$' and abs((m->k->>'lat')::numeric) <= 90 then (m->k->>'lat')::numeric end,
    'lng', case when k = 'near' and m->k->>'lng' ~ '^-?[0-9]{1,3}(\.[0-9]{1,7})?$' and abs((m->k->>'lng')::numeric) <= 180 then (m->k->>'lng')::numeric end,
    'week', case when k = 'double' then (select jsonb_agg(x order by x) from (select distinct (v #>> '{}')::int x
      from jsonb_array_elements(case when jsonb_typeof(m->k->'week') = 'array' then m->k->'week' else '[]'::jsonb end) v where v #>> '{}' ~ '^[1-7]$') w) end,
    'from', case when k = 'double' then greatest(0, least(23, coalesce(nullif(regexp_replace(m->k->>'from', '[^0-9]', '', 'g'), '')::int, 15))) end,
    'to', case when k = 'double' then greatest(1, least(24, coalesce(nullif(regexp_replace(m->k->>'to', '[^0-9]', '', 'g'), '')::int, 17))) end,
    'url', case when k = 'review' and m->k->>'url' ~ '^https://[^[:space:]<>"]{4,}$' and length(m->k->>'url') <= 300 then m->k->>'url' end
  ))), '{}'::jsonb)
  from unnest(array['close', 'ready', 'remind', 'near', 'friend', 'double', 'birthday', 'review']) k
  where jsonb_typeof(m->k) = 'object'
$$;

-- A visit adds one stamp ('stamp' event). Extras add more, as a 'bonus' event: one more in the
-- café's double-stamp hours, and on a friend's first stamp one more for them and one for whoever
-- invited them. Returns extra: { double, friend: the inviter's code (their Wallet card is woken too) }.
create or replace function stamper_stamp(p_token text, p_code text, p_delta int) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare d devices := _device(p_token); m customers; c cards; v_next int; v_extra int := 0; v_double boolean := false; v_friend text;
begin
  select m2.* into m from customers m2 join cards c2 on c2.id = m2.card_id
  where m2.id = upper(trim(p_code)) and c2.business_id = d.business_id for update of m2;
  if not found then raise exception 'No customer with that code.' using errcode = 'P0002'; end if;
  select * into c from cards where id = m.card_id;
  if p_delta > 0 and m.stamps < c.stamps_needed then
    v_double := _double_now(c);
    if v_double then v_extra := 1; end if;
    if m.referred_by is not null and not m.ref_paid and coalesce((c.messages->'friend'->>'on')::boolean, false)
       and not exists (select 1 from events where customer_id = m.id and type = 'stamp') then   -- their very first stamp only
      v_extra := v_extra + 1;
      update customers set ref_paid = true where id = m.id;
      update customers set stamps = stamps + 1 where id = m.referred_by and card_id = m.card_id and stamps < c.stamps_needed returning id into v_friend;
      if v_friend is not null then insert into events (customer_id, device_id, type, n) values (v_friend, d.id, 'friend', 1); end if;
    end if;
  end if;
  v_next := greatest(0, least(c.stamps_needed, m.stamps + case when p_delta > 0 then 1 + v_extra else -1 end));
  if v_next <> m.stamps then
    insert into events (customer_id, device_id, type, n) values (m.id, d.id, case when p_delta > 0 then 'stamp' else 'unstamp' end, 1);
    if v_next - m.stamps > 1 then insert into events (customer_id, device_id, type, n) values (m.id, d.id, 'bonus', v_next - m.stamps - 1); end if;
    update customers set stamps = v_next, last_visit = now() where id = m.id returning * into m;
  end if;
  return jsonb_build_object('customer', _customer_json(m), 'card', _card_json(c), 'extra', jsonb_build_object('double', v_double, 'friend', v_friend));
end $$;

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
