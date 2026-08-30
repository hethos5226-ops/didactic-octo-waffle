-- SCROLLR — fixes from the pre-pause security, privacy and cost audit
--
-- Every item here was found by executing an attack against a real PostgreSQL,
-- not by reading the SQL. The probes are preserved as tests in
-- supabase/tests/rls_test.sql so none of them can quietly come back.
--
-- Three themes:
--
--   * Authorisation gaps in functions that were written for the happy path and
--     never asked "what if the caller is not who I imagined?"
--   * Fabricated activity: places where a client could invent an event that
--     never happened, which is the thing SCROLLR most needs not to do.
--   * Unbounded growth: writes with no ceiling. On a free tier the cost of an
--     unbounded write path is the whole database.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. blocked_between leaked private block relationships
--
-- The function is SECURITY DEFINER and took two arbitrary user ids, so any
-- signed-in user could ask "has alice blocked bob?" about two strangers and
-- get a truthful answer. Block lists are private by design — publishing one
-- tells the blocked person they were blocked, which is the single thing
-- blocking must never do.
--
-- The policies that use it always pass the caller as one of the two parties,
-- so restricting it to that case costs nothing and closes the oracle.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    -- Only answerable about yourself. A question about two other people is
    -- not refused with an error, because an error is itself an answer when
    -- you can tell it apart from `false`; it simply reports no block.
    when auth.uid() is null or auth.uid() not in (a, b) then false
    else exists (
      select 1 from public.blocks
       where (blocker_id = a and blocked_id = b)
          or (blocker_id = b and blocked_id = a)
    )
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. touch_lobby_presence extended any lobby, for anyone
--
-- The heartbeat pushed `expires_at` two hours into the future for whatever
-- lobby id it was handed, with no check that the caller was in it. A stranger
-- could keep an abandoned lobby alive indefinitely, which defeats the cleanup
-- that stops dead lobbies accumulating — a correctness problem and, on a free
-- tier, a cost one.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.touch_lobby_presence(p_lobby uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  seat_count integer;
begin
  update public.lobby_members
     set last_seen_at = now()
   where lobby_id = p_lobby and user_id = auth.uid() and left_at is null;

  get diagnostics seat_count = row_count;

  -- No seat, no heartbeat. Silently doing nothing is right: a client whose
  -- seat was swept while it was backgrounded should stop extending the lobby,
  -- not receive an error it has no way to act on.
  if seat_count = 0 then
    return;
  end if;

  update public.lobbies
     set updated_at = now(), expires_at = now() + interval '2 hours'
   where id = p_lobby;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3 & 4. Lobbies had no capacity at all
--
-- A `group_size = 1` lobby accepted three people, and the host could call
-- fill_lobby_with_bots repeatedly to seat 24 bots in it. Nothing enforced a
-- ceiling in either direction: unbounded rows, and a lobby that reports a size
-- unrelated to the game being played.
--
-- Capacity is group_size * 2, because the modes are 1v1, 2v2 and 3v3.
-- Enforced by a trigger rather than a policy: a policy cannot count the rows
-- it is about to add to.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.lobby_capacity(p_lobby uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select group_size * 2 from public.lobbies where id = p_lobby), 0);
$$;

create or replace function public.enforce_lobby_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seated integer;
  cap    integer;
begin
  -- Re-taking a seat you already hold is not a new occupant.
  if new.left_at is not null then
    return new;
  end if;

  cap := public.lobby_capacity(new.lobby_id);

  select count(*) into seated
    from public.lobby_members
   where lobby_id = new.lobby_id
     and left_at is null
     and id is distinct from new.id;

  if cap > 0 and seated >= cap then
    raise exception 'lobby is full' using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists lobby_members_capacity on public.lobby_members;
create trigger lobby_members_capacity
  before insert or update on public.lobby_members
  for each row execute function public.enforce_lobby_capacity();

/*
 * Bots fill what is left, and never more.
 *
 * The per-call cap was never the real limit — the function could simply be
 * called again. The limit that matters is the lobby's, so it is read here
 * rather than trusted from the argument.
 */
create or replace function public.fill_lobby_with_bots(p_lobby uuid, p_count integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me      uuid := auth.uid();
  added   integer := 0;
  seated  integer;
  cap     integer;
  room    integer;
  b       record;
begin
  if me is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.lobbies where id = p_lobby and host_id = me) then
    raise exception 'only the host can add bots' using errcode = 'insufficient_privilege';
  end if;
  if p_count < 0 then
    raise exception 'unreasonable bot count' using errcode = 'check_violation';
  end if;

  cap := public.lobby_capacity(p_lobby);
  select count(*) into seated
    from public.lobby_members where lobby_id = p_lobby and left_at is null;

  room := greatest(cap - seated, 0);
  if room = 0 then
    return 0;
  end if;

  for b in
    select id from public.bots
     where active
       and id not in (
         select bot_id from public.lobby_members
          where lobby_id = p_lobby and bot_id is not null and left_at is null)
     order by md5(id || p_lobby::text)
     limit least(p_count, room)
  loop
    insert into public.lobby_members (lobby_id, bot_id) values (p_lobby, b.id)
    on conflict do nothing;
    added := added + 1;
  end loop;

  return added;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. A host could attribute a round to someone who was never in the lobby
--
-- `lobby_rounds` accepted any `scroller_user_id`. A host could therefore
-- manufacture a round — and a feed score — against a stranger's name. That is
-- fabricated activity attached to a real person, which is exactly what SCROLLR
-- must never produce.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.validate_round_scroller()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.scroller_user_id is not null
     and not exists (
       select 1 from public.lobby_members m
        where m.lobby_id = new.lobby_id and m.user_id = new.scroller_user_id)
  then
    raise exception 'the scroller was never in this lobby'
      using errcode = 'check_violation';
  end if;

  if new.scroller_bot_id is not null
     and not exists (
       select 1 from public.lobby_members m
        where m.lobby_id = new.lobby_id and m.bot_id = new.scroller_bot_id)
  then
    raise exception 'that bot was never in this lobby'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists lobby_rounds_validate_scroller on public.lobby_rounds;
create trigger lobby_rounds_validate_scroller
  before insert or update on public.lobby_rounds
  for each row execute function public.validate_round_scroller();

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Notifications could be invented, and there was no limit on them
--
-- The insert policy only checked that the actor was you. So you could tell
-- anyone that you had accepted a friend request they never sent, and you could
-- do it five hundred times.
--
-- The fix is to stop the client writing notifications at all. Every kind
-- corresponds to an event that already has its own properly-guarded table, so
-- the notification is generated from the event rather than asserted alongside
-- it. Forging one now requires performing the real thing first, and the real
-- things are bounded by their own unique constraints.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "notify others as yourself" on public.notifications;

create or replace function public.notify_on_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (user_id, actor_id, kind)
    values (new.addressee_id, new.requester_id, 'request');

  elsif tg_op = 'UPDATE'
        and new.status = 'accepted' and old.status is distinct from 'accepted' then
    -- The requester is told, by the person who accepted.
    insert into public.notifications (user_id, actor_id, kind)
    values (new.requester_id, new.addressee_id, 'accepted');
  end if;
  return null;
end $$;

drop trigger if exists friend_requests_notify on public.friend_requests;
create trigger friend_requests_notify
  after insert or update on public.friend_requests
  for each row execute function public.notify_on_friend_request();

create or replace function public.notify_on_profile_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, kind)
  values (new.liked_id, new.liker_id, 'liked');
  return null;
end $$;

drop trigger if exists profile_likes_notify on public.profile_likes;
create trigger profile_likes_notify
  after insert on public.profile_likes
  for each row execute function public.notify_on_profile_like();

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Duplicate reports
--
-- Two hundred identical reports against one person is not two hundred signals,
-- it is one signal and a lot of rows. Deduplicating open reports keeps the
-- queue meaningful and removes the write amplification.
--
-- Deliberately scoped to open reports: once a report is actioned or dismissed,
-- a fresh one about new behaviour is legitimate.
-- ─────────────────────────────────────────────────────────────────────────
create unique index if not exists reports_one_open_per_subject_user
  on public.reports (reporter_id, subject_user_id, reason)
  where status = 'open' and subject_user_id is not null;

create unique index if not exists reports_one_open_per_subject_video
  on public.reports (reporter_id, subject_video_id, reason)
  where status = 'open' and subject_video_id is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Match history grew without limit
--
-- A thousand rows went in without complaint, and nothing would ever remove
-- them. The app only ever shows a recent slice, so the database keeping every
-- match forever is pure cost — and on a free tier, the database filling up is
-- the app stopping.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.trim_match_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.matches
   where user_id = new.user_id
     and id not in (
       select id from public.matches
        where user_id = new.user_id
        order by played_at desc
        limit 50);
  return null;
end $$;

drop trigger if exists matches_trim on public.matches;
create trigger matches_trim
  after insert on public.matches
  for each row execute function public.trim_match_history();

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Hardening
-- ─────────────────────────────────────────────────────────────────────────

-- The column guard is the thing standing between a client and its own Premium
-- flag, and it ran with whatever search_path the caller had. Pinning it costs
-- nothing and removes a class of attack that depends on shadowing a name.
create or replace function public.guard_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('scroll.server_write', true), 'off') = 'on' then
    return new;
  end if;
  if current_user in ('service_role', 'postgres') then
    return new;
  end if;

  if tg_op = 'INSERT' then
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
  new.id                 := old.id;
  new.created_at         := old.created_at;
  return new;
end $$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Signed-out visitors have no reason to enumerate lobbies. Discovery is for
-- people who could actually join one.
drop policy if exists "see lobbies you can join or are in" on public.lobbies;
create policy "see lobbies you can join or are in"
  on public.lobbies for select
  using (
    (auth.uid() is not null and mode = 'random' and status = 'open' and expires_at > now())
    or host_id = auth.uid()
    or public.in_lobby(id)
  );

-- Trigger functions are only ever reached through their triggers; a direct
-- call fails. Revoking is tidiness rather than a fix, and keeps the surface
-- readable when someone next audits it.
revoke all on function public.sync_follower_count() from public;
revoke all on function public.sync_profile_like_count() from public;
revoke all on function public.sync_premium_flag() from public;
revoke all on function public.guard_profile_columns() from public;
revoke all on function public.touch_updated_at() from public;
revoke all on function public.notify_on_friend_request() from public;
revoke all on function public.notify_on_profile_like() from public;
revoke all on function public.trim_match_history() from public;
revoke all on function public.enforce_lobby_capacity() from public;
revoke all on function public.validate_round_scroller() from public;

revoke all on function public.lobby_capacity(uuid) from public;
grant execute on function public.lobby_capacity(uuid) to authenticated;
