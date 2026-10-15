-- Timbro database, part 7 of 8. Run the parts in order.
set search_path = timbro, extensions;

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

create or replace function stripe_sync(p_customer text, p_subscription text, p_status text, p_plan text, p_interval text, p_period_end bigint,
  p_canceling boolean default false)
returns uuid
language plpgsql security definer set search_path = timbro
as $$
declare v_biz uuid;
begin
  update businesses set stripe_subscription = p_subscription, billing_status = coalesce(p_status, ''),
    billing_plan = coalesce(p_plan, ''), billing_interval = coalesce(p_interval, ''),
    billing_period_end = case when p_period_end is null then null else to_timestamp(p_period_end) end,
    trial_used = trial_used or p_status is not null, billing_canceling = coalesce(p_canceling, false)
  where stripe_customer = p_customer returning id into v_biz;
  if v_biz is not null and p_status in ('trialing', 'active', 'past_due') and p_plan in ('start', 'plus', 'pro') then
    update cards set plan = p_plan where business_id = v_biz;
  end if;
  return v_biz;
end $$;

create table if not exists wallet_devices (
  device_id    text not null,
  customer_id  text not null references customers(id) on delete cascade,
  push_token   text not null,
  created_at   timestamptz not null default now(),
  primary key (device_id, customer_id)
);

create or replace function _pass_updated(m customers) returns bigint
language sql stable set search_path = timbro
as $$
  select (extract(epoch from greatest(m.joined_at, c.updated_at, m.reminded_at,
    coalesce((select max(e.created_at) from events e where e.customer_id = m.id), m.joined_at))) * 1000)::bigint
  from cards c where c.id = m.card_id
$$;

create or replace function wallet_register(p_code text, p_secret text, p_device text, p_push text) returns int
language plpgsql security definer set search_path = timbro
as $$
declare v_id text;
begin
  select id into v_id from customers where id = upper(p_code) and secret_hash = _hash(p_secret);
  if not found then return 401; end if;
  if length(coalesce(p_device, '')) not between 1 and 200 or length(coalesce(p_push, '')) not between 1 and 200 then return 400; end if;
  update wallet_devices set push_token = p_push where device_id = p_device and customer_id = v_id;
  if found then return 200; end if;
  insert into wallet_devices (device_id, customer_id, push_token) values (p_device, v_id, p_push);
  return 201;
end $$;

create or replace function wallet_unregister(p_code text, p_secret text, p_device text) returns int
language plpgsql security definer set search_path = timbro
as $$
begin
  if not exists (select 1 from customers where id = upper(p_code) and secret_hash = _hash(p_secret)) then return 401; end if;
  delete from wallet_devices where device_id = p_device and customer_id = upper(p_code);
  return 200;
end $$;

create or replace function wallet_updated(p_device text, p_since bigint) returns jsonb
language sql stable security definer set search_path = timbro
as $$
  select jsonb_build_object('serialNumbers', coalesce(jsonb_agg(c.id || '-' || m.id), '[]'::jsonb),
    'lastUpdated', coalesce(max(_pass_updated(m)), 0)::text)
  from wallet_devices w join customers m on m.id = w.customer_id join cards c on c.id = m.card_id
  where w.device_id = p_device and _pass_updated(m) > coalesce(p_since, 0)
$$;

create or replace function wallet_targets(p_token text, p_code text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare d devices := _device(p_token);
begin
  return coalesce((select jsonb_agg(w.push_token) from wallet_devices w join customers m on m.id = w.customer_id
    join cards c on c.id = m.card_id where m.id = upper(trim(p_code)) and c.business_id = d.business_id), '[]'::jsonb);
end $$;
