-- SCROLL — column limits, storage lock-down, and the rest of the XP path
--
-- The last three findings from the pre-pause audit, each demonstrated by
-- executing it against a real PostgreSQL first.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Unbounded profile columns
--
-- `bio` was capped at 120 characters. Nothing else was. A single signed-in
-- user wrote a two-megabyte display name, a hundred-kilobyte colour, and
-- twenty thousand hashtags, all through the ordinary profile save.
--
-- On a 500 MB free tier that is the whole database, filled by a handful of
-- accounts. It is worse than it sounds because the profile directory is
-- publicly readable: every search would drag those rows across the wire, so
-- one abusive row degrades the app for everyone and burns egress doing it.
--
-- The limits below are generous versions of what the UI already enforces
-- (display name 30, handle 18, bio 120, hashtag text 20), so no honest save
-- is affected. Unlike the server-owned columns, these reject rather than
-- coerce: the client cannot produce an oversized value, so one arriving is
-- not a stale round-trip, it is someone probing.
-- ─────────────────────────────────────────────────────────────────────────

-- Existing rows are brought inside the limits first, so the migration is safe
-- to run against a project that already has data in it.
update public.profiles set
  display_name = left(display_name, 40),
  colour       = left(colour, 9),
  country      = left(country, 60),
  flag         = left(flag, 8),
  avatar       = left(avatar, 8),
  vibes        = (select coalesce(array_agg(left(v, 24)), '{}')
                    from unnest(vibes) with ordinality t(v, i) where i <= 12),
  hashtags     = (select coalesce(array_agg(left(h, 30)), '{}')
                    from unnest(hashtags) with ordinality t(h, i) where i <= 20)
where display_name is not null;

do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('profiles_display_name_len', 'char_length(display_name) <= 40'),
      ('profiles_colour_len',       'char_length(colour) <= 9'),
      ('profiles_country_len',      'char_length(country) <= 60'),
      ('profiles_flag_len',         'char_length(flag) <= 8'),
      ('profiles_avatar_len',       'char_length(avatar) <= 8'),
      -- Bounded in both directions: how many elements, and how much text in
      -- total. A limit on the count alone still allows one enormous element,
      -- and a CHECK constraint cannot contain a subquery, so the total is
      -- measured with array_to_string, which is immutable and does the job.
      ('profiles_vibes_bounds',
       'coalesce(array_length(vibes, 1), 0) <= 12 and '
       'char_length(array_to_string(vibes, '','')) <= 320'),
      ('profiles_hashtags_bounds',
       'coalesce(array_length(hashtags, 1), 0) <= 20 and '
       'char_length(array_to_string(hashtags, '','')) <= 700')
    ) as t(name, expr)
  loop
    if not exists (select 1 from pg_constraint where conname = c.name) then
      execute format('alter table public.profiles add constraint %I check (%s)',
                     c.name, c.expr);
    end if;
  end loop;
end $$;

-- Reports carry free text too. `details` was already capped; this bounds the
-- rest of what a reporter controls.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lobby_rounds_reactions_size') then
    alter table public.lobby_rounds
      add constraint lobby_rounds_reactions_size
      check (pg_column_size(reaction_counts) <= 4096);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Storage: the avatar path was checkable but not checked tightly
--
-- The policies asked whether the first path segment equalled the caller's user
-- id. `storage.foldername()` splits on '/', so a name like
--
--     <my-id>/../<victim-id>/avatar.jpg
--
-- satisfies that test — segment one is genuinely my id — while pointing
-- somewhere else entirely. Whether the storage layer then normalises the path
-- is not something a policy should be relying on.
--
-- Separately, nothing limited how many objects a user could create. Five
-- hundred went in without complaint, and storage is billed by what is stored.
--
-- Both close with the same change: the app writes exactly one path per user,
-- so the policy now requires exactly that path. No traversal survives an
-- equality test, and there is nowhere to put a second file.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "users upload their own avatar" on storage.objects;
create policy "users upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '/avatar.jpg'
  );

drop policy if exists "users replace their own avatar" on storage.objects;
create policy "users replace their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '/avatar.jpg'
  )
  with check (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '/avatar.jpg'
  );

drop policy if exists "users delete their own avatar" on storage.objects;
create policy "users delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '/avatar.jpg'
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 3. The rest of the XP path
--
-- 0002 made `xp` server-owned, which closed a real hole. 0005 wired the
-- session result through the sanctioned increment. What was still missing is
-- the XP awarded outside a session: accepting a friend request, and receiving
-- a profile like. The app grants those locally and the server never hears, so
-- a signed-in player's XP drifts above the stored value and drops back on the
-- next reload.
--
-- Granted by trigger from the real row rather than by a client call, for the
-- same reason notifications are: the amount is the server's to decide, and the
-- event is already guarded by its own policy, so there is nothing to forge.
-- The amounts match src/data/levels.ts exactly, so the optimistic value the
-- client shows and the value it reloads to are the same number.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.award_xp(p_user uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 or p_amount > 500 then
    return;
  end if;
  perform set_config('scroll.server_write', 'on', true);
  update public.profiles set xp = xp + p_amount where id = p_user;
  perform set_config('scroll.server_write', 'off', true);
end $$;

create or replace function public.award_xp_on_friendship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Both sides gain, which is what the app already shows each of them.
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform public.award_xp(new.requester_id, 60);   -- XP.friendAdded
    perform public.award_xp(new.addressee_id, 60);
  end if;
  return null;
end $$;

drop trigger if exists friend_requests_award_xp on public.friend_requests;
create trigger friend_requests_award_xp
  after update on public.friend_requests
  for each row execute function public.award_xp_on_friendship();

create or replace function public.award_xp_on_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_xp(new.liked_id, 25);         -- XP.profileLikeReceived
  return null;
end $$;

drop trigger if exists profile_likes_award_xp on public.profile_likes;
create trigger profile_likes_award_xp
  after insert on public.profile_likes
  for each row execute function public.award_xp_on_like();

revoke all on function public.award_xp(uuid, integer) from public;
revoke all on function public.award_xp_on_friendship() from public;
revoke all on function public.award_xp_on_like() from public;
