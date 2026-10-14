-- Timbro update 7a (October 2026): customer details, part 1.
-- Customers join with full name, email, mobile number and date of birth.
-- Paste in Supabase SQL Editor and Run. Safe to run again. Then run 7b.
set search_path = timbro, extensions;

alter table customers add column if not exists email      text not null default '';
alter table customers add column if not exists phone      text not null default '';
alter table customers add column if not exists birth_date date;
alter table customers add column if not exists marketing  boolean not null default false;   -- agreed to news and offers

drop function if exists join_card(text, text);
create or replace function join_card(p_card_id text, p_name text, p_email text default '', p_phone text default '',
  p_birth date default null, p_marketing boolean default false) returns jsonb
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
  insert into customers (id, card_id, name, secret_hash, email, phone, birth_date, marketing)
  values (v_code, lower(p_card_id), v_name, _hash(v_secret), v_email, v_phone, p_birth,
    coalesce(p_marketing, false) and p_birth <= current_date - interval '16 years');
  insert into events (customer_id, type) values (v_code, 'joined');
  return jsonb_build_object('id', v_code, 'secret', v_secret);
end $$;

grant usage on schema timbro to anon, authenticated;
revoke all on all tables in schema timbro from anon, authenticated;
revoke execute on all functions in schema timbro from public, anon, authenticated;

grant execute on function get_card(text), join_card(text, text, text, text, date, boolean), get_my_card(text, text),
  device_link(text, text), stamper_lookup(text, text), stamper_stamp(text, text, int), stamper_redeem(text, text)
  to anon, authenticated;

grant execute on function owner_data(), owner_save_card(jsonb), owner_save_messages(text, jsonb), owner_send_design(text, text, jsonb, text, jsonb, jsonb),
  owner_link_code(), owner_remove_device(uuid),
  admin_cards(), admin_publish(text, jsonb), admin_ask_changes(text, text), admin_set_plan(text, text)
  to authenticated;

grant usage on schema timbro to service_role;
grant execute on function stripe_business(uuid), stripe_set_customer(uuid, text),
  stripe_sync(text, text, text, text, text, bigint, boolean), stripe_is_admin(uuid) to service_role;
