-- Timbro database, part 4 of 12. Run the parts in order.
set search_path = timbro, extensions;

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

create or replace function get_my_card(p_code text, p_secret text) returns jsonb
language sql stable security definer set search_path = timbro
as $$
  select jsonb_build_object('customer', _customer_json(m), 'card', _card_json(c))
  from customers m join cards c on c.id = m.card_id
  where m.id = upper(p_code) and m.secret_hash = _hash(p_secret)
$$;

create or replace function device_link(p_code text, p_name text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare
  v_biz uuid; v_token text := _token(); v_name text;
begin
  delete from link_codes where expires_at < now();
  delete from link_codes where code = upper(trim(p_code)) returning business_id into v_biz;
  if v_biz is null then raise exception 'This code has expired or was already used. Ask the owner for a new one.' using errcode = '28000'; end if;
  insert into devices (business_id, name, token_hash) values (v_biz, coalesce(nullif(left(trim(p_name), 40), ''), 'Cassa'), _hash(v_token));
  select name into v_name from businesses where id = v_biz;
  return jsonb_build_object('token', v_token, 'business', v_name);
end $$;

create or replace function stamper_lookup(p_token text, p_code text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare d devices := _device(p_token); r jsonb;
begin
  select jsonb_build_object('customer', _customer_json(m), 'card', _card_json(c)) into r
  from customers m join cards c on c.id = m.card_id
  where m.id = upper(trim(p_code)) and c.business_id = d.business_id;
  return r;   -- null: no card with this code at this café
end $$;

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
