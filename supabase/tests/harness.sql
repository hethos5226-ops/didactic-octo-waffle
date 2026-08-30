-- A local stand-in for the parts of Supabase the migrations depend on.
--
-- The point of this file is to let the real migrations run against a real
-- PostgreSQL, so the row-level security policies can be *executed* rather than
-- read and assumed correct. Reading a policy tells you what someone intended.
-- Running it tells you what the database will actually do when a browser sends
-- a request that its author never considered.
--
-- What Supabase provides in production and this recreates:
--   * the `anon`, `authenticated` and `service_role` roles PostgREST switches to
--   * the `auth` schema, `auth.users`, and `auth.uid()` / `auth.role()`
--   * the `storage` schema with `buckets` and `objects`
--
-- It is deliberately minimal. Anything beyond what the migrations touch would
-- be guesswork about Supabase's internals, and a harness that drifts from
-- production is worse than no harness at all.

-- ── roles ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    -- bypassrls mirrors production: the service role is not subject to policies,
    -- which is exactly why it must never reach the browser.
    create role service_role nologin bypassrls;
  end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;

-- ── auth.users ───────────────────────────────────────────────────────────
create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

/*
 * How a request says who it is.
 *
 * PostgREST sets request.jwt.claims from the verified JWT before running the
 * statement. Everything in the policies keys off auth.uid(), so impersonating
 * a user in a test is a matter of setting the same GUC — which is also a
 * faithful reproduction of the only lever an attacker would have.
 */
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user);
$$;

-- ── storage ──────────────────────────────────────────────────────────────
create table if not exists storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets (id),
  name      text not null,
  owner     uuid,
  unique (bucket_id, name)
);

alter table storage.objects enable row level security;

/*
 * Supabase's own helper: splits an object name into path segments, so a policy
 * can say "the first folder must be your user id". The migration's avatar
 * policies use it, so the harness has to provide it with the same semantics.
 */
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select string_to_array(name, '/');
$$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;

/*
 * Supabase grants table privileges to anon and authenticated by default, and
 * leaves row-level security to decide what those roles can actually reach.
 * The harness must do the same: without these grants every test would pass
 * because the role cannot see the table at all, which proves nothing about
 * the policies and would hide a genuinely open one.
 */
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;

grant all on all tables in schema storage to anon, authenticated, service_role;
