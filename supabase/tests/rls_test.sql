-- Adversarial tests for the row-level security policies.
--
-- Each case impersonates a user the same way a real request does — by setting
-- the JWT claim PostgREST sets — and then tries something it must not be
-- allowed to do. A case passes when the database refuses.
--
-- Run with: npm run test:rls

\set ON_ERROR_STOP on
\pset pager off
set client_min_messages to notice;

-- ── fixtures ─────────────────────────────────────────────────────────────
-- Three people: alice and bob are ordinary users, mallory is the attacker.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.test'),
  ('33333333-3333-3333-3333-333333333333', 'mallory@example.test'),
  ('44444444-4444-4444-4444-444444444444', 'mallory2@example.test')
on conflict do nothing;

insert into public.profiles (id, handle, display_name) values
  ('11111111-1111-1111-1111-111111111111', 'alice', 'Alice'),
  ('22222222-2222-2222-2222-222222222222', 'bob',   'Bob'),
  ('33333333-3333-3333-3333-333333333333', 'mallory', 'Mallory')
on conflict do nothing;

\set alice   '''11111111-1111-1111-1111-111111111111'''
\set bob     '''22222222-2222-2222-2222-222222222222'''
\set mallory '''33333333-3333-3333-3333-333333333333'''
\set mallory2 '''44444444-4444-4444-4444-444444444444'''

do $$ begin raise notice ''; raise notice '── profiles ──'; end $$;

-- A public directory is intentional: you have to be able to find people to
-- play with. What must never be public is the ability to write.
select tests.check(
  tests.visible_rows('select count(*)::int from public.profiles', :mallory) = 3,
  'profiles are readable — the directory needs this');

select tests.check(
  tests.denied(
    'update public.profiles set display_name = ''pwned'' where id = ' || quote_literal(:alice),
    :mallory),
  'cannot modify another user''s profile');

select tests.check(
  tests.denied(
    'update public.profiles set handle = ''stolen'' where id = ' || quote_literal(:alice),
    :mallory),
  'cannot steal another user''s handle');

select tests.check(
  tests.denied(
    'insert into public.profiles (id, handle) values (' || quote_literal(:alice) || ', ''impostor'')',
    :mallory),
  'cannot create a profile row owned by someone else');

select tests.check(
  tests.denied('delete from public.profiles where id = ' || quote_literal(:alice), :mallory),
  'cannot delete another user''s profile');

select tests.check(
  tests.allowed(
    'update public.profiles set display_name = ''Alice A'' where id = ' || quote_literal(:alice),
    :alice),
  'can edit your own profile');

do $$ begin raise notice ''; raise notice '── premium / self-granted privilege ──'; end $$;

-- The interesting attack is not mallory against alice; it is mallory against
-- the pricing model on her own row. A client that can write its own
-- entitlement is a client that has none.
--
-- These columns are protected by coercion rather than refusal — the write is
-- accepted and then held at the stored value, because the app round-trips the
-- whole profile row on every save and an exception would break honest edits.
-- So each case asks the only question that matters: afterwards, did the stored
-- value change?

select tests.attempt(
  'update public.profiles set premium = true where id = ' || quote_literal(:mallory),
  :mallory);
select tests.check(
  tests.truth('select premium::text from public.profiles where id = ' || quote_literal(:mallory)) = 'false',
  'cannot grant yourself premium');

select tests.attempt(
  'update public.profiles set xp = 999999 where id = ' || quote_literal(:mallory),
  :mallory);
select tests.check(
  tests.truth('select xp::text from public.profiles where id = ' || quote_literal(:mallory)) = '0',
  'cannot award yourself xp');

select tests.attempt(
  'update public.profiles set follower_count = 100000 where id = ' || quote_literal(:mallory),
  :mallory);
select tests.check(
  tests.truth('select follower_count::text from public.profiles where id = ' || quote_literal(:mallory)) = '0',
  'cannot inflate your own follower count');

select tests.attempt(
  'update public.profiles set profile_likes = 5000 where id = ' || quote_literal(:mallory),
  :mallory);
select tests.check(
  tests.truth('select profile_likes::text from public.profiles where id = ' || quote_literal(:mallory)) = '0',
  'cannot inflate your own like count');

select tests.attempt(
  'update public.profiles set status = ''active'', is_bot = true where id = ' || quote_literal(:mallory),
  :mallory);
select tests.check(
  tests.truth('select is_bot::text from public.profiles where id = ' || quote_literal(:mallory)) = 'false',
  'cannot mark yourself a bot');

-- A suspended account must not be able to lift its own suspension.
update public.profiles set status = 'suspended' where id = :mallory;
select tests.attempt(
  'update public.profiles set status = ''active'' where id = ' || quote_literal(:mallory),
  :mallory);
select tests.check(
  tests.truth('select status from public.profiles where id = ' || quote_literal(:mallory)) = 'suspended',
  'cannot lift your own suspension');
update public.profiles set status = 'active' where id = :mallory;

select tests.check(
  tests.denied(
    'update public.profiles set premium = true where id = ' || quote_literal(:alice),
    :mallory),
  'cannot grant premium to another user');

-- A new profile cannot arrive pre-loaded with privileges either.
select tests.attempt(
  'insert into public.profiles (id, handle, premium, xp, is_bot) values ('
    || quote_literal(:mallory2) || ', ''mallory2'', true, 50000, true)',
  :mallory2);
select tests.check(
  coalesce(tests.truth('select premium::text from public.profiles where id = ' || quote_literal(:mallory2)), 'absent') <> 'true',
  'cannot create a profile that starts Premium');

do $$ begin raise notice ''; raise notice '── entitlements ──'; end $$;

select tests.check(
  tests.denied(
    'insert into public.entitlements (user_id, tier, status) values ('
      || quote_literal(:mallory) || ', ''premium'', ''active'')',
    :mallory),
  'cannot write your own entitlement');

select tests.check(
  tests.denied(
    'update public.entitlements set tier = ''premium'' where user_id = ' || quote_literal(:alice),
    :mallory),
  'cannot write somebody else''s entitlement');

-- The service role grants it, the way receipt validation eventually will, and
-- the cached flag follows automatically.
insert into public.entitlements (user_id, tier, status, source)
values (:alice, 'premium', 'active', 'manual')
on conflict (user_id) do update set tier = 'premium', status = 'active';

select tests.check(
  tests.truth('select premium::text from public.profiles where id = ' || quote_literal(:alice)) = 'true',
  'a granted entitlement turns the Premium flag on');

select tests.check(
  tests.visible_rows('select count(*)::int from public.entitlements', :mallory) = 0,
  'cannot read another user''s entitlement');

-- An expiry in the past is not Premium, with nothing having to run on a timer.
update public.entitlements set expires_at = now() - interval '1 day' where user_id = :alice;
select tests.check(
  tests.truth('select public.has_premium(' || quote_literal(:alice) || ')::text') = 'false',
  'an expired subscription is not Premium');

do $$ begin raise notice ''; raise notice '── profile likes ──'; end $$;

select tests.check(
  tests.denied(
    'insert into public.profile_likes (liker_id, liked_id) values ('
      || quote_literal(:alice) || ', ' || quote_literal(:bob) || ')',
    :mallory),
  'cannot forge a like from someone else');

select tests.check(
  tests.allowed(
    'insert into public.profile_likes (liker_id, liked_id) values ('
      || quote_literal(:mallory) || ', ' || quote_literal(:bob) || ')',
    :mallory),
  'can like as yourself');

select tests.check(
  tests.truth('select profile_likes::text from public.profiles where id = ' || quote_literal(:bob)) = '1',
  'a real like moves the counter');

do $$ begin raise notice ''; raise notice '── friend requests ──'; end $$;

select tests.check(
  tests.denied(
    'insert into public.friend_requests (requester_id, addressee_id) values ('
      || quote_literal(:alice) || ', ' || quote_literal(:bob) || ')',
    :mallory),
  'cannot forge a friend request from someone else');

select tests.check(
  tests.allowed(
    'insert into public.friend_requests (requester_id, addressee_id) values ('
      || quote_literal(:alice) || ', ' || quote_literal(:bob) || ')',
    :alice),
  'can send your own friend request');

-- The request now sits pending from alice to bob. Mallory is not part of it.
select tests.check(
  tests.visible_rows(
    'select count(*)::int from public.friend_requests', :mallory) = 0,
  'cannot see a friend request you are not part of');

select tests.check(
  tests.visible_rows(
    'select count(*)::int from public.friend_requests', :bob) = 1,
  'can see a friend request addressed to you');

select tests.check(
  tests.denied(
    'update public.friend_requests set status = ''accepted'' where requester_id = '
      || quote_literal(:alice),
    :mallory),
  'cannot accept somebody else''s friend request');

-- The requester accepting their own request would make friendship unilateral.
select tests.check(
  tests.denied(
    'update public.friend_requests set status = ''accepted'' where requester_id = '
      || quote_literal(:alice),
    :alice),
  'cannot accept a request you sent yourself');

select tests.check(
  tests.allowed(
    'update public.friend_requests set status = ''accepted'' where addressee_id = '
      || quote_literal(:bob),
    :bob),
  'the addressee can accept');

select tests.check(
  tests.denied(
    'delete from public.friend_requests where requester_id = ' || quote_literal(:alice),
    :mallory),
  'cannot withdraw somebody else''s request');

do $$ begin raise notice ''; raise notice '── follows ──'; end $$;

select tests.check(
  tests.denied(
    'insert into public.follows (follower_id, following_id) values ('
      || quote_literal(:alice) || ', ' || quote_literal(:mallory) || ')',
    :mallory),
  'cannot forge a follow from someone else');

select tests.check(
  tests.allowed(
    'insert into public.follows (follower_id, following_id) values ('
      || quote_literal(:alice) || ', ' || quote_literal(:bob) || ')',
    :alice),
  'can follow as yourself');

select tests.check(
  tests.denied(
    'delete from public.follows where follower_id = ' || quote_literal(:alice),
    :mallory),
  'cannot unfollow on someone else''s behalf');

do $$ begin raise notice ''; raise notice '── notifications ──'; end $$;

select tests.check(
  tests.denied(
    'insert into public.notifications (user_id, actor_id, kind) values ('
      || quote_literal(:alice) || ', ' || quote_literal(:alice) || ', ''liked'')',
    :mallory),
  'cannot forge a notification that appears to be from someone else');

select tests.check(
  tests.visible_rows('select count(*)::int from public.notifications', :mallory) = 0,
  'cannot read another user''s notifications');

do $$ begin raise notice ''; raise notice '── matches ──'; end $$;

insert into public.matches (user_id, mode, players, best_handle)
values (:alice, 'random', '[{"handle":"alice"}]'::jsonb, 'alice');

select tests.check(
  tests.visible_rows('select count(*)::int from public.matches', :mallory) = 0,
  'cannot read another user''s match history');

select tests.check(
  tests.visible_rows('select count(*)::int from public.matches', :alice) = 1,
  'can read your own match history');

select tests.check(
  tests.denied(
    'insert into public.matches (user_id, mode) values ('
      || quote_literal(:alice) || ', ''random'')',
    :mallory),
  'cannot write a match into another user''s history');

do $$ begin raise notice ''; raise notice '── storage: avatars ──'; end $$;

select tests.check(
  tests.denied(
    'insert into storage.objects (bucket_id, name, owner) values (''avatars'', '''
      || '11111111-1111-1111-1111-111111111111/avatar.jpg'', ' || quote_literal(:mallory) || ')',
    :mallory),
  'cannot upload into another user''s avatar folder');

select tests.check(
  tests.allowed(
    'insert into storage.objects (bucket_id, name, owner) values (''avatars'', '''
      || '33333333-3333-3333-3333-333333333333/avatar.jpg'', ' || quote_literal(:mallory) || ')',
    :mallory),
  'can upload into your own avatar folder');

do $$ begin raise notice ''; raise notice '── anonymous (signed out) ──'; end $$;

-- Everything above ran as `authenticated`. A signed-out visitor holds the same
-- publishable key, so the anon role gets its own pass.
create or replace function tests.anon_denied(sql text) returns boolean
language plpgsql as $$
declare affected integer;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  execute sql;
  get diagnostics affected = row_count;
  reset role;
  return affected = 0;
exception when others then
  reset role;
  return true;
end $$;

select tests.check(
  tests.anon_denied(
    'insert into public.profiles (id, handle) values (gen_random_uuid(), ''anonrogue'')'),
  'anonymous cannot create profiles');

select tests.check(
  tests.anon_denied('update public.profiles set premium = true'),
  'anonymous cannot grant premium');

select tests.check(
  tests.anon_denied('delete from public.profiles'),
  'anonymous cannot delete profiles');

select tests.check(
  tests.anon_denied(
    'insert into public.follows (follower_id, following_id) values ('
      || '''11111111-1111-1111-1111-111111111111'', ''22222222-2222-2222-2222-222222222222'')'),
  'anonymous cannot forge follows');

do $$ begin raise notice ''; raise notice '── bots ──'; end $$;

select tests.check(
  (select count(*) from public.bots) = 200,
  '200 bot identities exist');

select tests.check(
  (select count(*) from auth.users u join public.bots b on b.id::text = u.id::text) = 0,
  'no bot has an authentication account');

select tests.check(
  tests.denied(
    'insert into public.bots (id, handle, display_name, avatar, colour) values '
      || '(''bot_evil'', ''evil.999'', ''Evil'', ''X'', ''#000'')',
    :mallory),
  'cannot invent a bot');

select tests.check(
  tests.denied(
    'update public.bots set display_name = ''Real Person'' where id = ''bot_001''',
    :mallory),
  'cannot edit a bot');

select tests.check(
  tests.denied('delete from public.bots where id = ''bot_001''', :mallory),
  'cannot delete a bot');

do $$ begin raise notice ''; raise notice '── lobbies and real counts ──'; end $$;

-- Alice hosts. Bob is a real player. Bots fill the rest.
insert into public.lobbies (id, host_id, mode, group_size, code)
values ('aaaaaaaa-0000-0000-0000-00000000aaaa', :alice, 'private', 3, 'SCRL01');

select tests.check(
  tests.allowed(
    'insert into public.lobby_members (lobby_id, user_id) values '
      || '(''aaaaaaaa-0000-0000-0000-00000000aaaa'', ' || quote_literal(:alice) || ')',
    :alice),
  'the host can take a seat');

select tests.check(
  tests.denied(
    'insert into public.lobby_members (lobby_id, user_id) values '
      || '(''aaaaaaaa-0000-0000-0000-00000000aaaa'', ' || quote_literal(:alice) || ')',
    :mallory),
  'cannot seat somebody else');

select tests.check(
  tests.denied(
    'insert into public.lobby_members (lobby_id, bot_id) values '
      || '(''aaaaaaaa-0000-0000-0000-00000000aaaa'', ''bot_002'')',
    :mallory),
  'cannot seat a bot by hand — only the host RPC may');

-- A private lobby must not be discoverable by someone who was not told the code.
select tests.check(
  tests.visible_rows('select count(*)::int from public.lobbies', :mallory) = 0,
  'a private lobby is invisible to outsiders');

-- Joining by code is the only way in, and it works. Bob was told the code.
do $$
declare joined uuid;
begin
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  set local role authenticated;
  joined := public.join_lobby_by_code('SCRL01');
  reset role;
  perform tests.check(joined = 'aaaaaaaa-0000-0000-0000-00000000aaaa',
    'the code opens the lobby');
end $$;

do $$
begin
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  set local role authenticated;
  begin
    perform public.join_lobby_by_code('NOPE99');
    reset role;
    perform tests.check(false, 'a wrong code is refused');
  exception when others then
    reset role;
    perform tests.check(true, 'a wrong code is refused');
  end;
end $$;

do $$
declare n integer;
begin
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  n := public.fill_lobby_with_bots('aaaaaaaa-0000-0000-0000-00000000aaaa', 3);
  raise notice 'ok   the host seated % bots', n;
end $$;

-- The whole point: bots occupy seats but are not people.
select tests.check(
  (select count(*) from public.lobby_members
    where lobby_id = 'aaaaaaaa-0000-0000-0000-00000000aaaa' and left_at is null) = 5,
  'the lobby has five seats filled');

-- The requirement, stated as a test: 2 people + 3 bots reports 2, never 5.
select tests.check(
  public.real_member_count('aaaaaaaa-0000-0000-0000-00000000aaaa') = 2,
  'but only TWO of them are real users');

select tests.check(
  (select count(*) from public.lobby_members
    where lobby_id = 'aaaaaaaa-0000-0000-0000-00000000aaaa'
      and bot_id is not null and left_at is null) = 3,
  'and three of them are bots');

-- A seat is a person or a bot, never both and never neither.
select tests.check(
  tests.denied(
    'insert into public.lobby_members (lobby_id, user_id, bot_id) values '
      || '(''aaaaaaaa-0000-0000-0000-00000000aaaa'', ' || quote_literal(:mallory) || ', ''bot_005'')',
    :mallory),
  'a seat cannot be a person and a bot at once');

-- One live seat per person, enforced by the database.
insert into public.lobbies (id, host_id, mode, group_size)
values ('bbbbbbbb-0000-0000-0000-00000000bbbb', :bob, 'random', 1);

select tests.check(
  tests.denied(
    'insert into public.lobby_members (lobby_id, user_id) values '
      || '(''bbbbbbbb-0000-0000-0000-00000000bbbb'', ' || quote_literal(:alice) || ')',
    :alice),
  'cannot hold two live seats at once');

do $$ begin raise notice ''; raise notice '── disconnect cleanup ──'; end $$;

-- Simulate a browser that closed without saying goodbye, in a lobby that has
-- been running long enough to be past the new-lobby grace period.
update public.lobby_members set last_seen_at = now() - interval '10 minutes'
 where lobby_id = 'aaaaaaaa-0000-0000-0000-00000000aaaa';
update public.lobbies set created_at = now() - interval '30 minutes'
 where id = 'aaaaaaaa-0000-0000-0000-00000000aaaa';
select public.cleanup_stale_lobbies();

select tests.check(
  public.real_member_count('aaaaaaaa-0000-0000-0000-00000000aaaa') = 0,
  'a silent client loses its seat');

select tests.check(
  (select status from public.lobbies where id = 'aaaaaaaa-0000-0000-0000-00000000aaaa') = 'abandoned',
  'a lobby with nobody real left is abandoned, not immortal');

-- A lobby created moments ago must survive the sweep even though it is still
-- empty, or creating one becomes a race the host can lose.
select tests.check(
  (select status from public.lobbies where id = 'bbbbbbbb-0000-0000-0000-00000000bbbb') = 'open',
  'a brand-new empty lobby is not swept away');

-- And the freed seat can be taken again, so cleanup actually unblocks a user.
select tests.check(
  tests.allowed(
    'insert into public.lobby_members (lobby_id, user_id) values '
      || '(''bbbbbbbb-0000-0000-0000-00000000bbbb'', ' || quote_literal(:alice) || ')',
    :alice),
  'the freed player can join a new lobby');

do $$ begin raise notice ''; raise notice '── blocking and reporting ──'; end $$;

select tests.check(
  tests.allowed(
    'insert into public.blocks (blocker_id, blocked_id) values ('
      || quote_literal(:bob) || ', ' || quote_literal(:mallory) || ')',
    :bob),
  'can block someone');

-- A block list must not be readable by the person it names, or blocking
-- becomes an announcement.
select tests.check(
  tests.visible_rows('select count(*)::int from public.blocks', :mallory) = 0,
  'the blocked person cannot see they were blocked');

select tests.check(
  tests.denied(
    'insert into public.friend_requests (requester_id, addressee_id) values ('
      || quote_literal(:mallory) || ', ' || quote_literal(:bob) || ')',
    :mallory),
  'a blocked person cannot send a friend request');

select tests.check(
  tests.denied(
    'insert into public.follows (follower_id, following_id) values ('
      || quote_literal(:mallory) || ', ' || quote_literal(:bob) || ')',
    :mallory),
  'a blocked person cannot follow');

select tests.check(
  tests.denied(
    'insert into public.blocks (blocker_id, blocked_id) values ('
      || quote_literal(:alice) || ', ' || quote_literal(:bob) || ')',
    :mallory),
  'cannot block on somebody else''s behalf');

select tests.check(
  tests.allowed(
    'insert into public.reports (reporter_id, subject_user_id, reason) values ('
      || quote_literal(:bob) || ', ' || quote_literal(:mallory) || ', ''harassment'')',
    :bob),
  'can report someone');

select tests.check(
  tests.denied(
    'insert into public.reports (reporter_id, subject_user_id, reason) values ('
      || quote_literal(:alice) || ', ' || quote_literal(:bob) || ', ''spam'')',
    :mallory),
  'cannot file a report in someone else''s name');

select tests.check(
  tests.visible_rows('select count(*)::int from public.reports', :mallory) = 0,
  'cannot see reports filed about you');

select tests.check(
  tests.denied(
    'update public.reports set status = ''dismissed''',
    :mallory),
  'cannot dismiss a report about yourself');

do $$ begin raise notice ''; raise notice '── video references ──'; end $$;

select tests.check(
  (select count(*) from public.video_sources where enabled) = 1,
  'exactly one video source is enabled — the built-in sample content');

select tests.check(
  (select count(*) from public.video_sources where id in ('instagram','tiktok') and enabled) = 0,
  'Instagram and TikTok are declared but switched off');

select tests.check(
  tests.denied(
    'insert into public.video_refs (source_id, external_id) values (''sample'', ''forged'')',
    :mallory),
  'cannot add to the video catalogue');

do $$ begin raise notice ''; raise notice '── account deletion ──'; end $$;

-- Give mallory something to lose first, so deletion has work to do.
insert into public.follows (follower_id, following_id) values (:mallory, :alice)
  on conflict do nothing;
insert into public.notifications (user_id, actor_id, kind) values (:mallory, :alice, 'liked');
insert into public.matches (user_id, mode) values (:mallory, 'random');
insert into public.entitlements (user_id, tier, status) values (:mallory, 'premium', 'active')
  on conflict (user_id) do nothing;
insert into storage.objects (bucket_id, name, owner)
  values ('avatars', '33333333-3333-3333-3333-333333333333/avatar.jpg', :mallory)
  on conflict do nothing;

do $$
begin
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  set local role authenticated;
  perform public.delete_my_account();
  reset role;
end $$;

select tests.check(
  (select count(*) from public.profiles where id = :mallory) = 0,
  'the profile is gone');
select tests.check(
  (select count(*) from public.follows where follower_id = :mallory or following_id = :mallory) = 0,
  'follows are gone');
select tests.check(
  (select count(*) from public.notifications where user_id = :mallory) = 0,
  'notifications are gone');
select tests.check(
  (select count(*) from public.matches where user_id = :mallory) = 0,
  'match history is gone');
select tests.check(
  (select count(*) from public.entitlements where user_id = :mallory) = 0,
  'the entitlement is gone');
select tests.check(
  (select count(*) from public.blocks where blocked_id = :mallory) = 0,
  'blocks naming them are gone');
select tests.check(
  (select count(*) from storage.objects
    where bucket_id = 'avatars' and name like '33333333%') = 0,
  'the avatar file is gone');
select tests.check(
  (select count(*) from public.lobby_members where user_id = :mallory and left_at is null) = 0,
  'no live lobby seat is left behind');

-- Honest about what deletion cannot finish from the browser.
select tests.check(
  (select count(*) from public.deletion_requests where user_id = :mallory) = 1,
  'the auth record removal is queued for the service role');

do $$ begin raise notice ''; raise notice '── audit fixes: authorisation ──'; end $$;

-- Each case below reproduces a probe from the pre-pause audit that succeeded
-- against 0004 and must now fail.

-- The deletion section above removed mallory's profile, so this section
-- rebuilds the cast it needs. The auth.users row survived deletion by design
-- (see 0004), which is why only the profile is recreated.
insert into public.profiles (id, handle, display_name)
values (:mallory, 'mallory2nd', 'Mallory') on conflict (id) do nothing;

-- A private block between two people who are both strangers to the caller.
insert into public.blocks (blocker_id, blocked_id) values (:alice, :bob)
  on conflict do nothing;
select tests.check(
  tests.truth('select public.blocked_between('
    || quote_literal(:alice) || ',' || quote_literal(:bob) || ')::text') = 'false',
  'blocked_between does not answer about two other people');

do $$
declare answered boolean;
begin
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  set local role authenticated;
  answered := public.blocked_between(
    '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
  reset role;
  perform tests.check(answered, 'but it still answers about yourself');
end $$;

-- A stranger must not be able to keep somebody else's lobby alive.
insert into public.lobbies (id, host_id, mode, group_size, expires_at, status)
values ('cccccccc-0000-0000-0000-00000000cccc', :alice, 'random', 1,
        now() + interval '1 minute', 'open');

do $$
declare before_ts timestamptz; after_ts timestamptz;
begin
  select expires_at into before_ts from public.lobbies
   where id = 'cccccccc-0000-0000-0000-00000000cccc';
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  set local role authenticated;
  perform public.touch_lobby_presence('cccccccc-0000-0000-0000-00000000cccc');
  reset role;
  select expires_at into after_ts from public.lobbies
   where id = 'cccccccc-0000-0000-0000-00000000cccc';
  perform tests.check(after_ts = before_ts,
    'a non-member cannot extend a lobby''s life');
end $$;

do $$ begin raise notice ''; raise notice '── audit fixes: capacity and cost ──'; end $$;

-- Earlier sections left people seated, and one live seat per person is
-- enforced, so this section starts by standing everyone up.
update public.lobby_members set left_at = now() where left_at is null;

-- group_size 1 means 1v1, so two seats. A third must be refused.
insert into public.lobbies (id, host_id, mode, group_size, status)
values ('dddddddd-0000-0000-0000-00000000dddd', :alice, 'random', 1, 'open');

select tests.check(
  tests.allowed('insert into public.lobby_members (lobby_id, user_id) values ('
    || '''dddddddd-0000-0000-0000-00000000dddd'', ' || quote_literal(:alice) || ')', :alice),
  'the first player takes a seat');

select tests.check(
  tests.allowed('insert into public.lobby_members (lobby_id, user_id) values ('
    || '''dddddddd-0000-0000-0000-00000000dddd'', ' || quote_literal(:bob) || ')', :bob),
  'the second player takes the last seat');

select tests.check(
  tests.denied('insert into public.lobby_members (lobby_id, user_id) values ('
    || '''dddddddd-0000-0000-0000-00000000dddd'', ' || quote_literal(:mallory) || ')', :mallory),
  'a third player is refused — the lobby is full');

-- Bots fill what is left and never more, however often the host asks.
insert into public.lobbies (id, host_id, mode, group_size, status)
values ('eeeeeeee-0000-0000-0000-00000000eeee', :alice, 'random', 3, 'open');

do $$
declare total integer;
begin
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;
  perform public.fill_lobby_with_bots('eeeeeeee-0000-0000-0000-00000000eeee', 8);
  perform public.fill_lobby_with_bots('eeeeeeee-0000-0000-0000-00000000eeee', 8);
  perform public.fill_lobby_with_bots('eeeeeeee-0000-0000-0000-00000000eeee', 8);
  reset role;
  select count(*) into total from public.lobby_members
   where lobby_id = 'eeeeeeee-0000-0000-0000-00000000eeee' and left_at is null;
  perform tests.check(total = 6,
    'repeated bot filling stops at capacity (3v3 = 6), not 24');
end $$;

-- Match history is bounded, so one client cannot grow the database forever.
do $$
declare kept integer;
begin
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  set local role authenticated;
  insert into public.matches (user_id, mode)
  select '22222222-2222-2222-2222-222222222222', 'random' from generate_series(1, 120);
  reset role;
  select count(*) into kept from public.matches
   where user_id = '22222222-2222-2222-2222-222222222222';
  perform tests.check(kept = 50, 'match history is capped at 50 rows per user');
end $$;

-- Identical open reports collapse into one. (The earlier report about mallory
-- cascaded away when that account was deleted, so this files a fresh one.)
select tests.check(
  tests.allowed(
    'insert into public.reports (reporter_id, subject_user_id, reason) values ('
      || quote_literal(:bob) || ', ' || quote_literal(:mallory) || ', ''harassment'')',
    :bob),
  'a first report is accepted');

select tests.check(
  tests.denied(
    'insert into public.reports (reporter_id, subject_user_id, reason) values ('
      || quote_literal(:bob) || ', ' || quote_literal(:mallory) || ', ''harassment'')',
    :bob),
  'a duplicate open report is refused');

do $$ begin raise notice ''; raise notice '── audit fixes: fabricated activity ──'; end $$;

-- A host cannot manufacture a round against someone who was never present.
select tests.check(
  tests.denied(
    'insert into public.lobby_rounds (lobby_id, round_index, scroller_user_id, feed_score) '
      || 'values (''dddddddd-0000-0000-0000-00000000dddd'', 0, '
      || quote_literal(:mallory) || ', 100)',
    :alice),
  'cannot attribute a round to someone who was never in the lobby');

select tests.check(
  tests.allowed(
    'insert into public.lobby_rounds (lobby_id, round_index, scroller_user_id, feed_score) '
      || 'values (''dddddddd-0000-0000-0000-00000000dddd'', 1, '
      || quote_literal(:bob) || ', 80)',
    :alice),
  'but a real participant''s round records fine');

-- Notifications can no longer be asserted by a client at all.
select tests.check(
  tests.denied(
    'insert into public.notifications (user_id, actor_id, kind) values ('
      || quote_literal(:bob) || ', ' || quote_literal(:mallory) || ', ''accepted'')',
    :mallory),
  'cannot invent an "accepted" notification');

select tests.check(
  tests.denied(
    'insert into public.notifications (user_id, actor_id, kind) '
      || 'select ' || quote_literal(:bob) || ', ' || quote_literal(:mallory)
      || ', ''liked'' from generate_series(1,100)',
    :mallory),
  'cannot flood an inbox');

-- They arrive from the real event instead.
do $$
declare before_n integer; after_n integer;
begin
  select count(*) into before_n from public.notifications
   where user_id = '33333333-3333-3333-3333-333333333333';
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  set local role authenticated;
  insert into public.profile_likes (liker_id, liked_id)
  values ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');
  reset role;
  select count(*) into after_n from public.notifications
   where user_id = '33333333-3333-3333-3333-333333333333';
  perform tests.check(after_n = before_n + 1,
    'a real like generates exactly one notification, server-side');
end $$;

do $$ begin raise notice ''; raise notice '── audit fixes: anonymous exposure ──'; end $$;

select tests.check(
  tests.anon_denied('update public.lobbies set status = ''abandoned'''),
  'anonymous cannot touch lobbies');

do $$
declare visible integer;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  select count(*) into visible from public.lobbies;
  reset role;
  perform tests.check(visible = 0, 'a signed-out visitor cannot enumerate lobbies');
end $$;

do $$ begin raise notice ''; raise notice '── session results: the sanctioned write path ──'; end $$;

-- Making XP server-owned in 0002 closed a real hole and opened a quiet
-- regression: the app wrote XP through the whole-row profile save, which is
-- held at the stored value, so nothing persisted and a player's level reset on
-- every reload. These assert both halves — the escalation stays shut, and the
-- honest increment lands.

do $$
declare before_xp integer; after_xp integer; plays integer;
begin
  select xp into before_xp from public.profiles where id = '11111111-1111-1111-1111-111111111111';
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;
  perform public.apply_session_result(120, 4, 30, 25);
  reset role;
  select xp, sessions_played into after_xp, plays
    from public.profiles where id = '11111111-1111-1111-1111-111111111111';
  perform tests.check(after_xp = before_xp + 120, 'a finished session actually awards XP');
  perform tests.check(plays > 0, 'and counts the session played');
end $$;

-- The cap is what stops the increment becoming a set.
do $$
declare ok boolean := false;
begin
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;
  begin
    perform public.apply_session_result(999999, 0, 0, 0);
    reset role;
  exception when others then
    reset role;
    ok := true;
  end;
  perform tests.check(ok, 'an implausible XP claim is refused outright');
end $$;

-- And it only ever applies to the caller. Measured as a delta rather than an
-- absolute: other parts of the suite legitimately award XP too, and a test
-- that assumes it is the only writer breaks the moment that stops being true.
do $$
declare bob_before integer; bob_after integer; alice_before integer; alice_after integer;
begin
  select xp into bob_before   from public.profiles where id = '22222222-2222-2222-2222-222222222222';
  select xp into alice_before from public.profiles where id = '11111111-1111-1111-1111-111111111111';
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  set local role authenticated;
  perform public.apply_session_result(100, 1, 1, 1);
  reset role;
  select xp into bob_after   from public.profiles where id = '22222222-2222-2222-2222-222222222222';
  select xp into alice_after from public.profiles where id = '11111111-1111-1111-1111-111111111111';
  perform tests.check(bob_after = bob_before + 100 and alice_after = alice_before,
    'the increment lands on the caller, not on anyone else');
end $$;

do $$
declare anon_blocked boolean := false;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  begin
    perform public.apply_session_result(100, 1, 1, 1);
    reset role;
  exception when others then
    reset role;
    anon_blocked := true;
  end;
  perform tests.check(anon_blocked, 'a signed-out caller earns nothing');
end $$;

do $$ begin raise notice ''; raise notice '── column limits ──'; end $$;

-- A single user wrote a two-megabyte display name through the ordinary profile
-- save. On a 500 MB free tier that is the database, and the directory is
-- publicly readable, so one abusive row would be dragged across the wire by
-- every search.

select tests.check(
  tests.denied(
    'update public.profiles set display_name = repeat(''X'', 100000) where id = '
      || quote_literal(:alice),
    :alice),
  'a huge display name is refused');

select tests.check(
  tests.denied(
    'update public.profiles set colour = repeat(''c'', 5000) where id = '
      || quote_literal(:alice),
    :alice),
  'a huge colour is refused');

select tests.check(
  tests.denied(
    'update public.profiles set hashtags = (select array_agg(''h''||g) '
      || 'from generate_series(1,5000) g) where id = ' || quote_literal(:alice),
    :alice),
  'five thousand hashtags are refused');

-- A count limit alone still allows one enormous element.
select tests.check(
  tests.denied(
    'update public.profiles set hashtags = array[repeat(''h'', 10000)] where id = '
      || quote_literal(:alice),
    :alice),
  'one enormous hashtag is refused');

select tests.check(
  tests.denied(
    'update public.profiles set vibes = (select array_agg(''v''||g) '
      || 'from generate_series(1,500) g) where id = ' || quote_literal(:alice),
    :alice),
  'five hundred vibes are refused');

-- Everything the UI can actually produce still saves.
select tests.check(
  tests.allowed(
    'update public.profiles set display_name = ''A perfectly normal name'', '
      || 'colour = ''#FF2E93'', country = ''Australia'', flag = ''AU'', '
      || 'vibes = array[''chaos'',''gaming''], '
      || 'hashtags = array[''memes'',''dogs'',''cooking''] where id = '
      || quote_literal(:alice),
    :alice),
  'an ordinary profile save is unaffected');

do $$ begin raise notice ''; raise notice '── storage: path and object count ──'; end $$;

-- The old policy asked whether the first path segment was your user id.
-- foldername() splits on '/', so a path that climbs back out still passed.
select tests.check(
  tests.denied(
    'insert into storage.objects (bucket_id, name, owner) values (''avatars'', '
      || quote_literal('11111111-1111-1111-1111-111111111111/../22222222-2222-2222-2222-222222222222/avatar.jpg')
      || ', ' || quote_literal(:alice) || ')',
    :alice),
  'a path that climbs out of your own folder is refused');

select tests.check(
  tests.denied(
    'insert into storage.objects (bucket_id, name, owner) values (''avatars'', '
      || quote_literal('11111111-1111-1111-1111-111111111111/junk.jpg')
      || ', ' || quote_literal(:alice) || ')',
    :alice),
  'a second file in your own folder is refused');

select tests.check(
  tests.denied(
    'insert into storage.objects (bucket_id, name, owner) values (''avatars'', '
      || quote_literal('22222222-2222-2222-2222-222222222222/avatar.jpg')
      || ', ' || quote_literal(:alice) || ')',
    :alice),
  'another user''s avatar path is still refused');

-- The path the app actually writes must still work, both to create and to
-- replace — a lock-down that also locks out the legitimate operation is not a
-- fix, it is an outage.
select tests.check(
  tests.allowed(
    'insert into storage.objects (bucket_id, name, owner) values (''avatars'', '
      || quote_literal('11111111-1111-1111-1111-111111111111/avatar.jpg')
      || ', ' || quote_literal(:alice) || ')',
    :alice),
  'you can upload your own avatar at the expected path');

select tests.check(
  tests.allowed(
    'update storage.objects set owner = ' || quote_literal(:alice)
      || ' where bucket_id = ''avatars'' and name = '
      || quote_literal('11111111-1111-1111-1111-111111111111/avatar.jpg'),
    :alice),
  'replacing your own avatar still works');

do $$ begin raise notice ''; raise notice '── social XP reaches the server ──'; end $$;

-- XP awarded outside a session used to be granted locally and never persisted,
-- so a player's level dropped on reload.
do $$
declare before_xp integer; after_xp integer;
begin
  select xp into before_xp from public.profiles where id = '22222222-2222-2222-2222-222222222222';
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;
  insert into public.profile_likes (liker_id, liked_id)
  values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
  reset role;
  select xp into after_xp from public.profiles where id = '22222222-2222-2222-2222-222222222222';
  perform tests.check(after_xp = before_xp + 25,
    'receiving a real profile like awards XP server-side');
end $$;

-- A friendship that is actually accepted awards both sides.
--
-- The blocking section earlier put a block between these two, and blocking
-- correctly prevents a friend request — so it is cleared here rather than
-- worked around.
delete from public.blocks;

do $$
declare a_before integer; b_before integer; a_after integer; b_after integer;
begin
  delete from public.friend_requests;
  select xp into a_before from public.profiles where id = '11111111-1111-1111-1111-111111111111';
  select xp into b_before from public.profiles where id = '22222222-2222-2222-2222-222222222222';

  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;
  insert into public.friend_requests (requester_id, addressee_id)
  values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
  reset role;

  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  set local role authenticated;
  update public.friend_requests set status = 'accepted'
   where addressee_id = '22222222-2222-2222-2222-222222222222';
  reset role;

  select xp into a_after from public.profiles where id = '11111111-1111-1111-1111-111111111111';
  select xp into b_after from public.profiles where id = '22222222-2222-2222-2222-222222222222';
  perform tests.check(a_after = a_before + 60 and b_after = b_before + 60,
    'an accepted friendship awards both sides server-side');
end $$;

-- And the award is still not something a client can ask for directly.
select tests.check(
  tests.denied('select public.award_xp(' || quote_literal(:alice) || ', 500)', :alice),
  'a client cannot call award_xp itself');
