import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { BlockMoveExtension } from "../block-move.extension";

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

function texts(instance: Editor): string[] {
  const out: string[] = [];
  instance.state.doc.forEach((node) => out.push(node.textContent));
  return out;
}

describe("BlockMoveExtension", () => {
  it("provides moveBlock without the drag handle", () => {
    editor = new Editor({ extensions: [StarterKit, BlockMoveExtension], content: "<p>one</p><p>two</p>" });
    // "one" is 5 wide; inserting at 10 puts it after "two".
    expect(editor.commands.moveBlock(0, 10)).toBe(true);
    expect(texts(editor)).toEqual(["two", "one"]);
  });

  it("keeps the caret inside the block it moved", () => {
    editor = new Editor({ extensions: [StarterKit, BlockMoveExtension], content: "<p>one</p><p>two</p>" });
    editor.commands.setTextSelection(3); // "on|e"
    editor.commands.moveBlock(0, 10);
    const { $from } = editor.state.selection;
    expect($from.parent.textContent).toBe("one");
    expect($from.parentOffset).toBe(2);
  });
});
