import { useMemo, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { PEOPLE, type Person } from '../data/people';
import { searchPeople, suggestedPeople, mutualFriends } from '../data/social';
import { useStore } from '../state/store';

/**
 * Where the social graph is actually built.
 *
 * Adding people used to be possible only in the few seconds after a session
 * ended, which meant that if you missed that moment the person was gone. This
 * screen makes it a place you can go: who is waiting on you, who you might
 * know, and a search box.
 */
export function FriendsScreen() {
  const { state, dispatch } = useStore();
  const profile = state.profile!;
  const [query, setQuery] = useState('');

  const requests = profile.incomingRequests
    .map((id) => PEOPLE.find((p) => p.id === id))
    .filter((p): p is Person => Boolean(p));

  const friends = PEOPLE.filter((p) => profile.friends.includes(p.id));

  const suggestions = useMemo(
    () =>
      suggestedPeople({
        myFriends: profile.friends,
        myTags: profile.hashtags,
        exclude: [...profile.sentRequests, ...profile.incomingRequests],
      }),
    [profile.friends, profile.hashtags, profile.sentRequests, profile.incomingRequests],
  );

  const results = useMemo(
    () => (query.trim() ? searchPeople(query, profile.friends) : []),
    [query, profile.friends],
  );

  const open = (id: string) => dispatch({ type: 'viewPerson', id });

  return (
    <div className="screen friends">
      <header className="lobby__head">
        <button className="lobby__back" onClick={() => dispatch({ type: 'back' })}>‹</button>
        <div className="grow">
          <h1 className="title">👥 Friends</h1>
          <p className="subtitle">
            {friends.length} {friends.length === 1 ? 'person' : 'people'} you met by scrolling.
          </p>
        </div>
      </header>

      <div className="friends__search">
        <span aria-hidden>🔍</span>
        <input
          className="friends__search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search handles or #interests…"
          aria-label="Search for people"
        />
        {query && (
          <button className="friends__search-clear" onClick={() => setQuery('')} aria-label="Clear search">
            ✕
          </button>
        )}
      </div>

      {query.trim() ? (
        <section className="friends__section">
          <span className="eyebrow">
            {results.length} {results.length === 1 ? 'RESULT' : 'RESULTS'}
          </span>
          {results.length === 0 && <p className="subtitle">Nobody by that name or interest.</p>}
          <ul className="friends__list">
            {results.map((p) => (
              <PersonRow key={p.id} person={p} onOpen={() => open(p.id)} />
            ))}
          </ul>
        </section>
      ) : (
        <>
          {requests.length > 0 && (
            <section className="friends__section">
              <span className="eyebrow">
                {requests.length} {requests.length === 1 ? 'REQUEST' : 'REQUESTS'}
              </span>
              <ul className="friends__list">
                {requests.map((p) => (
                  <li key={p.id} className="friends__item friends__item--request">
                    <button className="friends__open" onClick={() => open(p.id)}>
                      <Avatar emoji={p.avatar} colour={p.colour} flag={p.flag} size={46} />
                      <span className="grow friends__body">
                        <span className="friends__handle">@{p.handle}</span>
                        <span className="tiny">wants to be friends</span>
                      </span>
                    </button>
                    <div className="row friends__request-actions">
                      <button
                        className="btn btn--ghost friends__decline"
                        onClick={() => dispatch({ type: 'declineFriendRequest', id: p.id })}
                      >
                        Ignore
                      </button>
                      <button
                        className="btn btn--zap friends__accept"
                        onClick={() => dispatch({ type: 'acceptFriendRequest', id: p.id })}
                      >
                        Accept
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {suggestions.length > 0 && (
            <section className="friends__section">
              <span className="eyebrow">PEOPLE YOU MIGHT KNOW</span>
              <ul className="friends__list">
                {suggestions.map(({ person, mutuals, shared }) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    onOpen={() => open(person.id)}
                    hint={
                      mutuals.length > 0
                        ? `👥 ${mutuals.length} mutual ${mutuals.length === 1 ? 'friend' : 'friends'}`
                        : shared.length > 0
                          ? `🤝 ${shared.map((t) => `#${t}`).join(' ')}`
                          : `${person.flag} ${person.country}`
                    }
                    action={
                      <button
                        className="btn btn--zap friends__add"
                        onClick={() => dispatch({ type: 'sendFriendRequest', id: person.id })}
                      >
                        + Add
                      </button>
                    }
                  />
                ))}
              </ul>
            </section>
          )}

          {profile.sentRequests.length > 0 && (
            <section className="friends__section">
              <span className="eyebrow">SENT</span>
              <ul className="friends__list">
                {profile.sentRequests.map((id) => {
                  const p = PEOPLE.find((x) => x.id === id);
                  if (!p) return null;
                  return (
                    <PersonRow
                      key={id}
                      person={p}
                      onOpen={() => open(id)}
                      hint="Waiting for them to accept"
                      action={<span className="friends__pending">Requested</span>}
                    />
                  );
                })}
              </ul>
            </section>
          )}

          <section className="friends__section">
            <span className="eyebrow">YOUR FRIENDS</span>
            {friends.length === 0 ? (
              <p className="subtitle">
                Nobody yet. Add someone above, or go meet people in a 🌎 Random session.
              </p>
            ) : (
              <ul className="friends__list">
                {friends.map((p) => (
                  <PersonRow
                    key={p.id}
                    person={p}
                    onOpen={() => open(p.id)}
                    hint={hintForFriend(profile.friends, p)}
                  />
                ))}
              </ul>
            )}
          </section>

          <button
            className="btn btn--zap btn--block"
            onClick={() => dispatch({ type: 'go', route: 'createLobby' })}
          >
            🔒 Start an FYP night
          </button>
        </>
      )}
    </div>
  );
}

function hintForFriend(myFriends: string[], person: Person): string {
  const mutuals = mutualFriends(myFriends, person);
  if (mutuals.length > 0) {
    return `👥 ${mutuals.length} mutual ${mutuals.length === 1 ? 'friend' : 'friends'}`;
  }
  return `LV ${person.level} · ⭐ ${person.feedScore}`;
}

interface PersonRowProps {
  person: Person;
  hint?: string;
  action?: React.ReactNode;
  onOpen: () => void;
}

function PersonRow({ person, hint, action, onOpen }: PersonRowProps) {
  return (
    <li className="friends__item">
      <button className="friends__open" onClick={onOpen}>
        <Avatar
          emoji={person.avatar}
          colour={person.colour}
          flag={person.flag}
          size={46}
          premium={person.level >= 25}
        />
        <span className="grow friends__body">
          <span className="friends__handle">@{person.handle}</span>
          <span className="tiny">{hint ?? `LV ${person.level}`}</span>
        </span>
      </button>
      {action ?? <span className="friends__chevron" aria-hidden>›</span>}
    </li>
  );
}
