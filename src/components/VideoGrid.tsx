import { REELS } from '../data/reels';
import { formatCount } from '../data/content';

/**
 * A grid of someone's posts. Tapping one opens that person's post — this is
 * profile browsing, not a For You feed. SCROLL has no solo feed by design:
 * watching alone is a different app.
 */
export function VideoGrid({ ids, onOpen }: { ids: string[]; onOpen: (id: string) => void }) {
  const videos = REELS.filter((r) => ids.includes(r.id));
  if (videos.length === 0) {
    return <p className="subtitle profile__private">Nothing here yet.</p>;
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
