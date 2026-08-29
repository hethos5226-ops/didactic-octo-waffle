-- SCROLL — initial schema
--
-- Run this once against a new Supabase project (SQL Editor, or `supabase db
-- push`). It creates the tables the app reads and writes, and the row-level
-- security policies that decide who may see what.
--
-- RLS is enabled on every table. Supabase exposes the database directly to the
-- browser through PostgREST, so a table without policies is either fully open
-- or fully closed — there is no "the app will check it" middle ground, because
-- there is no app server in between.

-- ─────────────────────────────────────────────────────────────────────────
-- profiles
-- One row per auth user. The handle is the public identity and is unique;
-- everything else is display data.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  handle           text not null unique
                     check (handle ~ '^[a-z0-9._]{2,18}$'),
  display_name     text not null default '',
  bio              text not null default '' check (char_length(bio) <= 120),
  avatar           text not null default '🦊',
  photo_url        text,
  colour           text not null default '#ff2e93',
  country          text not null default '',
  flag             text not null default '',
  vibes            text[] not null default '{}',
  hashtags         text[] not null default '{}',
  premium          boolean not null default false,
  xp               integer not null default 0 check (xp >= 0),
  -- Feed-score tallies: { funny: { points, votes }, ... }. Kept as jsonb
  -- because the category set is a product decision that will change, and a
  -- column per category would mean a migration every time it does.
  tallies          jsonb not null default '{}'::jsonb,
  profile_likes    integer not null default 0,
  follower_count   integer not null default 0,
  sessions_played  integer not null default 0,
  rounds_scrolled  integer not null default 0,
  reactions_sent   integer not null default 0,
  reactions_received integer not null default 0,
  onboarded        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Case-insensitive handle lookups for "is this taken?" and search.
create index if not exists profiles_handle_lower_idx on public.profiles (lower(handle));
create index if not exists profiles_hashtags_idx on public.profiles using gin (hashtags);

alter table public.profiles enable row level security;

-- Profiles are a public directory: you have to be able to find people to play
-- with. Only the owner may write their own row.
drop policy if exists "profiles are readable by everyone" on public.profiles;
create policy "profiles are readable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "users insert their own profile" on public.profiles;
create policy "users insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "users update their own profile" on public.profiles;
create policy "users update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────────────
-- friend_requests
-- One table covers both requests and friendships: a friendship is simply an
-- accepted request. Two tables would have to be kept consistent with each
-- other, and there is nothing a separate friendships table would tell us that
-- this does not.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.friend_requests (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles (id) on delete cascade,
  addressee_id  uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'declined')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  -- One request per direction, and never to yourself.
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index if not exists friend_requests_addressee_idx
  on public.friend_requests (addressee_id, status);
create index if not exists friend_requests_requester_idx
  on public.friend_requests (requester_id, status);

alter table public.friend_requests enable row level security;

drop policy if exists "see requests you are part of" on public.friend_requests;
create policy "see requests you are part of"
  on public.friend_requests for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "send your own requests" on public.friend_requests;
create policy "send your own requests"
  on public.friend_requests for insert
  with check (auth.uid() = requester_id);

-- Only the person who was asked may accept or decline. Without the addressee
-- check, anyone could mark their own outgoing request accepted.
drop policy if exists "respond to requests sent to you" on public.friend_requests;
create policy "respond to requests sent to you"
  on public.friend_requests for update
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id);

drop policy if exists "withdraw your own request" on public.friend_requests;
create policy "withdraw your own request"
  on public.friend_requests for delete
  using (auth.uid() = requester_id);

-- ─────────────────────────────────────────────────────────────────────────
-- follows
-- A looser one-way link, distinct from friendship.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_following_idx on public.follows (following_id);

alter table public.follows enable row level security;

drop policy if exists "follows are readable by everyone" on public.follows;
create policy "follows are readable by everyone"
  on public.follows for select using (true);

drop policy if exists "follow as yourself" on public.follows;
create policy "follow as yourself"
  on public.follows for insert with check (auth.uid() = follower_id);

drop policy if exists "unfollow as yourself" on public.follows;
create policy "unfollow as yourself"
  on public.follows for delete using (auth.uid() = follower_id);

-- Keep profiles.follower_count in step rather than counting on every read.
create or replace function public.sync_follower_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.profiles set follower_count = follower_count + 1
      where id = new.following_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.profiles set follower_count = greatest(0, follower_count - 1)
      where id = old.following_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists follows_count_trigger on public.follows;
create trigger follows_count_trigger
  after insert or delete on public.follows
  for each row execute function public.sync_follower_count();

-- ─────────────────────────────────────────────────────────────────────────
-- notifications
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  actor_id   uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('request', 'accepted', 'liked')),
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "read your own notifications" on public.notifications;
create policy "read your own notifications"
  on public.notifications for select using (auth.uid() = user_id);

-- A notification is written *for* someone else, by you. The actor must be you,
-- which stops anyone filling a stranger's inbox with notifications that appear
-- to come from third parties.
drop policy if exists "notify others as yourself" on public.notifications;
create policy "notify others as yourself"
  on public.notifications for insert with check (auth.uid() = actor_id);

drop policy if exists "mark your own notifications read" on public.notifications;
create policy "mark your own notifications read"
  on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- matches
-- What happened in a game. Written by each player for themselves, so the row
-- is that player's record of it.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.matches (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  played_at       timestamptz not null default now(),
  mode            text not null check (mode in ('random', 'private')),
  players         jsonb not null default '[]'::jsonb,
  rounds          jsonb not null default '[]'::jsonb,
  my_feed_score   integer,
  best_handle     text not null default '',
  best_score      integer not null default 0,
  total_reactions integer not null default 0,
  xp_earned       integer not null default 0
);

create index if not exists matches_user_idx on public.matches (user_id, played_at desc);

alter table public.matches enable row level security;

drop policy if exists "read your own matches" on public.matches;
create policy "read your own matches"
  on public.matches for select using (auth.uid() = user_id);

drop policy if exists "record your own matches" on public.matches;
create policy "record your own matches"
  on public.matches for insert with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- updated_at
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- Profile photos
-- A public bucket: avatars are shown to everyone in a lobby, so there is
-- nothing gained by signing every URL. Writes are restricted to a folder named
-- after the owner's user id.
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars are publicly readable" on storage.objects;
create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "users upload their own avatar" on storage.objects;
create policy "users upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users replace their own avatar" on storage.objects;
create policy "users replace their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete their own avatar" on storage.objects;
create policy "users delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
