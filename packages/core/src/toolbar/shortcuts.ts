/**
 * Keyboard shortcut labels for toolbar items.
 *
 * Shortcut definitions live in TOOLBAR_ITEM_CONFIG as platform-neutral
 * "Mod+Shift+X" strings; this module renders them for the current platform
 * (⌘⇧X on Apple devices, Ctrl+Shift+X elsewhere) and composes the tooltip
 * text both adapters show. Tiptap already binds the keys — surfacing them in
 * tooltips is the only way a user ever discovers they exist.
 */

import type { TiptapTranslations } from "../i18n/types";
import { toolbarItemLabel } from "../i18n/item-labels";
import { TOOLBAR_ITEM_CONFIG } from "./item-config";
import type { ToolbarItemConfig } from "./item-config";
import type { ToolbarItemKey } from "./config";

/** SSR-safe Apple-platform detection; false wherever there is no navigator. */
const IS_APPLE =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

const APPLE_KEYS: Record<string, string> = {
  Mod: "⌘",
  Shift: "⇧",
  Alt: "⌥",
};

/**
 * Key names drawn as glyphs on every platform. Shortcuts keep the ARIA name
 * ("ArrowUp") because `aria-keyshortcuts` requires it; read verbatim on a
 * menu label it is noise.
 */
const KEY_GLYPHS: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

/**
 * Renders a platform-neutral shortcut ("Mod+Shift+S") for the current
 * platform: "⌘⇧S" on Apple devices, "Ctrl+Shift+S" elsewhere. Arrow keys
 * become arrows on both ("⌘⇧↑", "Ctrl+Shift+↑").
 *
 * @param shortcut - Platform-neutral shortcut string using "+" separators.
 * @returns The platform-specific display string.
 */
export function formatShortcut(shortcut: string): string {
  const parts = shortcut.split("+").map((part) => KEY_GLYPHS[part] ?? part);
  if (IS_APPLE) {
    return parts.map((part) => APPLE_KEYS[part] ?? part).join("");
  }
  return parts.map((part) => (part === "Mod" ? "Ctrl" : part)).join("+");
}

/**
 * Renders a platform-neutral shortcut in the notation `aria-keyshortcuts`
 * requires: modifier names spelled out and joined with "+" ("Meta+B" on
 * Apple, "Control+B" elsewhere). The tooltip's glyph form is for eyes only;
 * assistive tech needs this one.
 *
 * @param shortcut - Platform-neutral shortcut string using "+" separators.
 * @returns The ARIA-notation shortcut string.
 */
export function ariaKeyShortcut(shortcut: string): string {
  return shortcut
    .split("+")
    .map((part) => (part === "Mod" ? (IS_APPLE ? "Meta" : "Control") : part))
    .join("+");
}

/**
 * Localized tooltip for a toolbar item: the item's label plus its keyboard
 * shortcut in parentheses when one is defined ("Bold (⌘B)").
 *
 * @param item - The toolbar item key.
 * @param translations - Active translation catalog.
 * @returns The tooltip text.
 */
export function toolbarItemTooltip(item: ToolbarItemKey, translations: TiptapTranslations): string {
  const label = toolbarItemLabel(item, translations);
  // Annotate before reading: indexing the `as const` config yields a union of
  // entry shapes, and `shortcut` is absent from the ones that define no key.
  const config: ToolbarItemConfig | undefined = TOOLBAR_ITEM_CONFIG[item];
  const shortcut = config?.shortcut;
  return shortcut ? `${label} (${formatShortcut(shortcut)})` : label;
}
