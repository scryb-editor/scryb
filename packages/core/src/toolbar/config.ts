/**
 * Toolbar configuration types, constants, and dropdown option arrays for Scryb adapters.
 *
 * Canonical source of truth — both Angular and React adapters import from here.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * All available toolbar item keys.
 * Canonical definition — both Angular and React adapters reference this union.
 *
 * Note: `"invisibleCharacters"` is available only when consumers enable the
 * Invisible Characters extension via `config.invisibleCharacters.enabled: true`.
 * The item is intentionally NOT part of `DEFAULT_TOOLBAR_ORDER` — consumers
 * must opt in by listing it in their `config.toolbar.items` array.
 */
export type ToolbarItemKey =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "code"
  | "superscript"
  | "subscript"
  | "textColor"
  | "separator"
  | "fontFamily"
  | "fontSize"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "blockquote"
  | "textAlign"
  | "lineHeight"
  | "letterSpacing"
  | "indent"
  | "outdent"
  | "link"
  | "image"
  | "horizontalRule"
  | "table"
  | "undo"
  | "redo"
  | "clear"
  | "accessibilityChecker"
  | "invisibleCharacters"
  | "emoji";

// =============================================================================
// Default Toolbar Order
// =============================================================================

/**
 * Default toolbar item ordering for all Scryb adapters.
 *
 * The first `DEFAULT_TOOLBAR_MAX_VISIBLE_ITEMS` entries are the rest state:
 * block type, inline marks, lists/quote, insertables, history. Everything
 * after that renders inside the toolbar's "more" overflow menu, the same
 * progressive-disclosure mechanism the bubble menu uses. A wall of
 * always-visible controls is the one look the product must not have.
 *
 * `"accessibilityChecker"` is withheld. The checker works, but the surface
 * around it — where its findings live, how they are dismissed, whether a
 * button is even the right affordance for a debounced continuous analysis —
 * is not finished, so it ships unadvertised rather than half-designed. The
 * key, the extension, the panel components and `checkAccessibility()` all
 * stay: listing it in `config.toolbar.items` brings the whole feature back.
 * Documentation deliberately does not present it yet.
 */
export const DEFAULT_TOOLBAR_ORDER: readonly ToolbarItemKey[] = [
  "heading1",
  "separator",
  "bold",
  "italic",
  "underline",
  "strike",
  "separator",
  "bulletList",
  "orderedList",
  "blockquote",
  "separator",
  "link",
  "image",
  "table",
  // ── Overflow (index >= DEFAULT_TOOLBAR_MAX_VISIBLE_ITEMS) ──────────────────
  "textAlign",
  "textColor",
  "separator",
  "undo",
  "redo",
  "separator",
  "fontFamily",
  "fontSize",
  "separator",
  "code",
  "superscript",
  "subscript",
  "separator",
  "lineHeight",
  "letterSpacing",
  "outdent",
  "indent",
  "separator",
  "horizontalRule",
  "clear",
] as const;

/**
 * Default number of `DEFAULT_TOOLBAR_ORDER` entries (separators included)
 * visible before the toolbar's "more" overflow button. Both adapters import
 * this value; no adapter-local numeric literal is permitted.
 *
 * 14 entries = 11 controls + 3 separators: block type, inline marks,
 * lists/quote, insertables. This fits ONE row at ~550px — the width the
 * flagship demos actually give the editor — so the advertised rest state is
 * what buyers see. Alignment, colour, history (⌘Z still works) and
 * typographic tuning live in the overflow. A two-row wrap is the one look
 * the product must not have at rest.
 */
export const DEFAULT_TOOLBAR_MAX_VISIBLE_ITEMS = 14;

// =============================================================================
// Dropdown Option Arrays
// =============================================================================

/**
 * Available font size options (in px).
 */
export const FONT_SIZE_OPTIONS: readonly string[] = [
  "8px",
  "9px",
  "10px",
  "11px",
  "12px",
  "14px",
  "16px",
  "18px",
  "20px",
  "24px",
  "28px",
  "32px",
  "36px",
  "48px",
  "64px",
  "72px",
  "96px",
] as const;

/**
 * Available font family options with display labels.
 *
 * `value` is the CSS font stack the option applies; `null` is the "Default"
 * entry, which unsets the mark so text falls back to the host font.
 */
export const FONT_FAMILY_OPTIONS: readonly { label: string; value: string | null }[] = [
  { label: "Default", value: null },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Lucida Console", value: "'Lucida Console', Monaco, monospace" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', Helvetica, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
] as const;

/**
 * Heading levels offered by the heading/block-type dropdowns.
 *
 * Canonical for both adapters: the Angular dropdowns once defaulted to H1-H4
 * (and the bubble block-type list to H1-H6) while React offered H1-H3, so the
 * same toolbar showed different documents-structure options per framework.
 * Deeper levels stay available through each dropdown's config inputs.
 */
export const HEADING_DROPDOWN_LEVELS: readonly (1 | 2 | 3)[] = [1, 2, 3] as const;

/**
 * Available line height options.
 */
export const LINE_HEIGHT_OPTIONS: readonly string[] = [
  "1",
  "1.15",
  "1.5",
  "2",
  "2.5",
  "3",
] as const;

/**
 * Available letter spacing options.
 */
export const LETTER_SPACING_OPTIONS: readonly string[] = [
  "0",
  "0.5px",
  "1px",
  "1.5px",
  "2px",
  "3px",
  "5px",
] as const;

// =============================================================================
// Material Icons Map
// =============================================================================

/**
 * Maps toolbar item keys to Material Symbols Outlined icon names.
 * Consistent across Angular and React adapters for visual parity.
 */
export const MATERIAL_ICONS: Record<string, string> = {
  bold: "format_bold",
  italic: "format_italic",
  underline: "format_underlined",
  strike: "strikethrough_s",
  code: "code",
  superscript: "superscript",
  subscript: "subscript",
  textColor: "format_color_text",
  fontFamily: "font_download",
  fontSize: "format_size",
  heading1: "format_h1",
  heading2: "format_h2",
  heading3: "format_h3",
  bulletList: "format_list_bulleted",
  orderedList: "format_list_numbered",
  taskList: "checklist",
  blockquote: "format_quote",
  textAlign: "format_align_left",
  lineHeight: "format_line_spacing",
  letterSpacing: "text_fields",
  indent: "format_indent_increase",
  outdent: "format_indent_decrease",
  link: "link",
  image: "image",
  horizontalRule: "horizontal_rule",
  table: "table_chart",
  undo: "undo",
  redo: "redo",
  clear: "format_clear",
  accessibilityChecker: "accessibility_new",
  invisibleCharacters: "format_paragraph",
  emoji: "emoji_emotions",
};
