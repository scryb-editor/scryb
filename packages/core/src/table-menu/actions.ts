import {
  TableMap,
  addColumn,
  addRow,
  moveTableColumn,
  moveTableRow,
  splitCellWithType,
  tableNodeTypes,
} from "@tiptap/pm/tables";
import type { GetCellTypeOptions, Rect } from "@tiptap/pm/tables";
import { isCellAlign, isCellVerticalAlign } from "@scryb-editor/extensions";
import type { CellAlign, CellVerticalAlign } from "@scryb-editor/extensions";
import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode, NodeType, Schema } from "@tiptap/pm/model";

import {
  BLOCK_MENU_ALIGN_IDS,
  BLOCK_MENU_COLOR_IDS,
  BLOCK_MENU_COLOR_VALUES,
  createAlignMenuItems,
  createColorMenuItems,
  normalizeColorValue,
} from "../block-menu/actions";
import type { BlockMenuItem } from "../block-menu/types";
import {
  collectCellPositions,
  collectCellPositionsIn,
  readSharedCellAttr,
  setCellAttrInScope,
  type TableCellScope,
} from "./cell-attrs";
import { createTableLineSelection, selectTableLine, type TableLineRef } from "./selection";
import type { TableLineOrientation } from "./geometry";
import type { TableLineMenuLabels } from "./types";

// =============================================================================
// Constants
// =============================================================================

/**
 * Identifiers for the row and column menu entries.
 *
 * One set for both orientations — the entries differ in wording and in which
 * command they reach, not in what they mean — so the handler routes on the id
 * and reads the orientation from the line it was given.
 */
export const TABLE_LINE_MENU_IDS = {
  toggleHeader: "line:toggleHeader",
  moveBackward: "line:moveBackward",
  moveForward: "line:moveForward",
  insertBefore: "line:insertBefore",
  insertAfter: "line:insertAfter",
  colors: "line:colors",
  alignment: "line:alignment",
  merge: "line:merge",
  split: "line:split",
  duplicate: "line:duplicate",
  delete: "line:delete",
} as const;

/** Icons per orientation, so the two menus read as the same menu turned sideways. */
const MOVE_ICONS = {
  row: { backward: "arrow_upward", forward: "arrow_downward" },
  column: { backward: "arrow_back", forward: "arrow_forward" },
} as const;

const INSERT_ICONS = {
  row: { before: "add_row_above", after: "add_row_below" },
  column: { before: "add_column_left", after: "add_column_right" },
} as const;

const HEADER_ICONS = { row: "border_top", column: "border_left" } as const;

// =============================================================================
// Menu builder
// =============================================================================

/**
 * Builds the menu a row or column grip opens.
 *
 * Mirrors the block menu's grammar: a title naming what is being acted on, the
 * structural entries, the two submenus, then the destructive pair last so the
 * delete is never under the pointer as the menu opens.
 *
 * Entries the line cannot perform are dropped rather than disabled, the same
 * rule the block menu follows. The header toggle is the notable one:
 * prosemirror-tables' toggleHeader always acts on the first row or column
 * whatever the selection, so offering it on the fourth row would silently
 * change the first.
 *
 * @param editor - The Tiptap editor instance
 * @param line - The row or column the grip sits against
 * @param labels - Localized label set for both orientations
 * @returns Menu items for that line, or an empty array when it does not resolve
 *
 * @example
 * ```typescript
 * const items = createTableLineMenuItems(editor, { tablePos, orientation: "row", index: 0 }, labels);
 * ```
 */
export function createTableLineMenuItems(
  editor: Editor,
  line: TableLineRef,
  labels: TableLineMenuLabels,
): BlockMenuItem[] {
  const size = getLineCount(editor, line);
  if (size === null) return [];

  const isRow = line.orientation === "row";
  const scope: TableCellScope = { kind: "line", ...line };
  const items: BlockMenuItem[] = [
    { id: "header:tableLine", label: isRow ? labels.row : labels.column, header: true },
  ];

  if (line.index === 0) {
    items.push({
      id: TABLE_LINE_MENU_IDS.toggleHeader,
      label: isRow ? labels.headerRow : labels.headerColumn,
      icon: HEADER_ICONS[line.orientation],
      isActive: isHeaderLine(editor, line),
    });
  }

  const moves: BlockMenuItem[] = [];
  if (line.index > 0) {
    moves.push({
      id: TABLE_LINE_MENU_IDS.moveBackward,
      label: isRow ? labels.moveRowUp : labels.moveColumnLeft,
      icon: MOVE_ICONS[line.orientation].backward,
    });
  }
  if (line.index < size - 1) {
    moves.push({
      id: TABLE_LINE_MENU_IDS.moveForward,
      label: isRow ? labels.moveRowDown : labels.moveColumnRight,
      icon: MOVE_ICONS[line.orientation].forward,
    });
  }
  if (moves.length > 0) {
    items.push({ id: "separator:move", label: "", separator: true }, ...moves);
  }

  items.push(
    { id: "separator:insert", label: "", separator: true },
    {
      id: TABLE_LINE_MENU_IDS.insertBefore,
      label: isRow ? labels.insertRowAbove : labels.insertColumnLeft,
      icon: INSERT_ICONS[line.orientation].before,
    },
    {
      id: TABLE_LINE_MENU_IDS.insertAfter,
      label: isRow ? labels.insertRowBelow : labels.insertColumnRight,
      icon: INSERT_ICONS[line.orientation].after,
    },
    { id: "separator:appearance", label: "", separator: true },
    {
      id: TABLE_LINE_MENU_IDS.colors,
      label: labels.colors,
      icon: "palette",
      submenuItems: createColorMenuItems(labels.colorNames, readLineColor(editor, scope)),
    },
    {
      id: TABLE_LINE_MENU_IDS.alignment,
      label: labels.alignment,
      icon: "format_align_center",
      submenuItems: createAlignMenuItems(
        labels,
        readCellAttr(editor, scope, "cellAlign", isCellAlign),
        readCellAttr(editor, scope, "cellVerticalAlign", isCellVerticalAlign),
      ),
    },
    { id: "separator:destructive", label: "", separator: true },
  );

  // The cell menu steps aside for a line a grip selected, since that gesture is
  // already being answered here — so without this entry a row picked up by its
  // grip could not be merged at all.
  if (getLineCellCount(editor, line) > 1) {
    items.push({
      id: TABLE_LINE_MENU_IDS.merge,
      label: labels.mergeCells,
      icon: "cell_merge",
    });
  }

  // The way back. A merge covering a whole line leaves a cell that reads as a
  // full line, which is the gesture this menu answers — so without this entry
  // the merge could not be undone from the grip that made it.
  if (findMergedCellPos(editor.state.doc, scope) !== null) {
    items.push({
      id: TABLE_LINE_MENU_IDS.split,
      label: labels.splitCell,
      icon: "split_scene",
    });
  }

  items.push({
    id: TABLE_LINE_MENU_IDS.duplicate,
    label: isRow ? labels.duplicateRow : labels.duplicateColumn,
    icon: "content_copy",
  });

  // The last row or column cannot be deleted: prosemirror-tables removes the
  // whole table instead, which is not what a menu titled "Row" should do.
  if (size > 1) {
    items.push({
      id: TABLE_LINE_MENU_IDS.delete,
      label: isRow ? labels.deleteRow : labels.deleteColumn,
      icon: "delete",
      danger: true,
    });
  }

  return items;
}

// =============================================================================
// Action handler
// =============================================================================

/**
 * Runs the entry a row or column menu reports, on the line it was opened for.
 *
 * The line is selected first, every time. The commands behind most of these
 * entries read the selection rather than taking coordinates, so selecting is
 * not a visual flourish — it is how the command learns which line to act on.
 *
 * @param editor - The Tiptap editor instance
 * @param itemId - Identifier of the activated menu item
 * @param line - The row or column the menu was opened for
 * @returns true when the action ran
 *
 * @example
 * ```typescript
 * handleTableLineMenuAction(editor, TABLE_LINE_MENU_IDS.insertAfter, line);
 * ```
 */
export function handleTableLineMenuAction(
  editor: Editor,
  itemId: string,
  line: TableLineRef,
): boolean {
  if (!editor) return false;
  // Every entry below writes to the document, and none of them arrives through
  // the DOM: ProseMirror's `editable: false` blocks typing and pasting, not a
  // programmatic dispatch. Without this a read-only editor — including one the
  // licence gate has frozen — could still be restructured from a grip menu.
  if (!editor.isEditable) return false;

  const scope: TableCellScope = { kind: "line", ...line };

  // Colour and alignment write attributes directly and must not disturb the
  // selection, which is what keeps the grip highlighted while its submenu is
  // open and the user tries a second swatch.
  const color = getColorFromId(itemId);
  if (color !== undefined) {
    return setCellAttrInScope(editor, scope, { cellBackground: color });
  }

  const align = getAlignFromId(itemId);
  if (align) return setCellAttrInScope(editor, scope, { cellAlign: align });

  const verticalAlign = getVerticalAlignFromId(itemId);
  if (verticalAlign) {
    return setCellAttrInScope(editor, scope, { cellVerticalAlign: verticalAlign });
  }

  if (itemId === TABLE_LINE_MENU_IDS.split) return splitTableLineCells(editor, scope);
  if (itemId === TABLE_LINE_MENU_IDS.duplicate) return duplicateTableLine(editor, line);
  if (itemId === TABLE_LINE_MENU_IDS.moveBackward) return moveTableLine(editor, line, -1);
  if (itemId === TABLE_LINE_MENU_IDS.moveForward) return moveTableLine(editor, line, 1);

  if (!selectTableLine(editor, line)) return false;
  const isRow = line.orientation === "row";
  const chain = editor.chain().focus();

  switch (itemId) {
    case TABLE_LINE_MENU_IDS.toggleHeader:
      return isRow ? chain.toggleHeaderRow().run() : chain.toggleHeaderColumn().run();
    case TABLE_LINE_MENU_IDS.insertBefore:
      return isRow ? chain.addRowBefore().run() : chain.addColumnBefore().run();
    case TABLE_LINE_MENU_IDS.insertAfter:
      return isRow ? chain.addRowAfter().run() : chain.addColumnAfter().run();
    case TABLE_LINE_MENU_IDS.merge:
      return chain.mergeCells().run();
    case TABLE_LINE_MENU_IDS.delete:
      return isRow ? chain.deleteRow().run() : chain.deleteColumn().run();
    default:
      return false;
  }
}

// =============================================================================
// Structural operations
// =============================================================================

/**
 * Moves a row or column one place along its axis.
 *
 * prosemirror-tables carries both moves already; they are reached directly
 * rather than through Tiptap, which does not expose them as commands.
 *
 * The line is selected in the same transaction that moves it. `pos` only tells
 * the command which table to work on — the range of rows or columns to lift
 * still comes from the transaction's own selection — so a move driven by a menu
 * rather than by the cursor has to put that selection there itself, and doing it
 * in the shared transaction keeps the pair to one undo step.
 */
function moveTableLine(editor: Editor, line: TableLineRef, delta: -1 | 1): boolean {
  const size = getLineCount(editor, line);
  if (size === null) return false;

  const target = line.index + delta;
  if (target < 0 || target >= size) return false;

  // A position inside the line's first cell, so the command resolves the table
  // from the line the menu points at rather than from wherever the cursor was.
  const anchor = getFirstCellPos(editor, line);
  if (anchor === null) return false;

  const command =
    line.orientation === "row"
      ? moveTableRow({ from: line.index, to: target, pos: anchor })
      : moveTableColumn({ from: line.index, to: target, pos: anchor });

  let moved = false;

  const ran = editor
    .chain()
    .focus()
    .command(({ tr }) => {
      const selection = createTableLineSelection(tr.doc, line);
      if (selection) tr.setSelection(selection);
      return selection !== null;
    })
    .command(({ state, dispatch }) => {
      moved = command(state, dispatch);
      return moved;
    })
    .run();

  return ran && moved;
}

/**
 * Splits every merged cell the line holds back into single cells.
 *
 * One pass per merged cell rather than one selection covering the line:
 * prosemirror-tables' splitCell refuses a selection wider than one cell, and
 * each split rewrites the table, so the next cell is looked up again from the
 * state the previous pass produced. The loop is bounded by the number of cells
 * the line held when it started, which is exact — every pass unmerges one of
 * them.
 *
 * A transaction each, and not by choice: splitCell places its closing selection
 * with `tr.mapping.map`, which maps from the transaction's start, so a second
 * split sharing the transaction maps its new positions back through the first
 * split's steps and resolves off the table. Each pass leaves a valid table, so an
 * interrupted run is short rather than broken — but a line holding three merged
 * cells may take three undos to put back.
 */
function splitTableLineCells(editor: Editor, scope: TableCellScope): boolean {
  let split = false;

  for (let remaining = collectCellPositions(editor, scope).length; remaining > 0; remaining--) {
    const pos = findMergedCellPos(editor.state.doc, scope);
    if (pos === null) break;
    if (!splitCellAt(editor, scope.tablePos, pos)) break;
    split = true;
  }

  return split;
}

/** Splits one merged cell, giving each new cell the type its place calls for. */
function splitCellAt(editor: Editor, tablePos: number, cellPos: number): boolean {
  const { doc, schema } = editor.state;
  const getCellType = createCellTypeResolver(doc, schema, tablePos, cellPos);
  if (!getCellType) return false;

  return editor
    .chain()
    .focus()
    .setCellSelection({ anchorCell: cellPos })
    .command(({ state, dispatch }) => splitCellWithType(getCellType)(state, dispatch))
    .run();
}

/**
 * Decides what each cell coming out of a split should be.
 *
 * Needed because prosemirror-tables' plain splitCell hands every new cell the
 * type of the one being split. Merging a column swallows the header cell at its
 * top and makes the whole merged cell a header, so splitting it again turned the
 * entire column into headers — the merge was reversible in shape but not in kind.
 *
 * The table itself is asked instead: a cell is a header where the table already
 * keeps headers — its first row, its first column, or both — read from the cells
 * the split does not touch. When the merged cell covers the whole of that first
 * row or column there are no untouched cells to read, and the merged cell's own
 * type answers instead, which is what preserves a header row merged end to end.
 */
function createCellTypeResolver(
  doc: ProseMirrorNode,
  schema: Schema,
  tablePos: number,
  cellPos: number,
): ((options: GetCellTypeOptions) => NodeType) | null {
  const table = doc.nodeAt(tablePos);
  if (table?.type.name !== "table") return null;

  const map = TableMap.get(table);
  const relative = cellPos - (tablePos + 1);
  const cell = table.nodeAt(relative);
  if (!cell) return null;

  const types = tableNodeTypes(schema);
  const rect = map.findCell(relative);
  const isHeader = cell.type === types.header_cell;

  const headerRow = isHeaderLineOutside(table, map, "row", rect, types.header_cell) ?? isHeader;
  const headerColumn =
    isHeaderLineOutside(table, map, "column", rect, types.header_cell) ?? isHeader;

  return ({ row, col }) =>
    (headerRow && row === 0) || (headerColumn && col === 0) ? types.header_cell : types.cell;
}

/**
 * Whether the table's first row or column is a header, judged only by the cells
 * lying outside the given rectangle.
 *
 * Returns null when the rectangle covers the whole line, since then there is
 * nothing left to judge by and the answer has to come from elsewhere.
 */
function isHeaderLineOutside(
  table: ProseMirrorNode,
  map: TableMap,
  orientation: TableLineOrientation,
  rect: Rect,
  headerType: NodeType,
): boolean | null {
  const isRow = orientation === "row";
  const across = isRow ? map.width : map.height;
  let examined = 0;

  for (let i = 0; i < across; i++) {
    const row = isRow ? 0 : i;
    const col = isRow ? i : 0;
    if (row >= rect.top && row < rect.bottom && col >= rect.left && col < rect.right) continue;

    const slot = map.map[row * map.width + col];
    if (slot === undefined) continue;

    examined++;
    if (table.nodeAt(slot)?.type !== headerType) return false;
  }

  return examined === 0 ? null : true;
}

/**
 * Inserts a copy of a row or column immediately after it.
 *
 * Built as one transaction that first adds an empty line through
 * prosemirror-tables' own addRow/addColumn — so merged cells and column widths
 * come out valid — and then fills it from the source. Copying the source row
 * node wholesale would be shorter and wrong: nothing repairs a table whose
 * rowspans no longer add up, because Tiptap installs no fixTables plugin.
 *
 * The new cells keep their own colspan and rowspan, since those describe the
 * shape addRow/addColumn just built, and take everything else from the source.
 */
function duplicateTableLine(editor: Editor, line: TableLineRef): boolean {
  const { state, view } = editor;
  const table = state.doc.nodeAt(line.tablePos);
  if (table?.type.name !== "table") return false;

  const map = TableMap.get(table);
  const isRow = line.orientation === "row";
  const limit = isRow ? map.height : map.width;
  if (line.index < 0 || line.index >= limit) return false;

  const tableStart = line.tablePos + 1;
  const across = isRow ? map.width : map.height;

  // Snapshot before the insert, which invalidates every position taken from map.
  const source: (ProseMirrorNode | null)[] = [];
  for (let i = 0; i < across; i++) {
    const slot = isRow ? map.map[line.index * map.width + i] : map.map[i * map.width + line.index];
    source.push(slot === undefined ? null : state.doc.nodeAt(tableStart + slot));
  }

  const rect = {
    map,
    tableStart,
    table,
    left: 0,
    top: 0,
    right: map.width,
    bottom: map.height,
  };
  const target = line.index + 1;
  const tr = isRow ? addRow(state.tr, rect, target) : addColumn(state.tr, rect, target);

  const grown = tr.doc.nodeAt(line.tablePos);
  if (!grown) return false;
  const grownMap = TableMap.get(grown);

  const writes: { pos: number; source: ProseMirrorNode }[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < across; i++) {
    const slot = isRow
      ? grownMap.map[target * grownMap.width + i]
      : grownMap.map[i * grownMap.width + target];
    const from = source[i];
    if (slot === undefined || seen.has(slot) || !from) continue;
    seen.add(slot);
    writes.push({ pos: tableStart + slot, source: from });
  }

  // Back to front: replacing a cell's content changes its size, which would
  // move every position after it.
  for (const write of writes.reverse()) {
    const cell = tr.doc.nodeAt(write.pos);
    if (!cell) continue;
    tr.replaceWith(write.pos + 1, write.pos + cell.nodeSize - 1, write.source.content);
    tr.setNodeMarkup(write.pos, undefined, {
      ...write.source.attrs,
      colspan: cell.attrs["colspan"],
      rowspan: cell.attrs["rowspan"],
      colwidth: cell.attrs["colwidth"],
    });
  }

  view.dispatch(tr);
  return true;
}

// =============================================================================
// Internals
// =============================================================================

function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Reads a cell attribute shared across the line, narrowed by a guard.
 *
 * Reports `"mixed"` rather than null when the line's cells disagree, so the
 * submenu built from it marks nothing at all — collapsing the two into one null
 * made a line of three left cells and one centred one report "Left".
 */
function readCellAttr<T>(
  editor: Editor,
  scope: TableCellScope,
  attrName: string,
  guard: (value: unknown) => value is T,
): T | "mixed" | null {
  const { value, mixed } = readSharedCellAttr(editor, scope, attrName);
  if (mixed) return "mixed";
  return guard(value) ? value : null;
}

/** The line's shared cell background, normalized, or `"mixed"` when they differ. */
function readLineColor(editor: Editor, scope: TableCellScope): string | "mixed" | null {
  const background = readCellAttr(editor, scope, "cellBackground", isString);
  return background === "mixed" ? "mixed" : normalizeColorValue(background);
}

/** How many rows or columns the line's table has along the line's own axis. */
function getLineCount(editor: Editor, line: TableLineRef): number | null {
  if (!editor) return null;

  const table = editor.state.doc.nodeAt(line.tablePos);
  if (table?.type.name !== "table") return null;

  const map = TableMap.get(table);
  const size = line.orientation === "row" ? map.height : map.width;
  return line.index >= 0 && line.index < size ? size : null;
}

/**
 * Position of the first cell in the scope that spans more than one slot.
 *
 * Reads a document rather than the editor, so a pass running inside a
 * transaction looks at the table the previous pass produced.
 *
 * Returns null when nothing is merged, which is also how the menu decides
 * whether to offer the split at all.
 */
function findMergedCellPos(doc: ProseMirrorNode, scope: TableCellScope): number | null {
  for (const pos of collectCellPositionsIn(doc, scope)) {
    const cell = doc.nodeAt(pos);
    if (!cell) continue;

    const colspan = cell.attrs["colspan"];
    const rowspan = cell.attrs["rowspan"];
    if (Number(colspan ?? 1) > 1 || Number(rowspan ?? 1) > 1) return pos;
  }

  return null;
}

/** How many distinct cells the line holds, counting a merged cell once. */
function getLineCellCount(editor: Editor, line: TableLineRef): number {
  return collectCellPositions(editor, { kind: "line", ...line }).length;
}

/** Document position of the first cell along the line. */
function getFirstCellPos(editor: Editor, line: TableLineRef): number | null {
  const table = editor.state.doc.nodeAt(line.tablePos);
  if (table?.type.name !== "table") return null;

  const map = TableMap.get(table);
  const slot =
    line.orientation === "row" ? map.map[line.index * map.width] : map.map[line.index];
  return slot === undefined ? null : line.tablePos + 1 + slot + 1;
}

/** Whether every cell of the line is a header cell. */
function isHeaderLine(editor: Editor, line: TableLineRef): boolean {
  const table = editor.state.doc.nodeAt(line.tablePos);
  if (table?.type.name !== "table") return false;

  const map = TableMap.get(table);
  const isRow = line.orientation === "row";
  const across = isRow ? map.width : map.height;
  const tableStart = line.tablePos + 1;

  for (let i = 0; i < across; i++) {
    const slot = isRow ? map.map[line.index * map.width + i] : map.map[i * map.width + line.index];
    if (slot === undefined) return false;
    if (editor.state.doc.nodeAt(tableStart + slot)?.type.name !== "tableHeader") return false;
  }

  return across > 0;
}

/**
 * Resolves a colour submenu id to the value it writes.
 *
 * Returns undefined — not null — for ids that are not colours, because null is
 * itself a colour here: the "Default" swatch clears the cell.
 */
function getColorFromId(itemId: string): string | null | undefined {
  if (!itemId.startsWith("color:")) return undefined;
  const value = BLOCK_MENU_COLOR_VALUES[itemId as keyof typeof BLOCK_MENU_COLOR_VALUES];
  return itemId === BLOCK_MENU_COLOR_IDS.default ? null : (value ?? undefined);
}

function getAlignFromId(itemId: string): CellAlign | null {
  switch (itemId) {
    case BLOCK_MENU_ALIGN_IDS.left:
      return "left";
    case BLOCK_MENU_ALIGN_IDS.center:
      return "center";
    case BLOCK_MENU_ALIGN_IDS.right:
      return "right";
    default:
      return null;
  }
}

function getVerticalAlignFromId(itemId: string): CellVerticalAlign | null {
  switch (itemId) {
    case BLOCK_MENU_ALIGN_IDS.top:
      return "top";
    case BLOCK_MENU_ALIGN_IDS.middle:
      return "middle";
    case BLOCK_MENU_ALIGN_IDS.bottom:
      return "bottom";
    default:
      return null;
  }
}
