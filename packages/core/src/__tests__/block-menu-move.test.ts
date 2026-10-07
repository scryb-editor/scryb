import { describe, it, expect, afterEach } from "vitest";
import type { Editor } from "@tiptap/core";
import { createScrybEditor, buildExtensions } from "../editor-factory";
import { createBlockMenuItemsForBlock, handleBlockMenuAction, BLOCK_MENU_ITEM_IDS } from "../block-menu/actions";
import { getCaretBlock } from "../block-menu/caret";
import { getBlockMoveTarget, moveBlockAtPos, moveCaretBlock } from "../block-menu/move";
import { CellSelection } from "@tiptap/pm/tables";
import { buildBlockMenuLabels } from "../i18n/menu-labels";
import { getKeyboardHintText } from "../accessibility/keyboard-hint";
import { en } from "../i18n/locales/en";

let editor: Editor | undefined;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

function blockPositions(instance: Editor): number[] {
  const out: number[] = [];
  instance.state.doc.forEach((_node, offset) => out.push(offset));
  return out;
}

function texts(instance: Editor): string[] {
  const out: string[] = [];
  instance.state.doc.forEach((node) => out.push(node.textContent));
  return out;
}

function listTexts(instance: Editor): string[] {
  const out: string[] = [];
  instance.state.doc.descendants((node) => {
    if (node.type.name === "listItem") out.push(node.textContent);
  });
  return out;
}

function caretIn(instance: Editor, text: string, offset = 1): void {
  let target = -1;
  instance.state.doc.descendants((node, pos) => {
    if (target === -1 && node.isText && node.text === text) target = pos + offset;
  });
  instance.commands.setTextSelection(target);
}

describe("moving blocks", () => {
  it("registers the command and the keys in every editor core builds", () => {
    const names = buildExtensions().map((ext) => ext.name);
    expect(names).toContain("scrybBlockMove");
    expect(names).toContain("scrybBlockMoveShortcuts");
  });

  it("resolves the caret block with the side menu's policy", () => {
    editor = createScrybEditor({ content: "<p>one</p><h2>two</h2>" });
    caretIn(editor, "two");
    expect(editor.state.doc.nodeAt(getCaretBlock(editor)!.pos)?.type.name).toBe("heading");
  });

  it("moves the caret block down and keeps the caret in it", () => {
    editor = createScrybEditor({ content: "<p>one</p><p>two</p><p>three</p>" });
    caretIn(editor, "one", 2);

    expect(moveCaretBlock(editor, "down")).toBe(true);

    expect(texts(editor)).toEqual(["two", "one", "three"]);
    const { $from } = editor.state.selection;
    expect($from.parent.textContent).toBe("one");
    expect($from.parentOffset).toBe(2);
  });

  it("refuses to move past either end", () => {
    editor = createScrybEditor({ content: "<p>one</p><p>two</p>" });
    caretIn(editor, "one");
    expect(moveCaretBlock(editor, "up")).toBe(false);
    caretIn(editor, "two");
    expect(moveCaretBlock(editor, "down")).toBe(false);
    expect(texts(editor)).toEqual(["one", "two"]);
  });

  it("moves a list item within its list, the same item the menu targets", () => {
    editor = createScrybEditor({ content: "<ul><li><p>a</p></li><li><p>b</p></li></ul><p>after</p>" });
    caretIn(editor, "b");
    const menuTarget = getCaretBlock(editor)!.pos;
    expect(editor.state.doc.nodeAt(menuTarget)?.type.name).toBe("listItem");

    expect(moveCaretBlock(editor, "up")).toBe(true);
    expect(listTexts(editor)).toEqual(["b", "a"]);
    expect(texts(editor)).toEqual(["ba", "after"]);

    // The menu entry, opened on that list item, moves it back.
    expect(handleBlockMenuAction(editor, getCaretBlock(editor)!.pos, BLOCK_MENU_ITEM_IDS.moveDown)).toBe(true);
    expect(listTexts(editor)).toEqual(["a", "b"]);
  });

  it("refuses to move blocks in a read-only editor", () => {
    editor = createScrybEditor({ content: "<p>one</p><p>two</p>" });
    caretIn(editor, "two");
    editor.setEditable(false);

    expect(moveCaretBlock(editor, "up")).toBe(false);
    expect(handleBlockMenuAction(editor, 0, BLOCK_MENU_ITEM_IDS.moveDown)).toBe(false);
    expect(texts(editor)).toEqual(["one", "two"]);
  });

  it("keeps one undo step per move", () => {
    editor = createScrybEditor({ content: "<p>one</p><p>two</p>" });
    caretIn(editor, "two");
    moveCaretBlock(editor, "up");
    editor.commands.undo();
    expect(texts(editor)).toEqual(["one", "two"]);
  });

  it("keeps a cell selection on the same cells when the table moves, and cell commands still work", () => {
    editor = createScrybEditor({
      content:
        "<p>before</p><table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></tbody></table>",
    });
    const cells: number[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "tableCell") cells.push(pos);
    });
    editor.view.dispatch(
      editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cells[0]!, cells[1]!)),
    );
    const [, tablePos] = blockPositions(editor);

    expect(moveBlockAtPos(editor, tablePos!, "up")).toBe(true);

    const selection = editor.state.selection;
    expect(selection).toBeInstanceOf(CellSelection);
    const selected: string[] = [];
    (selection as CellSelection).forEachCell((cell) => selected.push(cell.textContent));
    expect(selected).toEqual(["a", "b"]);
    expect(editor.commands.mergeCells()).toBe(true);
    expect(editor.state.doc.firstChild?.firstChild?.childCount).toBe(1);
  });

  it("moves a nested task item whole and never splits its paragraph from its sublist", () => {
    editor = createScrybEditor({
      content:
        '<ul data-type="taskList">' +
        '<li data-type="taskItem" data-checked="false"><p>parent</p>' +
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>child</p></li></ul></li>' +
        '<li data-type="taskItem" data-checked="false"><p>next</p></li>' +
        "</ul>",
    });
    caretIn(editor, "parent");
    // After the caret transaction: StarterKit's TrailingNode appends an empty
    // paragraph after the list on the first dispatch, which is not the move.
    const before = editor.getJSON();
    expect(editor.state.doc.nodeAt(getCaretBlock(editor)!.pos)?.type.name).toBe("taskItem");

    // The item's leading paragraph alone may not cross its sublist: the
    // schema (paragraph block*) would make ProseMirror invent an empty paragraph.
    const paragraphPos = editor.state.selection.$from.before();
    expect(getBlockMoveTarget(editor, paragraphPos, "down")).toBeNull();
    expect(moveBlockAtPos(editor, paragraphPos, "down")).toBe(false);
    expect(editor.getJSON()).toEqual(before);

    expect(moveCaretBlock(editor, "down")).toBe(true);
    const outer: string[] = [];
    editor.state.doc.firstChild!.forEach((item) => outer.push(item.textContent));
    expect(outer).toEqual(["next", "parentchild"]);
    expect(editor.state.doc.firstChild!.lastChild!.childCount).toBe(2);
  });
});

describe("block menu move entries", () => {
  it("offers Move down on the first block and Move up on the last, with the shortcut", () => {
    editor = createScrybEditor({ content: "<p>one</p><p>two</p>" });
    const [first, second] = blockPositions(editor);
    const labels = buildBlockMenuLabels(en);

    const firstIds = createBlockMenuItemsForBlock(editor, first!, labels).map((i) => i.id);
    expect(firstIds).toContain(BLOCK_MENU_ITEM_IDS.moveDown);
    expect(firstIds).not.toContain(BLOCK_MENU_ITEM_IDS.moveUp);

    const up = createBlockMenuItemsForBlock(editor, second!, labels).find((i) => i.id === BLOCK_MENU_ITEM_IDS.moveUp);
    expect(up?.label).toBe("Move up");
    expect(up?.shortcut).toBe("Mod+Shift+ArrowUp");
  });

  it("moves the block the menu was opened on", () => {
    editor = createScrybEditor({ content: "<p>one</p><p>two</p>" });
    const [, second] = blockPositions(editor);
    expect(handleBlockMenuAction(editor, second!, BLOCK_MENU_ITEM_IDS.moveUp)).toBe(true);
    expect(texts(editor)).toEqual(["two", "one"]);
  });

  it("lists the move keys in the hint", () => {
    expect(getKeyboardHintText(en)).toMatch(/↑ \/ \S*↓/);
  });
});
