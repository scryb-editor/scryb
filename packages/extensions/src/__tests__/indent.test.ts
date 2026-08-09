import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { IndentExtension } from "../indent.extension";

// =============================================================================
// Indent round trip
// =============================================================================
//
// `parseHTML` returned `{ indent: value }` where Tiptap wants the value: the
// return is assigned straight onto the attribute, so every parsed block stored
// `indent: { indent: 30 }`. Indentation was therefore lost on any HTML round
// trip, and `renderHTML`'s `!indent` check passed an object through as truthy,
// emitting `margin-left: [object Object]px` — dropped by the browser, leaving
// the stray `style=""` visible on every block in the demo's Output tab.
// =============================================================================

let editor: Editor | null = null;

function createEditor(content: string): Editor {
  editor = new Editor({
    extensions: [StarterKit, IndentExtension],
    content,
  });
  return editor;
}

function indentAttrs(instance: Editor): unknown[] {
  const found: unknown[] = [];
  instance.state.doc.descendants((node) => {
    if (node.type.name === "paragraph") found.push(node.attrs["indent"]);
    return true;
  });
  return found;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("IndentExtension", () => {
  it("parses margin-left into a number, not an object", () => {
    const instance = createEditor('<p style="margin-left: 30px">Indented</p>');

    expect(indentAttrs(instance)).toEqual([30]);
  });

  it("defaults an un-indented block to 0", () => {
    const instance = createEditor("<p>Plain</p>");

    expect(indentAttrs(instance)).toEqual([0]);
  });

  it("survives an HTML round trip", () => {
    const instance = createEditor('<p style="margin-left: 60px">Indented</p>');

    const html = instance.getHTML();
    expect(html).toContain("margin-left: 60px");

    const reparsed = new Editor({ extensions: [StarterKit, IndentExtension], content: html });
    expect(indentAttrs(reparsed)).toEqual([60]);
    reparsed.destroy();
  });

  it("emits no style attribute for an un-indented block", () => {
    const instance = createEditor("<p>Plain</p>");

    // `style=""` on every block was the visible symptom: an object attribute
    // rendered to a declaration the browser then discarded.
    expect(instance.getHTML()).not.toContain('style=""');
    expect(instance.getHTML()).not.toContain("[object Object]");
  });

  it("indents and outdents through the commands", () => {
    const instance = createEditor("<p>Plain</p>");
    instance.commands.setTextSelection(2);

    (instance.commands as unknown as { indent: () => boolean }).indent();
    expect(indentAttrs(instance)[0]).toBeGreaterThan(0);

    (instance.commands as unknown as { outdent: () => boolean }).outdent();
    expect(indentAttrs(instance)).toEqual([0]);
  });
});
