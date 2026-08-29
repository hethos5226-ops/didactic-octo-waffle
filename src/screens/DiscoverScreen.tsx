import { useMemo, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { REELS } from '../data/reels';
import { formatCount } from '../data/content';
import { HASHTAG_SUGGESTIONS } from '../data/hashtags';
import { searchPeople, suggestedPeople } from '../data/social';
import { useStore } from '../state/store';

/**
 * Discover: what's out there, before you know what you're looking for.
 *
 * One search box covers people and hashtags rather than splitting them behind
 * a toggle — at this size a segmented control costs more than it saves, and
 * "dogs" should find both the tag and the people who post it.
 */
export function DiscoverScreen() {
  const { state, dispatch } = useStore();
  const profile = state.profile!;
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase().replace(/^[@#]/, '');

  const people = useMemo(() => (q ? searchPeople(q) : []), [q]);
  const tags = useMemo(
    () => (q ? HASHTAG_SUGGESTIONS.filter((s) => s.tag.includes(q)) : []),
    [q],
  );
  const videos = useMemo(
    () => (q ? REELS.filter((r) => r.hashtags.some((t) => t.includes(q)) || r.caption.toLowerCase().includes(q)) : []),
    [q],
  );

  const forYou = useMemo(
    () =>
      suggestedPeople({
        myFriends: profile.friends,
        myTags: profile.hashtags,
        exclude: profile.sentRequests,
        limit: 6,
      }),
    [profile.friends, profile.hashtags, profile.sentRequests],
  );

  const trending = useMemo(() => {
    // Ranked by the reach of the videos carrying each tag, so the list is
    // derived from the content rather than hand-ordered.
    const score = new Map<string, number>();
    for (const reel of REELS) {
      for (const tag of reel.hashtags) {
        score.set(tag, (score.get(tag) ?? 0) + reel.likes + reel.saves);
      }
    }
    return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, []);

  return (
    <div className="screen discover">
      <header className="discover__head">
        <h1 className="title">Discover</h1>
      </header>

      <div className="friends__search">
        <span aria-hidden>🔍</span>
        <input
          className="friends__search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="People, #hashtags, sounds…"
          aria-label="Search"
        />
        {query && (
          <button className="friends__search-clear" onClick={() => setQuery('')} aria-label="Clear">✕</button>
        )}
      </div>

      {q ? (
        <>
          {people.length > 0 && (
            <section className="friends__section">
              <span className="eyebrow">PEOPLE</span>
              <ul className="friends__list">
                {people.map((p) => (
                  <li key={p.id} className="friends__item">
                    <button className="friends__open" onClick={() => dispatch({ type: 'viewPerson', id: p.id })}>
                      <Avatar emoji={p.avatar} colour={p.colour} flag={p.flag} size={46} premium={p.level >= 25} />
                      <span className="grow friends__body">
                        <span className="friends__handle">@{p.handle}</span>
                        <span className="tiny">LV {p.level} · ⭐ {p.feedScore}</span>
                      </span>
                    </button>
                    <span className="friends__chevron" aria-hidden>›</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tags.length > 0 && (
            <section className="friends__section">
              <span className="eyebrow">HASHTAGS</span>
              <div className="wrap">
                {tags.map((t) => (
                  <span key={t.tag} className="tag">#{t.tag}</span>
                ))}
              </div>
            </section>
          )}

          {videos.length > 0 && (
            <section className="friends__section">
              <span className="eyebrow">VIDEOS</span>
              <VideoGrid ids={videos.map((v) => v.id)} onOpen={() => dispatch({ type: 'go', route: 'reels' })} />
            </section>
          )}

          {people.length === 0 && tags.length === 0 && videos.length === 0 && (
            <p className="subtitle">Nothing for “{query}”. Try a name or an interest.</p>
          )}
        </>
      ) : (
        <>
          <section className="friends__section">
            <span className="eyebrow">TRENDING</span>
            <div className="discover__trending">
              {trending.map(([tag, reach], i) => (
                <button key={tag} className="discover__trend" onClick={() => setQuery(tag)}>
                  <span className="discover__trend-rank">{i + 1}</span>
                  <span className="grow">
                    <span className="discover__trend-tag">#{tag}</span>
                    <span className="tiny">{formatCount(reach)} plays</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="friends__section">
            <span className="eyebrow">FRESH ON SCROLL</span>
            <VideoGrid ids={REELS.map((r) => r.id)} onOpen={() => dispatch({ type: 'go', route: 'reels' })} />
          </section>

          <section className="friends__section">
            <span className="eyebrow">CREATORS FOR YOU</span>
            <div className="discover__creators">
              {forYou.map(({ person, mutuals, shared }) => (
                <button
                  key={person.id}
                  className="discover__creator"
                  onClick={() => dispatch({ type: 'viewPerson', id: person.id })}
                >
                  <Avatar emoji={person.avatar} colour={person.colour} flag={person.flag} size={58} />
                  <span className="discover__creator-handle">@{person.handle}</span>
                  <span className="tiny">
                    {mutuals.length > 0
                      ? `${mutuals.length} mutual`
                      : shared.length > 0
                        ? `#${shared[0]}`
                        : person.country}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export function VideoGrid({ ids, onOpen }: { ids: string[]; onOpen: (id: string) => void }) {
  const videos = REELS.filter((r) => ids.includes(r.id));
  if (videos.length === 0) {
    return <p className="subtitle">Nothing here yet.</p>;
  }
  return (
    <div className="vgrid">
      {videos.map((v) => (
        <button key={v.id} className="vgrid__cell" onClick={() => onOpen(v.id)}>
          {v.thumbnail ? (
            <img className="vgrid__thumb" src={v.thumbnail} alt="" loading="lazy" />
          ) : (
            <span className="vgrid__blank" aria-hidden />
          )}
          <span className="vgrid__plays">▶ {formatCount(v.likes)}</span>
        </button>
      ))}
    </div>
  );
}
