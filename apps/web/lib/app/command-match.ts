/**
 * Matching and ranking for the command palette. Pure string work: the query is split into words
 * and compared with startsWith/includes, never turned into a regular expression, and highlighting
 * returns plain text segments (the screen renders them as text, never as HTML).
 */
export const MAX_COMMAND_QUERY = 100;

/** Trims, collapses runs of whitespace and caps the length. */
export function normaliseCommandQuery(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_COMMAND_QUERY).trim();
}

/** Lower-case words of a query (already normalised or not). Empty for a blank query. */
export function queryTerms(query: string): string[] {
  const q = normaliseCommandQuery(query).toLowerCase();
  return q ? q.split(" ") : [];
}

export type Searchable = {
  title: string;
  /** Lower-priority text: topic, source, type, keywords. */
  secondary?: readonly string[];
};

const wordStart = (text: string, term: string) =>
  text.split(/[\s/\-–·:,.]+/).some((word) => word.startsWith(term));

/** Score of one word against an item, or 0 for no match. Title prefix > word prefix > substring > secondary. */
function termScore(title: string, secondary: readonly string[], term: string): number {
  if (title.startsWith(term)) return 100;
  if (wordStart(title, term)) return 80;
  if (title.includes(term)) return 60;
  if (secondary.some((s) => wordStart(s, term))) return 30;
  if (secondary.some((s) => s.includes(term))) return 20;
  return 0;
}

/**
 * Score of an item for a query: every word must match somewhere, then the words' scores are
 * averaged, with a bonus when the whole query is a prefix of the title. null = does not match.
 * A blank query matches nothing (the palette shows its own empty view instead).
 */
export function scoreItem(item: Searchable, terms: readonly string[]): number | null {
  if (terms.length === 0) return null;
  const title = item.title.toLowerCase();
  const secondary = (item.secondary ?? []).map((s) => s.toLowerCase());
  let total = 0;
  for (const term of terms) {
    const score = termScore(title, secondary, term);
    if (score === 0) return null;
    total += score;
  }
  const bonus = title.startsWith(terms.join(" ")) ? 20 : 0;
  return total / terms.length + bonus;
}

/** The best `limit` matches, best score first; equal scores keep their original order. */
export function rankItems<T extends Searchable>(
  items: readonly T[],
  terms: readonly string[],
  limit: number,
): T[] {
  const scored: { item: T; score: number; index: number }[] = [];
  items.forEach((item, index) => {
    const score = scoreItem(item, terms);
    if (score !== null) scored.push({ item, score, index });
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.slice(0, Math.max(0, limit)).map((entry) => entry.item);
}

export type Segment = { text: string; match: boolean };

/** Splits `text` into plain and matched segments for the query words (case-insensitive, merged). */
export function highlightSegments(text: string, terms: readonly string[]): Segment[] {
  const lower = text.toLowerCase();
  const marked = new Array<boolean>(text.length).fill(false);
  // toLowerCase can change the length for a few characters; then matching is skipped, not wrong.
  if (lower.length === text.length) {
    for (const term of terms) {
      if (!term) continue;
      let from = 0;
      for (;;) {
        const at = lower.indexOf(term, from);
        if (at === -1) break;
        for (let i = at; i < at + term.length; i++) marked[i] = true;
        from = at + term.length;
      }
    }
  }
  const segments: Segment[] = [];
  for (let i = 0; i < text.length; i++) {
    const match = marked[i] === true;
    const last = segments[segments.length - 1];
    if (last && last.match === match) last.text += text[i];
    else segments.push({ text: text[i] ?? "", match });
  }
  return segments;
}
