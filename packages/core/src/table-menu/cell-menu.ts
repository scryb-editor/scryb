import { TableMap } from "@tiptap/pm/tables";
import type { Transaction } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/core";
import type { BlockMenuItem } from "../block-menu/types";
import type { TableLineRef } from "./selection";
import type { TableCellMenuLabels } from "./types";

export const TABLE_CELL_MENU_IDS = {
  row: "cell:row",
  column: "cell:column",
  table: "cell:table",
  toggleHeaderCell: "cell:toggleHeaderCell",
  split: "cell:split",
} as const;

/** The cell holding the caret, with the row and column the grips would address. */
export interface CaretTableCell {
  readonly tablePos: number;
  readonly cellPos: number;
  readonly row: TableLineRef;
  readonly column: TableLineRef;
}

/**
 * Resolves the table cell holding the caret.
 *
 * @param editor - The editor
 * @returns The cell, or null outside a table
 */
export function getCaretTableCell(editor: Editor): CaretTableCell | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const role = $from.node(depth).type.spec.tableRole;
    if (role !== "cell" && role !== "header_cell") continue;
    const tableDepth = depth - 2;
    if (tableDepth < 1 || $from.node(tableDepth).type.spec.tableRole !== "table") return null;
    const tablePos = $from.before(tableDepth);
    const cellPos = $from.before(depth);
    const rect = TableMap.get($from.node(tableDepth)).findCell(cellPos - tablePos - 1);
    return {
      tablePos,
      cellPos,
      row: { tablePos, orientation: "row", index: rect.top },
      column: { tablePos, orientation: "column", index: rect.left },
    };
  }
  return null;
}

/**
 * The menu Shift+F10 opens inside a table cell: a way into the row, column and
 * table menus the grips open (the grips are pointer-only), plus the cell
 * bubble's own actions, which act on the caret cell.
 *
 * @param editor - The editor, its caret in the cell
 * @param labels - Localized labels
 * @returns Menu items
 */
export function createTableCellMenuItems(editor: Editor, labels: TableCellMenuLabels): BlockMenuItem[] {
  const items: BlockMenuItem[] = [
    { id: "header:tableCell", label: labels.cell, header: true },
    { id: TABLE_CELL_MENU_IDS.row, label: labels.rowActions, icon: "border_top" },
    { id: TABLE_CELL_MENU_IDS.column, label: labels.columnActions, icon: "border_left" },
    { id: TABLE_CELL_MENU_IDS.table, label: labels.tableActions, icon: "table_chart" },
    { id: "separator:cell", label: "", separator: true },
    { id: TABLE_CELL_MENU_IDS.toggleHeaderCell, label: labels.toggleHeaderCell, icon: "crop_square" },
  ];
  if (editor.can().splitCell()) {
    items.push({ id: TABLE_CELL_MENU_IDS.split, label: labels.splitCell, icon: "split_scene" });
  }
  return items;
}

/**
 * Runs a cell entry. Row, column and table entries open another menu and are
 * the adapter's to handle.
 *
 * @param editor - The editor
 * @param itemId - The activated entry
 * @returns true when a command ran
 */
export function handleTableCellMenuAction(editor: Editor, itemId: string): boolean {
  if (!editor.isEditable) return false;
  if (itemId === TABLE_CELL_MENU_IDS.toggleHeaderCell) return editor.chain().focus().toggleHeaderCell().run();
  if (itemId === TABLE_CELL_MENU_IDS.split) return editor.chain().focus().splitCell().run();
  return false;
}

/**
 * Where a table is after `tr`, for a menu that addresses it by row and column
 * index. Null when the table is gone or gained or lost rows or columns: the
 * remembered indices would then act on different cells.
 *
 * @param tr - A document-changing transaction
 * @param tablePos - The table's position before `tr`
 * @returns The table's position after `tr`, or null
 */
export function mapTablePosThrough(tr: Transaction, tablePos: number): number | null {
  const result = tr.mapping.mapResult(tablePos, 1);
  if (result.deletedAfter) return null;
  const before = tr.before.nodeAt(tablePos);
  const after = tr.doc.nodeAt(result.pos);
  if (before?.type.spec.tableRole !== "table" || after?.type.spec.tableRole !== "table") return null;
  const shapeBefore = TableMap.get(before);
  const shapeAfter = TableMap.get(after);
  return shapeBefore.width === shapeAfter.width && shapeBefore.height === shapeAfter.height ? result.pos : null;
}
