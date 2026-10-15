-- Timbro database, part 6 of 8. Run the parts in order.
set search_path = timbro, extensions;

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

create or replace function stripe_is_admin(p_user uuid) returns boolean
language sql stable security definer set search_path = timbro
as $$ select exists (select 1 from admins where user_id = p_user) $$;

create or replace function stripe_set_customer(p_business uuid, p_customer text) returns void
language sql security definer set search_path = timbro
as $$ update businesses set stripe_customer = p_customer where id = p_business and stripe_customer is null $$;

drop function if exists stripe_sync(text, text, text, text, text, bigint);   -- older version without p_canceling
