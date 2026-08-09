import type { MentionItem } from "./callback-store";

interface MentionSearchEntry {
  readonly item: MentionItem;
  readonly haystack: string;
}

const indexCache = new WeakMap<readonly MentionItem[], readonly MentionSearchEntry[]>();

function buildIndex(items: readonly MentionItem[]): readonly MentionSearchEntry[] {
  const index: MentionSearchEntry[] = new Array(items.length);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    index[i] = { item, haystack: (item.label + "\u0001" + item.id).toLowerCase() };
  }
  return index;
}

/**
 * Case-insensitive substring filter over a list of mentionable items. Caches
 * a lowercased search index per array reference to avoid re-lowercasing on
 * every keystroke. Early-exits once `limit` matches are collected.
 *
 * Empty query returns the first `limit` items unchanged (cold-start list).
 */
export function filterMentionItems(
  items: readonly MentionItem[],
  query: string,
  limit: number,
): readonly MentionItem[] {
  if (limit <= 0) return [];

  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return items.length <= limit ? items : items.slice(0, limit);
  }

  let index = indexCache.get(items);
  if (index === undefined) {
    index = buildIndex(items);
    indexCache.set(items, index);
  }

  const matches: MentionItem[] = [];
  for (let i = 0; i < index.length; i++) {
    if (index[i].haystack.includes(needle)) {
      matches.push(index[i].item);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}
