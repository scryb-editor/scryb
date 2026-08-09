import type { ScrybTheme } from "../types/editor.types";

// =============================================================================
// Theme Utilities
// =============================================================================

/**
 * Resolves a `ScrybTheme` value into the CSS classes used by the editor chrome.
 *
 * - `host`: applied to the editor wrapper element. Empty string when theme is
 *   `"none"` so the editor content inherits typography and colors from the
 *   consumer's parent styles.
 * - `portal`: applied to the per-instance portal container in `document.body`.
 *   Always a valid theme class — falls back to `scryb-theme-light` when theme
 *   is `"none"` so portaled overlays keep usable chrome defaults.
 */
export function resolveThemeClasses(theme: ScrybTheme | undefined): {
  readonly host: string;
  readonly portal: string;
} {
  const resolved = theme ?? "light";
  const portal = resolved === "none" ? "scryb-theme-light" : `scryb-theme-${resolved}`;
  const host = resolved === "none" ? "" : `scryb-theme-${resolved}`;
  return { host, portal };
}

/**
 * Returns true when the dark theme applies to the given element.
 *
 * Walks up from `el` looking for the `scryb-theme-dark` class. The adapters
 * apply theme classes to the editor host and portal container — never to
 * `document.documentElement` — so callers must provide an element inside the
 * editor tree (or inside a portaled overlay) to get an accurate result.
 *
 * Falls back to reading `document.documentElement.classList` when no element
 * is supplied, for back-compat with consumers that historically relied on the
 * global class. This fallback will return `false` for editors built from
 * v1.15+ that no longer mutate `<html>`.
 */
export function isDarkThemeActive(el?: Element | null): boolean {
  if (el) return el.closest(".scryb-theme-dark") !== null;
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("scryb-theme-dark");
}
