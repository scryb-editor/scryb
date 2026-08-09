import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { columnResizingPluginKey } from "@tiptap/pm/tables";
import { TableBundle } from "../table-bundle.extension";
import {
  isCellAlign,
  isCellVerticalAlign,
  tableHasColumnWidths,
  TABLE_WIDTH_AUTO_CLASS,
  TABLE_WIDTH_FIT_CLASS,
} from "../table-layout.extension";

// =============================================================================
// Table layout attributes
// =============================================================================
//
// The attributes are only worth anything if they survive being written out and
// read back: a table saved centred that reopens full width is the same as not
// having the feature. parseHTML returning `{ attr: value }` instead of the
// value is how that has failed twice in this repo already, so the round trip is
// the first thing asserted here.
// =============================================================================

let editor: Editor | null = null;

const TABLE_HTML = "<table><tbody><tr><td><p>Cell</p></td></tr></tbody></table>";

function createEditor(content: string): Editor {
  editor = new Editor({ extensions: [StarterKit, TableBundle], content });
  return editor;
}

function tablePos(instance: Editor): number {
  let found: number | null = null;
  instance.state.doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.type.name === "table") {
      found = pos;
      return false;
    }
    return true;
  });
  if (found === null) throw new Error("no table in the document");
  return found;
}

function tableAttrs(instance: Editor): Record<string, unknown> {
  return instance.state.doc.nodeAt(tablePos(instance))!.attrs;
}

function setAttrs(instance: Editor, attrs: Record<string, unknown>): void {
  const pos = tablePos(instance);
  const node = instance.state.doc.nodeAt(pos)!;
  instance.view.dispatch(
    instance.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }),
  );
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("alignment guards", () => {
  it("accept the three horizontal alignments", () => {
    expect(["left", "center", "right"].every(isCellAlign)).toBe(true);
  });

  it("accept the three vertical alignments", () => {
    expect(["top", "middle", "bottom"].every(isCellVerticalAlign)).toBe(true);
  });

  it("reject anything else", () => {
    expect(isCellAlign("justify")).toBe(false);
    expect(isCellAlign(null)).toBe(false);
    expect(isCellAlign({ cellAlign: "center" })).toBe(false);
    expect(isCellVerticalAlign("baseline")).toBe(false);
  });
});

function cellAttrs(instance: Editor): Record<string, unknown> {
  let found: Record<string, unknown> | null = null;
  instance.state.doc.descendants((node) => {
    if (found) return false;
    if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
      found = node.attrs;
      return false;
    }
    return true;
  });
  if (!found) throw new Error("no cell in the document");
  return found;
}

function setCellAttrs(instance: Editor, attrs: Record<string, unknown>): void {
  const positions: number[] = [];
  instance.state.doc.descendants((node, pos) => {
    if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
      positions.push(pos);
      return false;
    }
    return true;
  });
  const tr = instance.state.tr;
  for (const pos of positions.reverse()) {
    const cell = tr.doc.nodeAt(pos)!;
    tr.setNodeMarkup(pos, undefined, { ...cell.attrs, ...attrs });
  }
  instance.view.dispatch(tr);
}

describe("table width attribute", () => {
  it("defaults to unset, which is full width", () => {
    const instance = createEditor(TABLE_HTML);

    expect(tableAttrs(instance)["tableWidth"]).toBeNull();
  });

  it("emits no class while unset", () => {
    const instance = createEditor(TABLE_HTML);

    expect(instance.getHTML()).not.toContain(TABLE_WIDTH_AUTO_CLASS);
  });

  it("renders the auto mode as a class and survives a round trip", () => {
    const instance = createEditor(TABLE_HTML);
    setAttrs(instance, { tableWidth: "auto" });

    const html = instance.getHTML();
    expect(html).toContain(TABLE_WIDTH_AUTO_CLASS);

    const reparsed = new Editor({ extensions: [StarterKit, TableBundle], content: html });
    expect(tableAttrs(reparsed)["tableWidth"]).toBe("auto");
    reparsed.destroy();
  });
});

describe("table fit decoration", () => {
  /** The classes the plugin put on the node view of the table at `pos`. */
  function classesAt(instance: Editor, pos: number): string[] {
    const wrapper = instance.view.nodeDOM(pos);
    if (!(wrapper instanceof Element)) throw new Error("the table has no node view");
    return [...wrapper.classList];
  }

  /** The classes on the first table's node view. */
  function wrapperClasses(instance: Editor): string[] {
    return classesAt(instance, tablePos(instance));
  }

  /** Positions of every table in the document, in document order. */
  function tablePositions(instance: Editor): number[] {
    const positions: number[] = [];
    instance.state.doc.descendants((node, pos) => {
      if (node.type.name !== "table") return true;
      positions.push(pos);
      return false;
    });
    return positions;
  }

  /** Offset of the table's first cell, relative to the table's content start. */
  function firstCellOffset(instance: Editor, pos: number): number {
    let found: number | null = null;
    instance.state.doc.nodeAt(pos)!.descendants((node, offset) => {
      if (found !== null) return false;
      if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
        found = offset;
        return false;
      }
      return true;
    });
    if (found === null) throw new Error("no cell in the table");
    return found;
  }

  function setColumnWidth(instance: Editor, width: number | null): void {
    const pos = tablePos(instance);
    let cellPos: number | null = null;
    instance.state.doc.nodeAt(pos)!.descendants((node, offset) => {
      if (cellPos !== null) return false;
      if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
        cellPos = pos + 1 + offset;
        return false;
      }
      return true;
    });
    const cell = instance.state.doc.nodeAt(cellPos!)!;
    instance.view.dispatch(
      instance.state.tr.setNodeMarkup(cellPos!, undefined, {
        ...cell.attrs,
        colwidth: width === null ? null : [width],
      }),
    );
  }

  it("marks a full-width table that carries no column widths", () => {
    // The mark is what lets the stylesheet drop the floor the node view writes,
    // which is `columns × cellMinWidth` and stops a table fitting a column
    // narrower than that.
    const instance = createEditor(TABLE_HTML);

    expect(wrapperClasses(instance)).toContain(TABLE_WIDTH_FIT_CLASS);
  });

  it("drops the mark the moment a column is dragged", () => {
    // A dragged width is an instruction, and fitting must not overrule it.
    const instance = createEditor(TABLE_HTML);
    setColumnWidth(instance, 420);

    expect(wrapperClasses(instance)).not.toContain(TABLE_WIDTH_FIT_CLASS);
  });

  it("takes the mark back when the widths are cleared", () => {
    const instance = createEditor(TABLE_HTML);
    setColumnWidth(instance, 420);
    setColumnWidth(instance, null);

    expect(wrapperClasses(instance)).toContain(TABLE_WIDTH_FIT_CLASS);
  });

  it("never marks a content-width table, which is not filling anything", () => {
    const instance = createEditor(TABLE_HTML);
    setAttrs(instance, { tableWidth: "auto" });

    const classes = wrapperClasses(instance);
    expect(classes).toContain(TABLE_WIDTH_AUTO_CLASS);
    expect(classes).not.toContain(TABLE_WIDTH_FIT_CLASS);
  });

  it("lifts the mark only from the table being dragged", () => {
    // Lifting it everywhere made every other fitted table on the page jump to
    // its floor for the length of a drag it had nothing to do with.
    const instance = createEditor(TABLE_HTML + TABLE_HTML);
    const positions = tablePositions(instance);
    expect(positions).toHaveLength(2);

    const firstCell = positions[0]! + 1 + firstCellOffset(instance, positions[0]!);
    instance.view.dispatch(
      instance.state.tr.setMeta(columnResizingPluginKey, { setHandle: firstCell }),
    );
    instance.view.dispatch(
      instance.state.tr.setMeta(columnResizingPluginKey, {
        setDragging: { startX: 0, startWidth: 100 },
      }),
    );

    expect(classesAt(instance, positions[0]!)).not.toContain(TABLE_WIDTH_FIT_CLASS);
    expect(classesAt(instance, positions[1]!)).toContain(TABLE_WIDTH_FIT_CLASS);
  });

  it("gives the mark back to the dragged table when the drag ends", () => {
    const instance = createEditor(TABLE_HTML);
    const pos = tablePos(instance);
    const cell = pos + 1 + firstCellOffset(instance, pos);

    instance.view.dispatch(instance.state.tr.setMeta(columnResizingPluginKey, { setHandle: cell }));
    instance.view.dispatch(
      instance.state.tr.setMeta(columnResizingPluginKey, {
        setDragging: { startX: 0, startWidth: 100 },
      }),
    );
    instance.view.dispatch(
      instance.state.tr.setMeta(columnResizingPluginKey, { setDragging: null }),
    );

    // Released without moving, so no width was written and the table is fitted
    // again — the same state it was in before the pointer went down.
    expect(classesAt(instance, pos)).toContain(TABLE_WIDTH_FIT_CLASS);
  });

  it("reads the column widths off the table node", () => {
    const instance = createEditor(TABLE_HTML);
    expect(tableHasColumnWidths(instance.state.doc.nodeAt(tablePos(instance))!)).toBe(false);

    setColumnWidth(instance, 420);
    expect(tableHasColumnWidths(instance.state.doc.nodeAt(tablePos(instance))!)).toBe(true);
  });
});

describe("cell alignment attributes", () => {
  it("default to unset on a fresh cell", () => {
    const instance = createEditor(TABLE_HTML);

    expect(cellAttrs(instance)["cellAlign"]).toBeNull();
    expect(cellAttrs(instance)["cellVerticalAlign"]).toBeNull();
  });

  it("emit no class while unset", () => {
    const instance = createEditor(TABLE_HTML);

    expect(instance.getHTML()).not.toContain("scryb-cell-align");
    expect(instance.getHTML()).not.toContain("scryb-cell-valign");
  });

  it("render each axis as its own class, both at once", () => {
    const instance = createEditor(TABLE_HTML);
    setCellAttrs(instance, { cellAlign: "center", cellVerticalAlign: "middle" });

    const html = instance.getHTML();
    expect(html).toContain("scryb-cell-align-center");
    expect(html).toContain("scryb-cell-valign-middle");
  });

  it("survive an HTML round trip", () => {
    const instance = createEditor(TABLE_HTML);
    setCellAttrs(instance, { cellAlign: "right", cellVerticalAlign: "bottom" });

    const reparsed = new Editor({
      extensions: [StarterKit, TableBundle],
      content: instance.getHTML(),
    });

    expect(cellAttrs(reparsed)["cellAlign"]).toBe("right");
    expect(cellAttrs(reparsed)["cellVerticalAlign"]).toBe("bottom");
    reparsed.destroy();
  });

  it("parse to the value, not to an object", () => {
    // The failure mode this repo has hit twice: parseHTML returning
    // `{ attr: value }` stores a truthy object, which renders as
    // `[object Object]` and is dropped by the browser.
    const instance = createEditor(
      '<table><tbody><tr><td class="scryb-cell-align-right"><p>Cell</p></td></tr></tbody></table>',
    );

    expect(cellAttrs(instance)["cellAlign"]).toBe("right");
    expect(instance.getHTML()).not.toContain("[object Object]");
  });

  it("read the inline style a word processor pastes", () => {
    const instance = createEditor(
      '<table><tbody><tr><td style="text-align: center; vertical-align: middle"><p>Cell</p></td></tr></tbody></table>',
    );

    expect(cellAttrs(instance)["cellAlign"]).toBe("center");
    expect(cellAttrs(instance)["cellVerticalAlign"]).toBe("middle");
  });

  it("parse an unsupported value as unset", () => {
    const instance = createEditor(
      '<table><tbody><tr><td style="text-align: justify; vertical-align: baseline"><p>Cell</p></td></tr></tbody></table>',
    );

    expect(cellAttrs(instance)["cellAlign"]).toBeNull();
    expect(cellAttrs(instance)["cellVerticalAlign"]).toBeNull();
  });

  it("apply to a header cell as well as a body cell", () => {
    const instance = createEditor(
      "<table><tbody><tr><th><p>Head</p></th></tr><tr><td><p>Cell</p></td></tr></tbody></table>",
    );
    setCellAttrs(instance, { cellAlign: "center" });

    const html = instance.getHTML();
    expect(html.match(/scryb-cell-align-center/g)).toHaveLength(2);
  });

  it("leave other block types alone", () => {
    const instance = createEditor("<p>Hello</p>");
    const paragraph = instance.state.doc.nodeAt(0)!;

    expect("cellAlign" in paragraph.attrs).toBe(false);
    expect("tableWidth" in paragraph.attrs).toBe(false);
  });
});
