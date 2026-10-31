-- Timbro update 14a (November 2026): extras, part 1 of 3 (run 14a, 14b, 14c in order).
-- Bring a friend (invite links), double-stamp hours, a birthday gift and a Google review link,
-- all off until the café switches them on (dashboard → Notifications). This part: who invited
-- whom, the birthday gift, and joining with an invite. Paste in Supabase SQL Editor and Run.
set search_path = timbro, extensions;

alter table customers add column if not exists referred_by text references customers(id) on delete set null;
alter table customers add column if not exists ref_paid    boolean not null default false;  -- the friend bonus was given
alter table customers add column if not exists gift_at     timestamptz;                     -- last birthday gift
alter table events drop constraint if exists events_type_check;
alter table events add constraint events_type_check check (type in ('joined','stamp','unstamp','redeem','bonus','friend','gift'));

-- In the week from their birthday (0-6 days after) and no birthday gift since then.
create or replace function _birthday_now(m customers) returns boolean
language sql stable set search_path = timbro
as $$
  select m.birth_date is not null and current_date - b between 0 and 6 and (m.gift_at is null or m.gift_at::date < b)
  from (select (m.birth_date + make_interval(years => date_part('year', age(current_date, m.birth_date))::int))::date as b) t
$$;

-- A customer joins with full name, email, mobile number and date of birth.
-- p_ref: the code of the customer who invited them (Bring a friend), from the invite link.
drop function if exists join_card(text, text);
drop function if exists join_card(text, text, text, text, date, boolean);
create or replace function join_card(p_card_id text, p_name text, p_email text default '', p_phone text default '',
  p_birth date default null, p_marketing boolean default false, p_ref text default null) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare
  v_code text; v_secret text := _token();
  v_name text := left(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), 60);
  v_email text := lower(left(trim(coalesce(p_email, '')), 120));
  v_phone text := left(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), 20);
begin
  if not exists (select 1 from cards where id = lower(p_card_id)) then
    raise exception 'This card no longer exists.' using errcode = 'P0002';
  end if;
  if v_name !~ '\S+\s+\S+' then raise exception 'Please write your full name.' using errcode = '22023'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please check your email.' using errcode = '22023'; end if;
  if v_phone !~ '^\+?[0-9]{7,15}$' then raise exception 'Please check your mobile number.' using errcode = '22023'; end if;
  if p_birth is null or p_birth > current_date - interval '13 years' or p_birth < current_date - interval '110 years' then
    raise exception 'Please check your date of birth.' using errcode = '22023';
  end if;
  loop
    v_code := _code(6);
    exit when not exists (select 1 from customers where id = v_code);
  end loop;
  -- Offers by email or SMS need consent, and in Poland that means 16 or older.
  insert into customers (id, card_id, name, secret_hash, email, phone, birth_date, marketing, referred_by)
  values (v_code, lower(p_card_id), v_name, _hash(v_secret), v_email, v_phone, p_birth,
    coalesce(p_marketing, false) and p_birth <= current_date - interval '16 years',
    (select id from customers where id = upper(trim(coalesce(p_ref, ''))) and card_id = lower(p_card_id)));
  insert into events (customer_id, type) values (v_code, 'joined');
  return jsonb_build_object('id', v_code, 'secret', v_secret);
end $$;

-- The birthday gift (messages.birthday on): once a year, in the week from the customer's birthday.
create or replace function stamper_gift(p_token text, p_code text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare d devices := _device(p_token); m customers; c cards;
begin
  select m2.* into m from customers m2 join cards c2 on c2.id = m2.card_id
  where m2.id = upper(trim(p_code)) and c2.business_id = d.business_id for update of m2;
  if not found then raise exception 'No customer with that code.' using errcode = 'P0002'; end if;
  select * into c from cards where id = m.card_id;
  if not coalesce((c.messages->'birthday'->>'on')::boolean, false) or not _birthday_now(m) then
    raise exception 'No birthday gift due for this customer.' using errcode = 'P0001';
  end if;
  update customers set gift_at = now(), last_visit = now() where id = m.id returning * into m;
  insert into events (customer_id, device_id, type) values (m.id, d.id, 'gift');
  return jsonb_build_object('customer', _customer_json(m), 'card', _card_json(c));
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
