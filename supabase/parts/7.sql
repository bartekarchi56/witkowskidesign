-- Timbro database, part 7 of 10. Run the parts in order.
set search_path = timbro, extensions;

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

alter table businesses add column if not exists billing_plan        text not null default '';  -- start, plus, pro

alter table businesses add column if not exists billing_interval    text not null default '';  -- month, year

alter table businesses add column if not exists billing_period_end  timestamptz;

alter table businesses add column if not exists trial_used          boolean not null default false;

alter table businesses add column if not exists billing_canceling   boolean not null default false;  -- cancelled, ends at billing_period_end

create unique index if not exists businesses_stripe_customer on businesses(stripe_customer);

create or replace function _billing_json(b businesses) returns jsonb
language sql stable
as $$
  select jsonb_build_object('status', b.billing_status, 'plan', b.billing_plan, 'interval', b.billing_interval,
    'periodEnd', (extract(epoch from b.billing_period_end) * 1000)::bigint, 'trialUsed', b.trial_used,
    'customer', b.stripe_customer is not null, 'canceling', b.billing_canceling)
$$;

create or replace function stripe_business(p_user uuid) returns jsonb
language sql stable security definer set search_path = timbro
as $$
  select jsonb_build_object('id', b.id, 'name', b.name, 'email', u.email, 'phone', b.phone,
    'customer', b.stripe_customer, 'subscription', b.stripe_subscription, 'status', b.billing_status, 'trialUsed', b.trial_used)
  from businesses b left join auth.users u on u.id = b.owner_id where b.owner_id = p_user
$$;
