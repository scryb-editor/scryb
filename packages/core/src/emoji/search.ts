import type { EmojiItem } from "@tiptap/extension-emoji";

interface EmojiSearchEntry {
  readonly emoji: EmojiItem;
  readonly haystack: string;
}

const indexCache = new WeakMap<readonly EmojiItem[], readonly EmojiSearchEntry[]>();

function buildIndex(dataset: readonly EmojiItem[]): readonly EmojiSearchEntry[] {
  const index: EmojiSearchEntry[] = new Array(dataset.length);
  for (let i = 0; i < dataset.length; i++) {
    const e = dataset[i] as EmojiItem & {
      tags?: readonly string[];
      emoticons?: readonly string[];
    };
    const parts: string[] = [];
    if (e.shortcodes) parts.push(...e.shortcodes);
    if (e.tags) parts.push(...e.tags);
    if (e.emoticons) parts.push(...e.emoticons);
    index[i] = { emoji: e, haystack: parts.join("\u0001").toLowerCase() };
  }
  return index;
}

/**
 * Case-insensitive substring filter over a dataset's shortcodes, tags, and
 * emoticons. Caches a lowercased search index per dataset reference so repeated
 * calls avoid re-lowercasing on every keystroke.
 *
 * Early-exits once `limit` matches are collected.
 */
export function filterEmojis(
  dataset: readonly EmojiItem[],
  query: string,
  limit: number,
): readonly EmojiItem[] {
  let index = indexCache.get(dataset);
  if (index === undefined) {
    index = buildIndex(dataset);
    indexCache.set(dataset, index);
  }

  const needle = query.trim().toLowerCase();
  if (needle.length === 0 || limit <= 0) return [];

  const matches: EmojiItem[] = [];
  for (let i = 0; i < index.length; i++) {
    if (index[i].haystack.includes(needle)) {
      matches.push(index[i].emoji);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}
