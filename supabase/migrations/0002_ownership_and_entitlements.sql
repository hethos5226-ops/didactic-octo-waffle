-- SCROLLR — server-owned columns, entitlements, and real like counts
--
-- 0001 got ownership right for rows: you cannot write a row that belongs to
-- someone else. What it did not do is protect *columns* inside a row you do
-- own, and that turns out to matter more.
--
-- The app writes profiles with an upsert of the whole row. Row-level security
-- correctly allows that — it is your row. But the row carries `premium`, `xp`,
-- `follower_count` and `profile_likes`, so "you may write your own row" also
-- meant "you may award yourself Premium, any level, and any number of
-- followers" with a single crafted request. The RLS test suite demonstrates
-- this against 0001: `update profiles set premium = true where id = <self>`
-- succeeds.
--
-- The fix is to separate what a person says about themselves from what the
-- system has determined about them. Display name, bio, avatar, country, vibes
-- and hashtags are self-description and stay writable. Entitlements, currency
-- and counts are outcomes, and outcomes are the server's to decide.

-- ─────────────────────────────────────────────────────────────────────────
-- entitlements
--
-- Premium is a subscription, and a subscription is a fact held by a billing
-- system — the App Store, Play Store, or an operator granting a comp. It is
-- never something the client asserts. This table is that fact, and no policy
-- lets any browser role write to it: it is reachable only by the service role,
-- which is what a future receipt-validation function will run as.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.entitlements (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  tier        text not null default 'free'   check (tier in ('free', 'premium')),
  status      text not null default 'none'
                check (status in ('none', 'active', 'grace', 'expired', 'cancelled')),
  -- Where the entitlement came from, so a support question has an answer.
  source      text not null default 'none'
                check (source in ('none', 'app_store', 'play_store', 'promo', 'manual')),
  -- Opaque to us; the store's own subscription identifier when there is one.
  external_id text,
  started_at  timestamptz,
  expires_at  timestamptz,
  updated_at  timestamptz not null default now()
);

alter table public.entitlements enable row level security;

-- You may see your own entitlement, which is what the app needs to show the
-- Premium state. There is deliberately no insert, update or delete policy:
-- absent a policy, RLS denies, so the only writer is the service role.
drop policy if exists "read your own entitlement" on public.entitlements;
create policy "read your own entitlement"
  on public.entitlements for select
  using (auth.uid() = user_id);

/*
 * Is this user actually entitled right now?
 *
 * One definition, used by the trigger below and available to future policies,
 * so "is this person Premium" cannot drift between call sites. An expiry in
 * the past is not Premium regardless of what the row says, which is what makes
 * a lapsed subscription lapse without anything having to run on a schedule.
 */
create or replace function public.has_premium(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = p_user
      and e.tier = 'premium'
      and e.status in ('active', 'grace')
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- profile likes
--
-- `profiles.profile_likes` was a plain integer the client could set to
-- anything. A like is a relationship between two people, so it belongs in a
-- table where it can be attributed, deduplicated and counted — the same shape
-- `follows` already uses.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.profile_likes (
  liker_id   uuid not null references public.profiles (id) on delete cascade,
  liked_id   uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (liker_id, liked_id),
  check (liker_id <> liked_id)
);

create index if not exists profile_likes_liked_idx on public.profile_likes (liked_id);

alter table public.profile_likes enable row level security;

drop policy if exists "likes are readable by everyone" on public.profile_likes;
create policy "likes are readable by everyone"
  on public.profile_likes for select using (true);

drop policy if exists "like as yourself" on public.profile_likes;
create policy "like as yourself"
  on public.profile_likes for insert with check (auth.uid() = liker_id);

drop policy if exists "unlike as yourself" on public.profile_likes;
create policy "unlike as yourself"
  on public.profile_likes for delete using (auth.uid() = liker_id);

create or replace function public.sync_profile_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('scroll.server_write', 'on', true);
  if tg_op = 'INSERT' then
    update public.profiles set profile_likes = profile_likes + 1 where id = new.liked_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set profile_likes = greatest(profile_likes - 1, 0) where id = old.liked_id;
  end if;
  perform set_config('scroll.server_write', 'off', true);
  return null;
end $$;

drop trigger if exists profile_likes_count_trigger on public.profile_likes;
create trigger profile_likes_count_trigger
  after insert or delete on public.profile_likes
  for each row execute function public.sync_profile_like_count();

-- The existing follower-count trigger writes a server-owned column too, so it
-- needs the same escape hatch as the guard below understands.
create or replace function public.sync_follower_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('scroll.server_write', 'on', true);
  if tg_op = 'INSERT' then
    update public.profiles set follower_count = follower_count + 1 where id = new.following_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set follower_count = greatest(follower_count - 1, 0) where id = old.following_id;
  end if;
  perform set_config('scroll.server_write', 'off', true);
  return null;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- moderation state
--
-- Needed here rather than with the rest of moderation because the column is
-- server-owned and the guard below has to know about it: an account cannot be
-- allowed to lift its own suspension.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists status text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_status_check
      check (status in ('active', 'suspended', 'deleted'));
  end if;
end $$;

-- Marks an account as a bot in the directory. Real users can never set it, so
-- a bot cannot pose as a person and a person cannot pose as a bot.
alter table public.profiles
  add column if not exists is_bot boolean not null default false;

-- ─────────────────────────────────────────────────────────────────────────
-- the guard
--
-- Server-owned columns are silently held at their stored value rather than
-- raising. The client legitimately round-trips the whole row on every save, so
-- an exception would turn an ordinary profile edit into a failure whenever the
-- client's copy of a counter was merely stale. Coercion keeps honest saves
-- working and makes dishonest ones a no-op, which is the behaviour that
-- matters: after the attempt, the stored value is unchanged.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.guard_profile_columns()
returns trigger
language plpgsql
as $$
begin
  -- Triggers and RPCs that legitimately maintain these columns announce
  -- themselves with a transaction-local flag.
  if coalesce(current_setting('scroll.server_write', true), 'off') = 'on' then
    return new;
  end if;
  -- The service role bypasses RLS by design and is never reachable from a
  -- browser; it is how receipt validation and moderation tooling will write.
  if current_user in ('service_role', 'postgres') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A brand-new profile starts with nothing earned and nothing granted,
    -- whatever the request happened to contain.
    new.premium            := false;
    new.xp                 := 0;
    new.follower_count     := 0;
    new.profile_likes      := 0;
    new.sessions_played    := 0;
    new.rounds_scrolled    := 0;
    new.reactions_sent     := 0;
    new.reactions_received := 0;
    new.status             := 'active';
    new.is_bot             := false;
    return new;
  end if;

  new.premium            := old.premium;
  new.xp                 := old.xp;
  new.follower_count     := old.follower_count;
  new.profile_likes      := old.profile_likes;
  new.sessions_played    := old.sessions_played;
  new.rounds_scrolled    := old.rounds_scrolled;
  new.reactions_sent     := old.reactions_sent;
  new.reactions_received := old.reactions_received;
  new.status             := old.status;
  new.is_bot             := old.is_bot;
  -- The identity itself is fixed at creation.
  new.id                 := old.id;
  new.created_at         := old.created_at;
  return new;
end $$;

drop trigger if exists profiles_guard_trigger on public.profiles;
create trigger profiles_guard_trigger
  before insert or update on public.profiles
  for each row execute function public.guard_profile_columns();

/*
 * Keeps the cached `profiles.premium` flag in step with the entitlement.
 *
 * The flag is a convenience for reads — the directory and every profile card
 * want it, and a join per card would be wasteful. `entitlements` remains the
 * source of truth; this only mirrors it.
 */
create or replace function public.sync_premium_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('scroll.server_write', 'on', true);
  update public.profiles
     set premium = public.has_premium(new.user_id)
   where id = new.user_id;
  perform set_config('scroll.server_write', 'off', true);
  return null;
end $$;

drop trigger if exists entitlements_sync_premium on public.entitlements;
create trigger entitlements_sync_premium
  after insert or update on public.entitlements
  for each row execute function public.sync_premium_flag();

-- ─────────────────────────────────────────────────────────────────────────
-- session results
--
-- XP and the play counters have to move somehow, and the client cannot be
-- allowed to simply state their new values. This is the narrow, bounded way
-- in: increments only, each one capped at more than a real session could
-- plausibly produce, always applied to the caller and nobody else.
--
-- It is not anti-cheat. A determined player can still call it repeatedly, and
-- making that impossible needs server-authoritative sessions — see
-- ARCHITECTURE.md. What it does remove is the one-request jump to any value,
-- which is the difference between a leaderboard that is roughly honest and one
-- that is meaningless.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.apply_session_result(
  p_xp                 integer,
  p_rounds             integer default 0,
  p_reactions_sent     integer default 0,
  p_reactions_received integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  -- Caps, not validation. A session cannot legitimately produce more than
  -- this, so anything larger is a bug or an attempt.
  if p_xp < 0 or p_xp > 2000
     or p_rounds < 0 or p_rounds > 50
     or p_reactions_sent < 0 or p_reactions_sent > 500
     or p_reactions_received < 0 or p_reactions_received > 500 then
    raise exception 'session result out of range' using errcode = 'check_violation';
  end if;

  perform set_config('scroll.server_write', 'on', true);
  update public.profiles
     set xp                 = xp + p_xp,
         sessions_played    = sessions_played + 1,
         rounds_scrolled    = rounds_scrolled + p_rounds,
         reactions_sent     = reactions_sent + p_reactions_sent,
         reactions_received = reactions_received + p_reactions_received
   where id = me;
  perform set_config('scroll.server_write', 'off', true);
end $$;

revoke all on function public.apply_session_result(integer, integer, integer, integer) from public;
grant execute on function public.apply_session_result(integer, integer, integer, integer) to authenticated;

revoke all on function public.has_premium(uuid) from public;
grant execute on function public.has_premium(uuid) to authenticated, anon;
