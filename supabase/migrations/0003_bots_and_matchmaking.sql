-- SCROLL — bots and matchmaking
--
-- Two things arrive together here because they are the same problem seen from
-- two sides: a lobby needs people in it, and SCROLL must never lie about how
-- many of those people are real.
--
-- The rule the whole design turns on: a lobby seat is either a person or a
-- bot, and the database knows which. `lobby_members.user_id` is null for a
-- bot and `bot_id` is null for a person, so "how many real players are here"
-- is `count(*) where user_id is not null` — a fact about the schema rather
-- than a convention someone has to remember. There is no arrangement of rows
-- that makes a bot count as a person.

-- ─────────────────────────────────────────────────────────────────────────
-- bots
--
-- 200 identities, and none of them is a user account. A bot has no row in
-- auth.users, no password, no session and no way to sign in: it is a
-- description of a character the client can render and the server can seat.
-- That is what makes 200 of them cost nothing — they are ~200 short rows,
-- not 200 running processes and not 200 authentication records.
--
-- They are generated deterministically rather than written out by hand, so
-- the roster is reproducible, easy to regrow, and impossible to accidentally
-- fill with real-looking personal data.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.bots (
  id           text primary key,
  handle       text not null unique,
  display_name text not null,
  avatar       text not null,
  colour       text not null,
  country      text not null default '',
  flag         text not null default '',
  level        integer not null default 1 check (level between 1 and 100),
  vibes        text[] not null default '{}',
  hashtags     text[] not null default '{}',
  -- Lines the bot can say while watching. Kept here so behaviour is data
  -- rather than code, and can be tuned without a deploy.
  chatter      text[] not null default '{}',
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.bots enable row level security;

-- Readable by everyone: the client has to render them. Writable by nobody —
-- no insert, update or delete policy exists, so only the service role can
-- change the roster. A user cannot invent a bot, and a bot cannot be edited
-- into looking like a person.
drop policy if exists "bots are readable by everyone" on public.bots;
create policy "bots are readable by everyone"
  on public.bots for select using (true);

/*
 * Grows the bot roster to a target size, deterministically.
 *
 * Deterministic because the same seed must produce the same cast every time:
 * a bot whose name changed between deploys would look like a different person
 * to anyone who had played with it. setseed makes random() reproducible, and
 * the pools below are ordinary words — no real names, no scraped handles.
 */
create or replace function public.seed_bots(p_target integer default 200)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  first_parts  text[] := array[
    'pixel','echo','nova','drift','lumen','vapor','onyx','cobalt','ember','juno',
    'atlas','wren','kite','sable','flint','marlow','indigo','quill','fable','tundra',
    'zephyr','mango','koi','birch','cinder','halo','opal','rune','solace','vesper'];
  second_parts text[] := array[
    'fox','otter','moth','crane','lynx','heron','ibis','wolf','gull','raven',
    'newt','stoat','shrew','vole','pika','tern','swift','finch','krill','moose'];
  avatars      text[] := array[
    '🦊','🐻','🐨','🐼','🦁','🐯','🐸','🐙','🦉','🐺','🦝','🦔','🐧','🦄','🐢',
    '🦕','🐝','🦋','🐬','🦈'];
  colours      text[] := array[
    '#FF2E93','#22E1FF','#FF9F1C','#7CFF6B','#B388FF','#FFD166','#FF6B6B','#4ECDC4'];
  countries    text[][] := array[
    array['Australia','🇦🇺'], array['United States','🇺🇸'], array['United Kingdom','🇬🇧'],
    array['Canada','🇨🇦'], array['Ireland','🇮🇪'], array['New Zealand','🇳🇿'],
    array['Japan','🇯🇵'], array['Brazil','🇧🇷'], array['Nigeria','🇳🇬'], array['India','🇮🇳']];
  vibe_pool    text[] := array[
    'chaos','animals','cooking','gaming','sports','brainrot','music','fashion',
    'comedy','art','fitness','travel'];
  tag_pool     text[] := array[
    'memes','dogs','cats','gaming','nba','football','cooking','music','anime',
    'skating','chaos','fits','plants','running','film'];
  made integer := 0;
  i integer;
  handle text;
  ci integer;
begin
  perform setseed(0.42);

  for i in 1..p_target loop
    handle := first_parts[1 + (i * 7) % array_length(first_parts, 1)]
              || second_parts[1 + (i * 13) % array_length(second_parts, 1)]
              || case when i > array_length(first_parts,1) * array_length(second_parts,1)
                      then i::text else '' end;

    -- A bot must never collide with a real person's handle, and handles are
    -- claimed by users at any time, so the suffix is what keeps the namespace
    -- separate rather than luck.
    handle := handle || '.' || lpad(i::text, 3, '0');
    ci := 1 + (i % array_length(countries, 1));

    insert into public.bots (
      id, handle, display_name, avatar, colour, country, flag, level,
      vibes, hashtags, chatter
    )
    values (
      'bot_' || lpad(i::text, 3, '0'),
      handle,
      initcap(split_part(handle, '.', 1)),
      avatars[1 + (i * 3) % array_length(avatars, 1)],
      colours[1 + (i * 5) % array_length(colours, 1)],
      countries[ci][1],
      countries[ci][2],
      1 + (i * 17) % 60,
      array[ vibe_pool[1 + (i * 3) % array_length(vibe_pool,1)],
             vibe_pool[1 + (i * 7) % array_length(vibe_pool,1)] ],
      array[ tag_pool[1 + (i * 2) % array_length(tag_pool,1)],
             tag_pool[1 + (i * 11) % array_length(tag_pool,1)] ],
      array['ok that one was actually good', 'nah skip', 'wait rewind that',
            'this is so my feed', 'genuinely crying', 'who sent you this']
    )
    on conflict (id) do nothing;

    made := made + 1;
  end loop;

  return made;
end $$;

select public.seed_bots(200);

-- ─────────────────────────────────────────────────────────────────────────
-- lobbies
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.lobbies (
  id         uuid primary key default gen_random_uuid(),
  -- Present for private lobbies, which are joined by code rather than found.
  code       text unique,
  host_id    uuid not null references public.profiles (id) on delete cascade,
  mode       text not null check (mode in ('random', 'private')),
  group_size integer not null default 1 check (group_size between 1 and 3),
  status     text not null default 'open'
               check (status in ('open', 'starting', 'active', 'finished', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A browser that is closed never says goodbye. Everything that keeps a
  -- lobby alive is a heartbeat, and this is the backstop when they stop.
  expires_at timestamptz not null default now() + interval '2 hours'
);

create index if not exists lobbies_open_idx
  on public.lobbies (mode, status, created_at) where status = 'open';

alter table public.lobbies enable row level security;

create table if not exists public.lobby_members (
  id           uuid primary key default gen_random_uuid(),
  lobby_id     uuid not null references public.lobbies (id) on delete cascade,
  -- Exactly one of these is set. This is the whole basis of honest counting.
  user_id      uuid references public.profiles (id) on delete cascade,
  bot_id       text references public.bots (id) on delete cascade,
  team         text not null default 'yours' check (team in ('yours', 'theirs')),
  ready        boolean not null default false,
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at      timestamptz,
  constraint lobby_member_is_person_or_bot check (
    (user_id is not null and bot_id is null) or
    (user_id is null and bot_id is not null)
  )
);

create unique index if not exists lobby_members_user_uniq
  on public.lobby_members (lobby_id, user_id) where user_id is not null;
create unique index if not exists lobby_members_bot_uniq
  on public.lobby_members (lobby_id, bot_id) where bot_id is not null;

-- Duplicate session prevention, enforced by the database rather than by the
-- client remembering to leave: a person can occupy one live seat anywhere.
create unique index if not exists lobby_members_one_live_seat
  on public.lobby_members (user_id) where user_id is not null and left_at is null;

create index if not exists lobby_members_lobby_idx on public.lobby_members (lobby_id) where left_at is null;

alter table public.lobby_members enable row level security;

/* Am I currently seated in this lobby? Used by several policies. */
create or replace function public.in_lobby(p_lobby uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lobby_members m
    where m.lobby_id = p_lobby and m.user_id = auth.uid() and m.left_at is null
  );
$$;

-- Open random lobbies are discoverable — that is what makes matchmaking work.
-- Private lobbies are not: they are joined through the code, by an RPC, so
-- their existence never leaks into a listing.
drop policy if exists "see lobbies you can join or are in" on public.lobbies;
create policy "see lobbies you can join or are in"
  on public.lobbies for select
  using (
    (mode = 'random' and status = 'open' and expires_at > now())
    or host_id = auth.uid()
    or public.in_lobby(id)
  );

drop policy if exists "host your own lobby" on public.lobbies;
create policy "host your own lobby"
  on public.lobbies for insert with check (auth.uid() = host_id);

drop policy if exists "the host runs the lobby" on public.lobbies;
create policy "the host runs the lobby"
  on public.lobbies for update using (auth.uid() = host_id) with check (auth.uid() = host_id);

drop policy if exists "the host closes the lobby" on public.lobbies;
create policy "the host closes the lobby"
  on public.lobbies for delete using (auth.uid() = host_id);

drop policy if exists "see who is in a lobby you can see" on public.lobby_members;
create policy "see who is in a lobby you can see"
  on public.lobby_members for select
  using (
    public.in_lobby(lobby_id)
    or exists (
      select 1 from public.lobbies l
      where l.id = lobby_id
        and (l.host_id = auth.uid()
             or (l.mode = 'random' and l.status = 'open' and l.expires_at > now()))
    )
  );

-- You may seat yourself, and only yourself, and only in a lobby that is open.
-- Bots are seated by the host through an RPC, never by an ordinary insert,
-- which is why there is no bot branch here.
drop policy if exists "take your own seat" on public.lobby_members;
create policy "take your own seat"
  on public.lobby_members for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.lobbies l
      where l.id = lobby_id and l.status = 'open' and l.expires_at > now()
    )
  );

drop policy if exists "update your own seat" on public.lobby_members;
create policy "update your own seat"
  on public.lobby_members for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "leave, or be removed by the host" on public.lobby_members;
create policy "leave, or be removed by the host"
  on public.lobby_members for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from public.lobbies l where l.id = lobby_id and l.host_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- lobby operations
-- ─────────────────────────────────────────────────────────────────────────

/*
 * Joining a private lobby by its code.
 *
 * An RPC rather than a policy because the alternative leaks: for RLS to let
 * you select a lobby by code, the policy would have to make private lobbies
 * selectable, and then they can be enumerated. Here the code is an argument
 * and the only thing that comes back is the lobby you correctly named.
 */
create or replace function public.join_lobby_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid := auth.uid();
  target   public.lobbies;
begin
  if me is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  select * into target from public.lobbies
   where code = upper(trim(p_code)) and status = 'open' and expires_at > now();

  if not found then
    raise exception 'no open lobby with that code' using errcode = 'no_data_found';
  end if;

  -- Leaving any previous seat is part of joining; otherwise the one-live-seat
  -- index would reject the join and the user would be stuck in a lobby whose
  -- tab they closed an hour ago.
  update public.lobby_members set left_at = now()
   where user_id = me and left_at is null and lobby_id <> target.id;

  insert into public.lobby_members (lobby_id, user_id)
  values (target.id, me)
  on conflict (lobby_id, user_id) where user_id is not null
  do update set left_at = null, last_seen_at = now();

  return target.id;
end $$;

/*
 * Seats bots to fill a lobby.
 *
 * Only the host may call it, and it can only ever add bots — there is no
 * argument that lets it add a person. Bots are chosen deterministically from
 * the roster so a lobby's cast is stable if the call is repeated.
 */
create or replace function public.fill_lobby_with_bots(p_lobby uuid, p_count integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me     uuid := auth.uid();
  added  integer := 0;
  b      record;
begin
  if me is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.lobbies where id = p_lobby and host_id = me) then
    raise exception 'only the host can add bots' using errcode = 'insufficient_privilege';
  end if;
  if p_count < 0 or p_count > 8 then
    raise exception 'unreasonable bot count' using errcode = 'check_violation';
  end if;

  for b in
    select id from public.bots
     where active
       and id not in (
         select bot_id from public.lobby_members
          where lobby_id = p_lobby and bot_id is not null and left_at is null)
     order by md5(id || p_lobby::text)
     limit p_count
  loop
    insert into public.lobby_members (lobby_id, bot_id) values (p_lobby, b.id)
    on conflict do nothing;
    added := added + 1;
  end loop;

  return added;
end $$;

/*
 * How many *real* people are in a lobby.
 *
 * Exists so no screen has to remember to exclude bots. A count that could be
 * got wrong by forgetting a WHERE clause is a count that will eventually be
 * wrong, and this is the number SCROLL must never overstate.
 */
create or replace function public.real_member_count(p_lobby uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.lobby_members
   where lobby_id = p_lobby and user_id is not null and left_at is null;
$$;

/* Heartbeat. The client calls this while it is open; silence is the signal. */
create or replace function public.touch_lobby_presence(p_lobby uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.lobby_members
     set last_seen_at = now()
   where lobby_id = p_lobby and user_id = auth.uid() and left_at is null;

  update public.lobbies
     set updated_at = now(), expires_at = now() + interval '2 hours'
   where id = p_lobby;
end $$;

/*
 * Sweeps up after browsers that never said goodbye.
 *
 * Closing a tab sends nothing, so without this every abandoned game would
 * stay in the lobby list forever and every user would keep a live seat they
 * could not escape. Cheap enough to call opportunistically from the client
 * on the matchmaking screen, which keeps it free: no scheduler, no worker,
 * no always-on process. It can be moved onto pg_cron later without changing
 * anything that calls it.
 */
create or replace function public.cleanup_stale_lobbies()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.lobby_members
     set left_at = now()
   where left_at is null and last_seen_at < now() - interval '90 seconds';

  update public.lobbies
     set status = 'abandoned'
   where status in ('open', 'starting', 'active')
     and (
       expires_at < now()
       -- Emptiness only counts against a lobby that has had time to fill. A
       -- lobby is necessarily empty in the moment between being created and
       -- its host taking a seat, and sweeping it away in that window would
       -- make creating a lobby a race the host can lose.
       or (created_at < now() - interval '2 minutes'
           and not exists (
             select 1 from public.lobby_members m
              where m.lobby_id = lobbies.id and m.user_id is not null and m.left_at is null))
     );
end $$;

revoke all on function public.join_lobby_by_code(text) from public;
revoke all on function public.fill_lobby_with_bots(uuid, integer) from public;
revoke all on function public.touch_lobby_presence(uuid) from public;
revoke all on function public.cleanup_stale_lobbies() from public;
revoke all on function public.real_member_count(uuid) from public;
revoke all on function public.seed_bots(integer) from public;

grant execute on function public.join_lobby_by_code(text) to authenticated;
grant execute on function public.fill_lobby_with_bots(uuid, integer) to authenticated;
grant execute on function public.touch_lobby_presence(uuid) to authenticated;
grant execute on function public.cleanup_stale_lobbies() to authenticated;
grant execute on function public.real_member_count(uuid) to authenticated, anon;
