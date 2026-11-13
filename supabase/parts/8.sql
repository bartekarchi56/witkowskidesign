-- Timbro database, part 8 of 12. Run the parts in order.
set search_path = timbro, extensions;

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

alter table businesses add column if not exists billing_free boolean not null default false;

create or replace function _biz_live(p_biz uuid) returns boolean
language sql stable security definer set search_path = timbro
as $$
  select exists (select 1 from businesses b where b.id = p_biz and (
    b.billing_free
    or b.billing_status in ('trialing', 'active', 'past_due', 'unpaid', 'paused')
    or not exists (select 1 from auth.users u where u.id = b.owner_id)
    or exists (select 1 from admins a where a.user_id = b.owner_id)
    or exists (select 1 from cards c where c.business_id = b.id and c.plan = 'chain')))
$$;

create or replace function _billing_json(b businesses) returns jsonb
language sql stable
as $$
  select jsonb_build_object('status', b.billing_status, 'plan', b.billing_plan, 'interval', b.billing_interval,
    'periodEnd', (extract(epoch from b.billing_period_end) * 1000)::bigint, 'trialUsed', b.trial_used,
    'customer', b.stripe_customer is not null, 'canceling', b.billing_canceling, 'live', _biz_live(b.id))
$$;

create or replace function _need_plan() returns trigger
language plpgsql security definer set search_path = timbro
as $$
declare v_biz uuid;
begin
  if tg_table_name = 'customers' then
    select business_id into v_biz from cards where id = new.card_id;
  elsif tg_table_name = 'events' then
    if new.type not in ('stamp', 'redeem', 'gift', 'bonus', 'friend') then return new; end if;
    select c.business_id into v_biz from customers m join cards c on c.id = m.card_id where m.id = new.customer_id;
  else
    v_biz := new.business_id;
  end if;
  if v_biz is not null and not _biz_live(v_biz) then
    raise exception 'PLAN_REQUIRED: the café must choose a plan before using the card';
  end if;
  return new;
end $$;

drop trigger if exists need_plan on customers;

create trigger need_plan before insert on customers for each row execute function _need_plan();
drop trigger if exists need_plan on events;

create trigger need_plan before insert on events for each row execute function _need_plan();
drop trigger if exists need_plan on devices;

create trigger need_plan before insert on devices for each row execute function _need_plan();
drop trigger if exists need_plan on link_codes;

create trigger need_plan before insert on link_codes for each row execute function _need_plan();

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
