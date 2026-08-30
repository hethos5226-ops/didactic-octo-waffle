-- Assertion helpers for the row-level security tests.
--
-- Every browser request is untrusted. PostgREST puts the database directly on
-- the internet, so the anon key in the published bundle is a request-signing
-- key for anyone who opens the site: the only thing standing between a crafted
-- request and the data is a policy. That makes these tests the real security
-- boundary, not a formality.
--
-- Each test impersonates a user exactly the way a request does — by setting
-- the JWT claim PostgREST would set — and then tries to do something it should
-- not be allowed to do. A test passes when the database refuses.
--

\set ON_ERROR_STOP on
\pset pager off

create schema if not exists tests;

-- ── assertion helpers ────────────────────────────────────────────────────
create or replace function tests.check(ok boolean, label text) returns void
language plpgsql as $$
begin
  if ok then
    raise notice 'ok   %', label;
  else
    raise exception 'FAIL %', label;
  end if;
end $$;

/*
 * Runs a statement as a given user and reports whether it was refused.
 *
 * "Refused" deliberately covers both ways the database can say no: an outright
 * policy error (42501), and the quieter one where a policy filters the row out
 * so an UPDATE or DELETE simply affects nothing. The second is easy to miss
 * and just as important — a silent no-op is a refusal, but a policy that lets
 * the row through and changes it is not.
 */
create or replace function tests.denied(sql text, as_user uuid) returns boolean
language plpgsql as $$
declare
  affected integer;
begin
  perform set_config('request.jwt.claim.sub', as_user::text, true);
  set local role authenticated;
  execute sql;
  get diagnostics affected = row_count;
  reset role;
  return affected = 0;
exception
  when insufficient_privilege or check_violation then
    reset role;
    return true;
  when others then
    reset role;
    raise notice '     (refused with %: %)', sqlstate, sqlerrm;
    return true;
end $$;

/* The mirror image: did a legitimate action actually work? */
create or replace function tests.allowed(sql text, as_user uuid) returns boolean
language plpgsql as $$
declare
  affected integer;
begin
  perform set_config('request.jwt.claim.sub', as_user::text, true);
  set local role authenticated;
  execute sql;
  get diagnostics affected = row_count;
  reset role;
  return affected > 0;
exception
  when others then
    reset role;
    raise notice '     (unexpectedly refused with %: %)', sqlstate, sqlerrm;
    return false;
end $$;

create or replace function tests.visible_rows(sql text, as_user uuid) returns integer
language plpgsql as $$
declare
  n integer;
begin
  perform set_config('request.jwt.claim.sub', as_user::text, true);
  set local role authenticated;
  execute sql into n;
  reset role;
  return n;
end $$;

/*
 * Runs a statement as a user and ignores whether it errored.
 *
 * Some protections work by coercion rather than refusal: the write is accepted
 * and then quietly held at the stored value, because the client round-trips
 * whole rows and an exception would break honest saves. For those, "was it
 * refused?" is the wrong question. The right one is "did the value change?",
 * which is what this plus a follow-up read answers.
 */
create or replace function tests.attempt(sql text, as_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', as_user::text, true);
  set local role authenticated;
  execute sql;
  reset role;
exception when others then
  reset role;
end $$;

/* Reads a value as the table owner, bypassing policies, to see ground truth. */
create or replace function tests.truth(sql text) returns text
language plpgsql as $$
declare v text;
begin
  execute sql into v;
  return v;
end $$;
