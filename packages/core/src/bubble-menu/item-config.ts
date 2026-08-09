/**
 * Bubble menu item configuration map for Scryb adapters.
 *
 * Provides a single source of truth for per-item rendering config:
 * icon, label, command function, and isActive check.
 *
 * Both Angular and React adapters consume this map to eliminate
 * duplicated switch/case logic.
 */

import type { Editor } from "@tiptap/core";
import type { BubbleMenuItemKey } from "./config";
import { MATERIAL_ICONS } from "../toolbar/config";
import { openEmojiPopup } from "../emoji/callback-store";
import {
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrike,
  toggleCode,
  toggleSuperscript,
  toggleSubscript,
  toggleBulletList,
  toggleOrderedList,
  toggleBlockquote,
  insertHorizontalRule,
  indent,
  outdent,
  insertTable,
  undo,
  redo,
  clearFormatting,
} from "../commands";

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for a single bubble menu item.
 *
 * Consumed by adapter bubble menus to render buttons, dropdowns, and separators
 * without adapter-local switch/case logic.
 */
export interface BubbleMenuItemConfig {
  /** Material Symbols Outlined icon name. */
  icon: string;
  /** English default label / tooltip text. */
  label: string;
  /** Execute the item's primary action. null for dropdown/panel items. */
  command: ((editor: Editor) => void) | null;
  /**
   * Name passed to `editor.isActive(name)` for the common case where active
   * state is a plain mark/node lookup. Preferred over `isActive` because it
   * avoids allocating an inline closure per item at module load.
   */
  activeName?: string;
  /**
   * Custom active-state predicate for items whose active check is more than
   * a plain `editor.isActive(name)`. Only read when `activeName` is not set.
   */
  isActive?: ((editor: Editor) => boolean) | null;
}

// =============================================================================
// Config Map
// =============================================================================

/**
 * Maps every BubbleMenuItemKey to its rendering configuration.
 *
 * Used by Angular and React bubble menu adapters as the single source of truth
 * for icon, label, command, and isActive per item.
 *
 * `as const satisfies` enforces compile-time exhaustiveness — TypeScript errors
 * if any BubbleMenuItemKey is missing.
 *
 * @example
 * ```typescript
 * const config = BUBBLE_MENU_ITEM_CONFIG["bold"];
 * config.command?.(editor); // toggleBold
 * config.isActive?.(editor); // editor.isActive("bold")
 * ```
 */
export const BUBBLE_MENU_ITEM_CONFIG = {
  // ─── Simple button items (command + isActive) ──────────────────────────────

  bold: {
    icon: MATERIAL_ICONS["bold"],
    label: "Bold",
    command: toggleBold,
    activeName: "bold",
  },

  italic: {
    icon: MATERIAL_ICONS["italic"],
    label: "Italic",
    command: toggleItalic,
    activeName: "italic",
  },

  underline: {
    icon: MATERIAL_ICONS["underline"],
    label: "Underline",
    command: toggleUnderline,
    activeName: "underline",
  },

  strike: {
    icon: MATERIAL_ICONS["strike"],
    label: "Strikethrough",
    command: toggleStrike,
    activeName: "strike",
  },

  code: {
    icon: MATERIAL_ICONS["code"],
    label: "Code",
    command: toggleCode,
    activeName: "code",
  },

  superscript: {
    icon: MATERIAL_ICONS["superscript"],
    label: "Superscript",
    command: toggleSuperscript,
    activeName: "superscript",
  },

  subscript: {
    icon: MATERIAL_ICONS["subscript"],
    label: "Subscript",
    command: toggleSubscript,
    activeName: "subscript",
  },

  bulletList: {
    icon: MATERIAL_ICONS["bulletList"],
    label: "Bullet List",
    command: toggleBulletList,
    activeName: "bulletList",
  },

  orderedList: {
    icon: MATERIAL_ICONS["orderedList"],
    label: "Ordered List",
    command: toggleOrderedList,
    activeName: "orderedList",
  },

  blockquote: {
    icon: MATERIAL_ICONS["blockquote"],
    label: "Blockquote",
    command: toggleBlockquote,
    activeName: "blockquote",
  },

  indent: {
    icon: MATERIAL_ICONS["indent"],
    label: "Indent",
    command: indent,
  },

  outdent: {
    icon: MATERIAL_ICONS["outdent"],
    label: "Outdent",
    command: outdent,
  },

  horizontalRule: {
    icon: MATERIAL_ICONS["horizontalRule"],
    label: "Horizontal Rule",
    command: insertHorizontalRule,
  },

  table: {
    icon: MATERIAL_ICONS["table"],
    label: "Table",
    command: (editor: Editor) => insertTable(editor),
  },

  undo: {
    icon: MATERIAL_ICONS["undo"],
    label: "Undo",
    command: undo,
  },

  redo: {
    icon: MATERIAL_ICONS["redo"],
    label: "Redo",
    command: redo,
  },

  // A synonym of `clearFormatting`, matching the same decision already taken for
  // the toolbar: `format_clear` universally means "remove formatting", and the
  // label resolves through `toolbar.clear` ("Clear formatting") in every locale.
  // Wired to clearContent, this button read "Clear formatting" and wiped the
  // whole document from a popover anchored to a selection. Consumers who want a
  // destructive clear-document control can wire `clearContent` themselves,
  // behind their own confirmation.
  clear: {
    icon: MATERIAL_ICONS["clear"],
    label: "Clear formatting",
    command: clearFormatting,
  },

  clearFormatting: {
    icon: "format_clear",
    label: "Clear Formatting",
    command: clearFormatting,
  },

  // ─── Dropdown/panel items (command = null) ─────────────────────────────────

  blockType: {
    icon: "segment",
    label: "Block Type",
    command: null,
  },

  fontSize: {
    icon: MATERIAL_ICONS["fontSize"],
    label: "Font Size",
    command: null,
  },

  fontFamily: {
    icon: MATERIAL_ICONS["fontFamily"],
    label: "Font Family",
    command: null,
  },

  lineHeight: {
    icon: MATERIAL_ICONS["lineHeight"],
    label: "Line Height",
    command: null,
  },

  letterSpacing: {
    icon: MATERIAL_ICONS["letterSpacing"],
    label: "Letter Spacing",
    command: null,
  },

  textColor: {
    icon: MATERIAL_ICONS["textColor"],
    label: "Text Color",
    command: null,
  },

  textAlign: {
    icon: MATERIAL_ICONS["textAlign"],
    label: "Text Align",
    command: null,
  },

  link: {
    icon: MATERIAL_ICONS["link"],
    label: "Link",
    command: null,
  },

  image: {
    icon: MATERIAL_ICONS["image"],
    label: "Image",
    command: null,
  },

  accessibilityChecker: {
    icon: MATERIAL_ICONS["accessibilityChecker"],
    label: "Accessibility",
    command: null,
  },

  // ─── Not-yet-implemented items ─────────────────────────────────────────────

  math: {
    icon: "functions",
    label: "Math",
    command: null,
  },

  emoji: {
    icon: MATERIAL_ICONS["emoji"],
    label: "Insert emoji",
    command: openEmojiPopup,
  },

  // ─── Separator (all null/empty) ────────────────────────────────────────────

  separator: {
    icon: "",
    label: "",
    command: null,
  },
} as const satisfies Record<BubbleMenuItemKey, BubbleMenuItemConfig>;
