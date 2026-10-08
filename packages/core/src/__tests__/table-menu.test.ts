import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { CellSelection } from "@tiptap/pm/tables";
import { TableBundle } from "@scryb-editor/extensions";

import {
  collectCellPositions,
  getSharedCellAttr,
  readSharedCellAttr,
  setCellAttrInScope,
} from "../table-menu/cell-attrs";
import { isTableGripMenuOpen, setTableGripMenuOpen } from "../table-menu/grip-state";
import {
  clampLineRectToViewport,
  findTablePosAtDocPos,
  hasLaneForRowGrips,
  isGripAnchorVisible,
  TABLE_GRIP_ANCHOR_OFFSET_PX,
  TABLE_ROW_GRIP_LANE_PX,
} from "../table-menu/geometry";
import { getSideMenuGutterGap, getSideMenuLeftOffset } from "../side-menu/constants";
import {
  getSelectedTableLine,
  getTableSize,
  isCellSelectionActive,
  selectTableLine,
  selectWholeTable,
} from "../table-menu/selection";
import {
  TABLE_LINE_MENU_IDS,
  createTableLineMenuItems,
  handleTableLineMenuAction,
} from "../table-menu/actions";
import { normalizeColorValue } from "../block-menu/actions";
import type { BlockMenuItem } from "../block-menu/types";
import type { TableLineMenuLabels } from "../table-menu/types";
import { tableGripLabel } from "../table-menu/grip-label";
import { en } from "../i18n/locales/en";

// =============================================================================
// Row and column menus
// =============================================================================
//
// Run against a real editor rather than a mocked document: every claim here is
// about whether a command would actually change the table, and a mock that
// answers whatever the test expects proves nothing about that.
// =============================================================================

const LABELS: TableLineMenuLabels = {
  row: "Row",
  column: "Column",
  headerRow: "Header row",
  headerColumn: "Header column",
  moveRowUp: "Move row up",
  moveRowDown: "Move row down",
  moveColumnLeft: "Move column left",
  moveColumnRight: "Move column right",
  insertRowAbove: "Insert row above",
  insertRowBelow: "Insert row below",
  insertColumnLeft: "Insert column left",
  insertColumnRight: "Insert column right",
  duplicateRow: "Duplicate row",
  duplicateColumn: "Duplicate column",
  deleteRow: "Delete row",
  deleteColumn: "Delete column",
  mergeCells: "Merge cells",
  splitCell: "Split cell",
  colors: "Colors",
  alignment: "Alignment",
  alignLeft: "Left",
  alignCenter: "Center",
  alignRight: "Right",
  alignTop: "Top",
  alignMiddle: "Middle",
  alignBottom: "Bottom",
  colorNames: {
    default: "Default",
    yellow: "Yellow",
    orange: "Orange",
    red: "Red",
    pink: "Pink",
    purple: "Purple",
    blue: "Blue",
    green: "Green",
    gray: "Gray",
  },
};

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

/** Builds an editor holding one table of the given shape, and returns its position. */
function createTableEditor(rows: number, cols: number): { editor: Editor; tablePos: number } {
  const instance = new Editor({
    extensions: [StarterKit, TableBundle],
    content: "<p>before</p>",
  });
  editor = instance;

  instance.commands.focus("end");
  instance.commands.insertTable({ rows, cols, withHeaderRow: true });

  let tablePos = -1;
  instance.state.doc.descendants((node, pos) => {
    if (node.type.name === "table" && tablePos === -1) tablePos = pos;
    return tablePos === -1;
  });

  return { editor: instance, tablePos };
}

/** Reads a cell's text, addressed by row and column. */
function cellText(instance: Editor, tablePos: number, row: number, col: number): string {
  const table = instance.state.doc.nodeAt(tablePos);
  return table?.child(row).child(col).textContent ?? "";
}

/** Node type names of a line's cells, in order. */
function cellTypes(
  instance: Editor,
  tablePos: number,
  line: { orientation: "row" | "column"; index: number },
): string[] {
  return collectCellPositions(instance, { kind: "line", tablePos, ...line }).map(
    (pos) => instance.state.doc.nodeAt(pos)?.type.name ?? "",
  );
}

function labelsOf(items: { label: string; separator?: boolean; header?: boolean }[]): string[] {
  return items.filter((item) => !item.separator && !item.header).map((item) => item.label);
}

/** The entries of a named submenu, or an empty list when the menu has none. */
function submenuOf(items: BlockMenuItem[], id: string): BlockMenuItem[] {
  return items.find((item) => item.id === id)?.submenuItems ?? [];
}

const alignmentSubmenu = (items: BlockMenuItem[]): BlockMenuItem[] =>
  submenuOf(items, TABLE_LINE_MENU_IDS.alignment);

const colorSubmenu = (items: BlockMenuItem[]): BlockMenuItem[] =>
  submenuOf(items, TABLE_LINE_MENU_IDS.colors);

/** Labels of the submenu entries currently marked active. */
function activeLabels(items: BlockMenuItem[]): string[] {
  return items.filter((item) => item.isActive).map((item) => item.label);
}

describe("table geometry lookup", () => {
  it("finds the table from a position inside one of its cells", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);
    const cellPos = collectCellPositions(instance, { kind: "table", tablePos })[0]!;

    expect(findTablePosAtDocPos(instance, cellPos + 2)).toBe(tablePos);
  });

  it("finds nothing from a position outside every table", () => {
    const { editor: instance } = createTableEditor(3, 3);

    expect(findTablePosAtDocPos(instance, 1)).toBeNull();
  });

  it("reports the table's dimensions", () => {
    const { editor: instance, tablePos } = createTableEditor(4, 2);

    expect(getTableSize(instance, tablePos)).toEqual({ rows: 4, columns: 2 });
  });
});

describe("selecting a whole line", () => {
  it("a row selection covers that row and nothing else", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 4);

    expect(selectTableLine(instance, { tablePos, orientation: "row", index: 1 })).toBe(true);
    expect(isCellSelectionActive(instance)).toBe(true);

    const selection = instance.state.selection as CellSelection;
    let count = 0;
    selection.forEachCell(() => count++);
    expect(count).toBe(4);
  });

  it("a column selection covers that column and nothing else", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 4);

    selectTableLine(instance, { tablePos, orientation: "column", index: 2 });

    const selection = instance.state.selection as CellSelection;
    let count = 0;
    selection.forEachCell(() => count++);
    expect(count).toBe(3);
  });

  it("reports back which line the selection covers", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 4);

    selectTableLine(instance, { tablePos, orientation: "column", index: 2 });
    expect(getSelectedTableLine(instance)).toEqual({ tablePos, orientation: "column", index: 2 });

    selectTableLine(instance, { tablePos, orientation: "row", index: 0 });
    expect(getSelectedTableLine(instance)).toEqual({ tablePos, orientation: "row", index: 0 });
  });

  it("reports nothing for a selection that is not a whole line", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 4);
    const cells = collectCellPositions(instance, { kind: "table", tablePos });

    instance.commands.setCellSelection({ anchorCell: cells[0]!, headCell: cells[1]! });
    expect(isCellSelectionActive(instance)).toBe(true);
    expect(getSelectedTableLine(instance)).toBeNull();
  });

  it("reports nothing for a plain cursor in a cell", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 4);
    const cellPos = collectCellPositions(instance, { kind: "table", tablePos })[0]!;

    instance.commands.setTextSelection(cellPos + 2);
    expect(isCellSelectionActive(instance)).toBe(false);
    expect(getSelectedTableLine(instance)).toBeNull();
  });

  it("selects every cell of the table", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 4);

    expect(selectWholeTable(instance, tablePos)).toBe(true);

    let count = 0;
    (instance.state.selection as CellSelection).forEachCell(() => count++);
    expect(count).toBe(12);
  });

  it("refuses a line index the table does not have", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 4);

    expect(selectTableLine(instance, { tablePos, orientation: "row", index: 9 })).toBe(false);
  });
});

describe("scoped cell attributes", () => {
  it("a row write reaches that row and no other", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);

    setCellAttrInScope(
      instance,
      { kind: "line", tablePos, orientation: "row", index: 1 },
      { cellAlign: "center" },
    );

    expect(
      getSharedCellAttr(instance, { kind: "line", tablePos, orientation: "row", index: 1 }, "cellAlign"),
    ).toBe("center");
    expect(
      getSharedCellAttr(instance, { kind: "line", tablePos, orientation: "row", index: 0 }, "cellAlign"),
    ).toBeNull();
  });

  it("a column write reaches that column and no other", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);

    setCellAttrInScope(
      instance,
      { kind: "line", tablePos, orientation: "column", index: 2 },
      { cellBackground: "#FEF08A" },
    );

    expect(
      getSharedCellAttr(
        instance,
        { kind: "line", tablePos, orientation: "column", index: 2 },
        "cellBackground",
      ),
    ).toBe("#FEF08A");
    expect(
      getSharedCellAttr(
        instance,
        { kind: "line", tablePos, orientation: "column", index: 1 },
        "cellBackground",
      ),
    ).toBeNull();
  });

  it("reads null when the cells disagree", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);

    setCellAttrInScope(
      instance,
      { kind: "line", tablePos, orientation: "row", index: 0 },
      { cellAlign: "right" },
    );

    expect(getSharedCellAttr(instance, { kind: "table", tablePos }, "cellAlign")).toBeNull();
  });

  it("lists each merged cell once", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);

    selectTableLine(instance, { tablePos, orientation: "row", index: 1 });
    instance.commands.mergeCells();

    expect(collectCellPositions(instance, { kind: "line", tablePos, orientation: "row", index: 1 })).toHaveLength(1);
  });
});

describe("where the row grips go", () => {
  it("keeps the handles put and buys the lane out of the extra padding", () => {
    // The whole point of the two numbers: a consumer who reserves the lane sees
    // the menu land in exactly the same place it did before, with the text
    // moved right instead.
    expect(getSideMenuGutterGap(64)).toBe(4);
    expect(getSideMenuLeftOffset(64)).toBe(58);
    expect(64 - getSideMenuLeftOffset(64)).toBe(6);

    expect(getSideMenuGutterGap(80)).toBe(20);
    expect(getSideMenuLeftOffset(80)).toBe(74);
    expect(80 - getSideMenuLeftOffset(80)).toBe(6);
  });

  it("puts the grips outside once the gutter has a lane for them", () => {
    expect(hasLaneForRowGrips(64, true)).toBe(false);
    expect(hasLaneForRowGrips(80, true)).toBe(true);
  });

  it("gives them the whole gutter when no side menu claims it", () => {
    expect(hasLaneForRowGrips(64, false)).toBe(true);

    // Nothing to hang them on: no gutter, no side menu.
    expect(hasLaneForRowGrips(0, false)).toBe(false);
  });

  it("asks for a lane as wide as the part of the 24px target outside the table", () => {
    // The target reaches 4px into the table's border and padding; the other
    // 20px need a gutter, or the target would sit under whatever is beside it.
    expect(TABLE_ROW_GRIP_LANE_PX).toBe(20);
    expect(hasLaneForRowGrips(TABLE_ROW_GRIP_LANE_PX, false)).toBe(true);
    expect(hasLaneForRowGrips(TABLE_ROW_GRIP_LANE_PX - 1, false)).toBe(false);
  });

  it("counts the indentation of a nested table as room beside it", () => {
    // A table inside a list with no gutter reserved: the list's indent is empty
    // ground beside the rows, and the side menu parks at the content edge, not
    // in it.
    expect(hasLaneForRowGrips(0, false, 40)).toBe(true);
    expect(hasLaneForRowGrips(0, false, TABLE_ROW_GRIP_LANE_PX - 1)).toBe(false);
    expect(hasLaneForRowGrips(64, true, 16)).toBe(true);
    expect(hasLaneForRowGrips(64, true, 15)).toBe(false);
  });
});

describe("grips anchored to the table's top edge", () => {
  // `geometry.scrollClip`, the editor's own scroll container, and deliberately
  // not `geometry.viewport`. That one is this box intersected with the table's
  // wrapper, and the wrapper hugs the table, so its top equals the table's top:
  // asking "has the edge cleared the box" against it compares a number with
  // itself and the check never fires. Passing the wrong box here disabled the
  // column grip entirely and was caught in a browser, not by a test.
  const viewport = { index: 0, top: 0, left: 100, width: 400, height: 300 };

  it("allows the grip once the edge clears the top by the grip's own reach", () => {
    expect(isGripAnchorVisible(TABLE_GRIP_ANCHOR_OFFSET_PX, viewport)).toBe(true);
    expect(isGripAnchorVisible(120, viewport)).toBe(true);
    expect(isGripAnchorVisible(300, viewport)).toBe(true);
  });

  it("refuses it in the band where the edge fits but the target does not", () => {
    // The column and corner grips' targets reach 24px above their anchor.
    // An edge sitting flush with the top of the content box is inside the box;
    // the target drawn from it is over the toolbar, which is the symptom this
    // whole check exists to remove. Scrolling a table until its first row meets
    // the top edge is where a reader naturally lands.
    expect(isGripAnchorVisible(0, viewport)).toBe(false);
    expect(isGripAnchorVisible(TABLE_GRIP_ANCHOR_OFFSET_PX - 1, viewport)).toBe(false);
  });

  it("refuses it when nothing is visible at all", () => {
    // A table scrolled clear of the box intersects it to zero height at the far
    // edge, and a plain range check reads `top >= top && top <= top + 0` as
    // true. The corner grip is the one control with no rect to clamp, so it was
    // painted below the editor's own border and stayed clickable.
    const collapsed = { index: 0, top: 500, left: 100, width: 400, height: 0 };

    expect(isGripAnchorVisible(500, collapsed)).toBe(false);
    expect(isGripAnchorVisible(512, collapsed)).toBe(false);
  });

  it("refuses it once the edge has scrolled above the container", () => {
    // The bug this exists for: a table scrolled up inside the editor kept its
    // column grips, which were then drawn at a negative offset — over the
    // toolbar and outside the editor's border.
    expect(isGripAnchorVisible(-1, viewport)).toBe(false);
    expect(isGripAnchorVisible(-240, viewport)).toBe(false);
  });

  it("refuses it once the edge is below the container", () => {
    expect(isGripAnchorVisible(301, viewport)).toBe(false);
  });

  it("is not answered by clipping the line's own rect", () => {
    // Why this helper has to exist. The column's rect still overlaps the
    // viewport, so the clip says "visible" and hands back a usable box, while
    // the edge the grip is actually positioned at is off screen. Trusting the
    // clip alone is exactly what shipped.
    const column = { index: 0, top: -200, left: 150, width: 120, height: 400 };

    expect(clampLineRectToViewport(column, viewport)).not.toBeNull();
    expect(isGripAnchorVisible(column.top, viewport)).toBe(false);
  });
});

describe("clipping a grip to the scroll container", () => {
  const viewport = { index: 0, top: 0, left: 100, width: 400, height: 300 };

  it("leaves a line already inside it alone", () => {
    const rect = { index: 1, top: 10, left: 150, width: 120, height: 40 };

    expect(clampLineRectToViewport(rect, viewport)).toEqual(rect);
  });

  it("trims a column wider than the container to what shows", () => {
    // The case that ran a grip out past the editor: one column wider than the
    // container it scrolls in.
    const rect = { index: 0, top: 0, left: 50, width: 900, height: 300 };

    expect(clampLineRectToViewport(rect, viewport)).toEqual({
      index: 0,
      top: 0,
      left: 100,
      width: 400,
      height: 300,
    });
  });

  it("trims a column scrolled half out of view", () => {
    const rect = { index: 3, top: 0, left: 400, width: 200, height: 300 };

    expect(clampLineRectToViewport(rect, viewport)).toEqual({
      index: 3,
      top: 0,
      left: 400,
      width: 100,
      height: 300,
    });
  });

  it("drops a line with almost nothing left to show", () => {
    const rect = { index: 4, top: 0, left: 496, width: 200, height: 300 };

    expect(clampLineRectToViewport(rect, viewport)).toBeNull();
  });

  it("drops a line scrolled out entirely", () => {
    const rect = { index: 5, top: 0, left: 700, width: 200, height: 300 };

    expect(clampLineRectToViewport(rect, viewport)).toBeNull();
  });
});

describe("the menu a grip opens", () => {
  it("is titled by the line it acts on", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);

    const row = createTableLineMenuItems(instance, { tablePos, orientation: "row", index: 1 }, LABELS);
    const column = createTableLineMenuItems(instance, { tablePos, orientation: "column", index: 1 }, LABELS);

    expect(row.find((item) => item.header)?.label).toBe("Row");
    expect(column.find((item) => item.header)?.label).toBe("Column");
  });

  it("offers the header toggle on the first line only", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);

    // prosemirror-tables' toggleHeader always acts on the first row or column
    // whatever the selection, so offering it elsewhere would silently change
    // a line the menu does not name.
    expect(
      labelsOf(createTableLineMenuItems(instance, { tablePos, orientation: "row", index: 0 }, LABELS)),
    ).toContain("Header row");
    expect(
      labelsOf(createTableLineMenuItems(instance, { tablePos, orientation: "row", index: 1 }, LABELS)),
    ).not.toContain("Header row");
  });

  it("drops the move a line at the end of its axis cannot make", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);

    const first = labelsOf(createTableLineMenuItems(instance, { tablePos, orientation: "row", index: 0 }, LABELS));
    const middle = labelsOf(createTableLineMenuItems(instance, { tablePos, orientation: "row", index: 1 }, LABELS));
    const last = labelsOf(createTableLineMenuItems(instance, { tablePos, orientation: "row", index: 2 }, LABELS));

    expect(first).not.toContain("Move row up");
    expect(first).toContain("Move row down");
    expect(middle).toContain("Move row up");
    expect(middle).toContain("Move row down");
    expect(last).toContain("Move row up");
    expect(last).not.toContain("Move row down");
  });

  it("drops delete when the line is the last one", () => {
    const { editor: instance, tablePos } = createTableEditor(1, 3);

    // Deleting the only row removes the whole table, which is not what a menu
    // titled "Row" should do.
    expect(
      labelsOf(createTableLineMenuItems(instance, { tablePos, orientation: "row", index: 0 }, LABELS)),
    ).not.toContain("Delete row");
  });

  it("drops merge when the line holds a single cell", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 1);

    expect(
      labelsOf(createTableLineMenuItems(instance, { tablePos, orientation: "row", index: 0 }, LABELS)),
    ).not.toContain("Merge cells");
  });

  it("offers split only once the line holds a merged cell", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);
    const line = { tablePos, orientation: "row", index: 1 } as const;

    expect(labelsOf(createTableLineMenuItems(instance, line, LABELS))).not.toContain("Split cell");

    selectTableLine(instance, line);
    instance.commands.mergeCells();

    // The merge covers the whole row, which the cell menu refuses to answer
    // for — so this entry is the only way back from it.
    expect(labelsOf(createTableLineMenuItems(instance, line, LABELS))).toContain("Split cell");
  });

  it("marks the alignment the line already carries", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);

    setCellAttrInScope(
      instance,
      { kind: "line", tablePos, orientation: "row", index: 1 },
      { cellAlign: "right", cellVerticalAlign: "bottom" },
    );

    const items = createTableLineMenuItems(instance, { tablePos, orientation: "row", index: 1 }, LABELS);
    const alignment = items.find((item) => item.id === TABLE_LINE_MENU_IDS.alignment);
    const active = alignment?.submenuItems?.filter((item) => item.isActive).map((item) => item.label);

    expect(active).toEqual(["Right", "Bottom"]);
  });

  it("returns nothing for a line the table does not have", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);

    expect(createTableLineMenuItems(instance, { tablePos, orientation: "row", index: 7 }, LABELS)).toEqual([]);
  });
});

describe("running a menu entry", () => {
  it("inserting after a row adds one row below it", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);

    handleTableLineMenuAction(instance, TABLE_LINE_MENU_IDS.insertAfter, {
      tablePos,
      orientation: "row",
      index: 0,
    });

    expect(getTableSize(instance, tablePos)).toEqual({ rows: 4, columns: 3 });
  });

  it("deleting a column removes one column", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);

    handleTableLineMenuAction(instance, TABLE_LINE_MENU_IDS.delete, {
      tablePos,
      orientation: "column",
      index: 1,
    });

    expect(getTableSize(instance, tablePos)).toEqual({ rows: 3, columns: 2 });
  });

  it("moving a row down swaps it with the one below", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 2);

    const cells = collectCellPositions(instance, { kind: "line", tablePos, orientation: "row", index: 1 });
    instance.commands.insertContentAt(cells[0]! + 1, "second");

    expect(cellText(instance, tablePos, 1, 0)).toBe("second");

    handleTableLineMenuAction(instance, TABLE_LINE_MENU_IDS.moveForward, {
      tablePos,
      orientation: "row",
      index: 1,
    });

    expect(cellText(instance, tablePos, 2, 0)).toBe("second");
  });

  it("splitting a merged row puts every cell back", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);
    const line = { tablePos, orientation: "row", index: 1 } as const;

    selectTableLine(instance, line);
    instance.commands.mergeCells();
    expect(collectCellPositions(instance, { kind: "line", ...line })).toHaveLength(1);

    expect(handleTableLineMenuAction(instance, TABLE_LINE_MENU_IDS.split, line)).toBe(true);

    expect(collectCellPositions(instance, { kind: "line", ...line })).toHaveLength(3);
    expect(getTableSize(instance, tablePos)).toEqual({ rows: 3, columns: 3 });
  });

  it("splitting a line unmerges every merged cell it holds", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 4);
    const row = { tablePos, orientation: "row", index: 1 } as const;

    // Two separate merges on one row: one pass per merged cell, not one pass
    // for the line.
    const cells = collectCellPositions(instance, { kind: "line", ...row });
    instance.commands.setCellSelection({ anchorCell: cells[0]!, headCell: cells[1]! });
    instance.commands.mergeCells();

    const after = collectCellPositions(instance, { kind: "line", ...row });
    instance.commands.setCellSelection({ anchorCell: after[1]!, headCell: after[2]! });
    instance.commands.mergeCells();

    expect(collectCellPositions(instance, { kind: "line", ...row })).toHaveLength(2);

    handleTableLineMenuAction(instance, TABLE_LINE_MENU_IDS.split, row);

    expect(collectCellPositions(instance, { kind: "line", ...row })).toHaveLength(4);
  });

  it("splitting a merged column leaves only its first cell a header", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);
    const column = { tablePos, orientation: "column", index: 1 } as const;

    // The merge swallows the header cell at the top of the column, so the
    // merged cell is itself a header. Handing that type to every cell coming
    // out of the split turned the whole column into headers.
    selectTableLine(instance, column);
    instance.commands.mergeCells();
    handleTableLineMenuAction(instance, TABLE_LINE_MENU_IDS.split, column);

    expect(cellTypes(instance, tablePos, column)).toEqual([
      "tableHeader",
      "tableCell",
      "tableCell",
    ]);
  });

  it("splitting a merged header row keeps the whole row a header", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);
    const row = { tablePos, orientation: "row", index: 0 } as const;

    // Nothing of the first row survives the merge to be read, so the merged
    // cell's own type is what says the row is still a header.
    selectTableLine(instance, row);
    instance.commands.mergeCells();
    handleTableLineMenuAction(instance, TABLE_LINE_MENU_IDS.split, row);

    expect(cellTypes(instance, tablePos, row)).toEqual([
      "tableHeader",
      "tableHeader",
      "tableHeader",
    ]);
  });

  it("splitting a merged row restores the table's header column", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);
    const row = { tablePos, orientation: "row", index: 1 } as const;

    instance.commands.toggleHeaderColumn();
    selectTableLine(instance, row);
    instance.commands.mergeCells();
    handleTableLineMenuAction(instance, TABLE_LINE_MENU_IDS.split, row);

    // Read from the first column, which the split does not touch: the header
    // belongs to the place, not to the cell that was merged over it.
    expect(cellTypes(instance, tablePos, row)).toEqual([
      "tableHeader",
      "tableCell",
      "tableCell",
    ]);
  });

  it("splitting a merged body row keeps it a body row", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);
    const row = { tablePos, orientation: "row", index: 1 } as const;

    selectTableLine(instance, row);
    instance.commands.mergeCells();
    handleTableLineMenuAction(instance, TABLE_LINE_MENU_IDS.split, row);

    expect(cellTypes(instance, tablePos, row)).toEqual(["tableCell", "tableCell", "tableCell"]);
  });

  it("splitting a line with nothing merged changes nothing", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);

    expect(
      handleTableLineMenuAction(instance, TABLE_LINE_MENU_IDS.split, {
        tablePos,
        orientation: "row",
        index: 1,
      }),
    ).toBe(false);
    expect(getTableSize(instance, tablePos)).toEqual({ rows: 3, columns: 3 });
  });

  it("duplicating a row copies its text and keeps every row the same width", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);

    const cells = collectCellPositions(instance, { kind: "line", tablePos, orientation: "row", index: 1 });
    instance.commands.insertContentAt(cells[0]! + 1, "alpha");

    handleTableLineMenuAction(instance, TABLE_LINE_MENU_IDS.duplicate, {
      tablePos,
      orientation: "row",
      index: 1,
    });

    expect(getTableSize(instance, tablePos)).toEqual({ rows: 4, columns: 3 });
    expect(cellText(instance, tablePos, 1, 0)).toBe("alpha");
    expect(cellText(instance, tablePos, 2, 0)).toBe("alpha");

    const table = instance.state.doc.nodeAt(tablePos)!;
    const widths = new Set<number>();
    table.forEach((row) => widths.add(row.childCount));
    expect(widths.size).toBe(1);
  });

  it("duplicating a column copies its text into the new column", () => {
    const { editor: instance, tablePos } = createTableEditor(2, 3);

    const cells = collectCellPositions(instance, { kind: "line", tablePos, orientation: "column", index: 1 });
    instance.commands.insertContentAt(cells[0]! + 1, "beta");

    handleTableLineMenuAction(instance, TABLE_LINE_MENU_IDS.duplicate, {
      tablePos,
      orientation: "column",
      index: 1,
    });

    expect(getTableSize(instance, tablePos)).toEqual({ rows: 2, columns: 4 });
    expect(cellText(instance, tablePos, 0, 1)).toBe("beta");
    expect(cellText(instance, tablePos, 0, 2)).toBe("beta");
  });

  it("a colour reaches the whole line and clears again", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);
    const line = { tablePos, orientation: "column" as const, index: 1 };

    handleTableLineMenuAction(instance, "color:yellow", line);
    expect(getSharedCellAttr(instance, { kind: "line", ...line }, "cellBackground")).toBe("#FEF08A");

    handleTableLineMenuAction(instance, "color:default", line);
    expect(getSharedCellAttr(instance, { kind: "line", ...line }, "cellBackground")).toBeNull();
  });

  it("an alignment reaches the whole line on each axis independently", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);
    const line = { tablePos, orientation: "row" as const, index: 2 };

    handleTableLineMenuAction(instance, "align:center", line);
    handleTableLineMenuAction(instance, "align:bottom", line);

    expect(getSharedCellAttr(instance, { kind: "line", ...line }, "cellAlign")).toBe("center");
    expect(getSharedCellAttr(instance, { kind: "line", ...line }, "cellVerticalAlign")).toBe("bottom");
  });

  it("merging a row leaves it holding one cell", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);

    handleTableLineMenuAction(instance, TABLE_LINE_MENU_IDS.merge, {
      tablePos,
      orientation: "row",
      index: 1,
    });

    expect(
      collectCellPositions(instance, { kind: "line", tablePos, orientation: "row", index: 1 }),
    ).toHaveLength(1);
  });

  it("does nothing for an entry it does not know", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);
    const before = instance.getHTML();

    expect(
      handleTableLineMenuAction(instance, "nonsense", { tablePos, orientation: "row", index: 0 }),
    ).toBe(false);
    expect(instance.getHTML()).toBe(before);
  });

  it("moves a row the caret is nowhere near", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 2);

    const cells = collectCellPositions(instance, {
      kind: "line",
      tablePos,
      orientation: "row",
      index: 1,
    });
    instance.commands.insertContentAt(cells[0]! + 1, "second");

    // The menu names the line; the cursor is in the paragraph above the table.
    // prosemirror-tables takes the range of rows to lift from the selection, so
    // a move that did not place one itself silently did nothing at all.
    instance.commands.setTextSelection(1);

    expect(
      handleTableLineMenuAction(instance, TABLE_LINE_MENU_IDS.moveForward, {
        tablePos,
        orientation: "row",
        index: 1,
      }),
    ).toBe(true);

    expect(cellText(instance, tablePos, 2, 0)).toBe("second");
  });

  it("moves a column the caret is nowhere near", () => {
    const { editor: instance, tablePos } = createTableEditor(2, 3);

    const cells = collectCellPositions(instance, {
      kind: "line",
      tablePos,
      orientation: "column",
      index: 1,
    });
    instance.commands.insertContentAt(cells[1]! + 1, "beta");
    instance.commands.setTextSelection(1);

    expect(
      handleTableLineMenuAction(instance, TABLE_LINE_MENU_IDS.moveForward, {
        tablePos,
        orientation: "column",
        index: 1,
      }),
    ).toBe(true);

    expect(cellText(instance, tablePos, 1, 2)).toBe("beta");
  });
});

// =============================================================================
// Mixed scopes
// =============================================================================

describe("reading an attribute across a scope", () => {
  it("tells an unset line from one whose cells disagree", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);
    const row = { kind: "line", tablePos, orientation: "row", index: 1 } as const;

    expect(readSharedCellAttr(instance, row, "cellAlign")).toEqual({
      value: null,
      mixed: false,
    });

    const cells = collectCellPositions(instance, row);
    setCellAttrInScope(
      instance,
      { kind: "line", tablePos, orientation: "column", index: 0 },
      { cellAlign: "center" },
    );

    expect(cells).toHaveLength(3);
    expect(readSharedCellAttr(instance, row, "cellAlign")).toEqual({
      value: null,
      mixed: true,
    });
    // The older reader still collapses both to null, which is its contract.
    expect(getSharedCellAttr(instance, row, "cellAlign")).toBeNull();
  });

  it("marks no alignment when the line's cells disagree", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);
    const line = { tablePos, orientation: "row" as const, index: 1 };

    // Untouched, every cell falls back to left and top, and the submenu says so.
    const unset = alignmentSubmenu(createTableLineMenuItems(instance, line, LABELS));
    expect(activeLabels(unset)).toEqual(["Left", "Top"]);

    // One cell centred, the rest not: the line has no alignment of its own, and
    // claiming "Left" would offer to keep a state that is not the case.
    setCellAttrInScope(
      instance,
      { kind: "line", tablePos, orientation: "column", index: 0 },
      { cellAlign: "center" },
    );

    const mixed = alignmentSubmenu(createTableLineMenuItems(instance, line, LABELS));
    expect(activeLabels(mixed)).toEqual(["Top"]);
  });

  it("marks no colour when the line's cells disagree", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);
    const line = { tablePos, orientation: "row" as const, index: 1 };

    const unset = colorSubmenu(createTableLineMenuItems(instance, line, LABELS));
    expect(activeLabels(unset)).toEqual(["Default"]);

    setCellAttrInScope(
      instance,
      { kind: "line", tablePos, orientation: "column", index: 0 },
      { cellBackground: "#FEF08A" },
    );

    const mixed = colorSubmenu(createTableLineMenuItems(instance, line, LABELS));
    expect(activeLabels(mixed)).toEqual([]);
  });
});

// =============================================================================
// Grip menu state
// =============================================================================

describe("the mark a grip leaves while its menu is open", () => {
  it("is off until a grip sets it, and off again after", () => {
    const { editor: instance } = createTableEditor(3, 3);

    expect(isTableGripMenuOpen(instance)).toBe(false);

    setTableGripMenuOpen(instance, true);
    expect(isTableGripMenuOpen(instance)).toBe(true);

    setTableGripMenuOpen(instance, false);
    expect(isTableGripMenuOpen(instance)).toBe(false);
  });

  it("is per editor, so one open menu does not silence another editor", () => {
    const { editor: first } = createTableEditor(3, 3);
    const second = new Editor({ extensions: [StarterKit, TableBundle], content: "<p>x</p>" });

    try {
      setTableGripMenuOpen(first, true);
      expect(isTableGripMenuOpen(second)).toBe(false);
    } finally {
      second.destroy();
    }
  });
});

// =============================================================================
// Read-only
// =============================================================================

describe("a read-only editor", () => {
  it("refuses every grip menu action", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);
    const line = { tablePos, orientation: "row" as const, index: 1 };
    instance.setEditable(false);

    const before = instance.getHTML();
    for (const itemId of [
      TABLE_LINE_MENU_IDS.delete,
      TABLE_LINE_MENU_IDS.duplicate,
      TABLE_LINE_MENU_IDS.insertAfter,
      TABLE_LINE_MENU_IDS.merge,
      TABLE_LINE_MENU_IDS.moveForward,
      TABLE_LINE_MENU_IDS.toggleHeader,
      "color:yellow",
      "align:center",
    ]) {
      expect(handleTableLineMenuAction(instance, itemId, line)).toBe(false);
    }

    // The guard has to hold against the dispatch, not just the return value:
    // ProseMirror's `editable: false` stops input arriving through the DOM and
    // nothing else, so a menu that skipped this check would still rewrite the
    // document a licence gate had frozen.
    expect(instance.getHTML()).toBe(before);
    expect(getTableSize(instance, tablePos)).toEqual({ rows: 3, columns: 3 });
  });

  it("accepts them again once editing is restored", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);
    const line = { tablePos, orientation: "row" as const, index: 1 };

    instance.setEditable(false);
    expect(handleTableLineMenuAction(instance, TABLE_LINE_MENU_IDS.insertAfter, line)).toBe(false);

    instance.setEditable(true);
    expect(handleTableLineMenuAction(instance, TABLE_LINE_MENU_IDS.insertAfter, line)).toBe(true);
    expect(getTableSize(instance, tablePos)).toEqual({ rows: 4, columns: 3 });
  });
});

// =============================================================================
// Colour round trip
// =============================================================================

describe("a cell colour written by the browser", () => {
  it("folds rgb() back to the hex the palette compares against", () => {
    // parseHTML reads element.style.backgroundColor, which the browser
    // normalizes — so a cell saved as #FEF08A comes back as rgb(254, 240, 138)
    // and used to match no swatch at all after a reload.
    expect(normalizeColorValue("rgb(254, 240, 138)")).toBe("#fef08a");
    expect(normalizeColorValue("#FEF08A")).toBe("#fef08a");
    expect(normalizeColorValue("rgb(254, 240, 138)")).toBe(normalizeColorValue("#FEF08A"));
  });

  it("pads single-digit channels", () => {
    expect(normalizeColorValue("rgb(0, 8, 15)")).toBe("#00080f");
  });

  it("reads a fully transparent colour as no colour", () => {
    // Otherwise clearing a cell left it matching a black swatch.
    expect(normalizeColorValue("rgba(0, 0, 0, 0)")).toBeNull();
  });

  it("reads the space-separated form CSS Color 4 serialises", () => {
    // What a browser returns for anything authored in the modern syntax, and
    // what arrives on paste from an editor that uses it. Stripping whitespace
    // before matching turned it into rgb(254240138) — no match, and straight
    // back to the symptom the folding exists to cure.
    expect(normalizeColorValue("rgb(254 240 138)")).toBe("#fef08a");
    expect(normalizeColorValue("rgb(254 240 138 / 50%)")).toBe("#fef08a");
    expect(normalizeColorValue("rgb(254 240 138 / 0.5)")).toBe("#fef08a");
  });

  it("reads a transparent colour as no colour whichever way the alpha is written", () => {
    expect(normalizeColorValue("rgb(0 0 0 / 0)")).toBeNull();
    expect(normalizeColorValue("rgb(0 0 0 / 0%)")).toBeNull();
  });

  it("marks the swatch active for a line reloaded from saved HTML", () => {
    const { editor: instance, tablePos } = createTableEditor(3, 3);
    const line = { tablePos, orientation: "row" as const, index: 1 };

    setCellAttrInScope(
      instance,
      { kind: "line", ...line },
      { cellBackground: "rgb(254, 240, 138)" },
    );

    const swatches = submenuOf(
      createTableLineMenuItems(instance, line, LABELS),
      TABLE_LINE_MENU_IDS.colors,
    );
    expect(activeLabels(swatches)).toEqual(["Yellow"]);
  });
});

describe("tableGripLabel", () => {
  it("names the grip by its 1-based index", () => {
    expect(tableGripLabel(en.table, "column", 1)).toBe("Column 2 actions");
    expect(tableGripLabel(en.table, "row", 0)).toBe("Row 1 actions");
  });
});
