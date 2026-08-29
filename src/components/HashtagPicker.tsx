import { useMemo, useState } from 'react';
import { HASHTAG_SUGGESTIONS, normaliseTag } from '../data/hashtags';

interface HashtagPickerProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  max?: number;
}

/**
 * What you're actually into, in your own words. Suggestions are there so the
 * common case is tapping rather than typing, but anything can be typed — the
 * point is that "#dogs" is a better reason to add someone than a category.
 */
export function HashtagPicker({ tags, onChange, max = 8 }: HashtagPickerProps) {
  const [draft, setDraft] = useState('');
  const full = tags.length >= max;

  const suggestions = useMemo(
    () => HASHTAG_SUGGESTIONS.filter((s) => !tags.includes(s.tag)),
    [tags],
  );

  const add = (raw: string) => {
    const tag = normaliseTag(raw);
    if (!tag || full || tags.includes(tag)) { setDraft(''); return; }
    onChange([...tags, tag]);
    setDraft('');
  };

  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag));

  return (
    <div className="tags">
      {tags.length > 0 && (
        <div className="tags__mine">
          {tags.map((tag) => (
            <button key={tag} className="tag tag--on" onClick={() => remove(tag)}>
              #{tag}
              <span className="tag__x" aria-hidden>✕</span>
            </button>
          ))}
        </div>
      )}

      <form
        className="tags__form"
        onSubmit={(e) => { e.preventDefault(); add(draft); }}
      >
        <span className="tags__hash">#</span>
        <input
          className="tags__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/^#+/, ''))}
          placeholder={full ? `${max} is the limit` : 'type your own…'}
          maxLength={20}
          disabled={full}
          aria-label="Add a hashtag"
        />
        <button className="tags__add" type="submit" disabled={!draft.trim() || full}>
          Add
        </button>
      </form>

      <div className="tags__suggestions">
        {suggestions.map((s) => (
          <button
            key={s.tag}
            className="tag"
            onClick={() => add(s.tag)}
            disabled={full}
          >
            #{s.tag}
          </button>
        ))}
      </div>
    </div>
  );
}
