-- Timbro database, part 3 of 8. Run the parts in order.
set search_path = timbro, extensions;

create or replace function _card_json(c cards, with_review boolean default false) returns jsonb
language sql stable
as $$
  select c.design || jsonb_build_object(
    'id', c.id, 'business', c.business, 'city', c.city, 'type', c.type,
    'title', c.title, 'reward', c.reward, 'titleEn', c.title_en, 'rewardEn', c.reward_en, 'lang', c.lang,
    'stampsNeeded', c.stamps_needed, 'plan', c.plan, 'messages', c.messages,
    'createdAt', (extract(epoch from c.created_at) * 1000)::bigint,
    'updatedAt', (extract(epoch from c.updated_at) * 1000)::bigint
  ) || case when with_review and c.review is not null then jsonb_build_object('review', c.review) else '{}'::jsonb end
$$;

create or replace function _customer_json(m customers, history_limit int default 5) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'id', m.id, 'cardId', m.card_id, 'name', m.name, 'stamps', m.stamps, 'redeemed', m.redeemed,
    'joinedAt', (extract(epoch from m.joined_at) * 1000)::bigint,
    'lastVisit', (extract(epoch from m.last_visit) * 1000)::bigint,
    'remindedAt', (extract(epoch from m.reminded_at) * 1000)::bigint,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('t', (extract(epoch from e.created_at) * 1000)::bigint, 'type', e.type, 'n', e.n)
        || case when dv.location <> '' then jsonb_build_object('at', dv.location) else '{}'::jsonb end order by e.created_at)
      from (select * from events where customer_id = m.id order by created_at desc limit history_limit) e
      left join devices dv on dv.id = e.device_id
    ), '[]'::jsonb)
  )
$$;

create or replace function _customer_contact(m customers) returns jsonb
language sql stable
as $$
  select jsonb_build_object('email', m.email, 'phone', m.phone, 'birthDate', m.birth_date, 'marketing', m.marketing)
$$;

create or replace function _device(p_token text) returns devices
language plpgsql security definer set search_path = timbro
as $$
declare d devices;
begin
  select * into d from devices where token_hash = _hash(p_token);
  if not found then raise exception 'This phone is not linked to a café any more. Ask the owner to link it again.' using errcode = '28000'; end if;
  update devices set last_used = now() where id = d.id;
  return d;
end $$;

create or replace function get_card(p_card_id text) returns jsonb
language sql stable security definer set search_path = timbro
as $$ select _card_json(c) from cards c where c.id = lower(p_card_id) $$;

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

create or replace function get_my_card(p_code text, p_secret text) returns jsonb
language sql stable security definer set search_path = timbro
as $$
  select jsonb_build_object('customer', _customer_json(m), 'card', _card_json(c))
  from customers m join cards c on c.id = m.card_id
  where m.id = upper(p_code) and m.secret_hash = _hash(p_secret)
$$;
