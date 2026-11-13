-- Timbro database, part 10 of 12. Run the parts in order.
set search_path = timbro, extensions;

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

alter table businesses add column if not exists signup_alerted boolean not null default true;

alter table businesses alter column signup_alerted set default false;

create or replace function _alert_card() returns trigger
language plpgsql security definer set search_path = timbro
as $$
begin
  if new.business <> '' then
    update businesses set signup_alerted = true, name = case when name = '' then new.business else name end
    where id = new.business_id and not signup_alerted;
    if found then perform _alert('signup', new.business_id); end if;
  end if;
  return new;
end $$;
drop trigger if exists alert_card on cards;

create trigger alert_card after insert or update of business on cards for each row execute function _alert_card();

create or replace function _alert_design() returns trigger
language plpgsql security definer set search_path = timbro
as $$
declare v_status text := new.review->>'status';
begin
  if v_status = 'pending' and (old.review is null or old.review->>'sentAt' is distinct from new.review->>'sentAt') then
    perform _alert('design', new.business_id, jsonb_build_object('card', new.id, 'cardName', new.business,
      'request', new.review->>'kind' = 'request', 'note', left(new.review->>'note', 600),
      'images', jsonb_array_length(coalesce(new.review->'images', '[]'::jsonb))));
  elsif v_status in ('approved', 'changes') and (old.review is null or old.review->>'status' is distinct from v_status or old.review->>'at' is distinct from new.review->>'at') then
    perform _alert(v_status, new.business_id, jsonb_build_object('card', new.id, 'cardName', new.business, 'lang', new.lang,
      'reply', left(new.review->>'reply', 600)));
  end if;
  return new;
end $$;
drop trigger if exists alert_design on cards;

create trigger alert_design after update of review on cards for each row execute function _alert_design();

create or replace function _alert_billing() returns trigger
language plpgsql security definer set search_path = timbro
as $$
declare v_kind text;
begin
  if new.billing_status is distinct from old.billing_status then
    v_kind := case new.billing_status when 'trialing' then 'trial' when 'active' then 'paying' when 'past_due' then 'failed'
      when 'unpaid' then 'failed' when 'canceled' then 'ended' end;
  elsif new.billing_canceling and not old.billing_canceling then v_kind := 'canceling';
  end if;
  if v_kind is not null then perform _alert(v_kind, new.id); end if;
  return new;
end $$;
drop trigger if exists alert_billing on businesses;

create trigger alert_billing after update of billing_status, billing_canceling on businesses for each row execute function _alert_billing();

create or replace function alert_key_ok(p_key text) returns boolean
language sql stable security definer set search_path = timbro
as $$ select exists (select 1 from job_keys where name = 'alerts' and key = coalesce(p_key, '')) $$;

create table if not exists online_orders (
  card_id   text not null references cards(id) on delete cascade,
  platform  text not null check (platform in ('wolt', 'ubereats', 'glovo', 'deliveroo')),
  order_id  text not null check (length(order_id) between 1 and 80),
  at        timestamptz not null,
  total     numeric(10,2) not null check (total >= 0 and total < 100000),
  currency  text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  primary key (card_id, platform, order_id)
);

alter table online_orders enable row level security;
