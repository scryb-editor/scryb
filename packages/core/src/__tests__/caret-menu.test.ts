import { describe, it, expect, afterEach } from "vitest";
import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { createScrybEditor } from "../editor-factory";
import {
  createTableCellMenuItems,
  getCaretTableCell,
  handleTableCellMenuAction,
  mapTablePosThrough,
  TABLE_CELL_MENU_IDS,
} from "../table-menu/cell-menu";
import { TABLE_LINE_MENU_IDS } from "../table-menu/actions";
import {
  createCaretMenuItems,
  getCaretMenuAnchorPos,
  getCaretMenuBlockPos,
  getCaretMenuStep,
  getCaretMenuTarget,
  remapCaretMenuTarget,
  runCaretMenuAction,
} from "../block-menu/caret";
import type { CaretMenuTarget } from "../block-menu/caret";
import { buildTableCellMenuLabels } from "../i18n/menu-labels";
import { en } from "../i18n/locales/en";

let editor: Editor | undefined;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

function caretIn(instance: Editor, text: string): void {
  let target = -1;
  instance.state.doc.descendants((node, pos) => {
    if (target === -1 && node.isText && node.text === text) target = pos + 1;
  });
  instance.commands.setTextSelection(target);
}

const TABLE =
  "<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></tbody></table>";

/** Runs `edit` and returns the transaction it dispatched. */
function capture(instance: Editor, edit: () => void): Transaction {
  let last: Transaction | undefined;
  const listener = ({ transaction }: { transaction: Transaction }) => {
    if (transaction.docChanged) last = transaction;
  };
  instance.on("transaction", listener);
  edit();
  instance.off("transaction", listener);
  return last!;
}

function tablePosOf(instance: Editor): number {
  let found = -1;
  instance.state.doc.forEach((node, offset) => {
    if (node.type.name === "table") found = offset;
  });
  return found;
}

describe("caret menus", () => {
  it("resolves the caret's table cell with its row and column", () => {
    editor = createScrybEditor({ content: TABLE });
    caretIn(editor, "d");
    const cell = getCaretTableCell(editor)!;
    expect(cell.row).toEqual({ tablePos: cell.tablePos, orientation: "row", index: 1 });
    expect(cell.column).toEqual({ tablePos: cell.tablePos, orientation: "column", index: 1 });
  });

  it("is not in a table cell in a paragraph", () => {
    editor = createScrybEditor({ content: "<p>one</p>" });
    caretIn(editor, "one");
    expect(getCaretTableCell(editor)).toBeNull();
  });

  it("offers row, column and table actions plus the cell's own", () => {
    editor = createScrybEditor({ content: TABLE });
    caretIn(editor, "a");
    const ids = createTableCellMenuItems(editor, buildTableCellMenuLabels(en)).map((i) => i.id);
    expect(ids).toEqual([
      "header:tableCell",
      TABLE_CELL_MENU_IDS.row,
      TABLE_CELL_MENU_IDS.column,
      TABLE_CELL_MENU_IDS.table,
      "separator:cell",
      TABLE_CELL_MENU_IDS.toggleHeaderCell,
    ]);
  });

  it("offers Split cell in a merged cell", () => {
    editor = createScrybEditor({
      content:
        '<table><tbody><tr><td colspan="2"><p>a</p></td></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></tbody></table>',
    });
    caretIn(editor, "a");
    const ids = createTableCellMenuItems(editor, buildTableCellMenuLabels(en)).map((i) => i.id);
    expect(ids).toContain(TABLE_CELL_MENU_IDS.split);
  });

  it("toggles the caret cell into a header cell", () => {
    editor = createScrybEditor({ content: TABLE });
    caretIn(editor, "a");
    expect(handleTableCellMenuAction(editor, TABLE_CELL_MENU_IDS.toggleHeaderCell)).toBe(true);
    expect(editor.getHTML()).toContain("<th");
  });
});

describe("mapTablePosThrough", () => {
  it("follows the table across an edit before it", () => {
    editor = createScrybEditor({ content: `<p>x</p>${TABLE}` });
    const tablePos = tablePosOf(editor);
    const tr = capture(editor, () => editor!.commands.insertContentAt(1, "yy"));
    expect(mapTablePosThrough(tr, tablePos)).toBe(tablePos + 2);
  });

  it("keeps the target when only a cell attribute changes", () => {
    editor = createScrybEditor({ content: TABLE });
    caretIn(editor, "a");
    const tablePos = tablePosOf(editor);
    const tr = capture(editor, () => editor!.commands.setCellAttribute("cellBackground", "#fef3c7"));
    expect(mapTablePosThrough(tr, tablePos)).toBe(tablePos);
  });

  it("drops the target when a row is added, since its indices now name other cells", () => {
    editor = createScrybEditor({ content: TABLE });
    caretIn(editor, "a");
    const tablePos = tablePosOf(editor);
    const tr = capture(editor, () => editor!.commands.addRowBefore());
    expect(mapTablePosThrough(tr, tablePos)).toBeNull();
  });
});

describe("caret menu targets", () => {
  it("targets the caret block outside a table", () => {
    editor = createScrybEditor({ content: "<p>one</p><h2>two</h2>" });
    caretIn(editor, "two");
    const target = getCaretMenuTarget(editor)!;
    expect(target).toEqual({ kind: "block", pos: 5 });
    expect(getCaretMenuAnchorPos(target)).toBe(5);
    expect(getCaretMenuBlockPos(target)).toBe(5);
    expect(createCaretMenuItems(editor, target, en)[0]).toMatchObject({ header: true });
  });

  it("targets the caret cell inside a table, anchored to the cell", () => {
    editor = createScrybEditor({ content: TABLE });
    caretIn(editor, "d");
    const target = getCaretMenuTarget(editor)!;
    expect(target.kind).toBe("cell");
    const cell = getCaretTableCell(editor)!;
    expect(getCaretMenuAnchorPos(target)).toBe(cell.cellPos);
    expect(getCaretMenuBlockPos(target)).toBe(cell.tablePos);
  });

  it("steps from the cell menu into the row, column and table menus", () => {
    editor = createScrybEditor({ content: TABLE });
    caretIn(editor, "d");
    const cellTarget = getCaretMenuTarget(editor)!;
    const cell = getCaretTableCell(editor)!;

    expect(getCaretMenuStep(cellTarget, TABLE_CELL_MENU_IDS.row)).toEqual({
      kind: "line",
      line: cell.row,
      cellPos: cell.cellPos,
    });
    expect(getCaretMenuStep(cellTarget, TABLE_CELL_MENU_IDS.column)).toEqual({
      kind: "line",
      line: cell.column,
      cellPos: cell.cellPos,
    });
    const tableTarget = getCaretMenuStep(cellTarget, TABLE_CELL_MENU_IDS.table)!;
    expect(tableTarget).toEqual({ kind: "table", pos: cell.tablePos, cellPos: cell.cellPos });
    expect(getCaretMenuStep(cellTarget, TABLE_CELL_MENU_IDS.toggleHeaderCell)).toBeNull();
    expect(getCaretMenuStep(tableTarget, TABLE_CELL_MENU_IDS.row)).toBeNull();
  });

  it("lists the row menu's items for a row target and runs them on that row", () => {
    editor = createScrybEditor({ content: TABLE });
    caretIn(editor, "d");
    const rowTarget = getCaretMenuStep(getCaretMenuTarget(editor)!, TABLE_CELL_MENU_IDS.row)!;
    const ids = createCaretMenuItems(editor, rowTarget, en).map((i) => i.id);
    expect(ids).toContain(TABLE_LINE_MENU_IDS.insertAfter);
    expect(runCaretMenuAction(editor, rowTarget, TABLE_LINE_MENU_IDS.insertAfter)).toBe(true);
    expect(editor.state.doc.firstChild!.childCount).toBe(3);
  });

  it("runs a cell action on the caret cell", () => {
    editor = createScrybEditor({ content: TABLE });
    caretIn(editor, "a");
    const target = getCaretMenuTarget(editor)!;
    expect(runCaretMenuAction(editor, target, TABLE_CELL_MENU_IDS.toggleHeaderCell)).toBe(true);
    expect(editor.getHTML()).toContain("<th");
  });

  it("follows a block across an edit before it, and drops it once deleted", () => {
    editor = createScrybEditor({ content: "<p>one</p><p>two</p>" });
    caretIn(editor, "two");
    const target = getCaretMenuTarget(editor)!;
    const typed = capture(editor, () => editor!.commands.insertContentAt(1, "yy"));
    const moved = remapCaretMenuTarget(target, typed)!;
    expect(moved).toEqual({ kind: "block", pos: 7 });
    const deleted = capture(editor, () => editor!.commands.deleteRange({ from: 7, to: 12 }));
    expect(remapCaretMenuTarget(moved, deleted)).toBeNull();
  });

  it("follows a table target across an edit before the table", () => {
    editor = createScrybEditor({ content: `<p>x</p>${TABLE}` });
    caretIn(editor, "d");
    const rowTarget = getCaretMenuStep(getCaretMenuTarget(editor)!, TABLE_CELL_MENU_IDS.row) as Extract<
      CaretMenuTarget,
      { kind: "line" }
    >;
    const tr = capture(editor, () => editor!.commands.insertContentAt(1, "yy"));
    expect(remapCaretMenuTarget(rowTarget, tr)).toEqual({
      kind: "line",
      line: { ...rowTarget.line, tablePos: rowTarget.line.tablePos + 2 },
      cellPos: rowTarget.cellPos + 2,
    });
  });

  it("drops a table target when the table gains a row", () => {
    editor = createScrybEditor({ content: TABLE });
    caretIn(editor, "d");
    const target = getCaretMenuTarget(editor)!;
    caretIn(editor, "a");
    const tr = capture(editor, () => editor!.commands.addRowBefore());
    expect(remapCaretMenuTarget(target, tr)).toBeNull();
  });
});
