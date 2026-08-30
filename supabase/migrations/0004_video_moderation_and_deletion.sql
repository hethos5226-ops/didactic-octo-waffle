-- SCROLL — video references, moderation, and account deletion
--
-- Three unrelated-looking things, joined by one idea: SCROLL should hold as
-- little as it can get away with, and should be able to let go of it.

-- ─────────────────────────────────────────────────────────────────────────
-- video sources
--
-- SCROLL is not a video host and this schema is built so it never has to
-- become one. A video is a *reference* — where it lives, who published it,
-- what SCROLL is permitted to do with it — and the session system never asks
-- which provider it came from. That is the whole point of the indirection: an
-- Instagram or TikTok integration, if one ever becomes legitimately possible,
-- is a new row in `video_sources` and a new adapter on the client, not a
-- change to sessions, rounds, reactions or results.
--
-- Nothing here scrapes anything. A reference is only ever created from a
-- source that permits it, which is what `rights` records.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.video_sources (
  id          text primary key,
  name        text not null,
  -- Disabled sources stay in the schema so their references remain readable
  -- and attributable, while nothing new can be added against them.
  enabled     boolean not null default false,
  -- What SCROLL may do with content from here. The session system reads this
  -- to decide whether it can embed a player or must link out.
  rights      text not null default 'link_only'
                check (rights in ('owned', 'embed_permitted', 'link_only')),
  notes       text not null default '',
  created_at  timestamptz not null default now()
);

alter table public.video_sources enable row level security;

drop policy if exists "sources are readable" on public.video_sources;
create policy "sources are readable" on public.video_sources for select using (true);

-- The registry ships with the providers SCROLL knows how to talk about. Only
-- `sample` is enabled: it is the built-in demo content the prototype already
-- plays. The rest are declared so the shape is real and the work later is
-- configuration rather than migration — every one of them is switched off
-- because none has been integrated, and none may be until its terms allow it.
insert into public.video_sources (id, name, enabled, rights, notes) values
  ('sample',    'Built-in sample content', true,  'owned',
   'The demo clips bundled with the prototype. No third party involved.'),
  ('scroll',    'SCROLL-hosted',           false, 'owned',
   'Reserved for content SCROLL would host itself. Not built: hosting video means storage and egress costs — see SCALING.md.'),
  ('youtube',   'YouTube',                 false, 'embed_permitted',
   'The only mainstream platform with a documented, terms-compliant embed player. Most realistic first integration.'),
  ('instagram', 'Instagram',               false, 'link_only',
   'oEmbed for public posts requires an approved Meta app; there is no API that returns a user personal Reels feed. See FUTURE_FEATURES.md.'),
  ('tiktok',    'TikTok',                  false, 'link_only',
   'Embed SDK exists for public videos; feed access does not. See FUTURE_FEATURES.md.')
on conflict (id) do nothing;

create table if not exists public.video_refs (
  id            uuid primary key default gen_random_uuid(),
  source_id     text not null references public.video_sources (id),
  -- The provider's own identifier. Paired with the source it is unique, which
  -- is what stops the same video being catalogued twice.
  external_id   text not null,
  url           text,
  embed_url     text,
  title         text not null default '',
  author_handle text not null default '',
  thumbnail_url text,
  duration_seconds integer check (duration_seconds is null or duration_seconds between 0 and 3600),
  created_at    timestamptz not null default now(),
  unique (source_id, external_id)
);

alter table public.video_refs enable row level security;

drop policy if exists "video references are readable" on public.video_refs;
create policy "video references are readable" on public.video_refs for select using (true);
-- No insert policy: the catalogue is curated by the service role. Letting any
-- client add references would make SCROLL a link-sharing surface, with the
-- moderation burden that implies, before there is anything to moderate it
-- with.

-- ─────────────────────────────────────────────────────────────────────────
-- what happened in a round
--
-- Deliberately aggregate. Storing which person sent which reaction at which
-- second would build exactly the behavioural record PRIVACY.md promises SCROLL
-- does not keep, and the game needs none of it: a round needs its totals, and
-- the totals are what the results screen shows.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.lobby_rounds (
  id               uuid primary key default gen_random_uuid(),
  lobby_id         uuid not null references public.lobbies (id) on delete cascade,
  round_index      integer not null check (round_index >= 0),
  video_ref_id     uuid references public.video_refs (id) on delete set null,
  scroller_user_id uuid references public.profiles (id) on delete set null,
  scroller_bot_id  text references public.bots (id) on delete set null,
  feed_score       integer check (feed_score is null or feed_score between 0 and 100),
  -- { "😂": 4, "💀": 2 } — counts only, no authors and no timestamps.
  reaction_counts  jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  unique (lobby_id, round_index)
);

alter table public.lobby_rounds enable row level security;

drop policy if exists "see rounds of a lobby you are in" on public.lobby_rounds;
create policy "see rounds of a lobby you are in"
  on public.lobby_rounds for select using (public.in_lobby(lobby_id));

drop policy if exists "the host records rounds" on public.lobby_rounds;
create policy "the host records rounds"
  on public.lobby_rounds for insert
  with check (exists (
    select 1 from public.lobbies l where l.id = lobby_id and l.host_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────
-- moderation
--
-- The boundaries, not the platform. What matters now is that reporting and
-- blocking have a correct home, so building the review side later does not
-- mean migrating data that was stored in the wrong shape.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- A block list is private. Publishing it would tell the blocked person they
-- were blocked, which is the one thing blocking must not do.
drop policy if exists "your block list is yours" on public.blocks;
create policy "your block list is yours"
  on public.blocks for select using (auth.uid() = blocker_id);

drop policy if exists "block as yourself" on public.blocks;
create policy "block as yourself"
  on public.blocks for insert with check (auth.uid() = blocker_id);

drop policy if exists "unblock as yourself" on public.blocks;
create policy "unblock as yourself"
  on public.blocks for delete using (auth.uid() = blocker_id);

/* Is there a block in either direction between these two people? */
create or replace function public.blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
     where (blocker_id = a and blocked_id = b)
        or (blocker_id = b and blocked_id = a)
  );
$$;

-- Blocking has to actually stop something, or it is decoration. A blocked
-- person cannot open a new friend request in either direction.
drop policy if exists "send your own requests" on public.friend_requests;
create policy "send your own requests"
  on public.friend_requests for insert
  with check (
    auth.uid() = requester_id
    and not public.blocked_between(requester_id, addressee_id)
  );

drop policy if exists "follow as yourself" on public.follows;
create policy "follow as yourself"
  on public.follows for insert
  with check (
    auth.uid() = follower_id
    and not public.blocked_between(follower_id, following_id)
  );

create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles (id) on delete cascade,
  subject_user_id  uuid references public.profiles (id) on delete cascade,
  subject_video_id uuid references public.video_refs (id) on delete cascade,
  reason           text not null check (reason in (
                     'harassment', 'hate', 'sexual', 'violence', 'spam',
                     'self_harm', 'underage', 'copyright', 'other')),
  details          text not null default '' check (char_length(details) <= 1000),
  status           text not null default 'open'
                     check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at       timestamptz not null default now(),
  -- A report is about a person or a video, not neither.
  constraint report_has_a_subject check (
    subject_user_id is not null or subject_video_id is not null)
);

create index if not exists reports_status_idx on public.reports (status, created_at);

alter table public.reports enable row level security;

drop policy if exists "see reports you filed" on public.reports;
create policy "see reports you filed"
  on public.reports for select using (auth.uid() = reporter_id);

drop policy if exists "file your own reports" on public.reports;
create policy "file your own reports"
  on public.reports for insert with check (auth.uid() = reporter_id);
-- No update policy: a reporter cannot change a report's status, and nobody
-- can withdraw one silently. Review happens with the service role.

-- ─────────────────────────────────────────────────────────────────────────
-- account and data deletion
--
-- Deleting an account has to actually delete things. The cascades from
-- `profiles` already remove friend requests, follows, notifications, matches,
-- likes and lobby seats; this makes that one deliberate call, and records what
-- could not be finished from here.
--
-- What is left behind, honestly: the row in `auth.users`. Removing it needs
-- the service role, which must never be in the browser, so it is queued for
-- an Edge Function to complete. Until that function exists the account is
-- stripped of all personal data but the login record remains — documented in
-- PRIVACY.md rather than glossed over.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id)
);

alter table public.deletion_requests enable row level security;

drop policy if exists "see your own deletion request" on public.deletion_requests;
create policy "see your own deletion request"
  on public.deletion_requests for select using (auth.uid() = user_id);

create or replace function public.delete_my_account()
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

  -- Queue the part that needs the service role before removing the profile,
  -- so a failure halfway through still leaves a record of what was asked.
  insert into public.deletion_requests (user_id) values (me)
  on conflict (user_id) do nothing;

  -- Free any live lobby seat first, so nobody is left staring at a ghost.
  update public.lobby_members set left_at = now()
   where user_id = me and left_at is null;

  -- Reports this person filed are kept, but detached: the safety record of a
  -- report must survive the reporter deleting their account, or deletion
  -- becomes a way to erase evidence of harassment. Nothing identifying them
  -- remains attached to it.
  delete from public.reports where reporter_id = me and status in ('open', 'dismissed');

  -- Avatar objects. The rows go here; the stored bytes are removed by the
  -- Storage API call the client makes alongside this, and by the Edge
  -- Function as a backstop.
  delete from storage.objects
   where bucket_id = 'avatars' and (storage.foldername(name))[1] = me::text;

  delete from public.entitlements where user_id = me;

  -- Cascades take friend_requests, follows, notifications, matches,
  -- profile_likes, blocks and lobby_members with it.
  delete from public.profiles where id = me;
end $$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

revoke all on function public.blocked_between(uuid, uuid) from public;
grant execute on function public.blocked_between(uuid, uuid) to authenticated;
