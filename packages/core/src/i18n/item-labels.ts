import type { BubbleMenuItemKey } from "../bubble-menu/config";
import { BUBBLE_MENU_ITEM_CONFIG } from "../bubble-menu/item-config";
import type { ToolbarItemKey } from "../toolbar/config";
import { TOOLBAR_ITEM_CONFIG } from "../toolbar/item-config";
import type { TiptapTranslations } from "./types";

// =============================================================================
// Item label resolution
// =============================================================================
//
// `TOOLBAR_ITEM_CONFIG` / `BUBBLE_MENU_ITEM_CONFIG` carry English labels, which
// both adapters used to render straight into `title`/`aria-label`. That left
// every button ("Bold", "Italic", "Table", …) in English no matter the locale,
// even though the catalogs have translated them all along — the labels and the
// catalog were simply never connected. These resolvers are that connection,
// and are the only place either adapter should read an item label from.

/** Reads `key` out of a catalog section, treating blanks as absent. */
function pick(section: Record<string, unknown>, key: string): string | undefined {
  const value = section[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Returns the localized label for a toolbar item.
 *
 * Falls back to the English label in `TOOLBAR_ITEM_CONFIG` when the catalog
 * has no string for the item — a consumer-registered locale is free to
 * translate only part of the toolbar, and a partially-translated toolbar beats
 * a blank one.
 *
 * @param item - The toolbar item key
 * @param translations - The resolved catalog to read from
 * @returns The label to render as `title` / `aria-label`
 * @example
 * ```typescript
 * toolbarItemLabel("bold", i18n.translations); // "Gras" in fr
 * ```
 */
export function toolbarItemLabel(item: ToolbarItemKey, translations: TiptapTranslations): string {
  const fallback = TOOLBAR_ITEM_CONFIG[item]?.label ?? "";
  if (item === "separator") return fallback;

  return (
    pick(translations.toolbar as unknown as Record<string, unknown>, item)
    // `invisibleCharacters` predates the toolbar section and lives in its own
    // catalog section, keyed by what the button *does* rather than by item.
    ?? (item === "invisibleCharacters" ? pick(translations.invisibleCharacters, "show") : undefined)
    ?? fallback
  );
}

/**
 * Returns the localized label for a bubble menu item.
 *
 * Reads the `bubbleMenu` section first, then falls back to `toolbar` (most
 * bubble menu entries are the same action as their toolbar twin and only the
 * toolbar section translates them), then to the English label in
 * `BUBBLE_MENU_ITEM_CONFIG`.
 *
 * @param item - The bubble menu item key
 * @param translations - The resolved catalog to read from
 * @returns The label to render as `title` / `aria-label`
 */
export function bubbleMenuItemLabel(
  item: BubbleMenuItemKey,
  translations: TiptapTranslations,
): string {
  const fallback = BUBBLE_MENU_ITEM_CONFIG[item]?.label ?? "";
  if (item === "separator") return fallback;

  return (
    pick(translations.bubbleMenu as unknown as Record<string, unknown>, item)
    ?? pick(translations.toolbar as unknown as Record<string, unknown>, item)
    ?? fallback
  );
}
