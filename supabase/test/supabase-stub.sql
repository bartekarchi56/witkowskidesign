-- Minimal stand-in for what Supabase provides, so schema.sql can be tested
-- on a plain Postgres: the anon/authenticated roles, auth.users and auth.uid().
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists auth;
create schema if not exists extensions;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text unique, password text, raw_user_meta_data jsonb);
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, extensions, public to anon, authenticated;

-- pg_net (Supabase's HTTP from SQL): records the calls instead of sending them.
create schema if not exists net;
create table if not exists net.calls (id bigint generated always as identity primary key, url text, body jsonb);
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
returns bigint language sql as $$ insert into net.calls (url, body) values (url, body) returning id $$;
