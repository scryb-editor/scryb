/**
 * Overflow menu grouping for Scryb adapters.
 *
 * The "more" panel used to carry the toolbar's vertical separators, forced to
 * full-width horizontal rules. Measured at 1440px that produced a 316x318px
 * panel where the widest content row used 136px of 302px available, and where
 * the six rules were the widest objects on screen.
 *
 * The panel now groups by role and separates the groups with spacing. Every
 * control keeps its icon: a panel that mixed icon-only buttons with full-text
 * rows read as two different menus stacked on top of each other.
 *
 * Both Angular and React consume this; the grouping must not live in an
 * adapter or the two panels drift.
 */


// =============================================================================
// Types
// =============================================================================

/**
 * Which group an item belongs to inside the overflow panel.
 *
 * All three render as icon grids; the role only decides which group an item
 * lands in, and the groups are laid out in the order below.
 *
 * - `toggle` — formatting marks and state controls (bold, undo, indent).
 * - `adjustment` — controls that carry a value (font, size, alignment,
 *   line height), which render as their own dropdown triggers.
 * - `action` — one-shot commands (horizontal rule, clear formatting).
 */
export type ToolbarOverflowRole = "toggle" | "adjustment" | "action";

/** Items grouped by role, each preserving the caller's original order. */
export interface ToolbarOverflowSections<T extends string> {
  /** Formatting and state controls, rendered first. */
  readonly toggles: readonly T[];
  /** Value-carrying controls. */
  readonly adjustments: readonly T[];
  /** One-shot commands, rendered last. */
  readonly actions: readonly T[];
}

// =============================================================================
// Role Map
// =============================================================================

/**
 * Explicit role per item key. Anything absent falls back to `toggle`, which
 * keeps bubble menu keys and consumer-authored keys rendering as they always
 * have rather than vanishing from an unrecognised group.
 *
 * `heading` is React's synthetic key for the collapsed H1/H2/H3 dropdown;
 * `heading1..3` is what Angular passes for the same control.
 */
const OVERFLOW_ROLES: Readonly<Record<string, ToolbarOverflowRole>> = {
  // ─── Value-carrying controls ───────────────────────────────────────────────
  heading: "adjustment",
  heading1: "adjustment",
  heading2: "adjustment",
  heading3: "adjustment",
  blockType: "adjustment",
  fontFamily: "adjustment",
  fontSize: "adjustment",
  textAlign: "adjustment",
  lineHeight: "adjustment",
  letterSpacing: "adjustment",

  // ─── One-shot commands ─────────────────────────────────────────────────────
  horizontalRule: "action",
  table: "action",
  clear: "action",
  clearFormatting: "action",
  emoji: "action",
  invisibleCharacters: "action",
  accessibilityChecker: "action",
};

// =============================================================================
// API
// =============================================================================

/**
 * Returns the overflow role for an item key.
 *
 * @param key - Toolbar, bubble menu, or synthetic item key
 * @returns The item's role; `"toggle"` for anything not explicitly mapped
 *
 * @example
 * ```typescript
 * toolbarOverflowRole("fontSize"); // "adjustment"
 * toolbarOverflowRole("bold");     // "toggle"
 * ```
 */
export function toolbarOverflowRole(key: string): ToolbarOverflowRole {
  return OVERFLOW_ROLES[key] ?? "toggle";
}

/**
 * Groups overflow items into the three panel sections.
 *
 * Separators are discarded: the panel already groups by section, and a rule
 * inside a section would be grouping that contradicts it. Order within each
 * group is the caller's order, so a consumer who reorders
 * `config.toolbar.items` still sees their sequence inside each group.
 *
 * @param items - The overflow slice, separators included
 * @returns The three groups, each possibly empty
 *
 * @example
 * ```typescript
 * const { toggles, adjustments, actions } = buildToolbarOverflowSections([
 *   "textAlign", "separator", "undo", "clear",
 * ]);
 * // toggles: ["undo"], adjustments: ["textAlign"], actions: ["clear"]
 * ```
 */
export function buildToolbarOverflowSections<T extends string>(
  items: readonly T[],
): ToolbarOverflowSections<T> {
  const toggles: T[] = [];
  const adjustments: T[] = [];
  const actions: T[] = [];

  for (const item of items) {
    if (item === "separator") continue;
    switch (toolbarOverflowRole(item)) {
      case "adjustment":
        adjustments.push(item);
        break;
      case "action":
        actions.push(item);
        break;
      default:
        toggles.push(item);
    }
  }

  return { toggles, adjustments, actions };
}
