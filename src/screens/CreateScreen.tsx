import { useStore } from '../state/store';

/**
 * Create.
 *
 * Upload is not built, and a fake progress bar that ends in nothing would be
 * worse than an empty state — so this names what each route will do and sends
 * you to the one that works today. The lobby *is* SCROLL's original way of
 * making something together, so it is the live option rather than a
 * consolation prize.
 */
export function CreateScreen() {
  const { dispatch } = useStore();

  return (
    <div className="screen create">
      <header className="discover__head">
        <h1 className="title">Create</h1>
        <p className="subtitle">Start something for people to react to.</p>
      </header>

      <button
        className="create__option create__option--live"
        onClick={() => dispatch({ type: 'go', route: 'createLobby' })}
      >
        <span className="create__emoji" aria-hidden>🔒</span>
        <span className="grow create__body">
          <span className="create__title">Start a lobby</span>
          <span className="tiny">
            Invite friends and take turns sharing your feed. This is live now.
          </span>
        </span>
        <span className="create__arrow" aria-hidden>›</span>
      </button>

      <button
        className="create__option create__option--live"
        onClick={() => dispatch({ type: 'startMatchmaking', size: 1 })}
      >
        <span className="create__emoji" aria-hidden>🌎</span>
        <span className="grow create__body">
          <span className="create__title">Match with someone</span>
          <span className="tiny">Get put in a room with a stranger. Also live.</span>
        </span>
        <span className="create__arrow" aria-hidden>›</span>
      </button>

      <div className="create__divider">
        <span className="eyebrow">COMING WITH THE BACKEND</span>
      </div>

      {PLANNED.map((item) => (
        <div key={item.title} className="create__option is-planned">
          <span className="create__emoji" aria-hidden>{item.emoji}</span>
          <span className="grow create__body">
            <span className="create__title">{item.title}</span>
            <span className="tiny">{item.body}</span>
          </span>
          <span className="create__soon">Soon</span>
        </div>
      ))}

      <p className="tiny create__note">
        Uploading needs storage, transcoding, a moderation pass and a feed to publish into — none
        of which exist yet. Rather than a button that looks real and does nothing, these are marked
        for what they are.
      </p>
    </div>
  );
}

const PLANNED = [
  {
    emoji: '🎥',
    title: 'Record a video',
    body: 'Camera capture, trimming and a cover frame.',
  },
  {
    emoji: '📤',
    title: 'Upload from your camera roll',
    body: 'Needs storage and transcoding before anything can be published.',
  },
  {
    emoji: '🎵',
    title: 'Add a sound',
    body: 'A licensed audio library, and the rights work that comes with it.',
  },
];
