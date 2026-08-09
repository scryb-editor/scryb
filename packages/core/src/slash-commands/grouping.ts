import type { SlashCommandItem } from "./types";

// =============================================================================
// Types
// =============================================================================

/** Ordered group keys for slash command palette display. */
export const GROUP_ORDER = ["text", "lists", "media", "advanced"] as const;

/** Union type of all valid slash command group keys. */
export type SlashCommandGroupKey = (typeof GROUP_ORDER)[number];

/**
 * A display item is either a group header or a command entry.
 * Used in the flat list of items rendered by the slash command palette UI.
 */
export type SlashCommandDisplayItem =
  | { type: "header"; group: string }
  | { type: "command"; item: SlashCommandItem; commandIndex: number };

// =============================================================================
// Grouping
// =============================================================================

/**
 * Builds the flat list of display items from a slash command list.
 *
 * When `hasQuery` is true (user is filtering), returns a flat list of command
 * items with no group headers — matching the search behaviour in both adapters.
 * When `hasQuery` is false, inserts a group header before each non-empty group
 * in GROUP_ORDER sequence, then appends any ungrouped items without a header.
 *
 * @param items - The slash command items to group
 * @param hasQuery - Whether the user is currently filtering by typing
 * @returns Flat list of display items ready for rendering
 *
 * @example
 * // No query: grouped with headers
 * groupSlashCommands(commands, false);
 * // => [{ type: "header", group: "text" }, { type: "command", ... }, ...]
 *
 * // With query: flat list, no headers
 * groupSlashCommands(commands, true);
 * // => [{ type: "command", ... }, ...]
 */
export function groupSlashCommands(
  items: SlashCommandItem[],
  hasQuery: boolean,
): SlashCommandDisplayItem[] {
  if (hasQuery) {
    return items.map((item, commandIndex) => ({ type: "command" as const, item, commandIndex }));
  }

  // Group items by their group property in GROUP_ORDER order
  const grouped = new Map<SlashCommandGroupKey | "ungrouped", SlashCommandItem[]>();
  for (const g of GROUP_ORDER) {
    grouped.set(g, []);
  }
  grouped.set("ungrouped", []);

  for (const item of items) {
    const key = (item.group as SlashCommandGroupKey | "ungrouped") ?? "ungrouped";
    const arr = grouped.get(key);
    if (arr) {
      arr.push(item);
    } else {
      // Unknown group — treat as ungrouped
      grouped.get("ungrouped")!.push(item);
    }
  }

  const result: SlashCommandDisplayItem[] = [];
  let commandIndex = 0;

  for (const group of GROUP_ORDER) {
    const groupItems = grouped.get(group) ?? [];
    if (groupItems.length > 0) {
      result.push({ type: "header", group });
      for (const item of groupItems) {
        result.push({ type: "command", item, commandIndex });
        commandIndex++;
      }
    }
  }

  // Append any ungrouped items without a header
  for (const item of grouped.get("ungrouped") ?? []) {
    result.push({ type: "command", item, commandIndex });
    commandIndex++;
  }

  return result;
}
