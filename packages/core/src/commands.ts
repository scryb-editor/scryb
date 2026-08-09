import type { Editor } from "@tiptap/core";

// Module augmentation: indent/outdent commands (provided by IndentExtension in extensions)
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
    fontFamily: {
      setFontFamily: (fontFamily: string) => ReturnType;
      unsetFontFamily: () => ReturnType;
    };
  }
}

// =============================================================================
// Types
// =============================================================================

/**
 * Command names that can be checked for availability
 */
type CheckableCommand =
  | "toggleBold"
  | "toggleItalic"
  | "toggleStrike"
  | "toggleCode"
  | "toggleUnderline"
  | "toggleSuperscript"
  | "toggleSubscript"
  | "setTextAlign"
  | "indent"
  | "outdent"
  | "toggleLink"
  | "insertHorizontalRule"
  | "undo"
  | "redo"
  | "insertTable"
  | "addColumnBefore"
  | "addColumnAfter"
  | "deleteColumn"
  | "addRowBefore"
  | "addRowAfter"
  | "deleteRow"
  | "deleteTable"
  | "mergeCells"
  | "splitCell"
  | "toggleHeaderColumn"
  | "toggleHeaderRow"
  | "toggleHeaderCell";

/**
 * Text alignment options
 */
export type TextAlignment = "left" | "center" | "right" | "justify";

/**
 * Heading level options
 */
export type HeadingLevel = 1 | 2 | 3;

// =============================================================================
// Constants
// =============================================================================

/**
 * Node types that support indentation
 */
const INDENTABLE_NODE_TYPES = ["paragraph", "listItem", "heading", "blockquote"] as const;

const VALID_COMMANDS: CheckableCommand[] = [
  "toggleBold",
  "toggleItalic",
  "toggleStrike",
  "toggleCode",
  "toggleUnderline",
  "toggleSuperscript",
  "toggleSubscript",
  "setTextAlign",
  "indent",
  "outdent",
  "toggleLink",
  "insertHorizontalRule",
  "undo",
  "redo",
  "insertTable",
  "addColumnBefore",
  "addColumnAfter",
  "deleteColumn",
  "addRowBefore",
  "addRowAfter",
  "deleteRow",
  "deleteTable",
  "mergeCells",
  "splitCell",
  "toggleHeaderColumn",
  "toggleHeaderRow",
  "toggleHeaderCell",
];

// =============================================================================
// EditorCommands class
// =============================================================================

/**
 * Plain TypeScript class for executing editor commands.
 *
 * Framework-agnostic — no Angular DI, no signals, no decorators.
 * All methods take an Editor instance as the first parameter, making this
 * class reusable across multiple editor instances and frameworks.
 *
 * @example
 * ```typescript
 * const commands = new EditorCommands();
 * commands.toggleBold(editor);
 * ```
 */
export class EditorCommands {
  // ═══════════════════════════════════════════════════════════════════════════
  // State Queries
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Checks if a mark or node is active at the current selection.
   *
   * @param editor - The editor instance
   * @param name - Name of the mark or node to check
   * @param attributes - Optional attributes to match
   * @returns true if the mark/node is active
   */
  isActive(editor: Editor, name: string, attributes?: Record<string, unknown>): boolean {
    return editor.isActive(name, attributes);
  }

  /**
   * Checks if a command can be executed at the current selection.
   *
   * @param editor - The editor instance
   * @param command - Command name to check
   * @returns true if the command can be executed
   */
  canExecute(editor: Editor, command: string): boolean {
    if (!editor) return false;
    if (!isValidCommand(command)) return false;
    return checkCommand(editor, command as CheckableCommand);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Text Formatting Commands
  // ═══════════════════════════════════════════════════════════════════════════

  toggleBold(editor: Editor): void {
    editor.chain().focus().toggleBold().run();
  }

  toggleItalic(editor: Editor): void {
    editor.chain().focus().toggleItalic().run();
  }

  toggleUnderline(editor: Editor): void {
    editor.chain().focus().toggleUnderline().run();
  }

  toggleStrike(editor: Editor): void {
    editor.chain().focus().toggleStrike().run();
  }

  toggleCode(editor: Editor): void {
    editor.chain().focus().toggleCode().run();
  }

  toggleSuperscript(editor: Editor): void {
    editor.chain().focus().toggleSuperscript().run();
  }

  toggleSubscript(editor: Editor): void {
    editor.chain().focus().toggleSubscript().run();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Heading Commands
  // ═══════════════════════════════════════════════════════════════════════════

  toggleHeading(editor: Editor, level: HeadingLevel): void {
    editor.chain().focus().toggleHeading({ level }).run();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // List Commands
  // ═══════════════════════════════════════════════════════════════════════════

  toggleBulletList(editor: Editor): void {
    editor.chain().focus().toggleBulletList().run();
  }

  toggleOrderedList(editor: Editor): void {
    editor.chain().focus().toggleOrderedList().run();
  }

  toggleTaskList(editor: Editor): void {
    editor.chain().focus().toggleTaskList().run();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Block Commands
  // ═══════════════════════════════════════════════════════════════════════════

  toggleBlockquote(editor: Editor): void {
    editor.chain().focus().toggleBlockquote().run();
  }

  insertHorizontalRule(editor: Editor): void {
    editor.chain().focus().setHorizontalRule().run();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Text Alignment Commands
  // ═══════════════════════════════════════════════════════════════════════════

  setTextAlign(editor: Editor, alignment: TextAlignment): void {
    editor.chain().focus().setTextAlign(alignment).run();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Indentation Commands
  // ═══════════════════════════════════════════════════════════════════════════

  indent(editor: Editor): void {
    editor.chain().focus().indent().run();
  }

  outdent(editor: Editor): void {
    editor.chain().focus().outdent().run();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Color Commands
  // ═══════════════════════════════════════════════════════════════════════════

  setTextColor(editor: Editor, color: string): void {
    editor.chain().focus().setColor(color).run();
  }

  unsetTextColor(editor: Editor): void {
    editor.chain().focus().unsetColor().run();
  }

  getTextColor(editor: Editor): string | null {
    const attrs = editor.getAttributes("textStyle");
    return (attrs?.["color"] as string) || null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Font Commands
  // ═══════════════════════════════════════════════════════════════════════════

  setFontFamily(editor: Editor, fontFamily: string | null): void {
    if (fontFamily === null) {
      this.unsetFontFamily(editor);
    } else {
      editor.chain().focus().setFontFamily(fontFamily).run();
    }
  }

  unsetFontFamily(editor: Editor): void {
    editor.chain().focus().unsetFontFamily().run();
  }

  getFontFamily(editor: Editor): string | null {
    const attrs = editor.getAttributes("textStyle");
    return (attrs?.["fontFamily"] as string) || null;
  }

  setFontSize(editor: Editor, size: string): void {
    editor.chain().focus().setMark("textStyle", { fontSize: size }).run();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Link Commands
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Toggles a link on the current selection.
   * @param editor - The editor instance.
   * @param url - The URL to link to. If omitted, the method is a no-op.
   */
  toggleLink(editor: Editor, url?: string): void {
    if (!url) return;
    editor.chain().focus().toggleLink({ href: url }).run();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Table Commands
  // ═══════════════════════════════════════════════════════════════════════════

  insertTable(editor: Editor, rows: number = 3, cols: number = 3): void {
    editor.chain().focus().insertTable({ rows, cols }).run();
  }

  addColumnBefore(editor: Editor): void {
    editor.chain().focus().addColumnBefore().run();
  }

  addColumnAfter(editor: Editor): void {
    editor.chain().focus().addColumnAfter().run();
  }

  deleteColumn(editor: Editor): void {
    editor.chain().focus().deleteColumn().run();
  }

  addRowBefore(editor: Editor): void {
    editor.chain().focus().addRowBefore().run();
  }

  addRowAfter(editor: Editor): void {
    editor.chain().focus().addRowAfter().run();
  }

  deleteRow(editor: Editor): void {
    editor.chain().focus().deleteRow().run();
  }

  deleteTable(editor: Editor): void {
    editor.chain().focus().deleteTable().run();
  }

  mergeCells(editor: Editor): void {
    editor.chain().focus().mergeCells().run();
  }

  splitCell(editor: Editor): void {
    editor.chain().focus().splitCell().run();
  }

  toggleHeaderColumn(editor: Editor): void {
    editor.chain().focus().toggleHeaderColumn().run();
  }

  toggleHeaderRow(editor: Editor): void {
    editor.chain().focus().toggleHeaderRow().run();
  }

  toggleHeaderCell(editor: Editor): void {
    editor.chain().focus().toggleHeaderCell().run();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // History Commands
  // ═══════════════════════════════════════════════════════════════════════════

  undo(editor: Editor): void {
    editor.chain().focus().undo().run();
  }

  redo(editor: Editor): void {
    editor.chain().focus().redo().run();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Editor Control Commands
  // ═══════════════════════════════════════════════════════════════════════════

  clearContent(editor: Editor): void {
    editor.chain().focus().setContent("", { emitUpdate: true }).run();
  }

  clearFormatting(editor: Editor): void {
    editor.chain().focus().clearNodes().unsetAllMarks().run();
  }

  setContent(editor: Editor, content: string, emitUpdate = true): void {
    editor.chain().focus().setContent(content, { emitUpdate }).run();
  }

  setEditable(editor: Editor, editable: boolean): void {
    editor.setEditable(editable);
  }

  focus(editor: Editor): void {
    editor.chain().focus().run();
  }

  blur(editor: Editor): void {
    editor.chain().blur().run();
  }
}

// =============================================================================
// Private helpers (module-level, not exported)
// =============================================================================

/**
 * Checks if a command name is valid.
 */
function isValidCommand(command: string): command is CheckableCommand {
  return VALID_COMMANDS.includes(command as CheckableCommand);
}

/**
 * Checks if indent is available by verifying the selection contains indentable nodes.
 */
function checkIndentAvailable(editor: Editor): boolean {
  const { state } = editor;
  const { selection } = state;
  const { $from } = selection;

  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth);
    const nodeTypeName = node.type.name;
    if (INDENTABLE_NODE_TYPES.includes(nodeTypeName as (typeof INDENTABLE_NODE_TYPES)[number])) {
      return true;
    }
  }

  const { from, to } = selection;
  let hasIndentableNode = false;

  state.doc.nodesBetween(from, to, (node) => {
    const nodeTypeName = node.type.name;
    if (INDENTABLE_NODE_TYPES.includes(nodeTypeName as (typeof INDENTABLE_NODE_TYPES)[number])) {
      hasIndentableNode = true;
    }
  });

  return hasIndentableNode;
}

/**
 * Checks if outdent is available by looking at node indentation.
 */
function checkOutdentAvailable(editor: Editor): boolean {
  const { state } = editor;
  const { selection } = state;
  const { $from } = selection;

  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth);
    const nodeTypeName = node.type.name;
    if (INDENTABLE_NODE_TYPES.includes(nodeTypeName as (typeof INDENTABLE_NODE_TYPES)[number])) {
      const indent = (node.attrs["indent"] as number) || 0;
      if (indent > 0) {
        return true;
      }
    }
  }

  const { from, to } = selection;
  let hasIndent = false;

  state.doc.nodesBetween(from, to, (node) => {
    const nodeTypeName = node.type.name;
    if (INDENTABLE_NODE_TYPES.includes(nodeTypeName as (typeof INDENTABLE_NODE_TYPES)[number])) {
      const indent = (node.attrs["indent"] as number) || 0;
      if (indent > 0) {
        hasIndent = true;
      }
    }
  });

  return hasIndent;
}

/**
 * Checks if a specific command can be executed.
 */
function checkCommand(editor: Editor, command: CheckableCommand): boolean {
  const chain = editor.can().chain().focus();

  switch (command) {
    case "toggleBold":
      return chain.toggleBold().run();
    case "toggleItalic":
      return chain.toggleItalic().run();
    case "toggleStrike":
      return chain.toggleStrike().run();
    case "toggleCode":
      return chain.toggleCode().run();
    case "toggleUnderline":
      return chain.toggleUnderline().run();
    case "toggleSuperscript":
      return chain.toggleSuperscript().run();
    case "toggleSubscript":
      return chain.toggleSubscript().run();
    case "setTextAlign":
      return chain.setTextAlign("left").run();
    case "indent":
      return checkIndentAvailable(editor);
    case "outdent":
      return checkOutdentAvailable(editor);
    case "toggleLink":
      return chain.toggleLink({ href: "" }).run();
    case "insertHorizontalRule":
      return chain.setHorizontalRule().run();
    case "undo":
      return chain.undo().run();
    case "redo":
      return chain.redo().run();
    case "insertTable":
      return chain.insertTable().run();
    case "addColumnBefore":
      return chain.addColumnBefore().run();
    case "addColumnAfter":
      return chain.addColumnAfter().run();
    case "deleteColumn":
      return chain.deleteColumn().run();
    case "addRowBefore":
      return chain.addRowBefore().run();
    case "addRowAfter":
      return chain.addRowAfter().run();
    case "deleteRow":
      return chain.deleteRow().run();
    case "deleteTable":
      return chain.deleteTable().run();
    case "mergeCells":
      return chain.mergeCells().run();
    case "splitCell":
      return chain.splitCell().run();
    case "toggleHeaderColumn":
      return chain.toggleHeaderColumn().run();
    case "toggleHeaderRow":
      return chain.toggleHeaderRow().run();
    case "toggleHeaderCell":
      return chain.toggleHeaderCell().run();
    default:
      return false;
  }
}

// =============================================================================
// Standalone functional API
// =============================================================================

/**
 * Checks if a mark or node is active at the current selection.
 * @param editor - The editor instance
 * @param name - Name of the mark or node
 * @param attributes - Optional attributes to match
 */
export function isActive(editor: Editor, name: string, attributes?: Record<string, unknown>): boolean {
  return editor.isActive(name, attributes);
}

/**
 * Checks if a command can be executed at the current selection.
 * @param editor - The editor instance
 * @param command - Command name to check
 */
export function canExecute(editor: Editor, command: string): boolean {
  if (!editor) return false;
  if (!isValidCommand(command)) return false;
  return checkCommand(editor, command as CheckableCommand);
}

/** Toggles bold formatting. */
export function toggleBold(editor: Editor): void {
  editor.chain().focus().toggleBold().run();
}

/** Toggles italic formatting. */
export function toggleItalic(editor: Editor): void {
  editor.chain().focus().toggleItalic().run();
}

/** Toggles underline formatting. */
export function toggleUnderline(editor: Editor): void {
  editor.chain().focus().toggleUnderline().run();
}

/** Toggles strikethrough formatting. */
export function toggleStrike(editor: Editor): void {
  editor.chain().focus().toggleStrike().run();
}

/** Toggles inline code formatting. */
export function toggleCode(editor: Editor): void {
  editor.chain().focus().toggleCode().run();
}

/** Toggles superscript formatting. */
export function toggleSuperscript(editor: Editor): void {
  editor.chain().focus().toggleSuperscript().run();
}

/** Toggles subscript formatting. */
export function toggleSubscript(editor: Editor): void {
  editor.chain().focus().toggleSubscript().run();
}

/** Toggles heading at the given level. */
export function toggleHeading(editor: Editor, level: HeadingLevel): void {
  editor.chain().focus().toggleHeading({ level }).run();
}

/** Toggles bullet list. */
export function toggleBulletList(editor: Editor): void {
  editor.chain().focus().toggleBulletList().run();
}

/** Toggles ordered list. */
export function toggleOrderedList(editor: Editor): void {
  editor.chain().focus().toggleOrderedList().run();
}

/** Toggles task list (interactive checkboxes). */
export function toggleTaskList(editor: Editor): void {
  editor.chain().focus().toggleTaskList().run();
}

/** Toggles blockquote. */
export function toggleBlockquote(editor: Editor): void {
  editor.chain().focus().toggleBlockquote().run();
}

/** Inserts a horizontal rule. */
export function insertHorizontalRule(editor: Editor): void {
  editor.chain().focus().setHorizontalRule().run();
}

/** Sets text alignment. */
export function setTextAlign(editor: Editor, alignment: TextAlignment): void {
  editor.chain().focus().setTextAlign(alignment).run();
}

/** Indents the current block. */
export function indent(editor: Editor): void {
  editor.chain().focus().indent().run();
}

/** Outdents the current block. */
export function outdent(editor: Editor): void {
  editor.chain().focus().outdent().run();
}

/** Sets text color. */
export function setTextColor(editor: Editor, color: string): void {
  editor.chain().focus().setColor(color).run();
}

/** Unsets text color. */
export function unsetTextColor(editor: Editor): void {
  editor.chain().focus().unsetColor().run();
}

/** Gets the current text color. */
export function getTextColor(editor: Editor): string | null {
  const attrs = editor.getAttributes("textStyle");
  return (attrs?.["color"] as string) || null;
}

/** Sets font family. */
export function setFontFamily(editor: Editor, fontFamily: string | null): void {
  if (fontFamily === null) {
    unsetFontFamily(editor);
  } else {
    editor.chain().focus().setFontFamily(fontFamily).run();
  }
}

/** Unsets font family. */
export function unsetFontFamily(editor: Editor): void {
  editor.chain().focus().unsetFontFamily().run();
}

/** Gets the current font family. */
export function getFontFamily(editor: Editor): string | null {
  const attrs = editor.getAttributes("textStyle");
  return (attrs?.["fontFamily"] as string) || null;
}

/** Sets font size. */
export function setFontSize(editor: Editor, size: string): void {
  editor.chain().focus().setMark("textStyle", { fontSize: size }).run();
}

/**
 * Toggles a link on the current selection.
 * @param editor - The editor instance.
 * @param url - The URL to link to. If omitted, the function is a no-op.
 */
export function toggleLink(editor: Editor, url?: string): void {
  if (!url) return;
  editor.chain().focus().toggleLink({ href: url }).run();
}

/** Inserts a table. */
export function insertTable(editor: Editor, rows: number = 3, cols: number = 3): void {
  editor.chain().focus().insertTable({ rows, cols }).run();
}

/** Adds a column before the current column. */
export function addColumnBefore(editor: Editor): void {
  editor.chain().focus().addColumnBefore().run();
}

/** Adds a column after the current column. */
export function addColumnAfter(editor: Editor): void {
  editor.chain().focus().addColumnAfter().run();
}

/** Deletes the current column. */
export function deleteColumn(editor: Editor): void {
  editor.chain().focus().deleteColumn().run();
}

/** Adds a row before the current row. */
export function addRowBefore(editor: Editor): void {
  editor.chain().focus().addRowBefore().run();
}

/** Adds a row after the current row. */
export function addRowAfter(editor: Editor): void {
  editor.chain().focus().addRowAfter().run();
}

/** Deletes the current row. */
export function deleteRow(editor: Editor): void {
  editor.chain().focus().deleteRow().run();
}

/** Deletes the table. */
export function deleteTable(editor: Editor): void {
  editor.chain().focus().deleteTable().run();
}

/** Merges selected cells. */
export function mergeCells(editor: Editor): void {
  editor.chain().focus().mergeCells().run();
}

/** Splits the current cell. */
export function splitCell(editor: Editor): void {
  editor.chain().focus().splitCell().run();
}

/** Toggles header column. */
export function toggleHeaderColumn(editor: Editor): void {
  editor.chain().focus().toggleHeaderColumn().run();
}

/** Toggles header row. */
export function toggleHeaderRow(editor: Editor): void {
  editor.chain().focus().toggleHeaderRow().run();
}

/** Toggles header cell. */
export function toggleHeaderCell(editor: Editor): void {
  editor.chain().focus().toggleHeaderCell().run();
}

/** Undoes the last action. */
export function undo(editor: Editor): void {
  editor.chain().focus().undo().run();
}

/** Redoes the last undone action. */
export function redo(editor: Editor): void {
  editor.chain().focus().redo().run();
}

/** Clears all editor content. */
export function clearContent(editor: Editor): void {
  editor.chain().focus().setContent("", { emitUpdate: true }).run();
}

/** Clears all formatting. */
export function clearFormatting(editor: Editor): void {
  editor.chain().focus().clearNodes().unsetAllMarks().run();
}

/** Sets editor content. */
export function setContent(editor: Editor, content: string, emitUpdate = true): void {
  editor.chain().focus().setContent(content, { emitUpdate }).run();
}

/** Sets the editor's editable state. */
export function setEditable(editor: Editor, editable: boolean): void {
  editor.setEditable(editable);
}

/** Focuses the editor. */
export function focusEditor(editor: Editor): void {
  editor.chain().focus().run();
}

/** Blurs the editor. */
export function blurEditor(editor: Editor): void {
  editor.chain().blur().run();
}

/**
 * Shared singleton instance of EditorCommands.
 * Use this instead of `new EditorCommands()` — the class is stateless,
 * so a single instance is sufficient for all consumers.
 */
export const editorCommands = new EditorCommands();
