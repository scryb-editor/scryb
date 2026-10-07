/**
 * Bubble menu item configuration types and defaults for the Scryb text bubble menu.
 *
 * Canonical source of truth — both Angular and React adapters import from here.
 *
 * NOTE: BubbleMenuConfig (coordinator config) lives in ./types.ts and is unrelated.
 * This file defines configuration for the ITEM LIST shown inside the text bubble menu.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * All available item keys for the text selection bubble menu.
 * Canonical definition — both Angular and React adapters reference this union.
 */
export type BubbleMenuItemKey =
  | "blockType"
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "code"
  | "superscript"
  | "subscript"
  | "fontSize"
  | "fontFamily"
  | "lineHeight"
  | "letterSpacing"
  | "outdent"
  | "indent"
  | "textColor"
  | "link"
  | "textAlign"
  | "bulletList"
  | "orderedList"
  | "blockquote"
  | "horizontalRule"
  | "table"
  | "image"
  | "clearFormatting"
  | "clear"
  | "undo"
  | "redo"
  | "math"
  | "separator"
  | "accessibilityChecker"
  | "emoji";

/**
 * Configuration for the text selection bubble menu's item list.
 * Passed as a consumer prop to configure visible items and overflow threshold.
 *
 * Do not confuse with BubbleMenuConfig in ./types.ts (coordinator registration config).
 */
export interface BubbleMenuItemsConfig {
  /** Ordered array of item keys to show. Defaults to DEFAULT_BUBBLE_MENU_ITEMS. */
  items?: BubbleMenuItemKey[];
  /** Maximum items visible before overflow "more" button appears. */
  maxVisibleItems?: number;
}

// =============================================================================
// Default Values
// =============================================================================

/**
 * Default maximum visible items in the text bubble menu before the overflow
 * "more" button appears. Both Angular and React adapters import this value;
 * no adapter-local numeric literal is permitted.
 *
 * 7 entries = 5 controls + 2 separators. The bubble menu is an accelerator
 * over a selection, not a second toolbar: anything past block type, the core
 * marks, and link belongs in the overflow, or the menu grows into a two-row
 * slab that occludes the line above the selection.
 */
export const DEFAULT_MAX_VISIBLE_ITEMS = 7;

// =============================================================================
// Default Items
// =============================================================================

/**
 * Default text bubble menu item order.
 *
 * The first `DEFAULT_MAX_VISIBLE_ITEMS` entries — block type, bold, italic,
 * underline, link — are the rest state; everything after renders in the
 * "more" overflow popover.
 *
 * Every entry acts on the selection that summoned the menu. Items whose scope
 * is the document or the cursor are deliberately absent, because a popover
 * anchored to selected text is the wrong place to reach them:
 *
 * - `"undo"`/`"redo"` walk document history. Mod-Z and Mod-Shift-Z already
 *   reach them from anywhere, which is why no editor of this kind shows a
 *   history button in a selection menu.
 * - `"image"`, `"table"`, `"horizontalRule"` insert at the cursor rather than
 *   transforming the selection. The slash menu carries all three, and the side
 *   menu's add button opens that same menu — so a toolbar-less "bubble only"
 *   editor still reaches them.
 *
 * `"accessibilityChecker"` is absent for a different reason: the feature is
 * withheld pending polish, so it is off every default surface rather than
 * misplaced on this one. See the note on `DEFAULT_TOOLBAR_ORDER`.
 *
 * All of these remain valid keys: a consumer who wants them lists them in
 * `config.bubbleMenu.items`. This list is the product's opinion, not a limit.
 *
 * Both adapters import from here; no adapter-local duplicate list is permitted.
 */
export const DEFAULT_BUBBLE_MENU_ITEMS: readonly BubbleMenuItemKey[] = [
  "blockType",
  "separator",
  "bold",
  "italic",
  "underline",
  "separator",
  "link",
  // ── Overflow (index >= DEFAULT_MAX_VISIBLE_ITEMS) ──────────────────────────
  "strike",
  "code",
  "superscript",
  "subscript",
  "textColor",
  "separator",
  "fontSize",
  "fontFamily",
  "lineHeight",
  "letterSpacing",
  "separator",
  "textAlign",
  "orderedList",
  "bulletList",
  "blockquote",
  "outdent",
  "indent",
  "separator",
  "clearFormatting",
] as const;

// =============================================================================
// IMAGE BUBBLE MENU CONFIG
// =============================================================================

/**
 * Configuration for the image bubble menu.
 * Controls which action buttons are visible when an image node is selected.
 */
export interface ImageBubbleMenuConfig {
  /** Show change image button */
  changeImage?: boolean;
  /** Show edit alt text button */
  editAltText?: boolean;
  /** Show resize to small (25%) */
  resizeSmall?: boolean;
  /** Show resize to medium (50%) */
  resizeMedium?: boolean;
  /** Show resize to large (75%) */
  resizeLarge?: boolean;
  /** Show resize to original (100%) */
  resizeOriginal?: boolean;
  /** Show delete image button */
  deleteImage?: boolean;
  /** Show separator between groups */
  separator?: boolean;
}

/**
 * Default image bubble menu configuration — all options enabled.
 * Canonical default for both Angular and React adapters.
 */
export const DEFAULT_IMAGE_BUBBLE_MENU_CONFIG: ImageBubbleMenuConfig = {
  changeImage: true,
  editAltText: true,
  resizeSmall: true,
  resizeMedium: true,
  resizeLarge: true,
  resizeOriginal: true,
  deleteImage: true,
  separator: true,
};

// =============================================================================
// TABLE BUBBLE MENU CONFIG
// =============================================================================

/**
 * Configuration for the table bubble menu.
 * Controls which row/column/table action buttons are visible when a table is selected.
 */
export interface TableBubbleMenuConfig {
  /** Add row before current */
  addRowBefore?: boolean;
  /** Add row after current */
  addRowAfter?: boolean;
  /** Delete current row */
  deleteRow?: boolean;
  /** Add column before current */
  addColumnBefore?: boolean;
  /** Add column after current */
  addColumnAfter?: boolean;
  /** Delete current column */
  deleteColumn?: boolean;
  /** Delete entire table */
  deleteTable?: boolean;
  /** Toggle header row */
  toggleHeaderRow?: boolean;
  /** Toggle header column */
  toggleHeaderColumn?: boolean;
  /** Show separator between groups */
  separator?: boolean;
}

/**
 * Default table bubble menu configuration — all options enabled.
 * Canonical default for both Angular and React adapters.
 */
export const DEFAULT_TABLE_BUBBLE_MENU_CONFIG: TableBubbleMenuConfig = {
  addRowBefore: true,
  addRowAfter: true,
  deleteRow: true,
  addColumnBefore: true,
  addColumnAfter: true,
  deleteColumn: true,
  deleteTable: true,
  toggleHeaderRow: true,
  toggleHeaderColumn: true,
  separator: true,
};

// =============================================================================
// CELL BUBBLE MENU CONFIG
// =============================================================================

/**
 * Configuration for the table cell bubble menu.
 * Controls merge/split cell button visibility when a cell is selected.
 */
export interface CellBubbleMenuConfig {
  /** Show merge cells button */
  mergeCells?: boolean;
  /** Show split cell button */
  splitCell?: boolean;
}

/**
 * Default cell bubble menu configuration — all options enabled.
 * Canonical default for both Angular and React adapters.
 */
export const DEFAULT_CELL_BUBBLE_MENU_CONFIG: CellBubbleMenuConfig = {
  mergeCells: true,
  splitCell: true,
};

// =============================================================================
// MENU NORMALIZATION
// =============================================================================

/**
 * Strips leading and trailing separators and collapses consecutive separators
 * from a BubbleMenuItemKey array.
 *
 * Pure function — safe to use in computed values and useMemo.
 * Canonical implementation — both Angular and React adapters import from here;
 * no local copy is permitted in either adapter.
 *
 * @example
 * normalizeMenuItems(["separator", "bold", "separator", "separator", "italic", "separator"])
 * // → ["bold", "separator", "italic"]
 */
export function normalizeMenuItems(items: BubbleMenuItemKey[]): BubbleMenuItemKey[] {
  const result: BubbleMenuItemKey[] = [];
  let last: BubbleMenuItemKey | null = null;
  for (const item of items) {
    if (item === "separator" && last === "separator") continue;
    result.push(item);
    last = item;
  }
  if (result[0] === "separator") result.shift();
  if (result[result.length - 1] === "separator") result.pop();
  return result;
}
