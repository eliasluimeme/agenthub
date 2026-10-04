const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const graphemes = (s: string) => [...segmenter.segment(s)].map((g) => g.segment);

const REPLACE: Record<string, string> = { ß: 'ss', æ: 'ae', ø: 'o', œ: 'oe', đ: 'd', ł: 'l', þ: 'th', '&': ' and ' };

/** URL-safe slug: strips accents, lowercases, joins words with `-`. */
export function slugify(input: string, { separator = '-', maxLength = 80 } = {}): string {
  const s = input
    .toLowerCase()
    .replace(/[ßæøœđłþ&]/g, (c) => REPLACE[c])
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, separator)
    .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, 'g'), '');
  if (s.length <= maxLength) return s;
  const cut = s.slice(0, maxLength);
  const last = cut.lastIndexOf(separator);
  return last > maxLength / 2 ? cut.slice(0, last) : cut;
}

/** Truncates to `max` graphemes (emoji and combined characters count as one), preferring a word boundary. */
export function truncate(input: string, max: number, ellipsis = '…'): string {
  const g = graphemes(input);
  if (g.length <= max) return input;
  const room = Math.max(0, max - graphemes(ellipsis).length);
  const head = g.slice(0, room).join('');
  const space = head.lastIndexOf(' ');
  return (space > room * 0.6 ? head.slice(0, space) : head).trimEnd() + ellipsis;
}

/** Greedy word wrap at `width` columns. Words longer than the width are split. Existing newlines are kept. */
export function wrap(input: string, width = 80): string {
  return input.split('\n').map((para) => {
    const lines: string[] = [];
    let line = '';
    for (let word of para.split(/\s+/).filter(Boolean)) {
      while (graphemes(word).length > width) {
        if (line) { lines.push(line); line = ''; }
        const g = graphemes(word);
        lines.push(g.slice(0, width).join(''));
        word = g.slice(width).join('');
      }
      if (!line) line = word;
      else if (graphemes(line).length + 1 + graphemes(word).length <= width) line += ` ${word}`;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    return lines.join('\n');
  }).join('\n');
}

const IRREGULAR: Record<string, string> = { person: 'people', child: 'children', man: 'men', woman: 'women', mouse: 'mice', index: 'indices', datum: 'data' };

/** English plural for common nouns. With a count, returns "1 agent" or "3 agents". */
export function pluralize(word: string, count?: number): string {
  const plural = () => {
    const lower = word.toLowerCase();
    if (IRREGULAR[lower]) return word[0] === word[0].toUpperCase() ? IRREGULAR[lower][0].toUpperCase() + IRREGULAR[lower].slice(1) : IRREGULAR[lower];
    if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
    if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
    return `${word}s`;
  };
  if (count === undefined) return plural();
  return `${count} ${count === 1 ? word : plural()}`;
}

/** Display width in graphemes, which is what people count. */
export const length = (s: string) => graphemes(s).length;
