-- Timbro database, part 9 of 10. Run the parts in order.
set search_path = timbro, extensions;

create or replace function reminders_due(p_key text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare v_ids text[];
begin
  if not exists (select 1 from job_keys where name = 'reminders' and key = coalesce(p_key, '')) then
    raise exception 'Wrong key' using errcode = '28000';
  end if;
  select array_agg(id) into v_ids from (
    select m.id from customers m join cards c on c.id = m.card_id
    where coalesce((c.messages->'remind'->>'on')::boolean, true)
      and m.stamps < c.stamps_needed
      and coalesce(m.last_visit, m.joined_at) < now() - make_interval(days => coalesce((c.messages->'remind'->>'days')::int, 21))
      and (m.reminded_at is null or m.reminded_at < coalesce(m.last_visit, m.joined_at))
    order by m.id limit 300
  ) due;
  update customers set reminded_at = now() where id = any(v_ids);
  return coalesce((select jsonb_agg(jsonb_build_object('card', _card_json(c), 'customer', _customer_json(m, 0),
      'pushTokens', coalesce((select jsonb_agg(w.push_token) from wallet_devices w where w.customer_id = m.id), '[]'::jsonb)))
    from customers m join cards c on c.id = m.card_id where m.id = any(v_ids)), '[]'::jsonb);
end $$;

do $$ begin create extension if not exists pg_net; exception when others then raise notice 'pg_net not available: no alerts'; end $$;

create table if not exists settings (name text primary key, value text not null default '');

alter table settings enable row level security;

insert into job_keys (name) values ('alerts') on conflict (name) do nothing;

create or replace function _alert(p_kind text, p_business uuid) returns void
language plpgsql security definer set search_path = timbro, extensions
as $$
declare v_url text := (select value from settings where name = 'alerts_url'); v_data jsonb;
begin
  if coalesce(v_url, '') = '' then return; end if;
  select jsonb_build_object('business', b.name, 'contact', b.contact_name, 'email', u.email, 'phone', b.phone, 'city', b.city,
      'address', b.address, 'instagram', b.instagram, 'type', b.kind, 'plan', b.billing_plan, 'interval', b.billing_interval,
      'periodEnd', b.billing_period_end, 'cards', (select coalesce(jsonb_agg(c.id order by c.created_at), '[]'::jsonb) from cards c where c.business_id = b.id))
    into v_data from businesses b left join auth.users u on u.id = b.owner_id where b.id = p_business;
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

grant usage on schema timbro to anon, authenticated;

revoke all on all tables in schema timbro from anon, authenticated;

revoke execute on all functions in schema timbro from public, anon, authenticated;
