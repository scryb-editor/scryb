import { describe, it, expect, afterEach, vi } from "vitest";
import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { createScrybEditor } from "../editor-factory";
import { getDomCaretBlock } from "../block-menu/caret";

let editor: Editor | undefined;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
  document.body.innerHTML = "";
});

function mount(content: string): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);
  return createScrybEditor({ element, content });
}

function blockPos(instance: Editor, text: string): number {
  let found = -1;
  instance.state.doc.forEach((node, offset) => {
    if (found === -1 && node.textContent === text) found = offset;
  });
  return found;
}

/** Puts the DOM caret inside the text of the block reading `text`. */
function placeDomCaret(instance: Editor, text: string): void {
  const block = [...instance.view.dom.children].find((el) => el.textContent === text)!;
  const range = document.createRange();
  range.setStart(block.firstChild!, 1);
  range.collapse(true);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

describe("getDomCaretBlock", () => {
  it("resolves the block the DOM caret is in, even before ProseMirror reads it", () => {
    editor = mount("<p>First</p><p>Second</p>");
    editor.commands.setTextSelection(2);
    placeDomCaret(editor, "Second");

    const block = getDomCaretBlock(editor);

    expect(block?.pos).toBe(blockPos(editor, "Second"));
    expect(block?.element.textContent).toBe("Second");
  });

  it("is null when the DOM caret is outside the editor", () => {
    editor = mount("<p>First</p>");
    const outside = document.createElement("p");
    outside.textContent = "elsewhere";
    document.body.appendChild(outside);
    const range = document.createRange();
    range.setStart(outside.firstChild!, 1);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);

    expect(getDomCaretBlock(editor)).toBeNull();
  });

  it("is null for a selected node, which has no DOM caret", () => {
    editor = mount("<p>First</p><p>Second</p>");
    placeDomCaret(editor, "Second");
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)));

    expect(getDomCaretBlock(editor)).toBeNull();
  });

  it("is null when the caret sits in DOM the document does not describe", () => {
    editor = mount("<p>First</p><p>Second</p>");
    placeDomCaret(editor, "Second");
    vi.spyOn(editor.view, "posAtDOM").mockImplementation(() => {
      throw new RangeError("Trying to find position for a DOM position outside of the document");
    });

    expect(getDomCaretBlock(editor)).toBeNull();
  });
});
