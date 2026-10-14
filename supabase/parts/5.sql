-- Timbro database, part 5 of 7. Run the parts in order.
set search_path = timbro, extensions;

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

create or replace function admin_set_plan(p_card_id text, p_plan text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare c cards;
begin
  if not _is_admin() then raise exception 'Only Witkowski Design can change plans.' using errcode = '42501'; end if;
  update cards set plan = p_plan where id = lower(p_card_id) returning * into c;
  return _card_json(c, true);
end $$;
