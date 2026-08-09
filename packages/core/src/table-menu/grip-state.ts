import type { Editor } from "@tiptap/core";

// =============================================================================
// Grip menu state
// =============================================================================

/**
 * Editors whose row, column or corner grip currently has a menu open.
 *
 * A whole row or column can be selected two ways — by clicking its grip, or by
 * dragging the mouse across it — and the two want different menus. The selection
 * is identical either way, so it cannot tell them apart; the grips say which it
 * was by marking the editor before they select. The cell bubble menu then steps
 * aside only for a selection a grip made, instead of for every selection that
 * happens to cover a line, which left a dragged-out row with no menu at all.
 *
 * A WeakSet rather than a field on the editor: it holds no reference of its own,
 * so an editor destroyed with its menu open is still collectable.
 */
const EDITORS_WITH_OPEN_GRIP_MENU = new WeakSet<Editor>();

/**
 * Records whether a grip menu is open for this editor.
 *
 * Must be set before the grip selects its line — the bubble menus decide during
 * the selection's own transaction, and a mark applied afterwards arrives too
 * late to be read.
 *
 * @param editor - The Tiptap editor instance
 * @param open - Whether a grip menu is now open
 *
 * @example
 * ```typescript
 * setTableGripMenuOpen(editor, true);
 * selectTableLine(editor, line);
 * ```
 */
export function setTableGripMenuOpen(editor: Editor, open: boolean): void {
  if (!editor) return;

  if (open) EDITORS_WITH_OPEN_GRIP_MENU.add(editor);
  else EDITORS_WITH_OPEN_GRIP_MENU.delete(editor);
}

/**
 * Whether a grip menu is open for this editor.
 *
 * @param editor - The Tiptap editor instance
 * @returns True while a row, column or corner grip has its menu open
 */
export function isTableGripMenuOpen(editor: Editor): boolean {
  return Boolean(editor) && EDITORS_WITH_OPEN_GRIP_MENU.has(editor);
}
