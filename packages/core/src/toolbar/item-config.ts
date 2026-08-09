/**
 * Toolbar item configuration map for Scryb adapters.
 *
 * Provides a single source of truth for per-item rendering config:
 * icon, label, command function, and isActive check.
 *
 * Both Angular and React adapters consume this map to eliminate
 * duplicated switch/case logic.
 */

import type { Editor } from "@tiptap/core";
import { MATERIAL_ICONS } from "./config";
import type { ToolbarItemKey } from "./config";
import { openEmojiPopup } from "../emoji/callback-store";
import {
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrike,
  toggleCode,
  toggleSuperscript,
  toggleSubscript,
  toggleHeading,
  toggleBulletList,
  toggleOrderedList,
  toggleTaskList,
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
 * Configuration for a single toolbar item.
 *
 * Consumed by adapter toolbars to render buttons, dropdowns, and separators
 * without adapter-local switch/case logic.
 */
export interface ToolbarItemConfig {
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
   * a plain `editor.isActive(name)` (e.g. heading levels, storage lookups).
   * Only read when `activeName` is not set.
   */
  isActive?: ((editor: Editor) => boolean) | null;
  /**
   * Platform-neutral keyboard shortcut ("Mod+Shift+S") the item's command is
   * already bound to. Rendered into tooltips via `toolbarItemTooltip` —
   * definitions here must match what Tiptap actually binds.
   */
  shortcut?: string;
  /**
   * Predicate for items that can be momentarily unavailable (undo with an
   * empty history, say). Adapters disable the button while this returns true;
   * items without it are always enabled.
   */
  isDisabled?: (editor: Editor) => boolean;
}

// =============================================================================
// Config Map
// =============================================================================

/**
 * Maps every ToolbarItemKey to its rendering configuration.
 *
 * Used by Angular and React toolbar adapters as the single source of truth
 * for icon, label, command, and isActive per item.
 *
 * `as const satisfies` enforces compile-time exhaustiveness — TypeScript errors
 * if any ToolbarItemKey is missing.
 *
 * @example
 * ```typescript
 * const config = TOOLBAR_ITEM_CONFIG["bold"];
 * config.command?.(editor); // toggleBold
 * config.isActive?.(editor); // editor.isActive("bold")
 * ```
 */
export const TOOLBAR_ITEM_CONFIG = {
  // ─── Simple button items (command + isActive) ──────────────────────────────

  bold: {
    icon: MATERIAL_ICONS["bold"],
    label: "Bold",
    command: toggleBold,
    activeName: "bold",
    shortcut: "Mod+B",
  },

  italic: {
    icon: MATERIAL_ICONS["italic"],
    label: "Italic",
    command: toggleItalic,
    activeName: "italic",
    shortcut: "Mod+I",
  },

  underline: {
    icon: MATERIAL_ICONS["underline"],
    label: "Underline",
    command: toggleUnderline,
    activeName: "underline",
    shortcut: "Mod+U",
  },

  strike: {
    icon: MATERIAL_ICONS["strike"],
    label: "Strikethrough",
    command: toggleStrike,
    activeName: "strike",
    shortcut: "Mod+Shift+S",
  },

  code: {
    icon: MATERIAL_ICONS["code"],
    label: "Code",
    command: toggleCode,
    activeName: "code",
    shortcut: "Mod+E",
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

  heading1: {
    icon: MATERIAL_ICONS["heading1"],
    label: "Heading 1",
    command: (editor: Editor) => toggleHeading(editor, 1),
    isActive: (editor: Editor) => editor.isActive("heading", { level: 1 }),
  },

  heading2: {
    icon: MATERIAL_ICONS["heading2"],
    label: "Heading 2",
    command: (editor: Editor) => toggleHeading(editor, 2),
    isActive: (editor: Editor) => editor.isActive("heading", { level: 2 }),
  },

  heading3: {
    icon: MATERIAL_ICONS["heading3"],
    label: "Heading 3",
    command: (editor: Editor) => toggleHeading(editor, 3),
    isActive: (editor: Editor) => editor.isActive("heading", { level: 3 }),
  },

  bulletList: {
    icon: MATERIAL_ICONS["bulletList"],
    label: "Bullet List",
    command: toggleBulletList,
    activeName: "bulletList",
    shortcut: "Mod+Shift+8",
  },

  orderedList: {
    icon: MATERIAL_ICONS["orderedList"],
    label: "Ordered List",
    command: toggleOrderedList,
    activeName: "orderedList",
    shortcut: "Mod+Shift+7",
  },

  taskList: {
    icon: MATERIAL_ICONS["taskList"],
    label: "Task list",
    command: toggleTaskList,
    activeName: "taskList",
  },

  blockquote: {
    icon: MATERIAL_ICONS["blockquote"],
    label: "Blockquote",
    command: toggleBlockquote,
    activeName: "blockquote",
    shortcut: "Mod+Shift+B",
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
    shortcut: "Mod+Z",
    isDisabled: (editor: Editor) => !editor.can().undo(),
  },

  redo: {
    icon: MATERIAL_ICONS["redo"],
    label: "Redo",
    command: redo,
    shortcut: "Mod+Shift+Z",
    isDisabled: (editor: Editor) => !editor.can().redo(),
  },

  // `format_clear` universally means "remove formatting". This used to call
  // clearContent, which wiped the whole document from an unlabeled 36px icon
  // with no confirmation — a support ticket, not a feature. Consumers who want
  // a destructive clear-document control can wire `clearContent` themselves,
  // behind their own confirmation.
  clear: {
    icon: MATERIAL_ICONS["clear"],
    label: "Clear formatting",
    command: clearFormatting,
  },

  // ─── Dropdown/panel items (command = null) ─────────────────────────────────

  textColor: {
    icon: MATERIAL_ICONS["textColor"],
    label: "Text Color",
    command: null,
  },

  fontFamily: {
    icon: MATERIAL_ICONS["fontFamily"],
    label: "Font Family",
    command: null,
  },

  fontSize: {
    icon: MATERIAL_ICONS["fontSize"],
    label: "Font Size",
    command: null,
  },

  textAlign: {
    icon: MATERIAL_ICONS["textAlign"],
    label: "Text Align",
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

  invisibleCharacters: {
    icon: MATERIAL_ICONS["invisibleCharacters"],
    label: "Show invisible characters",
    command: (editor: Editor) => {
      editor.chain().focus().toggleInvisibleCharacters().run();
    },
    isActive: (editor: Editor) => {
      const storage = editor.storage["invisibleCharacters"] as
        | { visibility?: () => boolean }
        | undefined;
      return storage?.visibility?.() ?? false;
    },
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
} as const satisfies Record<ToolbarItemKey, ToolbarItemConfig>;
