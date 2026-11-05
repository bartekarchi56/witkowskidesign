-- ============================================================================
-- Timbro database (Supabase / Postgres)
--
-- Run this once in Supabase: Dashboard → SQL Editor → paste → Run.
-- It is safe to run again: it replaces the functions and keeps your data.
--
-- Everything lives in its own schema, `timbro`, so it can share a Supabase
-- project with another app without touching that app's tables (`public`).
-- In Supabase: Project Settings → API (Data API) → Exposed schemas → add `timbro`.
--
-- Security model: nobody reads or writes the tables directly (row level
-- security is on with no policies). Everything goes through the functions
-- below, and each function checks who is calling:
--   • customers   prove who they are with the secret saved on their phone
--   • cashiers    use a token their phone got when the owner linked it
--   • owners      are logged in with Supabase Auth (email)
--   • designers   are owners listed in the `admins` table (Witkowski Design)
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;
create schema if not exists timbro;
set search_path = timbro, extensions;
-- Postgres lets everyone run a new function by default: the permissions
-- section at the end closes them all again, so every change must end with it.

-- ---------------------------------------------------------------- tables --

create table if not exists businesses (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique,                 -- auth.users.id
  name        text not null default '',
  created_at  timestamptz not null default now()
);
-- Contact details the owner gives when signing up.
alter table businesses add column if not exists contact_name text not null default '';
alter table businesses add column if not exists phone        text not null default '';
alter table businesses add column if not exists city         text not null default '';
alter table businesses add column if not exists address      text not null default '';
alter table businesses add column if not exists instagram    text not null default '';
alter table businesses add column if not exists kind         text not null default '';

create table if not exists cards (
  id             text primary key check (id ~ '^[a-z0-9-]{3,40}$'),
  business_id    uuid not null references businesses(id) on delete cascade,
  business       text not null default '',
  city           text not null default '',
  type           text not null default 'caffe',
  title          text not null default '',
  reward         text not null default '',
  title_en       text not null default '',
  reward_en      text not null default '',
  stamps_needed  int  not null default 10 check (stamps_needed between 3 and 20),
  design         jsonb not null default '{}'::jsonb,  -- colours, stamp, logo… (see DESIGN_KEYS)
  plan           text not null default 'start' check (plan in ('start','plus','pro','chain')),
  review         jsonb,                               -- design proposal / request / reply
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Notification texts chosen by the café (see "messages" below).
alter table cards add column if not exists messages jsonb not null default '{}'::jsonb;
-- A message the café sends to all its customers at once (dashboard → Notifications), and when.
alter table cards add column if not exists news text not null default '';
alter table cards add column if not exists news_at timestamptz;
-- The card's own language (title, reward, messages); titleEn/rewardEn are for English visitors.
alter table cards add column if not exists lang text not null default 'it' check (lang in ('it', 'en', 'pl'));
-- Plans: start, plus, pro (Stripe) and chain (set by Witkowski Design, invoiced).
alter table cards drop constraint if exists cards_plan_check;
alter table cards add constraint cards_plan_check check (plan in ('start','plus','pro','chain'));

create table if not exists customers (
  id           text primary key check (id ~ '^[A-Z0-9]{6}$'),   -- the code under the QR
  card_id      text not null references cards(id) on delete cascade,
  name         text not null default 'Guest',
  secret_hash  text not null,                                   -- sha256 of the phone's secret
  stamps       int  not null default 0,
  redeemed     int  not null default 0,
  joined_at    timestamptz not null default now(),
  last_visit   timestamptz
);
create index if not exists customers_card on customers(card_id);
-- What a customer gives when joining (full name above): only the café that owns the card sees it.
alter table customers add column if not exists email      text not null default '';
alter table customers add column if not exists phone      text not null default '';
alter table customers add column if not exists birth_date date;
alter table customers add column if not exists marketing  boolean not null default false;   -- agreed to news and offers
alter table customers add column if not exists reminded_at timestamptz;                     -- last "we miss you" reminder
-- Extras (dashboard → Notifications): who invited them (Bring a friend), and the last birthday gift.
alter table customers add column if not exists referred_by text references customers(id) on delete set null;
alter table customers add column if not exists ref_paid    boolean not null default false;  -- the friend bonus was given
alter table customers add column if not exists gift_at     timestamptz;                     -- last birthday gift

create table if not exists devices (                           -- cashiers' phones
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  name         text not null default '',
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_used    timestamptz
);
-- Where a till phone is (chains: one café, several shops); stats can be split by it.
alter table devices add column if not exists location text not null default '';

create table if not exists link_codes (                        -- one-time codes to link a phone
  code         text primary key,
  business_id  uuid not null references businesses(id) on delete cascade,
  expires_at   timestamptz not null
);

create table if not exists events (
  id           bigint generated always as identity primary key,
  customer_id  text not null references customers(id) on delete cascade,
  device_id    uuid references devices(id) on delete set null,
  type         text not null check (type in ('joined','stamp','unstamp','redeem')),
  n            int  not null default 1,
  created_at   timestamptz not null default now()
);
create index if not exists events_customer on events(customer_id, created_at);
-- bonus: extra stamps on a visit (double-stamp hours, a friend's first stamp); friend: the stamp an inviter
-- gets when their friend's first stamp lands; gift: the birthday gift. A visit is still one 'stamp'.
alter table events drop constraint if exists events_type_check;
alter table events add constraint events_type_check check (type in ('joined','stamp','unstamp','redeem','bonus','friend','gift'));

create table if not exists admins (user_id uuid primary key);   -- Witkowski Design accounts

alter table businesses enable row level security;
alter table cards      enable row level security;
alter table customers  enable row level security;
alter table devices    enable row level security;
alter table link_codes enable row level security;
alter table events     enable row level security;
alter table admins     enable row level security;

-- --------------------------------------------------------------- helpers --

create or replace function _hash(t text) returns text
language sql immutable set search_path = timbro, extensions
as $$ select encode(digest(t, 'sha256'), 'hex') $$;

-- Random code from an alphabet without look-alike characters (no 0/O, 1/I).
create or replace function _code(len int) returns text
language plpgsql volatile set search_path = timbro, extensions
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := gen_random_bytes(len);
  out text := '';
begin
  for i in 0 .. len - 1 loop
    out := out || substr(chars, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return out;
end $$;

create or replace function _token() returns text
language sql volatile set search_path = timbro, extensions
as $$ select encode(gen_random_bytes(24), 'hex') $$;

create or replace function _is_admin() returns boolean
language sql stable security definer set search_path = timbro
as $$ select exists (select 1 from admins where user_id = auth.uid()) $$;

create or replace function _my_business() returns uuid
language sql stable security definer set search_path = timbro
as $$ select id from businesses where owner_id = auth.uid() $$;

-- The owner's details: from their café once it exists, else from what they
-- typed when signing up (kept by Supabase Auth in raw_user_meta_data).
create or replace function _profile() returns jsonb
language sql stable security definer set search_path = timbro
as $$
  select coalesce(
    (select jsonb_build_object('name', contact_name, 'business', name, 'type', kind, 'city', city,
       'address', address, 'phone', phone, 'instagram', instagram) from businesses where owner_id = auth.uid()),
    (select jsonb_build_object('name', left(m->>'name', 60), 'business', left(m->>'business', 40), 'type', left(m->>'type', 20),
       'city', left(m->>'city', 40), 'address', left(m->>'address', 100), 'phone', left(m->>'phone', 30), 'instagram', left(m->>'instagram', 40))
     from (select coalesce(raw_user_meta_data, '{}'::jsonb) m from auth.users where id = auth.uid()) u),
    '{}'::jsonb)
$$;

-- Creates the logged-in owner's café, filled in with their sign-up details.
create or replace function _new_business() returns uuid
language plpgsql security definer set search_path = timbro
as $$
declare p jsonb := _profile(); v uuid;
begin
  insert into businesses (owner_id, name, contact_name, phone, city, address, instagram, kind)
  values (auth.uid(), coalesce(p->>'business', ''), coalesce(p->>'name', ''), coalesce(p->>'phone', ''), coalesce(p->>'city', ''),
          coalesce(p->>'address', ''), coalesce(p->>'instagram', ''), coalesce(p->>'type', ''))
  on conflict (owner_id) do update set owner_id = excluded.owner_id
  returning id into v;
  return v;
end $$;

-- The design keys the website uses (assets/js/store.js DESIGN_KEYS).
create or replace function _clean_design(d jsonb) returns jsonb
language sql immutable
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from jsonb_each(coalesce(d, '{}'::jsonb))
  where key in ('style','color','ink','stamp','shape','mark','markText','empty','font','strip','tagline','icon','logo','iconLogo','stampImage','emptyImage','stripImage','hideFields','hideCount','hideReward')
    and octet_length(value::text) < 1200000
$$;

-- A card as the website expects it (same shape as the browser demo).
create or replace function _card_json(c cards, with_review boolean default false) returns jsonb
language sql stable
as $$
  select c.design || jsonb_build_object(
    'id', c.id, 'business', c.business, 'city', c.city, 'type', c.type,
    'title', c.title, 'reward', c.reward, 'titleEn', c.title_en, 'rewardEn', c.reward_en, 'lang', c.lang,
    'stampsNeeded', c.stamps_needed, 'plan', c.plan, 'messages', c.messages,
    'news', c.news, 'newsAt', (extract(epoch from c.news_at) * 1000)::bigint,
    'createdAt', (extract(epoch from c.created_at) * 1000)::bigint,
    'updatedAt', (extract(epoch from c.updated_at) * 1000)::bigint
  ) || case when with_review and c.review is not null then jsonb_build_object('review', c.review) else '{}'::jsonb end
$$;

-- Double-stamp hours (messages.double): on, the weekdays (1 = Monday) and the hours [from, to), café time.
create or replace function _double_now(c cards) returns boolean
language sql stable set search_path = timbro
as $$
  select coalesce((c.messages->'double'->>'on')::boolean, false)
    and coalesce(c.messages->'double'->'week', '[]'::jsonb) @> to_jsonb(extract(isodow from l)::int)
    and extract(hour from l) >= coalesce((c.messages->'double'->>'from')::int, 15)
    and extract(hour from l) < coalesce((c.messages->'double'->>'to')::int, 17)
  from (select now() at time zone case c.lang when 'pl' then 'Europe/Warsaw' else 'Europe/Rome' end as l) t
$$;

-- In the week from their birthday (0-6 days after) and no birthday gift since then.
create or replace function _birthday_now(m customers) returns boolean
language sql stable set search_path = timbro
as $$
  select m.birth_date is not null and current_date - b between 0 and 6 and (m.gift_at is null or m.gift_at::date < b)
  from (select (m.birth_date + make_interval(years => date_part('year', age(current_date, m.birth_date))::int))::date as b) t
$$;

create or replace function _customer_json(m customers, history_limit int default 5) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'id', m.id, 'cardId', m.card_id, 'name', m.name, 'stamps', m.stamps, 'redeemed', m.redeemed,
    'joinedAt', (extract(epoch from m.joined_at) * 1000)::bigint,
    'lastVisit', (extract(epoch from m.last_visit) * 1000)::bigint,
    'remindedAt', (extract(epoch from m.reminded_at) * 1000)::bigint,
    -- Extras: birthday gift due now; when a friend's bonus and the last reward came (ms); friends who joined with their invite.
    'birthday', _birthday_now(m),
    'lastFriend', (select (extract(epoch from max(created_at)) * 1000)::bigint from events where customer_id = m.id and type = 'friend'),
    'lastRedeem', (select (extract(epoch from max(created_at)) * 1000)::bigint from events where customer_id = m.id and type = 'redeem'),
    'friends', (select count(*) from customers f where f.referred_by = m.id and f.ref_paid),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('t', (extract(epoch from e.created_at) * 1000)::bigint, 'type', e.type, 'n', e.n)
        || case when dv.location <> '' then jsonb_build_object('at', dv.location) else '{}'::jsonb end order by e.created_at)
      from (select * from events where customer_id = m.id order by created_at desc limit history_limit) e
      left join devices dv on dv.id = e.device_id
    ), '[]'::jsonb)
  )
$$;

-- A customer's contact details, for the café's own dashboard only (never the till or the card page).
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

-- ------------------------------------------------------ customers (anon) --

create or replace function get_card(p_card_id text) returns jsonb
language sql stable security definer set search_path = timbro
as $$ select _card_json(c) from cards c where c.id = lower(p_card_id) $$;

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

create or replace function get_my_card(p_code text, p_secret text) returns jsonb
language sql stable security definer set search_path = timbro
as $$
  select jsonb_build_object('customer', _customer_json(m), 'card', _card_json(c))
  from customers m join cards c on c.id = m.card_id
  where m.id = upper(p_code) and m.secret_hash = _hash(p_secret)
$$;

-- -------------------------------------------------------- cashiers (anon) --

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

-- A visit adds one stamp ('stamp' event). Extras add more, as a 'bonus' event: one more in the
-- café's double-stamp hours, and on a friend's first stamp one more for them and one for whoever
-- invited them. Returns extra: { double, friend: the inviter's code (their Wallet card is woken too) }.
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

create or replace function stamper_redeem(p_token text, p_code text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare d devices := _device(p_token); m customers; c cards;
begin
  select m2.* into m from customers m2 join cards c2 on c2.id = m2.card_id
  where m2.id = upper(trim(p_code)) and c2.business_id = d.business_id for update of m2;
  if not found then raise exception 'No customer with that code.' using errcode = 'P0002'; end if;
  select * into c from cards where id = m.card_id;
  if m.stamps < c.stamps_needed then raise exception 'This card is not full yet.' using errcode = 'P0001'; end if;
  update customers set stamps = 0, redeemed = redeemed + 1, last_visit = now() where id = m.id returning * into m;
  insert into events (customer_id, device_id, type) values (m.id, d.id, 'redeem');
  return jsonb_build_object('customer', _customer_json(m), 'card', _card_json(c));
end $$;

-- ------------------------------------------------- owners (authenticated) --

-- Everything the dashboard needs: the owner's cards, customers and phones.
create or replace function owner_data() returns jsonb
language plpgsql stable security definer set search_path = timbro
as $$
declare v_biz uuid := _my_business();
begin
  if auth.uid() is null then raise exception 'Not logged in.' using errcode = '28000'; end if;
  return jsonb_build_object(
    'isAdmin', _is_admin(),
    'profile', _profile(),
    'billing', (select _billing_json(b) from businesses b where b.id = v_biz),
    'cards', coalesce((select jsonb_agg(_card_json(c, true) order by c.created_at) from cards c where c.business_id = v_biz), '[]'::jsonb),
    'customers', coalesce((select jsonb_agg(_customer_json(m, 200) || _customer_contact(m)) from customers m join cards c on c.id = m.card_id where c.business_id = v_biz), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'location', d.location, 'lastUsed', (extract(epoch from d.last_used) * 1000)::bigint) order by d.created_at) from devices d where d.business_id = v_biz), '[]'::jsonb)
  );
end $$;

-- Create or update a card's texts. Design and plan are not changed here.
create or replace function owner_save_card(p_card jsonb) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare
  v_biz uuid := _my_business(); c cards; v_id text := lower(p_card->>'id');
begin
  if auth.uid() is null then raise exception 'Not logged in.' using errcode = '28000'; end if;
  if v_biz is null then
    v_biz := _new_business();
  end if;
  select * into c from cards where id = v_id;
  if found and c.business_id <> v_biz then raise exception 'This card belongs to another café.' using errcode = '42501'; end if;
  if not found then
    insert into cards (id, business_id, design) values (v_id, v_biz, _clean_design(p_card->'design'));
  end if;
  update cards set
    business = left(coalesce(p_card->>'business', business), 40),
    city = left(coalesce(p_card->>'city', city), 40),
    type = left(coalesce(p_card->>'type', type), 20),
    title = left(coalesce(p_card->>'title', title), 40),
    reward = left(coalesce(p_card->>'reward', reward), 60),
    title_en = left(coalesce(p_card->>'titleEn', title_en), 40),
    reward_en = left(coalesce(p_card->>'rewardEn', reward_en), 60),
    lang = case when p_card->>'lang' in ('it', 'en', 'pl') then p_card->>'lang' else lang end,
    stamps_needed = greatest(3, least(20, coalesce((p_card->>'stampsNeeded')::int, stamps_needed))),
    updated_at = now()
  where id = v_id returning * into c;
  update businesses set name = c.business where id = v_biz;   -- the name the till phones show
  return _card_json(c, true);
end $$;

-- Start plan: propose a new design. Plus/Pro: ask for a change in words.
create or replace function owner_send_design(p_card_id text, p_kind text, p_design jsonb, p_note text, p_images jsonb, p_links jsonb) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare c cards;
begin
  select * into c from cards where id = lower(p_card_id) and business_id = _my_business();
  if not found then raise exception 'Card not found.' using errcode = 'P0002'; end if;
  if jsonb_array_length(coalesce(p_images, '[]')) > 8 then raise exception 'Up to 8 images.'; end if;
  update cards set review = jsonb_build_object(
    'status', 'pending',
    'kind', case when p_kind = 'request' then 'request' else 'proposal' end,
    'design', case when p_kind = 'request' then '{}'::jsonb else _clean_design(p_design) end,
    'note', left(coalesce(p_note, ''), 2000),
    'images', coalesce(p_images, '[]'::jsonb),
    'links', coalesce(p_links, '[]'::jsonb),
    'sentAt', (extract(epoch from now()) * 1000)::bigint,
    'reply', '')
  where id = c.id returning * into c;
  return _card_json(c, true);
end $$;

-- A one-time code (valid 15 minutes) to link a cashier's phone.
create or replace function owner_link_code() returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare v_biz uuid := _my_business(); v_code text;
begin
  if v_biz is null then raise exception 'Create your card first.' using errcode = 'P0002'; end if;
  delete from link_codes where business_id = v_biz or expires_at < now();
  v_code := _code(8);
  insert into link_codes (code, business_id, expires_at) values (v_code, v_biz, now() + interval '15 minutes');
  return jsonb_build_object('code', v_code, 'expiresAt', (extract(epoch from now() + interval '15 minutes') * 1000)::bigint);
end $$;

create or replace function owner_remove_device(p_device_id uuid) returns void
language sql security definer set search_path = timbro
as $$ delete from devices where id = p_device_id and business_id = _my_business() $$;

-- Which shop a till phone is in (e.g. "Gdańsk, Długa 12"), for stats by location.
create or replace function owner_set_device_location(p_device_id uuid, p_location text) returns void
language sql security definer set search_path = timbro
as $$ update devices set location = left(trim(regexp_replace(coalesce(p_location, ''), '[[:cntrl:]]', ' ', 'g')), 60)
      where id = p_device_id and business_id = _my_business() $$;

-- ------------------------------------------- Witkowski Design (admins) --

create or replace function admin_cards() returns jsonb
language plpgsql stable security definer set search_path = timbro
as $$
begin
  if not _is_admin() then raise exception 'Only Witkowski Design can open the Studio.' using errcode = '42501'; end if;
  -- Each card comes with its owner's contact details, so you can get in touch.
  return coalesce((select jsonb_agg(_card_json(c, true) || jsonb_build_object('contact', jsonb_build_object(
      'name', b.contact_name, 'email', u.email, 'phone', b.phone, 'city', b.city, 'address', b.address, 'instagram', b.instagram),
      'billing', _billing_json(b))
    order by c.created_at)
    from cards c join businesses b on b.id = c.business_id left join auth.users u on u.id = b.owner_id), '[]'::jsonb);
end $$;

-- Publish a design (approving a proposal, or the designer's own work).
create or replace function admin_publish(p_card_id text, p_design jsonb) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare c cards;
begin
  if not _is_admin() then raise exception 'Only Witkowski Design can publish designs.' using errcode = '42501'; end if;
  update cards set design = design || _clean_design(p_design),
    review = jsonb_build_object('status', 'approved', 'at', (extract(epoch from now()) * 1000)::bigint, 'reply', ''),
    updated_at = now()
  where id = lower(p_card_id) returning * into c;
  return _card_json(c, true);
end $$;

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

-- Plans come from the subscription; until payments exist the designer sets them.
create or replace function admin_set_plan(p_card_id text, p_plan text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare c cards;
begin
  if not _is_admin() then raise exception 'Only Witkowski Design can change plans.' using errcode = '42501'; end if;
  update cards set plan = p_plan where id = lower(p_card_id) returning * into c;
  return _card_json(c, true);
end $$;

-- -------------------------------------------------------------- messages --
-- The café's own notification texts (Wallet passes and the web card):
-- close (1-3 stamps to go), ready (reward ready), remind (no visit for N
-- days) and near (lock screen near the café). Each has on, it, en, pl.
-- Extras, all off until the café switches them on: friend (Bring a friend), double
-- (double-stamp hours: week, from, to), birthday (gift in the birthday week), review (Google link).
-- (The column itself is added with the tables, above.)
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

-- The owner saves their messages; only for their own cards.
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

-- A message to all customers ("Fresh cornetti this morning!", "New: Matcha Maple Apple"):
-- the owner sends it from the dashboard, at most once a day. Each customer's Wallet card
-- shows it for 3 days (CONFIG.newsHours); the card's updated_at makes iPhones fetch the new pass.
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

-- Right after sending, the wallet server (POST /news, as the owner) gets the phones to wake:
-- every customer of the card with their Apple push tokens, for 15 minutes after the message.
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

-- --------------------------------------------------------------- billing --
-- Subscriptions are paid with Stripe (supabase/functions/). Only the Stripe
-- functions, running with the service role, can change these fields.
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

-- For the checkout function: the logged-in owner's café and Stripe customer.
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

-- For the webhook: copies a Stripe subscription onto the café. A paid or
-- trialing plan also becomes the plan of the café's cards.
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

-- ---------------------------------------------------------- wallet updates --
-- Apple Wallet asks the wallet server (wallet/) for a fresh pass after each stamp.
-- A pass carries the customer's own secret as its token; phones that hold it are
-- listed here with Apple's push token, so the server can tell them to update.
create table if not exists wallet_devices (
  device_id    text not null,
  customer_id  text not null references customers(id) on delete cascade,
  push_token   text not null,
  created_at   timestamptz not null default now(),
  primary key (device_id, customer_id)
);

-- When a customer's pass last changed (joined, stamps, a reminder, the card's texts), in ms.
create or replace function _pass_updated(m customers) returns bigint
language sql stable set search_path = timbro
as $$
  select (extract(epoch from greatest(m.joined_at, c.updated_at, m.reminded_at,
    coalesce((select max(e.created_at) from events e where e.customer_id = m.id), m.joined_at))) * 1000)::bigint
  from cards c where c.id = m.card_id
$$;

-- A phone saved the pass: remember it (201 new, 200 known, 401 wrong token).
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

-- The phone removed the pass.
create or replace function wallet_unregister(p_code text, p_secret text, p_device text) returns int
language plpgsql security definer set search_path = timbro
as $$
begin
  if not exists (select 1 from customers where id = upper(p_code) and secret_hash = _hash(p_secret)) then return 401; end if;
  delete from wallet_devices where device_id = p_device and customer_id = upper(p_code);
  return 200;
end $$;

-- Which passes on this phone changed since the phone last asked.
create or replace function wallet_updated(p_device text, p_since bigint) returns jsonb
language sql stable security definer set search_path = timbro
as $$
  select jsonb_build_object('serialNumbers', coalesce(jsonb_agg(c.id || '-' || m.id), '[]'::jsonb),
    'lastUpdated', coalesce(max(_pass_updated(m)), 0)::text)
  from wallet_devices w join customers m on m.id = w.customer_id join cards c on c.id = m.card_id
  where w.device_id = p_device and _pass_updated(m) > coalesce(p_since, 0)
$$;

-- After a stamp the till asks the wallet server to wake this customer's phones;
-- only a till phone linked to the same café gets their push tokens.
create or replace function wallet_targets(p_token text, p_code text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare d devices := _device(p_token);
begin
  return coalesce((select jsonb_agg(w.push_token) from wallet_devices w join customers m on m.id = w.customer_id
    join cards c on c.id = m.card_id where m.id = upper(trim(p_code)) and c.business_id = d.business_id), '[]'::jsonb);
end $$;

-- ------------------------------------------------------------- reminders --
-- Once a day the wallet server (GET /reminders?key=..., e.g. from cron-job.org) asks for
-- customers who haven't been in for the number of days the café chose (messages.remind),
-- marks them reminded and sends their Wallet card the café's own reminder text.
-- At most one reminder per visit: after the next stamp they can be reminded again.
create table if not exists job_keys (
  name  text primary key,
  key   text not null default _token()
);
insert into job_keys (name) values ('reminders') on conflict (name) do nothing;

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

-- ---------------------------------------------------------------- alerts --
-- Witkowski Design gets an email when a café signs up (its first card), sends a design
-- for approval or asks for a change, and when its subscription starts, is paid, fails or is cancelled. The database calls the
-- admin-alert Edge Function (supabase/functions/admin-alert, it sends the email with
-- Resend) through pg_net. Set its address once:
--   insert into timbro.settings (name, value) values ('alerts_url', 'https://<project>.supabase.co/functions/v1/admin-alert')
--   on conflict (name) do update set value = excluded.value;
-- A failed alert never stops a sign-up or a payment.
do $$ begin create extension if not exists pg_net; exception when others then raise notice 'pg_net not available: no alerts'; end $$;
create table if not exists settings (name text primary key, value text not null default '');
alter table settings enable row level security;
insert into job_keys (name) values ('alerts') on conflict (name) do nothing;

-- p_extra: more for the email (a design sent for approval: the card, its note).
drop function if exists _alert(text, uuid);
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

-- Someone new signed up: their café's first card got its name. Once per café (cafés that
-- existed before alerts count as already announced: the column is added true, then defaults to false).
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

-- A café sent a design for approval, or asked Witkowski Design for a change (owner_send_design):
-- Witkowski Design is told. Witkowski Design approved a design (admin_publish) or asked the café
-- for a change (admin_ask_changes): the café's owner is told, in the card's language.
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

-- The subscription changed (stripe_sync): trial started, paying, payment failed, cancelled, ended.
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

-- The admin-alert function checks that a request really comes from this database.
create or replace function alert_key_ok(p_key text) returns boolean
language sql stable security definer set search_path = timbro
as $$ select exists (select 1 from job_keys where name = 'alerts' and key = coalesce(p_key, '')) $$;

-- ------------------------------------------------------- online orders --
-- Orders from delivery apps (Wolt, Uber Eats, Glovo, Deliveroo): the owner uploads the order
-- report from each partner portal in Results; the browser reads it (assets/js/online.js) and
-- sends only date, amount, currency and order number. No customer data.
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

create or replace function _my_card(p_card_id text) returns text
language plpgsql stable security definer set search_path = timbro
as $$
declare v text;
begin
  if auth.uid() is null then raise exception 'Not logged in.' using errcode = '28000'; end if;
  select id into v from cards where id = lower(p_card_id) and business_id = _my_business();
  if v is null then raise exception 'This card belongs to another café.' using errcode = '42501'; end if;
  return v;
end $$;

-- Up to 2000 orders per call (the page sends bigger reports in parts); the same order again replaces it.
create or replace function owner_import_orders(p_card_id text, p_orders jsonb) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare v_card text := _my_card(p_card_id); v_before int; v_after int;
begin
  if jsonb_typeof(p_orders) <> 'array' or jsonb_array_length(p_orders) > 2000 then
    raise exception 'Too many orders in one go.' using errcode = '22023';
  end if;
  select count(*) into v_before from online_orders where card_id = v_card;
  insert into online_orders (card_id, platform, order_id, at, total, currency)
  select distinct on (o->>'p', left(o->>'id', 80)) v_card, o->>'p', left(o->>'id', 80),
         to_timestamp((o->>'t')::bigint / 1000.0), round((o->>'v')::numeric, 2), coalesce(nullif(o->>'c', ''), 'EUR')
  from jsonb_array_elements(p_orders) o
  where o->>'p' in ('wolt', 'ubereats', 'glovo', 'deliveroo') and coalesce(o->>'id', '') <> ''
    and (o->>'t') ~ '^\d{10,14}$' and (o->>'v') ~ '^\d{1,5}(\.\d+)?$' and coalesce(o->>'c', 'EUR') ~ '^[A-Z]{3}$'
  on conflict (card_id, platform, order_id) do update set at = excluded.at, total = excluded.total, currency = excluded.currency;
  select count(*) into v_after from online_orders where card_id = v_card;
  return jsonb_build_object('added', v_after - v_before);
end $$;

-- The card's orders from the last 400 days, in the page's short form.
create or replace function owner_online_orders(p_card_id text) returns jsonb
language plpgsql stable security definer set search_path = timbro
as $$
declare v_card text := _my_card(p_card_id);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('p', platform, 'id', order_id, 't', (extract(epoch from at) * 1000)::bigint,
    'v', total, 'c', currency) order by at) from online_orders where card_id = v_card and at > now() - interval '400 days'), '[]'::jsonb);
end $$;

create or replace function owner_clear_orders(p_card_id text, p_platform text) returns int
language plpgsql security definer set search_path = timbro
as $$
declare v_card text := _my_card(p_card_id); n int;
begin
  delete from online_orders where card_id = v_card and platform = p_platform;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------- leads --
-- Places Witkowski Design may write to (studio/leads.html): found on Google Maps by the leads
-- function (supabase/functions/leads/), with photos, a short description, a public e-mail from
-- their website and any sign of a loyalty programme. Only the leads function (service role) reads
-- and writes them. status: new, sent (asked for permission), skipped, manual (no e-mail: write
-- on Instagram or call), replied.
create table if not exists leads (
  place_id    text primary key,
  name        text not null default '',
  kind        text not null default '',
  address     text not null default '',
  city        text not null default '',
  rating      numeric(2,1),
  reviews     int,
  website     text not null default '',
  email       text not null default '',
  phone       text not null default '',
  maps_url    text not null default '',
  summary     text not null default '',
  photos      jsonb not null default '[]'::jsonb,
  loyalty     text not null default '',
  status      text not null default 'new' check (status in ('new', 'sent', 'skipped', 'manual', 'replied')),
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
alter table leads add column if not exists instagram text not null default '';   -- handle from their website
alter table leads enable row level security;

-- New places only; the ones already seen keep their status.
create or replace function leads_add(p_leads jsonb) returns int
language plpgsql security definer set search_path = timbro
as $$
declare n int;
begin
  insert into leads (place_id, name, kind, address, city, rating, reviews, website, email, phone, maps_url, summary, photos, loyalty, instagram)
  select l->>'place_id', coalesce(l->>'name', ''), coalesce(l->>'kind', ''), coalesce(l->>'address', ''), coalesce(l->>'city', ''),
         nullif(l->>'rating', '')::numeric, nullif(l->>'reviews', '')::int, coalesce(l->>'website', ''), coalesce(l->>'email', ''),
         coalesce(l->>'phone', ''), coalesce(l->>'maps_url', ''), coalesce(l->>'summary', ''), coalesce(l->'photos', '[]'::jsonb), coalesce(l->>'loyalty', ''),
         left(coalesce(l->>'instagram', ''), 30)
  from jsonb_array_elements(p_leads) l where coalesce(l->>'place_id', '') <> ''
  on conflict (place_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function leads_list(p_status text) returns jsonb
language sql stable security definer set search_path = timbro
as $$ select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at), '[]'::jsonb) from leads l where l.status = p_status $$;

create or replace function leads_get(p_place text) returns jsonb
language sql stable security definer set search_path = timbro
as $$ select to_jsonb(l) from leads l where l.place_id = p_place $$;

create or replace function leads_set(p_place text, p_status text) returns void
language sql security definer set search_path = timbro
as $$ update leads set status = p_status, sent_at = case when p_status = 'sent' then now() else sent_at end where place_id = p_place $$;

-- ----------------------------------------------------------- permissions --

-- Only inside the timbro schema: other apps in this project are not touched.
grant usage on schema timbro to anon, authenticated;
revoke all on all tables in schema timbro from anon, authenticated;
revoke execute on all functions in schema timbro from public, anon, authenticated;

grant execute on function get_card(text), join_card(text, text, text, text, date, boolean, text), get_my_card(text, text),
  device_link(text, text), stamper_lookup(text, text), stamper_stamp(text, text, int), stamper_redeem(text, text), stamper_gift(text, text),
  wallet_register(text, text, text, text), wallet_unregister(text, text, text), wallet_updated(text, bigint), wallet_targets(text, text), reminders_due(text)
  to anon, authenticated;

grant execute on function owner_data(), owner_save_card(jsonb), owner_save_messages(text, jsonb), owner_send_design(text, text, jsonb, text, jsonb, jsonb),
  owner_link_code(), owner_remove_device(uuid), owner_set_device_location(uuid, text), owner_send_news(text, text), owner_news_targets(text),
  owner_import_orders(text, jsonb), owner_online_orders(text), owner_clear_orders(text, text),
  admin_cards(), admin_publish(text, jsonb), admin_ask_changes(text, text), admin_set_plan(text, text)
  to authenticated;

-- The Stripe functions (supabase/functions/) use the service role.
grant usage on schema timbro to service_role;
grant execute on function stripe_business(uuid), stripe_set_customer(uuid, text),
  stripe_sync(text, text, text, text, text, bigint, boolean), stripe_is_admin(uuid), alert_key_ok(text),
  leads_add(jsonb), leads_list(text), leads_get(text), leads_set(text, text) to service_role;

-- ---------------------------------------------------------- after setup --
-- Make your own account a designer (run once, after signing up on the site):
--   insert into timbro.admins (user_id) select id from auth.users where email = 'you@example.com';
