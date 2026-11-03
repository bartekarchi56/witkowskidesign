-- Timbro database, part 3 of 11. Run the parts in order.
set search_path = timbro, extensions;

create or replace function _clean_design(d jsonb) returns jsonb
language sql immutable
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from jsonb_each(coalesce(d, '{}'::jsonb))
  where key in ('style','color','ink','stamp','shape','mark','markText','empty','font','strip','tagline','icon','logo','iconLogo','stampImage','emptyImage','stripImage','hideFields','hideCount','hideReward')
    and octet_length(value::text) < 1200000
$$;

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

create or replace function _double_now(c cards) returns boolean
language sql stable set search_path = timbro
as $$
  select coalesce((c.messages->'double'->>'on')::boolean, false)
    and coalesce(c.messages->'double'->'week', '[]'::jsonb) @> to_jsonb(extract(isodow from l)::int)
    and extract(hour from l) >= coalesce((c.messages->'double'->>'from')::int, 15)
    and extract(hour from l) < coalesce((c.messages->'double'->>'to')::int, 17)
  from (select now() at time zone case c.lang when 'pl' then 'Europe/Warsaw' else 'Europe/Rome' end as l) t
$$;

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
drop function if exists join_card(text, text, text, text, date, boolean);
