import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import { buildBlockMenuLabels, buildTableCellMenuLabels, buildTableLineMenuLabels } from "../i18n/menu-labels";
import type { TiptapTranslations } from "../i18n/types";
import { createTableLineMenuItems, handleTableLineMenuAction } from "../table-menu/actions";
import {
  TABLE_CELL_MENU_IDS,
  createTableCellMenuItems,
  getCaretTableCell,
  handleTableCellMenuAction,
  mapTablePosThrough,
} from "../table-menu/cell-menu";
import type { CaretTableCell } from "../table-menu/cell-menu";
import type { TableLineRef } from "../table-menu/selection";
import { createBlockMenuItemsForBlock, handleBlockMenuAction } from "./actions";
import { canOpenBlockMenuAt, getBlockFromResolvedPos } from "./detection";
import type { BlockDetectionResult, BlockMenuItem } from "./types";

/**
 * The block the caret is in, resolved the way the side menu resolves the
 * block under the pointer, so keyboard and pointer target the same block.
 *
 * @param editor - The editor
 * @returns The caret block and its DOM element, or null
 */
export function getCaretBlock(editor: Editor): BlockDetectionResult | null {
  const { selection } = editor.state;
  // A selected top-level node (an image) has no ancestor block to resolve.
  if (selection instanceof NodeSelection && selection.$from.depth === 0) {
    const element = editor.view.nodeDOM(selection.from);
    return element instanceof HTMLElement ? { pos: selection.from, element } : null;
  }
  return getBlockFromResolvedPos(editor, selection.$from);
}

/**
 * The block the DOM caret is in. ProseMirror reads a caret move on the next
 * `selectionchange`, which can land after focus has already left the editor —
 * and ProseMirror ignores selection changes once unfocused — so as focus moves
 * out, the DOM caret is the truth and the editor state may be one move behind.
 *
 * @param editor - The editor
 * @returns The DOM caret's block, or null when the DOM caret is outside the
 *   editor, the selection is a selected node (no caret), or the caret sits in
 *   DOM the document does not describe (a widget decoration)
 */
export function getDomCaretBlock(editor: Editor): BlockDetectionResult | null {
  if (editor.state.selection instanceof NodeSelection) return null;
  const { view } = editor;
  const selection = view.dom.ownerDocument.getSelection();
  const caretNode = selection?.focusNode;
  if (!selection || !caretNode || !view.dom.contains(caretNode)) return null;
  let pos: number;
  try {
    pos = view.posAtDOM(caretNode, selection.focusOffset);
  } catch {
    return null;
  }
  return getBlockFromResolvedPos(editor, editor.state.doc.resolve(pos));
}

/**
 * What a keyboard-opened block menu (Shift+F10 / ContextMenu) acts on. Held as
 * positions, never DOM nodes, so a re-rendered block or cell cannot leave the
 * menu pointing at a detached element. Table targets remember the caret cell
 * to anchor to.
 */
export type CaretMenuTarget =
  | { readonly kind: "block"; readonly pos: number }
  | { readonly kind: "cell"; readonly cell: CaretTableCell }
  | { readonly kind: "line"; readonly line: TableLineRef; readonly cellPos: number }
  | { readonly kind: "table"; readonly pos: number; readonly cellPos: number };

/**
 * The menu Shift+F10 opens for the caret: the caret cell's inside a table, the
 * caret block's elsewhere.
 *
 * @param editor - The editor
 * @returns The target, or null when the caret has no block with a menu
 */
export function getCaretMenuTarget(editor: Editor): CaretMenuTarget | null {
  const cell = getCaretTableCell(editor);
  if (cell) return { kind: "cell", cell };
  const block = getCaretBlock(editor);
  if (!block || !canOpenBlockMenuAt(editor, block.pos)) return null;
  return { kind: "block", pos: block.pos };
}

/**
 * The position of the node the menu is anchored to: the block, or the caret
 * cell for every table target.
 *
 * @param target - The menu target
 * @returns A position whose `nodeDOM` is the anchor element
 */
export function getCaretMenuAnchorPos(target: CaretMenuTarget): number {
  switch (target.kind) {
    case "block":
      return target.pos;
    case "cell":
      return target.cell.cellPos;
    case "line":
    case "table":
      return target.cellPos;
  }
}

/**
 * The top-level block the menu acts on: the block itself, or the table for
 * every table target.
 *
 * @param target - The menu target
 * @returns The block's position
 */
export function getCaretMenuBlockPos(target: CaretMenuTarget): number {
  switch (target.kind) {
    case "block":
    case "table":
      return target.pos;
    case "cell":
      return target.cell.tablePos;
    case "line":
      return target.line.tablePos;
  }
}

/**
 * The same target after `tr`, or null when what it named is gone. Table
 * targets also drop when the table gains or loses rows or columns: a row or
 * column index would then act on a different line.
 *
 * @param target - The target before `tr`
 * @param tr - A document-changing transaction
 * @returns The target after `tr`, or null
 */
export function remapCaretMenuTarget(target: CaretMenuTarget, tr: Transaction): CaretMenuTarget | null {
  const map = (pos: number): number | null => {
    const result = tr.mapping.mapResult(pos, 1);
    return result.deletedAfter ? null : result.pos;
  };
  if (target.kind === "block") {
    const pos = map(target.pos);
    return pos === null ? null : { kind: "block", pos };
  }
  const tablePos = mapTablePosThrough(tr, getCaretMenuBlockPos(target));
  const cellPos = map(getCaretMenuAnchorPos(target));
  if (tablePos === null || cellPos === null) return null;
  switch (target.kind) {
    case "cell":
      return {
        kind: "cell",
        cell: {
          tablePos,
          cellPos,
          row: { ...target.cell.row, tablePos },
          column: { ...target.cell.column, tablePos },
        },
      };
    case "line":
      return { kind: "line", line: { ...target.line, tablePos }, cellPos };
    case "table":
      return { kind: "table", pos: tablePos, cellPos };
  }
}

/**
 * The menu an entry of the cell menu leads to: the caret row's, column's or
 * the table's. These are the menus the grips open, which the keyboard cannot
 * reach otherwise.
 *
 * @param target - The open menu's target
 * @param itemId - The activated entry
 * @returns The next menu's target, or null when the entry is an action
 */
export function getCaretMenuStep(target: CaretMenuTarget, itemId: string): CaretMenuTarget | null {
  if (target.kind !== "cell") return null;
  const { cell } = target;
  switch (itemId) {
    case TABLE_CELL_MENU_IDS.row:
      return { kind: "line", line: cell.row, cellPos: cell.cellPos };
    case TABLE_CELL_MENU_IDS.column:
      return { kind: "line", line: cell.column, cellPos: cell.cellPos };
    case TABLE_CELL_MENU_IDS.table:
      return { kind: "table", pos: cell.tablePos, cellPos: cell.cellPos };
    default:
      return null;
  }
}

/**
 * The entries of the menu for `target`.
 *
 * @param editor - The editor
 * @param target - The menu target
 * @param translations - The active translation catalog
 * @returns Menu items; empty when the target no longer resolves
 */
export function createCaretMenuItems(
  editor: Editor,
  target: CaretMenuTarget,
  translations: TiptapTranslations,
): BlockMenuItem[] {
  switch (target.kind) {
    case "block":
    case "table":
      return createBlockMenuItemsForBlock(editor, target.pos, buildBlockMenuLabels(translations));
    case "line":
      return createTableLineMenuItems(editor, target.line, buildTableLineMenuLabels(translations));
    case "cell":
      return createTableCellMenuItems(editor, buildTableCellMenuLabels(translations));
  }
}

/**
 * Runs an entry of the menu for `target`. Entries that lead to another menu
 * (see getCaretMenuStep) are not actions and return false.
 *
 * @param editor - The editor
 * @param target - The menu target
 * @param itemId - The activated entry
 * @returns true when the action ran
 */
export function runCaretMenuAction(editor: Editor, target: CaretMenuTarget, itemId: string): boolean {
  switch (target.kind) {
    case "block":
    case "table":
      return handleBlockMenuAction(editor, target.pos, itemId);
    case "line":
      return handleTableLineMenuAction(editor, itemId, target.line);
    case "cell":
      return handleTableCellMenuAction(editor, itemId);
  }
}
