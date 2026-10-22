-- Timbro database, part 6 of 8. Run the parts in order.
set search_path = timbro, extensions;

create or replace function admin_publish(p_card_id text, p_design jsonb) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare c cards;
begin
  if not _is_admin() then raise exception 'Only Witkowski Design can publish designs.' using errcode = '42501'; end if;
  update cards set design = design || _clean_design(p_design),
    review = jsonb_build_object('status', 'approved', 'at', (extract(epoch from now()) * 1000)::bigint, 'reply', ''),
    updated_at = now()
  where id = lower(p_card_id) returning * into c;
  return _card_json(c, true);
end $$;

create or replace function admin_ask_changes(p_card_id text, p_reply text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare c cards;
begin
  if not _is_admin() then raise exception 'Only Witkowski Design can reply.' using errcode = '42501'; end if;
  update cards set review = coalesce(review, '{}'::jsonb) || jsonb_build_object('status', 'changes', 'reply', left(coalesce(p_reply, ''), 2000), 'at', (extract(epoch from now()) * 1000)::bigint)
  where id = lower(p_card_id) returning * into c;
  return _card_json(c, true);
end $$;

create or replace function admin_set_plan(p_card_id text, p_plan text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare c cards;
begin
  if not _is_admin() then raise exception 'Only Witkowski Design can change plans.' using errcode = '42501'; end if;
  update cards set plan = p_plan where id = lower(p_card_id) returning * into c;
  return _card_json(c, true);
end $$;

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
    'lng', case when k = 'near' and m->k->>'lng' ~ '^-?[0-9]{1,3}(\.[0-9]{1,7})?$' and abs((m->k->>'lng')::numeric) <= 180 then (m->k->>'lng')::numeric end
  ))), '{}'::jsonb)
  from unnest(array['close', 'ready', 'remind', 'near']) k
  where jsonb_typeof(m->k) = 'object'
$$;

create or replace function owner_save_messages(p_card_id text, p_messages jsonb) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare c cards;
begin
  if auth.uid() is null then raise exception 'Not logged in.' using errcode = '28000'; end if;
  update cards set messages = _clean_messages(p_messages), updated_at = now()
  where id = lower(p_card_id) and business_id = _my_business() returning * into c;
  if not found then raise exception 'This card belongs to another café.' using errcode = '42501'; end if;
  return _card_json(c, true);
end $$;

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

alter table businesses add column if not exists stripe_customer     text;

alter table businesses add column if not exists stripe_subscription text;

alter table businesses add column if not exists billing_status      text not null default '';  -- trialing, active, past_due, canceled...
