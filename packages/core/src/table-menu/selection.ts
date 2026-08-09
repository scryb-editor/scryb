import { CellSelection, TableMap } from "@tiptap/pm/tables";
import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model";

import type { TableLineOrientation } from "./geometry";

// =============================================================================
// Types
// =============================================================================

/** A whole row or column of one table, as a grip menu addresses it. */
export interface TableLineRef {
  /** ProseMirror position of the table node */
  readonly tablePos: number;
  /** Which axis the line runs along */
  readonly orientation: TableLineOrientation;
  /** Zero-based index of the line within that axis */
  readonly index: number;
}

// =============================================================================
// Selection
// =============================================================================

/**
 * Resolves the two cells at the ends of a row or column.
 *
 * Returns null when the index falls outside the table, which happens routinely:
 * a grip menu stays open across the transaction that deletes the line it
 * points at.
 */
function resolveLineEnds(
  doc: ProseMirrorNode,
  line: TableLineRef,
): { $anchor: ResolvedPos; $head: ResolvedPos } | null {
  const tableNode = doc.nodeAt(line.tablePos);
  if (tableNode?.type.name !== "table") return null;

  const map = TableMap.get(tableNode);
  const limit = line.orientation === "row" ? map.height : map.width;
  if (line.index < 0 || line.index >= limit) return null;

  const anchorIndex =
    line.orientation === "row" ? line.index * map.width : line.index;
  const headIndex =
    line.orientation === "row"
      ? line.index * map.width + (map.width - 1)
      : (map.height - 1) * map.width + line.index;

  const anchorRel = map.map[anchorIndex];
  const headRel = map.map[headIndex];
  if (anchorRel === undefined || headRel === undefined) return null;

  const tableStart = line.tablePos + 1;
  return {
    $anchor: doc.resolve(tableStart + anchorRel),
    $head: doc.resolve(tableStart + headRel),
  };
}

/**
 * Builds the selection covering an entire row or column, without dispatching.
 *
 * Split out from {@link selectTableLine} so a command running inside a
 * transaction can set the same selection on that transaction rather than in one
 * of its own — which is what keeps a menu action that needs the line selected to
 * a single undo step.
 *
 * @param doc - The document to resolve the line against
 * @param line - The row or column to cover
 * @returns The cell selection, or null when the line does not resolve
 *
 * @example
 * ```typescript
 * const selection = createTableLineSelection(tr.doc, line);
 * if (selection) tr.setSelection(selection);
 * ```
 */
export function createTableLineSelection(
  doc: ProseMirrorNode,
  line: TableLineRef,
): CellSelection | null {
  const ends = resolveLineEnds(doc, line);
  if (!ends) return null;

  return line.orientation === "row"
    ? CellSelection.rowSelection(ends.$anchor, ends.$head)
    : CellSelection.colSelection(ends.$anchor, ends.$head);
}

/**
 * Selects an entire row or column.
 *
 * The selection is what makes the grip honest: every command the menu then
 * offers reads the selection, so what the user sees highlighted is exactly what
 * the next click acts on.
 *
 * @param editor - The Tiptap editor instance
 * @param line - The row or column to select
 * @returns true when the selection was placed
 *
 * @example
 * ```typescript
 * selectTableLine(editor, { tablePos, orientation: "column", index: 2 });
 * ```
 */
export function selectTableLine(editor: Editor, line: TableLineRef): boolean {
  if (!editor) return false;

  const selection = createTableLineSelection(editor.state.doc, line);
  if (!selection) return false;

  editor.view.dispatch(editor.state.tr.setSelection(selection));
  return true;
}

/**
 * Selects every cell of a table.
 *
 * A cell selection rather than a node selection on the table, so the cell-level
 * commands behind the menu — background, alignment, merge — apply to the whole
 * table without a second code path.
 *
 * @param editor - The Tiptap editor instance
 * @param tablePos - ProseMirror position of the table node
 * @returns true when the selection was placed
 */
export function selectWholeTable(editor: Editor, tablePos: number | null): boolean {
  if (!editor || tablePos === null) return false;

  const tableNode = editor.state.doc.nodeAt(tablePos);
  if (tableNode?.type.name !== "table") return false;

  const map = TableMap.get(tableNode);
  if (map.width === 0 || map.height === 0) return false;

  const first = map.map[0];
  const last = map.map[map.height * map.width - 1];
  if (first === undefined || last === undefined) return false;

  const tableStart = tablePos + 1;
  const { doc } = editor.state;
  const selection = new CellSelection(
    doc.resolve(tableStart + first),
    doc.resolve(tableStart + last),
  );

  editor.view.dispatch(editor.state.tr.setSelection(selection));
  return true;
}

/**
 * Whether the selection is a table cell selection.
 *
 * Asked directly of the selection rather than inferred from `from !== to` and a
 * size threshold. The arithmetic guess is what let a plain cursor in a cell read
 * as a table gesture, which is why the table toolbar used to appear the moment
 * someone clicked into a cell to type.
 *
 * @param editor - The Tiptap editor instance
 * @returns True when one or more whole cells are selected
 */
export function isCellSelectionActive(editor: Editor): boolean {
  return Boolean(editor) && editor.state.selection instanceof CellSelection;
}

/**
 * Reports which whole line, if any, the current selection covers.
 *
 * Used to mark a grip as active. A cell selection that covers a full column is
 * reported as a column even when the table is one row tall and it covers a full
 * row too — the ambiguity is real, and preferring the column keeps the answer
 * stable as rows are added.
 *
 * @param editor - The Tiptap editor instance
 * @returns The selected line, or null when the selection is not one
 */
export function getSelectedTableLine(editor: Editor): TableLineRef | null {
  if (!editor) return null;

  const { selection, doc } = editor.state;
  if (!(selection instanceof CellSelection)) return null;

  const $anchor = selection.$anchorCell;
  const tableDepth = $anchor.depth - 1;
  if (tableDepth < 0) return null;

  const tableNode: ProseMirrorNode = $anchor.node(tableDepth);
  if (tableNode.type.name !== "table") return null;

  const tablePos = $anchor.before(tableDepth);
  const tableStart = tablePos + 1;
  const map = TableMap.get(tableNode);

  const anchor = map.findCell($anchor.pos - tableStart);
  const head = map.findCell(selection.$headCell.pos - tableStart);

  const top = Math.min(anchor.top, head.top);
  const bottom = Math.max(anchor.bottom, head.bottom);
  const left = Math.min(anchor.left, head.left);
  const right = Math.max(anchor.right, head.right);

  if (right - left === 1 && top === 0 && bottom === map.height) {
    return { tablePos, orientation: "column", index: left };
  }
  if (bottom - top === 1 && left === 0 && right === map.width) {
    return { tablePos, orientation: "row", index: top };
  }

  return null;
}

/**
 * Counts the rows and columns of a table.
 *
 * @param editor - The Tiptap editor instance
 * @param tablePos - ProseMirror position of the table node
 * @returns The table's dimensions, or null when the position is not a table
 */
export function getTableSize(
  editor: Editor,
  tablePos: number | null,
): { rows: number; columns: number } | null {
  if (!editor || tablePos === null) return null;

  const tableNode = editor.state.doc.nodeAt(tablePos);
  if (tableNode?.type.name !== "table") return null;

  const map = TableMap.get(tableNode);
  return { rows: map.height, columns: map.width };
}
