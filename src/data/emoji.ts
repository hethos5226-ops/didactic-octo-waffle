/**
 * Take the first emoji out of whatever someone typed.
 *
 * An emoji is rarely one codepoint: a family is several joined by zero-width
 * joiners, a thumbs-up with a skin tone is a base plus a modifier, and a heart
 * carries a variation selector. Slicing by character would tear those apart
 * and leave a mangled half-glyph, so grapheme clusters are the right unit.
 */
export function firstEmoji(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  for (const cluster of graphemes(trimmed)) {
    if (looksLikeEmoji(cluster)) return cluster;
  }
  return '';
}

function graphemes(value: string): string[] {
  // Intl.Segmenter knows the real cluster rules; spreading a string only
  // splits by codepoint, which is the wrong boundary for joined sequences.
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Segmenter) {
    return [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(value)]
      .map((part) => part.segment);
  }
  return [...value];
}

/** Reject typed letters and digits, which would not read as a face. */
function looksLikeEmoji(cluster: string): boolean {
  if (!cluster) return false;
  try {
    // Extended_Pictographic covers the pictographs; the regional-indicator
    // range catches flags, which are letter pairs rather than pictographs.
    return /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(cluster);
  } catch {
    // Property escapes unsupported: fall back to "not a plain ASCII glyph".
    return cluster.codePointAt(0)! > 0x2000;
  }
}
