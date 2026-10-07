import { describe, expect, it } from "vitest";
import { createScrybEditor } from "../editor-factory";
import { currentIndentLevel } from "../toolbar/indent-level";

describe("currentIndentLevel", () => {
  it("reads the selected block's indent in steps", () => {
    const editor = createScrybEditor({ content: "<p>a</p><p>b</p>" });
    expect(currentIndentLevel(editor)).toBe(0);
    editor.commands.indent();
    editor.commands.indent();
    expect(currentIndentLevel(editor)).toBe(2);
    editor.commands.setTextSelection(editor.state.doc.content.size - 1); // second paragraph
    expect(currentIndentLevel(editor)).toBe(0);
    editor.destroy();
  });
});
