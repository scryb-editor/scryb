import { describe, it, expect, afterEach, vi } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { BlockBackgroundExtension, ResizableImageExtension } from "@scryb-editor/extensions";
import { TableBundle } from "@scryb-editor/extensions";
import {
  canColorBlockAt,
  canTurnIntoBlockAt,
  findTextblockPosInBlock,
  getBlockMenuCapabilities,
} from "../block-menu/capabilities";
import { canOpenBlockMenuAt } from "../block-menu/detection";
import {
  createBlockMenuItems,
  createBlockMenuItemsForBlock,
  getBlockDisplayName,
  getBlockTypeAtPos,
  getTableCellAlignAtPos,
  getTableCellVerticalAlignAtPos,
  handleBlockMenuAction,
  isTableFitToWidthAtPos,
  setBlockBackgroundColor,
  setTableCellAlignAtPos,
  setTableCellVerticalAlignAtPos,
  setTableFitToWidthAtPos,
} from "../block-menu/actions";
import type { BlockMenuLabels } from "../block-menu/types";

// =============================================================================
// Per-block menu capabilities
// =============================================================================
//
// The menu used to be the same five rows on every block, so it offered actions
// that could not run: Colors wrote nothing on a code block, an image or a
// horizontal rule, and Turn into reported "paragraph" as the current type of an
// image. These tests run against a real editor rather than a mocked document,
// because the whole point is whether the command behind the row would actually
// change the document.
// =============================================================================

const LABELS: BlockMenuLabels = {
  delete: "Delete",
  duplicate: "Duplicate",
  copy: "Copy",
  colors: "Colors",
  turnInto: "Turn into",
  alignment: "Alignment",
  alignLeft: "Left",
  alignCenter: "Center",
  alignRight: "Right",
  alignTop: "Top",
  alignMiddle: "Middle",
  alignBottom: "Bottom",
  fitToWidth: "Fit to width",
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
  blockTypes: {
    paragraph: "Paragraph",
    heading1: "Heading 1",
    heading2: "Heading 2",
    heading3: "Heading 3",
    bulletList: "Bullet List",
    orderedList: "Ordered List",
    taskList: "Task List",
    blockquote: "Blockquote",
    codeBlock: "Code Block",
    table: "Table",
    image: "Image",
    divider: "Divider",
  },
};

let editor: Editor | null = null;

function createEditor(content: string): Editor {
  editor = new Editor({
    extensions: [
      StarterKit,
      BlockBackgroundExtension,
      ResizableImageExtension,
      // The bundle, not the four Tiptap extensions on their own: the layout
      // attributes ship inside it, and the capability check asks the node
      // whether it declares them.
      TableBundle,
    ],
    content,
  });
  return editor;
}

const TABLE_HTML = "<table><tbody><tr><th><p>Head</p></th></tr><tr><td><p>Cell</p></td></tr></tbody></table>";

/** Position of the first node of the given type, as the drag handle reports it. */
function posOf(instance: Editor, typeName: string): number {
  let found: number | null = null;
  instance.state.doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.type.name === typeName) {
      found = pos;
      return false;
    }
    return true;
  });
  if (found === null) throw new Error(`no ${typeName} in the document`);
  return found;
}

/** The `colwidth` attribute of every cell in the table at `pos`, in document order. */
function columnWidths(instance: Editor, pos: number): unknown[] {
  const widths: unknown[] = [];
  const table = instance.state.doc.nodeAt(pos)!;
  table.descendants((node) => {
    if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
      widths.push(node.attrs["colwidth"]);
      return false;
    }
    return true;
  });
  return widths;
}

/** Stands in for a column drag, which is the only thing that writes `colwidth`. */
function setColumnWidths(instance: Editor, pos: number, width: number): void {
  const tr = instance.state.tr;
  const positions: number[] = [];
  instance.state.doc.nodeAt(pos)!.descendants((node, offset) => {
    if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
      positions.push(pos + 1 + offset);
      return false;
    }
    return true;
  });
  for (const cellPos of positions.reverse()) {
    const cell = tr.doc.nodeAt(cellPos)!;
    tr.setNodeMarkup(cellPos, undefined, { ...cell.attrs, colwidth: [width] });
  }
  instance.view.dispatch(tr);
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

// ═══════════════ findTextblockPosInBlock ═══════════════

describe("findTextblockPosInBlock", () => {
  it("returns a position inside a paragraph", () => {
    const instance = createEditor("<p>Hello</p>");
    const pos = posOf(instance, "paragraph");

    expect(findTextblockPosInBlock(instance, pos)).toBe(pos + 1);
  });

  it("reaches the paragraph nested inside a list item", () => {
    const instance = createEditor("<ul><li><p>Item</p></li></ul>");
    const itemPos = posOf(instance, "listItem");
    const paragraphPos = posOf(instance, "paragraph");

    expect(findTextblockPosInBlock(instance, itemPos)).toBe(paragraphPos + 1);
  });

  it("returns null for a block with no textblock inside it", () => {
    const instance = createEditor("<p>a</p><hr><p>b</p>");

    expect(findTextblockPosInBlock(instance, posOf(instance, "horizontalRule"))).toBeNull();
  });

  it("returns null rather than a position in the following block", () => {
    // The old fallback returned `pos + 1`, which for an atom lands past the
    // node — every action then ran against whatever block came next.
    const instance = createEditor('<p>before</p><hr><p>after</p>');
    const rulePos = posOf(instance, "horizontalRule");
    const followingParagraph = rulePos + 1;

    expect(findTextblockPosInBlock(instance, rulePos)).not.toBe(followingParagraph);
    expect(findTextblockPosInBlock(instance, rulePos)).toBeNull();
  });

  it("returns null for a null position", () => {
    const instance = createEditor("<p>Hello</p>");

    expect(findTextblockPosInBlock(instance, null)).toBeNull();
  });
});

// ═══════════════ canColorBlockAt ═══════════════

describe("canColorBlockAt", () => {
  it("is true for a paragraph", () => {
    const instance = createEditor("<p>Hello</p>");

    expect(canColorBlockAt(instance, posOf(instance, "paragraph"))).toBe(true);
  });

  it("is true for a heading", () => {
    const instance = createEditor("<h2>Title</h2>");

    expect(canColorBlockAt(instance, posOf(instance, "heading"))).toBe(true);
  });

  it("is true for a blockquote", () => {
    const instance = createEditor("<blockquote><p>Quote</p></blockquote>");

    expect(canColorBlockAt(instance, posOf(instance, "blockquote"))).toBe(true);
  });

  it("is true for a list item, which colours through its paragraph", () => {
    const instance = createEditor("<ul><li><p>Item</p></li></ul>");

    expect(canColorBlockAt(instance, posOf(instance, "listItem"))).toBe(true);
  });

  it("is false for a code block", () => {
    const instance = createEditor("<pre><code>const a = 1;</code></pre>");

    expect(canColorBlockAt(instance, posOf(instance, "codeBlock"))).toBe(false);
  });

  it("is false for a horizontal rule", () => {
    const instance = createEditor("<p>a</p><hr>");

    expect(canColorBlockAt(instance, posOf(instance, "horizontalRule"))).toBe(false);
  });

  it("is false for an image", () => {
    const instance = createEditor('<img src="https://example.com/a.png">');

    expect(canColorBlockAt(instance, posOf(instance, "resizableImage"))).toBe(false);
  });

  it("agrees with what setBlockBackgroundColor actually does", () => {
    const instance = createEditor("<p>before</p><pre><code>x</code></pre>");
    const pos = posOf(instance, "codeBlock");

    const applied = setBlockBackgroundColor(instance, pos, "#FEF08A");

    expect(canColorBlockAt(instance, pos)).toBe(false);
    expect(applied).toBe(false);
    expect(instance.getHTML()).not.toContain("background-color");
  });

  it("agrees with setBlockBackgroundColor on a block that does support it", () => {
    const instance = createEditor("<p>Hello</p>");
    const pos = posOf(instance, "paragraph");

    const applied = setBlockBackgroundColor(instance, pos, "#FEF08A");

    expect(canColorBlockAt(instance, pos)).toBe(true);
    expect(applied).toBe(true);
    expect(instance.getHTML()).toContain("background-color");
  });

  it("is false when the BlockBackground extension is not loaded", () => {
    editor = new Editor({ extensions: [StarterKit], content: "<p>Hello</p>" });

    expect(canColorBlockAt(editor, posOf(editor, "paragraph"))).toBe(false);
  });
});

// ═══════════════ canTurnIntoBlockAt ═══════════════

describe("canTurnIntoBlockAt", () => {
  it("is true for a paragraph", () => {
    const instance = createEditor("<p>Hello</p>");

    expect(canTurnIntoBlockAt(instance, posOf(instance, "paragraph"))).toBe(true);
  });

  it("is true for a code block", () => {
    const instance = createEditor("<pre><code>x</code></pre>");

    expect(canTurnIntoBlockAt(instance, posOf(instance, "codeBlock"))).toBe(true);
  });

  it("is false for an image", () => {
    const instance = createEditor('<img src="https://example.com/a.png">');

    expect(canTurnIntoBlockAt(instance, posOf(instance, "resizableImage"))).toBe(false);
  });

  it("is false for a horizontal rule", () => {
    const instance = createEditor("<p>a</p><hr>");

    expect(canTurnIntoBlockAt(instance, posOf(instance, "horizontalRule"))).toBe(false);
  });
});

// ═══════════════ getBlockTypeAtPos ═══════════════

describe("getBlockTypeAtPos on a block with no textblock", () => {
  it("returns null for an image instead of claiming it is a paragraph", () => {
    const instance = createEditor('<img src="https://example.com/a.png">');

    expect(getBlockTypeAtPos(instance, posOf(instance, "resizableImage"))).toBeNull();
  });

  it("returns null for a horizontal rule", () => {
    const instance = createEditor("<p>a</p><hr>");

    expect(getBlockTypeAtPos(instance, posOf(instance, "horizontalRule"))).toBeNull();
  });

  it("still reports the type of a real textblock", () => {
    const instance = createEditor("<h1>Title</h1>");

    expect(getBlockTypeAtPos(instance, posOf(instance, "heading"))).toBe("heading1");
  });
});

// ═══════════════ getBlockMenuCapabilities ═══════════════

describe("getBlockMenuCapabilities", () => {
  it("reports both transforms for a paragraph", () => {
    const instance = createEditor("<p>Hello</p>");

    expect(getBlockMenuCapabilities(instance, posOf(instance, "paragraph"))).toEqual({
      colors: true,
      turnInto: true,
      align: false,
      fitToWidth: false,
    });
  });

  it("reports only turnInto for a code block", () => {
    const instance = createEditor("<pre><code>x</code></pre>");

    expect(getBlockMenuCapabilities(instance, posOf(instance, "codeBlock"))).toEqual({
      colors: false,
      turnInto: true,
      align: false,
      fitToWidth: false,
    });
  });

  it("reports neither for an image", () => {
    const instance = createEditor('<img src="https://example.com/a.png">');

    expect(getBlockMenuCapabilities(instance, posOf(instance, "resizableImage"))).toEqual({
      colors: false,
      turnInto: false,
      align: false,
      fitToWidth: false,
    });
  });
});

// ═══════════════ createBlockMenuItemsForBlock ═══════════════

describe("createBlockMenuItemsForBlock", () => {
  function idsOf(instance: Editor, typeName: string): string[] {
    return createBlockMenuItemsForBlock(instance, posOf(instance, typeName), LABELS).map(
      (item) => item.id,
    );
  }

  it("gives a paragraph the full menu, titled", () => {
    const instance = createEditor("<p>Hello</p>");

    expect(idsOf(instance, "paragraph")).toEqual([
      "header:blockType",
      "colors",
      "turnInto",
      "separator:clipboard",
      "duplicate",
      "copy",
      "separator:danger",
      "delete",
    ]);
  });

  it("drops Colors from a code block and keeps Turn into", () => {
    const instance = createEditor("<pre><code>x</code></pre>");

    expect(idsOf(instance, "codeBlock")).toEqual([
      "header:blockType",
      "turnInto",
      "separator:clipboard",
      "duplicate",
      "copy",
      "separator:danger",
      "delete",
    ]);
  });

  it("leaves an image with clipboard and delete only, still titled", () => {
    const instance = createEditor('<img src="https://example.com/a.png">');

    expect(idsOf(instance, "resizableImage")).toEqual([
      "header:blockType",
      "duplicate",
      "copy",
      "separator:danger",
      "delete",
    ]);
  });

  it("never opens on a separator", () => {
    const instance = createEditor('<img src="https://example.com/a.png">');
    const items = createBlockMenuItemsForBlock(
      instance,
      posOf(instance, "resizableImage"),
      LABELS,
    );

    expect(items[0]?.separator).toBeFalsy();
  });

  it("keeps Delete last and destructive whatever the block is", () => {
    const instance = createEditor('<img src="https://example.com/a.png">');
    const items = createBlockMenuItemsForBlock(
      instance,
      posOf(instance, "resizableImage"),
      LABELS,
    );
    const last = items[items.length - 1];

    expect(last?.id).toBe("delete");
    expect(last?.danger).toBe(true);
  });

  it("marks the active block type in the Turn into submenu", () => {
    const instance = createEditor("<h2>Title</h2>");
    const items = createBlockMenuItemsForBlock(instance, posOf(instance, "heading"), LABELS);
    const turnInto = items.find((item) => item.id === "turnInto");
    const active = turnInto?.submenuItems?.filter((item) => item.isActive) ?? [];

    expect(active.map((item) => item.id)).toEqual(["turn:heading2"]);
  });
});

// ═══════════════ Tables ═══════════════
//
// A table's handle used to open nothing at all. Now it opens a menu, which only
// works if the capabilities stop at the cell boundary: a cell's paragraph is a
// selection island belonging to the cell, and treating it as the table's own
// textblock would colour one cell while claiming to act on the table.
// =============================================================================

describe("a table", () => {
  it("has no textblock of its own — its cells' are not its", () => {
    const instance = createEditor(TABLE_HTML);

    expect(findTextblockPosInBlock(instance, posOf(instance, "table"))).toBeNull();
  });

  it("offers neither Colors nor Turn into", () => {
    const instance = createEditor(TABLE_HTML);

    expect(getBlockMenuCapabilities(instance, posOf(instance, "table"))).toEqual({
      colors: false,
      turnInto: false,
      align: true,
      fitToWidth: true,
    });
  });

  it("colours nothing when the colour command is aimed at it anyway", () => {
    const instance = createEditor(TABLE_HTML);

    const applied = setBlockBackgroundColor(instance, posOf(instance, "table"), "#FEF08A");

    expect(applied).toBe(false);
    expect(instance.getHTML()).not.toContain("background-color");
  });

  it("opens the block menu, which it no longer refuses to", () => {
    const instance = createEditor(TABLE_HTML);

    expect(canOpenBlockMenuAt(instance, posOf(instance, "table"))).toBe(true);
  });

  it("gets a titled menu of the actions that are true of a table", () => {
    const instance = createEditor(TABLE_HTML);
    const items = createBlockMenuItemsForBlock(instance, posOf(instance, "table"), LABELS);

    expect(items.map((item) => item.id)).toEqual([
      "header:blockType",
      "alignment",
      "fitToWidth",
      "separator:clipboard",
      "duplicate",
      "copy",
      "separator:danger",
      "delete",
    ]);
    expect(items[0]?.label).toBe("Table");

    // The row- and column-scoped actions stay in the table bubble menu, where
    // the selection they need already exists.
    expect(items.some((item) => item.id === "colors")).toBe(false);
    expect(items.some((item) => item.id === "turnInto")).toBe(false);
  });

  it("still reaches the paragraph when the menu is opened on a cell", () => {
    const instance = createEditor(TABLE_HTML);
    const cellPos = posOf(instance, "tableCell");

    // The cell is the block being pointed at here, so its own paragraph is
    // fair game — the isolating guard only blocks descending into a cell from
    // an ancestor.
    expect(findTextblockPosInBlock(instance, cellPos)).not.toBeNull();
  });
});

// ═══════════════ Table layout ═══════════════

describe("table layout actions", () => {
  it("reports full width and no cell alignment for an untouched table", () => {
    const instance = createEditor(TABLE_HTML);
    const pos = posOf(instance, "table");

    expect(isTableFitToWidthAtPos(instance, pos)).toBe(true);
    expect(getTableCellAlignAtPos(instance, pos)).toBeNull();
    expect(getTableCellVerticalAlignAtPos(instance, pos)).toBeNull();
  });

  it("aligns every cell, not just the first", () => {
    // The menu is opened from the table's drag handle, which carries no cell
    // selection to narrow to — acting on one cell would misreport what the
    // handle points at.
    const instance = createEditor(TABLE_HTML);
    const pos = posOf(instance, "table");

    expect(setTableCellAlignAtPos(instance, pos, "center")).toBe(true);

    const html = instance.getHTML();
    expect(html.match(/scryb-cell-align-center/g)).toHaveLength(2);
    expect(getTableCellAlignAtPos(instance, pos)).toBe("center");
  });

  it("keeps the two axes independent", () => {
    const instance = createEditor(TABLE_HTML);
    const pos = posOf(instance, "table");

    setTableCellAlignAtPos(instance, pos, "right");
    setTableCellVerticalAlignAtPos(instance, pos, "bottom");

    expect(getTableCellAlignAtPos(instance, pos)).toBe("right");
    expect(getTableCellVerticalAlignAtPos(instance, pos)).toBe("bottom");
  });

  it("reports null when the cells disagree", () => {
    const instance = createEditor(TABLE_HTML);
    const pos = posOf(instance, "table");
    setTableCellAlignAtPos(instance, pos, "center");

    // Reach past the shared setter to leave one cell out of step.
    const cellPos = posOf(instance, "tableCell");
    const cell = instance.state.doc.nodeAt(cellPos)!;
    instance.view.dispatch(
      instance.state.tr.setNodeMarkup(cellPos, undefined, { ...cell.attrs, cellAlign: "left" }),
    );

    expect(getTableCellAlignAtPos(instance, pos)).toBeNull();
  });

  it("leaves the table's width alone when a cell alignment is set", () => {
    const instance = createEditor(TABLE_HTML);
    const pos = posOf(instance, "table");

    setTableCellAlignAtPos(instance, pos, "center");

    expect(isTableFitToWidthAtPos(instance, pos)).toBe(true);
  });

  it("reports a table whose columns were dragged as not fitted", () => {
    // A dragged column becomes an inline min-width on the table, which outranks
    // the stylesheet: the table is as wide as its columns add up to, whatever
    // the width mode says. Reporting it as fitted lit the toggle on the one
    // table that needed pressing, so pressing it shrank the table instead.
    const instance = createEditor(TABLE_HTML);
    const pos = posOf(instance, "table");
    setColumnWidths(instance, pos, 560);

    expect(isTableFitToWidthAtPos(instance, pos)).toBe(false);
  });

  it("drops the dragged column widths when the table is fitted", () => {
    const instance = createEditor(TABLE_HTML);
    const pos = posOf(instance, "table");
    setColumnWidths(instance, pos, 560);

    expect(setTableFitToWidthAtPos(instance, pos, true)).toBe(true);

    expect(columnWidths(instance, pos)).toEqual([null, null]);
    expect(isTableFitToWidthAtPos(instance, pos)).toBe(true);
  });

  it("clears the widths and the mode in one transaction", () => {
    // One undo should put back the table the user was looking at, not half of
    // it — a table still carrying the widths of a mode it no longer has.
    const instance = createEditor(TABLE_HTML);
    const pos = posOf(instance, "table");
    setColumnWidths(instance, pos, 560);

    const dispatch = vi.spyOn(instance.view, "dispatch");
    setTableFitToWidthAtPos(instance, pos, true);

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("keeps the column widths when the table is shrunk to its content", () => {
    // The widths are the reason a content-width table has the shape it does.
    const instance = createEditor(TABLE_HTML);
    const pos = posOf(instance, "table");
    setColumnWidths(instance, pos, 560);

    expect(setTableFitToWidthAtPos(instance, pos, false)).toBe(true);

    expect(columnWidths(instance, pos)).toEqual([[560], [560]]);
  });

  it("fits a dragged table on the first press rather than shrinking it", () => {
    const instance = createEditor(TABLE_HTML);
    const pos = posOf(instance, "table");
    setColumnWidths(instance, pos, 560);

    expect(handleBlockMenuAction(instance, pos, "fitToWidth")).toBe(true);

    expect(instance.state.doc.nodeAt(pos)?.attrs["tableWidth"]).toBeNull();
    expect(columnWidths(instance, pos)).toEqual([null, null]);
  });

  it("refuses a position that is not a table", () => {
    const instance = createEditor("<p>Hello</p>");
    const pos = posOf(instance, "paragraph");

    expect(setTableCellAlignAtPos(instance, pos, "center")).toBe(false);
    expect(setTableCellVerticalAlignAtPos(instance, pos, "middle")).toBe(false);
    expect(setTableFitToWidthAtPos(instance, pos, false)).toBe(false);
    expect(getTableCellAlignAtPos(instance, pos)).toBeNull();
    expect(isTableFitToWidthAtPos(instance, pos)).toBe(false);
  });

  it("routes the menu ids through handleBlockMenuAction", () => {
    const instance = createEditor(TABLE_HTML);
    const pos = posOf(instance, "table");

    expect(handleBlockMenuAction(instance, pos, "align:right")).toBe(true);
    expect(getTableCellAlignAtPos(instance, pos)).toBe("right");

    expect(handleBlockMenuAction(instance, pos, "align:bottom")).toBe(true);
    expect(getTableCellVerticalAlignAtPos(instance, pos)).toBe("bottom");

    // The toggle reads the document rather than trusting a stale menu item.
    expect(handleBlockMenuAction(instance, pos, "fitToWidth")).toBe(true);
    expect(isTableFitToWidthAtPos(instance, pos)).toBe(false);
    expect(handleBlockMenuAction(instance, pos, "fitToWidth")).toBe(true);
    expect(isTableFitToWidthAtPos(instance, pos)).toBe(true);
  });

  it("puts the layout controls in the table's menu, marking the current state", () => {
    const instance = createEditor(TABLE_HTML);
    const pos = posOf(instance, "table");
    const items = createBlockMenuItemsForBlock(instance, pos, LABELS);

    expect(items.map((item) => item.id)).toEqual([
      "header:blockType",
      "alignment",
      "fitToWidth",
      "separator:clipboard",
      "duplicate",
      "copy",
      "separator:danger",
      "delete",
    ]);

    expect(items.find((item) => item.id === "fitToWidth")?.isActive).toBe(true);

    // Two axes, separated, because they are independent settings — a flat list
    // of six would read as one six-way choice.
    const aligns = items.find((item) => item.id === "alignment")?.submenuItems ?? [];
    expect(aligns.map((item) => item.id)).toEqual([
      "align:left",
      "align:center",
      "align:right",
      "separator:verticalAlign",
      "align:top",
      "align:middle",
      "align:bottom",
    ]);

    // Unset reads as left and top, which is where the stylesheet already puts
    // the content — one marked per axis, never zero.
    expect(aligns.filter((item) => item.isActive).map((item) => item.id)).toEqual([
      "align:left",
      "align:top",
    ]);
  });

  it("follows the table's state into the menu", () => {
    const instance = createEditor(TABLE_HTML);
    const pos = posOf(instance, "table");
    setTableCellAlignAtPos(instance, pos, "center");
    setTableCellVerticalAlignAtPos(instance, pos, "bottom");
    setTableFitToWidthAtPos(instance, pos, false);

    const items = createBlockMenuItemsForBlock(instance, pos, LABELS);
    const aligns = items.find((item) => item.id === "alignment")?.submenuItems ?? [];

    expect(aligns.filter((item) => item.isActive).map((item) => item.id)).toEqual([
      "align:center",
      "align:bottom",
    ]);
    expect(items.find((item) => item.id === "fitToWidth")?.isActive).toBe(false);
  });

  it("drops the layout controls when a caller has not translated them", () => {
    const instance = createEditor(TABLE_HTML);
    const items = createBlockMenuItemsForBlock(instance, posOf(instance, "table"), {
      ...LABELS,
      alignment: undefined,
      fitToWidth: undefined,
    });

    expect(items.map((item) => item.id)).toEqual([
      "header:blockType",
      "duplicate",
      "copy",
      "separator:danger",
      "delete",
    ]);
  });

  it("gives no layout controls to a paragraph", () => {
    const instance = createEditor("<p>Hello</p>");
    const items = createBlockMenuItemsForBlock(instance, posOf(instance, "paragraph"), LABELS);

    expect(items.some((item) => item.id === "alignment")).toBe(false);
    expect(items.some((item) => item.id === "fitToWidth")).toBe(false);
  });
});

// ═══════════════ The menu's title ═══════════════

describe("getBlockDisplayName", () => {
  it("names a heading by its level", () => {
    const instance = createEditor("<h2>Title</h2>");

    expect(getBlockDisplayName(instance, posOf(instance, "heading"), LABELS.blockTypes)).toBe(
      "Heading 2",
    );
  });

  it("names a blockquote", () => {
    const instance = createEditor("<blockquote><p>Quote</p></blockquote>");

    expect(getBlockDisplayName(instance, posOf(instance, "blockquote"), LABELS.blockTypes)).toBe(
      "Blockquote",
    );
  });

  it("names a list item by its list", () => {
    const instance = createEditor("<ol><li><p>Item</p></li></ol>");

    expect(getBlockDisplayName(instance, posOf(instance, "listItem"), LABELS.blockTypes)).toBe(
      "Ordered List",
    );
  });

  it("names an image, which no conversion can target", () => {
    const instance = createEditor('<img src="https://example.com/a.png">');

    expect(
      getBlockDisplayName(instance, posOf(instance, "resizableImage"), LABELS.blockTypes),
    ).toBe("Image");
  });

  it("names a horizontal rule a divider", () => {
    const instance = createEditor("<p>a</p><hr>");

    expect(
      getBlockDisplayName(instance, posOf(instance, "horizontalRule"), LABELS.blockTypes),
    ).toBe("Divider");
  });

  it("returns null rather than a name a caller never provided", () => {
    const instance = createEditor('<img src="https://example.com/a.png">');
    const withoutImage = { ...LABELS.blockTypes, image: undefined };

    expect(getBlockDisplayName(instance, posOf(instance, "resizableImage"), withoutImage)).toBeNull();
  });

  it("is null for a null position", () => {
    const instance = createEditor("<p>Hello</p>");

    expect(getBlockDisplayName(instance, null, LABELS.blockTypes)).toBeNull();
  });
});

describe("the menu title in the built items", () => {
  it("leads the menu and is not interactive", () => {
    const instance = createEditor("<h1>Title</h1>");
    const items = createBlockMenuItemsForBlock(instance, posOf(instance, "heading"), LABELS);

    expect(items[0]).toEqual({ id: "header:blockType", label: "Heading 1", header: true });
    expect(items[0]?.submenuItems).toBeUndefined();
  });

  it("is dropped entirely when no label names the block", () => {
    const instance = createEditor('<img src="https://example.com/a.png">');
    const items = createBlockMenuItemsForBlock(instance, posOf(instance, "resizableImage"), {
      ...LABELS,
      blockTypes: { ...LABELS.blockTypes, image: undefined },
    });

    expect(items.some((item) => item.header)).toBe(false);
    expect(items[0]?.id).toBe("duplicate");
  });
});

// ═══════════════ Backwards compatibility ═══════════════

describe("createBlockMenuItems without a block context", () => {
  it("still returns every entry", () => {
    expect(createBlockMenuItems(LABELS).map((item) => item.id)).toEqual([
      "colors",
      "turnInto",
      "separator:clipboard",
      "duplicate",
      "copy",
      "separator:danger",
      "delete",
    ]);
  });
});
